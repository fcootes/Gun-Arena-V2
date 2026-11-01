import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMinigunCarry,MINIGUN_CARRY} from '../src/minigunCarry';
import {createViewmodelManager,WEAPONS} from '../src/weapons';
import {VIEWMODEL_GRIPS} from '../src/viewmodelGrips';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import {beginWeaponReload,advanceWeaponReload} from '../src/weaponReload';
import type {WeaponSlotState} from '../src/types';
import {createMinigunHandAnimator,minigunVentProgress} from '../src/minigunHands';
const near=(a:number,b:number,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`),def=WEAPONS.find(w=>w.id==='minigun')!;
assert.deepEqual([def.damage,def.fireRate,def.mag,def.reserve,def.reloadTime],[16,.045,999,999,2]);
assert.equal(VIEWMODEL_GRIPS.minigun.left.followPart,'supportCradle');
const bare=createWeaponAssembly('minigun'),fp=createWeaponAssembly('minigun',{firstPerson:true});assert.equal(bare.parts.supportCradle,undefined);assert.ok(fp.parts.supportCradle&&fp.parts.mainControlGrip);assert.ok(bare.root.getObjectByName('FirstPersonHands')===undefined);
const spin=fp.parts.rotor.rotation.z;for(let i=0;i<120;i++)fp.update(1/120,0,28/120);near(fp.parts.rotor.rotation.z-spin,28);near(fp.parts.supportCradle.rotation.z,0);
for(const a of [bare,fp])disposeWeaponObject(a.root);
function atRate(hz:number){const c=createMinigunCarry();for(let n=0;n<hz/2;n++)c.update(1/hz,4,4,false,false);const accelerating=[...c.position.toArray(),...c.rotation.toArray()];for(let n=0;n<hz/2;n++)c.update(1/hz,-4,-4,false,false);const reversed=[...c.position.toArray(),...c.rotation.toArray()];for(let n=0;n<hz;n++)c.update(1/hz,0,0,false,false);assert.ok(c.position.length()<1e-7&&c.rotation.length()<1e-7);return{accelerating,reversed};}
const slow=atRate(30);for(const hz of [60,144]){const x=atRate(hz);for(const key of ['accelerating','reversed'] as const)x[key].forEach((v,i)=>near(v,slow[key][i],1e-10));}
const normal=createMinigunCarry(),ads=createMinigunCarry();for(let n=0;n<120;n++){normal.update(1/120,4,4,false,false);ads.update(1/120,4,4,true,false);}near(ads.position.length()/normal.position.length(),MINIGUN_CARRY.adsScale);assert.ok(normal.position.length()<.016);normal.reset();near(normal.position.length(),0);

const vm=createViewmodelManager(),point=new THREE.Vector3(),inverse=new THREE.Matrix4(),matrix=new THREE.Matrix4(),instance=new THREE.Matrix4(),contact=new THREE.Vector3(),actual=new THREE.Vector3();
let state:WeaponSlotState={ammo:999,reserve:999,heat:0};
const update=(dt:number,aim=false,sprint=false,moving=false,lateral=0,forward=0,playing=true)=>vm.update(dt,def,state,aim,sprint,true,moving,false,false,0,true,playing,Math.hypot(lateral,forward),lateral,forward);
update(0);const root=vm.root.getObjectByName('Weapon_minigun')!,left=root.getObjectByName('leftHand')!,right=root.getObjectByName('rightHand')!,cradle=root.getObjectByName('supportCradle')!,rotor=root.getObjectByName('rotor')!;
const chute=new THREE.CatmullRomCurve3([new THREE.Vector3(-.065,0,.07),new THREE.Vector3(-.16,-.04,.11),new THREE.Vector3(-.18,-.16,.26)]),belt=Array.from({length:81},(_,i)=>chute.getPoint(i/80));
let minMotor=Infinity,minBarrel=Infinity,minBelt=Infinity,minCradle=Infinity;
function checkGrip(aim:boolean){
 root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();
 if(!state.reloading){contact.fromArray(VIEWMODEL_GRIPS.minigun.left.partOffset!).applyMatrix4(cradle.matrixWorld);left.getWorldPosition(actual);near(actual.distanceTo(contact),0);}
 near(right.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.minigun.right.position)),0);
 // Measure the actual rendered palm surface and phalanges against the fixed
 // cylinder, rather than assuming a hand-local point remains the contact patch.
 let palmContact=Infinity,fingerContact=Infinity;
 for(const side of ['left','right']){
  const check=(mesh:THREE.Mesh,transform:THREE.Matrix4)=>{for(let n=0;n<mesh.geometry.attributes.position.count;n++){
   point.fromBufferAttribute(mesh.geometry.attributes.position,n).applyMatrix4(transform);
   if(side==='left'&&mesh.name!=='leftForearm'&&Math.abs(point.z-cradle.position.z)<.07){
    const gap=Math.hypot(point.x-cradle.position.x,point.y-cradle.position.y)-.027;
    minCradle=Math.min(minCradle,gap);assert.ok(gap>=-.00001,'Actual palm/fingers never penetrate the cradle, including release and regrip');
    if(mesh.name==='leftGlovePalm')palmContact=Math.min(palmContact,gap);else fingerContact=Math.min(fingerContact,gap);
   }
   if(point.z>-.035&&point.z<.2295){const clearance=Math.hypot(point.x,point.y)-.08;minMotor=Math.min(minMotor,clearance);assert.ok(clearance>=0,`${side} glove clears motor (${point.toArray()})`);}
   if(point.z>-.615&&point.z<-.035){const x=point.x*Math.cos(rotor.rotation.z)+point.y*Math.sin(rotor.rotation.z),y=-point.x*Math.sin(rotor.rotation.z)+point.y*Math.cos(rotor.rotation.z);for(let i=0;i<6;i++){const a=i*Math.PI/3,clearance=Math.hypot(x-Math.cos(a)*.057,y-Math.sin(a)*.057)-.014;minBarrel=Math.min(minBarrel,clearance);assert.ok(clearance>=0,`${side} glove clears rotating barrels`);}}
   if(point.z>0){let clearance=Infinity;for(const b of belt)clearance=Math.min(clearance,point.distanceTo(b)-.025);minBelt=Math.min(minBelt,clearance);assert.ok(clearance>=0,`${side} glove clears ammunition chute`);}
  }};
  const palm=root.getObjectByName(side+'GlovePalm') as THREE.Mesh,fingers=root.getObjectByName('GlovePhalanges') as THREE.InstancedMesh;check(palm,matrix.multiplyMatrices(inverse,palm.matrixWorld));for(let i=side==='left'?15:0;i<(side==='left'?30:15);i++){fingers.getMatrixAt(i,instance);check(fingers,matrix.multiplyMatrices(inverse,fingers.matrixWorld).multiply(instance));}
  const sleeve=root.getObjectByName(side+'Forearm') as THREE.Mesh;assert.ok(sleeve.scale.y<=VIEWMODEL_GRIPS.minigun.sleeveLength+.012001);check(sleeve,matrix.multiplyMatrices(inverse,sleeve.matrixWorld));
 }
 if(!state.reloading){assert.ok(palmContact<.001,'Load-bearing palm contacts the underside within 1 mm');assert.ok(fingerContact<.001,'A real finger surface curls to the far edge within 1 mm');}
}
for(let n=0;n<240;n++){
 const aim=n>=60&&n<100,sprint=n>=120&&n<180,moving=n>=20&&n<200,lateral=n<100?3:-3,forward=sprint?6:3;
 if(n%6===0){vm.addRecoil(.012,.016);vm.triggerMuzzleFlash('minigun');}vm.setMinigunSpin(28/120,false);const before=JSON.stringify(state);update(1/120,aim,sprint,moving,lateral,forward);assert.equal(JSON.stringify(state),before);checkGrip(aim);
}
const frozen=[...root.position.toArray(),...root.quaternion.toArray(),rotor.rotation.z];update(.5,true,true,true,4,4,false);assert.deepEqual([...root.position.toArray(),...root.quaternion.toArray(),rotor.rotation.z],frozen);
vm.update(.02,WEAPONS[0],{ammo:30},false,false,true,false,false,false,0,true,true);vm.resetEffects();update(0);checkGrip(false);
// All animation paths retain their authority and complete the existing thermal reload.
state={ammo:999,reserve:999,heat:100,overheated:true};assert.ok(beginWeaponReload(def,state,1));const duration=state.totalReloadT;let last=left.position.clone(),lastQ=left.quaternion.clone(),maxHandStep=0,maxHandAngle=0;
while(state.reloading){advanceWeaponReload(def,state,1/240);update(1/240);checkGrip(false);maxHandStep=Math.max(maxHandStep,left.position.distanceTo(last));maxHandAngle=Math.max(maxHandAngle,left.quaternion.angleTo(lastQ));last.copy(left.position);lastQ.copy(left.quaternion);}
assert.equal(state.ammo,999);assert.equal(state.reserve,999);near(state.heat!,0);near(duration!,2.2);
assert.ok(maxHandStep<.002,'Withdrawal/reaction/return has no positional snap at 240 Hz');assert.ok(maxHandAngle<.008,'No orientation snap at a reload phase boundary');
near(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.minigun.left.position)),0);
// Thermal choreography samples the authoritative normalized action, including
// class duration scaling. Manual/forced cooling share its unchanged state owner.
for(const multiplier of [.65,1,1.4]){
 const s:WeaponSlotState={ammo:999,reserve:999,heat:80};assert.ok(beginWeaponReload(def,s,multiplier));
 const animate=createMinigunHandAnimator(),position=new THREE.Vector3(),rotation=new THREE.Quaternion();
 for(const progress of [0,.1,.25,.32,.44,.56,.62,.8,.91,1]){
  const sequence=s.reloadSequence!;let elapsed=progress*s.totalReloadT!;sequence.index=0;
  while(sequence.index<sequence.phases.length-1&&elapsed>sequence.phases[sequence.index].duration){elapsed-=sequence.phases[sequence.index].duration;sequence.index++;}
  sequence.elapsed=elapsed;near(minigunVentProgress(s),progress);position.set(0,0,0);rotation.identity();const before=JSON.stringify(s),curl=animate(s,position,rotation);assert.equal(JSON.stringify(s),before);
  if(progress===0||progress===1){near(position.length(),0);near(rotation.angleTo(new THREE.Quaternion()),0);near(curl,1);}
  if(progress===.44){assert.ok(position.x<-.07&&position.y<-.07&&position.z>.035,'Restrained heat reaction stays below/outboard of the hot motor');}
 }
}
vm.resetEffects();state={ammo:999};update(0);const g0=new THREE.BufferGeometry(),m0=new THREE.MeshBasicMaterial(),o0=new THREE.Object3D();
for(let n=0;n<200;n++){vm.setMinigunSpin(.1,false);update(1/120,n%2===0,false,true,3,-3);}
const g1=new THREE.BufferGeometry(),m1=new THREE.MeshBasicMaterial(),o1=new THREE.Object3D();assert.equal(g1.id,g0.id+1);assert.equal(Reflect.get(m1,'id'),Reflect.get(m0,'id')+1);assert.equal(o1.id,o0.id+1);for(const r of [g0,g1,m0,m1])r.dispose();vm.dispose();
console.log('PASS: actual palm/finger cradle contact and nonpenetration, continuous thermal withdrawal/regrip, full firing/movement/ADS/sprint contact, motor/barrel/chute clearances, exact 30/60/144 Hz carry response, bounded inertia, pause/switch/reset, original rotor/thermal/reload semantics and no per-frame GPU objects', {minMotor,minBarrel,minBelt,minCradle,maxHandStep,maxHandAngle});
