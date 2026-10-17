import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createViewmodelManager,WEAPONS} from '../src/weapons';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import {beginWeaponReload,advanceWeaponReload,cancelWeaponReload} from '../src/weaponReload';
import {LMG,lmgCoverAngle,lmgCharge,lmgReloadStatus,type LmgEvent} from '../src/lmgMechanics';
import {VIEWMODEL_GRIPS} from '../src/viewmodelGrips';
import type {WeaponSlotState} from '../src/types';
const gun=WEAPONS.find(w=>w.id==='lmg')!;
assert.deepEqual([gun.damage,gun.spread,gun.adsSpread,gun.fireRate,gun.mag,gun.reserve,gun.reloadTime,gun.kick,gun.auto],[24,.026,.012,.115,100,300,4.2,.026,true]);
const near=(a:number,b:number,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const palm=new THREE.Vector3(),anchor=new THREE.Vector3(),matrix=new THREE.Matrix4();
function localPoint(root:THREE.Object3D,part:THREE.Object3D,point:readonly number[],out=anchor){root.updateMatrixWorld(true);matrix.copy(root.matrixWorld).invert().multiply(part.matrixWorld);return out.fromArray(point).applyMatrix4(matrix);}
for(const hz of [30,60,144])for(const speed of [1,.75,.9])for(const ammo of [0,1,63,99]) {
 const vm=createViewmodelManager(),s:WeaponSlotState={ammo,reserve:300};
 const tick=(dt:number,run=false,aim=false,playing=true,alive=true)=>vm.update(dt,gun,s,aim,run,true,run,false,false,0,alive,playing);
 tick(0);const root=vm.root.getObjectByName('Weapon_lmg')!,left=root.getObjectByName('leftHand')!,right=root.getObjectByName('rightHand')!,cover=root.getObjectByName('feedTray')!,old=root.getObjectByName('magazine')!,fresh=root.getObjectByName('freshMagazine')!,belt=root.getObjectByName('feedBelt')!,bolt=root.getObjectByName('bolt')!;
 const hinge=cover.position.clone(),old0=old.position.clone(),right0=right.position.clone(),bolt0=bolt.position.clone();
 assert.ok(beginWeaponReload(gun,s,speed));assert.equal(beginWeaponReload(gun,s),false,'Repeated reload input does not duplicate a clock');near(s.totalReloadT!,(ammo?3.75:4.75)*speed);
 const phases=s.reloadSequence!.phases.map(p=>p.phase);assert.deepEqual(phases,['lift','open','eject','pickup','insert','feed','slap',...(ammo?[]:['chamber']),'close']);
 const events:LmgEvent[]=[];let contacts=0,sawRaised=false,sawOpen=false,charged=false,previous:THREE.Vector3|undefined;
 while(s.reloading) {
  advanceWeaponReload(gun,s,1/hz,undefined,undefined,undefined,undefined,event=>events.push(event));const before=JSON.stringify(s);tick(1/hz);assert.equal(JSON.stringify(s),before,'Rendering never changes readiness or ammo');
  near(right.position.distanceTo(right0),0);near(cover.position.distanceTo(hinge),0);assert.equal(s.ammo!+s.reserve!,ammo+300);
  const q=s.reloadSequence;if(!q)break;const phase=q.phases[q.index].phase,p=q.elapsed/q.phases[q.index].duration;
  near(cover.rotation.x,lmgCoverAngle(phase,p));assert.ok(cover.rotation.x<=1e-8&&cover.rotation.x>=LMG.coverAngle-1e-8);
  if(['lift','open','eject','pickup','insert'].includes(phase))assert.equal(s.ammo,ammo,'No ammunition transfer until seating completes');
  if(phase==='open'||phase==='slap'&&p>=LMG.contact) {
   localPoint(root,left,LMG.palmPoint,palm);localPoint(root,cover,LMG.coverPoint);near(palm.distanceTo(anchor),0);
   if(phase==='slap'){contacts++;if(p>=LMG.lock)near(cover.rotation.x,0);}
  }
  if(phase==='slap'&&p<LMG.contact){localPoint(root,left,LMG.palmPoint,palm);localPoint(root,cover,LMG.coverPoint);sawRaised ||= palm.y-anchor.y>.030;}
  if(phase==='eject')sawOpen=true;
  if(phase==='eject'&&p>=.32||phase==='pickup'||phase==='insert') {
   const part=phase==='pickup'&&p>=.45||phase==='insert'?fresh:old;localPoint(root,part,LMG.boxGrip);near(left.position.distanceTo(anchor),0);
  }
  if(phase==='eject'&&p>=.35||phase==='pickup'||phase==='insert'||phase==='feed'&&p<.55)assert.equal(belt.visible,false,'No disconnected belt remains after removing a box');
  if(phase==='slap'||phase==='chamber'||phase==='close')assert.equal(belt.visible,true);
  if(phase==='slap'){assert.equal(s.ammo,100);assert.equal(fresh.visible,true);assert.equal(old.visible,false);}
  if(phase==='chamber') {
   charged=true;assert.equal(ammo,0);assert.equal(cover.rotation.x,0,'Charge only after locked cover');assert.ok(s.needsChamber);near(bolt.position.z-bolt0.z,lmgCharge(p));
   if(p>=.23&&p<=.70){localPoint(root,bolt,LMG.controlGrip);near(left.position.distanceTo(anchor),0);}
  } else near(bolt.position.distanceTo(bolt0),0);
  assert.ok(bolt.position.z<=bolt0.z+LMG.chargeTravel+1e-8&&bolt.position.z<.08,'Charging control stays ahead of stock');
  if(previous)assert.ok(left.position.distanceTo(previous)<5/(hz*speed),'Continuous bounded hand speed, including old/fresh exchange');previous=left.position.clone();
 }
 assert.ok(contacts>0&&sawRaised&&sawOpen,JSON.stringify({hz,speed,ammo,contacts,sawRaised,sawOpen}));assert.equal(charged,ammo===0);assert.deepEqual(events,['extract','seat','cover',...(ammo?[]:['charge'])]);
 tick(0);assert.equal(lmgReloadStatus(s),'');near(cover.rotation.x,0);near(old.position.distanceTo(old0),0);assert.ok(old.visible&&!fresh.visible&&belt.visible);near(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.lmg.left.position)),0);
 for(let n=0;n<3;n++){s.ammo=n%2?20:0;assert.ok(beginWeaponReload(gun,s));advanceWeaponReload(gun,s,20);tick(0);near(old.position.distanceTo(old0),0);near(cover.rotation.x,0);}
 for(let n=0;n<hz;n++)tick(1/hz,true);near(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.lmg.left.position)),0);near(right.position.distanceTo(right0),0);
 for(let n=0;n<hz;n++)tick(1/hz,false,true);assert.ok(root.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.lmg.aim))<.004);
 s.ammo=0;beginWeaponReload(gun,s);advanceWeaponReload(gun,s,3.1);tick(0);const frozen=left.position.clone(),angle=cover.rotation.x;tick(.1,false,false,false);near(left.position.distanceTo(frozen),0);near(cover.rotation.x,angle);
 cancelWeaponReload(s);vm.update(.016,WEAPONS[0],{},false,false,true,false,false,false,0,true,true);tick(0);near(cover.rotation.x,0);near(old.position.distanceTo(old0),0);
 tick(.016,false,false,true,false);vm.resetEffects();tick(0);near(cover.rotation.x,0);vm.dispose();
}
for(const t of [.1,.65,1.2,1.6,2.1,2.5,3.17,3.6,4.4])for(const reserve of [1,300]) {
 const s:WeaponSlotState={ammo:0,reserve};assert.ok(beginWeaponReload(gun,s));advanceWeaponReload(gun,s,t);const ammo=[s.ammo,s.reserve];cancelWeaponReload(s);advanceWeaponReload(gun,s,100);assert.deepEqual([s.ammo,s.reserve],ammo);
 if(s.ammo&&s.needsChamber){assert.equal(lmgReloadStatus(s),'[R] CHARGE WEAPON');assert.ok(beginWeaponReload(gun,s));assert.deepEqual(s.reloadSequence!.phases.map(p=>p.phase),['chamber','close']);advanceWeaponReload(gun,s,100);assert.equal(s.needsChamber,false);assert.deepEqual([s.ammo,s.reserve],ammo);}
}
// Slow frames traverse contact events once; invalid frames cannot advance.
for(const delta of [0,NaN,Infinity,-1]){const s={ammo:0,reserve:300};beginWeaponReload(gun,s);const before=JSON.stringify(s);advanceWeaponReload(gun,s,delta);assert.equal(JSON.stringify(s),before);}
const slow:WeaponSlotState={ammo:0,reserve:300},events:LmgEvent[]=[];beginWeaponReload(gun,slow);advanceWeaponReload(gun,slow,100,undefined,undefined,undefined,undefined,e=>events.push(e));assert.deepEqual(events,['extract','seat','cover','charge']);assert.equal(slow.ammo,100);
function sample(hz:number,t:number) {
 const vm=createViewmodelManager(),s={ammo:0,reserve:300};vm.update(0,gun,s,false,false,true,false,false,false,0,true,true);beginWeaponReload(gun,s);
 for(let time=0;time<t-1e-10;){const dt=Math.min(1/hz,t-time);time+=dt;advanceWeaponReload(gun,s,dt);vm.update(dt,gun,s,false,false,true,false,false,false,0,true,true);}
 const root=vm.root.getObjectByName('Weapon_lmg')!,left=root.getObjectByName('leftHand')!;const value={hand:left.position.clone(),rotation:left.quaternion.clone(),cover:root.getObjectByName('feedTray')!.rotation.x};vm.dispose();return value;
}
for(const t of [.18,.6,1.1,1.6,2,2.6,2.95,3.08,3.1656,3.28,3.8,4.5]){const a=sample(30,t),b=sample(144,t);near(a.hand.distanceTo(b.hand),0);assert.ok(a.rotation.angleTo(b.rotation)<1e-7);near(a.cover,b.cover);}
const vm=createViewmodelManager();vm.prepare(['lmg']);const g=new THREE.BufferGeometry(),m=new THREE.MeshStandardMaterial(),o=new THREE.Object3D(),s:WeaponSlotState={ammo:0,reserve:300};beginWeaponReload(gun,s);
while(s.reloading){advanceWeaponReload(gun,s,1/60);vm.update(1/60,gun,s,false,false,true,false,false,false,0,true,true);}const g2=new THREE.BufferGeometry(),m2=new THREE.MeshStandardMaterial(),o2=new THREE.Object3D();assert.equal(g2.id,g.id+1);assert.equal(Reflect.get(m2,'id'),Reflect.get(m,'id')+1);assert.equal(o2.id,o.id+1);g.dispose();g2.dispose();m.dispose();m2.dispose();vm.dispose();
const bare=createWeaponAssembly('lmg');assert.equal(bare.parts.freshMagazine,undefined);disposeWeaponObject(bare.root);
console.log('PASS: LMG phases/hinge, palm-driven slap, box/feed contacts, empty-only charge, ammo gates/conservation, interruptions, resets, resource reuse and 30/60/144 Hz');
