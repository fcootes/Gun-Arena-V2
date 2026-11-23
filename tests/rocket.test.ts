import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ROCKET_MODULE_SEAT } from '../src/rocketAnimation';
import { VIEWMODEL_GRIPS } from '../src/viewmodelGrips';
import { createViewmodelManager, WEAPONS } from '../src/weapons';
import { advanceWeaponReload, beginWeaponReload, cancelWeaponReload } from '../src/weaponReload';
import { createWeaponAssembly, disposeWeaponObject } from '../src/weaponModels';
import { ARSENAL, type WeaponSlotState } from '../src/types';

const rocket = WEAPONS.find(w => w.id === 'rocket')!;
const { mag, reserve, projectileSpeed, projectileGravity, splashRadius, splashDamage, fireRate, range } = ARSENAL.RPG7_ROCKET;
assert.deepEqual([mag, reserve, projectileSpeed, projectileGravity, splashRadius, splashDamage, fireRate, range],
  [1, 6, 30, 0, 6, 200, 1.6, 220]);
const manager = createViewmodelManager();
const studio = createWeaponAssembly('rocket');
const config = VIEWMODEL_GRIPS.rocket;
const state: WeaponSlotState = { ammo: 0, reserve };
const step = (dt: number, aim = false, sprint = false, playing = true) =>
  manager.update(dt, rocket, state, aim, sprint, true, sprint, false, false, 0, true, playing, sprint ? 6 : 0, 0, sprint ? 6 : 0);
step(0);
const model = manager.root.getObjectByName('Weapon_rocket')!;
const part = (name: string) => model.getObjectByName(name)!;
const hatch = part('rocketHatch'), cassette = part('reloadRound');
const left = part('leftHand'), right = part('rightHand');
const vertex = new THREE.Vector3();
const expected = new THREE.Vector3();
const matrix = new THREE.Matrix4();
function expectGrip(side: 'left' | 'right') {
  const attachment = config[side];
  const contact = part(attachment.followPart!);
  expected.fromArray(attachment.partOffset!).add(contact.position);
  assert.ok(part(side + 'Hand').position.distanceTo(expected) < 1e-8, side + ' hand follows its attached grip');
}
for (const [aim, sprint] of [[false, false], [true, false], [false, true]]) {
  step(.12, aim, sprint);
  expectGrip('left');
  expectGrip('right');
}
assert.ok(beginWeaponReload(rocket, state));
assert.equal(state.reloadSequence?.kind, 'tube');
assert.deepEqual(state.reloadSequence?.phases.map(p => p.phase), ['open', 'insert', 'close']);
assert.ok(Math.abs(state.totalReloadT! - 3.96) < 1e-8);
const originalT = state.reloadT;
const before = left.position.clone();
step(.25, false, false, false);
assert.equal(state.reloadT, originalT);
assert.ok(left.position.equals(before));
const lastHand = left.position.clone();
let foundPickup = false, foundSeat = false, foundClosure = false;
const lastModule = new THREE.Vector3();
const seat = new THREE.Vector3(...ROCKET_MODULE_SEAT);
const transferGrip = new THREE.Vector3(-.067, -.021, .013);
const dt = 1 / 120;
while (state.reloading) {
  advanceWeaponReload(rocket, state, dt);
  step(dt);
  studio.update(dt, 0, 0, state);
  expectGrip('right');
  assert.equal(hatch.rotation.z, studio.parts.rocketHatch.rotation.z, 'Studio and gameplay use the same hinge path');
  assert.equal(cassette.visible, studio.parts.reloadRound.visible);
  assert.ok(cassette.position.equals(studio.parts.reloadRound.position));
  assert.ok(left.position.distanceTo(lastHand) < .032, 'Support hand transitions continuously');
  lastHand.copy(left.position);
  const q = state.reloadSequence;
  const phase = q?.phases[q.index].phase;
  if (phase === 'insert' && cassette.visible) {
    if (foundPickup) assert.ok(cassette.position.distanceTo(lastModule) < .008, 'Cassette advances continuously after pickup');
    assert.ok(left.position.distanceTo(expected.copy(cassette.position).add(transferGrip)) < 1e-8,
      'The same rigid grip moves with the cassette through transfer and seating');
    assert.ok(hatch.rotation.z < -2, 'The access housing clears the insertion path');
    lastModule.copy(cassette.position);
    foundPickup = true;
    foundSeat ||= cassette.position.distanceTo(seat) < 1e-8;
  }
  if (phase === 'close') {
    assert.equal(state.ammo, 1, 'Existing insert boundary seats exactly one round');
    assert.equal(state.reserve, 5);
    assert.ok(cassette.visible && cassette.position.equals(seat));
    foundClosure ||= hatch.rotation.z === 0;
  }
}
assert.ok(foundPickup && foundSeat && foundClosure);
expectGrip('left');
assert.equal(hatch.rotation.z, 0);
assert.equal(cassette.visible, false);
assert.equal(state.ammo, 1);
assert.equal(state.reserve, 5);
assert.equal(beginWeaponReload(rocket, state), false);

state.ammo = 0;
assert.ok(beginWeaponReload(rocket, state, .65));
advanceWeaponReload(rocket, state, state.totalReloadT! * .62);
step(.12);
assert.ok(cassette.visible && hatch.rotation.z < -2);
cancelWeaponReload(state);
step(0);
assert.equal(cassette.visible, false);
assert.equal(hatch.rotation.z, 0);
assert.deepEqual([state.ammo, state.reserve], [0, 5]);

// Camera clearance includes the nearer end of the launcher under the firing impulse.
for (const aim of [false, true]) {
  manager.resetEffects();
  step(0, aim);
  manager.addRecoil(.065, .105);
  for (let n = 0; n < 36; n++) {
    step(dt, aim);
    manager.root.updateMatrixWorld(true);
    model.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object.name === 'Launcher rear impulse') return;
      const coords = object.geometry.attributes.position;
      matrix.copy(object.matrixWorld);
      for (let i = 0; i < coords.count; i++) {
        vertex.fromBufferAttribute(coords, i).applyMatrix4(matrix);
        assert.ok(vertex.z < -.05, 'Launcher, sleeves and palms clear the camera under recoil');
      }
    });
  }
}
assert.ok(studio.backblast.position.z > 0 && studio.muzzle.position.z < -.55);
manager.dispose();
disposeWeaponObject(studio.root);
console.log('PASS: W05 geometry and launcher definition, weapon-local contacts, continuous cassette transfer, authoritative timing, cancellation and recoil clearance');
