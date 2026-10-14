import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { controlHarnessSource } from '../tests/inputHarness.mjs';

// Bounded DOM regression plus one actual Training deployment/redeployment.
// Instrumentation is served only by this test's Vite plugin, never production.
const output = resolve(process.env.CONTROLS_OUTPUT ?? 'performance-results/controls-browser.json');
const server = await createServer({ logLevel: 'error', server: {host:'127.0.0.1',port:3097,strictPort:true}, plugins:[{
  name:'controls-regression', enforce:'pre',
  configureServer(server) {
    server.middlewares.use('/__controls-test', (_req,res) => {
      res.setHeader('Content-Type','text/html');res.end('<!doctype html><canvas width="600" height="400" tabindex="0"></canvas><input aria-label="Editable" />');
    });
    server.middlewares.use('/__controls-harness.js', (_req,res) => {
      res.setHeader('Content-Type','text/javascript');res.end(`export default ${controlHarnessSource()}`);
    });
  },
  transform(code,id) {
    if(!id.endsWith('/src/App.tsx'))return;
    return code.replace('    // Main Game Loop', `
      (window as any).__controlsGame = {
        snapshot: () => ({state:gameStateRef.current,aiming:player.aiming,sprinting:player.sprinting,crouching:player.crouching,
          fireHeld:player.fireHeld,onGround:player.onGround,slot:player.slotIndex,thirdPerson,isMeleeing:player.isMeleeing,
          yaw:player.yaw,x:player.pos.x,z:player.pos.z,speed:Math.hypot(player.vel.x,player.vel.z),
          keys:{...keys},dragging:input.dragging,reloading:currentSlotState().reloading}),
        kill:()=>applyDamageToPlayer(1000000,true,true,null)
      };
      // Main Game Loop`);
  }
}] });
let browser;
const deadline=setTimeout(()=>{ console.error('FAIL: controls browser exceeded 120 seconds');void browser?.close();void server.close();process.exitCode=1; },120000);
const errors=[], results=[];
try {
  await server.listen();
  browser=await chromium.launch({headless:true,timeout:10000,
    ...(process.env.BENCHMARK_BROWSER?{executablePath:process.env.BENCHMARK_BROWSER}:{}),
    args:process.env.BENCHMARK_SINGLE_PROCESS==='1'?['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
  const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3097/__controls-test');
  await page.evaluate(async()=>{
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const {GameplayInput,KEY_ACTIONS,MOUSE_BUTTONS}=await import('/src/gameplayInput.ts');
    const {default:create}=await import('/__controls-harness.js');
    const h=create({THREE,GameplayInput,KEY_ACTIONS,MOUSE_BUTTONS});window.fixture=h;
    for(const event of ['keydown','keyup','mouseup','blur'])window.addEventListener(event,h[{keydown:'onKeyDown',keyup:'onKeyUp',mouseup:'onMouseUp',blur:'onBlur'}[event]]);
    for(const event of ['mousedown','wheel','contextmenu'])h.renderer.domElement.addEventListener(event,h[{mousedown:'onMouseDown',wheel:'onWheel',contextmenu:'onContextMenu'}[event]]);
    document.addEventListener('mousemove',h.onMouseMove);document.addEventListener('pointerlockchange',h.onPointerLockChange);
    // Model sandboxed iframe rejection without changing production fallback.
    h.renderer.domElement.requestPointerLock=()=>Promise.reject(new Error('sandbox fixture'));
  });
  const fixture=async()=>page.evaluate(()=>({aiming:fixture.player.aiming,sprinting:fixture.player.sprinting,fireHeld:fixture.player.fireHeld,
    crouching:fixture.player.crouching,dragging:fixture.input.dragging,yaw:fixture.player.yaw,perspective:fixture.perspective(),melee:fixture.counters.melee,state:fixture.gameStateRef.current}));
  await page.keyboard.press('f');assert.equal((await fixture()).melee,1);assert.equal((await fixture()).perspective,false);
  await page.evaluate(()=>fixture.player.isMeleeing=false);
  await page.keyboard.press('v');assert.equal((await fixture()).perspective,true);assert.equal((await fixture()).melee,1);
  await page.keyboard.down('w');await page.keyboard.down('ShiftLeft');assert.equal((await fixture()).sprinting,true);
  await page.mouse.move(300,180);await page.mouse.down({button:'right'});assert.equal((await fixture()).aiming,true);assert.equal((await fixture()).sprinting,false);
  await page.mouse.move(320,190);assert.notEqual((await fixture()).yaw,0,'Rejected lock drag changes camera');
  await page.mouse.down();await page.mouse.up();assert.equal((await fixture()).aiming,true);assert.equal((await fixture()).dragging,true);
  await page.mouse.up({button:'right'});assert.equal((await fixture()).sprinting,true);
  await page.keyboard.press('p');assert.equal((await fixture()).state,'paused');assert.equal((await fixture()).sprinting,false);
  await page.keyboard.press('p');assert.equal((await fixture()).state,'playing');assert.equal((await fixture()).sprinting,false);
  await page.keyboard.up('w');await page.keyboard.up('ShiftLeft');
  await page.getByRole('textbox',{name:'Editable'}).fill('vf');assert.equal((await fixture()).perspective,true);
  await page.locator('canvas').focus();
  assert.equal(await page.evaluate(()=>!fixture.renderer.domElement.dispatchEvent(new MouseEvent('contextmenu',{cancelable:true,bubbles:true}))),true);
  await page.mouse.move(300,180);await page.mouse.down({button:'right'});await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await fixture()).aiming,false);await page.mouse.up({button:'right'});
  results.push('DOM events: F/V, RMB ADS, grounded Shift, multi-button release, sandbox drag, pause/resume, editable guard, context menu and blur');
  console.log('PASS: real browser DOM control fixture');

  // Actual App uses rejected pointer lock to exercise its embedded-browser path.
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(new Error('sandbox fixture'));});
  await page.goto('http://127.0.0.1:3097');
  await page.getByRole('button',{name:'BATTALION',exact:true}).click();
  await page.getByRole('slider',{name:'Battalion size'}).press('Home');
  await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();
  await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();
  await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
  await page.locator('input[type="range"][min="1"][max="20"]').press('Home');
  console.log('CHECK: Training, standard protocol, zero allies, one hostile (valid lobby settings)');
  await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
  try { await page.waitForFunction(()=>window.__controlsGame?.snapshot().state==='playing',{},{timeout:45000}); }
  catch(error) {
    console.error('App readiness diagnostic', await page.evaluate(()=>({snapshot:window.__controlsGame?.snapshot(),body:document.body.innerText.slice(-1500)})),errors);
    throw error;
  }
  console.log('PASS: actual App reached playing');
  const snap=()=>page.evaluate(()=>window.__controlsGame.snapshot());
  await page.waitForFunction(()=>window.__controlsGame.snapshot().onGround);
  await page.keyboard.down('w');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>{const s=window.__controlsGame.snapshot();return s.sprinting && s.speed>5.2;});
  assert.ok((await snap()).speed>5.2,'Actual movement uses sprint speed');
  await page.mouse.move(500,250);await page.mouse.down({button:'right'});
  assert.equal((await snap()).aiming,true);assert.equal((await snap()).sprinting,false);
  await page.mouse.up({button:'right'});assert.equal((await snap()).aiming,false);assert.equal((await snap()).sprinting,true);
  await page.keyboard.up('w');await page.keyboard.up('ShiftLeft');
  await page.keyboard.press('v');assert.equal((await snap()).thirdPerson,true);assert.equal((await snap()).isMeleeing,false);
  await page.keyboard.press('f');assert.equal((await snap()).thirdPerson,true);
  await page.keyboard.press('2');assert.equal((await snap()).slot,1);
  await page.keyboard.press('1');await page.mouse.down();await page.mouse.up();
  await page.keyboard.press('r');assert.equal((await snap()).reloading,true);
  await page.keyboard.down('w');await page.keyboard.down('ShiftLeft');await page.keyboard.press('p');
  assert.equal((await snap()).state,'paused');assert.equal((await snap()).fireHeld,false);assert.equal((await snap()).sprinting,false);
  await page.getByRole('slider').focus();
  await page.keyboard.press('p');assert.equal((await snap()).state,'playing');
  await page.keyboard.press('p');assert.equal((await snap()).state,'paused');
  await page.getByTestId('controls-guide').locator('summary').click();
  assert.match(await page.getByTestId('controls-guide').innerText(),/HOLD RIGHT MOUSE/);
  await page.locator('#btn-resume').click();assert.equal((await snap()).sprinting,false);assert.equal((await snap()).reloading,true,'Pause preserves active reload');
  await page.keyboard.up('w');await page.keyboard.up('ShiftLeft');
  await page.evaluate(()=>window.__controlsGame.kill());
  await page.getByRole('button',{name:'[ PLAY AGAIN ]',exact:true}).waitFor();
  assert.equal((await snap()).fireHeld,false);assert.equal((await snap()).aiming,false);
  await page.getByRole('button',{name:'[ PLAY AGAIN ]',exact:true}).click();
  await page.waitForFunction(()=>window.__controlsGame.snapshot().state==='playing',{},{timeout:45000});
  assert.ok(Object.values((await snap()).keys).every(v=>!v));assert.equal((await snap()).sprinting,false);
  await page.getByRole('button',{name:/PAUSE/}).first().click();assert.equal((await snap()).state,'paused');
  await page.locator('#btn-to-lobby-pause').click();
  await page.getByRole('button',{name:'DEPLOY OPERATION',exact:true}).waitFor();
  assert.equal((await snap()).state,'start');assert.equal((await snap()).dragging,false);
  results.push('Actual App/Training: deployment, sprint speed, ADS priority, F/V, slots, firing/reload, keyboard and button pause, guide, death, redeployment and fresh lobby');
  console.log('PASS: actual App deployment and lifecycle');
  assert.deepEqual(errors,[]);
  mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({browser:browser.version(),viewport:{width:960,height:540},results,errors,scope:'Bounded controls checks; no performance benchmark or native hardware acceptance'},null,2)+'\n');
} finally {clearTimeout(deadline);await browser?.close();await server.close();}
