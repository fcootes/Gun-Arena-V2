import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const output=resolve(process.env.MINIGUN_OUTPUT??'work/minigun-hold');mkdirSync(output,{recursive:true});
const errors=[],port=Number(process.env.MINIGUN_PORT??3171);
// Test-only clock/render gate: execute the complete production App frame, with
// its actual input, movement, damage, rotor, cooling and hand code. No copied
// firing/heat state machine, substitute mesh, lighting or rig in the fixture.
const server=await createServer({root:process.env.MINIGUN_ROOT,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true,hmr:false},plugins:[{name:'minigun-hold-evidence',enforce:'pre',transform(code,id){
 if(!id.endsWith('/src/App.tsx'))return;
 const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
 return code.replace(needle,`
 const minigunNativeRender=renderer.render.bind(renderer);
 window.__minigun={hold:false,stepping:false,renderer,scene,camera,player,manager:vmManager,
  get state(){return gameStateRef.current;},get ws(){return currentSlotState();},
  equip(){clearGameplayInput();stopWeaponAudio();cancelWeaponReload(currentSlotState());const w=WEAPONS.find(w=>w.id==='minigun');playerLoadout[0]=w;playerLoadout[1]=WEAPONS[0];playerWeaponState[0]={ammo:w.mag,reserve:w.reserve,heat:0};playerWeaponState[1]={ammo:30,reserve:90};switchSlot(0);player.classReloadMultiplier=1;player.health=player.maxHealth=100000;player.aiming=false;player.yaw=0;player.pitch=0;vmManager.resetEffects();renderer.setPixelRatio(1);renderer.setSize(960,540,false);renderer.render=()=>{};this.hold=true;window.__minigunTime=performance.now();},
  step(dt=1/120){this.forcedDelta=dt;this.stepping=true;window.__minigunTime+=dt*1000;animate();this.stepping=false;this.forcedDelta=undefined;return this.stats();},
  stats(){const root=vmManager.root.getObjectByName('Weapon_minigun'),left=root?.getObjectByName('leftHand'),right=root?.getObjectByName('rightHand');return{time:window.__minigunTime,pitch:player.pitch,yaw:player.yaw,position:player.pos.toArray(),velocity:player.vel.toArray(),aiming:player.aiming,sprinting:player.sprinting,shots:player.shotsFired,ammo:this.ws.ammo,reserve:this.ws.reserve,heat:this.ws.heat,warmup:this.ws.spinWarmup,spin:this.ws.spinSpeed,overheated:!!this.ws.overheated,reloading:!!this.ws.reloading,remaining:this.ws.reloadT,phase:this.ws.reloadSequence?.phases[this.ws.reloadSequence.index].phase,root:root?.position.toArray(),rotation:root?.quaternion.toArray(),left:left?.position.toArray(),leftRotation:left?.quaternion.toArray(),right:right?.position.toArray(),rotor:root?.getObjectByName('rotor')?.rotation.z,memory:{...renderer.info.memory}};},
  capture(){if(this.suppressSmoke)for(const particle of smokePool)particle.mesh.visible=false;minigunNativeRender(scene,camera);if(this.suppressSmoke)for(const particle of smokePool)particle.mesh.visible=true;return{image:renderer.domElement.toDataURL('image/png').split(',')[1],state:this.stats()};},
  inspect(mode){const root=vmManager.root.getObjectByName('Weapon_minigun');root.updateWorldMatrix(true,true);const view=new THREE.PerspectiveCamera(mode==='left'||mode==='right'?48:65,960/540,.02,500);const positions={side:[.72,-.10,-.30],reference:[-.04,.18,-.35],left:[-.18,.10,-.82],right:[.58,-.27,-.32]};view.position.copy(camera.localToWorld(new THREE.Vector3(...positions[mode])));view.lookAt(root.localToWorld(new THREE.Vector3(...(mode==='left'?[0,.145,-.24]:mode==='right'?[0,-.145,.18]:[0,0,-.05]))));view.updateMatrixWorld(true);if(this.suppressSmoke)for(const particle of smokePool)particle.mesh.visible=false;minigunNativeRender(scene,view);if(this.suppressSmoke)for(const particle of smokePool)particle.mesh.visible=true;return{image:renderer.domElement.toDataURL('image/png').split(',')[1],state:{...this.stats(),inspection:mode,description:'Test-only inspection camera; actual original first-person assembly, pose, renderer and world lighting. Weapon/grip transforms are unchanged.'}};},
  live(){this.hold=false;window.__minigunTime=undefined;},
  kill(){applyDamageToPlayer(999999,true,true,null);}
 };
`+needle)
 .replace('      animId = requestAnimationFrame(animate);','      if(!window.__minigun?.stepping)animId = requestAnimationFrame(animate);')
 .replace('      const dt = Math.min(0.05, clock.getDelta());','      const dt = window.__minigun?.forcedDelta ?? Math.min(0.05, clock.getDelta());\n      if(window.__minigun?.hold&&!window.__minigun?.stepping)return;');
 }}]});
let browser;const deadline=setTimeout(()=>{void browser?.close();void server.close();},1800000);
try{
 await server.listen();browser=await chromium.launch({headless:true,...process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{},args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|Shader|GL_INVALID|THREE/.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{
  const nativeNow=performance.now.bind(performance);performance.now=()=>window.__minigunTime??nativeNow();
  HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded input test'));
  window.__minigunAudio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){window.__minigunAudio.push(this.src.split('/').pop());return play.apply(this,args);};
  let seed=204;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 });
 await page.goto(`http://127.0.0.1:${port}`);await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:process.env.MINIGUN_MAP==='area51'?/AREA 51 SUBTERRANEAN FACILITY/:/TRAINING FIELD/}).click();await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();await page.waitForFunction(()=>window.__minigun?.state==='playing');
 await page.evaluate(()=>{window.__minigun.equip();for(let i=0;i<120;i++)window.__minigun.step();});
 const samples=[];
 const save=async name=>{const r=await page.evaluate(()=>window.__minigun.capture());writeFileSync(resolve(output,name+'.png'),Buffer.from(r.image,'base64'));samples.push({name,...r.state});console.log('Captured '+name);return r.state;};
 await save('idle');
 if(process.env.MINIGUN_DIAGNOSTIC==='1'){
  await page.evaluate(()=>{window.__minigun.ws.heat=100;window.__minigun.suppressSmoke=true;});await page.keyboard.press('KeyR');
  const frames=resolve(output,'frames');mkdirSync(frames,{recursive:true});const states=[];
  for(let frame=0;frame<84;frame++){
   const r=await page.evaluate(()=>{for(let step=0;step<4;step++)window.__minigun.step();return window.__minigun.capture();});
   writeFileSync(resolve(frames,String(frame).padStart(4,'0')+'.png'),Buffer.from(r.image,'base64'));states.push(r.state);
   if(frame%30===0)console.log('Rendered diagnostic '+frame+'/84');
  }
  assert.ok(states.some(s=>s.reloading));assert.ok(!states.at(-1).reloading);assert.equal(states.at(-1).heat,0);assert.equal(states.at(-1).ammo,999);
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',resolve(frames,'%04d.png'),'-vf',"drawtext=text='DIAGNOSTIC - cooling smoke hidden for hand visibility':fontcolor=white:fontsize=18:box=1:boxcolor=black@0.75:x=12:y=12",'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',resolve(output,'heat-hand-diagnostic.mp4')]);
  for(const [name,frame]of [['unhook',9],['withdrawn',25],['return',49],['regripped',67]])execFileSync('cp',[resolve(frames,String(frame).padStart(4,'0')+'.png'),resolve(output,'diagnostic-'+name+'.png')]);
  writeFileSync(resolve(output,'diagnostic-provenance.json'),JSON.stringify({description:'Actual production App/manual R cooling and first-person renderer, existing Area 51. Test-only smoke visibility suppression at rendering, restored immediately; no production smoke change. Silent offline 120 Hz simulation exported at 30 FPS. Video caption explicitly identifies diagnostic view.',states},null,2));
 }else if(process.env.MINIGUN_POSE_ONLY==='1'){
  await page.mouse.down({button:'right'});await page.evaluate(()=>{for(let i=0;i<90;i++)window.__minigun.step();});await save('ads');await page.mouse.up({button:'right'});
 }else{
  if(process.env.MINIGUN_ACCEPTANCE==='1'){
   const advance=async n=>page.evaluate(n=>{for(let i=0;i<n;i++)window.__minigun.step();},n);
   const inspect=async(mode,name)=>{const r=await page.evaluate(mode=>window.__minigun.inspect(mode),mode);writeFileSync(resolve(output,name+'.png'),Buffer.from(r.image,'base64'));samples.push({name,...r.state});console.log('Captured '+name);};
   for(const [mode,name]of [['side','inspection-both-grips'],['reference','inspection-reference-angle'],['left','contact-left-top-handle'],['right','contact-right-rear-control']])await inspect(mode,name);
   const bare=await page.evaluate(()=>{const root=window.__minigun.manager.root.getObjectByName('Weapon_minigun'),nodes=['FirstPersonHands','minigunleftUpperArm','minigunrightUpperArm'].map(name=>root.getObjectByName(name)),flags=nodes.map(n=>n.visible);nodes.forEach(n=>n.visible=false);const result=window.__minigun.inspect('side');nodes.forEach((n,i)=>n.visible=flags[i]);return result;});writeFileSync(resolve(output,'inspection-physical-handles-no-hands.png'),Buffer.from(bare.image,'base64'));samples.push({name:'inspection-physical-handles-no-hands',diagnostic:'Hands/clothing hidden for this structural inspection only',...bare.state});
   await page.keyboard.down('KeyW');await advance(120);await save('walking');await page.keyboard.down('ShiftLeft');await advance(12);await save('sprint-entry');await advance(60);await save('sprint-held');await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');await advance(90);await save('movement-recovered');
   await page.mouse.down({button:'right'});await advance(90);await save('ads');await page.mouse.up({button:'right'});await advance(90);
   const before=await page.evaluate(()=>window.__minigun.player.shotsFired);await page.mouse.down();await advance(24);const warm=await save('spin-up');assert.equal(warm.shots,before);await advance(180);const firing=await save('sustained-firing');assert.ok(firing.shots>before);assert.equal(firing.spin,28);
   await page.evaluate(()=>{for(let i=0;i<800&&!window.__minigun.ws.overheated;i++)window.__minigun.step();});await page.mouse.up();const hot=await save('automatic-overheat-start');assert.ok(hot.overheated&&hot.reloading);
   for(const [ticks,name]of [[12,'unhook'],[54,'withdrawal'],[66,'heat-reaction'],[78,'return-approach'],[72,'returned-top-grip']]){
    await advance(ticks);await save(name);
    if(name==='returned-top-grip')await inspect('side','returned-top-grip-side');
    if(name==='withdrawal'||name==='return-approach'){await page.evaluate(()=>window.__minigun.suppressSmoke=true);await inspect('side','diagnostic-'+name+'-side-smoke-hidden');await page.evaluate(()=>window.__minigun.suppressSmoke=false);}
   }
   const ready=await page.evaluate(()=>window.__minigun.stats());assert.ok(!ready.reloading&&!ready.overheated);assert.equal(ready.heat,0);assert.equal(ready.ammo,999);assert.equal(ready.reserve,999);
   await page.keyboard.press('Digit2');await page.keyboard.press('Digit1');await advance(90);await save('re-equipped');
   const audio=await page.evaluate(()=>window.__minigunAudio);for(const asset of ['minigun_warmup','minigun_fire_auto_loop','minigun_spin_down','minigun_cooling_hiss'])assert.ok(audio.some(a=>a.includes(asset)),asset);writeFileSync(resolve(output,'audio-events.json'),JSON.stringify(audio,null,2));
  }else if(process.env.MINIGUN_LIVE_ONLY!=='1'){
  const frames=resolve(output,'frames');mkdirSync(frames,{recursive:true});const states=[],ranges=[];let index=0;
  await page.evaluate(()=>{window.__minigun.renderer.setSize(960,540,false);});
  for(const [mode,count]of [['idle',30],['walking',60],['stopping',15],['sustained-fire',138],['overheat-recovery',84],['ready',15]]){
   if(mode==='walking')await page.keyboard.down('KeyW');
   if(mode==='stopping')await page.keyboard.up('KeyW');
   if(mode==='sustained-fire'){await page.mouse.move(850,450);await page.mouse.down();}
   if(mode==='overheat-recovery')await page.mouse.up();
   const start=index;
   for(let frame=0;frame<count;frame++){
    const r=await page.evaluate(()=>{for(let step=0;step<4;step++)window.__minigun.step();return window.__minigun.capture();});
    writeFileSync(resolve(frames,String(index++).padStart(4,'0')+'.png'),Buffer.from(r.image,'base64'));states.push({mode,frame:index,...r.state});
    if(frame%30===0)console.log('Rendered '+mode+' '+frame+'/'+count);
   }
   ranges.push({mode,start,end:index});await save(mode);
  }
  const fire=states.filter(s=>s.mode==='sustained-fire');assert.ok(fire.some(s=>s.warmup<.5&&s.shots===fire[0].shots),'Warmup precedes firing');assert.ok(fire.some(s=>s.spin===28));assert.ok(fire.at(-1).overheated,'Actual four-second firing reaches overheat');
  const recovery=states.filter(s=>s.mode==='overheat-recovery');assert.ok(recovery.some(s=>s.reloading));assert.ok(!recovery.at(-1).overheated&&!recovery.at(-1).reloading);assert.equal(recovery.at(-1).heat,0);
  for(const s of states){assert.equal(s.ammo,999);assert.equal(s.reserve,999);}
  for(const [name,frame]of [['hand-withdrawal',10],['heat-reaction',27],['return-approach',47],['regripped',63]]){
   const source=resolve(frames,String(ranges.find(r=>r.mode==='overheat-recovery').start+frame).padStart(4,'0')+'.png');execFileSync('cp',[source,resolve(output,name+'.png')]);
  }
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',resolve(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',resolve(output,'first-person-hold-and-overheat.mp4')]);
  writeFileSync(resolve(output,'video-provenance.json'),JSON.stringify({fps:30,simulationHz:120,description:'Complete production App/input/movement/firing/heat/rendering. Deterministic test clock, 120 Hz updates, 30 FPS offline normal-speed simulation playback. Existing map and lighting, no substitute meshes. Silent; not native GPU performance or audible acceptance.',ranges,states},null,2));
  await page.mouse.down({button:'right'});await page.evaluate(()=>{for(let i=0;i<90;i++)window.__minigun.step();});await save('ads');await page.mouse.up({button:'right'});
  await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.evaluate(()=>{for(let i=0;i<90;i++)window.__minigun.step();});await save('sprint');await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyP');const frozen=await page.evaluate(()=>{for(let i=0;i<15;i++)window.__minigun.step();return window.__minigun.stats();});await page.evaluate(()=>{for(let i=0;i<15;i++)window.__minigun.step();});const paused=await page.evaluate(()=>window.__minigun.stats());assert.deepEqual(paused.left,frozen.left);assert.deepEqual(paused.rotation,frozen.rotation);await page.keyboard.press('KeyP');
  await page.keyboard.press('Digit2');await page.keyboard.press('Digit1');await page.evaluate(()=>{for(let i=0;i<90;i++)window.__minigun.step();});await save('re-equipped');
  const audio=await page.evaluate(()=>window.__minigunAudio);for(const asset of ['minigun_warmup','minigun_fire_auto_loop','minigun_spin_down','minigun_cooling_hiss'])assert.ok(audio.some(a=>a.includes(asset)),asset);writeFileSync(resolve(output,'audio-events.json'),JSON.stringify(audio,null,2));
  }
  // Independent native RAF/input smoke: remove the test clock and let real
  // browser time drive the same App. Rendering stays gated except screenshots.
  await page.evaluate(()=>{window.__minigun.equip();window.__minigun.live();});
  const before=await page.evaluate(()=>window.__minigun.player.shotsFired);
  await page.mouse.down();await page.waitForFunction(()=>window.__minigun.ws.spinWarmup>0&&window.__minigun.ws.spinWarmup<.5);
  assert.equal(await page.evaluate(()=>window.__minigun.player.shotsFired),before);
  await page.waitForFunction(n=>window.__minigun.player.shotsFired>=n+3,before);await page.mouse.up();await page.waitForFunction(()=>window.__minigun.ws.spinSpeed===0);
  await page.mouse.down();await page.waitForFunction(()=>window.__minigun.ws.overheated);await page.mouse.up();const hot=await save('live-overheated');
  assert.ok(hot.reloading);await page.waitForFunction(()=>!window.__minigun.ws.overheated&&!window.__minigun.ws.reloading);const cool=await save('live-cooled');assert.equal(cool.heat,0);assert.equal(cool.ammo,999);assert.equal(cool.reserve,999);
  await page.keyboard.press('KeyP');await page.waitForFunction(()=>window.__minigun.state==='paused');const pausedPose=await page.evaluate(()=>window.__minigun.stats());await page.waitForTimeout(120);assert.deepEqual((await page.evaluate(()=>window.__minigun.stats())).left,pausedPose.left);await page.keyboard.press('KeyP');
  writeFileSync(resolve(output,'live-validation.json'),JSON.stringify({clock:'Native browser RAF/performance.now, no forced delta',rendering:'Routine rendering suspended for software WebGL; actual render at screenshots. No native performance claim.',checks:['Warmup precedes fire','LMB sustained fire and spin-down','Automatic overheat and original thermal completion','999/999 supply retained','Pause freezes hand'],hot,cool,errors},null,2));
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'validation.json'),JSON.stringify({baselineRoot:process.env.MINIGUN_ROOT,map:process.env.MINIGUN_MAP??'training',samples,errors},null,2));console.log('PASS actual Minigun first-person hold/input/rendering');
}catch(e){console.error(e);try{const page=browser?.contexts()[0]?.pages()[0];if(page){writeFileSync(resolve(output,'failure.json'),JSON.stringify(await page.evaluate(()=>window.__minigun?.stats()),null,2));await page.screenshot({path:resolve(output,'failure.png')});}}catch{}throw e;}finally{clearTimeout(deadline);await browser?.close();await server.close();}
