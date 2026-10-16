import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HelmetHUD, type HelmetHUDProps} from '../src/HelmetHUD';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WEAPONS, createViewmodelManager } from '../src/weapons';
import { beginWeaponReload, advanceWeaponReload, interruptShellReload, cancelWeaponReload } from '../src/weaponReload';
import { SHOTGUN, beginShotgunCycle, cancelShotgunCycle, shotgunPumpStroke } from '../src/shotgunMechanics';
import type { WeaponSlotState } from '../src/types';

const gun = WEAPONS.find(w => w.id === 'shotgun')!;
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≠ ${b}`);
for (const hz of [30, 60, 144]) {
  const ws: WeaponSlotState = { ammo: 5, reserve: 36 }, events: string[] = [];
  beginShotgunCycle(ws);
  assert.equal(shotgunPumpStroke(0), 0);
  assert.equal(beginWeaponReload(gun, ws), false, 'Cannot reload a locked action');
  let t = 0;
  while (ws.shotgunCycle) {
    t += 1 / hz;
    advanceWeaponReload(gun, ws, 1 / hz, undefined, (event, duration, empty, late) => {
      events.push(event); near(t - late, SHOTGUN.recovery); near(duration, .44);
    });
    if (t < .32) assert.equal(shotgunPumpStroke(ws.shotgunCycle!.elapsed), 0);
    if (t < SHOTGUN.cycle - 1e-8) assert.ok(ws.boltCycleT! > 0);
  }
  assert.deepEqual(events, ['pump']); assert.equal(ws.needsChamber, false); assert.equal(ws.boltCycleT, 0);
  assert.ok(t <= SHOTGUN.cycle + 1 / hz + 1e-8 && t <= Math.ceil(gun.fireRate! * hz) / hz + 1e-8);
  assert.equal(ws.ammo, 5); assert.equal(ws.reserve, 36);
  near(shotgunPumpStroke(.53), .075); near(shotgunPumpStroke(.76), 0);
}
console.log('PASS: delayed single pump event, real endpoints and locked action at 30/60/144 Hz inside unchanged fire interval');

for (const hz of [30, 60, 144]) for (const speed of [1, .75, .9]) for (const ammo of [0, 2, 5]) for (const reserve of [1, 20]) {
  const ws: WeaponSlotState = { ammo, reserve }, events: string[] = [];
  assert.ok(beginWeaponReload(gun, ws, speed));
  const total = ws.totalReloadT!, missing = Math.min(6 - ammo, reserve);
  near(total, (.30 + missing * .85 + (ammo ? .26 : .84 + .18)) * speed);
  assert.equal(beginWeaponReload(gun, ws, speed), false, 'Repeated R cannot restart a shell');
  let t = 0, transfers = 0;
  while (ws.reloading) {
    t += 1 / hz;
    transfers += advanceWeaponReload(gun, ws, 1 / hz, undefined, (event, duration, empty, late) => {
      if (event === 'seat') {
        const count = events.filter(e => e === 'seat').length;
        near(t - late, (.30 + count * .85 + .85 * .72) * speed);
        assert.equal(ws.ammo, ammo + count + 1, 'Cue is emitted with the actual committed transfer');
      }
      events.push(event);
    });
    assert.equal(ws.ammo! + ws.reserve!, ammo + reserve);
  }
  assert.equal(transfers, missing); assert.equal(events.filter(e => e === 'seat').length, missing);
  assert.equal(events.filter(e => e === 'pump').length, ammo ? 0 : 1);
  assert.equal(ws.needsChamber, false); assert.equal(ws.ammo, ammo + missing); near(t - total < 1 / hz + 1e-7 ? 0 : 1, 0);
}
const huge: WeaponSlotState = {ammo: 0, reserve: 3}; beginWeaponReload(gun, huge);
let largeSeats = 0, largePumps = 0;
assert.equal(advanceWeaponReload(gun, huge, 100, undefined, e => e === 'seat' ? largeSeats++ : largePumps++), 3);
assert.equal(largeSeats, 3); assert.equal(largePumps, 1); assert.equal(huge.reloading, false);
for (const invalid of [0, -1, NaN, Infinity]) { const snapshot = JSON.stringify(huge); advanceWeaponReload(gun, huge, invalid); assert.equal(JSON.stringify(huge), snapshot); }
console.log('PASS: exact seating boundary, class speed, reserve exhaustion, repeated R, long/invalid frames and conserved ammo');

// Before first shell, just before/after seating, later shell, last shell and
// both sides of final pump initiation. Continue chambering instead of restarting.
for (const ammo of [0, 2]) for (const time of [.1, .30 + .85 * .71, .30 + .85 * .73, 1.5, 2.5, .30 + (6 - ammo) * .85 + .10, .30 + (6 - ammo) * .85 + .30, .30 + (5 - ammo) * .85 + .85 * .70, .30 + (5 - ammo) * .85 + .85 * .73, .30 + (6 - ammo) * .85 + .72, .30 + (6 - ammo) * .85 + .80]) {
  const ws: WeaponSlotState = {ammo, reserve: 20}, events: string[] = [];
  beginWeaponReload(gun, ws);
  advanceWeaponReload(gun, ws, time, undefined, e => events.push(e));
  const before = ws.ammo!, total = ws.ammo! + ws.reserve!, cyclePhase = ws.reloadSequence?.phases[ws.reloadSequence.index];
  const progress = ws.reloadSequence?.elapsed, pumped = events.filter(e => e === 'pump').length;
  const interrupted = interruptShellReload(gun, ws);
  if (!before) { assert.equal(interrupted, false); continue; }
  if (!ws.reloading && !interrupted) continue; // Already completed tactical reload.
  assert.equal(interrupted, true); assert.equal(ws.reloading, false);
  if (cyclePhase?.phase === 'chamber') near(ws.shotgunCycle!.elapsed, progress!);
  for (let i = 0; i < 200; i++) advanceWeaponReload(gun, ws, .01, undefined, e => events.push(e));
  assert.equal(ws.ammo, before); assert.equal(ws.ammo! + ws.reserve!, total);
  assert.equal(events.filter(e => e === 'pump').length, ammo ? 0 : 1, `No duplicate pump after interruption at ${time} (${pumped} already)`);
  assert.equal(ws.boltCycleT, 0); assert.equal(ws.needsChamber, false);
  // The App consumes pendingReloadShot exactly once after lockout and only if
  // fireHeld; switching must discard it and preserve an unchambered mechanism.
  ws.pendingReloadShot = false;
}
const switched: WeaponSlotState = {ammo: 1, reserve: 20}; beginShotgunCycle(switched); switched.pendingReloadShot = true;
cancelWeaponReload(switched); cancelShotgunCycle(switched);
assert.equal(switched.pendingReloadShot, false); assert.equal(switched.shotgunCycle, undefined); assert.equal(switched.needsChamber, true);
assert.ok(beginWeaponReload(gun, switched)); assert.equal(switched.reloadSequence!.phases[0].phase, 'chamber');
console.log('PASS: before/after-seat, later/last shell and final-chamber interruptions preserve transfers and emit one pump; switch clears queued shot');

const vm = createViewmodelManager(); vm.prepare(['shotgun']);
const ws: WeaponSlotState = {ammo: 2, reserve: 20}; beginWeaponReload(gun, ws);
const shell = vm.root.getObjectByName('reloadRound')!, left = vm.root.getObjectByName('leftHand')!;
const modelDuring = vm.root.getObjectByName('Weapon_shotgun')!, bodyDuring = modelDuring.getObjectByName('receiver')!;
const clearance = new THREE.Raycaster(), shellAxis = new THREE.Vector3(), thumbTip = new THREE.Vector3(), shellBase = new THREE.Vector3();
const sentinelGeometry = new THREE.BufferGeometry(), sentinelMaterial = new THREE.MeshStandardMaterial(), sentinelObject = new THREE.Object3D();
while (ws.reloading) {
  advanceWeaponReload(gun, ws, 1 / 144);
  vm.update(1 / 144, gun, ws, false, false, true, false, false, false, 0, true, true);
  const seq = ws.reloadSequence, stage = seq?.phases[seq.index];
  if (stage?.phase === 'insert' && shell.visible) {
    assert.ok(left.position.distanceTo(shell.position) < .12, 'Shell remains within the loading hand/thumb reach');
    if (seq!.elapsed / stage.duration < .52) {
      near(left.position.x, shell.position.x + .002); near(left.position.y, shell.position.y - .055); near(left.position.z, shell.position.z + .00964);
      if (seq!.elapsed / stage.duration >= .16) {
        thumbTip.set(0,.018,0);modelDuring.worldToLocal(modelDuring.getObjectByName('left_thumb_2')!.localToWorld(thumbTip));
        shellBase.set(0,0,.029);modelDuring.worldToLocal(shell.localToWorld(shellBase));
        assert.ok(thumbTip.distanceTo(shellBase)<.025,'Opposed thumb stays in contact range of the brass rim while gripping/carrying');
      }
    } else assert.ok(left.position.y <= -.10, 'Pressing fingers/palm remain outside the narrow receiver port');
    if (seq!.elapsed / stage.duration >= .52) {
      assert.ok(Math.abs(shell.position.x) < .009 && shell.position.y < -.019, 'Shell approaches through open underside');
      near(shell.rotation.x, 0);
      if (seq!.elapsed / stage.duration >= .70) {
        thumbTip.set(0,.018,0); modelDuring.worldToLocal(modelDuring.getObjectByName('left_thumb_2')!.localToWorld(thumbTip));
        shellBase.copy(shell.position);shellBase.z+=.029;
        assert.ok(thumbTip.distanceTo(shellBase)<.020,'Actual articulated thumb pad contacts the shell base at the final press');
      }
      for (const dx of [-.008, 0, .008]) {
        clearance.ray.origin.set(shell.position.x + dx, shell.position.y, shell.position.z + .029).applyMatrix4(modelDuring.matrixWorld);
        shellAxis.set(0,0,-1).transformDirection(modelDuring.matrixWorld); clearance.ray.direction.copy(shellAxis); clearance.near = 0; clearance.far = .0565;
        const solid = clearance.intersectObject(bodyDuring, true).filter(h=>h.object instanceof THREE.Mesh && h.object.parent === bodyDuring);
        assert.equal(solid.length, 0, 'Shell volume must clear the real trigger guard and receiver throughout the press');
      }
    }
  }
}
const nextGeometry = new THREE.BufferGeometry(), nextMaterial = new THREE.MeshStandardMaterial(), nextObject = new THREE.Object3D();
assert.equal(nextGeometry.id, sentinelGeometry.id + 1); assert.equal(Reflect.get(nextMaterial,'id'), Reflect.get(sentinelMaterial,'id') + 1); assert.equal(nextObject.id, sentinelObject.id + 1);
sentinelGeometry.dispose();nextGeometry.dispose();sentinelMaterial.dispose();nextMaterial.dispose();
// Real receiver geometry, rather than just a marker named "loadingPort".
const model = vm.root.getObjectByName('Weapon_shotgun')!, receiver = model.getObjectByName('receiver')!;
model.position.set(0, 0, 0); model.quaternion.identity(); vm.root.updateMatrixWorld(true);
const ray = new THREE.Raycaster(new THREE.Vector3(0, -.06, -.025), new THREE.Vector3(0, 1, 0), 0, .052);
const hits = ray.intersectObject(receiver, true).filter(h => h.object instanceof THREE.Mesh && h.object.parent === receiver);
assert.equal(hits.length, 0, 'No solid bottom wall in the shell path');
vm.dispose();
console.log('PASS: shell and guiding hand share exact contact path, bore orientation and an actual open loading aperture');

const hudState:WeaponSlotState={ammo:0,reserve:14};beginWeaponReload(gun,hudState);advanceWeaponReload(gun,hudState,3.4705);
const props:HelmetHUDProps={currentWeapon:gun,weaponSlotState:hudState,health:100,maxHealth:100,shield:100,maxShield:100,slotIndex:0,playerLoadout:[gun],playerLoadoutStates:[hudState],matchMode:'team',factionAlignment:'usmc',blueScore:0,redScore:0,targetScore:20,currentWave:1,zombiesRemaining:0,kills:0,timeStr:'00:00',zoneStatus:'SAFE',playerPos:{x:0,z:0},playerYaw:0,radarPingsRef:{current:[]}};
const hud=()=>renderToStaticMarkup(React.createElement(HelmetHUD,props));
assert.equal(hudState.ammo,4);assert.equal(hudState.reserve,10);assert.equal(hudState.needsChamber,true);assert.ok(hud().includes('EMPTY CHAMBER RELOAD...'),'Stored shells do not imply a chambered action');
advanceWeaponReload(gun,hudState,2.78);assert.equal(hudState.needsChamber,false);assert.equal(hudState.reloading,true);assert.ok(hud().includes('FINISHING RELOAD...'));assert.ok(!hud().includes('EMPTY CHAMBER RELOAD...'),'Closed action never advertises an empty chamber');
advanceWeaponReload(gun,hudState,1);assert.ok(!hud().includes('FINISHING RELOAD...'));
console.log('PASS: actual HUD markup distinguishes 4/10 unchambered shells, closed-action finish and ready');

const repeated=createViewmodelManager();const rest:WeaponSlotState={ammo:2,reserve:100};
for(let cycle=0;cycle<5;cycle++){
 rest.ammo=2;beginWeaponReload(gun,rest);
 while(rest.reloading){advanceWeaponReload(gun,rest,1/60);repeated.update(1/60,gun,rest,false,false,true,false,false,false,0,true,true);}
 for(let n=0;n<30;n++)repeated.update(1/60,gun,rest,false,false,true,false,false,false,0,true,true);
 const h=repeated.root.getObjectByName('leftHand')!,m=repeated.root.getObjectByName('Weapon_shotgun')!,thumb=repeated.root.getObjectByName('left_thumb_0')!;
 near(h.position.x,-.036);near(h.position.y,-.090);near(h.position.z,-.225);near(m.position.x,.15);assert.ok(Math.abs(m.position.y+.225)<.003);near(thumb.rotation.y,0);
}
repeated.dispose();console.log('PASS: repeated shell reloads restore original pump grip, thumb and framing without accumulated transforms');
