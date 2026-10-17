import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const output=resolve(process.env.SMG_OUTPUT??'docs/smg-fidelity/evidence');mkdirSync(output,{recursive:true});
const port=3135,errors=[],evidence=[],checks=[];
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true},plugins:[{
 name:'smg-acceptance',enforce:'pre',
 configureServer(server){server.middlewares.use('/__smg-studio',async(_req,res)=>{
  res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__smg-studio',`<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"><style>body{margin:0}#root>[aria-label]{height:720px!important;width:1280px}</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__smg-studio-fixture"></script></body></html>`));
 });},
 resolveId(id){if(id==='smg-studio-fixture'||id==='\0smg-studio-fixture')return '\0smg-studio-fixture';},
 load(id){if(id==='\0smg-studio-fixture')return `import React from'react';import{createRoot}from'react-dom/client';import{WeaponStudio}from'/src/WeaponStudio.tsx';createRoot(document.getElementById('root')).render(React.createElement(WeaponStudio,{weaponId:'smg'}));`;},
 transform(code,id){
  if(id.endsWith('/src/WeaponStudio.tsx'))return code.replace('    controls.maxDistance = 5;',`    controls.maxDistance = 5;
    window.__smgStudio={hold:false,view(angle){this.hold=true;controls.enabled=false;weapon.rotation.set(0,-Math.PI/2,0);weapon.position.set(-.005,.055,0);
    camera.position.set(...(angle==='top'?[0,.85,.001]:angle==='three-quarter'?[-.48,.28,.73]:[0,.02,.92]));controls.target.set(0,0,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];}};`)
   .replace('      controls.update();','      if(!window.__smgStudio?.hold)controls.update();').replace('      renderer.render(scene, camera);','      if(!window.__smgStudio?.hold)renderer.render(scene,camera);');
  if(!id.endsWith('/src/App.tsx'))return;
  const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
  code=code.replace(needle,`
    const smgDef=WEAPONS.find(w=>w.id==='smg');
    window.__smg={scene,renderer,camera,manager:vmManager,player,hold:false,
      get state(){return gameStateRef.current;},get ws(){return currentSlotState();},get weapon(){return currentSlot();},
      equip(ammo=17){stopWeaponAudio();cancelWeaponReload(currentSlotState());playerLoadout[0]=smgDef;playerLoadout[1]=WEAPONS[0];playerWeaponState[1]={ammo:30,reserve:90};playerWeaponState[0]={ammo,reserve:192,lastFired:-100};switchSlot(0);player.aiming=false;vmManager.resetEffects();},
      kill(){applyDamageToPlayer(999999,true,true,null);},
      tick(dt,run=false,aim=false,playing=true){vmManager.update(dt,smgDef,this.ws,aim,run,true,run,false,false,0,true,playing);},
      sample(){const s=this.ws,q=s.reloadSequence,m=vmManager.root.getObjectByName('Weapon_smg');m?.updateMatrixWorld(true);
        const part=name=>m?.getObjectByName(name),vec=name=>part(name)?.position.toArray();
        return {ammo:s.ammo,reserve:s.reserve,reloading:!!s.reloading,needsChamber:!!s.needsChamber,phase:q?.phases[q.index]?.phase,progress:q?q.elapsed/q.phases[q.index].duration:0,root:m?.position.toArray(),right:vec('rightHand'),left:vec('leftHand'),mag:vec('magazine'),fresh:vec('freshMagazine'),bolt:vec('bolt'),magVisible:part('magazine')?.visible,freshVisible:part('freshMagazine')?.visible};},
      pose(action,t=0){this.hold=true;this.equip(action==='empty'?0:17);for(let n=0;n<60;n++)this.tick(1/60);
        camera.fov=action==='ads'?smgDef.adsFov:HIP_FOV;camera.updateProjectionMatrix();
        const advance=(seconds,run=false,aim=false,reload=false)=>{for(let left=seconds;left>1e-8;){const dt=Math.min(1/144,left);left-=dt;if(reload)advanceWeaponReload(smgDef,this.ws,dt);this.tick(dt,run,aim);}};
        if(action==='tactical'||action==='empty'){beginWeaponReload(smgDef,this.ws);advance(t,false,false,true);}
        if(action==='sprint')advance(.8,true);
        if(action==='ads'){this.equip(0);beginWeaponReload(smgDef,this.ws);advance(2.4,false,false,true);advance(.8,false,true);}
        renderer.render(scene,camera);return this.sample();},
      capture(){renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];}
    };
    `+needle);
  const tick='      const dt = Math.min(0.05, clock.getDelta());';assert.equal(code.split(tick).length,2);
  return code.replace(tick,tick+'\n      if(window.__smg?.hold)return;');
 }
}]});
let browser;const deadline=setTimeout(()=>{console.error('SMG capture exceeded eight minutes');void browser?.close();void server.close();process.exitCode=1;},480000);
try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.BENCHMARK_BROWSER??'/usr/bin/chromium',args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.addInitScript(()=>{
  let seed=47;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded SMG acceptance'));
  window.__smgAudio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(/smg_/.test(this.src))window.__smgAudio.push({src:this.src.split('/').pop(),rate:this.playbackRate,offset:this.currentTime});return play.call(this);};
 });
 await page.goto(`http://127.0.0.1:${port}/__smg-studio`);await page.waitForFunction(()=>!!window.__smgStudio);
 for(const angle of ['side','top','three-quarter']){writeFileSync(resolve(output,`model-${angle}.png`),Buffer.from(await page.evaluate(a=>window.__smgStudio.view(a),angle),'base64'));console.log('Captured model '+angle);}
 if(process.env.SMG_STUDIO_ONLY==='1'){assert.deepEqual(errors,[]);checks.push('Production WeaponStudio side/top/three-quarter');}
 else{
 await page.goto(`http://127.0.0.1:${port}`);
 await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
 await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
 await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
 await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
 await page.waitForFunction(()=>window.__smg?.state==='playing');
 for(const [name,action,t]of [
  ['ready','idle',0],['tactical-removal','tactical',.48],['magazine-seating','tactical',1.11],
  ['charging-contact','empty',1.598],['charging-retracted','empty',1.75],['support-recovery','empty',2.20],['ads-after-reload','ads',0],['two-hand-sprint','sprint',0],
 ]){
  const sample=await page.evaluate(({action,t})=>window.__smg.pose(action,t),{action,t});
  writeFileSync(resolve(output,name+'.png'),Buffer.from(await page.evaluate(()=>window.__smg.capture()),'base64'));evidence.push({name,...sample});writeFileSync(resolve(output,'poses.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Captured '+name);
 }
 const byName=name=>evidence.find(e=>e.name===name);assert.equal(byName('tactical-removal').phase,'eject');assert.equal(byName('magazine-seating').phase,'insert');assert.equal(byName('charging-contact').phase,'chamber');assert.ok(Math.abs(byName('charging-retracted').bolt[2]+.061)<.001);assert.equal(byName('ads-after-reload').ammo,32);
 checks.push('Eight production App poses plus WeaponStudio side/top/three-quarter');
 // Live keyboard/mouse actions traverse the actual input/state/audio code.
 console.log('Checking live R, pause and resume');
 await page.evaluate(()=>{window.__smg.renderer.setPixelRatio(.5);window.__smg.hold=false;window.__smg.equip(17);});await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__smg.ws.reloading);
 await page.keyboard.press('p');await page.waitForFunction(()=>window.__smg.state==='paused');const frozen=await page.evaluate(()=>window.__smg.ws.reloadT);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__smg.ws.reloadT),frozen);
 await page.locator('#btn-resume').click();await page.waitForFunction(()=>window.__smg.state==='playing');await page.waitForFunction(()=>!window.__smg.ws.reloading,null,{timeout:180000});assert.equal(await page.evaluate(()=>window.__smg.ws.ammo),32);
 console.log('Checking automatic fire before/after reload');
 await page.evaluate(()=>window.__smg.equip(2));await page.mouse.click(900,350);await page.waitForFunction(()=>window.__smg.ws.ammo<2);await page.mouse.down();await page.waitForFunction(()=>!!window.__smg.ws.reloading,null,{timeout:180000});await page.mouse.up();await page.waitForFunction(()=>!window.__smg.ws.reloading,null,{timeout:180000});assert.equal(await page.evaluate(()=>window.__smg.ws.ammo),32);
 await page.mouse.click(900,350);await page.waitForFunction(()=>window.__smg.ws.ammo===31);
 console.log('Checking switch cancellation');
 await page.evaluate(()=>window.__smg.equip(0));await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__smg.ws.reloading);await page.keyboard.press('2');await page.waitForFunction(()=>window.__smg.weapon.id==='ar');await page.keyboard.press('1');await page.waitForFunction(()=>window.__smg.weapon.id==='smg');assert.equal(await page.evaluate(()=>!!window.__smg.ws.reloading),false);
 await page.keyboard.press('r');await page.waitForFunction(()=>!window.__smg.ws.reloading,null,{timeout:180000});
 console.log('Checking sprint and ADS');
 await page.keyboard.down('w');await page.keyboard.down('Shift');await page.waitForFunction(()=>window.__smg.player.sprinting);const ammo=await page.evaluate(()=>window.__smg.ws.ammo);await page.mouse.click(900,350);assert.equal(await page.evaluate(()=>window.__smg.ws.ammo),ammo);await page.keyboard.up('Shift');await page.keyboard.up('w');
 await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__smg.player.aiming);await page.mouse.up({button:'right'});
 console.log('Checking death/redeployment');
 await page.evaluate(()=>window.__smg.kill());await page.waitForFunction(()=>!window.__smg.player.alive);await page.getByRole('button',{name:'[ PLAY AGAIN ]',exact:true}).click();await page.waitForFunction(()=>window.__smg.state==='playing'&&window.__smg.player.alive,null,{timeout:180000});
 await page.evaluate(()=>{window.__smg.hold=true;window.__smg.equip(32);window.__smg.tick(0);});const reset=await page.evaluate(()=>window.__smg.sample());assert.ok(reset.magVisible&&!reset.freshVisible);assert.equal(reset.reloading,false);
 const audio=await page.evaluate(()=>window.__smgAudio);assert.ok(audio.some(a=>a.src.startsWith('smg_reload_tactical')));assert.ok(audio.some(a=>a.src.startsWith('smg_reload_empty')));
 checks.push('Actual R tactical/empty reload; automatic fire before/after; pause/resume; switch/cancel; two-hand sprint firing restriction; ADS; death/redeployment; bundled audio');
 writeFileSync(resolve(output,'audio-playback.json'),JSON.stringify(audio,null,2)+'\n');
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'validation.json'),JSON.stringify({renderer:'Chromium SwiftShader; actual App/WeaponStudio',evidence,checks,errors},null,2)+'\n');console.log('PASS: '+checks.join('; '));
}finally{clearTimeout(deadline);await browser?.close();await server.close();}
