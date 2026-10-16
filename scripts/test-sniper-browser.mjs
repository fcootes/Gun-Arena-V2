import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

// Reuses the shotgun acceptance fixture's Training bootstrap and App injection.
// No production hooks, recording, broad lighting or performance benchmark.
const output=resolve(process.env.SNIPER_OUTPUT??'performance-results/sniper-batch2');
mkdirSync(output,{recursive:true});
const port=3111,errors=[],screens=[],checks=[];
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true},plugins:[{
 name:'sniper-acceptance-probe',enforce:'pre',transform(code,id){
  if(!id.endsWith('/src/App.tsx'))return;
  const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
  code=code.replace(needle,`
    window.__sniperProbe={hold:false,player,manager:vmManager,renderer,camera,
      get state(){return gameStateRef.current;},get ws(){return currentSlotState();},
      equip(id,ammo,reserve){stopWeaponAudio();cancelWeaponReload(currentSlotState());const w=WEAPONS.find(w=>w.id===id);playerLoadout[0]=w;playerWeaponState[0]={ammo:ammo??w.mag,reserve:reserve??w.reserve,lastFired:-100};switchSlot(0);player.aiming=false;vmManager.resetEffects();},
      kill(){applyDamageToPlayer(999999,true,true,null);},
      sample(){const s=currentSlotState(),m=vmManager.root.getObjectByName('Weapon_'+currentSlot().id);return {id:currentSlot().id,ammo:s.ammo,reserve:s.reserve,needsChamber:!!s.needsChamber,reloading:!!s.reloading,bolt:s.sniperCycle?{...s.sniperCycle}:null,boltT:s.boltCycleT,charge:s.chargeTimer,warmup:s.spinWarmup,burst:s.burstRemaining,heat:s.heat??0,shots:player.shotsFired,sprinting:player.sprinting,aiming:player.aiming,handVisible:m?.getObjectByName('FirstPersonHands')?.visible,receiverVisible:m?.getObjectByName('receiver')?.visible,boltPosition:m?.getObjectByName('bolt')?.position.toArray(),scope:document.getElementById('scope-overlay')?.style.display};},
      pose(action,t=0){this.equip('sniper',action==='reload'?2:4);this.hold=true;
        const w=currentSlot(),s=currentSlotState(),aim=action==='ads';
        for(let n=0;n<100;n++)vmManager.update(1/60,w,s,aim,false,true,false,false,false,0,true,true);
        camera.fov=aim?w.adsFov:HIP_FOV;camera.updateProjectionMatrix();
        if(action==='bolt'){s.needsChamber=true;beginSniperCycle(s);}
        if(action==='reload')beginWeaponReload(w,s);
        for(let left=t;left>1e-8;){const dt=Math.min(1/144,left);left-=dt;advanceWeaponReload(w,s,dt);vmManager.update(dt,w,s,aim,false,true,false,false,false,0,true,true);}
        const scope=document.getElementById('scope-overlay');if(scope)scope.style.display=aim?'block':'none';
        const cross=document.getElementById('crosshair');if(cross)cross.style.display=aim?'none':'block';
        setHudData(old=>({...old,currentWeapon:w,weaponSlotState:{...s},playerLoadout:[...playerLoadout],playerLoadoutStates:playerWeaponState.map(s=>({...s}))}));
        renderer.render(scene,camera);return this.sample();
      }
    };
${needle}`);
  const tick='      const dt = Math.min(0.05, clock.getDelta());';assert.equal(code.split(tick).length,2);
  return code.replace(tick,tick+'\n      if(window.__sniperProbe?.hold){renderer.render(scene,camera);return;}');
 }
}]});
let browser,video;
const deadline=setTimeout(()=>{console.error('Sniper smoke exceeded bounded 5 minute window');void browser?.close();void server.close();process.exitCode=1;},300000);
try {
  const launch=()=>chromium.launch({headless:true,executablePath:process.env.BENCHMARK_BROWSER??'/usr/bin/chromium',args:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  await server.listen();browser=await launch();
  async function boot(record=false) {
  const page=await browser.newPage({viewport:{width:1280,height:720},...(record?{recordVideo:{dir:resolve(output,'raw-video'),size:{width:1280,height:720}}}:{})});if(record)video=page.video();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('embedded acceptance probe'));
    window.__weaponAudio=[];const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(/sniper_|shotgun_|railgun_|minigun_/.test(this.src))window.__weaponAudio.push({at:performance.now(),src:this.src.split('/').pop(),rate:this.playbackRate,offset:this.currentTime});return play.call(this);};
  });
  await page.goto(`http://127.0.0.1:${port}`);
  await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
  await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();
  await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();
  await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();
  await page.waitForFunction(()=>window.__sniperProbe?.state==='playing');
    return page;
  }

 let page=await boot();
 for(const [name,action,t] of [['hip','idle',0],['ads','ads',0],['bolt-closed','bolt',.16],['bolt-open','bolt',.55],['bolt-return','bolt',.80],['magazine-insertion','reload',.14+.4212+.9477*.88],['return-ready','idle',0]]){
   const sample=await page.evaluate(({action,t})=>window.__sniperProbe.pose(action,t),{action,t});
   await page.screenshot({path:resolve(output,name+'.png')});screens.push({name,...sample});
 }
 checks.push('Seven full-resolution Training camera/HUD samples: hip, ADS, closed/open/return bolt, magazine seating, ready');
 await page.evaluate(()=>{const g=window.__sniperProbe;g.hold=false;g.renderer.setPixelRatio(.30);g.renderer.setSize(1280,720);g.equip('sniper');window.__weaponAudio=[];});
 const sample=()=>page.evaluate(()=>window.__sniperProbe.sample());
 await page.mouse.down();await page.waitForFunction(()=>window.__sniperProbe.ws.needsChamber);await page.mouse.up();
 assert.equal((await sample()).ammo,4);
 await page.mouse.click(640,360,{clickCount:3});
 assert.equal((await sample()).ammo,4);assert.equal((await sample()).bolt,null);
 await page.mouse.down();await page.waitForTimeout(350);assert.equal((await sample()).ammo,4);assert.equal((await sample()).bolt,null);await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.__weaponAudio.filter(e=>e.src.includes('sniper_bolt')).length),0);
 await page.keyboard.down('r');await page.keyboard.up('r');await page.waitForFunction(()=>!!window.__sniperProbe.ws.sniperCycle);
 const pendingBeforeSwitch=await sample();
 await page.keyboard.press('Digit2');assert.notEqual((await sample()).id,'sniper');
 await page.waitForTimeout(250);
 await page.keyboard.press('Digit1');
 assert.ok((await sample()).bolt);assert.ok((await sample()).bolt.elapsed>=pendingBeforeSwitch.bolt.elapsed);
 await page.keyboard.press('p');const frozen=await sample();await page.waitForTimeout(200);assert.deepEqual((await sample()).bolt,frozen.bolt);
 await page.locator('#btn-resume').click();
 await page.waitForFunction(()=>!window.__sniperProbe.ws.needsChamber);
 await page.mouse.click(640,360);await page.waitForFunction(()=>window.__sniperProbe.ws.ammo===3);
 checks.push('Actual shot -> repeated/held click blocked without bolt audio -> R -> switch/frozen action -> pause -> completion -> second shot');
 await page.keyboard.press('r');await page.waitForFunction(()=>!window.__sniperProbe.ws.needsChamber);
 await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__sniperProbe.ws.reloading);
 await page.waitForFunction(()=>!window.__sniperProbe.ws.reloading);assert.equal((await sample()).ammo,5);assert.equal((await sample()).needsChamber,false);
 await page.evaluate(()=>window.__sniperProbe.equip('sniper',0,10));
 await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__sniperProbe.ws.reloading);await page.waitForFunction(()=>!window.__sniperProbe.ws.reloading);
 assert.equal((await sample()).ammo,5);assert.equal((await sample()).reserve,5);assert.equal((await sample()).needsChamber,true);
 await page.mouse.click(640,360);assert.equal((await sample()).ammo,5);assert.equal((await sample()).bolt,null);
 await page.mouse.down({button:'right'});await page.keyboard.press('r');
 await page.waitForFunction(()=>!!window.__sniperProbe.ws.sniperCycle);assert.equal((await sample()).aiming,false);
 await page.waitForFunction(()=>!window.__sniperProbe.ws.sniperCycle&&window.__sniperProbe.player.aiming);
 assert.equal((await sample()).receiverVisible,false);assert.equal((await sample()).handVisible,false);await page.mouse.up({button:'right'});
 checks.push('Tactical exchange stays chambered; empty exchange conserves rounds and awaits second R; held RMB unscopes during bolt and restores unobstructed ADS');
 const sprint=[];
 for(const id of ['ar','shotgun','sniper','pistol','smg','lmg','br','laser','minigun','railgun','rocket','grenade_launcher']){
   await page.evaluate(id=>{const g=window.__sniperProbe;g.equip(id);g.player.vel.set(0,0,0);g.player.onGround=true;g.ws.chargeTimer=1.19;g.ws.spinWarmup=.49;g.ws.burstRemaining=2;},id);
   await page.keyboard.down('w');await page.keyboard.down('Shift');
   await page.waitForFunction(()=>window.__sniperProbe.player.sprinting);
   const before=await sample();const audioBefore=await page.evaluate(()=>window.__weaponAudio.length);
   await page.mouse.down();await page.waitForTimeout(300);const after=await sample();await page.mouse.up();
   assert.equal(after.ammo,before.ammo,id+' sprint ammo');assert.equal(after.shots,before.shots,id+' sprint reports');
   assert.ok(after.heat<=before.heat,id+' sprint heat');
   if(id==='railgun')assert.equal(after.charge,0);
   if(id==='br')assert.equal(after.burst,0);
   sprint.push({id,before,after,audioBefore,audioAfter:await page.evaluate(()=>window.__weaponAudio.length)});
   await page.keyboard.up('Shift');await page.keyboard.up('w');
 }
 checks.push('All twelve actual App weapons reject held fire while sprinting, including queued BR burst, precharged railgun and nearly-warm minigun');
 await page.evaluate(()=>window.__sniperProbe.equip('sniper'));await page.mouse.click(640,360);await page.waitForFunction(()=>window.__sniperProbe.ws.needsChamber);
 await page.keyboard.press('r');await page.waitForFunction(()=>!!window.__sniperProbe.ws.sniperCycle);
 await page.evaluate(()=>window.__sniperProbe.kill());assert.equal((await sample()).bolt,null);
 await page.getByRole('button',{name:'[ PLAY AGAIN ]',exact:true}).click();await page.waitForFunction(()=>window.__sniperProbe.state==='playing');
 checks.push('Death cancels action; redeployment succeeds without stale sniper locks');
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'validation.json'),JSON.stringify({screens,checks,sprint,errors,audio:await page.evaluate(()=>window.__weaponAudio),softwareRenderer:'Chromium SwiftShader; no native pacing/audio-quality claim',completedAt:new Date().toISOString()},null,2)+'\n');
 for(const check of checks)console.log('PASS:',check);
} finally {clearTimeout(deadline);await browser?.close();await server.close();}
