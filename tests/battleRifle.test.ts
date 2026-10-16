import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WEAPONS,createViewmodelManager} from '../src/weapons';
import {beginWeaponReload,advanceWeaponReload,cancelWeaponReload} from '../src/weaponReload';
import {BATTLE_RIFLE,brReloadLift,brChargingStroke} from '../src/battleRifleMechanics';
import {VIEWMODEL_GRIPS} from '../src/viewmodelGrips';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import type {WeaponSlotState} from '../src/types';
const gun=WEAPONS.find(w=>w.id==='br')!;
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const hz of [30,60,144])for(const speed of [1,.75,.9])for(const ammo of [0,3,35])for(const reserve of [1,100]) {
 const ws:WeaponSlotState={ammo,reserve,burstRemaining:2};const total=ammo+reserve,events:string[]=[];
 assert.ok(beginWeaponReload(gun,ws,speed));near(ws.totalReloadT!,(ammo?2.25:2.85)*speed);
 assert.equal(ws.burstRemaining,0);assert.equal(beginWeaponReload(gun,ws),false);
 let t=0;
 while(ws.reloading){t+=1/hz;advanceWeaponReload(gun,ws,1/hz,undefined,undefined,undefined,(event,_scale,late)=>{
  events.push(event);near(t-late,(event==='extract'?.48:event==='insert'?1.23:1.8+.60*.22)*speed);
 });assert.equal(ws.ammo!+ws.reserve!,total);if(t<1.8*speed-1e-8)assert.equal(ws.ammo,ammo);}
 assert.equal(ws.ammo,Math.min(36,total));assert.equal(ws.needsChamber,false);
 assert.deepEqual(events,ammo?['extract','insert']:['extract','insert','chamber']);
}
for(const t of [.2,.7,1.1,1.7,1.81,2.1,2.65]) {
 const s:WeaponSlotState={ammo:0,reserve:100};beginWeaponReload(gun,s);advanceWeaponReload(gun,s,t);
 const before=s.ammo!,reserve=s.reserve!;cancelWeaponReload(s);advanceWeaponReload(gun,s,100);
 assert.equal(s.ammo,before);assert.equal(s.reserve,reserve);
 if(s.needsChamber&&s.ammo){assert.ok(beginWeaponReload(gun,s));near(s.totalReloadT!,1.15);assert.equal(s.reloadSequence!.phases.some(p=>p.phase==='insert'),false);advanceWeaponReload(gun,s,10);assert.equal(s.needsChamber,false);assert.equal(s.ammo,before);}
}
const huge:WeaponSlotState={ammo:0,reserve:2};beginWeaponReload(gun,huge);advanceWeaponReload(gun,huge,100);assert.equal(huge.ammo,2);assert.equal(huge.reserve,0);assert.equal(huge.needsChamber,false);
const bot:WeaponSlotState={ammo:0,reserve:100};beginWeaponReload(gun,bot,1,false);near(bot.totalReloadT!,1.32);advanceWeaponReload(gun,bot,10);assert.equal(bot.needsChamber,false);
console.log('PASS: BR 2.25/2.85 s state clock at 30/60/144 Hz, exact cue/seat boundaries, burst clearing, reserve conservation and interrupted chamber recovery');

const model=createViewmodelManager();const ws:WeaponSlotState={ammo:3,reserve:180};
function step(dt=0){model.update(dt,gun,ws,false,false,true,false,false,false,0,true,true);model.root.updateMatrixWorld(true);}
step();const root=model.root.getObjectByName('Weapon_br')!,old=root.getObjectByName('magazine')!,fresh=root.getObjectByName('freshMagazine')!,left=root.getObjectByName('leftHand')!,right=root.getObjectByName('rightHand')!,bolt=root.getObjectByName('bolt')!;
const origin=old.position.clone(),anchor=right.position.clone(),grip=left.position.clone(),boltOrigin=bolt.position.clone();near(origin.z,BATTLE_RIFLE.magazineZ);
assert.ok(origin.z-.042>.09+.033,'Rear mag is entirely behind pistol grip');
const resources=new Set<any>();root.traverse((o:any)=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?[o.material].flat():[])resources.add(m);});
const shared=(old.children[0] as THREE.Mesh).geometry;assert.equal((fresh.children[0] as THREE.Mesh).geometry,shared,'Fresh magazine reuses the real baked magazine buffers');
const point=new THREE.Vector3(),inverse=new THREE.Matrix4();let upright=false,removed=false,replaced=false;
for(let n=0;n<4;n++) {
 ws.ammo=n%2?0:3;ws.reserve=180;assert.ok(beginWeaponReload(gun,ws));
 while(ws.reloading){advanceWeaponReload(gun,ws,1/144);const serialized=JSON.stringify(ws);step(1/144);assert.equal(JSON.stringify(ws),serialized,'Presentation never mutates ammo/action state');
  assert.ok(right.position.distanceTo(anchor)<1e-9,'Firing hand stays anchored');const q=ws.reloadSequence;if(!q)break;const phase=q.phases[q.index].phase,p=q.elapsed/q.phases[q.index].duration;
  if(brReloadLift(q)>.999){const direction=new THREE.Vector3(0,0,-1).applyQuaternion(root.quaternion);assert.ok(THREE.MathUtils.radToDeg(Math.asin(direction.y))>75,'Actual muzzle rises in pitch, not just roll');upright=true;}
  if(phase==='eject'||phase==='insert'){
   const part=phase==='eject'?old:fresh;inverse.copy(root.matrixWorld).invert();point.fromArray(VIEWMODEL_GRIPS.br.magazineGrip!.position).applyMatrix4(part.matrixWorld).applyMatrix4(inverse);
   assert.ok(point.distanceTo(left.position)<1e-7,'Exact wrist-to-real-rear-mag attachment without lag');
   if(phase==='eject'){near(part.position.z,origin.z);removed||=part.position.y<origin.y-.17;}
   if(phase==='insert'){replaced||=fresh.visible&&!old.visible;if(p>.22)near(fresh.position.x,0);}
  }
  if(phase==='chamber'){if(p>.18&&p<.84){inverse.copy(root.matrixWorld).invert();point.fromArray(VIEWMODEL_GRIPS.br.chamber!.partOffset!).applyMatrix4(bolt.matrixWorld).applyMatrix4(inverse);assert.ok(point.distanceTo(left.position)<1e-7,'Empty charging hand follows the actual receiver control');}assert.ok(ws.reloadSequence!.empty);assert.ok(bolt.position.z>=boltOrigin.z-1e-9&&bolt.position.z<=boltOrigin.z+.045+1e-9);near(bolt.position.z-boltOrigin.z,brChargingStroke(p));}
 }
 for(let i=0;i<90;i++)step(1/60);
 assert.ok(left.position.distanceTo(grip)<1e-7);assert.ok(old.position.distanceTo(origin)<1e-7);assert.equal(old.visible,true);assert.equal(fresh.visible,false);assert.ok(bolt.position.distanceTo(boltOrigin)<1e-7);
}
assert.ok(upright&&removed&&replaced);
const counts=new Map([...resources].map(r=>[r,0]));resources.forEach(r=>r.addEventListener('dispose',()=>counts.set(r,counts.get(r)!+1)));model.dispose();model.dispose();counts.forEach(n=>assert.equal(n,1));
const actor=createWeaponAssembly('br');assert.equal(actor.parts.freshMagazine,undefined);assert.equal(actor.parts.stock.visible,true);near(actor.parts.magazine.position.z,.21);disposeWeaponObject(actor.root);
console.log('PASS: true >75 degree upright muzzle, rear magwell axis, physical fresh magazine, anchored hands, bounded charge and repeated restoration/disposal');
