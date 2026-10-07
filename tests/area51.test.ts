import assert from "node:assert/strict";
import * as THREE from "three";
import { createWorld, terrainHeight } from "../src/world";
import { Area51ExtractionGameLoop } from "../src/area51Campaign";
import { AREA51_LAYOUT } from "../src/area51World";
import { buildArea51Vehicle } from "../src/area51Assets";
import { WorldResources } from "../src/worldResources";
import {
  buildBotVisuals,
  disposeBotVisuals,
  disposeBotTextureCache,
} from "../src/botBuilder";
import type { Bot, CampaignEntity } from "../src/types";
const context = new Proxy(
  {},
  {
    get: (_o, k) =>
      String(k).includes("Gradient") ? () => ({ addColorStop() {} }) : () => {},
  },
);
(globalThis as any).document = {
  createElement: () => ({ width: 256, height: 256, getContext: () => context }),
};

for (const kind of ["humvee", "abrams"] as const) {
  const asset = buildArea51Vehicle(kind);
  assert.ok(asset.children.length <= 5, `${kind} draw-call budget`);
  asset.updateMatrixWorld(true);
  asset.traverse((o: any) => {
    if (o.isMesh)
      assert.ok(
        [...o.geometry.getAttribute("position").array].every(Number.isFinite),
      );
  });
  const owner = new WorldResources();
  owner.track(asset);
  owner.dispose();
}
const scene = new THREE.Scene(),
  world = createWorld(scene, "hangar"),
  facility = world.facility!;
assert.equal(terrainHeight(0, -170), 15);
assert.equal(terrainHeight(0, -20), 0);
for (const mode of ["ffa", "team", "zombie", "extraction"] as const) {
  for (const p of world.getSpawnPoints(mode)) {
    assert.equal(
      world.getHighestSurface(p.position.x, p.position.z, p.position.y),
      p.position.y,
      `${mode} walkable spawn`,
    );
    assert.ok(
      !world.worldColliders.some(
        (c) =>
          c.active !== false &&
          c.maxY > p.position.y + 0.6 &&
          c.minY < p.position.y + 1.8 &&
          p.position.x > c.minX - 0.4 &&
          p.position.x < c.maxX + 0.4 &&
          p.position.z > c.minZ - 0.4 &&
          p.position.z < c.maxZ + 0.4,
      ),
      `${mode} spawn clear of cover`,
    );
  }
}
assert.ok(world.navigationPoints!.some((p) => p.y === 15));
assert.ok(world.navigationPoints!.some((p) => p.x > 20 && p.z < -50));
// Exercise movement using the actual graph and collision system, not just node membership.
function walk(from: THREE.Vector3, to: THREE.Vector3) {
  const p = from.clone(),
    v = new THREE.Vector3();
  for (let i = 0; i < 3000; i++) {
    const target = world.getNavigationTarget!(p, to, "blue");
    if (p.distanceTo(to) < 1.1) return p;
    v.subVectors(target, p).setY(0);
    if (v.lengthSq()) v.normalize().multiplyScalar(6);
    world.moveEntityWithCollision(p, v, 0.38, p.y, p.y + 1.8, 0.05, "blue");
    p.y = world.getHighestSurface(p.x, p.z, p.y);
  }
  assert.fail(
    `route stalled ${from.toArray()} -> ${to.toArray()} at ${p.toArray()}`,
  );
}
const start = new THREE.Vector3(-8, 0, -7);
walk(start, new THREE.Vector3(27.5, 0, -65));
walk(new THREE.Vector3(27.5, 0, -65), new THREE.Vector3(18, 0, -112));
walk(new THREE.Vector3(18, 0, -112), AREA51_LAYOUT.liftBottom);
walk(AREA51_LAYOUT.liftTop, new THREE.Vector3(0, 15, -170));
const p = AREA51_LAYOUT.liftBottom.clone();
assert.ok(facility.transferLift(p, 15));
assert.equal(p.y, 15);
assert.ok(p.z <= -140);
const lightIntensities = () => {
  const result: number[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.PointLight && o.position.y > 24)
      result.push(o.intensity);
  });
  return result;
};
world.updateWorld(0.1, 1, "extraction");
assert.ok(
  lightIntensities().every((n) => n === 0),
  "dark arrival",
);
const tracked = new Set<THREE.BufferGeometry>();
scene.traverse((o: any) => {
  if (o.geometry) tracked.add(o.geometry);
});
let disposals = 0;
tracked.forEach((g) => g.addEventListener("dispose", () => disposals++));
world.dispose();
world.dispose();
assert.equal(disposals, tracked.size, "each geometry disposed once");
assert.equal(scene.children.length, 0);

for (const entity of ["security", "marine", "spartan"] as const) {
  const actor = buildBotVisuals({
    botId: 1,
    team: "red",
    isZombie: false,
    zType: "walker",
    isVIP: false,
    weaponTypeIndex: entity === "security" ? 3 : 0,
    weaponType: entity === "security" ? "pistol" : "ar",
    factionAlignment: "apex",
    campaignEntity: entity,
  });
  assert.equal(actor.faction, "usmc");
  assert.equal(
    actor.subClass,
    entity === "security"
      ? "military_police"
      : entity === "spartan"
        ? "spartan"
        : "rifleman",
  );
  if (entity === "spartan") {
    assert.ok(actor.healthMultiplier >= 2.5);
    assert.ok(actor.speedMultiplier > 1);
  }
  let badgeDisposals = 0;
  const ownedTextures = new Set<THREE.Texture>();
  if (entity === "security")
    actor.rootGroup.traverse((o: any) => {
      for (const texture of o.material?.userData?.ownedTextures ?? [])
        ownedTextures.add(texture);
    });
  ownedTextures.forEach(texture => texture.addEventListener("dispose", () => badgeDisposals++));
  disposeBotVisuals(actor.rootGroup);
  if (entity === "security")
    assert.equal(badgeDisposals, ownedTextures.size, "MP owned textures disposed once");
}
for (const faction of ["usmc", "apex"] as const) {
  const scene = new THREE.Scene(),
    world = createWorld(scene, "hangar"),
    facility = world.facility!,
    bots: Bot[] = [];
  const player = {
    pos: new THREE.Vector3(-8, 1.65, -7),
    yaw: 0,
    health: 100,
    shield: 100,
    kills: 0,
  };
  let victories = 0;
  const director = new Area51ExtractionGameLoop({
    faction,
    world,
    scene,
    player,
    bots,
    makeBot(team, type, _vip, _elite, entity?: CampaignEntity) {
      const bot = {
        id: bots.length,
        team,
        isZombie: team === "zombie",
        campaignEntity: entity,
        zType: type,
        group: new THREE.Group(),
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        health: 100,
        maxHealth: 100,
        alive: true,
        fireTimer: 1,
        userData: {},
        healthEl: { style: {} },
      } as Bot;
      scene.add(bot.group);
      bots.push(bot);
      return bot;
    },
    pushKillFeed() {},
    onVictory() {
      victories++;
    },
    onDefeat() {
      assert.fail("unexpected defeat");
    },
  });
  for (let i = 0; i < 40; i++) {
    world.updateWorld(0.1, i * 0.1, "extraction");
    director.update(0.1, {});
  }
  assert.ok(bots.length);
  if (faction === "apex") {
    assert.ok(bots.every((b) => !b.isZombie));
    assert.ok(bots.some((b) => b.campaignEntity === "security"));
  }
  player.pos.copy(facility.liftBottom).y += 1.65;
  director.update(0.1, { KeyE: true });
  assert.ok(player.pos.y < 5, "locked lift before objective");
  player.pos.copy(facility.objectivePosition);
  player.pos.x += 2.5;
  player.pos.y = 1.65;
  director.update(0.1, { KeyE: true });
  if (faction === "apex") {
    for (let i = 0; i < 81; i++) director.update(0.1, {});
    assert.equal(director.state.mainframeHacked, true);
  } else assert.equal(director.state.hasBioCylinder, true);
  assert.ok(facility.objectiveComplete);
  player.pos.copy(facility.liftBottom).y += 1.65;
  director.update(0.1, { KeyE: true });
  assert.equal(player.pos.y, 16.65);
  assert.equal(facility.phase, "ARRIVAL");
  player.pos.copy(facility.consolePosition);
  director.update(0.1, { KeyE: true });
  assert.equal(facility.phase, "INTRO");
  assert.ok(facility.controlsLocked);
  const bosses = bots.filter((b) => b.userData?.entranceActive);
  assert.equal(bosses.length, faction === "apex" ? 3 : 1);
  if (faction === "apex") {
    assert.ok(bots.every((b) => !b.isZombie));
    assert.ok(bosses.every((b) => b.campaignEntity === "spartan"));
  }
  for (let i = 0; i < 31; i++) {
    world.updateWorld(0.1, 5 + i * 0.1, "extraction");
    director.update(0.1, {});
  }
  assert.equal(facility.phase, "BOSS");
  assert.ok(!facility.controlsLocked);
  const alarms: number[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.PointLight && o.position.y > 24)
      alarms.push(o.intensity);
  });
  assert.ok(
    alarms.every((n) => n > 0),
    "emergency lights enabled",
  );
  if (bosses.length > 1) {
    bosses[0].alive = false;
    director.recordBossDefeated();
    assert.equal(
      director.state.bossDefeated,
      false,
      "all bosses must be killed",
    );
  }
  bosses.forEach((b) => (b.alive = false));
  director.update(0.1, {});
  assert.equal(facility.phase, "BOARD");
  // Boarding is impossible outside the cabin or before the door-slide animation completes.
  assert.equal(facility.tryBoard(new THREE.Vector3(10, 16.65, -219)), false);
  for (let i = 0; i < 40; i++)
    world.updateWorld(0.1, 9 + i * 0.1, "extraction");
  const squad = {
    ...bots[0],
    team: "blue",
    isZombie: false,
    alive: true,
    group: new THREE.Group(),
    pos: new THREE.Vector3(),
    userData: {},
    healthEl: { style: {} },
  } as Bot;
  bots.push(squad);
  scene.add(squad.group);
  player.pos.set(0, 16.65, -219);
  director.update(0.1, {});
  assert.equal(facility.phase, "DEPARTING");
  assert.equal(
    squad.group.parent,
    facility.helicopter.group,
    "squad boards transport",
  );
  assert.equal(squad.userData?.boarded, true);
  for (let i = 0; i < 82; i++) {
    world.updateWorld(0.1, 13 + i * 0.1, "extraction");
    director.update(0.1, {});
  }
  assert.equal(victories, 1);
  director.update(0.1, {});
  assert.equal(victories, 1);
  world.dispose();
  for (const b of bots) b.group.removeFromParent();
}
disposeBotTextureCache();
console.log(
  "PASS: Area 51 vehicles, all-mode spawns, connected routes, lift gates, resource disposal, both faction campaigns, complete boss gate and helicopter departure",
);
