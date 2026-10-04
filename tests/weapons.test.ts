import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { WEAPONS, createViewmodelManager } from '../src/weapons';
import { ARSENAL, type Bot, type WeaponSlotState } from '../src/types';
import {
  createWeaponAssembly,
  WEAPON_MODEL_IDS,
  disposeWeaponObject,
} from '../src/weaponModels';
import {
  createWeaponMuzzleEffect,
  MUZZLE_PROFILES,
} from '../src/weaponEffects';
import {
  buildBotVisuals,
  setActorWeaponModel,
  disposeBotVisuals,
  disposeBotTextureCache,
} from '../src/botBuilder';
import { buildWeaponMesh } from '../src/lobbyAvatar';
import {
  activeProjectiles,
  firePlayerLauncher,
  fireBotLauncher,
  updateBotLauncherReload,
  updateProjectiles,
  segmentAABBHitFraction,
  clearCombatSystems,
  type CombatSystemsContext,
} from '../src/gameLoop';
import type { WorldManager } from '../src/world';

const context = new Proxy(
  {},
  {
    get: (_target, key) =>
      String(key).includes('Gradient')
        ? () => ({ addColorStop() {} })
        : () => {},
  },
);
(globalThis as any).document = {
  createElement: () => ({ width: 256, height: 256, getContext: () => context }),
};
(globalThis as any).Audio = class {
  addEventListener() {}
  removeEventListener() {}
  load() {}
};
(globalThis as any).window = {};
(globalThis as any).localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
};
const { VAULT_WEAPONS, ARMORY_GRID_ORDER, getWeaponPerformance, LoadoutDMZ } =
  await import('../src/LoadoutDMZ');
const { UNLOCK_CATALOG } = await import('../src/careerLedger');

assert.equal(WEAPONS.filter((w) => w.type === 'weapon').length, 12);
assert.deepEqual(new Set(ARMORY_GRID_ORDER), new Set(WEAPON_MODEL_IDS));
assert.equal(ARSENAL.RPG7_ROCKET.legacyId, 'rocket');
assert.equal(ARSENAL.M32_GRENADE.legacyId, 'grenade_launcher');
for (const id of WEAPON_MODEL_IDS) {
  assert.ok(VAULT_WEAPONS[id]);
  assert.ok(UNLOCK_CATALOG[id]);
}
const semanticFeatures: Record<string, string[]> = {
  ar: ['Mag', 'Buffer tube', 'Rail tooth'],
  shotgun: ['Pump groove', 'Tubular magazine', 'Ghost ring'],
  sniper: ['Barrel flute', 'Optic', 'Riser'],
  pistol: ['Slide serration', 'Trigger guard'],
  smg: ['Wire stock', 'Folding foregrip'],
  lmg: ['Feed tray', 'Side ammunition', 'Bipod'],
  br: ['Carry', 'Long stroke', 'charging'],
  laser: ['Energy coil', 'plasma cell', 'heat exhaust'],
  minigun: ['Rotary barrel', 'Flexible ammunition', 'spade'],
  railgun: ['conductive rail', 'Hydraulic', 'Capacitor'],
  rocket: ['launch tube', 'exhaust cone', 'Flip up'],
  grenade_launcher: ['Revolver cylinder', '40mm chamber', 'Leaf sight'],
};
const fingerprints = new Set<string>();
for (const id of WEAPON_MODEL_IDS) {
  const assembly = createWeaponAssembly(id);
  const features: string[] = [];
  let draws = 0;
  assembly.root.traverse((object: any) => {
    features.push(...(object.userData.features ?? []));
    if (object.isMesh) {
      draws++;
      assert.ok(
        [...object.geometry.attributes.position.array].every(Number.isFinite),
      );
    }
  });
  assert.ok(draws < 24, `${id}: detailed static components are batched`);
  for (const expected of semanticFeatures[id])
    assert.ok(
      features.some((f) => f.toLowerCase().includes(expected.toLowerCase())),
      `${id} includes ${expected}`,
    );
  const bounds = new THREE.Box3().setFromObject(assembly.root);
  assert.ok(bounds.getSize(new THREE.Vector3()).length() < 2);
  assert.ok(assembly.muzzle.position.z < -0.1, `${id}: forward muzzle anchor`);
  const fx = createWeaponMuzzleEffect(assembly);
  const points = fx.root.children.find(
    (o) => o instanceof THREE.Points,
  ) as THREE.Points;
  const buffer = points.geometry.attributes.position.array;
  for (let shot = 0; shot < 150; shot++) {
    fx.trigger();
    fx.update(0.016);
    assert.equal(points.geometry.attributes.position.array, buffer);
  }
  assert.equal(points.geometry.attributes.position.count, 192);
  assert.ok([...buffer].every(Number.isFinite));
  for (let tick = 0; tick < 200; tick++) fx.update(0.016);
  assert.ok(
    [...(points.geometry.attributes.alpha.array as Float32Array)].every(
      (a) => a === 0,
    ),
  );
  fingerprints.add(JSON.stringify(MUZZLE_PROFILES[id]));
  const resources = new Set<any>();
  assembly.root.traverse((o: any) => {
    if (o.geometry && !o.isSprite) resources.add(o.geometry);
    if (o.material) {
      resources.add(o.material);
      for (const t of o.material.userData.ownedTextures ?? []) resources.add(t);
    }
  });
  let releases = 0;
  resources.forEach((r) => r.addEventListener('dispose', () => releases++));
  disposeWeaponObject(assembly.root);
  disposeWeaponObject(assembly.root);
  assert.equal(
    releases,
    resources.size,
    `${id}: each GPU resource disposed once`,
  );
}
assert.equal(fingerprints.size, 12);
console.log(
  'PASS: twelve distinct detailed assemblies, moving parts, batched draws, bounded muzzle pools and complete GPU teardown',
);

const actor = buildBotVisuals({
  botId: 1,
  team: 'blue',
  isZombie: false,
  zType: 'walker',
  isVIP: false,
  weaponTypeIndex: 0,
  weaponType: 'ar',
  factionAlignment: 'usmc',
  makeFlashSprite: () => new THREE.Sprite(),
});
const actorHits = actor.hitParts.slice();
const manager = createViewmodelManager(),
  inspection = new THREE.Group();
for (const id of WEAPON_MODEL_IDS) {
  const weapon = WEAPONS.find((w) => w.id === id)!;
  buildWeaponMesh(inspection, id);
  setActorWeaponModel(actor, id);
  assert.equal(inspection.userData.weaponAssembly.root.userData.weaponId, id);
  assert.equal(actor.weaponAssembly!.root.userData.weaponId, id);
  assert.deepEqual(actor.hitParts, actorHits);
  manager.update(
    0.016,
    weapon,
    { ammo: weapon.mag, reserve: weapon.reserve },
    false,
    false,
    true,
    false,
    false,
    false,
    0,
    true,
    true,
  );
  manager.triggerMuzzleFlash(id);
  const active = manager.root.children.find(
    (o) => o.visible && o.userData.weaponId === id,
  );
  assert.ok(active, `${id} visible in the FPS manager`);
  manager.update(
    0.016,
    weapon,
    { reloading: true, reloadT: 0.4, totalReloadT: 1 },
    false,
    false,
    true,
    false,
    false,
    false,
    0,
    true,
    true,
  );
  assert.ok(
    [...manager.getMuzzlePosition(new THREE.Vector3()).toArray()].every(
      Number.isFinite,
    ),
  );
}
disposeBotVisuals(actor.rootGroup);
disposeBotVisuals(manager.root);
disposeBotVisuals(inspection);
disposeBotTextureCache();
console.log(
  'PASS: all twelve models propagate through inspection/lobby, first-person and actor equipment without changing hitboxes',
);

const from = new THREE.Vector3(0, 1.5, 0),
  to = new THREE.Vector3(30, 1.5, 0),
  thin = { minX: 4, maxX: 4.02, minY: 0, maxY: 3, minZ: -1, maxZ: 1 };
assert.equal(segmentAABBHitFraction(from, to, thin), 4 / 30);
assert.equal(
  segmentAABBHitFraction(
    new THREE.Vector3(0, 4, 0),
    new THREE.Vector3(30, 4, 0),
    thin,
  ),
  null,
);
assert.equal(
  segmentAABBHitFraction(new THREE.Vector3(4.01, 2, 0), to, thin),
  0,
);
const scene = new THREE.Scene();
const world = {
  worldColliders: [],
  hittableObjects: [],
  getHighestSurface: () => 0,
  damageEnvironmentalBlock() {},
  unregisterHittable() {},
} as unknown as WorldManager;
const damage: { target: Bot; amount: number; attacker: unknown }[] = [];
let selfDamage = 0;
const player = {
  pos: new THREE.Vector3(-100, 2, 0),
  yaw: 0,
  pitch: 0,
  health: 100,
  maxHealth: 100,
  alive: true,
  team: 'blue',
  applyDamage(amount: number) {
    selfDamage += amount;
  },
  heal() {},
};
const hostile = {
  id: 7,
  pos: new THREE.Vector3(2, 0, 0),
  alive: true,
  isZombie: false,
  team: 'red',
  zType: 'walker',
} as unknown as Bot;
const friendly = { ...hostile, id: 8, team: 'blue' } as Bot;
const ctx: CombatSystemsContext = {
  scene,
  world,
  camera: new THREE.PerspectiveCamera(),
  player,
  bots: [hostile, friendly],
  squadDirective: 'follow_lead',
  focusTargetId: null,
  pushKillFeed() {},
  damageBot(target, amount, _head, attacker) {
    damage.push({ target, amount, attacker });
  },
};
for (const id of ['rocket', 'grenade_launcher']) {
  const weapon = WEAPONS.find((w) => w.id === id)!;
  const state: WeaponSlotState = { ammo: 1, reserve: weapon.reserve };
  assert.equal(
    firePlayerLauncher(
      scene,
      weapon,
      state,
      from,
      new THREE.Vector3(),
      player.team,
      10,
    ),
    'blocked',
  );
  assert.equal(state.ammo, 1);
  assert.equal(
    firePlayerLauncher(
      scene,
      weapon,
      state,
      from,
      new THREE.Vector3(1, 0, 0),
      player.team,
      10,
    ),
    'fired',
  );
  assert.equal(state.ammo, 0);
  assert.equal(
    firePlayerLauncher(
      scene,
      weapon,
      state,
      from,
      new THREE.Vector3(1, 0, 0),
      player.team,
      10.01,
    ),
    'blocked',
  );
  updateProjectiles(0.1, ctx);
  assert.equal(activeProjectiles.length, 0);
  assert.ok(damage.some((d) => d.target === hostile));
  assert.ok(!damage.some((d) => d.target === friendly));
  assert.equal(
    firePlayerLauncher(
      scene,
      weapon,
      state,
      from,
      new THREE.Vector3(1, 0, 0),
      player.team,
      20,
    ),
    'reload',
  );
  assert.ok(damage.every((d) => d.attacker === 'player'));
  clearCombatSystems(scene, world);
  damage.length = 0;
}
const bot = {
  ...hostile,
  id: 9,
  weaponType: 'rocket',
  pos: new THREE.Vector3(0, 0, 0),
} as Bot;
updateBotLauncherReload(bot, 0.016);
assert.equal(bot.weaponAmmo, 1);
assert.ok(fireBotLauncher(scene, bot, new THREE.Vector3(12, 1.5, 0)));
assert.equal(bot.weaponAmmo, 0);
assert.equal(fireBotLauncher(scene, bot, new THREE.Vector3(12, 1.5, 0)), null);
assert.equal(bot.weaponReloadTimer, ARSENAL.RPG7_ROCKET.reloadTime);
updateBotLauncherReload(bot, 4);
assert.equal(bot.weaponAmmo, 1);
assert.equal(bot.weaponReserve, 5);
const launched = activeProjectiles[0];
let cleanup = 0;
launched.group.traverse((o: any) => {
  o.geometry?.addEventListener('dispose', () => cleanup++);
});
clearCombatSystems(scene, world);
assert.ok(cleanup > 0);
assert.equal(activeProjectiles.length, 0);
assert.equal(selfDamage, 0);
console.log(
  'PASS: launcher cadence/ammo, player and AI projectile paths, thin-target sweep, ally protection, attribution, reload and reset disposal',
);

assert.equal(getWeaponPerformance('ar').damage, WEAPONS[0].damage);
assert.equal(
  getWeaponPerformance('rocket').damage,
  ARSENAL.RPG7_ROCKET.splashDamage,
);
const noop = () => {};
const markup = renderToStaticMarkup(
  React.createElement(LoadoutDMZ, {
    selectedPrimary: 'rocket',
    setSelectedPrimary: noop,
    selectedSecondary: 'pistol',
    setSelectedSecondary: noop,
    selectedClassId: 'assault',
    setSelectedClassId: noop,
    visorType: 'standard',
    setVisorType: noop,
    onDeploy: noop,
  } as any),
);
for (const text of [
  'CORE PERFORMANCE',
  'TACTICAL',
  'PRECISION',
  'CONTROL',
  'MOBILITY',
  'OPTICAL TESTING VAULT',
  'TEST MUZZLE EFFECT',
  '[SLOT 1] EQUIPPED',
  'LOCKED',
  'M32',
])
  assert.ok(markup.includes(text), text);
assert.equal((markup.match(/aria-label="Inspect /g) ?? []).length, 12);
console.log(
  'PASS: isolated twelve-card armory, grouped real performance values, tactical scores and equipped/locked badges',
);
