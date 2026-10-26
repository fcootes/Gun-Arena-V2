import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import {createViewmodelManager,WEAPONS} from '../src/weapons';
import {beginWeaponReload,advanceWeaponReload,cancelWeaponReload} from '../src/weaponReload';
import {RAILGUN,canChargeRailgun,railgunBreechReady,markRailgunFired,type RailgunEvent} from '../src/railgunMechanics';
import {createWeaponMuzzleEffect,MUZZLE_PROFILES} from '../src/weaponEffects';
import type {WeaponSlotState} from '../src/types';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vmScript from 'node:vm';
const gun=WEAPONS.find(w=>w.id==='railgun')!;
assert.deepEqual([gun.damage,gun.mag,gun.reserve,gun.fireRate,gun.range,gun.kick,gun.adsFov],[160,1,30,1.3,500,.12,32]);
const near=(a:number,b:number,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const events:RailgunEvent[]=['railgun_breech_unlock','railgun_breech_open','railgun_carrier_eject','railgun_slug_seat','railgun_breech_close','railgun_breech_lock'];
const eventTimes=[.52,.87,.8988,1.98,2.35,2.55];
for(const hz of [30,60,144])for(const speed of [1,.75,.9,1.2]){
 const s:WeaponSlotState={ammo:0,reserve:30};markRailgunFired(s);assert.ok(beginWeaponReload(gun,s,speed));near(s.totalReloadT!,2.8*speed);assert.equal(beginWeaponReload(gun,s),false);
 const cues:RailgunEvent[]=[],times:number[]=[];let time=0;
 while(s.reloading){time+=1/hz;const before=s.ammo!;advanceWeaponReload(gun,s,1/hz,undefined,undefined,undefined,undefined,undefined,(event,scale,late)=>{cues.push(event);times.push(time-late);near(scale,speed);});
  assert.equal(s.ammo!+s.reserve!,30);assert.ok(s.ammo!<=1);if(s.reloading)assert.equal(canChargeRailgun(s),false);
  if(before===0&&s.ammo===1)assert.ok(s.railgunBreech!.cover>.99&&s.railgunBreech!.latch>.99,'Slug seats into a real open/unlocked chamber');
 }
 assert.deepEqual(cues,events);times.forEach((t,i)=>near(t,eventTimes[i]*speed));assert.ok(canChargeRailgun(s)&&railgunBreechReady(s));assert.deepEqual([s.ammo,s.reserve],[1,29]);
}
for(const t of [.10,.40,.63,.85,.94,1.17,1.68,1.99,2.19,2.40,2.57])for(const speed of [1,.75]){
 const s:WeaponSlotState={ammo:0,reserve:1};beginWeaponReload(gun,s,speed);const emitted:RailgunEvent[]=[];advanceWeaponReload(gun,s,t*speed,undefined,undefined,undefined,undefined,undefined,e=>emitted.push(e));const total=s.ammo!+s.reserve!,physical={...s.railgunBreech};cancelWeaponReload(s);
 advanceWeaponReload(gun,s,100);assert.deepEqual(s.railgunBreech,physical);assert.equal(s.ammo!+s.reserve!,total);
 if((s.ammo??0)>0&&railgunBreechReady(s))continue;
 assert.ok(beginWeaponReload(gun,s,speed));advanceWeaponReload(gun,s,100,undefined,undefined,undefined,undefined,undefined,e=>emitted.push(e));assert.deepEqual([s.ammo,s.reserve],[1,0]);assert.ok(canChargeRailgun(s));
 assert.equal(emitted.filter(e=>e==='railgun_slug_seat').length,1);assert.equal(emitted.filter(e=>e==='railgun_carrier_eject').length,1);
}
assert.equal(beginWeaponReload(gun,{ammo:0,reserve:0}),false);assert.equal(beginWeaponReload(gun,{ammo:1,reserve:30}),false);
const bot:WeaponSlotState={ammo:0,reserve:30};beginWeaponReload(gun,bot,1,false);near(bot.totalReloadT!,1.4*1.1);assert.equal(bot.reloadSequence!.kind,'battery');

const bare=createWeaponAssembly('railgun');assert.equal(bare.parts.magazine,undefined,'Fixed capacitors are never ammunition');
for(const name of ['breechCover','breechSlide','breechLatch','breechLock','loadingChamber','chamberSeat','freshSlug','chamberedSlug','spentCarrier','carrierEjectionPort','opticBridge'])assert.ok(bare.parts[name],name);
const f=new THREE.Box3().setFromObject(bare.parts.opticBridge),coverClosed=new THREE.Box3().setFromObject(bare.parts.breechCover);assert.ok(f.max.z<coverClosed.min.z-.05,'Fixed scope bridge clears all rearward cover travel');
const meshes:THREE.Mesh[]=[];bare.parts.loadingChamber.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
const ray=new THREE.Raycaster(new THREE.Vector3(0,.3,.125),new THREE.Vector3(0,-1,0));const hits=ray.intersectObjects(meshes,false);assert.ok(hits.length>0&&hits[0].point.y<.025,'Actual top-open loading cavity reaches the low floor');
let draws=0;bare.root.traverse(o=>{if(o instanceof THREE.Mesh)draws++;});assert.ok(draws<24,'Mechanical detail is material-batched');disposeWeaponObject(bare.root);

// Production animator and articulated rig, with actual part-local contacts.
const camera=new THREE.PerspectiveCamera(74,1280/720,.05,100),palm=new THREE.Vector3(),point=new THREE.Vector3(),matrix=new THREE.Matrix4();
function local(root:THREE.Object3D,o:THREE.Object3D,offset:readonly number[]){root.updateMatrixWorld(true);matrix.copy(root.matrixWorld).invert().multiply(o.matrixWorld);return point.fromArray(offset).applyMatrix4(matrix);}
for(const fps of [30,60,144]){
 const vm=createViewmodelManager(),s:WeaponSlotState={ammo:0,reserve:30};const tick=(dt:number)=>vm.update(dt,gun,s,false,false,true,false,false,false,0,true,true);
 tick(0);const root=vm.root.getObjectByName('Weapon_railgun')!,hand=root.getObjectByName('leftHand')!,right=root.getObjectByName('rightHand')!,right0=right.position.clone();
 beginWeaponReload(gun,s);let last:THREE.Vector3|undefined;
 while(s.reloading){advanceWeaponReload(gun,s,1/fps);const before=JSON.stringify(s);tick(1/fps);assert.equal(JSON.stringify(s),before,'Visuals do not mutate gameplay readiness');root.updateMatrixWorld(true);near(right.position.distanceTo(right0),0);
  if(!s.reloading)break;const q=s.reloadSequence!,stage=q.phases[q.index],p=q.elapsed/stage.duration;
  const cover=root.getObjectByName('breechCover')!,slide=root.getObjectByName('breechSlide')!,fresh=root.getObjectByName('freshSlug')!;
  near(slide.position.z,RAILGUN.slideTravel*s.railgunBreech!.cover);
  if(stage.phase==='unlock'||stage.phase==='lock'&&p>=.25){palm.set(0,.040,-.023).applyMatrix4(hand.matrixWorld);const lever=new THREE.Vector3(-.013,.004,.022).applyMatrix4(root.getObjectByName('breechLatch')!.matrixWorld);near(palm.distanceTo(lever),0);}
  if(stage.phase==='retract'&&p>=.20||stage.phase==='close'&&p>=.30){local(root,cover,RAILGUN.coverGrip);near(hand.position.distanceTo(point),0);}
  if(stage.phase==='insert'||stage.phase==='pickup'&&p>=.25){
   root.updateMatrixWorld(true);palm.set(0,.040,-.023).applyMatrix4(hand.matrixWorld);palm.applyMatrix4(new THREE.Matrix4().copy(fresh.matrixWorld).invert());
   near(Math.hypot(palm.x,palm.y),.0155);assert.ok(palm.z>=-.04501&&palm.z<=-.02999);assert.ok(fresh.visible);
  }
  if(stage.phase==='insert')assert.equal(s.ammo,0,'No early chambered ammunition');
  const upper=root.getObjectByName('railgunLeftUpperArm')!,fore=root.getObjectByName('leftForearm')!;
  const elbow=new THREE.Vector3(0,.5,0).applyMatrix4(upper.matrixWorld),joint=new THREE.Vector3(0,-.5,0).applyMatrix4(fore.matrixWorld);
  assert.ok(elbow.distanceTo(joint)<.007,`Connected elbow ${stage.phase}/${p}`);assert.ok(elbow.x<-.05&&elbow.y<-.17,`Compact peripheral support elbow ${stage.phase}/${p}: ${elbow.toArray()}`);
  if(last)assert.ok(hand.position.distanceTo(last)<6/fps,`No wrist teleport ${fps}Hz ${stage.phase}/${p}: ${hand.position.distanceTo(last)}`);last=hand.position.clone();
 }
 vm.dispose();
}
const vm=createViewmodelManager();vm.prepare(['railgun']);const geom=new THREE.BufferGeometry(),mat=new THREE.MeshStandardMaterial(),obj=new THREE.Object3D();
for(let n=0;n<8;n++){const s:WeaponSlotState={ammo:0,reserve:30};beginWeaponReload(gun,s);while(s.reloading){advanceWeaponReload(gun,s,1/60);vm.update(1/60,gun,s,false,false,true,false,false,false,0,true,true);}}
const geom2=new THREE.BufferGeometry(),mat2=new THREE.MeshStandardMaterial(),obj2=new THREE.Object3D();assert.equal(geom2.id,geom.id+1);assert.equal(Reflect.get(mat2,'id'),Reflect.get(mat,'id')+1);assert.equal(obj2.id,obj.id+1);geom.dispose();geom2.dispose();mat.dispose();mat2.dispose();vm.dispose();vm.dispose();
const model=createWeaponAssembly('railgun'),fx=createWeaponMuzzleEffect(model);assert.ok(MUZZLE_PROFILES.railgun.width<=.05&&MUZZLE_PROFILES.railgun.life<=.04);
let forbidden=0;fx.root.traverse(o=>{if(o instanceof THREE.Mesh&&(o.geometry.type==='TorusGeometry'||o.geometry.type==='ConeGeometry'))forbidden++;});assert.equal(forbidden,0);
const points=fx.root.children.find(o=>o instanceof THREE.Points)as THREE.Points,array=points.geometry.attributes.position.array;
for(let n=0;n<100;n++){fx.trigger();fx.update(1/144);assert.equal(points.geometry.attributes.position.array,array);}for(let n=0;n<90;n++)fx.update(1/60);assert.ok(Array.from(points.geometry.attributes.alpha.array).every(a=>a===0));disposeWeaponObject(model.root);

// Probe both sides of every authoritative boundary rather than only sampling
// regular frames. This catches wrist/orientation discontinuities between parts.
const continuous=createViewmodelManager();
function poseAt(time:number){const s:WeaponSlotState={ammo:0,reserve:30};beginWeaponReload(gun,s);advanceWeaponReload(gun,s,time);continuous.update(0,gun,s,false,false,true,false,false,false,0,true,true);const root=continuous.root.getObjectByName('Weapon_railgun')!,hand=root.getObjectByName('leftHand')!,upper=root.getObjectByName('railgunLeftUpperArm')!;root.updateMatrixWorld(true);return {hand:hand.getWorldPosition(new THREE.Vector3()),rotation:hand.getWorldQuaternion(new THREE.Quaternion()),elbow:new THREE.Vector3(0,.5,0).applyMatrix4(upper.matrixWorld)};}
let boundary=0;
for(const duration of [.28,.24,.35,.16,.40,.55,.37,.20]){boundary+=duration;const before=poseAt(boundary-1e-6),after=poseAt(boundary+1e-6);assert.ok(before.hand.distanceTo(after.hand)<.0001,`Continuous wrist at ${boundary}`);assert.ok(before.rotation.angleTo(after.rotation)<.001,`Continuous orientation at ${boundary}`);assert.ok(before.elbow.distanceTo(after.elbow)<.0001,`Continuous elbow at ${boundary}`);}
continuous.dispose();

// Third-person uses the very same parts-only animator without moving the actor's
// weapon attachment. Closed shroud clears the actual seated projectile volume.
const actorModel=createWeaponAssembly('railgun'),actorState:WeaponSlotState={ammo:0,reserve:30};actorModel.root.position.set(1,2,3);actorModel.root.rotation.set(.2,.4,.1);const actorPosition=actorModel.root.position.clone(),actorRotation=actorModel.root.quaternion.clone();beginWeaponReload(gun,actorState);
for(let n=0;n<170;n++){advanceWeaponReload(gun,actorState,1/60);actorModel.update(1/60,0,0,actorState);near(actorModel.root.position.distanceTo(actorPosition),0);near(actorModel.root.quaternion.angleTo(actorRotation),0);near(actorModel.parts.breechSlide.position.z,RAILGUN.slideTravel*actorState.railgunBreech!.cover);}
actorModel.root.position.set(0,0,0);actorModel.root.quaternion.identity();actorModel.root.updateMatrixWorld(true);const lid=new THREE.Box3().setFromObject(actorModel.parts.breechCover),slug=new THREE.Box3().setFromObject(actorModel.parts.chamberedSlug);assert.ok(lid.min.y>slug.max.y+.002,'Seated slug clears underside of locked shroud');disposeWeaponObject(actorModel.root);

// Execute actual App charge and piercing handlers; assertions do not reproduce
// a second version of the combat implementation.
const app=ts.createSourceFile('App.tsx',readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let chargeCode='',fireCode='',falloffCode='';function visit(node:ts.Node){if(ts.isIfStatement(node)&&node.expression.getText(app)==="curW.id === 'railgun'"&&node.thenStatement.getText(app).includes('curWs.chargeTimer = Math.min(1.2'))chargeCode=node.getText(app);if(ts.isFunctionDeclaration(node)&&node.name?.text==='fireRailgunSlug')fireCode=node.getText(app);if(ts.isFunctionDeclaration(node)&&node.name?.text==='getDamageRangeFalloff')falloffCode=node.getText(app);ts.forEachChild(node,visit);}visit(app);assert.ok(chargeCode&&fireCode&&falloffCode);const getDamageRangeFalloff=vmScript.runInNewContext(ts.transpile(`(${falloffCode})`));
for(const fps of [30,60,144]){
 const state:WeaponSlotState={ammo:1,reserve:30};let fired=0;const context={curW:gun,curWs:state,player:{fireHeld:true},canPlayerFire:()=>true,canChargeRailgun,updateRailgunWeaponAudio(){},vmManager:{setRailgunChargeProgress(){}},fireRailgunSlug(){fired++;markRailgunFired(state);},reloadWeapon(){beginWeaponReload(gun,state);}};
 const charge=vmScript.runInNewContext(ts.transpile(`(dt:number)=>{${chargeCode}}`),context);for(let n=0;n<Math.ceil(.3*fps);n++)charge(1/fps);context.player.fireHeld=false;charge(1/fps);assert.equal(fired,0);assert.equal(state.ammo,1);near(state.chargeTimer!,0);
 context.player.fireHeld=true;for(let n=0;n<Math.floor(1.2*fps)-1;n++)charge(1/fps);assert.equal(fired,0);for(let n=0;n<2&&fired===0;n++)charge(1/fps);assert.equal(fired,1);assert.equal(state.ammo,0);assert.ok(state.reloading);
 cancelWeaponReload(state);state.ammo=1;state.railgunBreech!.cover=.1;for(let n=0;n<fps*2;n++)charge(1/fps);assert.equal(fired,1);near(state.chargeTimer!,0);
}
const enemy1={id:1,team:'red'},enemy2={id:2,team:'red'},friend={id:3,team:'blue'},wall={userData:{destructible:true}},combatHits=[{object:wall,point:new THREE.Vector3(0,0,-10)},...[[enemy1,'body',20],[enemy1,'head',21],[friend,'body',100],[enemy2,'head',400]].map(([ref,part,z])=>({object:{userData:{type:'botpart',ref,part}},point:new THREE.Vector3(0,0,-Number(z))}))];
const state:WeaponSlotState={ammo:0,reserve:30},damage:number[]=[],muzzle=new THREE.Vector3(.15,-.2,-1.2);let beams=0,degraded=0,fireSounds=0;
const combat={THREE:{...THREE,Raycaster:class{ray={direction:new THREE.Vector3(0,0,-1)};constructor(_p:unknown,_d:unknown,near:number,far:number){assert.deepEqual([near,far],[.1,500]);}intersectObjects(){return combatHits;}}},canPlayerFire:()=>true,currentSlot:()=>gun,currentSlotState:()=>state,railgunBreechReady,markRailgunFired,performance:{now:()=>1000},player:{pos:new THREE.Vector3(),team:'blue',shotsFired:0,shotsHit:0,headshots:0},vmManager:{addRecoil(a:number,b:number){assert.deepEqual([a,b],[.12,.16]);},getMuzzlePosition(out:THREE.Vector3){out.copy(muzzle);}},recoilKick:0,recoilPitch:0,triggerPlayerFlash(){},AUDIO:{railgunFire:{play(){fireSounds++;}}},getFireCamera:()=>({getWorldDirection(out:THREE.Vector3){out.set(0,0,-1);}}),world:{hittableObjects:[],damageEnvironmentalBlock(_o:unknown,amount:number){degraded+=amount;}},camera:{position:new THREE.Vector3()},thirdPerson:false,spawnRailgunBeam(from:THREE.Vector3){beams++;near(from.distanceTo(muzzle),0);},spawnImpactSpark(){},getDamageRangeFalloff,damageBot(_bot:unknown,amount:number){damage.push(amount);},flashHit(){},showHitmarker(){},addPoints(){},pushKillFeed(){}};
const fire=vmScript.runInNewContext(ts.transpile(`(${fireCode})`),combat);fire();assert.deepEqual(damage,[160,160*gun.headshotMult!]);assert.deepEqual([combat.player.shotsFired,combat.player.shotsHit,beams,degraded,fireSounds],[1,2,1,75,1]);assert.ok(state.railgunBreech!.carrier&&!state.railgunBreech!.seated);state.railgunBreech!.latch=.1;fire();assert.equal(beams,1);state.railgunBreech!.latch=0;state.reloading=true;fire();assert.equal(beams,1);
console.log('PASS: 2.8 s authoritative reload, class modifiers, one slug/carrier and six cues, interruptions/lock guard, real cavity/scope clearance, rig contact and peripheral connected arms, 30/60/144 Hz, cached resources and compact pooled discharge');
console.log('PASS: every boundary has continuous wrist/orientation/elbow; third-person shares physical state; actual App retains early release, 1.2 s charge, one discharge, piercing, full-range damage, recoil and muzzle origin');
