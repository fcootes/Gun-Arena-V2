import { AUDIO, SoundTrack, FIRST_BATCH_AUDIO_URLS } from './audio';
import type { WeaponDef, WeaponSlotState } from './types';
import type { ReloadPhase } from './weaponReload';

const reloadProfiles = {
  ar: { tactical: AUDIO.arReloadTactical, empty: AUDIO.arReloadEmpty, tacticalDuration: 1.9344, emptyDuration: 3.41, chamberStart: 2.2165 },
  pistol: { tactical: AUDIO.pistolReloadTactical, empty: AUDIO.pistolReloadEmpty, tacticalDuration: 1.1856, emptyDuration: 2.09, chamberStart: 1.3585 },
  sniper: { tactical: AUDIO.sniperReloadTactical, empty: AUDIO.sniperReloadEmpty, tacticalDuration: 1.6848, emptyDuration: 2.97, chamberStart: 1.9305 },
};
const reloadTracks = [
  AUDIO.arReloadTactical, AUDIO.arReloadEmpty,
  AUDIO.pistolReloadTactical, AUDIO.pistolReloadEmpty,
  AUDIO.sniperReloadTactical, AUDIO.sniperReloadEmpty,
  AUDIO.shotgunReload, AUDIO.shotgunReloadEmpty,
];
const firstBatchTracks = Object.keys(FIRST_BATCH_AUDIO_URLS).map(key => AUDIO[key as keyof typeof FIRST_BATCH_AUDIO_URLS]);

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

export function playFirstBatchReload(weapon: WeaponDef, state: WeaponSlotState): boolean {
  if (!state.reloading || !state.reloadSequence) return false;
  if (weapon.id === 'shotgun') {
    stopFirstBatchReloadAudio();
    const phase = state.reloadSequence.phases[0];
    playShotgunReloadPhase(phase.phase, phase.duration, state.reloadSequence.empty);
    return true;
  }
  const profile = reloadProfiles[weapon.id as keyof typeof reloadProfiles];
  if (!profile) return false;
  stopFirstBatchReloadAudio();
  const chamberOnly = state.reloadSequence.phases[0].phase === 'chamber';
  const empty = chamberOnly || !state.isTacticalReload;
  const track = empty ? profile.empty : profile.tactical;
  const offset = chamberOnly ? profile.chamberStart : 0;
  const clipDuration = (track.duration || (empty ? profile.emptyDuration : profile.tacticalDuration)) - offset;
  playFitted(track, clipDuration, state.totalReloadT ?? 0, 1, offset);
  return true;
}

export function stopFirstBatchReloadAudio(): void {
  reloadTracks.forEach(track => track.stop());
}

export function stopFirstBatchWeaponAudio(): void {
  firstBatchTracks.forEach(track => track.stop());
}

export function pauseFirstBatchWeaponAudio(): void {
  firstBatchTracks.forEach(track => track.pause());
}

export function resumeFirstBatchWeaponAudio(): void {
  firstBatchTracks.forEach(track => track.resume());
}
