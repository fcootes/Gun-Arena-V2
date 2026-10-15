import { readFileSync } from 'node:fs';
import ts from 'typescript';

// One fixture executes the committed App handlers in Node and in a real browser.
// Only renderer/world/audio boundaries are replaced; input logic is never copied.
export function controlHarnessSource() {
  const text = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('App.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(['gameplayControlsActive', 'updateHeldControls', 'clearGameplayInput', 'stopMatchInput',
    'pauseHandler', 'resumeHandler', 'restartHandler', 'lobbyHandler', 'triggerGameOver',
    'onKeyDown', 'onKeyUp', 'onMouseDown', 'onMouseUp', 'onMouseMove', 'onWheel',
    'onPointerLockChange', 'onContextMenu', 'onBlur', 'onVisibilityChange']);
  const declarations = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) declarations.push(node.getText(ast));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.has(node.name.text))
      declarations.push(`const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const start = text.indexOf('        // 1. Player movement & physics');
  const end = text.indexOf('          const bobY', start);
  const movement = text.slice(start, end);
  return ts.transpile(`(function({THREE, GameplayInput, KEY_ACTIONS, MOUSE_BUTTONS, cancelWeaponReload, cancelShotgunCycle}) {
    const noop = () => {};
    const sound = {stop: noop, play: noop};
    const AUDIO = Object.fromEntries(['arSpray','lmgAuto','smgAuto','laserBeam','minigunFire','minigunWindup','railgunCharge','sniperReload','bulletHit','brBurst'].map(id=>[id,sound]));
    const input = new GameplayInput(), keys = input.keys;
    const player = {alive:true, onGround:true, vel:new THREE.Vector3(), pos:new THREE.Vector3(0,1.65,0),
      yaw:0,pitch:0,crouching:false,sprinting:false,aiming:false,fireHeld:false,isMeleeing:false,isDrinking:false,
      slotIndex:0,team:'blue',classSpeedMultiplier:1,health:100,shield:100,kills:0,shotsFired:0,shotsHit:0,headshots:0,damageDealt:0};
    const gameStateRef = {current:'playing'}, counters = {melee:0,fire:0,reload:0,grenade:0,deploy:0,collisions:0,generation:0,audioStops:0};
    let thirdPerson=false, pointerWasLocked=false, pendingDeployment=null;
    let recoilKick=0,recoilPitch=0,bobPhase=0,currentWave=1,zombiesRemaining=0,playerPoints=0,teamScoreBlue=0,teamScoreRed=0;
    const playerLoadout=[{id:'ar',type:'weapon'},{id:'pistol',type:'weapon'},{id:'grenade',type:'grenade'},{id:'medkit',type:'consumable'}];
    const ws={reloading:false,charging:false,chargeTimer:0,spinWarmup:0};
    const playerWeaponState=[ws, {}, {}, {}];
    const currentSlot=()=>playerLoadout[player.slotIndex], currentSlotState=()=>ws;
    const switchSlot=index=>{player.slotIndex=index;};
    const reloadWeapon=()=>{counters.reload++; ws.reloading=true;};
    const throwGrenade=()=>{counters.grenade++;};
    const fireWeapon=()=>{counters.fire++;};
    const vmManager={triggerKnifeSlash:()=>counters.melee++,setRailgunChargeProgress:noop};
    const world={hittableObjects:[], moveEntityWithCollision(pos,vel,radius,foot,head,dt,team){
      counters.collisions++; counters.collisionArgs={radius,foot,head,team};pos.x+=vel.x*dt;pos.z+=vel.z*dt;
    },getHighestSurface:()=>0};
    const renderer={domElement:document.querySelector('canvas')};
    const camera=new THREE.PerspectiveCamera();camera.updateMatrixWorld();
    const sensitivityValRef={current:11}, squadDirectiveRef={current:'follow_lead'}, targetingPhaseRef={current:false}, focusTargetIDRef={current:null};
    const radarPingsRef={current:[]}, containerRef={current:null}, laserBeamMesh={visible:false},railgunAimLaserMesh={visible:false};
    const matchConfig={mode:'extraction',faction:'usmc'},storm={elapsed:0,radius:70};
    const PLAYER_EYE=1.65,PLAYER_EYE_CROUCH=1,PLAYER_RADIUS=.42,WALK_SPEED=5.2,SPRINT_SPEED=8.6,CROUCH_SPEED=2.6,JUMP_SPEED=7.2,GRAVITY=-22;
    const setGameState=state=>{gameStateRef.current=state;};
    const requestGamePointerLock=()=>{try{renderer.domElement.requestPointerLock?.()?.catch(noop);}catch{}};
    const runDeployment=()=>{counters.deploy++;gameStateRef.current='loading';};
    const setEngineGeneration=update=>{counters.generation=update(counters.generation);};
    const setSquadDirective=noop,setSquadDirectiveBanner=noop,setTargetingPhase=noop,pushKillFeed=noop;
    const setStats=noop,setEndResult=noop,setMatchRewards=noop,setActiveTab=noop,setExtractionState=noop;
    const stopWeaponAudio=()=>counters.audioStops++,updateRailgunWeaponAudio=noop,updateAdrenalineHeartbeat=noop,releaseMinigunAudio=noop;
    const playKnifeSlashWhoosh=noop,spawnImpactSpark=noop,damageBot=noop,flashHit=noop,showHitmarker=noop,showBloodSplatter=noop,addPoints=noop;
    const getCareerLedger=()=>({totalShots:0,totalHits:0,totalHeadshots:0}),calculateMatchRewards=()=>({breakdown:{}});
    const audioManager={stop:noop};
    ${declarations.join('\n')}
    function movement(dt=.016) { updateHeldControls(); ${movement} } }
    return {input,player,playerLoadout,world,ws,counters,gameStateRef,squadDirectiveRef,targetingPhaseRef,focusTargetIDRef,
      renderer,camera,movement,updateHeldControls,clearGameplayInput,stopMatchInput,triggerGameOver,
      pauseHandler,resumeHandler,restartHandler,lobbyHandler,onKeyDown,onKeyUp,onMouseDown,onMouseUp,onMouseMove,onWheel,onPointerLockChange,onContextMenu,onBlur,onVisibilityChange,
      perspective:()=>thirdPerson};
  })`, {target:ts.ScriptTarget.ES2022});
}
