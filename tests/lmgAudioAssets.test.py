"""Verify audible asset outcomes against the approved masters/prior commit."""
from pathlib import Path
import hashlib,io,json,subprocess,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];DIR=ROOT/'src/assets/audio/weapons/lmg-fidelity'
def read(raw):
    with wave.open(io.BytesIO(raw),'rb')as w:
        assert(w.getframerate(),w.getnchannels(),w.getsampwidth())==(48000,2,2)
        return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2)/32768
baseline=json.loads((ROOT/'tests/fixtures/lmg-audio-baseline.json').read_text())
new=read((DIR/'lmg_fire_lead.wav').read_bytes())
attack=np.rint(new[:2640]*32768).astype('<i2').tobytes()
assert hashlib.sha256(attack).hexdigest()==baseline['first_55ms_pcm_sha256'],'Direct report/early body must be unchanged'
assert len(new)==57600 and np.max(abs(new[-1]))==0
for window,limit in zip(baseline['echo_windows'],[-12,-14,-16]):
    start,end=window['start'],window['end'];b=new[round(start*48000):round(end*48000)]
    reduction=20*np.log10(np.sqrt(np.mean(b*b))/window['rms']);assert reduction<limit,reduction
manifest=json.loads((DIR/'clip_manifest.json').read_text());hatch=next(s for s in manifest['sources']if s['creator']=='Rudmer_Rotteveel');source=ROOT/'assets/audio-sources/lmg'/hatch['file']
assert source.suffix=='.wav' and hashlib.sha256(source.read_bytes()).hexdigest()==hatch['sha256']
asset=next(a for a in manifest['files']if a['filename']=='lmg_feed_cover_close.wav')
assert 1.78<asset['start_seconds']<1.79 and asset['end_seconds']==2.10
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ar','48000','-ac','2','-f','f32le','-']);master=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
cut=read((DIR/asset['filename']).read_bytes());reference=master[round(1.7815*48000):round(2.10*48000)]*asset['gain']
assert np.corrcoef(cut[48:-1440].ravel(),reference[48:-1440].ravel())[0,1]>.99999,'Output must match the original WAV second clang, not the earlier impact or MP3 preview'
assert np.max(abs(cut))<.95 and np.max(abs(cut[-1]))==0
for f in manifest['files']:
    path=DIR/f['filename'];a=read(path.read_bytes());assert len(a)==f['frames'];assert np.max(abs(a))<.95;assert hashlib.sha256(path.read_bytes()).hexdigest()==f['sha256']
for name in ['lmg_box_release.wav','lmg_box_seat.wav','lmg_charge.wav','lmg_fire_sustain.wav']:
    assert hashlib.sha256((DIR/name).read_bytes()).hexdigest()==baseline['unchanged_sha256'][name],name+' must remain byte-identical'
print('PASS: exact direct attack preserved, 14–18 dB quieter echo, smooth zero-ended release, original PCM second clang, headroom/provenance and unchanged box/charge/automatic attack bank')
