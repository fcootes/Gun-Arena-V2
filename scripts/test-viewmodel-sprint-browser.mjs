import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve(process.env.VIEWMODEL_SPRINT_OUTPUT??'performance-results/viewmodel-sprint');mkdirSync(output,{recursive:true});
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:3101,strictPort:true},plugins:[{name:'sprint-test-hook',enforce:'pre',transform(code,id){
 if(!id.endsWith('/src/App.tsx'))return;
 const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
 return code.replace(needle,`window.__sprintProbe={get state(){return gameStateRef.current;},player,manager:vmManager,get ws(){return currentSlotState();}};\n${needle}`);
}}]});
let browser;const errors=[],samples=[];
const deadline=setTimeout(()=>{console.error('FAIL: live sprint probe exceeded 150s');void browser?.close();void server.close();process.exitCode=1;},150000);
try{
 await server.listen();browser=await chromium.launch({headless:true,...(process.env.BENCHMARK_BROWSER?{executablePath:process.env.BENCHMARK_BROWSER}:{}),args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(40000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded controls probe'));});
 await page.goto('http://127.0.0.1:3101');
 await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
 await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
 await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
 await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
 await page.waitForFunction(()=>window.__sprintProbe?.state==='playing',null,{timeout:60000});
 async function sample(name){samples.push(await page.evaluate(name=>{const g=window.__sprintProbe,m=g.manager.root.getObjectByName('Weapon_ar');return{name,sprinting:g.player.sprinting,aiming:g.player.aiming,position:m.position.toArray(),rotation:m.rotation.toArray().slice(0,3),hand:g.manager.root.getObjectByName('leftHand').position.toArray(),ammo:g.ws.ammo,reloading:!!g.ws.reloading};},name));await page.screenshot({path:resolve(output,name+'.png')});}
 await sample('ready');await page.keyboard.down('w');await page.keyboard.down('Shift');
 await page.waitForFunction(()=>{const g=window.__sprintProbe,m=g.manager.root.getObjectByName('Weapon_ar');return g.player.sprinting&&m.position.x>.19&&m.position.y<-.255&&m.rotation.y<-.65&&m.rotation.x<0;});
 await sample('straight-sprint');await page.keyboard.up('w');await page.keyboard.down('d');
 await page.waitForFunction(()=>window.__sprintProbe.player.sprinting);await sample('direction-change-sprint');
 await page.keyboard.up('d');await page.keyboard.up('Shift');await page.mouse.down({button:'right'});
 await page.waitForFunction(()=>{const g=window.__sprintProbe,m=g.manager.root.getObjectByName('Weapon_ar');return g.player.aiming&&!g.player.sprinting&&Math.abs(m.position.x)<.005&&Math.abs(m.position.y+.145)<.005;});
 await sample('stop-immediate-ads');await page.mouse.up({button:'right'});
 for(const s of samples){assert.equal(s.ammo,30);assert.equal(s.reloading,false);assert.ok(Math.abs(s.hand[0]+.036)<.001&&Math.abs(s.hand[2]+.24)<.001,'Support remains attached through live direction changes');}
 await page.keyboard.press('p');const frozen=await page.evaluate(()=>window.__sprintProbe.manager.root.getObjectByName('Weapon_ar').matrix.toArray());await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>window.__sprintProbe.manager.root.getObjectByName('Weapon_ar').matrix.toArray()),frozen);await page.locator('#btn-resume').click();
 await page.keyboard.press('p');await page.locator('#btn-to-lobby-pause').click();await page.getByRole('button',{name:'DEPLOY OPERATION',exact:true}).waitFor();
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'results.json'),JSON.stringify({completedAt:new Date().toISOString(),samples,errors,note:'Actual App input/pose; no forced settle or gameplay clock advancement'},null,2)+'\n');
 console.log('PASS: real W/Shift sprint, W→D change, release→RMB ADS, stable grip, unchanged ammo/reload and pause/resume/lobby');
}finally{clearTimeout(deadline);await browser?.close();await server.close();}
