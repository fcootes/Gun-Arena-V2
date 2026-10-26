import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const output=resolve(process.env.LMG_OUTPUT??'docs/lmg-fidelity/evidence');mkdirSync(output,{recursive:true});
const port=Number(process.env.LMG_PORT??3136),errors=[],evidence=[],checks=[];
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true},plugins:[{
 name:'lmg-acceptance',enforce:'pre',
 configureServer(server){server.middlewares.use('/__lmg-studio',async(_req,res)=>{
  res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__lmg-studio',`<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"><style>body{margin:0}#root>[aria-label]{height:720px!important;width:1280px}</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__lmg-studio-fixture"></script></body></html>`));
 });},
 resolveId(id){if(id==='lmg-studio-fixture'||id==='\0lmg-studio-fixture')return '\0lmg-studio-fixture';},
 load(id){if(id==='\0lmg-studio-fixture')return `import React from'react';import{createRoot}from'react-dom/client';import{WeaponStudio}from'/src/WeaponStudio.tsx';createRoot(document.getElementById('root')).render(React.createElement(WeaponStudio,{weaponId:'lmg'}));`;},
 transform(code,id){
  if(id.endsWith('/src/WeaponStudio.tsx'))return code.replace('    controls.maxDistance = 5;',`    controls.maxDistance = 5;
    window.__lmgStudio={hold:false,view(angle){this.hold=true;controls.enabled=false;weapon.rotation.set(0,-Math.PI/2,0);weapon.position.set(-.005,.055,0);
    camera.position.set(...(angle==='top'?[0,1.55,.001]:angle==='three-quarter'?[-.72,.42,1.35]:[0,.02,1.60]));controls.target.set(0,0,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];}};`)
   .replace('      controls.update();','      if(!window.__lmgStudio?.hold)controls.update();').replace('      renderer.render(scene, camera);','      if(!window.__lmgStudio?.hold)renderer.render(scene,camera);');
  if(!id.endsWith('/src/App.tsx'))return;
  const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
  code=code.replace(needle,`
    const lmgDef=WEAPONS.find(w=>w.id==='lmg');const lmgDiagnosticLight=new THREE.HemisphereLight(0xffffff,0x8491a3,2.5);
    window.__lmg={scene,renderer,camera,manager:vmManager,player,hold:false,
      diagnostic(on){if(on)scene.add(lmgDiagnosticLight);else scene.remove(lmgDiagnosticLight);},get state(){return gameStateRef.current;},get ws(){return currentSlotState();},get weapon(){return currentSlot();},
      equip(ammo=43){prepareWeaponAudio(['lmg']);stopWeaponAudio();cancelWeaponReload(currentSlotState());playerLoadout[0]=lmgDef;playerLoadout[1]=WEAPONS[0];playerWeaponState[1]={ammo:30,reserve:90};playerWeaponState[0]={ammo,reserve:300,lastFired:-100};switchSlot(0);player.aiming=false;vmManager.resetEffects();},
      kill(){applyDamageToPlayer(999999,true,true,null);},
      tick(dt,run=false,aim=false,playing=true){vmManager.update(dt,lmgDef,this.ws,aim,run,true,run,false,false,0,true,playing);},
      sample(){const s=this.ws,q=s.reloadSequence,m=vmManager.root.getObjectByName('Weapon_lmg');m?.updateMatrixWorld(true);
        const part=name=>m?.getObjectByName(name),vec=name=>part(name)?.position.toArray();
        return {ammo:s.ammo,reserve:s.reserve,reloading:!!s.reloading,needsChamber:!!s.needsChamber,phase:q?.phases[q.index]?.phase,progress:q?q.elapsed/q.phases[q.index].duration:0,root:m?.position.toArray(),right:vec('rightHand'),left:vec('leftHand'),mag:vec('magazine'),fresh:vec('freshMagazine'),bolt:vec('bolt'),cover:part('feedTray')?.rotation.x,upper:part('leftUpperArm')?.visible,magVisible:part('magazine')?.visible,freshVisible:part('freshMagazine')?.visible};},
      pose(action,t=0){this.hold=true;this.equip(action==='empty'?0:43);for(let n=0;n<60;n++)this.tick(1/60);
        camera.fov=action==='ads'?lmgDef.adsFov:HIP_FOV;camera.updateProjectionMatrix();
        const advance=(seconds,run=false,aim=false,reload=false)=>{for(let left=seconds;left>1e-8;){const dt=Math.min(1/144,left);left-=dt;if(reload)advanceWeaponReload(lmgDef,this.ws,dt);this.tick(dt,run,aim);}};
        if(action==='post-sprint'){advance(.8,true);advance(.3);beginWeaponReload(lmgDef,this.ws);advance(t,false,false,true);}
        if(action==='tactical'||action==='empty'){beginWeaponReload(lmgDef,this.ws);advance(t,false,false,true);}
        if(action==='sprint')advance(.8,true);
        if(action==='ads'){this.equip(0);beginWeaponReload(lmgDef,this.ws);advance(5,false,false,true);advance(.8,false,true);}
        renderer.render(scene,camera);return this.sample();},
      frame(dt){advanceWeaponReload(lmgDef,this.ws,dt);this.tick(dt);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/jpeg',.90).split(',')[1];},
      freezeBackdrop(){vmManager.root.visible=false;renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;canvas.getContext('2d').drawImage(renderer.domElement,0,0);vmManager.root.visible=true;const backdrop=new THREE.CanvasTexture(canvas);backdrop.colorSpace=THREE.SRGBColorSpace;scene.background=backdrop;scene.fog=null;for(const child of scene.children)if(child!==camera&&child!==combatLightGroup&&!child.isLight)child.visible=false;renderer.shadowMap.enabled=false;},
      capture(){renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];}
    };
    `+needle);
  const tick='      const dt = Math.min(0.05, clock.getDelta());';assert.equal(code.split(tick).length,2);
  return code.replace(tick,tick+'\n      if(window.__lmg?.hold)return;');
 }
}]});
let browser;const deadline=setTimeout(()=>{console.error('LMG capture exceeded eight minutes');void browser?.close();void server.close();process.exitCode=1;},480000);
try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.BENCHMARK_BROWSER??'/usr/bin/chromium',args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);page.on('console',message=>{if(message.type()==='warning'||message.type()==='error')console.log('Browser '+message.type()+': '+message.text());});page.on('requestfailed',request=>console.log('Request failed: '+request.url()));page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.addInitScript(()=>{
  let seed=47;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded LMG acceptance'));
  window.__lmgWebAudio=[];window.__lmgDecoded=0;
  const decode=AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData=function(...args){return decode.apply(this,args).then(buffer=>{window.__lmgDecoded++;return buffer;});};
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){this.__lmgIndex=window.__lmgWebAudio.length;window.__lmgWebAudio.push({at:this.context.currentTime,duration:this.buffer?.duration,loop:this.loop,rate:this.playbackRate.value,stops:[]});return start.apply(this,args);};
  AudioBufferSourceNode.prototype.stop=function(...args){window.__lmgWebAudio[this.__lmgIndex]?.stops.push(args[0]??this.context.currentTime);return stop.apply(this,args);};
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...args){
    if(destination instanceof AudioDestinationNode&&this instanceof GainNode){
      const context=this.context;
      if(!context.__lmgStream){context.__lmgStream=context.createMediaStreamDestination();const chunks=[];const recorder=new MediaRecorder(context.__lmgStream.stream);recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();window.__lmgRecorder={recorder,chunks};}
      connect.call(this,context.__lmgStream);
    }
    return connect.call(this,destination,...args);
  };
  window.__lmgAudio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(/lmg_/.test(this.src))window.__lmgAudio.push({src:this.src.split('/').pop(),rate:this.playbackRate,offset:this.currentTime});return play.call(this);};
 });
 if(process.env.LMG_LIVE_ONLY!=='1'&&process.env.LMG_MAP!=='area51') {
 await page.goto(`http://127.0.0.1:${port}/__lmg-studio`);await page.waitForFunction(()=>!!window.__lmgStudio);
 for(const angle of ['side','top','three-quarter']){writeFileSync(resolve(output,`model-${angle}.png`),Buffer.from(await page.evaluate(a=>window.__lmgStudio.view(a),angle),'base64'));console.log('Captured model '+angle);}
 }
 if(process.env.LMG_STUDIO_ONLY==='1'){assert.deepEqual(errors,[]);checks.push('Production WeaponStudio side/top/three-quarter');}
 else{
 await page.goto(`http://127.0.0.1:${port}`);
 await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
 await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
 await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:process.env.LMG_MAP==='area51'?/AREA 51 SUBTERRANEAN FACILITY/:/OUTDOOR ARENA TRAINING FIELD/}).click();
 await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
 await page.waitForFunction(()=>window.__lmg?.state==='playing');
 if(process.env.LMG_LIVE_ONLY==='1')evidence.push(...JSON.parse(readFileSync(resolve(output,'poses.json'),'utf8')));
 for(const [name,action,t]of process.env.LMG_LIVE_ONLY==='1'?[]:[
  ['ready','idle',0],['cover-start','tactical',.492],['cover-open','tactical',.82],
  ['box-removal','tactical',1.248],['new-box-insertion','tactical',2.10],['feed-preparation','tactical',2.64],['recovered','tactical',3.85],['box-fitted','tactical',2.44],['hand-raised','tactical',2.9544],
  ['slap-contact','tactical',3.1656],['cover-closed','tactical',3.40],['empty-charging','empty',3.72],['ads-recovery','ads',0],
 ]){
  const sample=await page.evaluate(({action,t})=>window.__lmg.pose(action,t),{action,t});
  writeFileSync(resolve(output,name+'.png'),Buffer.from(await page.evaluate(()=>window.__lmg.capture()),'base64'));evidence.push({name,...sample});writeFileSync(resolve(output,'poses.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Captured '+name);
 }
 if(process.env.LMG_MAP==='area51')for(const [name,action,t,fov,look,bright]of [
  ['bright-raised','tactical',2.9544,74,false,true],['look-wide-fov','empty',3.72,90,true,false],
  ['narrow-fov','tactical',.62,64,false,false],['after-sprint','post-sprint',1.10,74,false,false],
 ]) {
  const capture=await page.evaluate(({action,t,fov,look,bright})=>{const g=window.__lmg;const sample=g.pose(action,t);g.camera.fov=fov;g.camera.updateProjectionMatrix();const q=g.camera.quaternion.clone();if(look){g.camera.rotateY(.35);g.camera.rotateX(-.15);}g.diagnostic(bright);const png=g.capture();g.diagnostic(false);g.camera.quaternion.copy(q);return {sample,png};},{action,t,fov,look,bright});
  writeFileSync(resolve(output,name+'.png'),Buffer.from(capture.png,'base64'));evidence.push({name,fov,look,bright,...capture.sample});console.log('Captured Area 51 '+name);
 }
 const byName=name=>evidence.find(e=>e.name===name);
 assert.equal(byName('cover-open').phase,'eject');assert.ok(Math.abs(byName('cover-open').cover+1.15)<1e-8);
 assert.equal(byName('slap-contact').phase,'slap');assert.ok(Math.abs(byName('slap-contact').cover)<1e-8);
 assert.equal(byName('empty-charging').phase,'chamber');assert.ok(Math.abs(byName('empty-charging').bolt[2]-.075)<1e-7);
 assert.equal(byName('ads-recovery').ammo,100);checks.push(process.env.LMG_MAP==='area51'?'Thirteen actual Area 51 App poses plus diagnostic lighting, 64/90 degree FOV, look rotation and post-sprint poses':'Thirteen production App reload/recovery poses plus WeaponStudio side/top/three-quarter');
 if(process.env.LMG_POSES_ONLY!=='1') {
 // Live keyboard/mouse actions traverse the actual input/state/audio code.
 console.log('Checking actual WebAudio tap and release');
 await page.evaluate(()=>{window.__lmg.renderer.setPixelRatio(.5);window.__lmg.hold=false;window.__lmg.equip(10);});
 await page.waitForFunction(()=>window.__lmgDecoded>=2);
 const audioStart=await page.evaluate(()=>window.__lmgWebAudio.length);
 await page.mouse.click(900,350);await page.waitForFunction(()=>window.__lmg.ws.ammo===9);
 await page.waitForTimeout(180);
 const tap=await page.evaluate(n=>window.__lmgWebAudio.slice(n),audioStart);
 assert.equal(tap.length,1);assert.equal(tap[0].loop,false);assert.equal(tap[0].rate,1);assert.equal(tap[0].stops.length,0,'Tap release preserves complete natural tail');
 checks.push('Real decoded WebAudio: one actual tap, no new report at release, native rate and uncut natural tail');
 console.log('Checking live R, pause and resume');
 await page.evaluate(()=>{window.__lmg.renderer.setPixelRatio(.5);window.__lmg.hold=false;window.__lmg.equip(43);});await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__lmg.ws.reloading);
 await page.keyboard.press('p');await page.waitForFunction(()=>window.__lmg.state==='paused');const frozen=await page.evaluate(()=>window.__lmg.ws.reloadT);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__lmg.ws.reloadT),frozen);
 await page.locator('#btn-resume').click();await page.waitForFunction(()=>window.__lmg.state==='playing');await page.waitForFunction(()=>!window.__lmg.ws.reloading,null,{timeout:180000});assert.equal(await page.evaluate(()=>window.__lmg.ws.ammo),100);
 console.log('Checking automatic fire before/after reload');
 await page.evaluate(()=>window.__lmg.equip(5));await page.mouse.click(900,350);await page.waitForFunction(()=>window.__lmg.ws.ammo<5);await page.mouse.down();await page.waitForFunction(()=>!!window.__lmg.ws.reloading,null,{timeout:180000});await page.mouse.up();await page.waitForFunction(()=>!window.__lmg.ws.reloading,null,{timeout:180000});assert.equal(await page.evaluate(()=>window.__lmg.ws.ammo),100);
 await page.mouse.click(900,350);await page.waitForFunction(()=>window.__lmg.ws.ammo===99);
 console.log('Checking switch cancellation');
 await page.evaluate(()=>window.__lmg.equip(0));await page.keyboard.press('r');await page.waitForFunction(()=>window.__lmg.ws.ammo===100&&window.__lmg.ws.needsChamber);
 const seatedAmmo=await page.evaluate(()=>window.__lmg.ws.ammo);await page.mouse.click(900,350);assert.equal(await page.evaluate(()=>window.__lmg.ws.ammo),seatedAmmo,'Unchambered inserted ammo cannot fire');await page.keyboard.press('2');await page.waitForFunction(()=>window.__lmg.weapon.id==='ar');await page.keyboard.press('1');await page.waitForFunction(()=>window.__lmg.weapon.id==='lmg');assert.equal(await page.evaluate(()=>!!window.__lmg.ws.reloading),false);
 await page.keyboard.press('r');await page.waitForFunction(()=>!window.__lmg.ws.reloading,null,{timeout:180000});
 console.log('Checking sprint and ADS');
 await page.keyboard.down('w');await page.keyboard.down('Shift');await page.waitForFunction(()=>window.__lmg.player.sprinting);const ammo=await page.evaluate(()=>window.__lmg.ws.ammo);await page.mouse.click(900,350);assert.equal(await page.evaluate(()=>window.__lmg.ws.ammo),ammo);await page.keyboard.up('Shift');await page.keyboard.up('w');
 await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__lmg.player.aiming);await page.mouse.up({button:'right'});
 console.log('Checking death/redeployment');
 await page.evaluate(()=>window.__lmg.equip(0));await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__lmg.ws.reloading);
 await page.evaluate(()=>window.__lmg.kill());await page.waitForFunction(()=>!window.__lmg.player.alive);await page.getByRole('button',{name:'[ PLAY AGAIN ]',exact:true}).click();await page.waitForFunction(()=>window.__lmg.state==='playing'&&window.__lmg.player.alive,null,{timeout:180000});
 await page.evaluate(()=>{window.__lmg.hold=true;window.__lmg.equip(100);window.__lmg.tick(0);});const reset=await page.evaluate(()=>window.__lmg.sample());assert.ok(reset.magVisible&&!reset.freshVisible);assert.equal(reset.reloading,false);
 const audio=await page.evaluate(()=>window.__lmgAudio);assert.ok(audio.some(a=>a.src.startsWith('lmg_box_release')));assert.ok(audio.some(a=>a.src.startsWith('lmg_box_seat')));assert.ok(audio.some(a=>a.src.startsWith('lmg_charge')));assert.ok(audio.some(a=>a.src.startsWith('lmg_feed_cover_close')));
 const webAudio=await page.evaluate(()=>window.__lmgWebAudio);assert.equal(webAudio.length,7,'Seven real player rounds produce seven reports');assert.equal(audio.filter(a=>a.src.startsWith('lmg_feed_cover_close')).length,2,'Only the two completed covers make an impact');assert.deepEqual(webAudio[5].stops,[],'Empty automatic reload preserves the final report tail');assert.ok(webAudio.every(a=>!a.loop&&a.rate===1));writeFileSync(resolve(output,'web-audio.json'),JSON.stringify(webAudio,null,2)+'\n');
 const recording=await page.evaluate(()=>new Promise(resolve=>{const r=window.__lmgRecorder;if(!r)return resolve(null);r.recorder.onstop=async()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(r.chunks,{type:r.recorder.mimeType}));};r.recorder.stop();}));if(recording)writeFileSync(resolve(output,'live-firing.webm'),Buffer.from(recording,'base64'));
 checks.push('Actual R tactical/empty reload; automatic fire before/after; pause/resume; switch/cancel; two-hand sprint firing restriction; ADS; death/redeployment; bundled audio');
 writeFileSync(resolve(output,'audio-playback.json'),JSON.stringify(audio,null,2)+'\n');
 if(process.env.LMG_VIDEO==='1') {
  console.log('Capturing bounded nine-second clock-stepped tactical + empty reload clip');
  const frames=resolve('work/lmg-video-frames');mkdirSync(frames,{recursive:true});
  await page.evaluate(()=>{const g=window.__lmg;g.hold=true;g.pose('idle');g.renderer.setPixelRatio(.5);g.freezeBackdrop();});
  let index=0;
  for(const [action,count]of[['tactical',40],['empty',50]]) {
    await page.evaluate(a=>window.__lmg.pose(a,0),action);
    for(let n=0;n<count;n++) {
      const jpeg=await page.evaluate(()=>window.__lmg.frame(.1));writeFileSync(resolve(frames,String(index++).padStart(3,'0')+'.jpg'),Buffer.from(jpeg,'base64'));
    }
  }
  // Source mechanical clips are muxed at events from this same baseline clock.
  // This is an event-synchronized evidence mix, not live microphone output.
  const audioDir=resolve('src/assets/audio/weapons/lmg-fidelity');
  const args=['-loglevel','error','-y','-framerate','10','-i',resolve(frames,'%03d.jpg')];
  for(const file of['lmg_box_release.wav','lmg_box_seat.wav','lmg_feed_cover_close.wav','lmg_box_release.wav','lmg_box_seat.wav','lmg_feed_cover_close.wav','lmg_charge.wav'])args.push('-i',resolve(audioDir,file));
  args.push('-filter_complex','[1:a]adelay=896|896[a1];[2:a]adelay=2110|2110[a2];[3:a]adelay=3066|3066[a3];[4:a]adelay=4896|4896[a4];[5:a]adelay=6110|6110[a5];[6:a]adelay=7066|7066[a6];[7:a]adelay=7440|7440[a7];[a1][a2][a3][a4][a5][a6][a7]amix=inputs=7:normalize=0,apad=whole_dur=9[a]', '-map','0:v','-map','[a]','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-t','9','-movflags','+faststart',resolve(output,'reloads.mp4'));
  const result=spawnSync('ffmpeg',args,{encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stderr);
  checks.push('Nine-second 10 FPS clock-stepped production viewmodel clip over frozen real-game backdrop; event-synchronized approved LMG mechanical audio; approved cover impact included');
 }

 }
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'validation.json'),JSON.stringify({renderer:'Chromium SwiftShader; actual App/WeaponStudio',evidence,checks,errors},null,2)+'\n');console.log('PASS: '+checks.join('; '));
}finally{clearTimeout(deadline);await browser?.close();await server.close();}
