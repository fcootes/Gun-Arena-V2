import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { WEAPONS, createViewmodelManager } from '../src/weapons';
import { beginWeaponReload, advanceWeaponReload, cancelWeaponReload, interruptShellReload } from '../src/weaponReload';
import { createWeaponAssembly, disposeWeaponObject } from '../src/weaponModels';
import { createTacticalNavigation, traversalBlocked } from '../src/tacticalNavigation';
import { createWorld } from '../src/world';
import { updateClassCombatBot, createClassAIState, updateTripods, clearCombatSystems, reviveDownedBot } from '../src/gameLoop';
import { disposeBotTextureCache, disposeBotVisuals } from '../src/botBuilder';
import { PostDeathMenu } from '../src/PostDeathMenu';
import type { WeaponSlotState, Bot, ClassId } from '../src/types';
import type { CombatSystemsContext } from '../src/gameLoop';

const context = new Proxy({}, { get: (_target, key) => String(key).includes('Gradient') ? () => ({addColorStop(){}}) : () => {} });
(globalThis as any).document = {createElement:()=>({width:256,height:256,getContext:()=>context})};
for(const id of ['ar','pistol','smg','lmg','br','sniper','railgun','rocket','grenade_launcher']) {
  const w = WEAPONS.find(w=>w.id===id)!;
  for(const ammo of [0, Math.max(0,w.mag!-2)]) {
    const ws:WeaponSlotState={ammo,reserve:100};
    assert.ok(beginWeaponReload(w,ws));
    if(['ar','pistol','smg','lmg','br'].includes(id)) assert.equal(ws.reloadSequence!.phases.some(p=>p.phase==='chamber'),ammo===0);
    const total=ammo+100; advanceWeaponReload(w,ws,100);
    assert.equal(ws.ammo,w.mag);assert.equal(ws.ammo!+ws.reserve!,total);assert.equal(ws.reloading,false);assert.equal(ws.needsChamber,false);
  }
}
const ar=WEAPONS[0], empty:WeaponSlotState={ammo:0,reserve:30};
beginWeaponReload(ar,empty);
while((empty.ammo??0)===0)advanceWeaponReload(ar,empty,.01);
assert.ok(empty.needsChamber);cancelWeaponReload(empty);assert.ok(beginWeaponReload(ar,empty));
assert.equal(empty.reloadSequence!.phases[0].phase,'chamber');advanceWeaponReload(ar,empty,10);assert.equal(empty.needsChamber,false);
const shotgun=WEAPONS.find(w=>w.id==='shotgun')!;
for(const ammo of [0,2,shotgun.mag!-1])for(const reserve of [1,20]) {
  const ws:WeaponSlotState={ammo,reserve};assert.ok(beginWeaponReload(shotgun,ws));
  const inserts=advanceWeaponReload(shotgun,ws,100),missing=Math.min(shotgun.mag!-ammo,reserve);
  assert.equal(inserts,missing);assert.equal(ws.ammo,ammo+missing);assert.equal(ws.reserve,reserve-missing);
}
const shellState:WeaponSlotState={ammo:0,reserve:20};beginWeaponReload(shotgun,shellState);
assert.equal(interruptShellReload(shotgun,shellState),false);
while(!shellState.ammo)advanceWeaponReload(shotgun,shellState,.01);
assert.equal(interruptShellReload(shotgun,shellState),true);assert.equal(shellState.ammo,1);assert.equal(shellState.reserve,19);assert.equal(shellState.reloading,false);assert.ok(shellState.boltCycleT!>0);advanceWeaponReload(shotgun,shellState,1);assert.equal(shellState.boltCycleT,0);
for(const id of ['laser','minigun']){const w=WEAPONS.find(w=>w.id===id)!,ws:WeaponSlotState={ammo:40,reserve:100,heat:80};assert.ok(beginWeaponReload(w,ws));advanceWeaponReload(w,ws,10);assert.equal(ws.heat,0);assert.equal(ws.reloading,false);}
console.log('PASS: tactical/empty phase selection, ammo conservation, resumed chambering, exact shell counts, interruption and energy vents');

const assembly=createWeaponAssembly('ar');assert.equal(assembly.parts.receiver.userData.arOptic,'ACOG');disposeWeaponObject(assembly.root);
const manager=createViewmodelManager();
for(const w of WEAPONS.filter(w=>w.type==='weapon')){
 const ws:WeaponSlotState={ammo:0,reserve:100,heat:80};assert.ok(beginWeaponReload(w,ws));
 for(let i=0;i<180;i++){advanceWeaponReload(w,ws,.05);manager.update(.05,w,ws,false,false,true,false,false,false,0,true,true);manager.root.traverse(o=>assert.ok([...o.position.toArray(),...o.quaternion.toArray()].every(Number.isFinite))); }
}
disposeBotVisuals(manager.root);
console.log('PASS: all twelve procedural reload paths keep finite transforms and AR has a dedicated optic');

const wall={minX:-1,maxX:1,minY:0,maxY:3,minZ:-2,maxZ:2,active:true};
const nav=createTacticalNavigation('training',[wall],()=>0);let position=new THREE.Vector3(-8,0,0),goal=new THREE.Vector3(8,0,0);let detour=false;
for(let i=0;i<20&&position.distanceTo(goal)>1;i++){const next=nav.target(position,goal).clone();assert.equal(traversalBlocked(position,next,[wall]),false);if(Math.abs(next.z)>2)detour=true;position.copy(next);}
assert.ok(detour);assert.ok(position.distanceTo(goal)<1);
for(const map of ['area51','shattered_wall'] as const){const scene=new THREE.Scene(),world=createWorld(scene,map);const p=new THREE.Vector3(0,map==='area51'?0:14,map==='area51'?2:0);const before=world.worldColliders.length;world.spawnDeployableCover(p,0,'blue');const c=world.worldColliders.at(-1)!;assert.equal(c.passThroughTeam,'blue');
 const from=p.clone().add(new THREE.Vector3(0,0,-1)),dest=p.clone().add(new THREE.Vector3(0,0,1));assert.equal(traversalBlocked(from,dest,[c],'blue'),false);assert.equal(traversalBlocked(from,dest,[c],'red'),true);
 const ally=from.clone(),enemy=from.clone();for(let i=0;i<15;i++){world.moveEntityWithCollision(ally,new THREE.Vector3(0,0,2),.3,p.y,p.y+1.8,.1,'blue');world.moveEntityWithCollision(enemy,new THREE.Vector3(0,0,2),.3,p.y,p.y+1.8,.1,'red');}assert.ok(ally.z>p.z+.5);assert.ok(enemy.z<p.z);
 for(let i=0;i<20;i++)world.spawnDeployableCover(p,0,'blue');assert.equal(world.worldColliders.length,before+12);
 world.clearDeployableCover!();assert.equal(world.worldColliders.length,before);world.dispose();}
console.log('PASS: graph routes around blocked corners and allied walls stay traversable on both world implementations');

function bot(id:number,role:ClassId,team='blue',x=0,z=0):Bot{return {id,team,classId:role,isZombie:false,alive:true,isVIP:false,pos:new THREE.Vector3(x,0,z),vel:new THREE.Vector3(),group:new THREE.Group(),health:100,maxHealth:100,weaponType:'ar',weaponTypeIndex:0,speed:3,fireTimer:0,preferredRange:12,deathT:20,classAI:createClassAIState()} as Bot;}
function harness(bots:Bot[]){let hits=0;const scene=new THREE.Scene();const colliders:any[]=[];const pickups:any[]=[];
 const ctx:CombatSystemsContext={scene,camera:new THREE.PerspectiveCamera(),bots,player:{pos:new THREE.Vector3(0,1.7,0),yaw:0,pitch:0,health:40,maxHealth:100,alive:true,team:'blue',applyDamage(){hits++},heal(amount){this.health=Math.min(this.maxHealth,this.health+amount);}},squadDirective:'follow_lead',focusTargetId:null,pushKillFeed(){},damageBot(b,damage){hits++;b.health-=damage;},needsAmmo:()=>true,
 world:{worldColliders:colliders,hittableObjects:[],navigationPoints:[new THREE.Vector3(0,0,0),new THREE.Vector3(0,8,-20)],sectorCenters:{1:new THREE.Vector3()},getNavigationTarget:(_from,to)=>to,getHighestSurface:(_x,_z,y)=>y,moveEntityWithCollision(p,v,_r,_f,_h,dt){p.addScaledVector(v,dt)},getSpawnPoints:()=>[{position:new THREE.Vector3(0,0,30)}],spawnDeployableCover(p){return new THREE.Group()},createGroundPickup(x,z,index,ammo){const item={group:new THREE.Group(),typeIndex:index,ammo,label:'ammo'};pickups.push(item);return item;},registerHittable(){},unregisterHittable(){}} as any};
 return {ctx,get hits(){return hits;},pickups};}
const tuning={accuracy:1,damageMultiplier:1,fireRateMultiplier:1};
const medic=bot(1,'medic'),patient=bot(2,'assault','blue',1,0),foe=bot(3,'assault','red',0,20);patient.alive=false;patient.downed=true;patient.health=0;const h=harness([medic,patient,foe]);
for(let i=0;i<61;i++)updateClassCombatBot(medic,.05,h.ctx,tuning);assert.equal(patient.alive,true);assert.equal(patient.downed,false);assert.equal(patient.revivesUsed,1);assert.equal(h.hits,0,'Medic prioritizes the revive over combat');assert.equal(reviveDownedBot(patient),false);
updateClassCombatBot(medic,1,h.ctx,tuning);assert.ok(h.ctx.player.health>40);
const support=bot(4,'support'),vip=bot(5,'assault','blue',4,0);vip.isVIP=true;const anchor=harness([support,vip,foe]);updateClassCombatBot(support,.05,anchor.ctx,tuning);assert.equal(support.classAI!.mode,'suppress');assert.equal(anchor.pickups.length,1);assert.ok(anchor.pickups[0].group.userData.ammoPack);assert.ok(foe.suppression!>0);
const recon=bot(6,'recon');const over=harness([recon,foe]);updateClassCombatBot(recon,.05,over.ctx,tuning);assert.equal(recon.classAI!.mode,'overwatch');assert.equal(recon.classAI!.destination!.y,8);
const assault=bot(7,'assault'),enemy=bot(8,'assault','red',0,20);const push=harness([assault,enemy]);updateClassCombatBot(assault,.05,push.ctx,tuning);assert.equal(assault.classAI!.mode,'push');assert.equal(assault.classAI!.grenades,1);assert.ok(assault.vel.z>0);clearCombatSystems(push.ctx.scene,push.ctx.world);
const engineer=bot(9,'engineer');const defense=harness([engineer,enemy]);updateClassCombatBot(engineer,.05,defense.ctx,tuning);assert.equal(engineer.classAI!.mode,'defend');assert.ok(engineer.tripodBuildCooldown!>0);const before=defense.hits;for(let i=0;i<20;i++)updateTripods(.1,defense.ctx);assert.ok(defense.hits>before,'Unmanned engineer turret automatically engages');clearCombatSystems(defense.ctx.scene,defense.ctx.world);assert.equal(defense.ctx.scene.children.length,0);disposeBotTextureCache();
console.log('PASS: revive priority, healing, suppression/ammo packs, reachable high ground, assault grenades and automatic engineer turret cleanup');
const markup=renderToStaticMarkup(React.createElement(PostDeathMenu,{title:'MISSION FAILED',subtitle:'Operator eliminated',kills:4,onPlayAgain(){},onLobby(){}}));assert.match(markup,/role="dialog"/);assert.match(markup,/\[ PLAY AGAIN \]/);assert.match(markup,/\[ RETURN TO LOBBY \]/);assert.equal((markup.match(/<button/g)??[]).length,2);
console.log('PASS: accessible centered post-death dialog exposes exactly two match actions');
