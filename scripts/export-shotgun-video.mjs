// Locate the actual screenshots in the browser recording. Wall clocks and the
// recorder clock can diverge during expensive software frames; never retime.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const output=resolve(process.argv[2]??'performance-results/shotgun-final');
const source=JSON.parse(readFileSync(resolve(output,'video-source.json'),'utf8')).path;
const ffmpeg=(args,maxBuffer=64*1024*1024)=>{const r=spawnSync('ffmpeg',['-v','error',...args],{maxBuffer});if(r.status!==0)throw Error(r.stderr.toString().slice(-1000));return r.stdout;};
const results=JSON.parse(readFileSync(resolve(output,'results.json'),'utf8'));
const elapsed=(results.frames.at(-1).at-results.frames[0].at)/1000;
// Match the actual ammo/reserve glyphs at useful resolution. A whole-frame
// thumbnail can falsely match a similar landscape at a different reload.
const w=160,h=100,stride=w*h,fps=5,crop=`crop=320:200:960:520,scale=${w}:${h}`;
const frames=ffmpeg(['-i',source,'-t','360','-vf',`fps=${fps},${crop}`,'-pix_fmt','gray','-f','rawvideo','pipe:1']);
function find(name,lo=0,hi=frames.length/stride) {
  const ref=ffmpeg(['-i',resolve(output,name),'-vf',crop,'-pix_fmt','gray','-f','rawvideo','pipe:1']);
  let best={frame:-1,mse:Infinity};
  for(let frame=lo;frame<Math.min(hi,frames.length/stride);frame++) {
    let err=0,weights=0;
    for(let p=0;p<stride;p++) {const x=p%w,y=(p-x)/w,weight=x>=60&&x<145&&y>=38&&y<81?10:1,d=frames[frame*stride+p]-ref[p];err+=d*d*weight;weights+=weight;}
    const mse=err/weights;if(mse<best.mse)best={frame,mse};
  }
  return {...best,seconds:best.frame/fps};
}
const start=find('live-start.png',0,(results.frames[0].at/1000+20)*fps);
const end=find('live-end.png',Math.floor(start.frame+(elapsed-10)*fps),Math.ceil(start.frame+(elapsed+10)*fps));
if(start.frame<0||Math.abs(end.seconds-start.seconds-elapsed)>6||start.mse>150||end.mse>150)throw Error('Cannot match continuous clip: '+JSON.stringify({start,end}));
const seek=Math.max(0,start.seconds-(results.livePixelRatio?2.5:.8)),duration=end.seconds-seek+.6;
ffmpeg(['-y','-ss',String(seek),'-i',source,'-t',String(duration),'-an','-c:v','libvpx-vp9','-b:v','0','-crf','33',resolve(output,'shotgun-continuous.webm')]);
const validation={source,matchedStart:start,matchedEnd:end,seek,duration,liveWallSeconds:elapsed,clock:'Continuous original browser recorder clock; no retiming, cuts within the sequence or recorded audio',renderer:`SwiftShader; fixed 1280×720 viewport, test-only ${results.livePixelRatio??.65} backing pixel ratio`};
writeFileSync(resolve(output,'video-validation.json'),JSON.stringify(validation,null,2)+'\n');console.log(JSON.stringify(validation,null,2));
