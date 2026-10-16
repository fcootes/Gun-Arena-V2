import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve(process.env.SHOTGUN_SWITCH_OUTPUT??'performance-results/shotgun-switch');mkdirSync(output,{recursive:true});
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:3104,strictPort:true},plugins:[{name:'shotgun-switch-probe',enforce:'pre',transform(code,id){
 if(!id.endsWith('/src/App.tsx'))return;
 const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
 return code.replace(needle,`window.__shotgunSwitch={get state(){return gameStateRef.current;},get weapon(){return currentSlot();},get ws(){return currentSlotState();},get primary(){return playerWeaponState[0];},manager:vmManager,
 equip(ammo=6){const w=WEAPONS.find(w=>w.id==='shotgun');playerLoadout[0]=w;playerWeaponState[0]={ammo,reserve:36};switchSlot(0);vmManager.resetEffects();}
 };\n${needle}`);
}}]});
let browser;const errors=[],samples=[];
const deadline=setTimeout(()=>{console.error('FAIL: shotgun switch probe exceeded 180 seconds');void browser?.close();void server.close();process.exitCode=1;},180000);
try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.BENCHMARK_BROWSER??'/usr/bin/chromium',args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded switch probe'));window.addEventListener('keydown',e=>{const g=window.__shotgunSwitch;if(e.code==='Digit2'&&g?.weapon.id==='shotgun')g.beforeAway={...g.ws};});});
 await page.goto('http://127.0.0.1:3104');
 await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
 await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
 await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
 await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();await page.waitForFunction(()=>window.__shotgunSwitch?.state==='playing');
 await page.evaluate(()=>window.__shotgunSwitch.equip());
 async function sample(name){samples.push(await page.evaluate(name=>{const g=window.__shotgunSwitch;return {name,id:g.weapon.id,active:{...g.ws},primary:{...g.primary}};},name));await page.screenshot({path:resolve(output,name+'.png')});}
 await page.mouse.move(600,340);await page.mouse.click(600,340);await page.waitForFunction(()=>!!window.__shotgunSwitch.ws.shotgunCycle);await sample('switch-pump-before');
 await page.keyboard.press('2');await page.waitForFunction(()=>window.__shotgunSwitch.weapon.id==='pistol');await sample('switch-pump-away');
 const pumpCancelled=await page.evaluate(()=>window.__shotgunSwitch.primary);assert.equal(pumpCancelled.shotgunCycle,undefined);assert.equal(pumpCancelled.pendingReloadShot,false);assert.equal(pumpCancelled.needsChamber,true);assert.equal(pumpCancelled.ammo,5);
 await page.keyboard.press('1');await sample('switch-pump-return');await page.keyboard.press('r');await page.waitForFunction(()=>!window.__shotgunSwitch.ws.reloading);assert.equal(await page.evaluate(()=>window.__shotgunSwitch.ws.needsChamber),false);
 await page.evaluate(()=>window.__shotgunSwitch.equip(2));
 await page.keyboard.press('r');await page.waitForFunction(()=>{const q=window.__shotgunSwitch.ws.reloadSequence;return q?.phases[q.index].phase==='insert'&&q.elapsed>.15;});await sample('switch-reload-before');
 await page.keyboard.press('2');await sample('switch-reload-away');
 const cancelled=await page.evaluate(()=>window.__shotgunSwitch.primary);assert.equal(cancelled.reloading,false);assert.equal(cancelled.reloadSequence,undefined);assert.equal(cancelled.pendingReloadShot,false);const beforeAway=await page.evaluate(()=>window.__shotgunSwitch.beforeAway);assert.equal(beforeAway.reloading,true);assert.equal(cancelled.ammo,beforeAway.ammo);assert.equal(cancelled.reserve,beforeAway.reserve);assert.equal(cancelled.ammo+cancelled.reserve,38);
 await page.keyboard.press('1');await sample('switch-reload-return');await page.mouse.click(600,340);await page.waitForFunction(ammo=>window.__shotgunSwitch.ws.ammo===ammo-1,cancelled.ammo);await sample('switch-return-fire');
 assert.equal(await page.evaluate(()=>window.__shotgunSwitch.ws.reserve),cancelled.reserve);
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'results.json'),JSON.stringify({completedAt:new Date().toISOString(),samples,errors,passed:['actual input switch during pump cancels cycle and pending trigger; chamber-only return','actual key-event snapshot proves switch during shell reload cancels with exactly the already-seated ammo retained','returning can fire once and keeps reserve']},null,2)+'\n');console.log('PASS: actual shotgun pump/reload switching, chamber-only return, cancellation, ammo conservation and return fire');
}finally{clearTimeout(deadline);await browser?.close();await server.close();}
