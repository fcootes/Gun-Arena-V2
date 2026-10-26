import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve(process.env.LMG_AUDIO_OUTPUT??'work/lmg-hotfix/browser');mkdirSync(output,{recursive:true});
const errors=[],warnings=[],port=3141;const focus=process.env.LMG_AUDIO_FOCUS==='1',native=process.env.LMG_AUDIO_NATIVE==='1';
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'lmg-audio-audit',enforce:'pre',configureServer(server){server.middlewares.use('/__lmg-audio-only',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<script type="module">import{LmgFireAudio}from'/src/lmgFireAudio.ts';window.__reportClass=LmgFireAudio;</script>`);});},transform(code,id){
 if(id.endsWith('/src/lmgFireAudio.ts'))return code.replace('    source.start(now);',`    source.__audit={shot,variant:shot<=1?'lead':(shot-2)%8,ammo:window.__hotfix?.ws.ammo,gameplayTime:window.__hotfix?.ws.lastFired,bufferFrames:source.buffer.length};source.start(now);`);
 if(!id.endsWith('/src/App.tsx'))return;
 const needle='    // Main Game Loop';assert.equal(code.split(needle).length,2);
 code=code.replace(needle,`    window.__hotfix={renderer,player,camera,scene,shots:[],get state(){return gameStateRef.current;},get ws(){return currentSlotState();},
 equip(ammo=100){stopWeaponAudio();cancelWeaponReload(currentSlotState());const gun=WEAPONS.find(w=>w.id==='lmg');playerLoadout[0]=gun;playerLoadout[1]=WEAPONS[0];playerWeaponState[0]={ammo,reserve:300,lastFired:-100};switchSlot(0);player.continuousShots=0;player.health=player.maxHealth=100000;prepareWeaponAudio(['lmg']);},
 kill(){applyDamageToPlayer(999999,true,true,null);},
 audioFocus(){renderer.setPixelRatio(.25);renderer.setSize(320,180,false);${focus?'renderer.render=()=>{};':''}},
 };
`+needle);
 const shot='        playLmgFire(player.continuousShots, (ws.ammo ?? 0) === 0);';assert.ok(code.includes(shot));
 return code.replace(shot,`        window.__hotfix.shots.push({shot:player.continuousShots,ammo:ws.ammo,gameplayTime:ws.lastFired,perf:performance.now()});\n`+shot);
}}]});
let browser;let page;
const deadline=setTimeout(()=>{void browser?.close();void server.close();},360000);
try{
 await server.listen();browser=await chromium.launch({headless:!native,executablePath:process.env.BENCHMARK_BROWSER??(native?undefined:'/usr/bin/chromium'),args:native?['--autoplay-policy=no-user-gesture-required']:['--no-sandbox','--single-process','--no-zygote','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(()=>{
 HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(Error('audio audit embedded input'));
 window.__audioAudit={starts:[],states:[],decodes:0,contexts:0,resumes:0,disconnected:0,recorder:null};
 const resume=AudioContext.prototype.resume;AudioContext.prototype.resume=function(...args){window.__audioAudit.resumes++;return resume.apply(this,args);};
 const decode=AudioContext.prototype.decodeAudioData;
 AudioContext.prototype.decodeAudioData=function(...args){if(!this.__tracked){this.__tracked=true;window.__audioAudit.contexts++;this.addEventListener('statechange',()=>window.__audioAudit.states.push({state:this.state,time:this.currentTime,perf:performance.now()}));}return decode.apply(this,args).then(b=>{window.__audioAudit.decodes++;return b;});};
 const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop,disconnect=AudioNode.prototype.disconnect,connect=AudioNode.prototype.connect;
 AudioBufferSourceNode.prototype.start=function(...args){if(this.__audit){this.__entry={...this.__audit,start:args[0],contextTime:this.context.currentTime,perf:performance.now(),duration:this.buffer.duration,loop:this.loop,rate:this.playbackRate.value,stops:[],gains:this.__gain?.gain.__events??[]};window.__audioAudit.starts.push(this.__entry);}return start.apply(this,args);};
 AudioBufferSourceNode.prototype.stop=function(...args){this.__entry?.stops.push(args[0]??this.context.currentTime);return stop.apply(this,args);};
 AudioNode.prototype.disconnect=function(...args){if(this instanceof AudioBufferSourceNode&&this.__entry){this.__entry.disconnectedAt=this.context.currentTime;window.__audioAudit.disconnected++;}return disconnect.apply(this,args);};
 AudioNode.prototype.connect=function(destination,...args){if(this instanceof AudioBufferSourceNode){if(destination instanceof GainNode){destination.gain.__source=this;this.__gain=destination;}}
 if(destination instanceof AudioDestinationNode&&this instanceof GainNode&&this.context instanceof AudioContext){const c=this.context;if(!c.__auditDestination){c.__auditDestination=c.createMediaStreamDestination();const chunks=[],recorder=new MediaRecorder(c.__auditDestination.stream);recorder.ondataavailable=e=>chunks.push(e.data);window.__audioAudit.recorder={recorder,chunks};recorder.start();}connect.call(this,c.__auditDestination);}return connect.call(this,destination,...args);};
 for(const name of ['setValueAtTime','linearRampToValueAtTime','cancelScheduledValues']){const fn=AudioParam.prototype[name];AudioParam.prototype[name]=function(...args){const e={method:name,args};if(this.__source?.__entry)this.__source.__entry.gains.push(e);else(this.__events??=[]).push(e);return fn.apply(this,args);};}
 });
 if(process.env.LMG_AUDIO_OFFLINE_ONLY!=='1'){
 await page.goto(`http://127.0.0.1:${port}`);
 await page.getByRole('button',{name:'BATTALION',exact:true}).click();await page.getByRole('slider',{name:'Battalion size'}).press('Home');
 await page.getByRole('button',{name:'[ GAME MODE ]',exact:true}).click();await page.getByRole('button',{name:'USMC',exact:true}).click();await page.getByRole('button',{name:'Select TEAM DEATHMATCH',exact:true}).click();await page.getByRole('button',{name:/OUTDOOR ARENA TRAINING FIELD/}).click();await page.locator('input[type="range"][min="1"][max="20"]').press('Home');await page.getByRole('button',{name:'DEPLOY SELECTED SCENARIO',exact:true}).click();await page.waitForFunction(()=>window.__hotfix?.state==='playing');
 await page.evaluate(()=>{window.__hotfix.audioFocus();window.__hotfix.equip(100);});await page.waitForFunction(()=>window.__audioAudit.decodes===2);
 console.log('Holding actual game trigger through 100 rounds');await page.mouse.move(700,260);await page.mouse.down();await page.waitForFunction(()=>window.__hotfix.ws.ammo===0,null,{timeout:180000});await page.mouse.up();await page.waitForTimeout(1700);
 const result=await page.evaluate(()=>({shots:window.__hotfix.shots,audio:{...window.__audioAudit,recorder:undefined},state:window.__hotfix.state,reloading:!!window.__hotfix.ws.reloading}));
 writeFileSync(resolve(output,'trace.json'),JSON.stringify({...result,focus,native,errors,warnings},null,2)+'\n');
 assert.equal(result.shots.length,100);assert.equal(result.audio.starts.length,100);assert.equal(result.audio.decodes,2);assert.equal(result.audio.contexts,1);
 for(let n=0;n<100;n++){const s=result.shots[n],a=result.audio.starts[n];assert.equal(s.ammo,99-n);assert.equal(s.shot,n+1);assert.equal(a.shot,s.shot);assert.equal(a.variant,n===0?'lead':(n-1)%8);assert.ok(n===0||s.gameplayTime-result.shots[n-1].gameplayTime>=.115-1e-8);assert.ok(Math.abs(a.start-a.contextTime)<.025);}
 const data=await page.evaluate(()=>new Promise(resolve=>{const r=window.__audioAudit.recorder;r.recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(r.chunks,{type:r.recorder.mimeType}));};r.recorder.stop();}));writeFileSync(resolve(output,'100-rounds.webm'),Buffer.from(data,'base64'));
 assert.deepEqual(errors,[]);console.log('PASS: 100 actual gameplay rounds, 100 native WebAudio starts, every variant wrap, no decode/context restart');
 }
 await page.goto(`http://127.0.0.1:${port}/__lmg-audio-only`);await page.waitForFunction(()=>!!window.__reportClass);
 const offline=await page.evaluate(async()=>{
  const context=new OfflineAudioContext(2,13*48000,48000);
  const player=new window.__reportClass('/src/assets/audio/weapons/lmg-fidelity/lmg_fire_lead.wav','/src/assets/audio/weapons/lmg-fidelity/lmg_fire_sustain.wav',()=>context);
  await player.prepare();
  for(let n=1;n<100;n++)void context.suspend(n*.115).then(()=>player.play(n+1));
  player.play(1);const buffer=await context.startRendering();
  const starts=window.__audioAudit.starts,attackRms=starts.map(s=>{const a=buffer.getChannelData(0).subarray(Math.round(s.start*48000),Math.round(s.start*48000)+960);return Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)/a.length);});
  const pcm=new Int16Array(buffer.length*2);for(let n=0;n<buffer.length;n++)for(let c=0;c<2;c++)pcm[n*2+c]=Math.round(Math.max(-1,Math.min(1,buffer.getChannelData(c)[n]))*32767);
  const base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([pcm.buffer]));});
  return{starts,attackRms,base64,peak:Math.max(...attackRms)};
 });
 assert.equal(offline.starts.length,100);for(let n=0;n<100;n++){assert.ok(Math.abs(offline.starts[n].start-n*.115)<128/48000+.00001);assert.ok(offline.attackRms[n]>.07,'Every real rendered report has a strong attack');}
 const pcm=Buffer.from(offline.base64,'base64'),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(48000,24);header.writeUInt32LE(192000,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);writeFileSync(resolve(output,'100-rounds-offline.wav'),Buffer.concat([header,pcm]));delete offline.base64;writeFileSync(resolve(output,'offline-trace.json'),JSON.stringify(offline,null,2)+'\n');
 console.log('PASS: real browser OfflineAudioContext rendered 100 audible attacks at native cadence, including every eight-variant wrap');

}finally{if(page){const diagnostic=await page.evaluate(()=>({shots:window.__hotfix?.shots,audio:{...window.__audioAudit,recorder:undefined}})).catch(()=>null);writeFileSync(resolve(output,'diagnostic.json'),JSON.stringify({diagnostic,errors,warnings},null,2)+'\n');}clearTimeout(deadline);await browser?.close();await server.close();}
