import { AUDIO, SoundTrack, FIRST_BATCH_AUDIO_URLS, SECOND_BATCH_AUDIO_URLS, THIRD_BATCH_AUDIO_URLS } from './audio';
import type { WeaponDef, WeaponSlotState } from './types';
import type { ReloadPhase } from './weaponReload';

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
  AUDIO.lmgReloadTactical, AUDIO.lmgReloadEmpty,
  AUDIO.brReloadTactical, AUDIO.brReloadEmpty,
  AUDIO.arReloadTactical, AUDIO.arReloadEmpty,
  AUDIO.pistolReloadTactical, AUDIO.pistolReloadEmpty,
  AUDIO.sniperReloadTactical, AUDIO.sniperReloadEmpty,
  AUDIO.shotgunReload, AUDIO.shotgunReloadEmpty,
  AUDIO.laserVent, AUDIO.plasmaReloadEmpty, AUDIO.plasmaInsert,
];
const weaponUrls = { ...FIRST_BATCH_AUDIO_URLS, ...SECOND_BATCH_AUDIO_URLS, ...THIRD_BATCH_AUDIO_URLS };
const weaponTracks = Object.keys(weaponUrls).map(key => AUDIO[key as keyof typeof weaponUrls]);

/** Prime only recordings for the current loadout and spawned actors; later shots stay lazy. */
export function prepareWeaponAudio(ids: readonly string[]): void {
  const wanted = new Set(ids.map(id => id === 'laser' ? 'plasma' : id));
  for (const key of Object.keys(weaponUrls)) {
    const family = key.startsWith('laser') ? 'plasma' : key.match(/^[a-z]+(?=[A-Z])/)?.[0];
    if (family && wanted.has(family)) AUDIO[key as keyof typeof weaponUrls].prepare();
  }
}
export function releaseWeaponAudio(): void {
  stopWeaponAudio();
  for (const track of Object.values(AUDIO)) track.release();
}

let plasmaReloads = new WeakMap<WeaponSlotState, { sequence: NonNullable<WeaponSlotState['reloadSequence']>; inserted: boolean }>();

function playFitted(track: SoundTrack, clipDuration: number, duration: number, volume = 1, offset = 0): void {
  if (!Number.isFinite(duration) || duration <= 0) return;
  track.play(volume, true, clipDuration / duration, offset);
}

export function playShotgunReloadPhase(phase: ReloadPhase, duration: number, empty: boolean): void {
  if (phase === 'insert') {
    const track = empty ? AUDIO.shotgunReloadEmpty : AUDIO.shotgunReload;
    playFitted(track, track.duration || (empty ? .5544 : .39312), duration, .85);
  } else if (phase === 'chamber' || (phase === 'close' && !empty)) {
    playFitted(AUDIO.shotgunPump, AUDIO.shotgunPump.duration || .42, duration);
  }
}

export function playWeaponReloadAudio(weapon: WeaponDef, state: WeaponSlotState): boolean {
  if (!state.reloading || !state.reloadSequence) return false;
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
    const phase = state.reloadSequence.phases[0];
    playShotgunReloadPhase(phase.phase, phase.duration, state.reloadSequence.empty);
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
  plasmaReloads = new WeakMap();
}

export function stopWeaponAudio(): void {
  weaponTracks.forEach(track => track.stop());
  minigunPhase = 'idle';
  partialBursts = new WeakSet<WeaponSlotState>();
  plasmaReloads = new WeakMap();
  railgunCharging = false;
}

export function pauseWeaponAudio(): void {
  weaponTracks.forEach(track => track.pause());
}

export function resumeWeaponAudio(): void {
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

export function playLmgFire(shotNumber: number, lastShot = false): void {
  if (shotNumber <= 1 || lastShot) { AUDIO.lmgAuto.stop(); AUDIO.lmgFire.play(); }
  else { AUDIO.lmgFire.stop(); AUDIO.lmgAuto.playContinuous(); }
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
