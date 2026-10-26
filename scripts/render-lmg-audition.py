"""Render reproducible, loudness-matched before/after fire auditions.
Offline illustration of the exact report selection/crossfade, not live capture.
"""
from pathlib import Path
import io,json,subprocess,sys,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'work/audio/audition'
OUT.mkdir(parents=True,exist_ok=True);RATE=48000;PERIOD=5520;BASE='8c730902d6787e28b057c6d06ba85fc75fdf43a9'
AUDIO='src/assets/audio/weapons/lmg-fidelity/'
def read(raw):
    with wave.open(io.BytesIO(raw),'rb')as w:return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(float)/32768
oldlead,oldloop=[read(subprocess.check_output(['git','show',BASE+':'+AUDIO+name],cwd=ROOT))for name in ['lmg_fire_lead.wav','lmg_fire_sustain.wav']]
lead,loop=[read((ROOT/AUDIO/name).read_bytes())for name in ['lmg_fire_lead.wav','lmg_fire_sustain.wav']]
blend=576;join=PERIOD-blend;variants=[]
for n in range(8):
    a=lead.copy();report=loop[n*PERIOD:(n+1)*PERIOD];a[:join]=report[:join];r=np.linspace(0,1,blend)[:,None];a[join:PERIOD]=report[join:]*(1-r)+lead[join:PERIOD]*r;variants.append(a)
before=np.zeros((13*RATE,2));after=before.copy();active=[]
for time,count in [(.15,1),(3.6,3),(7,20)]:
    at=round(time*RATE);active.extend(range(at,at+count*PERIOD))
    if count==1:before[at:at+len(oldlead)]+=oldlead
    else:
        before[at:at+PERIOD]+=oldlead[:PERIOD]
        for n in range(1,count):
            report=oldloop[((n-1)*PERIOD)%len(oldloop):((n-1)*PERIOD)%len(oldloop)+PERIOD];before[at+n*PERIOD:at+n*PERIOD+len(report)]+=report
    for n in range(count):
        a=(lead if n==0 else variants[(n-1)%8]).copy()
        if n<count-1:a[PERIOD:PERIOD+blend]*=np.linspace(1,0,blend)[:,None];a[PERIOD+blend:]=0
        start=at+n*PERIOD;after[start:start+len(a)]+=a
levels=[float(np.sqrt(np.mean(a[active]**2)))for a in [before,after]]
before*=.14/levels[0];after*=.14/levels[1];headroom=.9/max(.9,float(abs(before).max()),float(abs(after).max()));before*=headroom;after*=headroom
for name,a in [('old-fire.wav',before),('new-fire.wav',after),('old-then-new.wav',np.concatenate([before,np.zeros((RATE,2)),after]))]:
    with wave.open(str(OUT/name),'wb')as w:w.setparams((2,2,RATE,len(a),'NONE','not compressed'));w.writeframes(np.rint(a*32767).astype('<i2').tobytes())
(OUT/'audition.json').write_text(json.dumps(dict(order='Old 13 s; 1 s silence; new 13 s',events='Tap at .15 s; three shots at 3.6 s; 20 shots at 7 s; .115 s cadence',method='Fire-window RMS matched, common peak-safe gain; no limiter; offline render of event-driven report selection and 12 ms previous-tail fade',original_fire_window_rms=levels,common_headroom_factor=headroom,peak_before=float(abs(before).max()),peak_after=float(abs(after).max())),indent=2)+'\n')
print(OUT)
