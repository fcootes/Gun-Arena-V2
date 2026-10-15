import {cancelWeaponReload} from '../src/weaponReload';
import {cancelShotgunCycle, beginShotgunCycle} from '../src/shotgunMechanics';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as THREE from 'three';
import { GameplayInput, KEY_ACTIONS, MOUSE_BUTTONS, CONTROLS_GUIDE } from '../src/gameplayInput';
import { controlHarnessSource } from './inputHarness.mjs';

const canvas = {};
const document = { pointerLockElement: null as unknown, hidden: false, querySelector: () => canvas, exitPointerLock() { this.pointerLockElement = null; } };
const create = vm.runInNewContext(controlHarnessSource(), { document, HTMLElement: class {}, THREE, console });
const deps = { THREE, GameplayInput, KEY_ACTIONS, MOUSE_BUTTONS, cancelWeaponReload, cancelShotgunCycle };
const key = (h: any, code: string, repeat = false) => h.onKeyDown({ code, repeat, preventDefault() {} });
const release = (h: any, code: string) => h.onKeyUp({ code });
const press = (h: any, code: string) => { key(h, code); release(h, code); };
const mouse = (h: any, button: number) => h.onMouseDown({ button, preventDefault() {} });
const staleFree = (h: any) => {
  for (const name of ['aiming','sprinting','fireHeld','crouching']) assert.equal(h.player[name], false, name);
  assert.ok(Object.values(h.input.keys).every(v => !v)); assert.equal(h.input.dragging, false);
  assert.equal(h.ws.charging, false); assert.equal(h.ws.chargeTimer, 0); assert.equal(h.ws.spinWarmup, 0);
};
assert.equal(new Set(Object.values(KEY_ACTIONS)).size, Object.keys(KEY_ACTIONS).length - 1, 'Only pause has two alternative keys');
assert.equal(KEY_ACTIONS.KeyF, 'melee'); assert.equal(KEY_ACTIONS.KeyV, 'perspective');
assert.equal(CONTROLS_GUIDE.length, 16);
let h = create(deps);
press(h, 'KeyF'); assert.equal(h.counters.melee, 1); assert.equal(h.perspective(), false);
h.player.isMeleeing = false;
press(h, 'KeyV'); assert.equal(h.perspective(), true); assert.equal(h.counters.melee, 1);
key(h, 'KeyV'); key(h, 'KeyV', true); assert.equal(h.perspective(), false); release(h,'KeyV');
key(h,'KeyF'); h.player.isMeleeing=false; key(h,'KeyF',true); key(h,'KeyF'); assert.equal(h.counters.melee,2);
console.log('PASS: exclusive F/V and physical/auto-repeat guards');

h=create(deps); key(h,'ShiftLeft'); assert.equal(h.player.sprinting,false);
key(h,'KeyW'); assert.equal(h.player.sprinting,true); assert.equal(h.player.aiming,false);
h.movement(); assert.equal(Math.hypot(h.player.vel.x,h.player.vel.z),8.6);
mouse(h,2); assert.equal(h.player.aiming,true); assert.equal(h.player.sprinting,false);
h.onMouseUp({button:2}); assert.equal(h.player.aiming,false); assert.equal(h.player.sprinting,true);
release(h,'ShiftLeft'); assert.equal(h.player.sprinting,false);
mouse(h,2); key(h,'ShiftLeft'); assert.equal(h.player.aiming,true); assert.equal(h.player.sprinting,false);
release(h,'ShiftLeft'); assert.equal(h.player.aiming,true); h.onMouseUp({button:2}); assert.equal(h.player.aiming,false);
key(h,'ShiftLeft'); key(h,'KeyS'); assert.equal(h.player.sprinting,false, 'Opposing movement keys cancel');
release(h,'KeyS'); key(h,'ControlLeft'); assert.equal(h.player.crouching,true); assert.equal(h.player.sprinting,false);
h.movement(); assert.equal(Math.hypot(h.player.vel.x,h.player.vel.z),2.6); release(h,'ControlLeft'); h.movement();
press(h,'Space'); assert.equal(h.player.vel.y,7.2); assert.equal(h.player.onGround,false); assert.equal(h.player.sprinting,false);
key(h,'Space',true); assert.equal(h.player.vel.y,7.2); h.movement(); assert.equal(h.player.sprinting,false);
h.player.vel.y=0;h.player.pos.y=1.65;h.player.onGround=true;h.updateHeldControls();assert.equal(h.player.sprinting,true);
release(h,'ShiftLeft'); h.movement(); assert.equal(Math.hypot(h.player.vel.x,h.player.vel.z),5.2);
h.player.classSpeedMultiplier=1.2; key(h,'ShiftLeft'); h.movement(); assert.equal(Math.hypot(h.player.vel.x,h.player.vel.z),8.6*1.2);
h.player.slotIndex=1;h.renderer.domElement=canvas;h.ws.reloading=false;
h.player.classSpeedMultiplier=.85;h.movement();assert.equal(Math.hypot(h.player.vel.x,h.player.vel.z),8.6*.85);
for (const [id,penalty] of [['minigun',.8],['railgun',.8],['lmg',.85]] as const) {
  h.playerLoadout[1].id=id; h.movement();
  assert.equal(Math.hypot(h.player.vel.x,h.player.vel.z),8.6*.85*penalty);
}
assert.deepEqual(JSON.parse(JSON.stringify(h.counters.collisionArgs)), {radius:.42,foot:0,head:1.9,team:'blue'});
console.log('PASS: RMB priority in both press orders; grounded sprint, opposite keys, crouch/jump and unchanged collision/class speed');

h=create(deps); key(h,'KeyW');key(h,'ShiftLeft');mouse(h,2);press(h,'KeyR');
assert.equal(h.ws.reloading,true);assert.equal(h.player.aiming,false);assert.equal(h.player.sprinting,false);
h.ws.reloading=false;h.updateHeldControls();assert.equal(h.player.aiming,true);h.onMouseUp({button:2});assert.equal(h.player.sprinting,true);
mouse(h,0);assert.equal(h.player.fireHeld,true);assert.equal(h.counters.fire,1);
mouse(h,2);h.onMouseUp({button:0});assert.equal(h.player.fireHeld,false);assert.equal(h.player.aiming,true);assert.equal(h.input.dragging,true);
h.onMouseUp({button:2});assert.equal(h.input.dragging,false);
key(h,'KeyG');key(h,'KeyG',true);assert.equal(h.counters.grenade,1);release(h,'KeyG');
key(h,'KeyE');assert.equal(h.input.keys.KeyE,true);h.input.keys.KeyE=false;key(h,'KeyE',true);key(h,'KeyE');assert.equal(h.input.keys.KeyE,false);
release(h,'KeyE');key(h,'KeyE');assert.equal(h.input.keys.KeyE,true);
for(const [code,directive] of [['KeyZ','hold_position'],['KeyZ','follow_lead'],['KeyC','push_objective']]){press(h,code);assert.equal(h.squadDirectiveRef.current,directive);}
key(h,'KeyZ');key(h,'KeyZ',true);assert.equal(h.squadDirectiveRef.current,'follow_lead');release(h,'KeyZ');
press(h,'KeyX');assert.equal(h.targetingPhaseRef.current,true);mouse(h,0);assert.equal(h.targetingPhaseRef.current,false);assert.equal(h.counters.fire,1);
h.onMouseUp({button:0});
const hostile = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());
hostile.position.z=-2;hostile.userData.ref={id:7,alive:true,team:'red'};hostile.updateMatrixWorld();
h.world.hittableObjects.push(hostile);press(h,'KeyX');mouse(h,0);
assert.equal(h.focusTargetIDRef.current,7);assert.equal(h.counters.fire,1);
h.onMouseUp({button:0});hostile.geometry.dispose();(hostile.material as THREE.Material).dispose();
for(let i=0;i<4;i++){press(h,`Digit${i+1}`);assert.equal(h.player.slotIndex,i);}
h.onWheel({deltaY:1,preventDefault(){}});assert.equal(h.player.slotIndex,0);
h.onWheel({deltaY:-1,preventDefault(){}});assert.equal(h.player.slotIndex,3);
console.log('PASS: reload/ADS recovery, fire holds, multi-button release, grenade, E consumable latch, squad selection and slots/wheel');

for (const cleanup of ['pauseHandler','onBlur','stopMatchInput','triggerGameOver','restartHandler','lobbyHandler']) {
  h=create(deps);key(h,'KeyW');key(h,'ShiftLeft');key(h,'ControlLeft');mouse(h,0);mouse(h,2);
  h.ws.charging=true;h.ws.chargeTimer=1;h.ws.spinWarmup=.4;
  if(cleanup==='restartHandler')h.gameStateRef.current='paused';
  h[cleanup](false);staleFree(h);
  if(cleanup==='pauseHandler'){assert.equal(h.counters.audioStops,0,'Pause preserves reload voice cursors');key(h,'KeyP',true);assert.equal(h.gameStateRef.current,'paused');h.resumeHandler();staleFree(h);assert.equal(h.gameStateRef.current,'playing');}
  if(cleanup==='restartHandler'){h.restartHandler();assert.equal(h.counters.deploy,1);assert.equal(h.gameStateRef.current,'loading');}
  if(cleanup==='lobbyHandler'){h.lobbyHandler();assert.equal(h.counters.generation,1);assert.equal(h.gameStateRef.current,'start');}
}
h=create(deps);h.ws.reloading=true;h.pauseHandler();h.resumeHandler();assert.equal(h.ws.reloading,true);assert.equal(h.counters.audioStops,0);
h=create(deps);mouse(h,2);document.hidden=true;h.onVisibilityChange();staleFree(h);document.hidden=false;
h=create(deps);mouse(h,2);h.onPointerLockChange();assert.equal(h.player.aiming,true,'Rejected lock does not break fallback');
h.onMouseMove({movementX:10,movementY:5});assert.ok(h.player.yaw<0);
document.pointerLockElement=canvas;h.onPointerLockChange();assert.equal(h.player.aiming,true);
document.pointerLockElement=null;h.onPointerLockChange();staleFree(h);assert.equal(h.gameStateRef.current,'playing');
let prevented=0;h.onContextMenu({preventDefault(){prevented++;}});assert.equal(prevented,1);
h.gameStateRef.current='start';h.onContextMenu({preventDefault(){prevented++;}});assert.equal(prevented,1);
h=create(deps);h.world.facility={controlsLocked:true};key(h,'ShiftLeft');mouse(h,2);assert.equal(h.player.sprinting,false);assert.equal(h.player.aiming,false);
h.world.facility.controlsLocked=false;h.player.alive=false;key(h,'KeyF');mouse(h,0);assert.equal(h.counters.melee+h.counters.fire,0);
console.log('PASS: pause/resume, death, restart, lobby, blur/hidden, real lock loss, rejected lock/drag fallback and locked/dead guards');

h=create(deps);h.playerLoadout[0].id='shotgun';beginShotgunCycle(h.ws);h.ws.pendingReloadShot=true;h.pauseHandler();assert.ok(h.ws.shotgunCycle);h.resumeHandler();assert.ok(h.ws.shotgunCycle);h.stopMatchInput();assert.equal(h.ws.shotgunCycle,undefined);assert.equal(h.ws.pendingReloadShot,false);assert.equal(h.ws.needsChamber,true);
console.log('PASS: pause preserves shotgun action while lobby/restart cleanup cancels queued fire without silently chambering');
