import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const baseline = process.env.SHOTGUN_BASELINE === '1';
const output = resolve(process.env.SHOTGUN_OUTPUT ?? 'performance-results/shotgun-after');
mkdirSync(output,{recursive:true});
const port = Number(process.env.SHOTGUN_PORT ?? 3103);
const server = await createServer({root:process.env.SHOTGUN_ROOT,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true},plugins:[{
  name:'shotgun-acceptance-probe', enforce:'pre', transform(code,id) {
    if(!id.endsWith('/src/App.tsx')) return;
    const needle='    // Main Game Loop'; assert.equal(code.split(needle).length,2);
    code=code.replace(needle,`
      window.__shotgunProbe={hold:false,frames:[],record:false,
        get state(){return gameStateRef.current;},player,manager:vmManager,renderer,camera,
        get ws(){return currentSlotState();}, get weapon(){return currentSlot();},
        equip(id,ammo){stopWeaponAudio();cancelWeaponReload(currentSlotState());const w=WEAPONS.find(w=>w.id===id);playerLoadout[0]=w;playerWeaponState[0]={ammo:ammo??w.mag,reserve:w.reserve};switchSlot(0);player.aiming=false;vmManager.resetEffects();},
        kill(){applyDamageToPlayer(999999,true,true,null);},
        sample(){const s=currentSlotState(),q=s.reloadSequence,m=vmManager.root.getObjectByName('Weapon_shotgun');return {at:performance.now(),id:currentSlot().id,ammo:s.ammo,reserve:s.reserve,reloading:!!s.reloading,phase:q?.phases[q.index]?.phase,elapsed:q?.elapsed,inserted:q?.inserted,cycle:s.shotgunCycle?{...s.shotgunCycle}:null,bolt:s.boltCycleT??0,pending:!!s.pendingReloadShot,needsChamber:!!s.needsChamber,pump:m?.getObjectByName('pump')?.position.z,hand:vmManager.root.getObjectByName('leftHand')?.position.toArray()};},
        snapshot(action,position,aim=false){
          this.equip('shotgun',action==='empty'?0:action==='tactical'?2:6);this.hold=true;
          const w=currentSlot(),s=currentSlotState();
          for(let n=0;n<60;n++)vmManager.update(1/60,w,s,aim,false,true,false,false,false,0,true,true);
          camera.fov=aim?w.adsFov:HIP_FOV;camera.updateProjectionMatrix();
          let seconds=0;
          if(action==='shot') { s.ammo--; ${baseline ? 'vmManager.addRecoil(.075,.095);vmManager.triggerShotgunPump();' : 'beginShotgunCycle(s);'} seconds=position; }
          if(action==='empty'||action==='tactical') {
            beginWeaponReload(w,s);
            const q=s.reloadSequence,insert=q.phases.find(p=>p.phase==='insert').duration;
            seconds=q.phases[0].duration+(position.shell??0)*insert+(position.phase==='chamber' ? insert+position.fraction*q.phases.find(p=>p.phase==='chamber').duration : position.fraction*insert);
          }
          for(let left=seconds;left>1e-8;){const dt=Math.min(1/144,left);left-=dt;advanceWeaponReload(w,s,dt);vmManager.update(dt,w,s,aim,false,true,false,false,false,0,true,true);}
          setHudData(old=>({...old,currentWeapon:w,weaponSlotState:{...s},playerLoadout:[...playerLoadout],playerLoadoutStates:playerWeaponState.map(s=>({...s}))}));
          renderer.render(scene,camera);return {...this.sample(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,programs:renderer.info.programs.length};
        }
      };
${needle}`);
    const tick='      const dt = Math.min(0.05, clock.getDelta());';assert.equal(code.split(tick).length,2);
    code=code.replace(tick,tick+`\n      if(window.__shotgunProbe?.hold){renderer.render(scene,camera);return;}\n      if(window.__shotgunProbe?.record&&window.__shotgunProbe.frames.length<5000)window.__shotgunProbe.frames.push(window.__shotgunProbe.sample());`);
    return code;
  }
}]});
let browser,video;
const errors=[],screens=[],checks=[];
const deadline=setTimeout(()=>{console.error('FAIL: shotgun acceptance exceeded 600 seconds');void browser?.close();void server.close();process.exitCode=1;},600000);
try {
  await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.BENCHMARK_BROWSER??'/usr/bin/chromium',args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  async function boot(record=false) {
  const page=await browser.newPage({viewport:{width:1280,height:720},...(record?{recordVideo:{dir:resolve(output,'raw-video'),size:{width:1280,height:720}}}:{})});if(record)video=page.video();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded acceptance probe'));
    window.__shotgunAudio=[];const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(/shotgun_/.test(this.src))window.__shotgunAudio.push({at:performance.now(),src:this.src.split('/').pop(),rate:this.playbackRate,offset:this.currentTime});return play.call(this);};
  });
  await page.goto(`http://127.0.0.1:${port}`);
  await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
  await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
  await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
  await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
  await page.waitForFunction(()=>window.__shotgunProbe?.state==='playing');
    return page;
  }
  let page=await boot();
  async function snapshot(name,action,position,aim=false) {
    const sample=await page.evaluate(({action,position,aim})=>window.__shotgunProbe.snapshot(action,position,aim),{action,position,aim});
    await page.screenshot({path:resolve(output,name+'.png')});screens.push({name,...sample});
  }
  await snapshot('hip','idle',0);await snapshot('ads','idle',0,true);
  for(const [name,time] of [['shot-instant',0],['peak-recoil',.035],['recovery',.15],['pump-rear',.42],['pump-forward',.57],['pump-lock',.69],['ready',.75]])await snapshot(name,'shot',time);
  for(const [name,fraction] of [['pickup',.16],['approach',.52],['press',.69],['seated',.75]])await snapshot('tactical-'+name,'tactical',{shell:0,fraction});
  for(const [name,shell,fraction] of [['first',0,.69],['middle',2,.69],['last',5,.69],['chamber',5,.57]])await snapshot('empty-'+name,'empty',{shell,fraction,...(name==='chamber'?{phase:'chamber'}:{})});
  await page.setViewportSize({width:1680,height:720});
  await page.evaluate(()=>{const g=window.__shotgunProbe;g.renderer.setSize(1680,720);g.camera.aspect=1680/720;g.camera.updateProjectionMatrix();});
  await snapshot('wide-hip','idle',0);await snapshot('wide-ads','idle',0,true);await snapshot('wide-shell','tactical',{shell:0,fraction:.69});
  checks.push('20 real-scene camera/UI pose samples; 16:9 and 21:9; deterministic presentation clock, not live pacing');
  console.log('PASS: shotgun rendered pose samples',baseline?'before':'after');
  if(!baseline && process.env.SHOTGUN_SKIP_LIVE!=='1') {
    // Record a fresh fixed-viewport page. Changing the viewport during a
    // screencast can crop frames in Chromium. Lower only this test's backing
    // resolution for software throughput; the App clock is untouched.
    await page.close();page=await boot(true);
    await page.evaluate(()=>{const g=window.__shotgunProbe;g.renderer.setPixelRatio(.65);g.renderer.setSize(1280,720);g.camera.aspect=16/9;g.camera.fov=74;g.camera.updateProjectionMatrix();g.equip('shotgun');g.hold=false;g.record=true;window.__shotgunAudio=[];});
    await page.waitForTimeout(200);
    await page.screenshot({path:resolve(output,'live-start.png')});
    const click=async()=>{await page.mouse.move(480,260);await page.mouse.down();await page.mouse.up();};
    await click();await page.waitForFunction(()=>window.__shotgunProbe.ws.ammo===5);
    await page.waitForFunction(()=>!window.__shotgunProbe.ws.shotgunCycle);await page.waitForTimeout(900);
    await click();await page.waitForFunction(()=>window.__shotgunProbe.ws.ammo===4);
    await page.waitForFunction(()=>!window.__shotgunProbe.ws.shotgunCycle);
    await page.keyboard.press('r');await page.waitForFunction(()=>window.__shotgunProbe.ws.reloading);
    await page.waitForFunction(()=>!window.__shotgunProbe.ws.reloading);
    assert.deepEqual(await page.evaluate(()=>{const s=window.__shotgunProbe.ws;return[s.ammo,s.reserve];}),[6,34]);
    await page.screenshot({path:resolve(output,'live-partial-ready.png')});
    // Fire the magazine dry through actual mouse input, not a fixture ammo edit.
    for(let n=5;n>=0;n--){await page.waitForTimeout(900);await click();await page.waitForFunction(n=>window.__shotgunProbe.ws.ammo===n,n);await page.waitForFunction(()=>!window.__shotgunProbe.ws.shotgunCycle);}
    await page.keyboard.press('r');await page.waitForFunction(()=>window.__shotgunProbe.ws.reloading);
    await page.waitForFunction(()=>{const s=window.__shotgunProbe.ws,q=s.reloadSequence;return q?.inserted===2&&q.phases[q.index].phase==='insert'&&q.elapsed>.2;});
    await page.mouse.down();
    await page.waitForFunction(()=>window.__shotgunProbe.ws.pendingReloadShot);
    await page.waitForFunction(()=>window.__shotgunProbe.ws.ammo===1&&!window.__shotgunProbe.ws.pendingReloadShot);
    await page.mouse.up();await page.waitForFunction(()=>!window.__shotgunProbe.ws.shotgunCycle);
    assert.deepEqual(await page.evaluate(()=>{const s=window.__shotgunProbe.ws;return[s.ammo,s.reserve,!!s.reloading,!!s.pendingReloadShot];}),[1,32,false,false]);
    await page.screenshot({path:resolve(output,'live-interrupt-ready.png')});
    await page.keyboard.press('r');await page.waitForFunction(()=>!window.__shotgunProbe.ws.reloading);
    await page.screenshot({path:resolve(output,'live-end.png')});
    await page.evaluate(()=>window.__shotgunProbe.record=false);
    checks.push('Continuous actual input: two shots, partial reload, six dry shots, empty shell reload, held-fire interruption and reload finish; conserved ammo');
    console.log('PASS: live shotgun input/reload/interrupt recording');
    // Lifecycle checks outside the continuous acceptance interval.
    await page.evaluate(()=>window.__shotgunProbe.equip('shotgun',0));
    await page.keyboard.press('r');await page.mouse.down();
    await page.waitForFunction(()=>window.__shotgunProbe.ws.shotgunCycle?.kind==='fire');await page.mouse.up();
    assert.deepEqual(await page.evaluate(()=>{const s=window.__shotgunProbe.ws;return[s.ammo,s.reserve];}),[0,35]);
    await page.waitForFunction(()=>!window.__shotgunProbe.ws.shotgunCycle);
    checks.push('Holding fire before first empty shell waits for seating and chambering, then fires exactly once');
    await page.evaluate(()=>window.__shotgunProbe.equip('shotgun'));
    await click();await page.waitForFunction(()=>!!window.__shotgunProbe.ws.shotgunCycle);
    await page.keyboard.press('2');await page.waitForFunction(()=>window.__shotgunProbe.weapon.id!=='shotgun');
    await page.keyboard.press('1');assert.equal(await page.evaluate(()=>window.__shotgunProbe.ws.pendingReloadShot),false);
    await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__shotgunProbe.ws.reloading);
    await page.keyboard.press('p');const frozen=await page.evaluate(()=>JSON.stringify(window.__shotgunProbe.ws));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>JSON.stringify(window.__shotgunProbe.ws)),frozen);await page.locator('#btn-resume').click();
    await page.waitForFunction(()=>!window.__shotgunProbe.ws.reloading);
    await page.keyboard.press('r'); // full/ready R is a no-op
    await page.evaluate(()=>window.__shotgunProbe.kill());await page.getByRole('button',{name:'[ PLAY AGAIN ]',exact:true}).click();await page.waitForFunction(()=>window.__shotgunProbe.state==='playing');
    await page.keyboard.press('p');await page.locator('#btn-to-lobby-pause').click();await page.getByRole('button',{name:'DEPLOY OPERATION',exact:true}).waitFor();
    checks.push('Actual weapon switch during pump; chamber-only return, pause/resume, repeated R, death/replay/lobby');
  }
  const live=await page.evaluate(()=>({frames:window.__shotgunProbe?.frames??[],audio:window.__shotgunAudio??[]}));
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(output,'results.json'),JSON.stringify({completedAt:new Date().toISOString(),baseline,codeCommit:process.env.SHOTGUN_COMMIT,softwareRenderer:'Chromium SwiftShader',screens,checks,errors,...live},null,2)+'\n');
} finally {clearTimeout(deadline);await browser?.close();await server.close();}
if(video)writeFileSync(resolve(output,'video-source.json'),JSON.stringify({path:await video.path(),note:'Raw fixed-viewport actual App recording; static pose samples are in a separate page. No recorded audio.'},null,2)+'\n');
