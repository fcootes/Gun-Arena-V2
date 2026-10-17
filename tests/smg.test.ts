import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createViewmodelManager, WEAPONS } from '../src/weapons';
import { createWeaponAssembly, disposeWeaponObject } from '../src/weaponModels';
import { beginWeaponReload, advanceWeaponReload, cancelWeaponReload } from '../src/weaponReload';
import { VIEWMODEL_GRIPS } from '../src/viewmodelGrips';
import { SMG, smgStroke, smgSwap } from '../src/smgMechanics';
import type { WeaponSlotState } from '../src/types';
const gun=WEAPONS.find(w=>w.id==='smg')!,near=(a:number,b:number,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
assert.deepEqual([gun.damage,gun.spread,gun.adsSpread,gun.fireRate,gun.mag,gun.reserve,gun.auto,gun.kick],[15,.036,.016,.072,32,192,true,.042]);
const contact=new THREE.Vector3(),m=new THREE.Matrix4();
function attachment(root:THREE.Object3D,part:THREE.Object3D,offset:readonly number[]) {
 root.updateMatrixWorld(true);m.copy(root.matrixWorld).invert().multiply(part.matrixWorld);return contact.fromArray(offset).applyMatrix4(m);
}
for(const hz of [30,60,144])for(const speed of [1,.75,.9])for(const ammo of [0,1,17,31]) {
 const vm=createViewmodelManager(),s:WeaponSlotState={ammo,reserve:192};
 const tick=(dt:number,aim=false,run=false,playing=true,alive=true)=>vm.update(dt,gun,s,aim,run,true,run,false,false,0,alive,playing);
 tick(0);const root=vm.root.getObjectByName('Weapon_smg')!,left=root.getObjectByName('leftHand')!,right=root.getObjectByName('rightHand')!,old=root.getObjectByName('magazine')!,fresh=root.getObjectByName('freshMagazine')!,bolt=root.getObjectByName('bolt')!;
 const rightOrigin=right.position.clone(),magOrigin=old.position.clone(),boltOrigin=bolt.position.clone();
 assert.ok(beginWeaponReload(gun,s,speed));near(s.totalReloadT!,(ammo?1.6:2.24)*speed);
 let charged=false,swapped=false,peak=0;const frames=[];
 while(s.reloading) {
  advanceWeaponReload(gun,s,1/hz);const before=JSON.stringify(s);tick(1/hz);assert.equal(JSON.stringify(s),before,'Presentation cannot change authoritative state');
  near(right.position.distanceTo(rightOrigin),0);assert.equal(s.ammo!+s.reserve!,ammo+192);
  const q=s.reloadSequence;if(!q)break;const stage=q.phases[q.index],p=q.elapsed/stage.duration;
  const pull=bolt.position.z-boltOrigin.z;peak=Math.max(peak,pull);
  assert.ok(pull>=-1e-8&&pull<=SMG.travel+1e-8&&bolt.position.z<-.060,'Charging paddle stays in forward receiver guide');
  if(['open','eject','insert'].includes(stage.phase))assert.equal(s.ammo,ammo,'No ammunition transfer before insertion ends');
  if(stage.phase==='eject')near(left.position.distanceTo(attachment(root,old,SMG.magazineGrip)),0);
  if(stage.phase==='insert') {
   const part=p<smgSwap?old:fresh;near(left.position.distanceTo(attachment(root,part,SMG.magazineGrip)),0);
   assert.equal(fresh.visible,p>=smgSwap);swapped ||= fresh.visible;
  }
  if(stage.phase==='chamber') {
   assert.equal(ammo,0);assert.ok(s.needsChamber);assert.equal(s.ammo,32);charged=true;
   near(pull,smgStroke(p));
   if(p>=.30)near(left.position.distanceTo(attachment(root,bolt,SMG.chargingGrip)),0);
  } else near(pull,0);
  frames.push(left.position.clone());
 }
 assert.equal(charged,ammo===0);assert.ok(swapped);assert.ok(ammo?peak<1e-8:peak>.033);
 assert.ok(frames.slice(1).every((p,i)=>p.distanceTo(frames[i])<4/(hz*speed)),'No teleport across magazine swap or phase boundaries');
 tick(0);near(old.position.distanceTo(magOrigin),0);near(bolt.position.distanceTo(boltOrigin),0);near(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.smg.left.position)),0);
 // Repeated reloads return to identical local origins and reuse GPU resources.
 const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);materials.add(o.material);}});
 for(let i=0;i<3;i++){s.ammo=i%2?12:0;assert.ok(beginWeaponReload(gun,s));advanceWeaponReload(gun,s,10);tick(0);near(old.position.distanceTo(magOrigin),0);near(bolt.position.distanceTo(boltOrigin),0);}
 root.traverse(o=>{if(o instanceof THREE.Mesh){assert.ok(geometries.has(o.geometry));assert.ok(materials.has(o.material));}});
 // Firing uses a small mechanical cycle; the support hand remains at its grip.
 vm.triggerSmgBoltFire();tick(.035);near(bolt.position.z-boltOrigin.z,SMG.fireTravel);near(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.smg.left.position)),0);tick(.1);near(bolt.position.distanceTo(boltOrigin),0);
 for(let i=0;i<hz;i++)tick(1/hz,false,true);near(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.smg.left.position)),0);near(right.position.distanceTo(rightOrigin),0);
 for(let i=0;i<hz;i++)tick(1/hz,true);assert.ok(root.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.smg.aim))<.004);
 s.ammo=0;beginWeaponReload(gun,s);advanceWeaponReload(gun,s,1.7);tick(0);const frozen=left.position.clone(),part=bolt.position.clone();tick(.1,false,false,false);near(left.position.distanceTo(frozen),0);near(bolt.position.distanceTo(part),0);
 cancelWeaponReload(s);vm.update(.016,WEAPONS[0],{},false,false,true,false,false,false,0,true,true);tick(0);near(bolt.position.distanceTo(boltOrigin),0);
 tick(.016,false,false,true,false);cancelWeaponReload(s);vm.resetEffects();tick(0);near(left.position.distanceTo(new THREE.Vector3(...VIEWMODEL_GRIPS.smg.left.position)),0);vm.dispose();
}
for(const t of [.1,.5,1.2,1.46,1.7,2.0]) {
 const s:WeaponSlotState={ammo:0,reserve:192};beginWeaponReload(gun,s);advanceWeaponReload(gun,s,t);const ammo=[s.ammo,s.reserve];cancelWeaponReload(s);advanceWeaponReload(gun,s,100);assert.deepEqual([s.ammo,s.reserve],ammo);
 if(s.ammo&&s.needsChamber){assert.ok(beginWeaponReload(gun,s));assert.deepEqual(s.reloadSequence!.phases.map(p=>p.phase),['chamber','close']);advanceWeaponReload(gun,s,100);assert.equal(s.needsChamber,false);assert.deepEqual([s.ammo,s.reserve],ammo);}
}
// Equivalent authoritative timestamps yield identical local contact at any FPS.
function at(hz:number,t:number) {
 const vm=createViewmodelManager(),s={ammo:0,reserve:192};vm.update(0,gun,s,false,false,true,false,false,false,0,true,true);beginWeaponReload(gun,s);
 for(let elapsed=0;elapsed<t-1e-10;){const dt=Math.min(1/hz,t-elapsed);elapsed+=dt;advanceWeaponReload(gun,s,dt);vm.update(dt,gun,s,false,false,true,false,false,false,0,true,true);}
 const root=vm.root.getObjectByName('Weapon_smg')!,v=root.getObjectByName('leftHand')!.position.clone();vm.dispose();return v;
}
for(const t of [.1,.4,.7,1,1.5,1.7,2.1,2.24])assert.ok(at(30,t).distanceTo(at(144,t))<1e-7);
const bare=createWeaponAssembly('smg');assert.equal(bare.parts.freshMagazine,undefined);disposeWeaponObject(bare.root);
console.log('PASS: SMG stats, native-audio clocks, contacts/travel, ammo gate, interrupts/reset, repeated reload, small firing stroke, two-hand sprint/ADS, 30/60/144 Hz and resource reuse');
