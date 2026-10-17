"""Derive only LMG assets from the existing user-supplied batch2 recordings.
Offline authoring: Python 3 + numpy. No downloads, synthesis or runtime DSP.
"""
from pathlib import Path
import hashlib,json,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'src/assets/audio/weapons/batch2';OUT=ROOT/'src/assets/audio/weapons/lmg-fidelity'
OUT.mkdir(parents=True,exist_ok=True)
def read(name):
    with wave.open(str(SRC/name),'rb') as w:
        assert (w.getframerate(),w.getnchannels(),w.getsampwidth())==(48000,2,2)
        return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float64)/32768

def write(name,a):
    with wave.open(str(OUT/name),'wb') as w:
        w.setparams((2,2,48000,len(a),'NONE','not compressed'))
        w.writeframes(np.rint(np.clip(a,-.999,.999)*32767).astype('<i2').tobytes())
    return {'filename':name,'samples':len(a),'duration_seconds':len(a)/48000,'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest()}
source=read('lmg_fire_auto_loop.wav');period=5520
reports=[];offsets=[]
for n in range(5):
    a=source[n*period:(n+1)*period].copy()
    # Align the early energy crest without changing sample rate or pitch.
    size=144;energy=np.convolve(np.mean(a*a,axis=1),np.ones(size)/size,mode='same')
    peak=int(np.argmax(energy[:1920]));offsets.append(peak)
    a=np.roll(a,480-peak,axis=0)
    a*=.178/np.sqrt(np.mean(a*a));reports.append(a)
order=[0,2,4,1,3,2,1,4,0,3,1,0,2,3,4,2,0,4,3,1,4,2,3,0,1,3,2,4,1,0,2]
variation=[1+(.02*np.sin(n*2.399963229728653)) for n in range(len(order))]
loop=np.concatenate([reports[index]*variation[n] for n,index in enumerate(order)])
# Blend 1 ms on each side of every joint to the common boundary value. This
# avoids introducing discontinuities when reordering, including the file seam.
for n in range(len(order)):
    boundary=n*period;left=(np.arange(boundary-48,boundary)%len(loop));right=np.arange(boundary,boundary+48)%len(loop)
    value=(loop[left[-1]]+loop[right[0]])*.5
    ramp=(.5-.5*np.cos(np.linspace(0,np.pi,48)))[:,None]
    loop[left]=loop[left]*(1-ramp)+value*ramp
    loop[right]=value*(1-ramp)+loop[right]*ramp
lead=loop[:period].copy();lead[:48]*=np.linspace(0,1,48)[:,None];lead[-96:]*=np.linspace(1,0,96)[:,None]
files=[write('lmg_fire_lead.wav',lead),write('lmg_fire_sustain.wav',loop)]
for out,name,start,duration in [
 ('lmg_box_release.wav','lmg_reload_tactical.wav',.9166041666666667,.215),
 ('lmg_box_seat.wav','lmg_reload_tactical.wav',2.2757916666666667,.330),
 ('lmg_charge.wav','lmg_reload_empty.wav',4.275,.330),
]:
    a=read(name)[round(start*48000):round((start+duration)*48000)]
    files.append({**write(out,a),'source':name,'source_offset_seconds':start})
old=[float(np.sqrt(np.mean(source[n*period:(n+1)*period]**2))) for n in range(5)]
new=[float(np.sqrt(np.mean(loop[n*period:(n+1)*period]**2))) for n in range(len(order))]
manifest={'provenance':'Derived from existing batch2 user-provided LMG recordings; original files unchanged. See batch2 clip_manifest.json for original cuts.',
 'sample_rate':48000,'channels':2,'format':'PCM signed 16-bit WAV','fire_interval_seconds':.115,
 'source_report_order':order,'source_early_energy_peak_samples':offsets,'pitch_processing':'none; sample rotations and gain only',
 'joint_treatment':'1 ms per side cosine blend to common boundary sample',
 'before':{'loop_seconds':.575,'report_rms':old,'report_level_range_db':float(20*np.log10(max(old)/min(old))),'opening_clip_seconds':.080,'opening_gap_seconds':.035,'seam_discontinuity':float(np.max(abs(source[0]-source[-1])))},
 'after':{'loop_seconds':len(loop)/48000,'report_rms':new,'report_level_range_db':float(20*np.log10(max(new)/min(new))),'opening_clip_seconds':.115,'opening_gap_seconds':0,'seam_discontinuity':float(np.max(abs(loop[0]-loop[-1])))},
 'files':files,
 'missing':[{'filename':'lmg_feed_cover_close.wav','spec':'Original/licensed metallic feed-cover slam, 0.18–0.35 s, strong contact transient at 0 s and short latch decay, dry stereo/mono 48 kHz PCM; no speech, shot, box insertion or charging layer. Event: slap phase at 72%, 3.1656 s at baseline class.'}],
 'cover_audio_audit':'Existing tactical active regions are .916625–1.131292 and 2.275875–2.605458 s; empty adds 4.275146–4.604813 s. All map to manifest box/action cuts. No isolated cover opening/closing recording established. No substitute cover sound synthesized or borrowed.',
 'listening_limitation':'Waveform/cadence and playback-state analysis only; native-laptop listening approval remains required.'}
(OUT/'clip_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'before':manifest['before'],'after':manifest['after'],'files':files},indent=2))
