import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
/** Test-only injection into the actual App. No fixtures enter the shipped bundle. */
export const polishFixture=`
 Object.assign(window.__plasma,{
 targets(){this.pose();player.classReloadMultiplier=1;
  const forward=camera.getWorldDirection(new THREE.Vector3()),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0);this.baseLook=camera.quaternion.clone();this.targetPanels=[];
  for(const [index,kind]of ['concrete','metal'].entries()){
   const panel=new THREE.Mesh(new THREE.BoxGeometry(1.65,1.5,.08),new THREE.MeshStandardMaterial({color:kind==='metal'?0x778188:0xa6a499,roughness:kind==='metal'?.32:.94,metalness:kind==='metal'?.78:0}));
   panel.name='Diagnostic '+kind+' target';panel.userData.plasmaSurface=kind;panel.position.copy(camera.position).addScaledVector(forward,4).addScaledVector(right,(index-.5)*1.85).addScaledVector(up,-.04);panel.quaternion.copy(camera.quaternion);scene.add(panel);world.hittableObjects.push(panel);this.targetPanels.push(panel);
  }scene.updateMatrixWorld(true);return this.stats();
 },
 profilePacket(){camera.quaternion.copy(this.baseLook);camera.updateMatrixWorld(true);this.pool.clear();const forward=camera.getWorldDirection(new THREE.Vector3()),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),origin=camera.position.clone().addScaledVector(forward,1.8).addScaledVector(right,-.55);this.pool.spawn(origin,origin.clone().addScaledVector(right,4).addScaledVector(forward,.4),player.team,'player');this.pool.update(.001,getCombatContext());return this.stats();},
 aim(index=0,dx=0,dy=0){const p=this.targetPanels[index],target=new THREE.Vector3(dx,dy,.04).applyMatrix4(p.matrixWorld);camera.lookAt(target);camera.updateMatrixWorld(true);},
 packet(index=0,dt=.010){this.aim(index);this.pool.clear();advancePlasmaFire(this.ws,.125,true,firePlasmaShot);this.pool.update(dt,getCombatContext());return this.stats();},
 impacts(){this.pool.clear();for(let i=0;i<2;i++)for(const [x,y]of [[-.3,.2],[0,0],[.3,-.2]]){this.aim(i,x,y);advancePlasmaFire(this.ws,.125,true,firePlasmaShot);this.pool.update(.025,getCombatContext());}camera.quaternion.copy(this.baseLook);camera.updateMatrixWorld(true);return {marks:this.pool.feedback.markCount,...this.stats()};},
 age(dt){this.pool.render(dt);return {marks:this.pool.feedback.markCount,...this.stats()};},
 beginSwap(){return beginPlasmaAction(this.ws,1,'swap');},
 diagnostics(){return{memory:{...renderer.info.memory},marks:this.pool.feedback.markCount,bolts:this.pool.activeCount,draws:renderer.info.render.calls,...this.stats()};}
 });`;
export async function capturePolish(page,output){
 const prefix=process.env.PLASMA_MAP==='bright'?'bright':'dark',states=[];
 const save=async(name)=>{writeFileSync(resolve(output,prefix+'-'+name+'.png'),Buffer.from(await page.evaluate(()=>window.__plasma.capture()),'base64'));console.log('Captured '+prefix+' '+name);};
 await page.evaluate(()=>window.__plasma.targets());
 await page.evaluate(()=>window.__plasma.profilePacket());await save('packet-profile');
 for(const [index,label]of [[0,'concrete'],[1,'metal']]){
  const packet=await page.evaluate(i=>window.__plasma.packet(i),index);assert.equal(packet.bolts,1);await save(label+'-flight');
  // Advance via the production context, not a stand-in collision handler.
  await page.evaluate(()=>window.__plasma.step(.015,false,false));await save(label+'-impact');
 }
 const marks=await page.evaluate(()=>window.__plasma.impacts());assert.equal(marks.marks,6);states.push({name:'marks-new',...marks});await save('marks-new');
 states.push({name:'marks-fading',...await page.evaluate(()=>window.__plasma.age(13))});await save('marks-fading');
 assert.equal((await page.evaluate(()=>window.__plasma.age(3.1))).marks,0);await save('marks-expired');
 if(process.env.PLASMA_MAP!=='bright'){
  for(const [name,time]of [['inside',.639],['initial-pop',.6733333333],['cleared-doors',.74],['fresh-seat',2.01],['closed-ready',2.7]]){states.push({name,...await page.evaluate(time=>window.__plasma.pose('swap',time),time)});await save(name);}
  if(process.env.PLASMA_RENDER_VIDEO==='1'){
   const frames=resolve(output,'frames');mkdirSync(frames,{recursive:true});
   await page.evaluate(()=>{window.__plasma.pose();window.__plasma.renderer.setPixelRatio(1);window.__plasma.renderer.setSize(640,360,false);window.__plasma.aim(0);});
   const video=[];let count=0;
   for(const [mode,nframes]of [['ready',15],['fire',30],['swap',81],['settled',15],['vent',68],['end',15]]){
    if(mode==='swap')assert.equal(await page.evaluate(()=>window.__plasma.beginSwap()),true);
    for(let n=0;n<nframes;n++){
     if(mode==='fire'&&n===15)await page.evaluate(()=>window.__plasma.aim(1));
     const frame=await page.evaluate(({fire,ventStart})=>{if(ventStart){window.__plasma.pose('vent',0);}for(let sub=0;sub<4;sub++)window.__plasma.step(1/120,fire,false);return window.__plasma.capture();},{fire:mode==='fire',ventStart:mode==='vent'&&n===0});
     writeFileSync(resolve(frames,String(count++).padStart(3,'0')+'.png'),Buffer.from(frame,'base64'));video.push({mode,frame:count,...await page.evaluate(()=>window.__plasma.diagnostics())});if(n%20===0)console.log('Rendered '+mode+' '+n+'/'+nframes);
    }
   }
   // Warm ready state fires immediately; the inclusive one-second capture
   // contains that first report plus the endpoint report: eight .125 s intervals.
   const fire=video.filter(s=>s.mode==='fire');assert.equal(fire.at(-1).ammo,51);assert.equal(fire.at(-1).shots-fire[0].shots,8);
   const swapped=video.filter(s=>s.mode==='swap').at(-1);assert.deepEqual([swapped.ammo,swapped.reserve,swapped.reloading],[60,120,false]);
   const vents=video.filter(s=>s.mode==='vent');assert.deepEqual([vents[0].ammo,vents[0].reserve],[vents.at(-1).ammo,vents.at(-1).reserve]);
   for(const sample of video){assert.ok(sample.marks<=80);if(['ready','fire','swap','settled'].includes(sample.mode))assert.deepEqual(sample.memory,video[0].memory);else{assert.equal(sample.memory.textures,video[0].memory.textures);assert.ok(sample.memory.geometries<=video[0].memory.geometries+1);}} // Existing preallocated thermal vapour geometry uploads on its first visible frame.
   execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',resolve(frames,'%03d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',resolve(output,'fire-impacts-reload-vent-normal-speed.mp4')]);
   writeFileSync(resolve(output,'video-provenance.json'),JSON.stringify({fps:30,frames:count,description:'Actual production App renderer, Area 51 lighting, two added material diagnostic targets; world held still. Offline 30 FPS normal-speed simulation playback, NOT real-time/native GPU performance evidence. Full uninterrupted 2.70 s swap; independent 2.25 s vent. Silent export.',states:video},null,2));
  }
 }
 writeFileSync(resolve(output,prefix+'-states.json'),JSON.stringify(states,null,2));
}
