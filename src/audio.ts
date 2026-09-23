// Audio Engine with clean relative local filenames and zero synthetic sound overrides

export class SoundTrack {
  candidates: string[];
  poolSize: number;
  loop: boolean;
  pool: HTMLAudioElement[];
  index: number;
  confirmedSrc: string | null;
  duration: number;
  private _vol: number;

  constructor(
    filenames: string | string[],
    poolSize = 6,
    loop = false
  ) {
    const names = Array.isArray(filenames) ? filenames : [filenames];
    const extensions = ['', '.mp3', '.wav', '.m4a', '.mp4', '.ogg'];
    const candidates: string[] = [];

    names.forEach(name => {
      if (!name || typeof name !== 'string') return;
      candidates.push(name);
      if (!/\.[a-zA-Z0-9]{2,4}$/.test(name)) {
        extensions.forEach(ext => { if (ext) candidates.push(name + ext); });
      } else {
        const root = name.replace(/\.[a-zA-Z0-9]{2,4}$/, '');
        extensions.forEach(ext => { if (ext) candidates.push(root + ext); });
      }
    });

    this.candidates = [...new Set(candidates)];
    this.poolSize = poolSize;
    this.loop = loop;
    this.pool = [];
    this.index = 0;
    this.confirmedSrc = null;
    this.duration = 0;
    this._vol = 1.0;

    for (let i = 0; i < poolSize; i++) {
      const a = new Audio();
      a.preload = 'none';
      if (loop) a.loop = true;
      this.pool.push(a);
    }
    this.detectSources();
  }

  set volume(v: number) { this._vol = Math.max(0, Math.min(1, v)); }
  get volume(): number { return this._vol; }

  detectSources(): void {
    if (this.candidates.length === 0) return;
    
    let candidateIndex = 0;
    const probeNext = () => {
      if (this.confirmedSrc || candidateIndex >= this.candidates.length) return;
      const src = this.candidates[candidateIndex++];
      const test = new Audio();
      test.preload = 'metadata';
      
      const onSuccess = () => {
        if (!this.confirmedSrc) {
          this.confirmedSrc = src;
          if (test.duration && !isNaN(test.duration)) {
            this.duration = test.duration;
          }
          this.pool.forEach(a => {
            a.src = src;
            a.preload = 'auto';
          });
        }
      };

      const onError = () => {
        probeNext();
      };

      test.addEventListener('loadedmetadata', onSuccess, { once: true });
      test.addEventListener('canplaythrough', onSuccess, { once: true });
      test.addEventListener('error', onError, { once: true });
      test.src = src;
    };

    probeNext();
  }

  play(volume: number | null = null, restart = true): void {
    const targetVol = (volume !== null && volume !== undefined) ? volume : this._vol;
    if (targetVol <= 0.005) return;
    const clamped = Math.max(0, Math.min(1, targetVol));

    // Purely audio file playback - no synthetic noise overrides
    if (!this.confirmedSrc) return;

    const audio = this.pool[this.index];
    this.index = (this.index + 1) % this.poolSize;

    audio.volume = clamped;
    if (restart) audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  }

  playContinuous(volume = 1.0): void {
    if (volume <= 0.005) return;
    const clamped = Math.max(0, Math.min(1, volume));
    if (!this.confirmedSrc) return;

    const audio = this.pool[0];
    audio.volume = clamped;
    if (audio.paused) {
      audio.currentTime = 0;
      const p = audio.play();
      if (p !== undefined) p.catch(() => {});
    }
  }

  stop(): void {
    this.pool.forEach(a => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        // ignore
      }
    });
  }
}

export const grenadeThrowSound = new SoundTrack(['bamboo whoosh', 'bamboo whoosh.mp3', 'bamboo whoosh.wav', 'bamboo whoosh.ogg', 'bamboo whoosh.m4a'], 4);
export const grenadeExplosionSound = new SoundTrack(['medium explosion whoosh', 'medium explosion whoosh.mp3', 'medium explosion whoosh.wav', 'medium explosion whoosh.ogg', 'medium explosion whoosh.m4a'], 4);

// Standard relative local filenames mapped for direct desktop synchronization
export const PISTOL_AUDIO_FILENAMES = {
  shot: [
    'pistol_fire.mp3',
    'pistol_fire',
    'pistol-shot',
    'pistol-shot.mp3',
    'pistol-shot.wav',
    'pistol-shot.m4a',
    'pistol_shot',
    'handgun-shot',
    '9mm-shot'
  ],
  reload: [
    'pistol_reload.mp3',
    'pistol_reload',
    'pistol-reload',
    'pistol-reload.mp3',
    'pistol-reload.wav',
    'pistol-reload.m4a',
    'handgun-reload',
    '9mm-reload'
  ]
};

export const AUDIO = {
  // Existing Arsenal Sounds
  arSingle:      new SoundTrack(['AK-47 single shot.m4a', 'AK-47 single shot'], 6),
  arSpray:       new SoundTrack(['AK-47 multi shpot.m4a', 'AK-47 multi shpot'], 2, true),
  arReload:      new SoundTrack(['squarebun-m4a1-reload-sound-316890.mp4', 'squarebun-m4a1-reload-sound-316890'], 2),
  shotgunShot:   new SoundTrack(['universfield-shotgun-blast-352038', 'universfield-shotgun-blast-352038.mp3', 'universfield-shotgun-blast-352038.wav'], 6),
  shotgunReload: new SoundTrack(['u_6y9n97bgg6-caulking-gun-back-381411', 'u_6y9n97bgg6-caulking-gun-back-381411.mp3'], 3),
  sniperShot:    new SoundTrack(['sniper shot(updated)', 'sniper shot(updated).mp3', 'sniper shot(updated).wav'], 6),
  // Sniper reload locked to 'dragon-studio-gun-reload-2-511308.mp3'
  sniperReload:  new SoundTrack(['dragon-studio-gun-reload-2-511308.mp3', 'dragon-studio-gun-reload-2-511308', 'freesound_community-machine-gun-reload-6302'], 2),
  miniDrink:     new SoundTrack(['freesound_community-glug-glug-glug-39140', 'freesound_community-glug-glug-glug-39140.mp3', 'freesound_community-glug-glug-glug-39140.wav'], 3),
  bulletHit:     new SoundTrack(['freesound_community-086553_bullet-hit-39853.mp3', 'freesound_community-086553_bullet-hit-39853', 'freesound_community-086553_bullet-hit-39148'], 8),
  hitmarkerTic:  new SoundTrack(['hitmarker_tic.mp3', 'hitmarker_tic'], 8),

  reloadTactical: new SoundTrack(['weapon_reload_tactical.mp3', 'weapon_reload_tactical'], 2),
  reloadEmpty:    new SoundTrack(['weapon_reload_empty.mp3', 'weapon_reload_empty'], 2),

  // Pistol Sounds
  pistolShot:    new SoundTrack(PISTOL_AUDIO_FILENAMES.shot, 6),
  pistolReload:  new SoundTrack(PISTOL_AUDIO_FILENAMES.reload, 2),

  // Full Armory New Weapon Clean Local Placeholders
  smgFire:       new SoundTrack(['smg_fire.mp3', 'smg_fire'], 6),
  smgReload:     new SoundTrack(['smg_reload.mp3', 'smg_reload'], 2),
  lmgFire:       new SoundTrack(['lmg_fire.mp3', 'lmg_fire'], 6),
  lmgReload:     new SoundTrack(['lmg_reload.mp3', 'lmg_reload'], 2),
  brBurst:       new SoundTrack(['br_burst.mp3', 'br_burst'], 6),
  brReload:      new SoundTrack(['br_reload.mp3', 'br_reload'], 2),
  laserBeam:     new SoundTrack(['laser_beam.mp3', 'laser_beam'], 2, true),
  laserVent:     new SoundTrack(['laser_vent.mp3', 'laser_vent'], 2),

  // Advanced Weapon Audio: Minigun & Railgun
  minigunWindup:   new SoundTrack(['minigun_windup.mp3', 'minigun_windup', 'minigun_spin.mp3'], 2),
  minigunFire:     new SoundTrack(['minigun_fire.mp3', 'minigun_fire', 'gatling_fire.mp3'], 2, true),
  minigunOverheat: new SoundTrack(['minigun_overheat.mp3', 'minigun_overheat', 'steam_vent.mp3'], 2),
  railgunCharge:   new SoundTrack(['railgun_charge.mp3', 'railgun_charge', 'railgun_hum.mp3'], 2),
  railgunFire:     new SoundTrack(['railgun_fire.mp3', 'railgun_fire', 'railgun_blast.mp3'], 4)
};

// Web Audio Fallback Synthesizer for 100% Guaranteed Audible Feedback
let webAudioCtx: AudioContext | null = null;
let railgunChargeOsc: OscillatorNode | null = null;
let railgunChargeGain: GainNode | null = null;
let minigunSpinOsc: OscillatorNode | null = null;
let minigunSpinGain: GainNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!webAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) webAudioCtx = new AudioCtx();
  }
  if (webAudioCtx && webAudioCtx.state === 'suspended') {
    webAudioCtx.resume().catch(() => {});
  }
  return webAudioCtx;
}

export function updateRailgunChargeAudio(charging: boolean, progress: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (charging && progress > 0.01) {
    if (!railgunChargeOsc) {
      railgunChargeOsc = ctx.createOscillator();
      railgunChargeGain = ctx.createGain();
      railgunChargeOsc.type = 'sawtooth';
      railgunChargeGain.gain.setValueAtTime(0.01, ctx.currentTime);
      railgunChargeOsc.connect(railgunChargeGain);
      railgunChargeGain.connect(ctx.destination);
      railgunChargeOsc.start();
    }
    // Ramps from 180Hz up to 920Hz during 1.2s charge sequence
    const targetFreq = 180 + Math.pow(progress, 1.6) * 740;
    railgunChargeOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.04);
    if (railgunChargeGain) {
      const vol = Math.min(0.28, 0.04 + progress * 0.24);
      railgunChargeGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.04);
    }
  } else {
    if (railgunChargeOsc && railgunChargeGain) {
      railgunChargeGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
      setTimeout(() => {
        try { railgunChargeOsc?.stop(); railgunChargeOsc?.disconnect(); } catch {}
        railgunChargeOsc = null;
        railgunChargeGain = null;
      }, 70);
    }
  }
}

export function playRailgunSlugBlast(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Heavy concussive sub-bass impulse
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.35);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.46);

    // High frequency sonic crackle
    const oscHi = ctx.createOscillator();
    const gainHi = ctx.createGain();
    oscHi.type = 'triangle';
    oscHi.frequency.setValueAtTime(980, now);
    oscHi.frequency.exponentialRampToValueAtTime(140, now + 0.22);
    gainHi.gain.setValueAtTime(0.35, now);
    gainHi.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    oscHi.connect(gainHi);
    gainHi.connect(ctx.destination);
    oscHi.start(now);
    oscHi.stop(now + 0.26);
  } catch {}
}

export function updateMinigunSpinAudio(spinning: boolean, speedNorm: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (spinning && speedNorm > 0.05) {
    if (!minigunSpinOsc) {
      minigunSpinOsc = ctx.createOscillator();
      minigunSpinGain = ctx.createGain();
      minigunSpinOsc.type = 'triangle';
      minigunSpinGain.gain.setValueAtTime(0.01, ctx.currentTime);
      minigunSpinOsc.connect(minigunSpinGain);
      minigunSpinGain.connect(ctx.destination);
      minigunSpinOsc.start();
    }
    const targetFreq = 50 + speedNorm * 180;
    minigunSpinOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
    if (minigunSpinGain) {
      const vol = Math.min(0.22, speedNorm * 0.20);
      minigunSpinGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
    }
  } else {
    if (minigunSpinOsc && minigunSpinGain) {
      minigunSpinGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
      setTimeout(() => {
        try { minigunSpinOsc?.stop(); minigunSpinOsc?.disconnect(); } catch {}
        minigunSpinOsc = null;
        minigunSpinGain = null;
      }, 80);
    }
  }
}

export function playMinigunFireShot(vol = 1.0): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.05);
    gain.gain.setValueAtTime(Math.min(0.4, vol * 0.35), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch {}
}

export function playMinigunVentHiss(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(2.0, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  } catch {}
}

let audioUnlocked = false;
export function unlockAudioEngine(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  Object.values(AUDIO).forEach(track => {
    try { track.play(0.001); track.stop(); } catch {}
  });
  try {
    grenadeThrowSound.play(0.001); grenadeThrowSound.stop();
    grenadeExplosionSound.play(0.001); grenadeExplosionSound.stop();
  } catch {}
}

export function getSpatialVolume(fromPos: { distanceTo: (v: unknown) => number }, toPos: unknown): number {
  const dist = fromPos.distanceTo(toPos);
  return Math.max(0, Math.min(1, 1 / (1 + dist * 0.1)));
}

let adrenalineHeartbeatTimer: number | null = null;
let adrenalineHeartbeatActive = false;

export function updateAdrenalineHeartbeat(active: boolean): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (active === adrenalineHeartbeatActive) return;
  adrenalineHeartbeatActive = active;

  if (active) {
    const playPulse = () => {
      if (!adrenalineHeartbeatActive) return;
      const now = ctx.currentTime;
      // Heartbeat thump 1
      try {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(80, now);
        osc1.frequency.exponentialRampToValueAtTime(38, now + 0.12);
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Heartbeat thump 2
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(95, now + 0.16);
        osc2.frequency.exponentialRampToValueAtTime(42, now + 0.28);
        gain2.gain.setValueAtTime(0.32, now + 0.16);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.16);
        osc2.stop(now + 0.31);

        // Heavy breathing tension sweep
        const bufferSize = Math.floor(ctx.sampleRate * 0.45);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * 0.18;
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now + 0.32);
        filter.frequency.exponentialRampToValueAtTime(240, now + 0.72);
        filter.Q.value = 2.5;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.12, now + 0.32);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.74);
        whiteNoise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        whiteNoise.start(now + 0.32);
      } catch {}
    };

    playPulse();
    adrenalineHeartbeatTimer = window.setInterval(playPulse, 900);
  } else {
    if (adrenalineHeartbeatTimer) {
      clearInterval(adrenalineHeartbeatTimer);
      adrenalineHeartbeatTimer = null;
    }
  }
}

export function playKnifeSlashWhoosh(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Swift metallic swoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);

    // Friction air slice
    const bufferSize = Math.floor(ctx.sampleRate * 0.16);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.16);
    filter.Q.value = 2.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.32, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  } catch {}
}

export function playRadioChirp(double = false): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // Tactical squelch noise burst
    const squelchDur = double ? 0.19 : 0.11;
    const bufferSize = Math.floor(ctx.sampleRate * squelchDur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2400, now);
    noiseFilter.Q.setValueAtTime(2.2, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + squelchDur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    const makeBeep = (time: number, freq: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, time);
      filter.Q.setValueAtTime(4.0, time);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.08, time + dur);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.24, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + dur);
    };

    if (double) {
      makeBeep(now + 0.02, 1950, 0.05);
      makeBeep(now + 0.09, 2550, 0.06);
    } else {
      makeBeep(now + 0.02, 1600, 0.075);
    }
  } catch {}
}

