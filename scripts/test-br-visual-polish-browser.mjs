import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve(process.env.BR_OUTPUT??'performance-results/br-visual-polish');mkdirSync(output,{recursive:true});
const port=Number(process.env.BR_VISUAL_PORT??3121),errors=[],screens=[],checks=[];
const server=await createServer({root:process.env.BR_MODEL_ROOT,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true},plugins:[{
 name:'br-visual-polish-probe',enforce:'pre',
 configureServer(server){server.middlewares.use('/__br-studio',async(_req,res)=>{
 res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__br-studio',`<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"><style>body{margin:0;background:#080e14}#root>[aria-label]{height:720px!important;width:1280px}</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__br-studio-fixture"></script></body></html>`));
 });},
 resolveId(id){if(id==='br-studio-fixture'||id==='\0br-studio-fixture')return '\0br-studio-fixture';},
 load(id){if(id==='\0br-studio-fixture')return `import React from 'react';import{createRoot}from'react-dom/client';import{WeaponStudio}from'/src/WeaponStudio.tsx';createRoot(document.getElementById('root')).render(React.createElement(WeaponStudio,{weaponId:'br'}));`;},
 transform(code,id){
 if(id.endsWith('/src/WeaponStudio.tsx')){
  return code.replace('    controls.maxDistance = 5;',`    controls.maxDistance = 5;
    window.__brStudio={renderer,scene,camera,weapon,controls,hold:false,
     view(angle){this.hold=true;controls.enabled=false;controls.enableDamping=false;
      weapon.rotation.set(0,-Math.PI/2,0);weapon.position.set(.125,-.0225,0);
      const eye=angle==='front'?[-.90,.52,1.18]:angle==='rear'?[.95,.48,1.20]:[0,.055,1.28];
      camera.position.set(...eye);controls.target.set(0,0,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
      renderer.info.reset();renderer.render(scene,camera);
      return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:camera.position.toArray(),optic:weapon.userData.weaponAssembly.parts.optic.position.toArray()};
     }};`).replace('      controls.update();','      if(!window.__brStudio?.hold) controls.update();');
 }

 if(!id.endsWith('/src/App.tsx'))return;
 const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
 code=code.replace(needle,`
 window.__brDef=WEAPONS.find(w=>w.id==='br');window.__brProbe={scene,hold:false,record:false,frames:[],player,renderer,camera,manager:vmManager,
 get state(){return gameStateRef.current;},get ws(){return currentSlotState();},get primary(){return playerWeaponState[0];},
 equip(ammo=20,reserve=60){stopWeaponAudio();cancelWeaponReload(currentSlotState());const w=WEAPONS.find(w=>w.id==='br');playerLoadout[0]=w;playerWeaponState[0]={ammo,reserve,lastFired:-100};switchSlot(0);player.aiming=false;vmManager.resetEffects();},
 kill(){applyDamageToPlayer(999999,true,true,null);},
 sample(){const s=currentSlotState(),q=s.reloadSequence,m=vmManager.root.getObjectByName('Weapon_br'),mag=m?.getObjectByName('magazine'),fresh=m?.getObjectByName('freshMagazine'),dir=new THREE.Vector3(0,0,-1).applyQuaternion(m?.quaternion??new THREE.Quaternion());return {at:performance.now(),id:currentSlot().id,ammo:s.ammo,reserve:s.reserve,reloading:!!s.reloading,needsChamber:!!s.needsChamber,phase:q?.phases[q.index]?.phase,elapsed:q?.elapsed,burst:s.burstRemaining??0,sprinting:player.sprinting,aiming:player.aiming,root:m?.position.toArray(),muzzleElevation:Math.asin(dir.y)*180/Math.PI,mag:mag?.position.toArray(),magVisible:mag?.visible,fresh:fresh?.position.toArray(),freshVisible:fresh?.visible,handVisible:m?.getObjectByName('FirstPersonHands')?.visible,receiverVisible:m?.getObjectByName('receiver')?.visible};},
 pose(action,t=0){this.equip(action==='empty'||action==='ready'?0:20,60);this.hold=true;const w=currentSlot(),s=currentSlotState();
 for(let n=0;n<90;n++)vmManager.update(1/60,w,s,false,false,true,false,false,false,0,true,true);
 camera.fov=HIP_FOV;camera.updateProjectionMatrix();
 if(action!=='idle')beginWeaponReload(w,s);
 for(let left=t;left>1e-8;){const dt=Math.min(1/144,left);left-=dt;advanceWeaponReload(w,s,dt);vmManager.update(dt,w,s,false,false,true,false,false,false,0,true,true);}
 setHudData(old=>({...old,currentWeapon:w,weaponSlotState:{...s},playerLoadout:[...playerLoadout],playerLoadoutStates:playerWeaponState.map(s=>({...s}))}));
 renderer.render(scene,camera);return this.sample();}
 };
${needle}`);
 const tick='      const dt = Math.min(0.05, clock.getDelta());';assert.equal(code.split(tick).length,2);
 return code.replace(tick,tick+'\n      if(window.__brProbe?.hold){renderer.render(scene,camera);return;}\n      if(window.__brProbe?.record&&window.__brProbe.frames.length<2000)window.__brProbe.frames.push(window.__brProbe.sample());');
 }}]});
let browser,video;
const deadline=setTimeout(()=>{console.error('BR smoke exceeded bounded five minute window');void browser?.close();void server.close();process.exitCode=1;},300000);
try {
  const launch=()=>chromium.launch({headless:true,executablePath:process.env.BENCHMARK_BROWSER??'/usr/bin/chromium',args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  await server.listen();browser=await launch();
  async function boot(record=false) {
  const page=await browser.newPage({viewport:{width:1280,height:720},...(record?{recordVideo:{dir:resolve(output,'raw-video'),size:{width:1280,height:720}}}:{})});if(record)video=page.video();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    let seed=47;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded acceptance probe'));
    window.__weaponAudio=[];const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(/br_/.test(this.src))window.__weaponAudio.push({at:performance.now(),src:this.src.split('/').pop(),rate:this.playbackRate,offset:this.currentTime});return play.call(this);};
  });
  await page.goto(`http://127.0.0.1:${port}`);
  await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
  await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
  await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
  await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
  await page.waitForFunction(()=>window.__brProbe?.state==='playing');
    return page;
  }



 const studio=await browser.newPage({viewport:{width:1280,height:720}});studio.setDefaultTimeout(60000);studio.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 await studio.goto(`http://127.0.0.1:${port}/__br-studio`);await studio.waitForFunction(()=>!!window.__brStudio);
 for(const [name,angle]of[['armory-side','side'],['armory-front-three-quarter','front'],['armory-rear-three-quarter','rear']]){
 const stats=await studio.evaluate(angle=>window.__brStudio.view(angle),angle);await studio.screenshot({path:resolve(output,name+'.png')});screens.push({name,...stats});}
 writeFileSync(resolve(output,'studio-validation.json'),JSON.stringify({screens,errors},null,2)+'\n');
 await browser.close();browser=await launch();
 let page=await boot();
 for(const [name,action,t]of[['first-person-hip','idle',0],['first-person-ads','ads',0],['upright-reload','reload',1.72]]){
 const sample=await page.evaluate(({action,t})=>{
  const g=window.__brProbe,scope=document.getElementById('scope-overlay'),cross=document.getElementById('crosshair');
  if(scope)scope.style.display=action==='ads'?'block':'none';if(cross)cross.style.display=action==='ads'?'none':'block';
  if(action!=='ads')return g.pose(action,t);
  g.pose('idle',0);
  for(let n=0;n<90;n++)g.manager.update(1/60,window.__brDef,g.ws,true,false,true,false,false,false,0,true,true);
  g.camera.fov=window.__brDef.adsFov;g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);return g.sample();
 },{action,t});await page.screenshot({path:resolve(output,name+'.png')});screens.push({name,...sample});}
 checks.push('Six matched views: actual armory side/front/rear; gameplay hip/ADS/upright mag seating');
 if(process.env.BR_POSES_ONLY==='1'){
 writeFileSync(resolve(output,'pose-validation.json'),JSON.stringify({screens,errors,renderer:'Chromium SwiftShader'},null,2)+'\n');
 } else {
 await page.evaluate(()=>{const g=window.__brProbe;g.hold=false;g.renderer.setPixelRatio(.30);g.renderer.setSize(1280,720);g.equip();g.record=true;window.__weaponAudio=[];});
 const sample=()=>page.evaluate(()=>window.__brProbe.sample());
 await page.mouse.click(640,360);await page.waitForFunction(()=>window.__brProbe.ws.ammo===17&&!(window.__brProbe.ws.burstRemaining>0));
 await page.keyboard.press('r');await page.waitForFunction(()=>window.__brProbe.ws.reloading);assert.equal((await sample()).burst,0);
 await page.mouse.click(640,360);await page.waitForFunction(()=>!window.__brProbe.ws.reloading);
 assert.equal((await sample()).ammo,36);assert.equal((await sample()).reserve,41);assert.equal((await sample()).needsChamber,false);
 let clips=await page.evaluate(()=>window.__weaponAudio.map(x=>x.src));assert.equal(clips.filter(x=>x.includes('br_charge')).length,0);
 await page.mouse.click(640,360);await page.waitForFunction(()=>window.__brProbe.ws.ammo===33&&!(window.__brProbe.ws.burstRemaining>0));
 checks.push('Actual three-round bursts before/after complete tactical reload; R clears queued burst and reload clicks cannot fire; exact 36/41 transfer with no charging cue');
 await page.evaluate(()=>window.__brProbe.equip(0,50));await page.keyboard.press('r');await page.waitForFunction(()=>window.__brProbe.ws.reloadSequence?.phases[window.__brProbe.ws.reloadSequence.index]?.phase==='insert');
 await page.keyboard.press('p');const frozen=await page.evaluate(()=>JSON.stringify(window.__brProbe.ws));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>JSON.stringify(window.__brProbe.ws)),frozen);await page.locator('#btn-resume').click();
 await page.waitForFunction(()=>!window.__brProbe.ws.reloading);assert.equal((await sample()).ammo,36);assert.equal((await sample()).reserve,14);assert.equal((await sample()).needsChamber,false);
 clips=await page.evaluate(()=>window.__weaponAudio.map(x=>x.src));assert.equal(clips.filter(x=>x.includes('br_charge')).length,1);assert.equal(clips.filter(x=>x.includes('br_reload_')).length,0);
 checks.push('Complete empty reload with pause/resume, conserved 36/14 ammo, one empty-only receiver cue and no overlapping composites');
 await page.evaluate(()=>window.__brProbe.equip(8,60));await page.keyboard.press('r');await page.waitForFunction(()=>window.__brProbe.ws.reloadSequence?.phases[window.__brProbe.ws.reloadSequence.index]?.phase==='eject');
 await page.keyboard.press('Digit2');assert.equal(await page.evaluate(()=>!!window.__brProbe.primary.reloading),false);await page.keyboard.press('Digit1');
 await page.waitForFunction(()=>!window.__brProbe.sample().freshVisible);assert.equal((await sample()).ammo,8);assert.equal((await sample()).reserve,60);
 for(let n=0;n<3;n++){await page.keyboard.press('Digit2');await page.keyboard.press('Digit1');}
 assert.equal((await sample()).ammo,8);assert.equal(await page.evaluate(()=>window.__brProbe.manager.root.getObjectsByProperty('name','freshMagazine').length),1);
 checks.push('Switch cancels magazine handling without phantom rounds; repeated equips keep one spare mag and restored transforms');
 await page.keyboard.down('w');await page.keyboard.down('Shift');await page.waitForFunction(()=>window.__brProbe.player.sprinting&&window.__brProbe.sample().root[0]<0);
 await page.mouse.down();await page.waitForTimeout(250);assert.equal((await sample()).ammo,8);assert.equal((await sample()).burst,0);await page.mouse.up();
 await page.keyboard.press('r');await page.waitForFunction(()=>window.__brProbe.ws.reloading&&!window.__brProbe.player.sprinting);await page.waitForFunction(()=>!window.__brProbe.ws.reloading&&window.__brProbe.player.sprinting);
 await page.keyboard.up('Shift');await page.keyboard.up('w');await page.mouse.down({button:'right'});
 await page.waitForFunction(()=>window.__brProbe.player.aiming&&!window.__brProbe.sample().receiverVisible&&!window.__brProbe.sample().handVisible);await page.mouse.up({button:'right'});
 checks.push('Screen-left sprint blocks BR fire; reload stops sprint and returns to held sprint, followed by clean scoped ADS');
 await page.keyboard.press('r'); // full magazine is a no-op
 assert.equal((await sample()).reloading,false);
 await page.evaluate(()=>window.__brProbe.equip(5,30));await page.keyboard.press('r');await page.waitForFunction(()=>window.__brProbe.ws.reloading);await page.evaluate(()=>window.__brProbe.kill());assert.equal((await sample()).reloading,false);
 await page.getByRole('button',{name:'[ PLAY AGAIN ]',exact:true}).click();await page.waitForFunction(()=>window.__brProbe.state==='playing');
 checks.push('Death cancels BR reload and redeployment succeeds');
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'validation.json'),JSON.stringify({screens,checks,errors,frames:await page.evaluate(()=>window.__brProbe.frames),audio:await page.evaluate(()=>window.__weaponAudio),renderer:'Chromium SwiftShader; no native-speed or audible-quality claim'},null,2)+'\n');
 }
 for(const check of checks)console.log('PASS:',check);
}finally{clearTimeout(deadline);await browser?.close();await server.close();}
