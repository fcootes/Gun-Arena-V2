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
const rightDrive=[],leftDrive=[];
const q0=new THREE.Quaternion(),p0=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3();
const grip=new THREE.Vector3(...VIEWMODEL_GRIPS.pistol.right.position);
const sample=(phase:number)=>{evaluate(phase,PISTOL_SPRINT.pairsPerSecond,pose);return pose;};
let maxStep=0,maxAcceleration=0;
for(let n=0;n<=2048;n++){
 const phase=n/2048;evaluate(phase-1/2048,PISTOL_SPRINT.pairsPerSecond,previous);sample(phase);
 rightDrive.push(pose.right.shoulderPitch);leftDrive.push(pose.left.shoulderPitch);
 for(const side of ['right','left'] as const){
  const a=pose[side],b=previous[side];
  near(a.shoulder.distanceTo(a.elbow),PISTOL_SPRINT.upperArm);
  near(a.elbow.distanceTo(a.wrist),PISTOL_SPRINT.forearm);
  assert.ok(a.elbowFlexion>1.50&&a.elbowFlexion<2.10,'Bent elbows with bounded anatomical flexion');
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
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length,mr=mean(rightDrive),ml=mean(leftDrive);
const covariance=rightDrive.reduce((a,r,i)=>a+(r-mr)*(leftDrive[i]-ml),0),variance=Math.sqrt(rightDrive.reduce((a,r)=>a+(r-mr)**2,0)*leftDrive.reduce((a,l)=>a+(l-ml)**2,0));
assert.ok(covariance/variance<-.90,'Arms oppose rather than pump together');
sample(.115);const rightUp=pose.right.wrist.clone(),leftBack=pose.left.wrist.clone(),elbowA=pose.left.elbow.clone();
sample(.515);assert.ok(pose.left.wrist.y-leftBack.y>.25&&pose.right.wrist.y-rightUp.y<-.025,'Forward/back landmarks alternate');
assert.ok(pose.right.wrist.z-rightUp.z>.12&&rightUp.y-pose.right.wrist.y>.30,'Right pump has substantial depth and height travel');
const leftForearm=pose.left.wrist.clone().sub(pose.left.elbow);
assert.ok(leftForearm.angleTo(new THREE.Vector3(0,1,0))<THREE.MathUtils.degToRad(15),'Left forearm approaches upright at forward apex');
assert.ok(leftForearm.y>.27&&Math.abs(leftForearm.z)<.065&&pose.left.wrist.z>-.48,'Left fist rises above elbow without reaching forward');
assert.ok(elbowA.distanceTo(pose.left.elbow)>.20,'Elbow itself drives the arm arc');
const chord=pose.left.wrist.clone().sub(leftBack),middle=sample(.255).left.wrist.clone().sub(leftBack);
assert.ok(middle.clone().cross(chord).length()/chord.length()>.025,'Curved path, not straight wrist translation');
const camera=new THREE.PerspectiveCamera(74,16/9,.05,100);
assert.ok(leftBack.clone().project(camera).y < -1,'Back/down fist naturally leaves camera frame');
assert.ok(sample(.515).left.wrist.clone().project(camera).y > -.8,'Forward fist re-enters lower-left view');
console.log('PASS: C2 loop and key smoothness, arm opposition, curved FK paths, anatomical lengths, articulated elbows, cropping and constrained weapon');

// Include the complete gun, sleeves and instanced fingers: wrist bounds alone
// cannot detect rear sight/housing or cuff clipping during the enlarged arc.
const vertex=new THREE.Vector3(),instanceMatrix=new THREE.Matrix4(),transform=new THREE.Matrix4();
function assertNearPlane(vm:ReturnType<typeof createViewmodelManager>){
 vm.root.updateMatrixWorld(true);
 vm.root.traverseVisible(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const positions=object.geometry.attributes.position;
  for(let n=0;n<(object instanceof THREE.InstancedMesh?object.count:1);n++){
   if(object instanceof THREE.InstancedMesh){object.getMatrixAt(n,instanceMatrix);transform.multiplyMatrices(object.matrixWorld,instanceMatrix);}
   else transform.copy(object.matrixWorld);
   for(let i=0;i<positions.count;i++){
    vertex.fromBufferAttribute(positions,i).applyMatrix4(transform);
    // A body-side sleeve end may pass behind the eye while entirely below the
    // frustum. Require it to clear even the *near-plane* bottom by 5 cm; gun,
    // wrists and fingers must stay wholly forward of the near plane.
    const offscreenSleeve=object.name.endsWith('Forearm')&&vertex.y<-.05*Math.tan(THREE.MathUtils.degToRad(74/2))-.05;
    assert.ok(vertex.z<-.05||offscreenSleeve,`${object.name}: no visible near-plane clipping (${vertex.toArray()})`);
   }
  }
 });
}

function managerAt(rate:number,speed=8.6){
 const vm=createViewmodelManager(),ws:WeaponSlotState={ammo:15,reserve:60};
 const tick=(dt:number,run:boolean,aim=false,ground=true,playing=true)=>vm.update(dt,gun,ws,aim,run,ground,run,false,false,0,true,playing,speed);
 const cycleSamples:{phase:number;right:THREE.Vector3;left:THREE.Vector3}[]=[];
 tick(0,false);for(let n=0;n<rate*6;n++){
  tick(1/rate,true);
  if(n<rate*2)assertNearPlane(vm);
  if((n+1)%(rate/2)===0){const p=vm.getPistolSprintPose();cycleSamples.push({phase:p.phase,right:p.right.wrist.clone(),left:p.left.wrist.clone()});}
 }
 const model=vm.root.getObjectByName('Weapon_pistol')!,hand=model.getObjectByName('leftHand')!,right=model.getObjectByName('rightHand')!,forearm=model.getObjectByName('leftForearm')!;
 model.updateMatrixWorld(true);
 const result={position:model.position.clone(),rotation:model.quaternion.clone(),left:hand.getWorldPosition(new THREE.Vector3()),phase:vm.getPistolSprintPose().phase,cycleSamples};
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
for(const p of [b,c]){
 near(a.phase,p.phase);assert.ok(a.position.distanceTo(p.position)<.0001&&a.left.distanceTo(p.left)<.0001&&a.rotation.angleTo(p.rotation)<.0001,'Equivalent-time poses agree at 30/60/144 Hz');
 for(let n=0;n<a.cycleSamples.length;n++){
  const x=a.cycleSamples[n],y=p.cycleSamples[n];near(x.phase,y.phase);
  assert.ok(x.right.distanceTo(y.right)<1e-8&&x.left.distanceTo(y.left)<1e-8,'Both arms agree throughout six seconds at 30/60/144 Hz');
 }
}
assert.ok(PISTOL_SPRINT.pairsPerSecond>=1.7&&PISTOL_SPRINT.pairsPerSecond<=1.8,'Moderate sprint cadence at reference speed');
near(a.phase,.5); // 6 seconds × 1.75 full alternating pairs/s = 10.5 pairs.
const slow=createPistolSprintController(),fast=createPistolSprintController();slow.update(1,true,6.5);fast.update(1,true,10.5);assert.ok(fast.pose.cadence>slow.pose.cadence);near(fast.pose.cadence/slow.pose.cadence,Math.sqrt(10.5/6.5));
console.log(`PASS: 30/60/144 Hz, speed-scaled cadence, pause, stop/ADS/air/reload/switch/death/reset; peak left wrist acceleration ${maxAcceleration.toFixed(1)} m/s²`);
