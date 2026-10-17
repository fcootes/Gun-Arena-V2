import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPistolGaitEvaluator, createPistolSprintController, createPistolSprintPose, PISTOL_SPRINT } from '../src/pistolSprint';
import { createViewmodelManager, WEAPONS } from '../src/weapons';
import { VIEWMODEL_GRIPS } from '../src/viewmodelGrips';
import { beginWeaponReload, advanceWeaponReload } from '../src/weaponReload';
import type { WeaponSlotState } from '../src/types';
const evaluate=createPistolGaitEvaluator(),pose=createPistolSprintPose(),previous=createPistolSprintPose();
const gun=WEAPONS.find(w=>w.id==='pistol')!;
const near=(a:number,b:number,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const forward=[],back=[],rightZ=[],leftZ=[];
const q0=new THREE.Quaternion(),p0=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3();
const grip=new THREE.Vector3(...VIEWMODEL_GRIPS.pistol.right.position);
const sample=(phase:number)=>{evaluate(phase,PISTOL_SPRINT.pairsPerSecond,pose);return pose;};
let maxStep=0,maxAcceleration=0;
for(let n=0;n<=2048;n++){
 const phase=n/2048;evaluate(phase-1/2048,PISTOL_SPRINT.pairsPerSecond,previous);sample(phase);
 rightZ.push(pose.right.wrist.z);leftZ.push(pose.left.wrist.z);
 for(const side of ['right','left'] as const){
  const a=pose[side],b=previous[side];
  near(a.shoulder.distanceTo(a.elbow),PISTOL_SPRINT.upperArm);
  near(a.elbow.distanceTo(a.wrist),PISTOL_SPRINT.forearm);
  assert.ok(a.elbowFlexion>1.35&&a.elbowFlexion<1.92,'Bounded anatomical elbow flexion');
  assert.ok(a.wrist.z<-.20&&a.wrist.x*(side==='right'?1:-1)>.15,'Wrists stay on their own side and beyond camera');
  assert.ok(a.rotation.dot(b.rotation)>.9999,'No quaternion flips or orientation discontinuities');
  maxStep=Math.max(maxStep,a.wrist.distanceTo(b.wrist));
 }
 assert.ok(grip.clone().applyQuaternion(pose.weaponRotation).add(pose.weaponPosition).distanceTo(pose.right.wrist)<1e-10,'FK wrist exactly constrains weapon grip');
 assert.ok(pose.weaponPosition.x>.14&&pose.weaponPosition.x<.24,'Compact right-side carry');
 assert.ok(Math.abs(pose.compression)<=.00601&&Math.abs(pose.inertia)<.06,'Bounded mass and inertia layers');
 if(n>0&&n<2048){
  const h=1/2048;p0.copy(pose.left.wrist);sample(phase-h);p1.copy(pose.left.wrist);sample(phase+h);p2.copy(pose.left.wrist);
  const a=p1.add(p2).addScaledVector(p0,-2).length()/(h*h)*PISTOL_SPRINT.pairsPerSecond**2;maxAcceleration=Math.max(maxAcceleration,a);
 }
}
assert.ok(maxStep<.008,'Continuous small spatial increments over the full cycle');
assert.ok(maxAcceleration<220,'No impulsive acceleration spikes');
for(const t of [0,.115,.255,.395,.515,.64,.78,.91]){
 const h=1e-5;sample(t-h);p0.copy(pose.left.wrist);q0.copy(pose.left.rotation);sample(t);p1.copy(pose.left.wrist);sample(t+h);p2.copy(pose.left.wrist);
 assert.ok(p0.distanceTo(p2)<.0002&&q0.angleTo(pose.left.rotation)<.001,'Continuous pose across every key/seam');
 const vl=p1.clone().sub(p0).divideScalar(h),vr=p2.clone().sub(p1).divideScalar(h);
 assert.ok(vl.distanceTo(vr)<.006,'Continuous velocity across every key/seam');
}
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length,mr=mean(rightZ),ml=mean(leftZ);
const covariance=rightZ.reduce((a,r,i)=>a+(r-mr)*(leftZ[i]-ml),0),variance=Math.sqrt(rightZ.reduce((a,r)=>a+(r-mr)**2,0)*leftZ.reduce((a,l)=>a+(l-ml)**2,0));
assert.ok(covariance/variance<-.90,'Arms oppose rather than pump together');
sample(.115);const rightUp=pose.right.wrist.clone(),leftBack=pose.left.wrist.clone(),elbowA=pose.left.elbow.clone();
sample(.515);assert.ok(pose.left.wrist.y-leftBack.y>.25&&pose.right.wrist.y-rightUp.y<-.025,'Forward/back landmarks alternate');
assert.ok(elbowA.distanceTo(pose.left.elbow)>.20,'Elbow itself drives the arm arc');
const chord=pose.left.wrist.clone().sub(leftBack),middle=sample(.255).left.wrist.clone().sub(leftBack);
assert.ok(middle.clone().cross(chord).length()/chord.length()>.025,'Curved path, not straight wrist translation');
const camera=new THREE.PerspectiveCamera(74,16/9,.05,100);
assert.ok(leftBack.clone().project(camera).y < -1,'Back/down fist naturally leaves camera frame');
assert.ok(sample(.515).left.wrist.clone().project(camera).y > -.8,'Forward fist re-enters lower-left view');
console.log('PASS: C2 loop and key smoothness, arm opposition, curved FK paths, anatomical lengths, articulated elbows, cropping and constrained weapon');

function managerAt(rate:number,speed=8.6){
 const vm=createViewmodelManager(),ws:WeaponSlotState={ammo:15,reserve:60};
 const tick=(dt:number,run:boolean,aim=false,ground=true,playing=true)=>vm.update(dt,gun,ws,aim,run,ground,run,false,false,0,true,playing,speed);
 tick(0,false);for(let n=0;n<rate*2;n++)tick(1/rate,true);
 const model=vm.root.getObjectByName('Weapon_pistol')!,hand=model.getObjectByName('leftHand')!,right=model.getObjectByName('rightHand')!,forearm=model.getObjectByName('leftForearm')!;
 model.updateMatrixWorld(true);
 const result={position:model.position.clone(),rotation:model.quaternion.clone(),left:hand.getWorldPosition(new THREE.Vector3()),phase:vm.getPistolSprintPose().phase};
 assert.ok(right.position.distanceTo(grip)<1e-10);assert.ok(result.left.distanceTo(vm.getPistolSprintPose().left.wrist)<1e-7);
 assert.ok(forearm.scale.y<.31&&forearm.scale.y>.20,'Rendered forearm retains its length');
 const frozen=JSON.stringify(vm.getPistolSprintPose());tick(.1,true,false,true,false);assert.equal(JSON.stringify(vm.getPistolSprintPose()),frozen,'Pause freezes phase and both arm bones');
 for(const interruption of ['stop','ads','air','reload','switch','death'] as const){
  for(let n=0;n<rate;n++)tick(1/rate,true);
  if(interruption==='reload'){
   ws.ammo=8;assert.ok(beginWeaponReload(gun,ws));
   while(ws.reloading){advanceWeaponReload(gun,ws,1/rate);tick(1/rate,false);}
   assert.equal(ws.ammo,15);assert.equal(ws.needsChamber,false);
  } else if(interruption==='switch'){
   vm.update(.01,WEAPONS[0],{},false,false,true,false,false,false,0,true,true);tick(0,false);near(vm.getPistolSprintPose().blend,0);
  } else if(interruption==='death'){
   vm.update(.01,gun,ws,false,false,true,false,false,false,0,false,true);vm.resetEffects();tick(0,false);near(vm.getPistolSprintPose().phase,0);
  } else for(let n=0;n<rate;n++)tick(1/rate,false,interruption==='ads',interruption!=='air');
  for(let n=0;n<rate;n++)tick(1/rate,false);
  assert.ok(hand.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.pistol.left.position))<1e-6,'Support grip recovers');
 }
 vm.dispose();return result;
}
const a=managerAt(30),b=managerAt(60),c=managerAt(144);
for(const p of [b,c]){near(a.phase,p.phase);assert.ok(a.position.distanceTo(p.position)<.0001&&a.left.distanceTo(p.left)<.0001&&a.rotation.angleTo(p.rotation)<.0001,'Equivalent-time poses agree at 30/60/144 Hz');}
const slow=createPistolSprintController(),fast=createPistolSprintController();slow.update(1,true,6.5);fast.update(1,true,10.5);assert.ok(fast.pose.cadence>slow.pose.cadence);near(fast.pose.cadence/slow.pose.cadence,Math.sqrt(10.5/6.5));
console.log(`PASS: 30/60/144 Hz, speed-scaled cadence, pause, stop/ADS/air/reload/switch/death/reset; peak left wrist acceleration ${maxAcceleration.toFixed(1)} m/s²`);
