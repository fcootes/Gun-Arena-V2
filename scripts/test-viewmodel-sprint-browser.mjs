import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve(process.env.VIEWMODEL_SPRINT_OUTPUT??'performance-results/viewmodel-sprint');mkdirSync(output,{recursive:true});rmSync(resolve(output,'results.json'),{force:true});
const baseline=process.env.SPRINT_BASELINE==='1';
const server=await createServer({root:process.env.SPRINT_ROOT,logLevel:'error',server:{host:'127.0.0.1',port:3101,strictPort:true},plugins:[{name:'sprint-test-hook',enforce:'pre',transform(code,id){
 if(!id.endsWith('/src/App.tsx'))return;
 const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
 return code.replace(needle,`window.__sprintProbe={get state(){return gameStateRef.current;},player,manager:vmManager,camera,get weapon(){return currentSlot();},get ws(){return currentSlotState();},
 equip(id){const w=WEAPONS.find(w=>w.id===id);playerLoadout[0]=w;playerWeaponState[0]={ammo:w.mag,reserve:w.reserve};switchSlot(0);},
 sample(name){const w=currentSlot(),m=vmManager.root.getObjectByName('Weapon_'+w.id),b=m.getWorldPosition(new THREE.Vector3()).project(camera),u=m.getObjectByName('muzzle').getWorldPosition(new THREE.Vector3()).project(camera);return {name,id:w.id,sprinting:player.sprinting,aiming:player.aiming,yaw:player.yaw,position:m.position.toArray(),rotation:m.rotation.toArray().slice(0,3),breechNdc:b.toArray(),muzzleNdc:u.toArray(),hand:vmManager.root.getObjectByName('leftHand').position.toArray(),ammo:currentSlotState().ammo,reloading:!!currentSlotState().reloading};}
 };\n${needle}`);
}}]});
let browser;const errors=[],samples=[];
const deadline=setTimeout(()=>{console.error('FAIL: live sprint probe exceeded 240s');void browser?.close();void server.close();process.exitCode=1;},240000);
try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.BENCHMARK_BROWSER??'/usr/bin/chromium',args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=160016;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded controls probe'));});
 await page.goto('http://127.0.0.1:3101');
 await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
 await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
 await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
 await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
 await page.waitForFunction(()=>window.__sprintProbe?.state==='playing');
 async function sample(name){const s=await page.evaluate(name=>window.__sprintProbe.sample(name),name);samples.push(s);await page.screenshot({path:resolve(output,name+'.png')});return s;}
 async function carry(){await page.waitForFunction(baseline=>{const g=window.__sprintProbe,m=g.manager.root.getObjectByName('Weapon_'+g.weapon.id);if(!m)return false;const yaw=g.weapon.id==='ar'?(baseline?.80:.68):g.weapon.id==='pistol'?.30:.28;return g.player.sprinting&&Math.abs(m.rotation.y)>yaw&&(baseline?m.position.x>.18:m.position.x<-.015);},baseline);}
 await sample('ready');await page.keyboard.down('w');await page.keyboard.down('Shift');await carry();await sample('straight-sprint');
 await page.keyboard.up('w');await page.keyboard.down('d');await carry();await sample('strafe-sprint');
 // Embedded drag-look legitimately uses held LMB. Its commanded reports are
 // allowed; no uncommanded trigger or pose/clock forcing is used.
 await page.mouse.move(600,340);await page.mouse.down();await page.mouse.move(640,350,{steps:3});await page.mouse.up();await carry();await sample('turning-sprint');
 await page.keyboard.up('Shift');await page.waitForFunction(()=>!window.__sprintProbe.player.sprinting);await sample('release-sprint-moving');await page.keyboard.up('d');
 await page.mouse.down({button:'right'});await page.waitForFunction(()=>{const g=window.__sprintProbe,m=g.manager.root.getObjectByName('Weapon_ar');return g.player.aiming&&!g.player.sprinting&&Math.abs(m.position.x)<.005&&Math.abs(m.position.y+.145)<.005;});await sample('stop-immediate-ads');await page.mouse.up({button:'right'});
 await page.keyboard.down('w');await page.keyboard.down('Shift');await carry();await page.keyboard.press('2');await page.waitForFunction(()=>window.__sprintProbe.weapon.id==='pistol');await carry();await sample('switch-pistol-sprint');
 await page.evaluate(()=>window.__sprintProbe.equip('minigun'));await carry();await sample('heavy-sprint');
 await page.setViewportSize({width:1680,height:720});await carry();await sample('wide-heavy-sprint');
 await page.keyboard.up('w');await page.keyboard.up('Shift');
 if(!baseline)for(const s of samples.filter(s=>s.sprinting)){assert.ok(s.breechNdc[0]<.01&&s.muzzleNdc[0]<0,s.name+': actual receiver and muzzle are screen-left');assert.equal(s.reloading,false);}
 await page.keyboard.press('p');const frozen=await page.evaluate(()=>window.__sprintProbe.manager.root.matrix.toArray());await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>window.__sprintProbe.manager.root.matrix.toArray()),frozen);await page.locator('#btn-resume').click();
 await page.keyboard.press('p');await page.locator('#btn-to-lobby-pause').click();await page.getByRole('button',{name:'DEPLOY OPERATION',exact:true}).waitFor();
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'results.json'),JSON.stringify({completedAt:new Date().toISOString(),baseline,samples,errors,note:'Actual W/Shift, strafe, drag-look (commanded AR fire), release/ADS and slot input; field-armory heavy setup; no forced pose or clock advancement'},null,2)+'\n');
 console.log('PASS: real forward/strafe/turn/release/ADS, sprint weapon switching, heavy/pistol, wide viewport and pause/lobby');
}finally{clearTimeout(deadline);await browser?.close();await server.close();}
