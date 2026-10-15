import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
/** Screencast video and wall clocks can drift while fast fixture frames are
 * encoded at 25 fps. Locate the live cycle by its actual screenshots instead. */
export function exportLiveCycle(videoPath,output) {
  function ffmpeg(args,maxBuffer=32*1024*1024){const r=spawnSync('ffmpeg',['-v','error',...args],{maxBuffer});if(r.status!==0)throw new Error('FFmpeg clip: '+r.stderr?.toString().slice(-1000));return r.stdout;}
  const width=160,height=90,stride=width*height,fps=5;
  const frames=ffmpeg(['-i',videoPath,'-t','180','-vf',`fps=${fps},scale=${width}:${height}`,'-pix_fmt','gray','-f','rawvideo','pipe:1']);
  const reference=name=>ffmpeg(['-i',resolve(output,name),'-vf',`scale=${width}:${height}`,'-pix_fmt','gray','-f','rawvideo','pipe:1']);
  function find(ref,lo,hi){let best={frame:-1,mse:Infinity};for(let frame=lo;frame<Math.min(hi,frames.length/stride);frame++){let error=0,weights=0;for(let p=0;p<stride;p++){const x=p%width,y=(p-x)/width;const weight=x>125&&y>60?5:1;const delta=frames[frame*stride+p]-ref[p];error+=delta*delta*weight;weights+=weight;}const mse=error/weights;if(mse<best.mse)best={frame,mse};}return{...best,seconds:best.frame/fps};}
  const start=find(reference('live-usmc-last-shot.png'),0,150*fps);
  const end=find(reference('live-usmc-ready.png'),start.frame+fps,180*fps);
  if(start.frame<0||end.seconds<=start.seconds||start.mse>150||end.mse>150)throw new Error('Cannot reliably locate continuous live cycle '+JSON.stringify({start,end}));
  ffmpeg(['-y','-ss',String(Math.max(0,start.seconds-3)),'-i',videoPath,'-t',String(end.seconds-start.seconds+3.8),'-an','-c:v','libvpx-vp9','-b:v','0','-crf','34',resolve(output,'live-ar-fire-empty-reload.webm')]);
  return {start,end,clock:'Original browser recording clock, continuous interval; no retiming or audio',note:'Clip boundaries matched to actual live last-shot and ready screenshots at 5 fps'};
}
