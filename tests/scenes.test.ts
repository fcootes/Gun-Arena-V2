import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { ModePosters, modeSceneDescription } from "../src/ModePosters";
import {
  createWeaponAssembly,
  orientHeldWeapon,
  disposeWeaponObject,
  WEAPON_MODEL_IDS,
} from "../src/weaponModels";
import {
  buildBotVisuals,
  setActorWeaponModel,
  disposeBotVisuals,
  disposeBotTextureCache,
} from "../src/botBuilder";
import { createLobbyAvatar } from "../src/lobbyAvatar";
import { createViewmodelManager, WEAPONS } from "../src/weapons";

const canvasContext = new Proxy(
  {},
  {
    get: (_target, key) =>
      String(key).includes("Gradient")
        ? () => ({ addColorStop() {} })
        : () => {},
  },
);
(globalThis as any).document = {
  createElement: () => ({
    width: 256,
    height: 256,
    getContext: () => canvasContext,
  }),
};
const actor = buildBotVisuals({
  botId: 1,
  team: "blue",
  isZombie: false,
  zType: "walker",
  isVIP: false,
  weaponTypeIndex: 0,
  weaponType: "ar",
  factionAlignment: "usmc",
});
const scene = new THREE.Scene(),
  avatar = createLobbyAvatar(scene, new THREE.Vector3());
const camera = new THREE.PerspectiveCamera(),
  manager = createViewmodelManager();
camera.add(manager.root);
const direction = (assembly: ReturnType<typeof createWeaponAssembly>) => {
  assembly.root.updateWorldMatrix(true, true);
  const origin = assembly.root.getWorldPosition(new THREE.Vector3());
  return assembly.muzzle
    .getWorldPosition(new THREE.Vector3())
    .sub(origin)
    .normalize();
};
for (const id of WEAPON_MODEL_IDS) {
  const inspection = createWeaponAssembly(id);
  assert.ok(
    direction(inspection).z < -0.95,
    `${id}: untouched inspect convention`,
  );
  orientHeldWeapon(inspection, "positive-z");
  orientHeldWeapon(inspection, "positive-z");
  assert.ok(direction(inspection).z > 0.95, `${id}: idempotent half-turn`);
  disposeWeaponObject(inspection.root);
  setActorWeaponModel(actor, id);
  const weapon = WEAPONS.find((w) => w.id === id)!;
  avatar.setWeapon(id);
  avatar.update(0.5);
  let lobbyAssembly: ReturnType<typeof createWeaponAssembly> | undefined;
  avatar.group.traverse((o) => {
    if (o.userData.weaponAssembly) lobbyAssembly = o.userData.weaponAssembly;
  });
  assert.ok(lobbyAssembly);
  assert.ok(
    direction(lobbyAssembly!).z > 0.85,
    `${id}: actual lobby holding rig faces the character's +Z`,
  );
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 3]) {
    actor.rootGroup.rotation.y = yaw;
    const actorForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw,
    );
    assert.ok(
      direction(actor.weaponAssembly!).dot(actorForward) > 0.85,
      `${id}: bot/third-person rig faces its owner`,
    );
    camera.rotation.y = yaw;
    for (const reloading of [false, true]) {
      manager.update(
        0.016,
        weapon,
        {
          ammo: weapon.mag,
          reserve: weapon.reserve,
          reloading,
          reloadT: 0.4,
          totalReloadT: 1,
        },
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
      const held = manager.root.children.find(
        (o) => o.visible && o.userData.weaponId === id,
      )!;
      // Check the assembly's -Z basis after camera, reload and recoil transforms.
      const heldForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        held.getWorldQuaternion(new THREE.Quaternion()),
      );
      assert.ok(
        heldForward.dot(camera.getWorldDirection(new THREE.Vector3())) > 0.95,
        `${id}: FPS remains forward during animation`,
      );
      assert.ok(
        [...manager.getMuzzlePosition(new THREE.Vector3()).toArray()].every(
          Number.isFinite,
        ),
      );
    }
  }
}
avatar.destroy();
disposeBotVisuals(actor.rootGroup);
disposeBotVisuals(manager.root);
disposeBotTextureCache();
console.log(
  "PASS: all twelve inspect, lobby, bot/third-person and animated FPS directions; swaps never double-flip",
);

const scenes = new Set<string>();
for (const map of ["training", "area51", "shattered_wall"] as const) {
  for (const faction of ["usmc", "apex"] as const) {
    const markup = renderToStaticMarkup(
      React.createElement(ModePosters, {
        mode: "extraction",
        map,
        faction,
        onSelect() {},
      }),
    );
    assert.equal((markup.match(/<button/g) ?? []).length, 4);
    assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 1);
    assert.equal((markup.match(/role="img"/g) ?? []).length, 4);
    assert.equal(
      (markup.match(new RegExp(`data-theater="${map}"`, "g")) ?? []).length,
      4,
    );
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(
      new Set(ids).size,
      ids.length,
      "Each scene owns collision-free SVG resources",
    );
    for (const m of markup.matchAll(/url\(#([^)]*)\)/g))
      assert.ok(ids.includes(m[1]), `Resolved SVG reference ${m[1]}`);
    assert.match(markup, /data-scene-object="faction-confrontation"/);
    assert.match(markup, /data-scene-object="360-crossfire"/);
    assert.match(
      markup,
      new RegExp(
        `data-scene-object="${faction === "apex" ? "plasma-last-stand" : "marine-last-stand"}"`,
      ),
    );
    if (map === "shattered_wall")
      assert.match(
        markup,
        new RegExp(`data-scene-object="${faction}-storm-exfil"`),
      );
    else
      assert.match(
        markup,
        new RegExp(
          `data-scene-object="${faction === "apex" ? "mainframe-sabotage" : "antidote-recovery"}"`,
        ),
      );
    for (const mode of ["team", "ffa", "zombie", "extraction"] as const) {
      assert.ok(modeSceneDescription(mode, map, faction).length > 60);
      assert.match(
        markup,
        new RegExp(`data-scene="${mode}-${map}-${faction}"`),
      );
    }
    scenes.add(markup);
  }
}
assert.equal(
  scenes.size,
  6,
  "Every map/faction deck has different rendered artwork",
);
console.log(
  "PASS: twenty-four reactive mode scenes, all four extraction variants, selection semantics and unique SVG resources",
);
