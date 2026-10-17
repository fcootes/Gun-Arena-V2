import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const output = resolve(process.env.PISTOL_OUTPUT ?? 'docs/pistol-fidelity/evidence');
mkdirSync(output, { recursive: true });
const port = Number(process.env.PISTOL_PORT ?? 3125), errors = [], evidence = [], checks = [];
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{
  name: 'pistol-acceptance-probe', enforce: 'pre',
  configureServer(server) {
    server.middlewares.use('/__pistol-studio', async (_req,res) => {
      res.setHeader('Content-Type','text/html');
      res.end(await server.transformIndexHtml('/__pistol-studio',`<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"><style>body{margin:0}#root>[aria-label]{height:720px!important;width:1280px}</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__pistol-studio-fixture"></script></body></html>`));
    });
  },
  resolveId(id) { if(id==='pistol-studio-fixture'||id==='\0pistol-studio-fixture')return '\0pistol-studio-fixture'; },
  load(id) { if(id==='\0pistol-studio-fixture')return `import React from 'react';import{createRoot}from'react-dom/client';import{WeaponStudio}from'/src/WeaponStudio.tsx';createRoot(document.getElementById('root')).render(React.createElement(WeaponStudio,{weaponId:'pistol'}));`; },
  transform(code, id) {
    if(id.endsWith('/src/weaponModels.ts')&&process.env.PISTOL_BASELINE_MODELS)return readFileSync(process.env.PISTOL_BASELINE_MODELS,'utf8');
    if(id.endsWith('/src/WeaponStudio.tsx'))return code.replace('    controls.maxDistance = 5;', `    controls.maxDistance = 5;
      window.__pistolStudio={scene,camera,weapon,controls,renderer,hold:false,
        view(angle){this.hold=true;controls.enabled=false;weapon.rotation.set(0,-Math.PI/2,0);weapon.position.set(-.035,.055,0);
          const eye=angle==='front'?[-.38,.22,.54]:angle==='rear'?[.38,.22,.54]:[0,0,.72];
          camera.position.set(...eye);controls.target.set(0,0,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
          return renderer.domElement.toDataURL('image/png').split(',')[1];}};`)
      .replace('      controls.update();','      if(!window.__pistolStudio?.hold)controls.update();')
      .replace('      renderer.render(scene, camera);','      if(!window.__pistolStudio?.hold)renderer.render(scene, camera);');
    if (!id.endsWith('/src/App.tsx')) return;
    const needle = '    // Main Game Loop'; assert.equal(code.split(needle).length, 2);
    code = code.replace(needle, `
    const pistolDef=WEAPONS.find(w=>w.id==='pistol');
    window.__pistol={scene,renderer,camera,manager:vmManager,player,hold:false,
      get state(){return gameStateRef.current;},get ws(){return currentSlotState();},get weapon(){return currentSlot();},
      equip(ammo=8){stopWeaponAudio();cancelWeaponReload(currentSlotState());playerLoadout[0]=pistolDef;playerLoadout[1]=WEAPONS[0];playerWeaponState[1]={ammo:30,reserve:90};playerWeaponState[0]={ammo,reserve:60,lastFired:-100};switchSlot(0);player.aiming=false;vmManager.resetEffects();},
      kill(){applyDamageToPlayer(999999,true,true,null);},
      tick(dt,run=false,aim=false,playing=true){vmManager.update(dt,pistolDef,this.ws,aim,run,true,run,false,false,0,true,playing);},
      sample(){const s=this.ws,q=s.reloadSequence,m=vmManager.root.getObjectByName('Weapon_pistol');m?.updateMatrixWorld(true);const left=m?.getObjectByName('leftHand'),right=m?.getObjectByName('rightHand'),mag=m?.getObjectByName('magazine'),fresh=m?.getObjectByName('freshMagazine');
        return {id:currentSlot().id,ammo:s.ammo,reserve:s.reserve,reloading:!!s.reloading,needsChamber:!!s.needsChamber,phase:q?.phases[q.index]?.phase,elapsed:q?.elapsed,sprinting:player.sprinting,aiming:player.aiming,root:m?.position.toArray(),right:right?.position.toArray(),left:left?.position.toArray(),leftCamera:left?.position.clone().applyMatrix4(m.matrix).toArray(),mag:mag?.position.toArray(),fresh:fresh?.position.toArray(),magVisible:mag?.visible,freshVisible:fresh?.visible,slide:m?.getObjectByName('slide')?.position.z,gait:{phase:vmManager.getPistolSprintPose().phase,blend:vmManager.getPistolSprintPose().blend,leftElbow:vmManager.getPistolSprintPose().left.elbow.toArray(),rightElbow:vmManager.getPistolSprintPose().right.elbow.toArray()}};},
      pose(action,t=0){this.hold=true;this.equip(action.startsWith('empty')?0:8);for(let n=0;n<60;n++)this.tick(1/60);
        camera.fov=action==='ads'||action==='ads-after-sprint'?pistolDef.adsFov:HIP_FOV;camera.updateProjectionMatrix();
        const advance=(seconds,run=false,aim=false,reload=false)=>{for(let left=seconds;left>1e-8;){const dt=Math.min(1/144,left);left-=dt;if(reload)advanceWeaponReload(pistolDef,this.ws,dt);this.tick(dt,run,aim);}};
        if(action.startsWith('tactical')||action.startsWith('empty')){beginWeaponReload(pistolDef,this.ws);advance(t,false,false,true);}
        if(action==='sprint')advance(t,true);
        if(action==='sprint-exit'||action==='ads-after-sprint'){advance(.8,true);advance(t,false,action==='ads-after-sprint');}
        if(action==='ads')advance(.8,false,true);
        renderer.render(scene,camera);return this.sample();},
      capture(){renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];}
    };
    ${needle}`);
    const tick = '      const dt = Math.min(0.05, clock.getDelta());'; assert.equal(code.split(tick).length, 2);
    return code.replace(tick, tick + '\n      if(window.__pistol?.hold)return;');
  },
}] });
let browser;
const deadline = setTimeout(() => { console.error('Pistol browser validation exceeded eight minutes'); void browser?.close(); void server.close(); process.exitCode = 1; }, process.env.PISTOL_GAIT==='1'?240000:480000);
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.BENCHMARK_BROWSER ?? '/usr/bin/chromium', args: ['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(60000);
  page.on('console',msg=>{if(msg.type()==='error')console.error('Browser: '+msg.text());});
  page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  await page.addInitScript(() => {
    let seed=47;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded pistol acceptance'));
    window.__pistolAudio=[];const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(/pistol_/.test(this.src))window.__pistolAudio.push({src:this.src.split('/').pop(),rate:this.playbackRate,offset:this.currentTime});return play.call(this);};
  });
  if(process.env.PISTOL_STUDIO_ONLY==='1') {
    await page.goto(`http://127.0.0.1:${port}/__pistol-studio`);await page.waitForFunction(()=>!!window.__pistolStudio);
    for(const [name,angle]of[['armory-side','side'],['armory-front-three-quarter','front'],['armory-rear-three-quarter','rear']]) {
      const bytes=await page.evaluate(angle=>window.__pistolStudio.view(angle),angle);writeFileSync(resolve(output,name+'.png'),Buffer.from(bytes,'base64'));
    }
    assert.deepEqual(errors,[]);console.log('PASS: actual WeaponStudio side/front/rear views');
  } else {
  console.log('Booting actual game');
  await page.goto(`http://127.0.0.1:${port}`);
  await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
  await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
  await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
  await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
  await page.waitForFunction(()=>window.__pistol?.state==='playing');
  if(process.env.PISTOL_LIVE_ONLY==='1')evidence.push(...JSON.parse(readFileSync(resolve(output,'poses.json'),'utf8')));
  for(const [name,action,t] of process.env.PISTOL_LIVE_ONLY==='1'?[]:process.env.PISTOL_GAIT==='1'?[
    ['entry','sprint',.04],['right-drive','sprint',2.115/2.05],['neutral','sprint',2.255/2.05],['left-drive','sprint',2.515/2.05],['loop-return','sprint',3.115/2.05],['exit','sprint-exit',.08],['restored-ready','sprint-exit',1.0],
  ]:[
    ['idle','idle',0],['ads','ads',0],['tactical-removal','tactical',.26],['tactical-insertion','tactical',.79],['tactical-ready','tactical',1.30],
    ['empty-slide-locked','empty',.25],['empty-mag-seated','empty',1.37],['empty-slide-release','empty',1.49],['empty-slide-forward','empty',1.64],['empty-ready','empty',2.25],
    ['sprint-release','sprint',.04],['sprint-phase-a','sprint',.545],['sprint-phase-b','sprint',.74],['sprint-recovery','sprint-exit',.07],['ads-after-sprint','ads-after-sprint',.70],
  ]) {
    const sample=await page.evaluate(({action,t})=>window.__pistol.pose(action,t),{action,t});
    writeFileSync(resolve(output,name+'.png'),Buffer.from(await page.evaluate(()=>window.__pistol.capture()),'base64'));
    evidence.push({name,...sample});console.log('Captured '+name);
    writeFileSync(resolve(output,'poses.json'),JSON.stringify(evidence,null,2)+'\n');
  }
  const byName=name=>evidence.find(e=>e.name===name);
  if(process.env.PISTOL_GAIT!=='1') {
  assert.deepEqual(byName('sprint-phase-a').right,byName('idle').right);
  assert.ok(Math.abs(byName('sprint-phase-a').leftCamera[0]+.20)<.04);
  assert.ok(Math.abs(byName('sprint-phase-a').leftCamera[1]-byName('sprint-phase-b').leftCamera[1])>.02);
  assert.equal(byName('empty-slide-locked').slide,.038);
  assert.equal(byName('empty-mag-seated').ammo,15);
  assert.equal(byName('empty-slide-forward').slide,0);
  assert.ok(!byName('empty-ready').freshVisible&&byName('empty-ready').magVisible);
  }
  checks.push(process.env.PISTOL_GAIT==='1'?'Seven representative actual-game gait poses':'15 rendered poses in the actual running game; physical magazine/slide and independent sprint wrist assertions');
  if(process.env.PISTOL_GAIT==='1') {
    await page.evaluate(()=>window.__pistol.pose('sprint',2/2.05));
    const frames=resolve(output,'cycle-frames');mkdirSync(frames,{recursive:true});
    for(let i=0;i<48;i++) {
      const frame=await page.evaluate(()=>{const g=window.__pistol;g.tick(1/24,true);g.renderer.render(g.scene,g.camera);return g.renderer.domElement.toDataURL('image/jpeg',.86).split(',')[1];});
      writeFileSync(resolve(frames,String(i).padStart(3,'0')+'.jpg'),Buffer.from(frame,'base64'));
    }
    const video=spawnSync('ffmpeg',['-loglevel','error','-y','-framerate','24','-i',resolve(frames,'%03d.jpg'),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'sprint-cycle.mp4')],{encoding:'utf8',timeout:30000});
    checks.push(video.status===0?'Two-second continuous 24 FPS recording; over four complete stride pairs':'Video encoder unavailable; 48 real rendered cycle frames retained');
    const a=byName('right-drive'),b=byName('left-drive');assert.ok(a.leftCamera[1]<b.leftCamera[1]-.20);assert.deepEqual(a.right,b.right);
  }
  if(process.env.PISTOL_POSES_ONLY!=='1'&&process.env.PISTOL_GAIT!=='1') {
    console.log('Checking live controls');
    await page.evaluate(()=>{const g=window.__pistol;g.equip(8);g.renderer.setPixelRatio(.5);g.hold=false;});
    await page.keyboard.down('w');await page.keyboard.down('Shift');
    await page.waitForFunction(()=>window.__pistol.player.sprinting);
    const sprintAmmo=await page.evaluate(()=>window.__pistol.ws.ammo);
    await page.mouse.click(640,350);assert.equal(await page.evaluate(()=>window.__pistol.ws.ammo),sprintAmmo,'Sprint still blocks firing');
    await page.keyboard.down('Control');await page.waitForFunction(()=>!window.__pistol.player.sprinting);await page.keyboard.up('Control');
    await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__pistol.player.aiming&&!window.__pistol.player.sprinting);await page.mouse.up({button:'right'});
    await page.keyboard.up('Shift');await page.keyboard.up('w');
    await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__pistol.ws.reloading);
    await page.keyboard.press('p');await page.waitForFunction(()=>window.__pistol.state==='paused');
    const paused=await page.evaluate(()=>JSON.stringify(window.__pistol.sample()));await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>JSON.stringify(window.__pistol.sample())),paused);
    await page.locator('#btn-resume').click();await page.waitForFunction(()=>!window.__pistol.ws.reloading,null,{timeout:180000});assert.equal(await page.evaluate(()=>window.__pistol.ws.ammo),15);
    await page.evaluate(()=>window.__pistol.equip(0));await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__pistol.ws.reloading);
    console.log('Checking weapon switch interruption');
    await page.keyboard.press('2');await page.waitForFunction(()=>window.__pistol.weapon.id!=='pistol');await page.keyboard.press('1');await page.waitForFunction(()=>window.__pistol.weapon.id==='pistol');
    assert.equal(await page.evaluate(()=>!!window.__pistol.ws.reloading),false);
    console.log('Checking resumed empty reload');
    await page.keyboard.press('r');await page.waitForFunction(()=>!window.__pistol.ws.reloading,null,{timeout:180000});assert.equal(await page.evaluate(()=>window.__pistol.ws.ammo),15);
    const audio=await page.evaluate(()=>window.__pistolAudio);assert.ok(audio.some(a=>a.src.startsWith('pistol_reload_tactical')));assert.ok(audio.some(a=>a.src.startsWith('pistol_reload_empty')));
    console.log('Checking death and redeployment');
    await page.evaluate(()=>window.__pistol.kill());await page.waitForFunction(()=>!window.__pistol.player.alive);
    await page.getByRole('button',{name:'[ PLAY AGAIN ]',exact:true}).click();await page.waitForFunction(()=>window.__pistol.state==='playing'&&window.__pistol.player.alive,null,{timeout:180000});
    await page.evaluate(()=>{window.__pistol.hold=true;window.__pistol.equip(15);window.__pistol.tick(0);});
    const redeployed=await page.evaluate(()=>window.__pistol.sample());assert.equal(redeployed.freshVisible,false);assert.equal(redeployed.magVisible,true);assert.equal(redeployed.reloading,false);
    checks.push('Real W/Shift sprint, fire restriction, crouch, ADS priority, R reload, pause/resume, switch interruption/re-equip, composite audio, death and redeployment');
  }
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(output,'validation.json'),JSON.stringify({commit:process.env.PISTOL_SHA??'working tree',renderer:'Chromium SwiftShader; actual App scene and camera',evidence,checks,errors},null,2)+'\n');
  console.log('PASS: '+checks.join('; '));
  }
} finally { clearTimeout(deadline);await browser?.close();await server.close(); }
