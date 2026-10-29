import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {PLASMA,beginPlasmaAction,advancePlasmaAction,advancePlasmaFire,plasmaReady} from '../src/plasmaMechanics';
import {plasmaFreshPose,plasmaEjectedPose} from '../src/plasmaAnimation';
import {createPlasmaRecoil,PLASMA_RECOIL} from '../src/plasmaRecoil';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import {createWeaponMuzzleEffect} from '../src/weaponEffects';
import {createViewmodelManager,WEAPONS} from '../src/weapons';
import type {WeaponSlotState} from '../src/types';
const near=(a:number,b:number,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
near(PLASMA.reload,2.70);near(PLASMA.vent,2.25);
const p=new THREE.Vector3(),r=new THREE.Euler();plasmaFreshPose('insert',1,p);near((p.x-PLASMA.freshAlign[0])/(PLASMA.cylinder[0]-PLASMA.freshAlign[0]),.75);
const partial=p.clone();for(const t of [0,.25,.5,.72]){plasmaFreshPose('slap',t,p);near(p.distanceTo(partial),0);}plasmaFreshPose('slap',1,p);near(p.distanceTo(new THREE.Vector3(...PLASMA.cylinder)),0);
plasmaEjectedPose(.02,p,r);assert.ok(PLASMA.cylinder[0]-p.x>.11,'Strong initial impulse in 20 ms');near(p.y,PLASMA.cylinder[1]);
for(const speed of [.75,.9,1,1.2])for(const forced of [false,true]){
 const state:WeaponSlotState={ammo:45,reserve:180,heat:forced?100:80,overheated:forced};assert.ok(beginPlasmaAction(state,speed));near(state.totalReloadT!,2.25*speed);assert.equal(state.reloadSequence!.plasmaForcedVent,forced);
 const contacts:{event:string;time:number}[]=[];const slice=1/144;let elapsed=0,previousHeat=state.heat!;
 while(state.reloading){const dt=Math.min(slice,2.25*speed-elapsed+1e-8);elapsed+=dt;advancePlasmaAction(state,dt,(event,scale,late)=>{near(scale,speed);contacts.push({event,time:(elapsed-late)/speed});});assert.ok(state.heat!<=previousHeat+1e-7);previousHeat=state.heat!;
  near(state.plasma!.upperDoor,0);near(state.plasma!.lowerDoor,0);assert.deepEqual([state.ammo,state.reserve],[45,180]);if(state.reloading)assert.equal(plasmaReady(state),false);
 }
 assert.deepEqual(contacts.map(x=>x.event),['thermal_release','thermal_open','cooling_pulse','heat_react','thermal_close','ready']);contacts.forEach((x,i)=>near(x.time,[.44,.72,.72,1.5,2.05,2.25][i]));assert.equal(plasmaReady(state),true);
}
// Same shot-event times integrated at different display rates give identical recoil.
function recoilAtRate(hz:number){const recoil=createPlasmaRecoil();let time=0,nextShot=0,peak=0;
 for(let n=0;n<hz;n++){
  const end=(n+1)/hz;
  while(nextShot<end-1e-9){recoil.advance(Math.max(0,nextShot-time));time=nextShot;recoil.impulse();nextShot+=.125;}
  recoil.advance(end-time);time=end;peak=Math.max(peak,recoil.position.z);
 }
 const values=[...recoil.position.toArray(),...recoil.rotation.toArray()];assert.ok(peak>.018&&peak<.045);recoil.advance(.4);assert.ok(recoil.position.length()<1e-5);return values;
}
const baseline=recoilAtRate(30);for(const hz of [60,144])recoilAtRate(hz).forEach((x,i)=>near(x,baseline[i],1e-9));
const single=createPlasmaRecoil();single.impulse();single.advance(.025);assert.ok(single.position.z>.020&&single.rotation.x>.035);assert.ok(Math.abs(single.position.x)<.004);assert.ok(single.position.z*PLASMA_RECOIL.adsScale<single.position.z);
const def=WEAPONS.find(x=>x.id==='laser')!,vm=createViewmodelManager(),state:WeaponSlotState={ammo:60,reserve:180};
const update=(dt:number,playing=true)=>vm.update(dt,def,state,false,false,true,false,false,false,0,true,playing);
update(0);const model=vm.root.getObjectByName('Weapon_laser')!,before=model.position.clone();vm.triggerMuzzleFlash('laser');update(.025);assert.ok(model.position.z>before.z+.015,'Actual production trigger produces visible rearward impulse');
const frozen=model.position.clone(),rotation=model.quaternion.clone();update(.5,false);assert.deepEqual(model.position.toArray(),frozen.toArray());near(model.quaternion.angleTo(rotation),0);
vm.update(.02,WEAPONS[0],{ammo:30},false,false,true,false,false,false,0,true,true);update(0);
const reference=createViewmodelManager();reference.update(0,def,state,false,false,true,false,false,false,0,true,true);reference.update(.025,def,state,false,false,true,false,false,false,0,true,true);reference.update(.02,WEAPONS[0],{ammo:30},false,false,true,false,false,false,0,true,true);reference.update(0,def,state,false,false,true,false,false,false,0,true,true);near(model.position.distanceTo(reference.root.getObjectByName('Weapon_laser')!.position),0);reference.dispose();vm.resetEffects();update(0);assert.ok(Math.abs(model.position.z-before.z)<.001);
// Heat reaction uses actual glove motion, not a new timer or camera shake.
function ventHand(forced:boolean,time:number){vm.resetEffects();const s:WeaponSlotState={ammo:45,reserve:180,heat:100,overheated:forced};beginPlasmaAction(s,1,'vent');advancePlasmaAction(s,time);vm.update(0,def,s,false,false,true,false,false,false,0,true,true);vm.root.updateMatrixWorld(true);return{position:vm.root.getObjectByName('leftHand')!.position.clone(),rotation:vm.root.getObjectByName('leftHand')!.quaternion.clone()};}
const manual=ventHand(false,1.66),forced=ventHand(true,1.66),start=ventHand(true,1.5);assert.ok(forced.position.distanceTo(start.position)>.035);assert.ok(manual.position.distanceTo(forced.position)>.001||manual.rotation.angleTo(forced.rotation)>.01);
// Sample actual left palm/phalanges against the doors and fresh pressure vessel.
const volumePoint=new THREE.Vector3(),volumeInverse=new THREE.Matrix4(),volumeMatrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
for(const mode of ['swap','vent'] as const){
 vm.resetEffects();const s:WeaponSlotState={ammo:20,reserve:180,heat:mode==='vent'?100:0,overheated:mode==='vent'};vm.update(0,def,s,false,false,true,false,false,false,0,true,true);beginPlasmaAction(s,1,mode);
 while(s.reloading){advancePlasmaAction(s,1/240);vm.update(1/240,def,s,false,false,true,false,false,false,0,true,true);vm.root.updateMatrixWorld(true);
  const phase=s.reloadSequence?.phases[s.reloadSequence.index].phase,palm=vm.root.getObjectByName('leftGlovePalm') as THREE.Mesh,fingers=vm.root.getObjectByName('GlovePhalanges') as THREE.InstancedMesh;
  const check=(mesh:THREE.Mesh,matrix:THREE.Matrix4,doorSign?:number)=>{for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   volumePoint.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix);
   if(doorSign!==undefined)assert.ok(!(Math.abs(volumePoint.x)<.002&&Math.abs(volumePoint.y-doorSign*.03125)<.02975&&Math.abs(volumePoint.z)<.109),'Support glove clears closed/open doors in either action');
   else{const z=Math.abs(volumePoint.z),radius=z<.078?.023:z<.089?.026:.009;assert.ok(!(z<.103&&volumePoint.x*volumePoint.x+volumePoint.y*volumePoint.y<radius*radius),'Glove does not pass through pressure vessel during insertion/slap');}
  }};
  const surfaces:[THREE.Object3D,number|undefined][]=[ [vm.root.getObjectByName('chamberUpperDoor')!,-1],[vm.root.getObjectByName('chamberLowerDoor')!,1] ];
  if(mode==='swap'&&(phase==='insert'||phase==='slap'))surfaces.push([vm.root.getObjectByName('freshGasCylinder')!,undefined]);
  for(const [surface,sign]of surfaces){volumeInverse.copy(surface.matrixWorld).invert();check(palm,volumeMatrix.multiplyMatrices(volumeInverse,palm.matrixWorld),sign);for(let n=15;n<30;n++){fingers.getMatrixAt(n,instance);check(fingers,volumeMatrix.multiplyMatrices(volumeInverse,fingers.matrixWorld).multiply(instance),sign);}}
 }
}
// Geometry stays fixed: all successful shots reuse both muzzle and spring objects.
const assembly=createWeaponAssembly('laser'),fx=createWeaponMuzzleEffect(assembly),g0=new THREE.BufferGeometry(),m0=new THREE.MeshBasicMaterial(),o0=new THREE.Object3D();
for(let n=0;n<200;n++){fx.trigger();fx.update(.02);assembly.update(.02);fx.reset();}
const g1=new THREE.BufferGeometry(),m1=new THREE.MeshBasicMaterial(),o1=new THREE.Object3D();assert.equal(g1.id,g0.id+1);assert.equal(Reflect.get(m1,'id'),Reflect.get(m0,'id')+1);assert.equal(o1.id,o0.id+1);near(assembly.plasmaRecoil!.position.length(),0);
for(const resource of [g0,g1,m0,m1])resource.dispose();disposeWeaponObject(assembly.root);vm.dispose();
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.ok(app.includes('recoilKick+=.009;recoilPitch+=.006;triggerPlayerFlash()'),'Camera feedback stays at the existing baseline');
console.log('PASS: authoritative 2.70/2.25 actions, 75% resistance then final slap, forced/manual hand reaction, exact per-shot spring at 30/60/144 Hz, pause/switch/reset, stable muzzle/spring resources and unchanged camera aiming baseline');
