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
hatch=SRC/'718441__rudmer_rotteveel__metal_hatch_small_close_02.wav'
x=decode(m60); h=decode(hatch)
# Last periodic direct report, verified against 0.5 ms high-frequency envelope;
# later maxima are diffuse decay/reflections, not another regular direct shot.
# Only preceding reverberation remains at this cut, no preceding direct attack.
lead_start=6.773875
# Preserve the direct report/early body exactly. Smoothstep interpolation in dB
# suppresses the broad recorded reflections, without changing the attack gain.
# The final near-silent fade reaches zero at 1.20 s; no runtime release gate.
lead_duration=1.20
knots=[(0.,0.),(.055,0.),(.20,-12.),(.65,-16.),(1.00,-24.),(1.20,-60.)]
t=np.arange(round(lead_duration*RATE))/RATE
envelope=np.ones_like(t)
for (a,db_a),(b,db_b) in zip(knots,knots[1:]):
    mask=(t>=a)&(t<b);u=(t[mask]-a)/(b-a);u=u*u*(3-2*u)
    envelope[mask]=10**((db_a+(db_b-db_a)*u)/20)
lead=crop(x,lead_start,lead_start+lead_duration)*.58*envelope[:,None]
lead=fades(lead,.00025,.040)
write('lmg_fire_lead.wav',lead,source=m60.name,start_seconds=lead_start,end_seconds=lead_start+lead_duration,
      gain=.58,attack_fade_seconds=.00025,tail_fade_seconds=.040,
      gain_envelope=dict(interpolation='smoothstep in dB',knots_seconds_db=knots,unchanged_direct_report_seconds=.055),
      reason='Final direct report near 6.78 s; initial 55 ms unchanged, reflected energy attenuated smoothly by 12–24 dB before a quiet natural ending. No runtime release gate or added report.')
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
write('lmg_feed_cover_close.wav',fades(crop(h,1.7815,2.10)*2.4,.00025,.030),source=hatch.name,
      start_seconds=1.7815,end_seconds=2.10,gain=2.4,attack_fade_seconds=.00025,tail_fade_seconds=.030,
      reason='Second, louder metal closure from original PCM WAV, with attack near 1.782 s and short latch decay. Earlier .55 s clang and preceding movement excluded; existing gain unchanged.')
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
    quality='Firing is MP3-derived; no restoration of MP3 losses, mono M60 duplicated to stereo. Hatch is original PCM WAV-derived. No compression, limiter or pitch processing.',
    sources=[dict(file=m60.name,title='Authentic M60 Firing.mp3',creator='FranklinRook1984',
      url='https://freesound.org/people/FranklinRook1984/sounds/538302/',licence='CC0 1.0',
      licence_url='https://creativecommons.org/publicdomain/zero/1.0/',sha256=sha(m60),original_format='MP3, 44.1 kHz, mono, 320 kbps',decoded_seconds=len(x)/RATE,decoded_peak=float(np.max(abs(x)))),
      dict(file=hatch.name,title='Metal_Hatch_Small_Close_02',creator='Rudmer_Rotteveel',
      url='https://freesound.org/people/Rudmer_Rotteveel/sounds/718441/',licence='CC0 1.0',
      licence_url='https://creativecommons.org/publicdomain/zero/1.0/',sha256=sha(hatch),
      supplied_as='Exact original WAV attachment',
      original_format='44.1 kHz stereo PCM16 WAV',decoded_seconds=len(h)/RATE)],
    runtime_variants=dict(count=8,attack_join_seconds=.103,tail_blend_seconds=.012,tail_source='lmg_fire_lead.wav',playback='One native-rate cached report per real shot; no free-running future reports'),
    files=files,cover_event=dict(phase='slap',progress=.72,baseline_seconds=3.1656),
    listening_status='Waveform/transient analysis and browser playback checked. Subjective native-laptop listening approval pending.')
(OUT/'clip_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(files,indent=2))
