import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import {beginRailgunReload,advanceRailgunReload,canChargeRailgun,markRailgunFired,RAILGUN} from '../src/railgunMechanics';
import {cancelWeaponReload} from '../src/weaponReload';
import type {WeaponSlotState} from '../src/types';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const model=createWeaponAssembly('railgun'),a=model.parts;
const scopeRest=a.opticBridge.matrix.clone(),hinge=a.cartridgeCradle.position.clone(),chassis=a.loadingChamber.position.clone();
function pose(time:number){const s:WeaponSlotState={ammo:0,reserve:1};markRailgunFired(s);beginRailgunReload(s);advanceRailgunReload(s,time);model.update(0,0,0,s);model.root.updateMatrixWorld(true);return s;}
pose(0);a.opticBridge.updateMatrix();scopeRest.copy(a.opticBridge.matrix);
const scopeClosed=a.opticBridge.getWorldPosition(new THREE.Vector3());
pose(.75);near(a.breechSlide.position.z,-.270);near(a.breechSlide.position.y,0);
near(a.opticBridge.getWorldPosition(new THREE.Vector3()).z-scopeClosed.z,-.270);
assert.deepEqual(a.opticBridge.matrix.elements,scopeRest.elements);
assert.equal(a.breechLatch.parent,a.breechSlide);
assert.equal(a.cartridgeCradle.parent,a.loadingChamber.parent);
near(a.cartridgeCradle.position.distanceTo(hinge),0);near(a.loadingChamber.position.distanceTo(chassis),0);
const lid=new THREE.Box3().setFromObject(a.breechCover);
assert.ok(lid.max.z<hinge.z-.03,'Open shroud is fully forward of the anchored cradle');
pose(1.07);near(a.cartridgeCradle.rotation.x,RAILGUN.cradleAngle);
const rear=new THREE.Vector3(0,0,.18).applyMatrix4(a.cartridgeCradle.matrixWorld);
assert.ok(rear.y>hinge.y+.09,'Rear rises around the fixed front hinge');
for(const t of [.40,.749,.75]){pose(t);near(a.cartridgeCradle.rotation.x,0);}
const before=pose(1.005);assert.ok(before.railgunBreech!.carrier);assert.equal(a.spentCarrier.visible,true);
const origin=a.spentCarrier.position.clone();const after=pose(1.05);assert.equal(after.railgunBreech!.carrier,false);assert.equal(a.spentCarrier.visible,true);assert.ok(a.spentCarrier.position.distanceTo(origin)>.04);
pose(1.07-1e-6);const departure=a.spentCarrier.position.clone();pose(1.07+1e-6);assert.ok(a.spentCarrier.position.distanceTo(departure)<.00002,'Free carrier trajectory stays continuous across phase boundary');
pose(1.91-1e-6);const fresh=a.freshSlug.getWorldPosition(new THREE.Vector3()),freshQ=a.freshSlug.getWorldQuaternion(new THREE.Quaternion());
const seated=pose(1.91+1e-6);assert.deepEqual([seated.ammo,seated.reserve],[1,0]);assert.equal(a.chamberedSlug.parent,a.cartridgeCradle);
near(a.chamberedSlug.getWorldPosition(new THREE.Vector3()).distanceTo(fresh),0);assert.ok(a.chamberedSlug.getWorldQuaternion(new THREE.Quaternion()).angleTo(freshQ)<1e-7);
const localSlug=a.chamberedSlug.position.clone();
for(const time of [1.92,2.0,2.13]){pose(time);assert.deepEqual(a.chamberedSlug.position.toArray(),localSlug.toArray());near(a.breechSlide.position.z,-.270);assert.ok(a.cartridgeCradle.rotation.x<0);}
let prior=-.27;
for(const time of [2.14,2.25,2.35,2.48]){pose(time);near(a.cartridgeCradle.rotation.x,0);assert.ok(a.breechSlide.position.z>=prior);prior=a.breechSlide.position.z;}
pose(2.8);near(a.breechSlide.position.z,0);near(a.opticBridge.getWorldPosition(new THREE.Vector3()).distanceTo(scopeClosed),0);
for(const cut of [.3,.55,.749,.85,1.005,1.02,1.4,1.72,1.91,2.03,2.3,2.5]){
 const s:WeaponSlotState={ammo:0,reserve:1};markRailgunFired(s);beginRailgunReload(s);advanceRailgunReload(s,cut);const physical={...s.railgunBreech};cancelWeaponReload(s);assert.equal(canChargeRailgun(s),false);
 assert.ok(beginRailgunReload(s));assert.deepEqual(s.railgunBreech,physical,'Recovery preserves actual hinge/slide state');
 for(let n=0;n<600&&s.reloading;n++){advanceRailgunReload(s,1/144);assert.equal(s.ammo!+s.reserve!,1);const b=s.railgunBreech!;if(b.cradle>1e-8)near(b.cover,1);}
 assert.ok(canChargeRailgun(s));assert.deepEqual([s.ammo,s.reserve],[1,0]);
}
// Every resource owned by a new factory is disposed exactly once.
for(let n=0;n<3;n++){
 const m=createWeaponAssembly('railgun'),geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 m.root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.add(mat);}});
 let gd=0,md=0;geometries.forEach(g=>g.addEventListener('dispose',()=>gd++));materials.forEach(m=>m.addEventListener('dispose',()=>md++));
 disposeWeaponObject(m.root);assert.equal(gd,geometries.size);assert.equal(md,materials.size);
}
disposeWeaponObject(model.root);
console.log('PASS: forward rigid scope/upper, fixed 32-degree hinge, ejection and seating continuity, closure clearance/order, interrupted cradle recovery, exact ADS return and owned resource disposal');
