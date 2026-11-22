import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve(process.env.MINIGUN_OUTPUT??'work/minigun-carry'),baseline=process.env.MINIGUN_BASELINE==='1';mkdirSync(output,{recursive:true});
const port=Number(process.env.MINIGUN_PORT??3170),errors=[];
const server=await createServer({root:process.env.MINIGUN_ROOT,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true,hmr:false},plugins:[{name:'minigun-carry-evidence',enforce:'pre',transform(code,id){
 if(!id.endsWith('/src/App.tsx'))return;
 const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
 return code.replace(needle,`
 const minigunNativeRender=renderer.render.bind(renderer);
 window.__minigun={hold:false,renderer,scene,camera,player,manager:vmManager,
  get state(){return gameStateRef.current;},get ws(){return currentSlotState();},
  equip(){clearGameplayInput();stopWeaponAudio();cancelWeaponReload(currentSlotState());const w=WEAPONS.find(w=>w.id==='minigun');playerLoadout[0]=w;playerLoadout[1]=WEAPONS[0];playerWeaponState[0]={ammo:w.mag,reserve:w.reserve,heat:0};playerWeaponState[1]={ammo:30,reserve:90};switchSlot(0);player.classReloadMultiplier=1;player.health=player.maxHealth=100000;player.aiming=false;player.yaw=0;player.pitch=0;vmManager.resetEffects();renderer.setPixelRatio(1);renderer.setSize(960,540,false);renderer.render=()=>{};},
  stats(){const root=vmManager.root.getObjectByName('Weapon_minigun'),left=root?.getObjectByName('leftHand'),right=root?.getObjectByName('rightHand');return{pitch:player.pitch,yaw:player.yaw,position:player.pos.toArray(),velocity:player.vel.toArray(),aiming:player.aiming,sprinting:player.sprinting,shots:player.shotsFired,ammo:this.ws.ammo,reserve:this.ws.reserve,heat:this.ws.heat,warmup:this.ws.spinWarmup,spin:this.ws.spinSpeed,overheated:!!this.ws.overheated,reloading:!!this.ws.reloading,ventTimer:this.ws.ventTimer,root:root?.position.toArray(),rotation:root?.quaternion.toArray(),left:left?.position.toArray(),right:right?.position.toArray(),rotor:root?.getObjectByName('rotor')?.rotation.z,memory:{...renderer.info.memory}};},
  capture(){this.hold=true;minigunNativeRender(scene,camera);return{image:renderer.domElement.toDataURL('image/png').split(',')[1],state:this.stats()};},
  release(){this.hold=false;},
  kill(){applyDamageToPlayer(999999,true,true,null);}
 };
`+needle).replace('      const dt = Math.min(0.05, clock.getDelta());','      const dt = Math.min(0.05, clock.getDelta());\n      if(window.__minigun?.hold)return;');
 }}]});
let browser;const deadline=setTimeout(()=>{void browser?.close();void server.close();},900000);
try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|Shader|GL_INVALID|THREE/.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded input test'));window.__minigunAudio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){window.__minigunAudio.push(this.src.split('/').pop());return play.apply(this,args);};let seed=204;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(`http://127.0.0.1:${port}`);await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:process.env.MINIGUN_MAP==='area51'?/AREA 51 SUBTERRANEAN FACILITY/:/TRAINING FIELD/}).click();await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();await page.waitForFunction(()=>window.__minigun?.state==='playing');
 await page.evaluate(()=>window.__minigun.equip());await page.waitForFunction(()=>window.__minigun.manager.root.getObjectByName('Weapon_minigun')?.visible);
 const samples=[];
 const save=async name=>{const r=await page.evaluate(()=>window.__minigun.capture());writeFileSync(resolve(output,name+'.png'),Buffer.from(r.image,'base64'));samples.push({name,...r.state});await page.evaluate(()=>window.__minigun.release());console.log('Captured '+name);return r.state;};
 // Allow normal presentation settling without rendering expensive software frames.
 await page.waitForFunction(()=>{const s=window.__minigun.stats();return s.root&&Math.abs(s.root[2]+.53)<.055;});await page.waitForTimeout(400);
 await save('idle');await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__minigun.player.aiming);await page.waitForTimeout(400);await save('ads');await page.mouse.up({button:'right'});
 if(!baseline){
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>Math.hypot(window.__minigun.player.vel.x,window.__minigun.player.vel.z)>1);await page.waitForTimeout(300);await save('moving-forward');
 await page.keyboard.up('KeyW');await page.keyboard.down('KeyA');await page.waitForTimeout(120);await save('direction-change');await page.keyboard.up('KeyA');await page.waitForTimeout(500);await save('stopped');
 }
 await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.waitForFunction(()=>window.__minigun.player.sprinting);await page.waitForTimeout(100);await save('sprint-enter');await page.waitForTimeout(500);await save('sprint');await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');await page.waitForTimeout(500);await save('sprint-recovered');
 if(!baseline){
 const before=await page.evaluate(()=>window.__minigun.player.shotsFired);await page.mouse.move(850,450);await page.mouse.down();await page.waitForFunction(()=>window.__minigun.ws.spinWarmup>0&&window.__minigun.ws.spinWarmup<.5);const warm=await save('motor-warmup');assert.equal(warm.shots,before);
 await page.waitForFunction(n=>window.__minigun.player.shotsFired>=n+3,before);const firing=await save('firing');assert.ok(firing.spin>=27.9);assert.equal(firing.ammo,999);await page.mouse.up();await page.waitForFunction(()=>window.__minigun.ws.spinSpeed===0);
 // Complete actual sustained firing and the unchanged automatic thermal/reload path.
 await page.mouse.down();await page.waitForFunction(()=>window.__minigun.ws.overheated);await page.mouse.up();const hot=await save('overheat');assert.equal(hot.reloading,true);assert.equal(hot.ammo,999);await page.waitForFunction(()=>!window.__minigun.ws.overheated&&!window.__minigun.ws.reloading);const cool=await save('cooled');assert.equal(cool.heat,0);assert.equal(cool.ammo,999);assert.equal(cool.reserve,999);
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>window.__minigun.state==='paused');const frozen=await page.evaluate(()=>window.__minigun.stats());await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>window.__minigun.stats()),frozen);await page.keyboard.press('KeyP');
 await page.keyboard.press('Digit2');await page.keyboard.press('Digit1');await page.waitForFunction(()=>window.__minigun.manager.root.getObjectByName('Weapon_minigun')?.visible);await page.waitForTimeout(400);await save('re-equipped');
 const audio=await page.evaluate(()=>window.__minigunAudio);for(const asset of ['minigun_warmup','minigun_fire_auto_loop','minigun_spin_down','minigun_cooling_hiss'])assert.ok(audio.some(a=>a.includes(asset)),asset);writeFileSync(resolve(output,'audio-events.json'),JSON.stringify(audio,null,2));
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'validation.json'),JSON.stringify({baseline,map:process.env.MINIGUN_MAP==='area51'?'Area 51':'Training Field',rendering:'Actual App first-person gameplay renderer, real keyboard/mouse and native RAF mechanics; rendering suspended between explicit screenshots for software WebGL. No native-performance claim.',samples,errors},null,2));console.log('PASS actual Minigun gameplay/input/rendering');
}catch(e){console.error(e);try{const page=browser?.contexts()[0]?.pages()[0];if(page){writeFileSync(resolve(output,'failure.json'),JSON.stringify(await page.evaluate(()=>window.__minigun?.stats()),null,2));await page.screenshot({path:resolve(output,'failure.png')});}}catch{}throw e;}finally{clearTimeout(deadline);await browser?.close();await server.close();}
