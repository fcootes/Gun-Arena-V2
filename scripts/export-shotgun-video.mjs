// Locate the actual screenshots in the browser recording. Wall clocks and the
// recorder clock can diverge during expensive software frames; never retime.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const output=resolve(process.argv[2]??'performance-results/shotgun-final');
const source=JSON.parse(readFileSync(resolve(output,'video-source.json'),'utf8')).path;
const ffmpeg=(args,maxBuffer=64*1024*1024)=>{const r=spawnSync('ffmpeg',['-v','error',...args],{maxBuffer});if(r.status!==0)throw Error(r.stderr.toString().slice(-1000));return r.stdout;};
const w=160,h=90,stride=w*h,fps=5;
const frames=ffmpeg(['-i',source,'-t','360','-vf',`fps=${fps},scale=${w}:${h}`,'-pix_fmt','gray','-f','rawvideo','pipe:1']);
function find(name,lo=0) {
  const ref=ffmpeg(['-i',resolve(output,name),'-vf',`scale=${w}:${h}`,'-pix_fmt','gray','-f','rawvideo','pipe:1']);
  let best={frame:-1,mse:Infinity};
  for(let frame=lo;frame<frames.length/stride;frame++) {
    let err=0,weights=0;
    for(let p=0;p<stride;p++) {const x=p%w,y=(p-x)/w,weight=x>125&&y>60?8:1,d=frames[frame*stride+p]-ref[p];err+=d*d*weight;weights+=weight;}
    const mse=err/weights;if(mse<best.mse)best={frame,mse};
  }
  return {...best,seconds:best.frame/fps};
}
const start=find('live-start.png'),end=find('live-end.png',start.frame+fps);
if(start.frame<0||end.seconds<=start.seconds||start.mse>150||end.mse>150)throw Error('Cannot match continuous clip: '+JSON.stringify({start,end}));
const seek=Math.max(0,start.seconds-.8),duration=end.seconds-seek+.6;
ffmpeg(['-y','-ss',String(seek),'-i',source,'-t',String(duration),'-an','-c:v','libvpx-vp9','-b:v','0','-crf','33',resolve(output,'shotgun-continuous.webm')]);
const validation={source,matchedStart:start,matchedEnd:end,seek,duration,clock:'Continuous original browser recorder clock; no retiming, cuts within the sequence or recorded audio',renderer:'SwiftShader; fixed 1280×720 viewport, test-only 0.65 backing pixel ratio'};
writeFileSync(resolve(output,'video-validation.json'),JSON.stringify(validation,null,2)+'\n');console.log(JSON.stringify(validation,null,2));
