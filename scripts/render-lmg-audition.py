"""Reproduce echo auditions with equal main-report loudness, plus 100 rounds.
Uses actual old/new cached-buffer construction and 12 ms previous-voice fade.
Offline evidence, not a real-time gameplay recording. Source gains are unchanged.
"""
from pathlib import Path
import io,json,subprocess,sys,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'work/lmg-hotfix/audition'
OUT.mkdir(parents=True,exist_ok=True);RATE=48000;PERIOD=5520;BASE='a25793d311b8c11aa8ee77e7852183854bd432bf'
AUDIO='src/assets/audio/weapons/lmg-fidelity/'
def read(raw):
    with wave.open(io.BytesIO(raw),'rb')as w:return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(float)/32768
oldlead,oldloop=[read(subprocess.check_output(['git','show',BASE+':'+AUDIO+name],cwd=ROOT))for name in ['lmg_fire_lead.wav','lmg_fire_sustain.wav']]
lead,loop=[read((ROOT/AUDIO/name).read_bytes())for name in ['lmg_fire_lead.wav','lmg_fire_sustain.wav']]
def bank(lead,loop):
    result=[];blend=576;join=PERIOD-blend
    for n in range(8):
        a=lead.copy();report=loop[n*PERIOD:(n+1)*PERIOD];a[:join]=report[:join];r=np.linspace(0,1,blend)[:,None];a[join:PERIOD]=report[join:]*(1-r)+lead[join:PERIOD]*r;result.append(a)
    return result
def render(lead,loop,events,duration):
    output=np.zeros((round(duration*RATE),2));variants=bank(lead,loop)
    for time,count in events:
        for n in range(count):
            a=(lead if n==0 else variants[(n-1)%8]).copy()
            if n<count-1:a[PERIOD:PERIOD+576]*=np.linspace(1,0,576)[:,None];a[PERIOD+576:]=0
            start=round(time*RATE)+n*PERIOD;output[start:start+len(a)]+=a
    return output
def write(name,a):
    assert abs(a).max()<.95
    with wave.open(str(OUT/name),'wb')as w:w.setparams((2,2,RATE,len(a),'NONE','not compressed'));w.writeframes(np.rint(a*32767).astype('<i2').tobytes())
events=[(.1,1),(3.4,3)]
before=render(oldlead,oldloop,events,8);after=render(lead,loop,events,8)
assert np.array_equal(before[4800:7440],after[4800:7440]),'Exact equal 55 ms direct-report samples; no overall gain trick'
write('echo-before-after.wav',np.concatenate([before,np.zeros((RATE,2)),after]))
ranges=[]
for start,end in [(.20,.65),(.35,.75),(.65,1.00)]:
    old_rms=float(np.sqrt(np.mean(oldlead[round(start*RATE):round(end*RATE)]**2)))
    new_rms=float(np.sqrt(np.mean(lead[round(start*RATE):round(end*RATE)]**2)))
    ranges.append(dict(start=start,end=end,before_rms=old_rms,after_rms=new_rms,reduction_db=float(20*np.log10(new_rms/old_rms))))
(OUT/'audition.json').write_text(json.dumps(dict(baseline=BASE,order='Old 8 s, silence 1 s, new 8 s',events='Tap at .1 s and three-shot burst at 3.4 s in each section',loudness='Initial 55 ms PCM samples are identical. No normalisation of the echo or overall clip.',echo_windows=ranges,continuous='Separate browser evidence renders 100 native Web Audio reports and records actual game input timing'),indent=2)+'\n')
print(OUT)
