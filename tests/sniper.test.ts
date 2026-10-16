import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {WEAPONS,createViewmodelManager} from '../src/weapons';
import {beginWeaponReload,advanceWeaponReload,cancelWeaponReload} from '../src/weaponReload';
import {SNIPER,beginSniperCycle,requireSniperBolt,sniperBoltSlide,sniperBoltRoll,sniperHandReach} from '../src/sniperMechanics';
import {canPlayerFire} from '../src/gameplayInput';
import {VIEWMODEL_GRIPS} from '../src/viewmodelGrips';
import type {WeaponSlotState} from '../src/types';
const gun=WEAPONS.find(w=>w.id==='sniper')!;
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const hz of [30,60,144]) {
 const ws:WeaponSlotState={ammo:4,reserve:20}; requireSniperBolt(ws);
 advanceWeaponReload(gun,ws,10);
 assert.ok(ws.needsChamber);assert.equal(ws.sniperCycle,undefined);
 assert.ok(beginSniperCycle(ws));assert.equal(beginSniperCycle(ws),false);
 assert.equal(beginWeaponReload(gun,ws),false);
 const cues:number[]=[];let t=0;
 while(ws.sniperCycle){t+=1/hz;advanceWeaponReload(gun,ws,1/hz,undefined,undefined,(_duration,late)=>cues.push(t-late));}
 assert.equal(cues.length,1);near(cues[0],SNIPER.reach);
 assert.equal(ws.needsChamber,false);near(ws.boltCycleT!,0);assert.equal(ws.ammo,4);assert.equal(ws.reserve,20);
 assert.ok(t<=SNIPER.cycle+1/hz+1e-8);
}
for(const ammo of [0,1,4]) for(const speed of [1,.75,.9]) {
 const ws:WeaponSlotState={ammo,reserve:3};const total=ammo+3;
 assert.ok(beginWeaponReload(gun,ws,speed));assert.equal(beginSniperCycle(ws),false);
 assert.equal(ws.reloadSequence!.phases.some(p=>p.phase==='chamber'),false);
 while(ws.reloading){advanceWeaponReload(gun,ws,1/144);assert.equal(ws.ammo!+ws.reserve!,total);}
 assert.equal(ws.ammo,Math.min(5,total));assert.equal(ws.needsChamber,ammo===0);
 if(!ammo){assert.ok(beginSniperCycle(ws));advanceWeaponReload(gun,ws,10);assert.equal(ws.needsChamber,false);}
}
for(const time of [.05,.3,.6,.94,1.1]) {
 const ws:WeaponSlotState={ammo:3,reserve:20};requireSniperBolt(ws);beginSniperCycle(ws);advanceWeaponReload(gun,ws,time);
 if(ws.sniperCycle?.soundStarted)ws.sniperCycle.resumeSound=true;
 let cues=0;advanceWeaponReload(gun,ws,.001,undefined,undefined,()=>cues++);
 assert.equal(cues,time>=.16&&time<1.01?1:0);
 advanceWeaponReload(gun,ws,5);assert.equal(ws.needsChamber,false);assert.equal(ws.ammo,3);
}
for(const fraction of [.2,.6,.95]) {
 const ws:WeaponSlotState={ammo:0,reserve:10};beginWeaponReload(gun,ws);advanceWeaponReload(gun,ws,ws.totalReloadT!*fraction);
 const total=ws.ammo!+ws.reserve!;cancelWeaponReload(ws);advanceWeaponReload(gun,ws,10);
 assert.equal(ws.ammo!+ws.reserve!,total);assert.ok(ws.needsChamber);
}
const empty:WeaponSlotState={ammo:0,reserve:0,needsChamber:true};assert.equal(beginSniperCycle(empty),false);assert.equal(beginWeaponReload(gun,empty),false);
const bot:WeaponSlotState={ammo:0,reserve:20};beginWeaponReload(gun,bot,1,false);near(bot.totalReloadT!,2.97);advanceWeaponReload(gun,bot,10);assert.equal(bot.needsChamber,false);
console.log('PASS: manual-only bolt, spam lockout, 30/60/144 Hz event boundaries, conserved tactical/empty reloads, interrupts and unchanged bot reload');

// Execute the actual App trigger functions, including launchers and direct heavy
// fire entry points. Every gun must return before ammo, audio or damage changes.
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=new Map<string,string>();
function visit(node:ts.Node){if(ts.isFunctionDeclaration(node)&&node.name&&['fireWeapon','fireMinigunBullet','fireRailgunSlug'].includes(node.name.text))functions.set(node.name.text,node.getText(ast));ts.forEachChild(node,visit);}visit(ast);
for(const w of WEAPONS.filter(w=>w.type==='weapon')) {
 const state={ammo:w.mag,reserve:w.reserve,chargeTimer:1.19,burstRemaining:2,spinWarmup:.5};const before=JSON.stringify(state);
 const context={world:{},currentSlot:()=>w,currentSlotState:()=>state,player:{alive:true,sprinting:true,isMeleeing:false,isDrinking:false},canPlayerFire};
 for(const name of ['fireWeapon','fireMinigunBullet','fireRailgunSlug'])vm.runInNewContext(ts.transpile(functions.get(name)!+`;${name}();`),context);
 assert.equal(JSON.stringify(state),before,w.id);
}
assert.equal(canPlayerFire({alive:true,sprinting:false,isMeleeing:false,isDrinking:false}),true);
console.log('PASS: actual trigger/launcher/heavy-fire functions block all twelve weapons while sprinting');

const manager=createViewmodelManager();
function step(ws:WeaponSlotState,dt=0){manager.update(dt,gun,ws,false,false,true,false,false,false,0,true,true);manager.root.updateMatrixWorld(true);}
const ws:WeaponSlotState={ammo:4,reserve:20};step(ws);
const model=manager.root.getObjectByName('Weapon_sniper')!,bolt=model.getObjectByName('bolt')!,hand=model.getObjectByName('leftHand')!;
const start=hand.position.clone(),boltStart=bolt.position.clone(),q=bolt.quaternion.clone();
const knob=model.getObjectByName('boltKnob')!;
assert.ok(knob);const point=new THREE.Vector3(),target=new THREE.Vector3(),inv=new THREE.Matrix4();
let maxRear=0;
for(let repeat=0;repeat<5;repeat++) {
 requireSniperBolt(ws);ws.sniperRecoveryT=0;assert.ok(beginSniperCycle(ws));
 for(let i=0;i<Math.ceil(144*SNIPER.cycle);i++) {
  advanceWeaponReload(gun,ws,1/144);step(ws,1/144);
  maxRear=Math.max(maxRear,bolt.position.z);assert.ok(bolt.position.z<.05,'Bolt never reaches stock boundary at +.13');
  const t=ws.sniperCycle?.elapsed;
  if(t!==undefined&&sniperHandReach(t)>.999999) {
   inv.copy(model.matrixWorld).invert();bolt.updateWorldMatrix(true,false);
   target.fromArray(VIEWMODEL_GRIPS.sniper.chamber!.partOffset!).applyMatrix4(bolt.matrixWorld).applyMatrix4(inv);
   assert.ok(target.distanceTo(hand.position)<1e-7,'Wrist follows moving/rotating control with no lag');
   knob.getWorldPosition(point);target.copy(hand.position).applyMatrix4(model.matrixWorld);
   assert.ok(point.distanceTo(target)<.065,'Compact grip surrounds actual receiver knob');
  }
  assert.ok((model.getObjectByName('leftForearm') as THREE.Mesh).scale.y<=.262001);
 }
 step(ws);assert.ok(hand.position.distanceTo(start)<1e-7);assert.ok(bolt.position.distanceTo(boltStart)<1e-7);assert.ok(bolt.quaternion.angleTo(q)<1e-7);
}
near(maxRear,boltStart.z+SNIPER.stroke);near(sniperBoltSlide(0),0);near(sniperBoltSlide(SNIPER.cycle),0);near(sniperBoltRoll(SNIPER.cycle),0);
manager.dispose();
console.log('PASS: bounded receiver slide/pivot, exact articulated hand attachment, short sleeve and five cycles without transform accumulation');
