import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
/** Test-only observations around the real App firing function and renderer. */
export const acceptanceFixture=`
 Object.assign(window.__plasma,{
  resetAim(){this.aim(0);player.pitch=camera.rotation.x;player.yaw=camera.rotation.y;recoilPitch=0;return player.pitch;},
  aimStats(){return{pitch:player.pitch,cameraPitch:camera.rotation.x,aiming:player.aiming,...this.tactileStats()};},
  shotProbe(reject=false){const preDirection=getFireCamera().getWorldDirection(new THREE.Vector3()).toArray(),prePitch=player.pitch,oldRandom=Math.random;Math.random=()=>.5;
   const spawn=plasmaPool.spawn;if(reject)plasmaPool.spawn=()=>false;
   let fired;try{fired=firePlasmaShot();}finally{Math.random=oldRandom;plasmaPool.spawn=spawn;}
   const bolt=plasmaPool.bolts.find(b=>b.active),expected=plasmaTarget.clone().sub(plasmaOrigin).normalize();
   return{fired,preDirection,ray:plasmaAim.ray.direction.toArray(),prePitch,pitch:player.pitch,cameraPitch:camera.rotation.x,expected:expected.toArray(),direction:bolt?.direction.toArray()};
  },
  compensate(pixels){input.mouseDown(0);onMouseMove({movementX:0,movementY:pixels});input.mouseUp(0);camera.rotation.set(player.pitch,player.yaw,0);camera.updateMatrixWorld(true);return player.pitch;},
  thermalPose(forced,time){this.pose();this.ws.heat=forced?100:20;this.ws.overheated=forced;beginPlasmaAction(this.ws,1,'vent');advanceWeaponReload(plasmaDef,this.ws,time);this.tick(0);return this.aimStats();}
 });`;
export async function captureAcceptance(page,output){
 const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
 await page.evaluate(()=>window.__plasma.targets());
 if(process.env.PLASMA_CLIPS_ONLY!=='1'){
 // Test real launch ordering, centring and rejection, including pre-existing bolts.
 const probes=[];
 for(const aiming of [false,true]){
  const result=await page.evaluate(aiming=>{const p=window.__plasma;p.pose();p.resetAim();p.player.aiming=aiming;const first=p.shotProbe(),direction=p.pool.bolts.find(b=>b.active).direction.clone();p.shotProbe();const unchanged=direction.distanceTo(p.pool.bolts.find(b=>b.active).direction);const rejected=p.shotProbe(true);return{aiming,first,unchanged,rejected};},aiming);
  const f=result.first;assert.equal(f.fired,true);near(f.pitch-f.prePitch,.0045*(aiming?.65:1));near(f.cameraPitch,f.pitch);f.ray.forEach((v,i)=>near(v,f.preDirection[i]));f.direction.forEach((v,i)=>near(v,f.expected[i]));near(result.unchanged,0);assert.equal(result.rejected.fired,false);near(result.rejected.pitch,result.rejected.prePitch);probes.push(result);
 }
 const rates=[];
 for(const hz of [30,60,144]){
  const result=await page.evaluate(hz=>{const p=window.__plasma;p.pose();const start=p.resetAim(),shots=p.player.shotsFired;for(let n=0;n<hz;n++)p.step(1/hz,true,false);const after=p.player.pitch,ammo=p.ws.ammo;for(let n=0;n<hz/2;n++)p.step(1/hz,false,false);return{hz,start,after,settled:p.player.pitch,shots:p.player.shotsFired-shots,ammo};},hz);
  assert.equal(result.shots,8);assert.equal(result.ammo,52);near(result.after-result.start,.036);near(result.settled,result.after);rates.push(result);
 }
 const compensation=await page.evaluate(()=>{const p=window.__plasma;p.pose();const start=p.resetAim();p.step(.125,true,false);const raised=p.player.pitch,after=p.compensate(4);return{start,raised,after};});assert.ok(compensation.after<compensation.raised);
 writeFileSync(resolve(output,'aim-validation.json'),JSON.stringify({probes,rates,compensation},null,2));console.log('PASS actual App aim/crosshair/pre-shot target, no duplicate/rejected impulses, mouse compensation and 30/60/144 Hz');
 const poses=[];
 for(const [name,time]of [['partial-75',1.65],['wind-back',2.07],['contact',2.17],['seated',2.23],['locked-settle',2.40],['closed',2.85],['ready',3.20]]){
  poses.push({name,time,...await page.evaluate(time=>window.__plasma.pose('swap',time),time)});
  writeFileSync(resolve(output,'reload-'+name+'.png'),Buffer.from(await page.evaluate(()=>window.__plasma.capture()),'base64'));
 }
 for(const [name,time]of [['withdraw',1.70],['wave',1.98],['settle',2.30],['ready',2.90]]){
  poses.push({name,time,...await page.evaluate(time=>window.__plasma.thermalPose(true,time),time)});
  writeFileSync(resolve(output,'overheat-'+name+'.png'),Buffer.from(await page.evaluate(()=>window.__plasma.capture()),'base64'));
 }
 writeFileSync(resolve(output,'poses.json'),JSON.stringify(poses,null,2));
 }
 // Deterministic 120 Hz gameplay steps, real App Three rendering at 30 FPS.
 // No interpolation or retiming. Slow software rendering is explicitly recorded as such.
 await page.evaluate(()=>{const p=window.__plasma;p.renderer.setPixelRatio(1);p.renderer.setSize(640,360,false);});
 const states=[];
 for(const [name,count]of [['A-controlled-recoil',165],['B-reload-3p20s',111],['C-forced-overheat-2p90s',255]].filter(([name])=>!process.env.PLASMA_CLIP||name.startsWith(process.env.PLASMA_CLIP))){
  const frames=resolve(output,'frames-'+name);mkdirSync(frames,{recursive:true});
  await page.evaluate(name=>{const p=window.__plasma;p.pose();p.resetAim();if(name.startsWith('B')){p.equip(20);p.tick(0);p.beginSwap();}p.overheatSeen=false;},name);
  for(let frame=0;frame<count;frame++){
   const result=await page.evaluate(({name,frame})=>{const p=window.__plasma;
    for(let sub=0;sub<4;sub++){
     let fire=false;
     if(name.startsWith('A'))fire=frame===15||frame===39||frame===63||(frame>=90&&frame<135);
     if(name.startsWith('C')){if(p.ws.overheated||p.ws.reloadSequence?.plasmaForcedVent)p.overheatSeen=true;fire=!p.overheatSeen;}
     p.step(1/120,fire,false);
    }return{image:p.capture(),state:p.aimStats()};
   },{name,frame});
   writeFileSync(resolve(frames,String(frame).padStart(4,'0')+'.png'),Buffer.from(result.image,'base64'));states.push({clip:name,frame,...result.state});
   if(frame%30===0)console.log(`Rendered ${name} ${frame}/${count}`);
  }
  const last=states.at(-1);if(name.startsWith('A')){const a=states.filter(s=>s.clip===name);for(const [frame,shots]of [[18,1],[42,2],[66,3]])assert.equal(a[frame].shots-a[0].shots,shots,'Three distinct single-shot trigger pulses');await page.screenshot({path:resolve(output,'aim-crosshair.png')});}
  if(name.startsWith('B'))assert.deepEqual([last.ammo,last.reserve,last.reloading],[60,120,false]);
  if(name.startsWith('C')){assert.ok(states.some(s=>s.clip===name&&s.forced&&s.phase==='react'));assert.deepEqual([last.ammo,last.heat,last.reloading],[20,0,false]);}
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',resolve(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',resolve(output,name+'.mp4')]);rmSync(frames,{recursive:true});
 }
 const prior=process.env.PLASMA_CLIP&&existsSync(resolve(output,'video-provenance.json'))?JSON.parse(readFileSync(resolve(output,'video-provenance.json'),'utf8')).states.filter(s=>!s.clip.startsWith(process.env.PLASMA_CLIP)):[];
 writeFileSync(resolve(output,'video-provenance.json'),JSON.stringify({fps:30,simulationHz:120,reloadSeconds:3.20,forcedVentSeconds:2.90,manualVentSeconds:2.25,description:'Actual App/Three renderer, held Area 51 world with fixed diagnostic wall panels; uninterrupted 30 FPS normal-speed simulation playback exported offline from software WebGL. Silent. Not native-laptop real-time/performance acceptance.',states:[...prior,...states]},null,2));
 console.log('PASS three continuous actual-renderer acceptance clips');
}
