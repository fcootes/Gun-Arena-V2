import assert from 'node:assert/strict';
import * as THREE from 'three';
import ts from 'typescript';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createPlasmaProjectilePool} from '../src/plasmaProjectiles';
import {createViewmodelManager,WEAPONS} from '../src/weapons';
import {PLASMA_IMPACT,plasmaSurface} from '../src/plasmaImpactEffects';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
import {beginPlasmaAction,advancePlasmaAction,PLASMA} from '../src/plasmaMechanics';
import {plasmaEjectedPose} from '../src/plasmaAnimation';
import type {CombatSystemsContext} from '../src/gameLoop';
import type {Bot,WeaponSlotState} from '../src/types';
const near=(a:number,b:number,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const scene=new THREE.Scene(),pool=createPlasmaProjectilePool(scene,8),terrain=new THREE.Mesh(new THREE.PlaneGeometry(100,100));terrain.position.y=-10;terrain.rotation.x=-Math.PI/2;scene.add(terrain);
const wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,.08),new THREE.MeshStandardMaterial({roughness:.92}));wall.name='Concrete impact wall';wall.position.set(0,1,-2);scene.add(wall);scene.updateMatrixWorld(true);
for(const kind of ['concrete','metal','paintedMetal','stone'] as const){wall.userData.plasmaSurface=kind;assert.equal(plasmaSurface(wall),kind);}delete wall.userData.plasmaSurface;assert.equal(plasmaSurface(wall),'concrete');
const collider={active:true,minX:-2,maxX:2,minY:-1,maxY:3,minZ:-2.04,maxZ:-1.96};
const context={scene,bots:[],player:{pos:new THREE.Vector3(50,1.65,0),alive:true,team:'blue'},world:{worldColliders:[collider],hittableObjects:[wall],terrainMesh:terrain},damageBot(){assert.fail('World wall cannot damage actor');}} as unknown as CombatSystemsContext;
const origin=new THREE.Vector3(0,1,0),aim=new THREE.Vector3(0,1,-10);
for(let n=0;n<110;n++){pool.spawn(origin,aim,'blue','player');pool.update(.01,context);}
assert.equal(pool.feedback.markCount,PLASMA_IMPACT.marks,'Oldest scorch is recycled at fixed 80-slot capacity');
const marks=pool.feedback.marks.filter(m=>m.active);assert.ok(marks.every(m=>m.object===wall));for(const mark of marks){near(mark.normal.z,1);near(mark.position.z,-1.958,.0001);assert.ok(mark.age<1);}
const scorch=pool.feedback.root.getObjectByName('Pooled plasma scorch marks') as THREE.InstancedMesh;
pool.render(13);assert.ok(scorch.count>0);const fade=scorch.geometry.attributes.markData.getX(0);assert.ok(fade>0&&fade<1,'Scorches fade after the useful persistent period');pool.render(4);assert.equal(pool.feedback.markCount,0);assert.ok(pool.feedback.marks.every(m=>m.object===null));
pool.spawn(origin,aim,'blue','player');pool.update(.01,context);scene.remove(wall);pool.render(0);assert.equal(pool.feedback.markCount,0,'Removed props cannot leave floating marks');scene.add(wall);scene.updateMatrixWorld(true);
pool.spawn(origin,aim,'blue','player');pool.update(.01,context);wall.position.x=.1;pool.render(0);assert.equal(pool.feedback.markCount,0,'Moving support invalidates static decal');wall.position.x=0;wall.updateMatrixWorld(true);
wall.visible=false;pool.spawn(origin,aim,'blue','player');pool.update(.01,context);assert.equal(pool.feedback.markCount,0);wall.visible=true;
context.world.hittableObjects=[];pool.spawn(origin,aim,'blue','player');pool.update(.01,context);assert.equal(pool.feedback.markCount,0,'Invisible collision volumes never receive marks');context.world.hittableObjects=[wall];
let environmental=0;wall.userData.destructible=true;context.world.damageEnvironmentalBlock=(object,amount,at)=>{assert.equal(object,wall);assert.ok(at&&Math.abs(at.z+1.96)<.001);environmental+=amount;return false;};pool.spawn(origin,aim,'blue','player');pool.update(.01,context);assert.equal(environmental,12);wall.userData.destructible=false;
pool.clear();pool.spawn(new THREE.Vector3(0,1,-3),aim,'blue','player',12,1.7,origin,context);pool.render(0);assert.equal(pool.activeCount,0);assert.equal(pool.feedback.markCount,1,'Close muzzle obstruction gets a real supported surface mark');pool.clear();
// Contact normals follow rotated and non-uniformly scaled actual mesh geometry.
context.world.worldColliders=[];wall.rotation.y=.35;wall.scale.set(1.2,1,.8);wall.updateMatrixWorld(true);pool.spawn(origin,aim,'blue','player');pool.update(.02,context);assert.equal(pool.feedback.markCount,1);const oriented=pool.feedback.marks.find(m=>m.active)!;near(oriented.normal.x,Math.sin(.35));near(oriented.normal.z,Math.cos(.35));wall.rotation.y=0;wall.scale.set(1,1,1);wall.updateMatrixWorld(true);
// Exercise the real App shield/armour handlers through projectile resolution.
const source=ts.createSourceFile('App.tsx',readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const functions=new Map<string,string>();
function visit(n:ts.Node){if(ts.isFunctionDeclaration(n)&&n.name&&['damageBot','applyDamageToPlayer'].includes(n.name.text))functions.set(n.name.text,n.getText(source));ts.forEachChild(n,visit);}visit(source);
const player={alive:true,shield:15,health:100,damageDealt:0},runtime={THREE,player,world:context.world,matchConfig:{inspectorMode:false},focusTargetIDRef:{current:null},AUDIO:{bulletHit:{play(){}}},flashVignette(){}};
const damageBot=vm.runInNewContext(ts.transpile(`(${functions.get('damageBot')})`),runtime),damagePlayer=vm.runInNewContext(ts.transpile(`(${functions.get('applyDamageToPlayer')})`),runtime);
scene.remove(wall);pool.clear();const bot={id:5,alive:true,team:'red',pos:new THREE.Vector3(0,0,-10),health:100,armor:40,campaignEntity:'spartan',isZombie:false} as Bot;
const body=new THREE.Mesh(new THREE.BoxGeometry(.6,1,.4));body.position.set(0,.9,-10);body.userData={type:'botpart',ref:bot,part:'body'};const head=new THREE.Mesh(new THREE.BoxGeometry(.4,.4,.4));head.position.set(0,1.7,-10);head.userData={type:'botpart',ref:bot,part:'head'};scene.add(body,head);scene.updateMatrixWorld(true);
context.bots=[bot];context.world.hittableObjects=[body,head];context.player.pos.set(50,1.65,0);let events=0;context.damageBot=(...args)=>{events++;damageBot(...args);};
pool.spawn(new THREE.Vector3(0,.9,0),new THREE.Vector3(0,.9,-20),'blue','player');pool.update(.05,context);near(bot.armor!,32.2);near(bot.health,95.8);assert.equal(events,1);pool.update(.05,context);assert.equal(events,1);
pool.spawn(new THREE.Vector3(0,1.7,0),new THREE.Vector3(0,1.7,-20),'blue','player');pool.update(.05,context);near(bot.armor!,32.2);near(bot.health,75.4);assert.equal(events,2);assert.equal(pool.feedback.markCount,0,'No persistent character injury marks');
pool.spawn(new THREE.Vector3(0,.9,0),new THREE.Vector3(0,.9,-20),'red','player');pool.update(.05,context);near(bot.health,75.4);assert.equal(events,2);
scene.add(wall);scene.updateMatrixWorld(true);context.world.worldColliders=[collider];context.world.hittableObjects=[wall,body,head];pool.spawn(new THREE.Vector3(0,.9,0),aim,'blue','player');pool.update(.05,context);near(bot.health,75.4);assert.equal(events,2,'Nearest solid wall prevents damage behind it');assert.equal(pool.feedback.markCount,1);context.world.worldColliders=[];context.world.hittableObjects=[body,head];scene.remove(wall);pool.clear();
context.player.pos.set(0,1.65,-10);context.player.applyDamage=(amount,ignore,flash,attacker)=>{assert.equal(ignore,false);assert.equal(attacker,bot);damagePlayer(amount,ignore,flash,attacker);};Object.defineProperty(context.player,'shield',{get:()=>player.shield});
for(let n=0;n<2;n++){pool.spawn(new THREE.Vector3(0,.9,0),new THREE.Vector3(0,.9,-20),'red',bot);pool.update(.05,context);}near(player.shield,0);near(player.health,91);
// Enlarged canister, shared representations and exact seated handoff remain valid.
const model=createWeaponAssembly('laser'),parts=model.parts,state:WeaponSlotState={ammo:20,reserve:180};beginPlasmaAction(state);near(state.totalReloadT!,2.7);advancePlasmaAction(state,.64);model.update(0,0,0,state);model.root.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(parts.gasCylinder),extent=bounds.getSize(new THREE.Vector3());assert.ok(extent.x>.054&&extent.x<.057);assert.ok(extent.z<=.2061);assert.equal(PLASMA.cylinderRadius,.028);
const pos=new THREE.Vector3(),rot=new THREE.Euler();plasmaEjectedPose(0,pos,rot);near(pos.distanceTo(new THREE.Vector3(...PLASMA.cylinder)),0);plasmaEjectedPose(1/30,pos,rot);assert.ok(PLASMA.cylinder[0]-pos.x>.12,'Large visible outward pop in the first 33 ms');near(pos.y,PLASMA.cylinder[1]);plasmaEjectedPose(.20,pos,rot);assert.ok(PLASMA.cylinder[0]-pos.x>.30);
const v=new THREE.Vector3(),inverse=new THREE.Matrix4();
for(let t=0;t<=.35;t+=1/240){plasmaEjectedPose(t,parts.oldGasCylinder.position,parts.oldGasCylinder.rotation);model.root.updateMatrixWorld(true);
 for(const [name,sign]of [['chamberUpperDoor',-1],['chamberLowerDoor',1]] as const){inverse.copy(parts[name].matrixWorld).invert();parts.oldGasCylinder.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(let n=0;n<o.geometry.attributes.position.count;n++){v.fromBufferAttribute(o.geometry.attributes.position,n).applyMatrix4(o.matrixWorld).applyMatrix4(inverse);assert.ok(!(Math.abs(v.x)<.0025&&Math.abs(v.y-sign*.03125)<.030&&Math.abs(v.z)<.110),'Spent pressure cartridge clears both doors before tumbling');}});}
}
disposeWeaponObject(model.root);
// The expelled vessel must also clear the actual articulated support glove.
const viewmodel=createViewmodelManager(),weapon=WEAPONS.find(w=>w.id==='laser')!,slot:WeaponSlotState={ammo:20,reserve:180};
viewmodel.update(0,weapon,slot,false,false,true,false,false,false,0,true,true);beginPlasmaAction(slot);
const instance=new THREE.Matrix4(),handTransform=new THREE.Matrix4();
while(slot.reloading){advancePlasmaAction(slot,1/240);viewmodel.update(1/240,weapon,slot,false,false,true,false,false,false,0,true,true);viewmodel.root.updateMatrixWorld(true);
 const spent=viewmodel.root.getObjectByName('oldGasCylinder')!;if(!spent.visible)continue;
 inverse.copy(spent.matrixWorld).invert();
 const check=(mesh:THREE.Mesh,matrix:THREE.Matrix4)=>{for(let n=0;n<mesh.geometry.attributes.position.count;n++){v.fromBufferAttribute(mesh.geometry.attributes.position,n).applyMatrix4(matrix);const z=Math.abs(v.z),radius=z>.089?.011:.0285;assert.ok(!(v.x*v.x+v.y*v.y<radius*radius&&z<.103),`Ejected pressure vessel clears support glove at age ${slot.plasma?.ejectionAge}, point ${v.toArray()}`);}};
 const palm=viewmodel.root.getObjectByName('leftGlovePalm') as THREE.Mesh,fingers=viewmodel.root.getObjectByName('GlovePhalanges') as THREE.InstancedMesh;
 check(palm,handTransform.multiplyMatrices(inverse,palm.matrixWorld));for(let n=15;n<30;n++){fingers.getMatrixAt(n,instance);check(fingers,handTransform.multiplyMatrices(inverse,fingers.matrixWorld).multiply(instance));}
}viewmodel.dispose();
// Sustained reuse does not allocate Three mesh/material/geometry objects.
pool.clear();scene.add(wall);wall.updateMatrixWorld(true);context.bots=[];context.player.pos.set(50,1.65,0);context.world.hittableObjects=[wall];const sentinel=new THREE.Object3D(),g0=new THREE.BufferGeometry(),m0=new THREE.MeshBasicMaterial();for(let n=0;n<200;n++){pool.spawn(origin,aim,'blue','player');pool.update(.02,context);}const next=new THREE.Object3D(),g1=new THREE.BufferGeometry(),m1=new THREE.MeshBasicMaterial();assert.equal(next.id,sentinel.id+1);assert.equal(g1.id,g0.id+1);assert.equal(Reflect.get(m1,'id'),Reflect.get(m0,'id')+1);
const resources=new Set<THREE.BufferGeometry|THREE.Material>();pool.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){resources.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])resources.add(material);}});const counts=new Map<unknown,number>();resources.forEach(r=>r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)??0)+1)));pool.dispose();pool.dispose();resources.forEach(r=>assert.equal(counts.get(r),1));assert.ok(pool.feedback.marks.every(m=>m.object===null));assert.equal(pool.spawn(origin,aim,'blue','player'),false);
for(const r of [g0,g1,m0,m1,wall.geometry,wall.material,body.geometry,body.material,head.geometry,head.material,terrain.geometry,terrain.material])if(!Array.isArray(r))r.dispose();
console.log('PASS: supported real-surface scorch normals, 80-slot recycling/fade/reset, no invisible/actor decals, existing environmental interface, actual App shields/armour/headshots/attribution, chunkier shared cylinder and forceful clear-before-tumble ejection, no per-hit GPU allocation and complete disposal');
