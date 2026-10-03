import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { CLASSES } from '../src/classes';
import { DEFAULT_ELITE_SQUAD, type Bot } from '../src/types';
import { createWorld, initWorld, updateHeliDefenses } from '../src/world';
import { createLobbyAvatar, buildWeaponMesh } from '../src/lobbyAvatar';
import { disposeBotVisuals } from '../src/botBuilder';

const context = new Proxy({}, { get: (_target, key) => String(key).includes('Gradient')
  ? () => ({ addColorStop() {} }) : () => {} });
(globalThis as any).document = { createElement: () => ({ width: 256, height: 256, getContext: () => context }) };
(globalThis as any).Audio = class { addEventListener() {} removeEventListener() {} load() {} };
const { TacticalSquad } = await import('../src/TacticalSquad');
const { VAULT_WEAPONS } = await import('../src/LoadoutDMZ');
const { ModePosters } = await import('../src/ModePosters');

assert.deepEqual(Object.keys(CLASSES).sort(), ['assault', 'engineer', 'medic', 'recon', 'support']);
assert.equal(new Set(Object.values(CLASSES).map(c => c.icon)).size, 5);
assert.ok(DEFAULT_ELITE_SQUAD.every(member => CLASSES[member.archetype]));
const squadMarkup = renderToStaticMarkup(React.createElement(TacticalSquad, {
  squad: DEFAULT_ELITE_SQUAD, leader: 'assault', protocol: 'elite', preset: 'hold_position',
  setPreset() {}, friendlyCount: 4, setFriendlyCount() {}
}));
assert.equal((squadMarkup.match(/combat role/g) ?? []).length, 4);
assert.equal((squadMarkup.match(/secondary weapon/g) ?? []).length, 4);
assert.match(squadMarkup, /01 \/ YOU/);
assert.match(squadMarkup, /HOLD &amp; DEFEND/);
const posterMarkup = renderToStaticMarkup(React.createElement(ModePosters, { mode: 'extraction', map: 'shattered_wall', onSelect() {} }));
assert.equal((posterMarkup.match(/<button/g) ?? []).length, 4);
assert.equal((posterMarkup.match(/aria-pressed="true"/g) ?? []).length, 1);
console.log('PASS: five classes, editable four-member allocation, deployment presets and four mode posters');

const weapon = new THREE.Group(), holder = new THREE.Group(); holder.add(weapon);
for (const id of Object.keys(VAULT_WEAPONS)) {
  buildWeaponMesh(weapon, id);
  assert.ok(weapon.children.length > 0, `${id} has a procedural weapon mesh`);
  assert.equal(weapon.parent, holder, 'Mesh swaps preserve the studio root');
}
const resources = new Set<THREE.Material | THREE.BufferGeometry>();
weapon.traverse((o: any) => { if (o.geometry) resources.add(o.geometry); if (o.material) resources.add(o.material); });
let disposed = 0; resources.forEach(r => r.addEventListener('dispose', () => disposed++));
buildWeaponMesh(weapon, 'ar'); assert.equal(disposed, resources.size, 'Weapon swaps release each old resource once');
disposeBotVisuals(holder);
const avatarScene = new THREE.Scene();
const avatar = createLobbyAvatar(avatarScene, new THREE.Vector3());
let roundedHead = false;
avatar.group.traverse((o: any) => { if (o.geometry instanceof THREE.SphereGeometry && o.geometry.parameters.radius === .13) roundedHead = true; });
assert.ok(roundedHead);
const spot = avatar.group.children.find(o => o instanceof THREE.SpotLight) as THREE.SpotLight;
avatar.setEnvironment('hangar', 'usmc'); const warm = spot.color.getHex();
avatar.setEnvironment('shattered_wall', 'usmc'); assert.notEqual(spot.color.getHex(), warm);
let avatarTexture: THREE.Texture | undefined;
avatar.group.traverse((o: any) => { if (o.material?.map) avatarTexture = o.material.map; });
assert.ok(avatarTexture); let textureDisposals = 0;
avatarTexture.addEventListener('dispose', () => textureDisposals++);
avatar.destroy(); avatar.destroy(); assert.equal(textureDisposals, 1);
assert.equal(avatarScene.children.length, 0);
console.log('PASS: all weapon meshes, resource-safe swaps, rounded operator head and map lighting');

for (const map of ['training', 'hangar'] as const) {
  const scene = new THREE.Scene(), oldFog = new THREE.Fog(0, 10, 20); scene.fog = oldFog;
  const world = createWorld(scene, map);
  world.updateWorld(.016, 1, 'team');
  const fog = scene.fog; assert.ok(fog instanceof THREE.FogExp2);
  const reflection = scene.getObjectByName('Legacy_WetFloorReflection') as THREE.Mesh;
  assert.ok(reflection?.visible);
  assert.ok((reflection.material as THREE.ShaderMaterial).uniforms.reflectionOpacity.value > 0);
  let geometryDisposals = 0, materialDisposals = 0;
  reflection.geometry.addEventListener('dispose', () => geometryDisposals++);
  (reflection.material as THREE.Material).addEventListener('dispose', () => materialDisposals++);
  scene.fog = oldFog; world.updateWorld(.016, 2, 'team'); assert.equal(scene.fog, fog);
  world.dispose(); world.dispose(); assert.equal(scene.fog, oldFog);
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
  assert.equal(reflection.parent, null);
}
console.log('PASS: legacy exponential fog restoration and reflection teardown across both maps');

const scene = new THREE.Scene(), world = initWorld(scene, new THREE.PerspectiveCamera());
const offshore = world.offshore!;
offshore.phase = 'BOARD_HELICOPTER'; offshore.helicopter.group.visible = true;
offshore.helicopter.group.position.set(0, 14.5, 0);
// Isolate targeting, then inject an explicit obstruction to check line of sight.
world.hittableObjects.length = 0;
const hostile = (id: number, x: number, overrides = {}) => ({ id, pos: new THREE.Vector3(x, 15, 0), alive: true, isZombie: true, team: 'red', ...overrides } as unknown as Bot);
const target = hostile(1, 12), farther = hostile(2, 20);
const candidates = [farther, hostile(3, 4, { team: 'blue' }), hostile(4, 5, { alive: false }), hostile(5, 6, { isZombie: false }), target];
let hits = updateHeliDefenses(.016, candidates); assert.equal(hits.length, 1); assert.equal(hits[0].bot, target); assert.ok(hits[0].damage > 0);
assert.equal(updateHeliDefenses(.016, candidates).length, 0, 'Cadence limits firing');
assert.equal(updateHeliDefenses(.1, [hostile(6, 1000)]).length, 0, 'Targets beyond range are ignored');
const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 20), new THREE.MeshBasicMaterial());
wall.position.set(7, 16, 0); scene.add(wall); wall.updateMatrixWorld(); world.hittableObjects.push(wall);
assert.equal(updateHeliDefenses(.1, [target]).length, 0, 'Opaque geometry blocks minigun fire');
offshore.phase = 'SIGNAL_BEACON'; assert.equal(updateHeliDefenses(.1, candidates).length, 0);
world.dispose(); disposeBotVisuals(wall); assert.equal(updateHeliDefenses(.1, candidates).length, 0);
console.log('PASS: helicopter target selection, ally/dead guards, cadence, range, occlusion and phase gating');
