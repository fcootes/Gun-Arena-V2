import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LmgFireAudio } from '../src/lmgFireAudio';
class Buffer {
  numberOfChannels=2;sampleRate=48000;length:number; data:Float32Array[];
  constructor(frames:number){this.length=frames;this.data=[new Float32Array(frames),new Float32Array(frames)];}
  get duration(){return this.length/this.sampleRate;}
  getChannelData(c:number){return this.data[c];}
}
class Param {value=1; ramps:number[][]=[];cancelScheduledValues(){}setValueAtTime(v:number,t:number){this.value=v;this.ramps.push([t,v]);}linearRampToValueAtTime(v:number,t:number){this.ramps.push([t,v]);}}
class Gain {gain=new Param();disconnected=false;connect(){}disconnect(){this.disconnected=true;}}
class Source {buffer:Buffer|null=null;loop=true;playbackRate={value:0};onended:(()=>void)|null=null;starts:number[]=[];stops:number[]=[];disconnected=false;
 connect(){}disconnect(){this.disconnected=true;}start(t:number){this.starts.push(t);}stop(t=0){this.stops.push(t);}finish(){this.onended?.();}}
class Context {
 currentTime=0;destination={};state='suspended';sources:Source[]=[];gains:Gain[]=[];closed=false;
 createBuffer(channels:number,frames:number){assert.equal(channels,2);return new Buffer(frames);}
 async decodeAudioData(raw:ArrayBuffer){const view=new DataView(raw);assert.equal(view.getUint32(0,false),0x52494646);let offset=12,size=0,start=0;
  while(offset+8<=view.byteLength){const count=view.getUint32(offset+4,true);if(view.getUint32(offset,false)===0x64617461){size=count;start=offset+8;break;}offset+=8+count+(count%2);}
  const b=new Buffer(size/4);for(let i=0;i<b.length;i++)for(let c=0;c<2;c++)b.data[c][i]=view.getInt16(start+i*4+c*2,true)/32768;return b;}
 createBufferSource(){const s=new Source();this.sources.push(s);return s;}createGain(){const g=new Gain();this.gains.push(g);return g;}
 async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.closed=true;}
 advance(dt:number){this.currentTime+=dt;for(const s of this.sources)if(!s.disconnected&&(s.stops.some(t=>t<=this.currentTime)||s.starts.length&&s.starts[0]+s.buffer!.duration<=this.currentTime))s.finish();}
}
const path='../src/assets/audio/weapons/lmg-fidelity/';
const request=async(url:string)=>{const bytes=readFileSync(new URL(path+url,import.meta.url));return{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}as Response;};
const make=()=>{const context=new Context();return {context,player:new LmgFireAudio('lmg_fire_lead.wav','lmg_fire_sustain.wav',()=>context as unknown as AudioContext,request as typeof fetch)};};
for(const hz of [30,60,144]){
 const {context:c,player:p}=make();await p.prepare();p.play(1);assert.equal(c.sources.length,1);assert.equal(c.sources[0].buffer!.duration,2.8636458333333334);
 c.advance(.05);assert.deepEqual(c.sources[0].stops,[],'Tap has no premature tail stop');
 // Release has no player call, therefore no sound starts at release.
 c.advance(.065);p.play(2);assert.equal(c.sources.length,2);assert.equal(c.sources[0].stops[0],.127);assert.equal(c.sources[1].starts[0],.115);assert.equal(c.sources[1].loop,false);assert.equal(c.sources[1].playbackRate.value,1);
 const second=c.sources[1].buffer!;assert.equal(second.getChannelData(0)[8000],c.sources[0].buffer!.getChannelData(0)[8000],'Variant retains the same natural tail');
 c.advance(.115);p.play(3);assert.equal(c.sources.length,3);assert.ok(c.sources[0].disconnected);
 const firstVariant=second.getChannelData(0).slice(0,4000),nextVariant=c.sources[2].buffer!.getChannelData(0).slice(0,4000);assert.notDeepEqual(firstVariant,nextVariant,'Consecutive automatic reports are real distinct source windows');
 const starts=c.sources.length;for(let t=0;t<3;t+=1/hz)c.advance(1/hz);assert.equal(c.sources.length,starts,'Trigger release never schedules a new report');assert.ok(c.sources.at(-1)!.disconnected,'Final tail disconnects naturally');
 p.play(1);p.pause();assert.equal(c.state,'suspended');const n=c.sources.length;p.play(2);assert.equal(c.sources.length,n);p.resume();assert.equal(c.state,'running');
 p.stop();assert.ok(c.sources.at(-1)!.disconnected,'Switch/death/redeploy stop and disconnect');p.resume();assert.equal(c.sources.length,n,'Resume cannot resurrect cancelled shots');
 for(let i=0;i<100;i++)p.play(i+1);assert.ok(c.sources.filter(s=>!s.disconnected&&s.stops.length===0).length<=1,'Bounded active voice under rapid calls');
 p.release();assert.ok(c.closed);assert.ok(c.sources.every(s=>s.disconnected));
}
// Download completing after a hard lifecycle reset must not replay stale fire.
const {context:c,player:p}=make();p.play(1);p.stop();await p.prepare();assert.equal(c.sources.length,0);p.play(1);assert.equal(c.sources.length,1);p.release();
for(let n=0;n<3;n++){const{context,player}=make();await player.prepare();player.play(1);player.release();assert.ok(context.closed&&context.sources.every(s=>s.disconnected));}
console.log('PASS: real M60 buffers, tap/2/3/sustained reports, native-rate variation and shared release, no release/last-round extra shot, 30/60/144 Hz, bounded voices, pause/switch/death/reset/download-race cleanup');
