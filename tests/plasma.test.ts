import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PLASMA,plasmaDamageFalloff,beginPlasmaAction,advancePlasmaAction,advancePlasmaFire,advancePlasmaCooling,plasmaReady,addPlasmaSupply} from '../src/plasmaMechanics';
import {beginWeaponReload,advanceWeaponReload,cancelWeaponReload} from '../src/weaponReload';
import {createPlasmaProjectilePool} from '../src/plasmaProjectiles';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import {createViewmodelManager,WEAPONS} from '../src/weapons';
import type {WeaponSlotState,Bot} from '../src/types';
import type {CombatSystemsContext} from '../src/gameLoop';
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
for(const speed of [.75,.9,1,1.2])for(const cut of [.1,.3,.6,.9,1.1,1.41,1.43,1.7,1.859,1.861,2.1,2.4,2.7]){
 const ws:WeaponSlotState={ammo:20,reserve:180,heat:5};assert.ok(beginWeaponReload(gun,ws,speed));near(ws.totalReloadT!,2.8*speed);advanceWeaponReload(gun,ws,cut*speed);cancelWeaponReload(ws);
 assert.ok((ws.ammo??0)<=60);assert.ok([180,120].includes(ws.reserve!));assert.equal(ws.plasma!.tray,0);assert.equal(ws.plasma!.shutters,0);
 const saved=[ws.ammo,ws.reserve];advanceWeaponReload(gun,ws,100);assert.deepEqual([ws.ammo,ws.reserve],saved);
 if(ws.ammo!<60){assert.ok(beginWeaponReload(gun,ws,speed));advanceWeaponReload(gun,ws,100);assert.deepEqual([ws.ammo,ws.reserve],[60,120]);}
}
const legacyVent:WeaponSlotState={ammo:45,reserve:100,heat:80};beginPlasmaAction(legacyVent);advancePlasmaAction(legacyVent,100);assert.deepEqual([legacyVent.ammo,legacyVent.reserve],[45,100],'Venting preserves even legacy partial reserve counters');
const contacts: {event:string;time:number}[]=[],contactState:WeaponSlotState={ammo:20,reserve:180};beginPlasmaAction(contactState);advancePlasmaAction(contactState,3,(event,_speed,late)=>contacts.push({event,time:3-late}));
assert.deepEqual(contacts.map(c=>c.event),['tray_unlock','tray_open','cooling_pulse','cylinder_remove','cylinder_seat','tray_close','tray_lock']);contacts.forEach((c,n)=>near(c.time,[.45,.87,.87,1.42,1.86,2.32,2.54][n]));
const supply:WeaponSlotState={reserve:180};addPlasmaSupply(supply,45);assert.equal(supply.reserve,240);
const model=createWeaponAssembly('laser'),a=model.parts;
function pose(time:number,vent=false){const ws:WeaponSlotState={ammo:20,reserve:180,heat:vent?80:0};beginPlasmaAction(ws);advancePlasmaAction(ws,time);model.update(0,0,0,ws);model.root.updateMatrixWorld(true);return ws;}
assert.equal(a.gasCylinder.parent,a.plasmaTray);assert.equal(a.plasmaTray.parent,a.trayGuides.parent);
const guide=a.trayGuides.position.clone();pose(.87);near(a.plasmaTray.position.x,-.14);near(a.trayGuides.position.distanceTo(guide),0);
pose(1.2);assert.equal(a.gasCylinder.visible,false);assert.equal(a.oldGasCylinder.visible,true);assert.ok(a.oldGasCylinder.position.y>.031);
pose(1.86-1e-6);const fresh=a.freshGasCylinder.getWorldPosition(new THREE.Vector3());pose(1.86+1e-6);near(a.gasCylinder.getWorldPosition(new THREE.Vector3()).distanceTo(fresh),0);assert.equal(a.freshGasCylinder.visible,false);
for(const t of [.2,.4,.6,.9,1.1,1.25]){const ws=pose(t,true);if(t===.6||t===.9){const shutter=a.coolingShutter0;const end=new THREE.Vector3(0,0,-.035).applyMatrix4(shutter.matrixWorld);assert.ok(end.y>shutter.position.y+.02,'Cooling flap opens upward above the real heat-sink window');}near(a.plasmaTray.position.x,0);near(a.plasmaLatch.rotation.z,0);assert.equal(ws.ammo,20);assert.equal(ws.reserve,180);}
let ceramic=false,draws=0;model.root.traverse(o=>{if(o instanceof THREE.Mesh){draws++;const m=o.material as THREE.MeshStandardMaterial;if(m.color?.r>.6&&m.roughness>.5)ceramic=true;}});assert.ok(ceramic);assert.ok(draws<24);
disposeWeaponObject(model.root);
// Production viewmodel restores hands and follows the actual left-side carriage.
const vm=createViewmodelManager(),state:WeaponSlotState={ammo:20,reserve:180,heat:0};vm.update(0,gun,state,false,false,true,false,false,false,0,true,true);const root=vm.root.getObjectByName('Weapon_laser')!,right=root.getObjectByName('rightHand')!.position.clone();beginWeaponReload(gun,state);
while(state.reloading){advanceWeaponReload(gun,state,1/60);vm.update(1/60,gun,state,false,false,true,false,false,false,0,true,true);near(root.getObjectByName('rightHand')!.position.distanceTo(right),0);}
vm.dispose();
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
console.log('PASS: 8 Hz at 30/60/144 FPS, 60/180 charges, overheat/independent vent, R precedence, sealed swaps, all-phase cancellation, tray parenting/white ceramic, hands, swept walls/moving actors/team checks and pool teardown');
