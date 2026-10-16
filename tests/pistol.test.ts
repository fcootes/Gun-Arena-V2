import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createViewmodelManager, WEAPONS } from '../src/weapons';
import { createWeaponAssembly, disposeWeaponObject } from '../src/weaponModels';
import { advanceWeaponReload, beginWeaponReload, cancelWeaponReload } from '../src/weaponReload';
import { PISTOL, pistolSprintWrist } from '../src/pistolMechanics';
import { VIEWMODEL_GRIPS } from '../src/viewmodelGrips';
import type { WeaponSlotState } from '../src/types';
const gun = WEAPONS.find(w=>w.id==='pistol')!;
assert.deepEqual([gun.mag,gun.reserve,gun.auto,gun.fireRate,gun.damage,gun.spread,gun.kick],[15,60,false,.22,28,.022,.024]);
const near=(a:number,b:number,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
for (const hz of [30,60,144]) for(const ammo of [0,1,8,14]) for(const speed of [1,.75,.9]) {
  const vm=createViewmodelManager(), state:WeaponSlotState={ammo,reserve:60};
  const step=(dt:number)=>vm.update(dt,gun,state,false,false,true,false,false,false,0,true,true);
  step(0); const root=vm.root.getObjectByName('Weapon_pistol')!,right=root.getObjectByName('rightHand')!,left=root.getObjectByName('leftHand')!,old=root.getObjectByName('magazine')!,fresh=root.getObjectByName('freshMagazine')!,slide=root.getObjectByName('slide')!;
  const anchor=right.position.clone(), seated=old.position.clone(), slideOrigin=slide.position.z-(ammo===0?PISTOL.slideTravel:0);
  assert.ok(beginWeaponReload(gun,state,speed));near(state.totalReloadT!, (ammo?1.1856:2.09)*speed);
  let sawLocked=false,sawFresh=false,sawChamber=false;
  while(state.reloading){
    advanceWeaponReload(gun,state,1/hz); const before=JSON.stringify(state);step(1/hz);assert.equal(JSON.stringify(state),before);
    assert.ok(right.position.distanceTo(anchor)<1e-9,'Right hand never leaves firing grip');
    assert.equal(state.ammo!+state.reserve!,ammo+60);
    const q=state.reloadSequence;if(!q)break;const stage=q.phases[q.index],p=q.elapsed/stage.duration;
    if(stage.phase==='eject'&&p>.25){const expected=new THREE.Vector3(...PISTOL.magazineGrip).applyMatrix4(old.matrix);assert.ok(left.position.distanceTo(expected)<1e-7,'Exact contact with extracted mag');}
    if(stage.phase==='insert'&&p>.7){sawFresh=true;assert.ok(fresh.visible&&!old.visible);const expected=new THREE.Vector3(...PISTOL.magazineGrip).applyMatrix4(fresh.matrix);assert.ok(left.position.distanceTo(expected)<1e-7,'Fingers follow incoming magazine');}
    if(ammo===0&&['eject','insert'].includes(stage.phase)){near(slide.position.z-slideOrigin,PISTOL.slideTravel);sawLocked=true;}
    if(stage.phase==='chamber'){sawChamber=true;assert.ok(state.ammo!>0,'Mag seats before release');if(p>.45)near(slide.position.z,slideOrigin);}
    if(ammo>0)near(slide.position.z,slideOrigin);
  }
  assert.equal(sawChamber,ammo===0);assert.equal(sawLocked,ammo===0);assert.ok(sawFresh);
  for(let n=0;n<hz;n++)step(1/hz);
  assert.equal(state.ammo,15);assert.equal(state.needsChamber,false);assert.ok(old.visible&&!fresh.visible);assert.ok(old.position.distanceTo(seated)<1e-7);near(slide.position.z,slideOrigin);
  assert.ok(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.pistol.left.position))<1e-7);vm.dispose();
}
for(const t of [.10,.4,1.37,1.45,1.9]){
 const s:WeaponSlotState={ammo:0,reserve:60};beginWeaponReload(gun,s);advanceWeaponReload(gun,s,t);const before=[s.ammo,s.reserve];cancelWeaponReload(s);advanceWeaponReload(gun,s,100);assert.deepEqual([s.ammo,s.reserve],before);
 if(s.ammo&&s.needsChamber){beginWeaponReload(gun,s);assert.equal(s.reloadSequence!.phases.some(p=>p.phase==='insert'),false);advanceWeaponReload(gun,s,100);assert.equal(s.needsChamber,false);assert.deepEqual([s.ammo,s.reserve],before);}
}
console.log('PASS: pistol stats, tactical/empty clocks and contacts at 30/60/144 Hz, class speed, slide lock/release order, interruption and ammo conservation');

function sprint(rate:number){
 const vm=createViewmodelManager(),s={ammo:15,reserve:60};
 const tick=(dt:number,run=false,aim=false,playing=true,alive=true)=>vm.update(dt,gun,s,aim,run,true,run,false,false,0,alive,playing);
 tick(0);const root=vm.root.getObjectByName('Weapon_pistol')!,left=root.getObjectByName('leftHand')!,right=root.getObjectByName('rightHand')!,anchor=right.position.clone();
 const world=()=>{root.updateMatrixWorld(true);return left.getWorldPosition(new THREE.Vector3());};
 const points:THREE.Vector3[]=[];
 for(let n=0;n<rate;n++){tick(1/rate,true);assert.ok(right.position.distanceTo(anchor)<1e-9);if(n>rate/2)points.push(world());}
 const at=world(),expected=new THREE.Vector3(),q=new THREE.Quaternion();pistolSprintWrist(14,expected,q,new THREE.Euler());assert.ok(at.distanceTo(expected)<1e-5,'Left wrist uses independent camera-space target');
 assert.ok(points.some(p=>p.distanceTo(at)>.035),'Running arm visibly swings');
 const frozen=world(),rotation=root.quaternion.clone();tick(1,true,false,false);assert.ok(world().distanceTo(frozen)<1e-10);assert.ok(root.quaternion.angleTo(rotation)<1e-7);
 for(let n=0;n<rate;n++)tick(1/rate,false,true);assert.ok(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.pistol.left.position))<1e-6);
 assert.ok(root.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.pistol.aim))<.004);
 tick(.016,true);vm.update(.016,WEAPONS[0],{},false,false,true,false,false,false,0,true,true);tick(0);assert.ok(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.pistol.left.position))<1e-7);
 tick(.016,true);tick(.016,true,false,true,false);vm.resetEffects();tick(0);assert.ok(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.pistol.left.position))<1e-7);vm.dispose();return at;
}
assert.ok(sprint(30).distanceTo(sprint(144))<1e-6);
const bare=createWeaponAssembly('pistol');assert.equal(bare.parts.freshMagazine,undefined);disposeWeaponObject(bare.root);
console.log('PASS: independent free arm, anchored right grip, continuous swing, variable-rate agreement, pause, ADS/stop, switch and death/reset');
