import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEAPONS } from '../src/weapons';
import { beginWeaponReload, advanceWeaponReload, interruptShellReload } from '../src/weaponReload';
import type { WeaponSlotState } from '../src/types';

function wavDuration(url: string): number {
  const bytes = readFileSync(fileURLToPath(url));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  let rate = 0, channels = 0, bits = 0, dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (type === 'fmt ') {
      assert.equal(bytes.readUInt16LE(offset + 8), 1, 'PCM audio');
      channels = bytes.readUInt16LE(offset + 10); rate = bytes.readUInt32LE(offset + 12); bits = bytes.readUInt16LE(offset + 22);
    }
    if (type === 'data') dataSize = size;
    offset += 8 + size + (size % 2);
  }
  assert.equal(rate, 48000); assert.equal(channels, 2); assert.equal(bits, 16);
  assert.ok(dataSize > 0); return dataSize / (rate * channels * bits / 8);
}
class MockAudio {
  private value = '';
  private listeners = new Map<string, (() => void)[]>();
  preload = ''; loop = false; volume = 1; currentTime = 0; playbackRate = 1;
  preservesPitch = true; duration = 0; paused = true; ended = false; plays = 0;
  set src(url: string) {
    this.value = url;
    this.duration = url.startsWith('file:') && existsSync(fileURLToPath(url)) ? wavDuration(url) : 1;
    for (const cb of this.listeners.get('loadedmetadata') ?? []) cb();
  }
  get src() { return this.value; }
  addEventListener(type: string, cb: () => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]); }
  play() { this.paused = false; this.ended = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
}
(globalThis as any).Audio = MockAudio;
const { AUDIO, FIRST_BATCH_AUDIO_URLS } = await import('../src/audio');
const { playFirstBatchReload, playShotgunReloadPhase, stopFirstBatchReloadAudio, stopFirstBatchWeaponAudio, pauseFirstBatchWeaponAudio, resumeFirstBatchWeaponAudio } = await import('../src/weaponAudio');
const latest = (track: typeof AUDIO.arSingle) => track.pool[(track.index + track.poolSize - 1) % track.poolSize] as unknown as MockAudio;
const plays = (track: typeof AUDIO.arSingle) => track.pool.reduce((n, audio) => n + (audio as unknown as MockAudio).plays, 0);
const weapon = (id: string) => WEAPONS.find(w => w.id === id)!;

assert.equal(Object.keys(FIRST_BATCH_AUDIO_URLS).length, 16);
for (const [key, url] of Object.entries(FIRST_BATCH_AUDIO_URLS)) {
  assert.ok(existsSync(fileURLToPath(url)), `${key}: bundled asset exists`);
  const track = AUDIO[key as keyof typeof FIRST_BATCH_AUDIO_URLS];
  assert.equal(track.confirmedSrc, url); assert.equal(track.duration, wavDuration(url));
}
assert.equal(AUDIO.arSpray.loop, true);
assert.ok(AUDIO.arSpray.pool.every(a => a.loop));
AUDIO.arSpray.playContinuous(); const arLoop = AUDIO.arSpray.pool[0] as unknown as MockAudio;
const startCount = arLoop.plays; arLoop.currentTime = .3; AUDIO.arSpray.playContinuous();
assert.equal(arLoop.plays, startCount, 'Continuous firing does not restart its loop');
AUDIO.arSpray.stop(); assert.equal(arLoop.paused, true); assert.equal(arLoop.currentTime, 0);
console.log('PASS: all 16 real PCM assets, source selection and sustained AR loop without restart');

for (const [id, tactical, empty] of [
  ['ar', AUDIO.arReloadTactical, AUDIO.arReloadEmpty],
  ['pistol', AUDIO.pistolReloadTactical, AUDIO.pistolReloadEmpty],
  ['sniper', AUDIO.sniperReloadTactical, AUDIO.sniperReloadEmpty],
] as const) {
  for (const multiplier of [1, .75, .9]) for (const ammo of [0, 1]) {
    const w = weapon(id), ws: WeaponSlotState = { ammo, reserve: 100 };
    assert.ok(beginWeaponReload(w, ws, multiplier)); assert.equal(playFirstBatchReload(w, ws), true);
    const selected = ammo ? tactical : empty, other = ammo ? empty : tactical;
    const audio = latest(selected);
    assert.equal(audio.paused, false); assert.ok(other.pool.every(a => a.paused));
    assert.ok(Math.abs(audio.duration / audio.playbackRate - ws.totalReloadT!) < 1e-9, `${id}: class-adjusted clip fits reload`);
    assert.equal(audio.preservesPitch, true);
    const totalAmmo = ws.ammo! + ws.reserve!;
    advanceWeaponReload(w, ws, 20); stopFirstBatchReloadAudio();
    assert.equal(ws.ammo, w.mag); assert.equal(ws.ammo! + ws.reserve!, totalAmmo);
    assert.ok(selected.pool.every(a => a.paused && a.currentTime === 0));
  }
}
const resumed: WeaponSlotState = { ammo: 10, reserve: 20, needsChamber: true };
assert.ok(beginWeaponReload(weapon('ar'), resumed)); playFirstBatchReload(weapon('ar'), resumed);
assert.equal(latest(AUDIO.arReloadEmpty).currentTime, 2.2165, 'Chamber-only resume skips mag-out and mag-in sounds');
stopFirstBatchWeaponAudio();
const laterBatch: WeaponSlotState = { ammo: 0, reserve: 100 }; beginWeaponReload(weapon('smg'), laterBatch);
assert.equal(playFirstBatchReload(weapon('smg'), laterBatch), false, 'Other weapons retain their existing audio path');
console.log('PASS: tactical/empty selection, class reload duration, ammo preservation and chamber-only resume');

const shotgun = weapon('shotgun');
for (const ammo of [0, 2, 5]) for (const reserve of [1, 20]) for (const multiplier of [1, .75]) {
  const ws: WeaponSlotState = { ammo, reserve }, empty = ammo === 0;
  const selected = empty ? AUDIO.shotgunReloadEmpty : AUDIO.shotgunReload;
  const before = plays(selected), pumpBefore = plays(AUDIO.shotgunPump);
  const missing = Math.min(shotgun.mag! - ammo, reserve);
  assert.ok(beginWeaponReload(shotgun, ws, multiplier));
  playFirstBatchReload(shotgun, ws);
  assert.equal(plays(selected), before, 'No shell sound during initial open phase');
  const insertDuration = ws.reloadSequence!.phases[1].duration;
  const inserted = advanceWeaponReload(shotgun, ws, 100, playShotgunReloadPhase);
  assert.equal(inserted, missing); assert.equal(plays(selected) - before, missing, 'Exactly one start event per actual shell phase');
  assert.equal(plays(AUDIO.shotgunPump) - pumpBefore, 1, 'One final pump for both empty and partial reloads');
  assert.ok(Math.abs(latest(selected).duration / latest(selected).playbackRate - insertDuration) < 1e-9);
  assert.equal(ws.ammo, ammo + missing); assert.equal(ws.reserve, reserve - missing);
  stopFirstBatchWeaponAudio();
}
const interrupted: WeaponSlotState = { ammo: 0, reserve: 20 };
beginWeaponReload(shotgun, interrupted); playFirstBatchReload(shotgun, interrupted);
const phases = interrupted.reloadSequence!.phases;
advanceWeaponReload(shotgun, interrupted, phases[0].duration + phases[1].duration, playShotgunReloadPhase);
assert.equal(interrupted.ammo, 1); assert.equal(interruptShellReload(shotgun, interrupted), true);
stopFirstBatchReloadAudio(); const n = plays(AUDIO.shotgunReloadEmpty);
advanceWeaponReload(shotgun, interrupted, 20, playShotgunReloadPhase);
assert.equal(plays(AUDIO.shotgunReloadEmpty), n, 'Interrupted reload cannot emit future shell sounds');
assert.equal(interrupted.ammo, 1); assert.ok(AUDIO.shotgunReloadEmpty.pool.every(a => a.paused));
console.log('PASS: exact shell counts, phase-start timing through large deltas, final pump and interruption');

AUDIO.pistolReloadEmpty.play(1, true, 1.25);
const paused = latest(AUDIO.pistolReloadEmpty); paused.currentTime = .41;
pauseFirstBatchWeaponAudio(); assert.equal(paused.paused, true);
resumeFirstBatchWeaponAudio(); assert.equal(paused.paused, false); assert.equal(paused.currentTime, .41); assert.equal(paused.playbackRate, 1.25);
pauseFirstBatchWeaponAudio(); stopFirstBatchWeaponAudio(); const stoppedPlays = paused.plays;
resumeFirstBatchWeaponAudio(); assert.equal(paused.plays, stoppedPlays, 'Stopped audio does not resume after switching/death');
assert.equal(paused.currentTime, 0);
console.log('PASS: pause/resume preserves cursor and speed; cancellation clears pending resume');
