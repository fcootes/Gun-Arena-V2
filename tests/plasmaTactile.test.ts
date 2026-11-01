import {CLASSES} from '../src/classes';
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
near(PLASMA.reload,3.20);near(PLASMA.vent,2.25);
const p=new THREE.Vector3(),r=new THREE.Euler();plasmaFreshPose('insert',1,p);near((p.x-PLASMA.freshAlign[0])/(PLASMA.cylinder[0]-PLASMA.freshAlign[0]),.75);
const partial=p.clone();for(const t of [0,.25,.5,.62]){plasmaFreshPose('slap',t,p);near(p.distanceTo(partial),0);}plasmaFreshPose('slap',1,p);near(p.distanceTo(new THREE.Vector3(...PLASMA.cylinder)),0);
plasmaEjectedPose(.02,p,r);assert.ok(PLASMA.cylinder[0]-p.x>.11,'Strong initial impulse in 20 ms');near(p.y,PLASMA.cylinder[1]);
for(const speed of [.75,.9,1,1.2])for(const forced of [false,true]){
 const state:WeaponSlotState={ammo:45,reserve:180,heat:forced?100:80,overheated:forced};assert.ok(beginPlasmaAction(state,speed));near(state.totalReloadT!,(forced?2.90:2.25)*speed);assert.equal(state.reloadSequence!.plasmaForcedVent,forced);
 const contacts:{event:string;time:number}[]=[];const slice=1/144;let elapsed=0,previousHeat=state.heat!;
 while(state.reloading){const dt=Math.min(slice,(forced?2.90:2.25)*speed-elapsed+1e-8);elapsed+=dt;advancePlasmaAction(state,dt,(event,scale,late)=>{near(scale,speed);contacts.push({event,time:(elapsed-late)/speed});});assert.ok(state.heat!<=previousHeat+1e-7);previousHeat=state.heat!;
  near(state.plasma!.upperDoor,0);near(state.plasma!.lowerDoor,0);assert.deepEqual([state.ammo,state.reserve],[45,180]);if(state.reloading)assert.equal(plasmaReady(state),false);
 }
 assert.deepEqual(contacts.map(x=>x.event),forced?['thermal_release','thermal_open','cooling_pulse','heat_react','thermal_close','ready']:['thermal_release','thermal_open','cooling_pulse','thermal_close','ready']);contacts.forEach((x,i)=>near(x.time,(forced?[.44,.72,.72,1.5,2.58,2.90]:[.44,.72,.72,2.05,2.25])[i]));assert.equal(plasmaReady(state),true);
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
const single=createPlasmaRecoil();single.impulse();single.advance(.025);assert.ok(single.position.z>.020&&single.rotation.x>.003&&single.rotation.x<.006);assert.ok(Math.abs(single.position.x)<.004);assert.ok(single.position.z*PLASMA_RECOIL.adsScale<single.position.z);
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
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');const shot=app.slice(app.indexOf('function firePlasmaShot()'),app.indexOf('function reloadWeapon()'));assert.ok(shot.includes('player.pitch=plasmaAimPitch(player.pitch,player.aiming)'));assert.ok(!shot.includes('recoilPitch+='),'No second decaying aim impulse');assert.ok(shot.indexOf('plasmaPool.spawn(')<shot.indexOf('player.pitch=plasmaAimPitch'),'Launched bolt owns pre-recoil target');
console.log('PASS: authoritative 3.20/2.90/2.25 actions, 75% resistance then final slap, forced/manual hand reaction, exact per-shot spring at 30/60/144 Hz, pause/switch/reset, stable muzzle/spring resources and shot-driven player aim');

// Acceptance boundaries are independently asserted, including every new phase.
for(const hz of [30,60,144])for(const speed of [.75,.9,1,1.2]){
 const s:WeaponSlotState={ammo:20,reserve:180};beginPlasmaAction(s,speed);let time=0,seats=0;
 for(const [target,phase,ammo]of [[1.65,'retract',0],[2.07,'slap',0],[2.23,'lock',60],[2.50,'close',60],[2.85,'recover',60],[3.20,undefined,60]] as const){
  while(time+1/hz<target*speed-1e-9){advancePlasmaAction(s,1/hz,event=>{if(event==='cylinder_seat')seats++;});time+=1/hz;}
  advancePlasmaAction(s,target*speed-time,event=>{if(event==='cylinder_seat')seats++;});time=target*speed;
  assert.equal(s.reloadSequence?.phases[s.reloadSequence.index].phase,phase);assert.equal(s.ammo,ammo);
  if(target<=2.50)near(s.plasma!.upperDoor,1);
 }
 assert.equal(seats,1);assert.equal(s.reserve,120);
}
// Production hands maintain the cylinder's seating axis and clear receiver/vents.
const acceptanceVm=createViewmodelManager();
function handPose(time:number,forced?:boolean){const s:WeaponSlotState={ammo:20,reserve:180,heat:forced===undefined?0:forced?100:20,overheated:forced===true};acceptanceVm.resetEffects();acceptanceVm.update(0,def,s,false,false,true,false,false,false,0,true,true);beginPlasmaAction(s,1,forced===undefined?'swap':'vent');advancePlasmaAction(s,time);acceptanceVm.update(0,def,s,false,false,true,false,false,false,0,true,true);acceptanceVm.root.updateMatrixWorld(true);const root=acceptanceVm.root.getObjectByName('Weapon_laser')!,hand=root.getObjectByName('leftHand')!;return{s,root,hand,position:hand.position.clone(),rotation:hand.quaternion.clone()};}
const inserted=handPose(1.65),wound=handPose(2.07);near(inserted.position.x-wound.position.x,.105);near(inserted.position.y,wound.position.y);near(inserted.position.z,wound.position.z);
for(const t of [1.65,1.8,2,2.07,2.12,2.1692]){const pose=handPose(t);near(pose.root.getObjectByName('freshGasCylinder')!.position.x,PLASMA.freshContact[0]);}
for(const t of [2.17,2.19,2.21,2.229999]){const pose=handPose(t),fresh=pose.root.getObjectByName('freshGasCylinder')!;near(pose.position.x-fresh.position.x,-.052);near(pose.position.y-fresh.position.y,-.016);near(pose.position.z-fresh.position.z,.025);}
const seatedHand=handPose(2.23);near(seatedHand.position.x,PLASMA.cylinder[0]-.052);assert.equal(seatedHand.s.ammo,60);
const quietStart=handPose(1.51,false),quietEnd=handPose(1.85,false);near(quietStart.position.distanceTo(quietEnd.position),0);near(quietStart.rotation.angleTo(quietEnd.rotation),0);
let minWaveY=Infinity,maxWaveY=-Infinity;
for(let t=1.5;t<2.4;t+=1/144){const pose=handPose(t,true);minWaveY=Math.min(minWaveY,pose.position.y);maxWaveY=Math.max(maxWaveY,pose.position.y);assert.ok(pose.position.x<=-.19+1e-7);const palm=pose.root.getObjectByName('leftGlovePalm') as THREE.Mesh,inverse=pose.root.matrixWorld.clone().invert(),point=new THREE.Vector3();for(let i=0;i<palm.geometry.attributes.position.count;i++){point.fromBufferAttribute(palm.geometry.attributes.position,i).applyMatrix4(palm.matrixWorld).applyMatrix4(inverse);assert.ok(point.x<-.10,'Heat-reaction palm outside emitter, receiver and upper shutter envelope');}}
assert.ok(maxWaveY-minWaveY>.08);acceptanceVm.dispose();
// A critically damped impulse never crosses rest; axial travel dominates muzzle lift.
const stable=createPlasmaRecoil();stable.impulse();let peakZ=0,peakY=0;
for(let n=0;n<240;n++){stable.advance(1/240);const root=new THREE.Object3D(),muzzle=new THREE.Vector3(0,.023,-.574);stable.apply(root);root.updateMatrix();muzzle.applyMatrix4(root.matrix);peakZ=Math.max(peakZ,stable.position.z);peakY=Math.max(peakY,Math.abs(muzzle.y-.023));assert.ok(stable.position.z>=0&&stable.rotation.x>=0);near(stable.position.y,0);}
assert.ok(peakZ>peakY*8);
console.log('PASS: exact nine-phase contacts/class clocks, 105 mm axial hand retraction, aligned fast seating, quiet manual vent, extended forced glove clearance, dominant backward recoil without rest crossing');

for(const role of Object.values(CLASSES))for(const mode of ['swap','manual','forced'] as const){
 const state:WeaponSlotState={ammo:20,reserve:180,heat:mode==='swap'?0:mode==='manual'?20:100,overheated:mode==='forced'};
 assert.ok(beginPlasmaAction(state,role.reloadMultiplier,mode==='swap'?'swap':'vent'));
 near(state.totalReloadT!,(mode==='swap'?3.20:mode==='manual'?2.25:2.90)*role.reloadMultiplier);
}
console.log('PASS: configured Assault, Medic, Engineer, Support and Recon action duration modifiers');
