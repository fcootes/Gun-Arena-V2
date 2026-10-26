"""Deterministic offline LMG authoring: Python/numpy and ffmpeg 5+.
Only the two approved CC0 recordings supply new fire/cover audio. Runtime WAVs
are 48 kHz PCM16; decoding MP3 does not recover lost source information.
Run from any directory; originals live outside Vite's runtime asset tree.
"""
from pathlib import Path
import hashlib, json, subprocess, wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/audio-sources/lmg'; OUT=ROOT/'src/assets/audio/weapons/lmg-fidelity'
RATE=48000; PERIOD=5520
OUT.mkdir(parents=True,exist_ok=True)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def decode(path):
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(RATE),'-ac','2','-f','f32le','-'])
    return np.frombuffer(raw,dtype='<f4').reshape(-1,2).astype(np.float64)
def crop(x,start,end): return x[round(start*RATE):round(end*RATE)].copy()
def fades(x,attack,release):
    a=round(attack*RATE);r=round(release*RATE)
    if a:x[:a]*=np.linspace(0,1,a)[:,None]
    if r:x[-r:]*=(.5+.5*np.cos(np.linspace(0,np.pi,r)))[:,None]
    return x
files=[]
def write(name,x,**edits):
    peak=float(np.max(abs(x))); assert peak<.95,(name,peak)
    with wave.open(str(OUT/name),'wb') as w:
        w.setparams((2,2,RATE,len(x),'NONE','not compressed'))
        w.writeframes(np.rint(x*32767).astype('<i2').tobytes())
    info=dict(filename=name,frames=len(x),duration_seconds=len(x)/RATE,sample_rate=RATE,channels=2,
              format='PCM16 WAV',peak_dbfs=float(20*np.log10(max(peak,1e-12))),sha256=sha(OUT/name),**edits)
    files.append(info)
    return info
m60=SRC/'538302__franklinrook1984__authentic-m60-firing.mp3'
hatch=SRC/'718441__rudmer_rotteveel__metal_hatch_small_close_02-hq-preview.mp3'
x=decode(m60); h=decode(hatch)
# Last periodic direct report, verified against 0.5 ms high-frequency envelope;
# later maxima are diffuse decay/reflections, not another regular direct shot.
# Only preceding reverberation remains at this cut, no preceding direct attack.
lead_start=6.773875;lead_end=len(x)/RATE
lead=fades(crop(x,lead_start,lead_end)*.58,.00025,.150)
write('lmg_fire_lead.wav',lead,source=m60.name,start_seconds=lead_start,end_seconds=lead_end,
      gain=.58,attack_fade_seconds=.00025,tail_fade_seconds=.150,
      reason='Final direct report near 6.78 s plus entire recorded decay; residual preceding room sound cannot be perfectly separated. No later attack is added.')
# Eight consecutive distinct late-burst reports, near the desired native cadence.
# Move report starts, never resample/time-compress reports or change their pitch.
# Adjacent windows end before the next direct attack. Short padding/fades absorb
# the small cadence differences; eight unique attacks repeat every .92 seconds.
starts=[5.193,5.313,5.4305,5.549,5.6665,5.7785,5.8905,6.0045,6.1165]
reports=[];windows=[]
for i,start in enumerate(starts[:-1]):
    end=min(start+.115,starts[i+1]-.001)
    a=crop(x,start,end)*.58
    a=fades(a,.00025,.005)
    report=np.zeros((PERIOD,2));report[:len(a)]=a
    reports.append(report);windows.append(dict(start_seconds=start,end_seconds=end,frames=len(a)))
loop=np.concatenate(reports)
write('lmg_fire_sustain.wav',loop,source=m60.name,report_windows=windows,report_interval_seconds=.115,
      reports=8,gain=.58,attack_fade_seconds=.00025,report_end_fade_seconds=.005,
      method='Eight real report windows placed at 5520-frame spacing; no pitch or whole-recording speed change. Boundaries fade to zero; native seam listening still required.')
write('lmg_feed_cover_close.wav',fades(crop(h,1.7805,2.10)*2.4,.00025,.030),source=hatch.name,
      start_seconds=1.7805,end_seconds=2.10,gain=2.4,attack_fade_seconds=.00025,tail_fade_seconds=.030,
      reason='Main metal closure impact near 1.784 s and brief latch/metal decay; preceding movement/light contact excluded.')
# Keep earlier approved box and charging crops byte-for-byte equivalent.
for out,name,start,duration in [
 ('lmg_box_release.wav','lmg_reload_tactical.wav',.9166041666666667,.215),
 ('lmg_box_seat.wav','lmg_reload_tactical.wav',2.2757916666666667,.330),
 ('lmg_charge.wav','lmg_reload_empty.wav',4.275,.330)]:
    path=ROOT/'src/assets/audio/weapons/batch2'/name
    with wave.open(str(path),'rb') as w:
        a=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float64)/32768
    write(out,crop(a,start,start+duration),source='batch2/'+name,start_seconds=start,end_seconds=start+duration)
manifest=dict(sample_rate=RATE,channels=2,fire_interval_seconds=.115,
    quality='MP3-derived PCM WAV. No restoration of MP3 losses; mono M60 duplicated to stereo. No compression, limiter or pitch processing.',
    sources=[dict(file=m60.name,title='Authentic M60 Firing.mp3',creator='FranklinRook1984',
      url='https://freesound.org/people/FranklinRook1984/sounds/538302/',licence='CC0 1.0',
      licence_url='https://creativecommons.org/publicdomain/zero/1.0/',sha256=sha(m60),original_format='MP3, 44.1 kHz, mono, 320 kbps',decoded_seconds=len(x)/RATE,decoded_peak=float(np.max(abs(x)))),
      dict(file=hatch.name,title='Metal_Hatch_Small_Close_02',creator='Rudmer_Rotteveel',
      url='https://freesound.org/people/Rudmer_Rotteveel/sounds/718441/',licence='CC0 1.0',
      licence_url='https://creativecommons.org/publicdomain/zero/1.0/',sha256=sha(hatch),
      download_url='https://cdn.freesound.org/previews/718/718441_4921277-hq.mp3',
      original_format='Original listed as 44.1 kHz stereo PCM16 WAV; login required. Derived from official HQ MP3 preview of the same approved recording, 44.1 kHz stereo VBR.',decoded_seconds=len(h)/RATE)],
    files=files,cover_event=dict(phase='slap',progress=.72,baseline_seconds=3.1656),
    listening_status='Waveform/transient analysis and browser playback checked. Subjective native-laptop listening approval pending.')
(OUT/'clip_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(files,indent=2))
