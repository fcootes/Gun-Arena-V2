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
const { AUDIO, FIRST_BATCH_AUDIO_URLS, SECOND_BATCH_AUDIO_URLS, THIRD_BATCH_AUDIO_URLS } = await import('../src/audio');
const { playWeaponReloadAudio, playShotgunReloadPhase, stopWeaponReloadAudio, stopWeaponAudio, pauseWeaponAudio, resumeWeaponAudio, playLmgFire, playBattleRifleFire, updateMinigunWeaponAudio, releaseMinigunAudio, playMinigunCoolingAudio, playAutomaticWeaponFire, updatePlasmaReloadAudio, updateRailgunWeaponAudio } = await import('../src/weaponAudio');
for (const track of Object.values(AUDIO)) track.prepare();
const latest = (track: typeof AUDIO.arSingle) => track.pool[(track.index + track.poolSize - 1) % track.poolSize] as unknown as MockAudio;
const plays = (track: typeof AUDIO.arSingle) => track.pool.reduce((n, audio) => n + (audio as unknown as MockAudio).plays, 0);
const weapon = (id: string) => WEAPONS.find(w => w.id === id)!;

assert.equal(Object.keys(FIRST_BATCH_AUDIO_URLS).length, 16);
assert.equal(Object.keys(SECOND_BATCH_AUDIO_URLS).length, 15);
assert.equal(Object.keys(THIRD_BATCH_AUDIO_URLS).length, 9);
for (const [key, url] of Object.entries({ ...FIRST_BATCH_AUDIO_URLS, ...SECOND_BATCH_AUDIO_URLS, ...THIRD_BATCH_AUDIO_URLS })) {
  assert.ok(existsSync(fileURLToPath(url)), `${key}: bundled asset exists`);
  const track = AUDIO[key as keyof typeof FIRST_BATCH_AUDIO_URLS | keyof typeof SECOND_BATCH_AUDIO_URLS | keyof typeof THIRD_BATCH_AUDIO_URLS];
  assert.equal(track.confirmedSrc, url); assert.equal(track.duration, wavDuration(url));
}
assert.equal(AUDIO.arSpray.loop, true);
assert.ok(AUDIO.arSpray.pool.every(a => a.loop));
AUDIO.arSpray.playContinuous(); const arLoop = AUDIO.arSpray.pool[0] as unknown as MockAudio;
const startCount = arLoop.plays; arLoop.currentTime = .3; AUDIO.arSpray.playContinuous();
assert.equal(arLoop.plays, startCount, 'Continuous firing does not restart its loop');
AUDIO.arSpray.stop(); assert.equal(arLoop.paused, true); assert.equal(arLoop.currentTime, 0);
console.log('PASS: all 40 real PCM assets, source selection and sustained AR loop without restart');

for (const [id, tactical, empty] of [
  ['ar', AUDIO.arReloadTactical, AUDIO.arReloadEmpty],
  ['pistol', AUDIO.pistolReloadTactical, AUDIO.pistolReloadEmpty],
  ['sniper', AUDIO.sniperReloadTactical, AUDIO.sniperReloadEmpty],
  ['smg', AUDIO.smgReloadTactical, AUDIO.smgReloadEmpty],
  ['lmg', AUDIO.lmgReloadTactical, AUDIO.lmgReloadEmpty],
  ['br', AUDIO.brReloadTactical, AUDIO.brReloadEmpty],
] as const) {
  for (const multiplier of [1, .75, .9]) for (const ammo of [0, 1]) {
    const w = weapon(id), ws: WeaponSlotState = { ammo, reserve: 100 };
    assert.ok(beginWeaponReload(w, ws, multiplier)); assert.equal(playWeaponReloadAudio(w, ws), true);
    const selected = ammo ? tactical : empty, other = ammo ? empty : tactical;
    const audio = latest(selected);
    assert.equal(audio.paused, false); assert.ok(other.pool.every(a => a.paused));
    assert.ok(Math.abs(audio.duration / audio.playbackRate - ws.totalReloadT!) < 1e-9, `${id}: class-adjusted clip fits reload`);
    assert.equal(audio.preservesPitch, true);
    const totalAmmo = ws.ammo! + ws.reserve!;
    advanceWeaponReload(w, ws, 20); stopWeaponReloadAudio();
    assert.equal(ws.ammo, w.mag); assert.equal(ws.ammo! + ws.reserve!, totalAmmo);
    assert.ok(selected.pool.every(a => a.paused && a.currentTime === 0));
  }
}
const resumed: WeaponSlotState = { ammo: 10, reserve: 20, needsChamber: true };
assert.ok(beginWeaponReload(weapon('ar'), resumed)); playWeaponReloadAudio(weapon('ar'), resumed);
assert.equal(latest(AUDIO.arReloadEmpty).currentTime, 2.2165, 'Chamber-only resume skips mag-out and mag-in sounds');
stopWeaponAudio();
const laterBatch: WeaponSlotState = { ammo: 0, reserve: 100 }; beginWeaponReload(weapon('railgun'), laterBatch);
assert.equal(playWeaponReloadAudio(weapon('railgun'), laterBatch), false, 'Other weapons retain their existing audio path');
console.log('PASS: tactical/empty selection, class reload duration, ammo preservation and chamber-only resume');

const shotgun = weapon('shotgun');
for (const ammo of [0, 2, 5]) for (const reserve of [1, 20]) for (const multiplier of [1, .75]) {
  const ws: WeaponSlotState = { ammo, reserve }, empty = ammo === 0;
  const selected = empty ? AUDIO.shotgunReloadEmpty : AUDIO.shotgunReload;
  const before = plays(selected), pumpBefore = plays(AUDIO.shotgunPump);
  const missing = Math.min(shotgun.mag! - ammo, reserve);
  assert.ok(beginWeaponReload(shotgun, ws, multiplier));
  playWeaponReloadAudio(shotgun, ws);
  assert.equal(plays(selected), before, 'No shell sound during initial open phase');
  const insertDuration = ws.reloadSequence!.phases[1].duration;
  const inserted = advanceWeaponReload(shotgun, ws, 100, playShotgunReloadPhase);
  assert.equal(inserted, missing); assert.equal(plays(selected) - before, missing, 'Exactly one start event per actual shell phase');
  assert.equal(plays(AUDIO.shotgunPump) - pumpBefore, 1, 'One final pump for both empty and partial reloads');
  assert.ok(Math.abs(latest(selected).duration / latest(selected).playbackRate - insertDuration) < 1e-9);
  assert.equal(ws.ammo, ammo + missing); assert.equal(ws.reserve, reserve - missing);
  stopWeaponAudio();
}
const interrupted: WeaponSlotState = { ammo: 0, reserve: 20 };
beginWeaponReload(shotgun, interrupted); playWeaponReloadAudio(shotgun, interrupted);
const phases = interrupted.reloadSequence!.phases;
advanceWeaponReload(shotgun, interrupted, phases[0].duration + phases[1].duration, playShotgunReloadPhase);
assert.equal(interrupted.ammo, 1); assert.equal(interruptShellReload(shotgun, interrupted), true);
stopWeaponReloadAudio(); const n = plays(AUDIO.shotgunReloadEmpty);
advanceWeaponReload(shotgun, interrupted, 20, playShotgunReloadPhase);
assert.equal(plays(AUDIO.shotgunReloadEmpty), n, 'Interrupted reload cannot emit future shell sounds');
assert.equal(interrupted.ammo, 1); assert.ok(AUDIO.shotgunReloadEmpty.pool.every(a => a.paused));
console.log('PASS: exact shell counts, phase-start timing through large deltas, final pump and interruption');

AUDIO.pistolReloadEmpty.play(1, true, 1.25);
const paused = latest(AUDIO.pistolReloadEmpty); paused.currentTime = .41;
pauseWeaponAudio(); assert.equal(paused.paused, true);
resumeWeaponAudio(); assert.equal(paused.paused, false); assert.equal(paused.currentTime, .41); assert.equal(paused.playbackRate, 1.25);
pauseWeaponAudio(); stopWeaponAudio(); const stoppedPlays = paused.plays;
resumeWeaponAudio(); assert.equal(paused.plays, stoppedPlays, 'Stopped audio does not resume after switching/death');
assert.equal(paused.currentTime, 0);
console.log('PASS: pause/resume preserves cursor and speed; cancellation clears pending resume');


for (const [id, track, offset] of [
  ['smg', AUDIO.smgReloadEmpty, 1.287], ['lmg', AUDIO.lmgReloadEmpty, 3.696], ['br', AUDIO.brReloadEmpty, .858],
] as const) {
  const ws: WeaponSlotState = { ammo: 10, reserve: 100, needsChamber: true };
  beginWeaponReload(weapon(id), ws); playWeaponReloadAudio(weapon(id), ws);
  assert.equal(latest(track).currentTime, offset);
  assert.ok(Math.abs((track.duration - offset) / latest(track).playbackRate - ws.totalReloadT!) < 1e-9);
  stopWeaponAudio();
}

const lmgShots = plays(AUDIO.lmgFire), lmgLoops = plays(AUDIO.lmgAuto);
playLmgFire(1); assert.equal(plays(AUDIO.lmgFire), lmgShots + 1);
assert.equal(plays(AUDIO.lmgAuto), lmgLoops);
playLmgFire(2); playLmgFire(3); playLmgFire(4);
assert.equal(plays(AUDIO.lmgAuto), lmgLoops + 1, 'LMG loop starts once after first report');
assert.ok(AUDIO.lmgFire.pool.every(a => a.paused));
playLmgFire(5, true);
assert.equal(plays(AUDIO.lmgFire), lmgShots + 2, 'Last LMG round has one complete report');
assert.ok(AUDIO.lmgAuto.pool.every(a => a.paused), 'Empty magazine cannot leave a loop running');
playLmgFire(6);
const lmgReload: WeaponSlotState = { ammo: 30, reserve: 100 };
beginWeaponReload(weapon('lmg'), lmgReload); playWeaponReloadAudio(weapon('lmg'), lmgReload);
assert.ok(AUDIO.lmgAuto.pool.every(a => a.paused), 'Reload cancels LMG fire loop');
stopWeaponAudio();

for (const count of [1, 2, 3]) {
  const ws: WeaponSlotState = { ammo: count - 1 }, burstBefore = plays(AUDIO.brBurst), singleBefore = plays(AUDIO.brSingle);
  playBattleRifleFire(ws, true);
  for (let i = 1; i < count; i++) { ws.ammo!--; playBattleRifleFire(ws, false); }
  assert.equal(plays(AUDIO.brBurst) - burstBefore, count === 3 ? 1 : 0);
  assert.equal(plays(AUDIO.brSingle) - singleBefore, count === 3 ? 0 : count);
  stopWeaponAudio();
}
console.log('PASS: new reload/chamber profiles, one LMG loop, exactly three/two/one BR reports');

const warmBefore = plays(AUDIO.minigunWindup), fireBefore = plays(AUDIO.minigunFire);
updateMinigunWeaponAudio(.05); updateMinigunWeaponAudio(.2); updateMinigunWeaponAudio(.4);
assert.equal(plays(AUDIO.minigunWindup), warmBefore + 1); assert.equal(plays(AUDIO.minigunFire), fireBefore);
assert.equal(latest(AUDIO.minigunWindup).currentTime, .05);
updateMinigunWeaponAudio(.5); updateMinigunWeaponAudio(.5);
assert.equal(plays(AUDIO.minigunFire), fireBefore + 1);
assert.ok(AUDIO.minigunWindup.pool.every(a => a.paused));
const spinBefore = plays(AUDIO.minigunSpinDown);
releaseMinigunAudio(28); releaseMinigunAudio(27);
assert.equal(plays(AUDIO.minigunSpinDown), spinBefore + 1);
assert.equal(latest(AUDIO.minigunSpinDown).playbackRate, 1);
assert.ok(AUDIO.minigunFire.pool.every(a => a.paused));
// Re-press during coast-down seeks the shortened warmup rather than replaying it all.
updateMinigunWeaponAudio(.3); assert.equal(latest(AUDIO.minigunWindup).currentTime, .3);
assert.ok(AUDIO.minigunSpinDown.pool.every(a => a.paused));
for (const [vent, spin] of [[2, 28 / 15], [1.65, 1.65], [2, 0]]) {
  const hissBefore = plays(AUDIO.minigunCooling), compositeBefore = plays(AUDIO.minigunOverheat), downBefore = plays(AUDIO.minigunSpinDown);
  playMinigunCoolingAudio(vent, spin);
  assert.equal(plays(AUDIO.minigunCooling), hissBefore + 1);
  assert.ok(Math.abs(AUDIO.minigunCooling.duration / latest(AUDIO.minigunCooling).playbackRate - vent) < 1e-9);
  assert.equal(plays(AUDIO.minigunSpinDown) - downBefore, spin ? 1 : 0);
  if (spin) assert.ok(Math.abs(AUDIO.minigunSpinDown.duration / latest(AUDIO.minigunSpinDown).playbackRate - spin) < 1e-9);
  assert.equal(plays(AUDIO.minigunOverheat), compositeBefore, 'Do not double the authored spin/hiss composite');
  releaseMinigunAudio(28); assert.equal(plays(AUDIO.minigunSpinDown) - downBefore, spin ? 1 : 0);
  stopWeaponAudio();
}
updateMinigunWeaponAudio(.1); const warm = latest(AUDIO.minigunWindup); warm.currentTime = .21;
pauseWeaponAudio(); assert.ok(warm.paused); resumeWeaponAudio(); assert.equal(warm.currentTime, .21);
stopWeaponAudio(); const restarts = plays(AUDIO.minigunWindup);
resumeWeaponAudio(); assert.equal(plays(AUDIO.minigunWindup), restarts);
updateMinigunWeaponAudio(.1); assert.equal(plays(AUDIO.minigunWindup), restarts + 1, 'Cancellation resets minigun transitions');
stopWeaponAudio();
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.ok(!/updateMinigunSpinAudio|playMinigunFireShot|playMinigunVentHiss/.test(app), 'No duplicate synthetic minigun audio in gameplay');
assert.equal((app.match(/playBattleRifleFire\(ws, true\)/g) ?? []).length, 1);
assert.equal((app.match(/playBattleRifleFire\(curWs, false\)/g) ?? []).length, 1);
console.log('PASS: minigun transitions, shortened warmup, fitted spin/vent, no duplicate hiss, pause and cancellation');


for (const [id, single, loop] of [
  ['smg', AUDIO.smgFire, AUDIO.smgAuto], ['laser', AUDIO.plasmaSingle, AUDIO.laserBeam],
] as const) {
  const singleBefore = plays(single), loopBefore = plays(loop);
  playAutomaticWeaponFire(id, 1);
  assert.equal(plays(single), singleBefore + 1); assert.equal(plays(loop), loopBefore);
  playAutomaticWeaponFire(id, 2); const cursor = loop.pool[0] as unknown as MockAudio; cursor.currentTime = .04;
  playAutomaticWeaponFire(id, 3); playAutomaticWeaponFire(id, 4);
  assert.equal(plays(loop), loopBefore + 1); assert.equal(cursor.currentTime, .04);
  assert.ok(single.pool.every(a => a.paused));
  playAutomaticWeaponFire(id, 5, true);
  assert.equal(plays(single), singleBefore + 2); assert.ok(cursor.paused);
  stopWeaponAudio();
}
console.log('PASS: SMG/plasma taps, sustained loops without restarting/layering, and final reports');

for (const multiplier of [1, .75, .9]) for (const empty of [false, true]) {
  const w = weapon('laser'), ws: WeaponSlotState = { ammo: 100, reserve: 100, heat: empty ? 100 : 40, overheated: empty };
  const hissBefore = plays(AUDIO.laserVent), compositeBefore = plays(AUDIO.plasmaReloadEmpty), insertBefore = plays(AUDIO.plasmaInsert);
  assert.ok(beginWeaponReload(w, ws, multiplier)); assert.ok(playWeaponReloadAudio(w, ws));
  assert.equal(plays(AUDIO.laserVent) - hissBefore, empty ? 0 : 1);
  assert.equal(plays(AUDIO.plasmaReloadEmpty) - compositeBefore, empty ? 1 : 0);
  const selected = empty ? AUDIO.plasmaReloadEmpty : AUDIO.laserVent;
  assert.ok(Math.abs(selected.duration / latest(selected).playbackRate - ws.totalReloadT!) < 1e-9);
  // Sample 10 ms before and 10 ms after the authored insert cue, scaled by class.
  advanceWeaponReload(w, ws, 1.575 * multiplier); updatePlasmaReloadAudio(ws);
  assert.equal(plays(AUDIO.plasmaInsert), insertBefore);
  const elapsedBeforePause = ws.reloadT;
  pauseWeaponAudio(); assert.ok(selected.pool.every(a => a.paused));
  resumeWeaponAudio(); assert.equal(ws.reloadT, elapsedBeforePause);
  advanceWeaponReload(w, ws, .02 * multiplier); updatePlasmaReloadAudio(ws); updatePlasmaReloadAudio(ws);
  assert.equal(plays(AUDIO.plasmaInsert) - insertBefore, empty ? 0 : 1, 'Composite has its own insert; manual cue plays once');
  if (!empty) {
    assert.ok(Math.abs(latest(AUDIO.plasmaInsert).currentTime - .01) < 1e-9);
    assert.ok(Math.abs(latest(AUDIO.plasmaInsert).playbackRate - 1 / multiplier) < 1e-9);
  }
  advanceWeaponReload(w, ws, 10); updatePlasmaReloadAudio(ws); stopWeaponReloadAudio();
  assert.equal(ws.heat, 0); assert.equal(ws.ammo, w.mag);
  assert.ok(selected.pool.every(a => a.paused)); stopWeaponAudio();
}
for (const cancellation of ['switch', 'replace-sequence', 'skip-cue']) {
  const ws: WeaponSlotState = { ammo: 100, reserve: 100, heat: 20 };
  beginWeaponReload(weapon('laser'), ws); playWeaponReloadAudio(weapon('laser'), ws);
  const before = plays(AUDIO.plasmaInsert);
  if (cancellation === 'switch') stopWeaponAudio();
  if (cancellation === 'replace-sequence') ws.reloadSequence = { ...ws.reloadSequence! };
  advanceWeaponReload(weapon('laser'), ws, cancellation === 'skip-cue' ? 2 : 1.595);
  updatePlasmaReloadAudio(ws);
  assert.equal(plays(AUDIO.plasmaInsert), before, 'Cancelled/replaced/fully missed insert cue stays silent');
  stopWeaponAudio();
}
console.log('PASS: class-fitted plasma cooling/composite selection, insert cue, no duplicate hiss, pause/cancellation');

const chargeBefore = plays(AUDIO.railgunCharge), shotBefore = plays(AUDIO.railgunFire);
updateRailgunWeaponAudio(true, .1); const charge = latest(AUDIO.railgunCharge);
assert.equal(plays(AUDIO.railgunCharge), chargeBefore + 1); assert.equal(charge.currentTime, .12);
charge.currentTime = .4; updateRailgunWeaponAudio(true, .5); assert.equal(charge.currentTime, .4);
assert.equal(plays(AUDIO.railgunCharge), chargeBefore + 1);
assert.equal(plays(AUDIO.railgunFire), shotBefore, 'Warmup never fires the slug early');
pauseWeaponAudio(); assert.ok(charge.paused); resumeWeaponAudio(); assert.equal(charge.currentTime, .4);
updateRailgunWeaponAudio(false, 0); assert.ok(charge.paused); assert.equal(charge.currentTime, 0);
const cancelled = plays(AUDIO.railgunCharge); resumeWeaponAudio(); assert.equal(plays(AUDIO.railgunCharge), cancelled);
updateRailgunWeaponAudio(true, 0); updateRailgunWeaponAudio(false, 0); AUDIO.railgunFire.play();
assert.equal(plays(AUDIO.railgunFire), shotBefore + 1); assert.ok(charge.paused);
assert.equal(AUDIO.railgunFire.duration, 2.4);
stopWeaponAudio(); updateRailgunWeaponAudio(true, .2);
assert.equal(latest(AUDIO.railgunCharge).currentTime, .24); stopWeaponAudio();
assert.ok(!/updateRailgunChargeAudio|playRailgunSlugBlast/.test(app), 'Gameplay cannot double synthesized railgun tracks');
assert.ok(!/AUDIO\.laserVent\.play\(/.test(app), 'Overheat dispatch cannot directly double the fitted reload hiss');
console.log('PASS: one railgun charge, cursor preservation, early cancellation, slug transition and no synthetic doubling');
