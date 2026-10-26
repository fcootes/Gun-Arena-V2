import { LmgFireAudio } from './lmgFireAudio';
import type { LmgListener } from './lmgMechanics';
import { SMG } from './smgMechanics';
import type { BattleRifleListener } from './battleRifleMechanics';
import { AUDIO, SoundTrack, LMG_MECHANICAL_AUDIO_URLS, FIRST_BATCH_AUDIO_URLS, SECOND_BATCH_AUDIO_URLS, THIRD_BATCH_AUDIO_URLS, BR_MECHANICAL_AUDIO_URLS } from './audio';
import type { WeaponDef, WeaponSlotState } from './types';
import type { ShotgunEventListener } from './shotgunMechanics';
import type { SniperBoltListener } from './sniperMechanics';

const reloadProfiles = {
  smg: { tactical: AUDIO.smgReloadTactical, empty: AUDIO.smgReloadEmpty, tacticalDuration: 1.1232083333333334, emptyDuration: 1.98, chamberStart: 1.287 },
  lmg: { tactical: AUDIO.lmgReloadTactical, empty: AUDIO.lmgReloadEmpty, tacticalDuration: 3.276, emptyDuration: 5.544, chamberStart: 3.696 },
  br: { tactical: AUDIO.brReloadTactical, empty: AUDIO.brReloadEmpty, tacticalDuration: .7487916666666667, emptyDuration: 1.32, chamberStart: .858 },
  ar: { tactical: AUDIO.arReloadTactical, empty: AUDIO.arReloadEmpty, tacticalDuration: 1.9344, emptyDuration: 3.41, chamberStart: 2.2165 },
  pistol: { tactical: AUDIO.pistolReloadTactical, empty: AUDIO.pistolReloadEmpty, tacticalDuration: 1.1856, emptyDuration: 2.09, chamberStart: 1.3585 },
  sniper: { tactical: AUDIO.sniperReloadTactical, empty: AUDIO.sniperReloadEmpty, tacticalDuration: 1.6848, emptyDuration: 2.97, chamberStart: 1.9305 },
};
const reloadTracks = [
  AUDIO.smgReloadTactical, AUDIO.smgReloadEmpty,
  AUDIO.lmgReloadTactical, AUDIO.lmgReloadEmpty, AUDIO.lmgBoxOut, AUDIO.lmgBoxIn, AUDIO.lmgCharge, AUDIO.lmgCoverClose,
  AUDIO.brReloadTactical, AUDIO.brReloadEmpty, AUDIO.brMagazineOut, AUDIO.brMagazineIn, AUDIO.brCharge,
  AUDIO.arReloadTactical, AUDIO.arReloadEmpty,
  AUDIO.pistolReloadTactical, AUDIO.pistolReloadEmpty,
  AUDIO.sniperReloadTactical, AUDIO.sniperReloadEmpty,
  AUDIO.shotgunReload, AUDIO.shotgunReloadEmpty,
  AUDIO.laserVent, AUDIO.plasmaReloadEmpty, AUDIO.plasmaInsert,
];
const weaponUrls = { ...LMG_MECHANICAL_AUDIO_URLS, ...FIRST_BATCH_AUDIO_URLS, ...SECOND_BATCH_AUDIO_URLS, ...THIRD_BATCH_AUDIO_URLS, ...BR_MECHANICAL_AUDIO_URLS };
const weaponTracks = Object.keys(weaponUrls).map(key => AUDIO[key as keyof typeof weaponUrls]);

const lmgFireAudio = new LmgFireAudio(SECOND_BATCH_AUDIO_URLS.lmgFire,
  SECOND_BATCH_AUDIO_URLS.lmgAuto);

/** Prime only recordings for the current loadout and spawned actors; later shots stay lazy. */
export function prepareWeaponAudio(ids: readonly string[]): void {
  if (ids.includes('lmg')) void lmgFireAudio.prepare();
  const wanted = new Set(ids.map(id => id === 'laser' ? 'plasma' : id));
  for (const key of Object.keys(weaponUrls)) {
    const family = key.startsWith('laser') ? 'plasma' : key.match(/^[a-z]+(?=[A-Z])/)?.[0];
    if (family && wanted.has(family)) AUDIO[key as keyof typeof weaponUrls].prepare();
  }
}
export function releaseWeaponAudio(): void {
  stopWeaponAudio(); lmgFireAudio.release();
  for (const track of Object.values(AUDIO)) track.release();
}

let smgReloads = new WeakMap<WeaponSlotState, { sequence: NonNullable<WeaponSlotState['reloadSequence']>; started: boolean; speed: number; chamberOnly: boolean }>();
let plasmaReloads = new WeakMap<WeaponSlotState, { sequence: NonNullable<WeaponSlotState['reloadSequence']>; inserted: boolean }>();
let sniperReloads = new WeakMap<WeaponSlotState, { sequence: NonNullable<WeaponSlotState['reloadSequence']>; started: boolean }>();

function playFitted(track: SoundTrack, clipDuration: number, duration: number, volume = 1, offset = 0): void {
  if (!Number.isFinite(duration) || duration <= 0) return;
  track.play(volume, true, clipDuration / duration, offset);
}

/** Boundary callback from the authoritative action clock. Offset late frames
 * instead of queuing obsolete sounds; never truncate the separate shot tail. */
export const playShotgunMechanicalEvent: ShotgunEventListener = (event, duration, empty, late) => {
  if (late >= duration) return;
  const track = event === 'pump' ? AUDIO.shotgunPump : empty ? AUDIO.shotgunReloadEmpty : AUDIO.shotgunReload;
  const clip = track.duration || (event === 'pump' ? .42 : empty ? .5544 : .39312);
  playFitted(track, clip, duration, event === 'pump' ? 1 : .85, Math.max(0, late) * clip / duration);
};

export const playSniperBoltEvent: SniperBoltListener = (duration, late) => {
  if (late >= duration) return;
  const clip = AUDIO.sniperBolt.duration || .85;
  playFitted(AUDIO.sniperBolt, clip, duration, 1, Math.max(0, late) * clip / duration);
};

/** The supplied tactical recording contains only mag out/in. The empty
 * composite contains an automatic chamber cue, so it is deliberately not used. */
export function updateSniperReloadAudio(state: WeaponSlotState): void {
  const pending = sniperReloads.get(state);
  if (!pending || pending.started || !state.reloading || state.reloadSequence !== pending.sequence) return;
  const open = pending.sequence.phases[0].duration;
  const elapsed = (state.totalReloadT ?? 0) - (state.reloadT ?? 0);
  if (elapsed < open) return;
  pending.started = true;
  const duration = (state.totalReloadT ?? 0) - open, late = elapsed - open;
  if (late < duration) {
    const clip = AUDIO.sniperReloadTactical.duration || 1.6848;
    playFitted(AUDIO.sniperReloadTactical, clip, duration, 1, late * clip / duration);
  }
}

/** Existing BR mechanics cropped at the manifest's isolated action boundaries.
 * Normal speed at standard class; no stretched full composite or duplicate layer. */
export const playBattleRifleMechanicalEvent: BattleRifleListener = (event, speed, late) => {
  const track = event === 'extract' ? AUDIO.brMagazineOut : event === 'insert' ? AUDIO.brMagazineIn : AUDIO.brCharge;
  const clip = track.duration || (event === 'insert' ? .55 : .249);
  const offset = Math.max(0,late) / speed;
  if (offset < clip) track.play(1,true,1/speed,offset);
};

/** One unchanged composite, delayed for the hand's approach. Existing action
 * cuts keep their pitch; extra recovery time stays silent. No chamber layer. */
export function updateSmgReloadAudio(state: WeaponSlotState): void {
  const pending=smgReloads.get(state), q=state.reloadSequence;
  if(!pending||pending.started||!state.reloading||q!==pending.sequence)return;
  const elapsed=(state.totalReloadT??0)-(state.reloadT??0);
  const delay=pending.chamberOnly?0:q!.phases[0].duration;
  if(elapsed+1e-8<delay)return;
  pending.started=true;
  const empty=q!.empty, track=empty?AUDIO.smgReloadEmpty:AUDIO.smgReloadTactical;
  const offset=(pending.chamberOnly?SMG.chamberOffset:0)+(elapsed-delay)/pending.speed;
  const clip=empty?SMG.emptyClip:SMG.tacticalClip;
  if(offset<clip)track.play(1,true,1/pending.speed,Math.max(0,offset));
}

/** Discrete cues from the authoritative contact clock; no full composite. */
export const playLmgMechanicalEvent: LmgListener = (event,speed,late) => {
  if (!Number.isFinite(speed) || speed <= 0) return;
  const track=event==='extract'?AUDIO.lmgBoxOut:event==='seat'?AUDIO.lmgBoxIn:
    event==='cover'?AUDIO.lmgCoverClose:AUDIO.lmgCharge;
  const offset=Math.max(0,late)/speed;
  const clip=track.duration||(event==='extract'?.215:event==='cover'?.3195:.330);
  if(offset<clip)track.play(1,true,1/speed,offset);
};

export function playWeaponReloadAudio(weapon: WeaponDef, state: WeaponSlotState): boolean {
  if (!state.reloading || !state.reloadSequence) return false;
  if (weapon.id === 'smg' && ['open','chamber'].includes(state.reloadSequence.phases[0].phase)) {
    stopWeaponReloadAudio(); AUDIO.smgAuto.stop();
    const q=state.reloadSequence, chamberOnly=q.phases[0].phase==='chamber';
    const base=chamberOnly?SMG.empty.chamber:q.empty?SMG.empty.open:SMG.tactical.open;
    smgReloads.set(state,{sequence:q,started:false,speed:q.phases[0].duration/base,chamberOnly});
    updateSmgReloadAudio(state);return true;
  }
  if (weapon.id === 'lmg' && ['lift','chamber'].includes(state.reloadSequence.phases[0].phase)) { stopWeaponReloadAudio(); AUDIO.lmgAuto.stop(); return true; }
  if (weapon.id === 'br') { stopWeaponReloadAudio(); AUDIO.brBurst.stop(); return true; }
  if (weapon.id === 'sniper') {
    stopWeaponReloadAudio();
    sniperReloads.set(state, {sequence:state.reloadSequence,started:false});
    return true;
  }
  if (weapon.id === 'laser') {
    stopWeaponReloadAudio();
    AUDIO.laserBeam.stop();
    const empty = !!state.overheated || (state.heat ?? 0) >= 100;
    const track = empty ? AUDIO.plasmaReloadEmpty : AUDIO.laserVent;
    playFitted(track, track.duration || 2.2, state.totalReloadT ?? 0);
    // Manual cooling still uses the game's existing battery insert animation.
    if (!empty) plasmaReloads.set(state, { sequence: state.reloadSequence, inserted: false });
    return true;
  }
  if (weapon.id === 'shotgun') {
    stopWeaponReloadAudio();
    return true;
  }
  const profile = reloadProfiles[weapon.id as keyof typeof reloadProfiles];
  if (!profile) return false;
  stopWeaponReloadAudio();
  AUDIO.smgAuto.stop();
  AUDIO.lmgAuto.stop();
  AUDIO.brBurst.stop();
  const chamberOnly = state.reloadSequence.phases[0].phase === 'chamber';
  const empty = chamberOnly || !state.isTacticalReload;
  const track = empty ? profile.empty : profile.tactical;
  const offset = chamberOnly ? profile.chamberStart : 0;
  const clipDuration = (track.duration || (empty ? profile.emptyDuration : profile.tacticalDuration)) - offset;
  playFitted(track, clipDuration, state.totalReloadT ?? 0, 1, offset);
  return true;
}

export function stopWeaponReloadAudio(): void {
  reloadTracks.forEach(track => track.stop());
  smgReloads = new WeakMap();
  plasmaReloads = new WeakMap();
  sniperReloads = new WeakMap();
}

export function stopWeaponAudio(): void {
  lmgFireAudio.stop();
  weaponTracks.forEach(track => track.stop());
  minigunPhase = 'idle';
  partialBursts = new WeakSet<WeaponSlotState>();
  smgReloads = new WeakMap();
  plasmaReloads = new WeakMap();
  sniperReloads = new WeakMap();
  railgunCharging = false;
}

export function pauseWeaponAudio(): void {
  lmgFireAudio.pause();
  weaponTracks.forEach(track => track.pause());
}

export function resumeWeaponAudio(): void {
  lmgFireAudio.resume();
  weaponTracks.forEach(track => track.resume());
}

// The burst recording contains three reports. Short magazines use individual shots.
let partialBursts = new WeakSet<WeaponSlotState>();
export function playBattleRifleFire(state: WeaponSlotState, start: boolean): void {
  if (start) {
    partialBursts.delete(state);
    if ((state.ammo ?? 0) >= 2) AUDIO.brBurst.play();
    else { partialBursts.add(state); AUDIO.brSingle.play(); }
  } else if (partialBursts.has(state)) AUDIO.brSingle.play();
}

export function playLmgFire(shotNumber: number, _lastShot = false): void {
  // Last rounds follow exactly the same path; no loop-to-lead replacement.
  lmgFireAudio.play(shotNumber, AUDIO.lmgFire.volume);
}

export function playAutomaticWeaponFire(id: 'smg' | 'laser', shotNumber: number, lastShot = false): void {
  const single = id === 'smg' ? AUDIO.smgFire : AUDIO.plasmaSingle;
  const loop = id === 'smg' ? AUDIO.smgAuto : AUDIO.laserBeam;
  if (shotNumber <= 1 || lastShot) { loop.stop(); single.play(); }
  else { single.stop(); loop.playContinuous(); }
}

/** Follow simulation time so pause/cancellation cannot leave a delayed insert timer. */
export function updatePlasmaReloadAudio(state: WeaponSlotState): void {
  const pending = plasmaReloads.get(state);
  if (!pending || pending.inserted) return;
  const sequence = state.reloadSequence;
  if (!state.reloading || sequence !== pending.sequence) { plasmaReloads.delete(state); return; }
  const insertIndex = sequence.phases.findIndex(phase => phase.phase === 'insert');
  if (insertIndex < 0) return;
  const scale = (state.totalReloadT ?? 2.2) / 2.2;
  const insertEnd = sequence.phases.slice(0, insertIndex + 1).reduce((sum, phase) => sum + phase.duration, 0);
  const cue = insertEnd - .175 * scale;
  const elapsed = (state.totalReloadT ?? 0) - (state.reloadT ?? 0);
  if (elapsed < cue) return;
  pending.inserted = true;
  const offset = (elapsed - cue) / scale;
  const clipDuration = AUDIO.plasmaInsert.duration || .16;
  // A slow frame which skips the whole cue must not replay a stale mechanic.
  if (offset < clipDuration) playFitted(AUDIO.plasmaInsert, clipDuration, clipDuration * scale, 1, offset);
}

let railgunCharging = false;
export function updateRailgunWeaponAudio(charging: boolean, progress: number): void {
  if (!charging) {
    if (railgunCharging) AUDIO.railgunCharge.stop();
    railgunCharging = false;
    return;
  }
  if (railgunCharging || !AUDIO.railgunCharge.confirmedSrc) return;
  railgunCharging = true;
  AUDIO.railgunCharge.play(1, true, 1, Math.max(0, Math.min(1, progress)) * 1.2);
}

type MinigunAudioPhase = 'idle' | 'warming' | 'firing' | 'down' | 'cooling';
let minigunPhase: MinigunAudioPhase = 'idle';
export function updateMinigunWeaponAudio(warmup: number): void {
  const next = warmup < .5 ? 'warming' : 'firing';
  if (minigunPhase === next) return;
  AUDIO.minigunSpinDown.stop(); AUDIO.minigunCooling.stop(); AUDIO.minigunOverheat.stop();
  minigunPhase = next;
  if (next === 'warming') {
    AUDIO.minigunFire.stop();
    AUDIO.minigunWindup.play(1, true, 1, Math.max(0, warmup));
  } else {
    AUDIO.minigunWindup.stop();
    AUDIO.minigunFire.playContinuous();
  }
}

export function releaseMinigunAudio(spinSpeed: number): void {
  if (minigunPhase !== 'warming' && minigunPhase !== 'firing') return;
  AUDIO.minigunWindup.stop(); AUDIO.minigunFire.stop();
  minigunPhase = 'down';
  if (spinSpeed > 0) playFitted(AUDIO.minigunSpinDown, AUDIO.minigunSpinDown.duration || 1.4, spinSpeed / 20);
}

export function playMinigunCoolingAudio(ventDuration: number, spinDuration = 0): void {
  AUDIO.minigunWindup.stop(); AUDIO.minigunFire.stop();
  AUDIO.minigunSpinDown.stop(); AUDIO.minigunCooling.stop(); AUDIO.minigunOverheat.stop();
  minigunPhase = 'cooling';
  // Separate clips let the motor fit the actual emergency barrel decay.
  // The supplied composite ends its motor earlier, so do not layer it as well.
  if (spinDuration > 0) playFitted(AUDIO.minigunSpinDown, AUDIO.minigunSpinDown.duration || 1.4, spinDuration);
  playFitted(AUDIO.minigunCooling, AUDIO.minigunCooling.duration || 2, ventDuration);
}
