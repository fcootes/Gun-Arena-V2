import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
/** Instrumentation only; production input, reload, recoil, damage and VFX remain live. */
export const tactileFixture=`
 Object.assign(window.__plasma,{
  farTargets(){for(const panel of this.targetPanels){panel.position.sub(camera.position).multiplyScalar(3).add(camera.position);panel.scale.setScalar(3);}scene.updateMatrixWorld(true);this.aim(0);},
  readyForOverheat(){this.pose();this.aim(0);this.overheatSeen=false;},
  timedVent(forced,time){this.pose();this.ws.heat=forced?100:80;this.ws.overheated=forced;beginPlasmaAction(this.ws,1,'vent');advanceWeaponReload(plasmaDef,this.ws,time);this.tick(0);return this.stats();},
  tactileStats(){const root=this.manager.root.getObjectByName('Weapon_laser');return{...this.diagnostics(),rootPosition:root.position.toArray(),rootRotation:root.quaternion.toArray(),leftHand:root.getObjectByName('leftHand').position.toArray(),leftRotation:root.getObjectByName('leftHand').quaternion.toArray(),forced:!!this.ws.reloadSequence?.plasmaForcedVent};}
 });`;
export async function captureTactile(page,output){
 const save=async name=>{writeFileSync(resolve(output,name+'.png'),Buffer.from(await page.evaluate(()=>window.__plasma.capture()),'base64'));console.log('Captured '+name);};
 await page.evaluate(()=>window.__plasma.targets());const poses=[];
 for(const [name,time]of [['thumb',.415],['open',.639],['impulse',.66],['ejected',.74],['partial-75',1.54],['resistance',1.78],['final-drive',1.95],['locked-seat',2.01],['closed',2.37]]){
  poses.push({name,...await page.evaluate(time=>window.__plasma.pose('swap',time),time)});await save('reload-'+name);
 }
 for(const forced of [false,true])for(const [name,time]of [['press',.42],['pressure',.75],['reaction',1.66],['closing',1.98],['ready',2.25]]){
  poses.push({name,forced,...await page.evaluate(({forced,time})=>window.__plasma.timedVent(forced,time),{forced,time})});await save((forced?'forced':'manual')+'-vent-'+name);
 }
 await page.evaluate(()=>{window.__plasma.pose();window.__plasma.aim(0);window.__plasma.renderer.setPixelRatio(1);window.__plasma.renderer.setSize(640,360,false);});
 const frames=resolve(output,'frames');mkdirSync(frames,{recursive:true});const states=[];let index=0,forcedSeen=false;
 const ranges=[];
 for(const [mode,count]of [['ready',15],['fire',30],['reload-ready',15],['swap',81],['settled',15],['overheat-ready',15],['overheat',225],['end',15],['packet-fire',45]]){
  const start=index;
  if(mode==='swap')assert.equal(await page.evaluate(()=>window.__plasma.beginSwap()),true);
  if(mode==='packet-fire')await page.evaluate(()=>window.__plasma.farTargets());
  if(mode==='overheat-ready')await page.evaluate(()=>window.__plasma.readyForOverheat());
  for(let frame=0;frame<count;frame++){
   if(mode==='fire'&&frame===15)await page.evaluate(()=>window.__plasma.aim(1));
   const result=await page.evaluate(({fire,overheat})=>{
    for(let step=0;step<4;step++){
     if(overheat&&(window.__plasma.ws.overheated||window.__plasma.ws.reloadSequence?.plasmaForcedVent))window.__plasma.overheatSeen=true;
     window.__plasma.step(1/120,fire||overheat&&!window.__plasma.overheatSeen,false);
    }
    return{image:window.__plasma.capture(),state:window.__plasma.tactileStats()};
   },{fire:mode==='fire'||mode==='packet-fire',overheat:mode==='overheat'});
   writeFileSync(resolve(frames,String(index++).padStart(4,'0')+'.png'),Buffer.from(result.image,'base64'));states.push({mode,frame:index,...result.state});
   if(result.state.forced)forcedSeen=true;if(frame%30===0)console.log('Rendered '+mode+' '+frame+'/'+count);
  }
  ranges.push({mode,start,end:index});
 }
 const swap=states.filter(s=>s.mode==='swap');assert.equal(swap.length,81);assert.deepEqual([swap.at(-1).ammo,swap.at(-1).reserve,swap.at(-1).reloading],[60,120,false]);
 const overheat=states.filter(s=>s.mode==='overheat');assert.ok(forcedSeen);assert.ok(overheat.some(s=>s.phase==='react'&&s.forced));assert.equal(overheat.at(-1).ammo,20);assert.equal(overheat.at(-1).heat,0);assert.equal(overheat.at(-1).reloading,false);
 assert.ok(states.some(s=>s.mode==='packet-fire'&&s.bolts>0),'Visible real travelling packets on the longer diagnostic flight');
 const video=resolve(output,'tactile-reload-overheat-fire.mp4');execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',resolve(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',video]);
 for(const [name,start,end]of [['reload-2p70s',45,156],['forced-overheat',156,411],['fire-recoil-impacts',411,index]])execFileSync('ffmpeg',['-y','-loglevel','error','-i',video,'-vf',`trim=start_frame=${start}:end_frame=${end},setpts=PTS-STARTPTS`,'-r','30','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',resolve(output,name+'.mp4')]);
 writeFileSync(resolve(output,'video-provenance.json'),JSON.stringify({fps:30,reloadSeconds:2.70,ventSeconds:2.25,description:'Actual production App renderer, Area 51 lighting and diagnostic concrete/metal targets; held world, 120 Hz production steps exported at 30 FPS. Silent, offline normal-speed simulation playback, not native GPU performance evidence.',ranges,states},null,2));
 writeFileSync(resolve(output,'pose-provenance.json'),JSON.stringify(poses,null,2));console.log('PASS actual tactile App evidence');
}
