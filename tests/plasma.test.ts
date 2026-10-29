import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PLASMA,plasmaDamageFalloff,beginPlasmaAction,advancePlasmaAction,advancePlasmaFire,advancePlasmaCooling,plasmaReady,addPlasmaSupply} from '../src/plasmaMechanics';
import {beginWeaponReload,advanceWeaponReload,cancelWeaponReload} from '../src/weaponReload';
import {createPlasmaProjectilePool} from '../src/plasmaProjectiles';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import {createViewmodelManager,WEAPONS} from '../src/weapons';
import type {WeaponSlotState,Bot} from '../src/types';
import type {CombatSystemsContext} from '../src/gameLoop';
import {plasmaFreshPose,plasmaEjectedPose} from '../src/plasmaAnimation';
import {plasmaAmmoSegment,plasmaHeatColour} from '../src/plasmaMechanics';
import {readFileSync} from 'node:fs';
const near=(a:number,b:number,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`),gun=WEAPONS.find(w=>w.id==='laser')!;
near(plasmaDamageFalloff(60),1);near(plasmaDamageFalloff(120),.4);near(plasmaDamageFalloff(130),.4);
assert.deepEqual([gun.mag,gun.reserve,gun.fireRate,gun.range],[60,180,.125,130]);
for(const hz of [30,60,144]){
 const ws:WeaponSlotState={ammo:60,reserve:180};let shots=0,overheat=0;
 for(let i=0;i<hz*6;i++){advancePlasmaCooling(ws,1/hz);shots+=advancePlasmaFire(ws,1/hz,true,()=>true);if(ws.overheated){overheat=(i+1)/hz;break;}}
 assert.equal(shots,40);assert.ok(overheat>=4.9&&overheat<=5.04);assert.equal(ws.ammo,20);
 assert.equal(advancePlasmaFire(ws,1,true,()=>{throw Error('Overheated firing');}),0);
 assert.ok(beginPlasmaAction(ws));assert.equal(ws.reloadSequence!.kind,'plasmaVent');advancePlasmaAction(ws,100);assert.equal(ws.ammo,20);assert.equal(ws.overheated,false);
 const unlimitedHeat:WeaponSlotState={ammo:60,reserve:180};let total=0;
 for(let i=0;i<hz*8;i++){unlimitedHeat.heat=0;unlimitedHeat.overheated=false;total+=advancePlasmaFire(unlimitedHeat,1/hz,true,()=>true);assert.ok(total<=Math.floor((i+1)/hz*8+1e-6));}
 assert.equal(total,60);assert.equal(unlimitedHeat.ammo,0);
}
const stall:WeaponSlotState={ammo:60};assert.ok(advancePlasmaFire(stall,10,true,()=>true)<=2);const rejected:WeaponSlotState={ammo:60};assert.equal(advancePlasmaFire(rejected,1,true,()=>false),0);assert.equal(rejected.ammo,60);
for(const [ammo,heat,overheated,kind] of [[20,10,false,'plasmaSwap'],[45,80,false,'plasmaVent'],[60,80,false,'plasmaVent'],[0,80,false,'plasmaSwap'],[0,100,true,'plasmaVent'],[60,0,false,undefined]] as const){
 const ws:WeaponSlotState={ammo,reserve:180,heat,overheated};assert.equal(beginPlasmaAction(ws),!!kind);if(kind){assert.equal(ws.reloadSequence!.kind,kind);assert.equal(beginPlasmaAction(ws),false);advancePlasmaAction(ws,100);assert.equal(ws.ammo,kind==='plasmaSwap'?60:ammo);assert.equal(ws.reserve,kind==='plasmaSwap'?120:180);}
}
for(const hz of [30,60,144])for(const speed of [.75,.9,1,1.2])for(const cut of [.1,.419,.43,.639,.641,.859,.9,1.3496,1.539,1.541,1.878,2.009,2.011,2.359,2.699,2.70]){
 const ws:WeaponSlotState={ammo:20,reserve:180,heat:5};assert.ok(beginWeaponReload(gun,ws,speed));near(ws.totalReloadT!,2.7*speed);
 let time=0;while(time+1/hz<cut*speed){advanceWeaponReload(gun,ws,1/hz);time+=1/hz;}advanceWeaponReload(gun,ws,cut*speed-time);
 if(cut<2.7)assert.equal(plasmaReady(ws),false,'No firing before full closure AND recovery');
 const expected=cut<.64?[20,180]:cut<2.01?[0,180]:[60,120];assert.deepEqual([ws.ammo,ws.reserve],expected);
 cancelWeaponReload(ws);assert.deepEqual([ws.ammo,ws.reserve],expected,'Cancel preserves the actual transaction');
 assert.equal(ws.plasma!.upperDoor,0);assert.equal(ws.plasma!.lowerDoor,0);assert.equal(ws.plasma!.release,0);assert.equal(ws.plasma!.shutters,0);assert.equal(ws.plasma!.ejectionAge,-1);
 const saved=[ws.ammo,ws.reserve];advanceWeaponReload(gun,ws,100);assert.deepEqual([ws.ammo,ws.reserve],saved);
 assert.equal(plasmaReady(ws),expected[0]>0);
 if(ws.ammo!<60){assert.ok(beginWeaponReload(gun,ws,speed));advanceWeaponReload(gun,ws,100);assert.deepEqual([ws.ammo,ws.reserve],[60,120]);}
}
for(const hz of [30,60,144]){
 const held:WeaponSlotState={ammo:20,reserve:180};beginPlasmaAction(held);let restored=false;
 for(let n=0;n<Math.ceil(2.7*hz)+1;n++){
  advancePlasmaAction(held,1/hz);const shots=advancePlasmaFire(held,1/hz,true,()=>{assert.equal(held.reloading,false);return true;});
  if(!held.reloading){assert.ok(shots>0,'No extra cooldown is appended to the completed 2.70 s action');restored=true;break;}
 }
 assert.ok(restored);
}
const legacyVent:WeaponSlotState={ammo:45,reserve:100,heat:80};beginPlasmaAction(legacyVent);advancePlasmaAction(legacyVent,100);assert.deepEqual([legacyVent.ammo,legacyVent.reserve],[45,100]);
const contacts: {event:string;time:number}[]=[],contactState:WeaponSlotState={ammo:20,reserve:180};beginPlasmaAction(contactState);advancePlasmaAction(contactState,3,(event,_speed,late)=>contacts.push({event,time:3-late}));
assert.deepEqual(contacts.map(c=>c.event),['chamber_release','doors_open','cylinder_eject','cylinder_align','cylinder_partial','cylinder_seat','doors_close','ready']);contacts.forEach((c,n)=>near(c.time,[.42,.64,.64,1.3496,1.54,2.01,2.36,2.70][n]));
advancePlasmaAction(contactState,100,()=>assert.fail('No repeated contact after completion'));assert.deepEqual([contactState.ammo,contactState.reserve],[60,120]);
const supply:WeaponSlotState={reserve:180};addPlasmaSupply(supply,45);assert.equal(supply.reserve,240);
const model=createWeaponAssembly('laser'),a=model.parts;
function pose(time:number,vent=false,ammo=20,heat=0){const ws:WeaponSlotState={ammo,reserve:180,heat:vent?80:heat};if(time>0||vent){beginPlasmaAction(ws,1,vent?'vent':'swap');advancePlasmaAction(ws,time);}model.update(0,0,0,ws);model.root.updateMatrixWorld(true);return ws;}
for(const obsolete of ['plasmaTray','trayGuides','plasmaLatch','cartridgeClips'])assert.equal(a[obsolete],undefined,'Old tray geometry is removed');
assert.equal(a.gasCylinder.parent,a.receiver);assert.deepEqual(a.gasCylinder.position.toArray(),PLASMA.cylinder);
const installedBounds=new THREE.Box3().setFromObject(a.gasCylinder);
assert.ok(installedBounds.min.x>-.047&&installedBounds.max.x<.035&&installedBounds.min.y>-.020&&installedBounds.max.y<.062&&installedBounds.min.z>-.178&&installedBounds.max.z<.046,'Cylinder fully contained in the receiver envelope');
near(model.muzzle.position.distanceTo(new THREE.Vector3(0,.023,-.574)),0);
const readyDoor=a.chamberUpperDoor.position.clone(),lowerDoor=a.chamberLowerDoor.position.clone();
pose(.639);assert.equal(a.gasCylinder.visible,true);assert.equal(a.oldGasCylinder.visible,false);
pose(.64);assert.equal(a.gasCylinder.visible,false);assert.equal(a.oldGasCylinder.visible,true);near(a.oldGasCylinder.position.distanceTo(new THREE.Vector3(...PLASMA.cylinder)),0);
near(a.chamberUpperDoor.rotation.z,-PLASMA.doorAngle);near(a.chamberLowerDoor.rotation.z,PLASMA.doorAngle);
const upperBounds=new THREE.Box3().setFromObject(a.chamberUpperDoor),lowerBounds=new THREE.Box3().setFromObject(a.chamberLowerDoor);
assert.ok(upperBounds.min.y>installedBounds.max.y&&lowerBounds.max.y<installedBounds.min.y,'Both fully open doors clear the cylinder');
assert.ok(upperBounds.max.y<.098,'Upper door below optic and cooling assembly');
assert.ok(lowerBounds.max.z<.050,'Lower door forward of firing grip');
// Rays from INSIDE the empty bay hit distant structural walls, not a solid block.
const ray=new THREE.Raycaster(),centre=new THREE.Vector3(...PLASMA.cylinder);
for(const z of [-.14,-.10,-.06,-.02,.015])for(const direction of [new THREE.Vector3(-1,0,0),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0)]){
 ray.set(new THREE.Vector3(centre.x,centre.y,z),direction);const hit=ray.intersectObject(a.receiver,true).find(h=>h.object instanceof THREE.Mesh&&h.object.parent!==a.oldGasCylinder&&h.object.parent!==a.gasCylinder&&h.object.parent!==a.freshGasCylinder);
 if(hit)assert.ok(hit.distance>=.024-1e-5,'Real void around internal cylinder');
}
const pathPoint=new THREE.Vector3(),pathRotation=new THREE.Euler();plasmaEjectedPose(0,pathPoint,pathRotation);near(pathPoint.distanceTo(new THREE.Vector3(...PLASMA.cylinder)),0);
plasmaFreshPose('insert',0,pathPoint);near(pathPoint.distanceTo(new THREE.Vector3(...PLASMA.freshStart)),0);plasmaFreshPose('insert',1,pathPoint);near(pathPoint.distanceTo(new THREE.Vector3(...PLASMA.freshContact)),0);plasmaFreshPose('slap',1,pathPoint);near(pathPoint.distanceTo(new THREE.Vector3(...PLASMA.cylinder)),0);
pose(.86);assert.ok(new THREE.Box3().setFromObject(a.oldGasCylinder).max.x<-.055,'Old cartridge completely clears receiver');
pose(1.31);assert.equal(a.oldGasCylinder.visible,false,'Bounded cosmetic lifetime');assert.equal(a.gasCylinder.visible,false,'Empty chamber after ejection');
pose(2.01-1e-6);const fresh=a.freshGasCylinder.getWorldPosition(new THREE.Vector3());pose(2.01+1e-6);near(a.gasCylinder.getWorldPosition(new THREE.Vector3()).distanceTo(fresh),0,1e-6);assert.equal(a.freshGasCylinder.visible,false);
pose(2.01);assert.equal(a.chamberUpperDoor.rotation.z,-PLASMA.doorAngle,'Doors remain fully open until seating');
pose(2.70);near(a.chamberUpperDoor.rotation.z,0);near(a.chamberLowerDoor.rotation.z,0);near(a.chamberUpperDoor.position.distanceTo(readyDoor),0);near(a.chamberLowerDoor.position.distanceTo(lowerDoor),0);
for(const t of [.2,.44,.72,1.2,1.7,2.0,2.25]){const ws=pose(t,true);if(t===.72||t===1.2){const shutter=a.coolingShutter0;const end=new THREE.Vector3(0,0,-.035).applyMatrix4(shutter.matrixWorld);assert.ok(end.y>shutter.position.y+.02);}near(a.chamberUpperDoor.rotation.z,0);near(a.chamberLowerDoor.rotation.z,0);assert.equal(a.oldGasCylinder.visible,false);assert.equal(ws.ammo,20);assert.equal(ws.reserve,180);}
for(const ammo of [0,5,10,20,30,40,50,55,60])for(const heat of [0,30,60,85,100]){
 pose(0,false,ammo,heat);assert.equal(a.ammoIndicator.userData.ammo,ammo);assert.equal(a.heatIndicator.userData.heat,heat);
 near(Array.from({length:6},(_,i)=>plasmaAmmoSegment(ammo,i)).reduce((n,x)=>n+x,0),ammo/10);
}
const cold=new THREE.Color(),hot=new THREE.Color();plasmaHeatColour(0,cold);plasmaHeatColour(100,hot);assert.ok(hot.r>cold.r);near(hot.g,0);near(hot.b,0);
// Shared cylinder buffers, no new geometry or meshes in any animation path.
for(const name of ['oldGasCylinder','freshGasCylinder'])a[name].children.forEach((o,i)=>assert.equal((o as THREE.Mesh).geometry,(a.gasCylinder.children[i] as THREE.Mesh).geometry));
let ceramic=false,draws=0;const resources=new Set<THREE.BufferGeometry|THREE.Material>();model.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){resources.add(o.geometry);if(!Array.isArray(o.material))resources.add(o.material);if(o instanceof THREE.Mesh)draws++;const m=o.material as THREE.MeshStandardMaterial;if(m.color?.r>.6&&m.roughness>.5)ceramic=true;}});assert.ok(ceramic);assert.ok(draws<24,`Plasma has ${draws} batched meshes`);
const sentinel=new THREE.Object3D(),g0=new THREE.BufferGeometry(),m0=new THREE.MeshBasicMaterial();
for(let n=0;n<220;n++)pose(n/100);const after=new THREE.Object3D(),g1=new THREE.BufferGeometry(),m1=new THREE.MeshBasicMaterial();assert.equal(after.id,sentinel.id+1);assert.equal(g1.id,g0.id+1);assert.equal(Reflect.get(m1,'id'),Reflect.get(m0,'id')+1);
for(const o of [g0,g1,m0,m1])o.dispose();
const disposal=new Map<unknown,number>();resources.forEach(r=>r.addEventListener('dispose',()=>disposal.set(r,(disposal.get(r)??0)+1)));disposeWeaponObject(model.root);resources.forEach(r=>assert.equal(disposal.get(r),1));
// Production viewmodel: actual glove thumb contact, carried cylinder and stable grip.
const vm=createViewmodelManager(),state:WeaponSlotState={ammo:20,reserve:180,heat:0};vm.update(0,gun,state,false,false,true,false,false,false,0,true,true);const root=vm.root.getObjectByName('Weapon_laser')!,right=root.getObjectByName('rightHand')!.position.clone();beginWeaponReload(gun,state);
const thumbTip=new THREE.Vector3(0,.018,0),thumbPoint=new THREE.Vector3(),buttonPoint=new THREE.Vector3();
const doorPoint=new THREE.Vector3(),doorInverse=new THREE.Matrix4(),handMatrix=new THREE.Matrix4(),fingerMatrix=new THREE.Matrix4();
function assertGloveClearsDoors(){
 const palm=root.getObjectByName('leftGlovePalm') as THREE.Mesh,fingers=root.getObjectByName('GlovePhalanges') as THREE.InstancedMesh;
 for(const [name,sign]of [['chamberUpperDoor',-1],['chamberLowerDoor',1]] as const){
  doorInverse.copy(root.getObjectByName(name)!.matrixWorld).invert();
  const check=(mesh:THREE.Mesh,matrix:THREE.Matrix4)=>{const vertices=mesh.geometry.attributes.position;for(let i=0;i<vertices.count;i++){
   doorPoint.fromBufferAttribute(vertices,i).applyMatrix4(matrix);
   assert.ok(!(Math.abs(doorPoint.x)<.002&&Math.abs(doorPoint.y-sign*.03125)<.02975&&Math.abs(doorPoint.z)<.109),`Actual left glove clears ${name} during ${state.reloadSequence?.phases[state.reloadSequence.index].phase}`);
  }};
  check(palm,handMatrix.multiplyMatrices(doorInverse,palm.matrixWorld));
  for(let n=15;n<30;n++){fingers.getMatrixAt(n,fingerMatrix);check(fingers,handMatrix.multiplyMatrices(doorInverse,fingers.matrixWorld).multiply(fingerMatrix));}
 }
}
let checkedThumb=false,checkedPalm=false;
while(state.reloading){advanceWeaponReload(gun,state,1/120);vm.update(1/120,gun,state,false,false,true,false,false,false,0,true,true);root.updateMatrixWorld(true);assertGloveClearsDoors();near(root.getObjectByName('rightHand')!.position.distanceTo(right),0);
 const stage=state.reloadSequence?.phases[state.reloadSequence.index];
 if(stage?.phase==='present'&&state.reloadSequence!.elapsed>.34){const tip=root.getObjectByName('left_thumb_2')!;thumbPoint.copy(thumbTip).applyMatrix4(tip.matrixWorld);buttonPoint.set(-.0045,0,0).applyMatrix4(root.getObjectByName('chamberRelease')!.matrixWorld);assert.ok(thumbPoint.distanceTo(buttonPoint)<.001,'Production thumb contacts release before opening');checkedThumb=true;}
 if(stage?.phase==='slap'){const wrist=root.getObjectByName('leftHand')!,fresh=root.getObjectByName('freshGasCylinder')!;thumbPoint.set(.0225,0,0).applyMatrix4(fresh.matrixWorld);assert.ok(wrist.getWorldPosition(buttonPoint).distanceTo(fresh.getWorldPosition(thumbPoint))<(state.reloadSequence!.elapsed/state.reloadSequence!.phases[state.reloadSequence!.index].duration<.72?.084:.065),'Palm follows actual insertion cylinder');checkedPalm=true;}
}
assert.ok(checkedThumb&&checkedPalm);vm.dispose();
// Sweeps use real mesh hits plus active wall bounds. Bot damage is deferred.
for(const hz of [30,60,144]){
 const scene=new THREE.Scene(),pool=createPlasmaProjectilePool(scene,8),terrain=new THREE.Mesh(new THREE.PlaneGeometry(100,100));terrain.position.y=-10;terrain.rotation.x=-Math.PI/2;scene.add(terrain);
 const bot={id:1,team:'red',alive:true,pos:new THREE.Vector3(0,0,-10)} as Bot;
 const target=new THREE.Mesh(new THREE.BoxGeometry(.6,1.8,.4),new THREE.MeshBasicMaterial());target.position.set(0,.9,-10);target.userData={type:'botpart',ref:bot,part:'body'};scene.add(target);scene.updateMatrixWorld(true);
 let damage=0,attacker:unknown;
 const ctx={scene,world:{worldColliders:[],hittableObjects:[target],terrainMesh:terrain},bots:[bot],player:{pos:new THREE.Vector3(50,1.65,0),alive:true,team:'blue'},damageBot(_b:Bot,n:number,_h:boolean,by:unknown){damage+=n;attacker=by;}} as unknown as CombatSystemsContext;
 const origin=new THREE.Vector3(0,.9,0),end=new THREE.Vector3(0,.9,-30);assert.ok(pool.spawn(origin,end,'blue','player'));assert.equal(damage,0);for(let i=0;i<hz;i++)pool.update(1/hz,ctx);assert.equal(damage,12);assert.equal(attacker,'player');assert.equal(pool.activeCount,0);
 damage=0;ctx.world.worldColliders.push({active:true,minX:-1,maxX:1,minY:0,maxY:2,minZ:-5.01,maxZ:-5});pool.spawn(origin,end,'blue','player');for(let i=0;i<hz;i++)pool.update(1/hz,ctx);assert.equal(damage,0,'Thin wall stops the bolt before bot');
 ctx.world.worldColliders=[];pool.clear();pool.spawn(origin,end,'red','player');for(let i=0;i<hz;i++)pool.update(1/hz,ctx);assert.equal(damage,0,'Friendly actor blocks without damage');
 pool.clear();pool.spawn(origin,end,'blue','player');pool.update(1,ctx);assert.equal(pool.activeCount,0);assert.ok(pool.bolts.every(b=>!b.active&&b.owner===null));
 // Relative actor motion: bot crosses the path between samples.
 pool.clear();target.position.x=3;bot.pos.x=3;scene.updateMatrixWorld(true);pool.update(.01,ctx);pool.spawn(origin,end,'blue','player');target.position.x=-3;bot.pos.x=-3;scene.updateMatrixWorld(true);const prior=damage;pool.update(.10,ctx);assert.ok(damage>prior,'Swept moving actor intersects between endpoints');
 pool.clear();ctx.player.pos.set(0,1.65,-10);let playerDamage=0;ctx.player.applyDamage=(n,_h,_e,by)=>{playerDamage+=n;assert.equal(by,bot);};pool.spawn(origin,end,'red',bot);for(let n=0;n<hz;n++)pool.update(1/hz,ctx);assert.equal(playerDamage,12,'Bot bolt retains damage attribution through player armour handler');
 pool.clear();ctx.player.pos.set(50,1.65,0);const object=new THREE.Object3D(),geometry=new THREE.BufferGeometry(),material=new THREE.MeshBasicMaterial();for(let i=0;i<100;i++){pool.spawn(origin,end,'blue','player');pool.update(.1,ctx);}const object2=new THREE.Object3D(),geometry2=new THREE.BufferGeometry(),material2=new THREE.MeshBasicMaterial();assert.equal(object2.id,object.id+1);assert.equal(geometry2.id,geometry.id+1);assert.equal(Reflect.get(material2,'id'),Reflect.get(material,'id')+1);
 pool.dispose();assert.equal(scene.getObjectByName('PR100ProjectilePool'),undefined);assert.equal(pool.spawn(origin,end,'blue','player'),false);for(const x of [geometry,geometry2,material,material2,target.geometry,target.material,terrain.geometry,terrain.material]){if(!Array.isArray(x))x.dispose();}
}
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.ok(!app.includes('laserBeamMesh'));assert.ok(app.includes('plasmaPool.update(dt,combatContext)'));assert.ok(app.includes('plasmaPool.dispose()'));
console.log('PASS: 8 Hz at 30/60/144 FPS, 60/180 charges, overheat/independent vent, R precedence, sealed swaps, all-phase cancellation, internal void/split doors/integrated emitter, independent indicators, ejection/seat contacts, actual glove contact, swept walls/moving actors/team checks and pool teardown');
