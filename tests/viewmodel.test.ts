import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createViewmodelManager, WEAPONS, type ViewmodelManager } from '../src/weapons';
import { createWeaponAssembly, disposeWeaponObject, WEAPON_MODEL_IDS } from '../src/weaponModels';
import { VIEWMODEL_GRIPS } from '../src/viewmodelGrips';
import { beginWeaponReload, advanceWeaponReload } from '../src/weaponReload';
import { disposeBotVisuals } from '../src/botBuilder';
import type { WeaponSlotState } from '../src/types';

function step(vm: ViewmodelManager, id: string, dt = 1 / 60, state: WeaponSlotState = {}, aiming = false, sprinting = false, alive = true, playing = true) {
  vm.update(dt, WEAPONS.find(w => w.id === id)!, state, aiming, sprinting, true, false, false, false, 0, alive, playing);
}
function weapon(vm: ViewmodelManager, id: string) { return vm.root.getObjectByName(`Weapon_${id}`)!; }
function rig(vm: ViewmodelManager) { return vm.root.getObjectByName('FirstPersonHands')!; }
function pose(vm: ViewmodelManager) {
  const result: number[] = [];
  vm.root.traverse(o => result.push(...o.position.toArray(), ...o.quaternion.toArray()));
  return result;
}
assert.deepEqual(Object.keys(VIEWMODEL_GRIPS).sort(), [...WEAPON_MODEL_IDS].sort());
const acceptanceCamera = new THREE.PerspectiveCamera(74, 1280 / 720, .05, 100), sleeveEnd = new THREE.Vector3();
for (const id of WEAPON_MODEL_IDS) {
  const config = VIEWMODEL_GRIPS[id];
  for (const side of ['right', 'left'] as const) {
    assert.ok([...config[side].position, ...config[side].rotation].every(Number.isFinite));
    assert.ok(config[side].position[1] < .02 && Math.abs(config[side].position[0]) < .2);
    const attachment = new THREE.Quaternion().setFromEuler(new THREE.Euler(...config[side].rotation));
    const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(attachment);
    assert.ok(side === 'right' ? normal.x < -.99 : normal.x > .99 || normal.y > .99, `${id}: palms face the grip or underside`);
  }
  const assembly = createWeaponAssembly(id);
  assert.ok(config.right.position[2] > assembly.muzzle.position.z, `${id}: trigger hand stays behind muzzle`);
  assert.equal(assembly.root.getObjectByName('FirstPersonHands'), undefined, 'Bare studio/actor contract has no hands');
  disposeWeaponObject(assembly.root);
}
const handheld = createWeaponAssembly('minigun', { firstPerson: true });
assert.ok(handheld.parts.supportCradle, 'Handheld minigun has a stationary physical support surface');
const studioMinigun = createWeaponAssembly('minigun');
assert.equal(studioMinigun.parts.supportCradle, undefined, 'Actor/studio minigun keeps its spades');
disposeWeaponObject(studioMinigun.root);
disposeWeaponObject(handheld.root);
const utilityOnly = createViewmodelManager();
step(utilityOnly, 'grenade'); assert.equal(rig(utilityOnly).visible, false, 'A utility-first update cannot reveal an unposed hand palette'); utilityOnly.dispose();
console.log('PASS: twelve explicit metre-scale grip configurations, palm orientation, specialty handles and unchanged bare assemblies');

const vm = createViewmodelManager(); vm.prepare(WEAPON_MODEL_IDS);
const pair = rig(vm), right = pair.getObjectByName('rightHand')!, left = pair.getObjectByName('leftHand')!;
const instances: THREE.InstancedMesh[] = [];
pair.traverse(o => { if (o instanceof THREE.InstancedMesh) instances.push(o); });
assert.equal(instances.length, 2); assert.ok(instances.every(mesh => mesh.count === 30));
for (const mesh of instances) {
  const p = mesh.geometry.attributes.position, index = mesh.geometry.index!;
  const a = new THREE.Vector3().fromBufferAttribute(p, index.getX(0)), b = new THREE.Vector3().fromBufferAttribute(p, index.getX(1)), c = new THREE.Vector3().fromBufferAttribute(p, index.getX(2));
  assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-12, 'The first preparation triangle has nonzero area');
}
let handMeshes = 0;
pair.traverse(o => { if (o instanceof THREE.Mesh) { handMeshes++; assert.equal(o.castShadow, false); assert.equal(o.receiveShadow, false); } });
assert.equal(handMeshes, 8, 'All articulated hands/forearms use eight meshes per pair');
const instanceBuffers = instances.map(mesh => mesh.instanceMatrix.array);
for (let cycle = 0; cycle < 4; cycle++) for (const id of WEAPON_MODEL_IDS) {
  step(vm, id); assert.equal(rig(vm), pair); assert.equal(pair.parent, weapon(vm, id));
  assert.equal(weapon(vm, id).userData.holdingForward, 'negative-z');
  assert.ok(right.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS[id].right.position)) < 1e-9);
  assert.ok(pose(vm).every(Number.isFinite));
}
let pairs = 0; vm.root.traverse(o => { if (o.name === 'FirstPersonHands') pairs++; }); assert.equal(pairs, 1);
instances.forEach((mesh, index) => assert.equal(mesh.instanceMatrix.array, instanceBuffers[index]));
console.log('PASS: repeated twelve-weapon switching reuses one hand pair, instance buffers and absolute holding transforms');

vm.resetEffects(); step(vm, 'ar', 0);
const geometrySentinel = new THREE.BufferGeometry(), materialSentinel = new THREE.MeshStandardMaterial(), objectSentinel = new THREE.Object3D();
for (let i = 0; i < 180; i++) step(vm, i % 2 ? 'ar' : 'pistol', 1 / 60, {}, i % 3 === 0, i % 3 === 1);
const afterGeometry = new THREE.BufferGeometry(), afterMaterial = new THREE.MeshStandardMaterial(), afterObject = new THREE.Object3D();
assert.equal(afterGeometry.id, geometrySentinel.id + 1, 'No geometry allocated in cached animation/switching');
assert.equal(Reflect.get(afterMaterial, 'id'), Reflect.get(materialSentinel, 'id') + 1, 'No material allocated in animation');
assert.equal(afterObject.id, objectSentinel.id + 1, 'No meshes/groups allocated in cached animation');
geometrySentinel.dispose(); afterGeometry.dispose(); materialSentinel.dispose(); afterMaterial.dispose();
console.log('PASS: zero per-frame geometry, material or scene-object construction after preparation');

vm.resetEffects(); step(vm, 'ar', 0);
const frozen = pose(vm), palette = instances.map(mesh => Array.from(mesh.instanceMatrix.array));
step(vm, 'ar', 1, {}, true, true, true, false);
assert.deepEqual(pose(vm), frozen, 'Pause freezes full pose');
instances.forEach((mesh, index) => assert.deepEqual(Array.from(mesh.instanceMatrix.array), palette[index]));
step(vm, 'ar', 1 / 60, {}, true); assert.notDeepEqual(pose(vm), frozen, 'Resume advances the existing pose');
for (let i = 0; i < 120; i++) step(vm, 'ar', 1 / 60, {}, true);
assert.ok(Math.abs(weapon(vm, 'ar').position.x) < .001 && Math.abs(weapon(vm, 'ar').position.y - VIEWMODEL_GRIPS.ar.aim[1]) < .003);
assert.ok(pair.visible, 'Unscoped AR ADS retains attached hands below sight line');
for (const id of ['sniper', 'br']) {
  step(vm, id, 1 / 60, {}, true); assert.equal(pair.visible, false, `${id}: existing scope overlay remains unobstructed`);
}
step(vm, 'sniper', 1 / 60); assert.equal(pair.visible, true);
step(vm, 'ar', 1 / 60, {}, false, false, false); assert.equal(vm.root.visible, false);
vm.resetEffects(); step(vm, 'ar', 0); assert.equal(vm.root.visible, true);

function aimingAtRate(rate: number) {
  const model = createViewmodelManager(); step(model, 'ar', 0);
  for (let i = 0; i < rate; i++) step(model, 'ar', 1 / rate, {}, true);
  const p = weapon(model, 'ar').position.clone(), q = weapon(model, 'ar').quaternion.clone(); model.dispose(); return { p, q };
}
const slow = aimingAtRate(30), fast = aimingAtRate(144);
assert.ok(slow.p.distanceTo(fast.p) < 1e-6 && Math.abs(slow.q.dot(fast.q)) > .999999);
console.log('PASS: smooth frame-rate-independent ADS, scope visibility, pause/resume and death/redeployment reset');

for (const id of WEAPON_MODEL_IDS) {
  vm.resetEffects(); step(vm, id, 0);
  const def = WEAPONS.find(w => w.id === id)!, state: WeaponSlotState = { ammo: 0, reserve: 100, heat: 80 };
  assert.ok(beginWeaponReload(def, state));
  const startLeft = left.position.clone(), anchoredRight = right.position.clone(); let reached = false;
  while (state.reloading) {
    advanceWeaponReload(def, state, 1 / 60);
    if (id === 'minigun') vm.setMinigunSpin(.02, true);
    const serialized = JSON.stringify(state); step(vm, id, 1 / 60, state);
    assert.equal(JSON.stringify(state), serialized, 'Presentation never changes reload/ammo/audio state');
    assert.ok(right.position.distanceTo(anchoredRight) < 1e-8, `${id}: firing hand stays attached during reload`);
    for (const side of ['right', 'left'] as const) {
      const sleeve = pair.getObjectByName(`${side}Forearm`)!;
      sleeveEnd.set(0, -.5, 0).applyMatrix4(sleeve.matrixWorld);
      assert.ok(sleeve.scale.y <= VIEWMODEL_GRIPS[id].sleeveLength + .012001, `${id}: anatomical forearm never stretches to a remote elbow`);
      assert.ok(sleeveEnd.project(acceptanceCamera).y < -1, `${id}: capped sleeve end never swings into the viewport during reload`);
    }
    reached ||= left.position.distanceTo(startLeft) > .025;
  }
  assert.ok(reached, `${id}: support hand independently reaches the loading control`);
  vm.setMinigunSpin(0, false);
  for (let i = 0; i < 60; i++) step(vm, id);
  assert.ok(left.position.distanceTo(startLeft) < .001, `${id}: support hand recovers after reload`);
}
console.log('PASS: independent support-hand reaches and recovery across all reload families without changing their state machines');
vm.resetEffects(); step(vm, 'shotgun', 0);
const pumpGrip = left.position.clone(); vm.triggerShotgunPump(); step(vm, 'shotgun', .1);
assert.ok(left.position.z > pumpGrip.z + .02, 'Support hand follows the animated pump after a shot');
for (let i = 0; i < 60; i++) step(vm, 'shotgun');
assert.ok(left.position.distanceTo(pumpGrip) < .001, 'Pump hand recovers without accumulated offset');

const resources = new Set<THREE.EventDispatcher<any>>();
vm.root.traverse((object: any) => {
  if (object.isInstancedMesh) resources.add(object);
  if (object.geometry) resources.add(object.geometry);
  for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
    resources.add(material); for (const texture of material.userData.ownedTextures ?? []) resources.add(texture);
  }
});
const releases = new Map([...resources].map(resource => [resource, 0]));
resources.forEach(resource => resource.addEventListener('dispose', () => releases.set(resource, releases.get(resource)! + 1)));
disposeBotVisuals(vm.root); vm.dispose();
resources.forEach(resource => assert.equal(releases.get(resource), 1, 'Legacy teardown releases every owned resource/instance once'));
assert.equal(vm.root.children.length, 0);
vm.prepare(['ar']); vm.triggerMuzzleFlash(); step(vm, 'ar'); assert.equal(vm.root.children.length, 0, 'A disposed manager never allocates another model');
console.log('PASS: legacy and explicit teardown release shared geometry/material/texture and instanced buffers exactly once');

// Check visible weapon geometry as well as palms: a rear housing can clip even
// when every hand vertex is safe. Scope mode deliberately hides the full receiver.
const boundsVm = createViewmodelManager(); boundsVm.prepare(WEAPON_MODEL_IDS);
const vertex = new THREE.Vector3(), instanceMatrix = new THREE.Matrix4(), transform = new THREE.Matrix4();
function assertNear(id: string) {
  boundsVm.root.updateMatrixWorld(true);
  boundsVm.root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.attributes.position;
    for (let n = 0; n < (object instanceof THREE.InstancedMesh ? object.count : 1); n++) {
      if (object instanceof THREE.InstancedMesh) { object.getMatrixAt(n, instanceMatrix); transform.multiplyMatrices(object.matrixWorld, instanceMatrix); }
      else transform.copy(object.matrixWorld);
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(transform);
        assert.ok(vertex.z < -.05, `${id}/${object.name}: visible weapon/hand must stay beyond near plane (${vertex.z})`);
      }
    }
  });
}
for (const id of WEAPON_MODEL_IDS) {
  for (const [aim, sprint] of [[false, false], [true, false], [false, true]]) {
    boundsVm.resetEffects(); step(boundsVm, id, 0, {}, aim, sprint); assertNear(id);
    if (aim && id === 'shotgun') {
      const model = weapon(boundsVm, id);
      for (const sight of [[0, .087, .105], [0, .0685, -.5]]) {
        const point = new THREE.Vector3(...sight).applyMatrix4(model.matrixWorld).project(acceptanceCamera);
        assert.ok(Math.abs(point.x) < 1e-6 && Math.abs(point.y) < .001, 'Shotgun front post and rear ring share the centre sight line');
      }
    }
    if (aim && ['ar', 'smg', 'railgun', 'rocket'].includes(id)) {
      const visible: THREE.Mesh[] = [];
      boundsVm.root.traverseVisible(o => { if (o instanceof THREE.Mesh) visible.push(o); });
      const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
      assert.equal(ray.intersectObjects(visible, false).length, 0, `${id}: open first-person optic clears the actual centre sight ray`);
    }
  }
  const def = WEAPONS.find(w => w.id === id)!, state: WeaponSlotState = { ammo: 0, reserve: 100, heat: 80 };
  boundsVm.resetEffects(); step(boundsVm, id, 0); beginWeaponReload(def, state);
  while (state.reloading) { advanceWeaponReload(def, state, .1); step(boundsVm, id, .1, state); assertNear(id); }
}
boundsVm.dispose();
console.log('PASS: full visible weapon/instanced-hand vertex bounds across all twelve hip/ADS/sprint and full reload sequences');
