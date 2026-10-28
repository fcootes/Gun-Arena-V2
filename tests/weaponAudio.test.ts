import { LMG } from '../src/lmgMechanics';
import { SMG } from '../src/smgMechanics';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEAPONS } from '../src/weapons';
import { beginWeaponReload, advanceWeaponReload, cancelWeaponReload, interruptShellReload } from '../src/weaponReload';
import type { WeaponSlotState } from '../src/types';
import { SNIPER, beginSniperCycle, requireSniperBolt } from '../src/sniperMechanics';
import { beginShotgunCycle } from '../src/shotgunMechanics';

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
const { AUDIO, LMG_MECHANICAL_AUDIO_URLS, FIRST_BATCH_AUDIO_URLS, SECOND_BATCH_AUDIO_URLS, THIRD_BATCH_AUDIO_URLS } = await import('../src/audio');
const { playWeaponReloadAudio, playLmgMechanicalEvent, updateSmgReloadAudio, playShotgunMechanicalEvent, playBattleRifleMechanicalEvent, playSniperBoltEvent, updateSniperReloadAudio, stopWeaponReloadAudio, stopWeaponAudio, pauseWeaponAudio, resumeWeaponAudio, playLmgFire, playBattleRifleFire, updateMinigunWeaponAudio, releaseMinigunAudio, playMinigunCoolingAudio, playAutomaticWeaponFire, updatePlasmaReloadAudio, updateRailgunWeaponAudio } = await import('../src/weaponAudio');
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
  ['smg', AUDIO.smgReloadTactical, AUDIO.smgReloadEmpty],
] as const) {
  for (const multiplier of [1, .75, .9]) for (const ammo of [0, 1]) {
    const w = weapon(id), ws: WeaponSlotState = { ammo, reserve: 100 };
    assert.ok(beginWeaponReload(w, ws, multiplier)); assert.equal(playWeaponReloadAudio(w, ws), true);
    const selected = ammo ? tactical : empty, other = ammo ? empty : tactical;
    if(id==='smg') {
      assert.ok(selected.pool.every(a=>a.paused),'No SMG mechanics before support-hand approach');
      advanceWeaponReload(w,ws,ws.reloadSequence!.phases[0].duration);updateSmgReloadAudio(ws);
    }
    const audio = latest(selected);
    assert.equal(audio.paused, false); assert.ok(other.pool.every(a => a.paused));
    if(id==='smg') {
      assert.ok(Math.abs(audio.playbackRate-1/multiplier)<1e-9,'SMG native pitch/speed at baseline class');
      assert.ok(audio.duration/audio.playbackRate<=ws.reloadT!+1e-8,'Composite ends before readiness');
    } else assert.ok(Math.abs(audio.duration / audio.playbackRate - ws.totalReloadT!) < 1e-9, `${id}: class-adjusted clip fits reload`);
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
assert.equal(playWeaponReloadAudio(weapon('railgun'), laterBatch), true, 'Railgun handles reload silently until approved Foley exists');
console.log('PASS: tactical/empty selection, class reload duration, ammo preservation and chamber-only resume');

const shotgun = weapon('shotgun');
for (const hz of [30, 60, 144]) {
  stopWeaponAudio();
  const ws: WeaponSlotState = {ammo: 5, reserve: 20}; beginShotgunCycle(ws);
  AUDIO.shotgunShot.play(1, true);
  const report = latest(AUDIO.shotgunShot), pumps = plays(AUDIO.shotgunPump);
  advanceWeaponReload(shotgun, ws, .15, undefined, playShotgunMechanicalEvent);
  assert.equal(plays(AUDIO.shotgunPump), pumps, 'No pump audio during report/recovery');
  for (let i = 0; i < hz; i++) advanceWeaponReload(shotgun, ws, 1 / hz, undefined, playShotgunMechanicalEvent);
  assert.equal(plays(AUDIO.shotgunPump), pumps + 1);
  assert.equal(report.paused, false, 'Delayed mechanical cue leaves the shot tail playing');
  assert.ok(Math.abs(latest(AUDIO.shotgunPump).duration / latest(AUDIO.shotgunPump).playbackRate - .44)<1e-8, 'Existing pump clip fits the physical moving stroke');
}
stopWeaponAudio();
for (const ammo of [0, 2, 5]) for (const reserve of [1, 20]) for (const multiplier of [1, .75]) {
  const ws: WeaponSlotState = { ammo, reserve }, empty = ammo === 0;
  const selected = empty ? AUDIO.shotgunReloadEmpty : AUDIO.shotgunReload;
  const before = plays(selected), pumpBefore = plays(AUDIO.shotgunPump);
  const missing = Math.min(shotgun.mag! - ammo, reserve);
  assert.ok(beginWeaponReload(shotgun, ws, multiplier));
  playWeaponReloadAudio(shotgun, ws);
  assert.equal(plays(selected), before, 'No shell sound during initial open phase');
  const insertDuration = ws.reloadSequence!.phases[1].duration;
  let inserted = 0;
  while (ws.reloading) inserted += advanceWeaponReload(shotgun, ws, 1 / 144, undefined, playShotgunMechanicalEvent);
  assert.equal(inserted, missing); assert.equal(plays(selected) - before, missing, 'Exactly one seating cue per transferred shell');
  assert.equal(plays(AUDIO.shotgunPump) - pumpBefore, empty ? 1 : 0, 'Only an empty reload requires a final pump');
  assert.ok(Math.abs(latest(selected).duration / latest(selected).playbackRate - insertDuration * .48 / .85) < 1e-9);
  assert.equal(ws.ammo, ammo + missing); assert.equal(ws.reserve, reserve - missing);
  stopWeaponAudio();
}
const interrupted: WeaponSlotState = { ammo: 0, reserve: 20 };
beginWeaponReload(shotgun, interrupted); playWeaponReloadAudio(shotgun, interrupted);
const phases = interrupted.reloadSequence!.phases;
advanceWeaponReload(shotgun, interrupted, phases[0].duration + phases[1].duration, undefined, playShotgunMechanicalEvent);
assert.equal(interrupted.ammo, 1); assert.equal(interruptShellReload(shotgun, interrupted), true);
stopWeaponReloadAudio(); const n = plays(AUDIO.shotgunReloadEmpty);
advanceWeaponReload(shotgun, interrupted, 20, undefined, playShotgunMechanicalEvent);
assert.equal(plays(AUDIO.shotgunReloadEmpty), n, 'Interrupted reload cannot emit future shell sounds');
assert.equal(interrupted.ammo, 1); assert.ok(AUDIO.shotgunReloadEmpty.pool.every(a => a.paused));
console.log('PASS: exact shell counts, seat-boundary timing, distinct tactical/empty finish and interruption');

AUDIO.pistolReloadEmpty.play(1, true, 1.25);
const paused = latest(AUDIO.pistolReloadEmpty); paused.currentTime = .41;
pauseWeaponAudio(); assert.equal(paused.paused, true);
resumeWeaponAudio(); assert.equal(paused.paused, false); assert.equal(paused.currentTime, .41); assert.equal(paused.playbackRate, 1.25);
pauseWeaponAudio(); stopWeaponAudio(); const stoppedPlays = paused.plays;
resumeWeaponAudio(); assert.equal(paused.plays, stoppedPlays, 'Stopped audio does not resume after switching/death');
assert.equal(paused.currentTime, 0);
console.log('PASS: pause/resume preserves cursor and speed; cancellation clears pending resume');


for (const [id, track, offset] of [
  ['smg', AUDIO.smgReloadEmpty, SMG.chamberOffset],
] as const) {
  const ws: WeaponSlotState = { ammo: 10, reserve: 100, needsChamber: true };
  beginWeaponReload(weapon(id), ws); playWeaponReloadAudio(weapon(id), ws);
  assert.equal(latest(track).currentTime, offset);
  if(id==='smg')assert.equal(latest(track).playbackRate,1);
  assert.ok(Math.abs((track.duration - offset) / latest(track).playbackRate - ws.totalReloadT!) < 1e-9);
  stopWeaponAudio();
}

const lmgLoops = plays(AUDIO.lmgAuto);
for(let n=1;n<=6;n++)playLmgFire(n,n===5);
assert.equal(plays(AUDIO.lmgAuto),lmgLoops,'LMG never starts a free-running HTML loop; report lifecycle tested with WebAudio backend');
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
console.log('PASS: new reload/chamber profiles, LMG without HTML loop, exactly three/two/one BR reports');

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
  ['smg', AUDIO.smgFire, AUDIO.smgAuto],
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
console.log('PASS: SMG taps, sustained loop without restarting/layering, and final reports');

const plasmaSingleBefore=plays(AUDIO.plasmaSingle),beamBefore=plays(AUDIO.laserBeam);
for(let n=1;n<=8;n++)playAutomaticWeaponFire('laser',n);
assert.equal(plays(AUDIO.plasmaSingle)-plasmaSingleBefore,8);assert.equal(plays(AUDIO.laserBeam),beamBefore);stopWeaponAudio();
for(const multiplier of [1,.75,.9])for(const mode of ['swap','vent'] as const){
 const w=weapon('laser'),ws:WeaponSlotState={ammo:mode==='swap'?20:45,reserve:180,heat:mode==='vent'?80:0};
 const hiss=plays(AUDIO.laserVent),insert=plays(AUDIO.plasmaInsert),composite=plays(AUDIO.plasmaReloadEmpty);
 assert.ok(beginWeaponReload(w,ws,multiplier));assert.ok(playWeaponReloadAudio(w,ws));
 assert.equal(plays(AUDIO.laserVent),hiss);assert.equal(plays(AUDIO.plasmaReloadEmpty),composite);
 advanceWeaponReload(w,ws,(mode==='swap'?1.85:.49)*multiplier);updatePlasmaReloadAudio(ws);
 assert.equal(plays(AUDIO.plasmaInsert),insert);assert.equal(plays(AUDIO.laserVent),hiss);
 const before=ws.reloadT;pauseWeaponAudio();resumeWeaponAudio();assert.equal(ws.reloadT,before);
 advanceWeaponReload(w,ws,.02*multiplier);updatePlasmaReloadAudio(ws);updatePlasmaReloadAudio(ws);
 assert.equal(plays(AUDIO.plasmaInsert)-insert,mode==='swap'?1:0);assert.equal(plays(AUDIO.laserVent)-hiss,mode==='vent'?1:0);
 const track=mode==='swap'?AUDIO.plasmaInsert:AUDIO.laserVent;assert.ok(Math.abs(latest(track).playbackRate-1/multiplier)<1e-8);assert.ok(Math.abs(latest(track).currentTime-.01)<1e-8);
 advanceWeaponReload(w,ws,100);updatePlasmaReloadAudio(ws);stopWeaponReloadAudio();assert.equal(ws.ammo,mode==='swap'?60:45);assert.equal(ws.reserve,mode==='swap'?120:180);assert.ok(AUDIO.laserVent.pool.every(a=>a.paused));
}
for(const cancellation of ['switch','replace-sequence','skip-cue']){
 const ws:WeaponSlotState={ammo:20,reserve:180,heat:0};beginWeaponReload(weapon('laser'),ws);playWeaponReloadAudio(weapon('laser'),ws);const before=plays(AUDIO.plasmaInsert);
 if(cancellation==='switch')stopWeaponAudio();if(cancellation==='replace-sequence')ws.reloadSequence={...ws.reloadSequence!};
 advanceWeaponReload(weapon('laser'),ws,cancellation==='skip-cue'?2.3:1.87);updatePlasmaReloadAudio(ws);assert.equal(plays(AUDIO.plasmaInsert),before);stopWeaponAudio();
}
console.log('PASS: eight discrete plasma reports, no beam/composite, class-scaled seat/hiss contacts, pause and cancellation');

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

// Sniper shot and manual bolt are separate recordings/events. Both magazine
// exchanges use the owned bolt-free clip; the empty composite stays unused.
for (const hz of [30,60,144]) {
  stopWeaponAudio();
  const ws: WeaponSlotState = {ammo:4,reserve:20};
  const before=plays(AUDIO.sniperBolt);
  AUDIO.sniperShot.play(1,true); requireSniperBolt(ws);
  const report=latest(AUDIO.sniperShot);
  advanceWeaponReload(weapon('sniper'),ws,2,undefined,undefined,playSniperBoltEvent);
  assert.equal(plays(AUDIO.sniperBolt),before); assert.equal(report.paused,false);
  assert.ok(beginSniperCycle(ws));
  while(ws.sniperCycle) advanceWeaponReload(weapon('sniper'),ws,1/hz,undefined,undefined,playSniperBoltEvent);
  assert.equal(plays(AUDIO.sniperBolt),before+1);
  assert.ok(Math.abs(latest(AUDIO.sniperBolt).duration/latest(AUDIO.sniperBolt).playbackRate-SNIPER.mechanical)<1e-8);
}
for (const ammo of [0,2]) for(const multiplier of [1,.75,.9]) {
  stopWeaponAudio(); const ws:WeaponSlotState={ammo,reserve:20};
  const emptyBefore=plays(AUDIO.sniperReloadEmpty),boltBefore=plays(AUDIO.sniperBolt),magBefore=plays(AUDIO.sniperReloadTactical);
  assert.ok(beginWeaponReload(weapon('sniper'),ws,multiplier)); playWeaponReloadAudio(weapon('sniper'),ws);
  assert.equal(plays(AUDIO.sniperReloadTactical),magBefore);
  while(ws.reloading) {advanceWeaponReload(weapon('sniper'),ws,1/144);updateSniperReloadAudio(ws);}
  assert.equal(plays(AUDIO.sniperReloadTactical),magBefore+1);
  assert.equal(plays(AUDIO.sniperReloadEmpty),emptyBefore); assert.equal(plays(AUDIO.sniperBolt),boltBefore);
  assert.equal(ws.needsChamber,ammo===0);
}
console.log('PASS: sniper report only on shot, one delayed manual bolt cue, bolt-free mag reloads and class-fitted clips');

for(const hz of [30,60,144])for(const speed of [1,.75,.9])for(const ammo of [0,3]) {
 stopWeaponAudio();const ws:WeaponSlotState={ammo,reserve:100};
 const before=[plays(AUDIO.brMagazineOut),plays(AUDIO.brMagazineIn),plays(AUDIO.brCharge)];
 const composites=[plays(AUDIO.brReloadTactical),plays(AUDIO.brReloadEmpty)];
 assert.ok(beginWeaponReload(weapon('br'),ws,speed));assert.equal(playWeaponReloadAudio(weapon('br'),ws),true);
 while(ws.reloading)advanceWeaponReload(weapon('br'),ws,1/hz,undefined,undefined,undefined,playBattleRifleMechanicalEvent);
 assert.deepEqual([plays(AUDIO.brMagazineOut)-before[0],plays(AUDIO.brMagazineIn)-before[1],plays(AUDIO.brCharge)-before[2]],[1,1,ammo?0:1]);
 assert.deepEqual([plays(AUDIO.brReloadTactical),plays(AUDIO.brReloadEmpty)],composites,'No composite/discrete doubling');
 assert.ok(Math.abs(latest(AUDIO.brMagazineIn).playbackRate-1/speed)<1e-9);
}
console.log('PASS: BR discrete removal/insertion once, empty-only charging, class speed without whole-composite stretching');

stopWeaponAudio();
const brResume:WeaponSlotState={ammo:36,reserve:20,needsChamber:true};
const brCounts=[plays(AUDIO.brMagazineOut),plays(AUDIO.brMagazineIn),plays(AUDIO.brCharge)];
assert.ok(beginWeaponReload(weapon('br'),brResume));playWeaponReloadAudio(weapon('br'),brResume);
while(brResume.reloading)advanceWeaponReload(weapon('br'),brResume,1/144,undefined,undefined,undefined,playBattleRifleMechanicalEvent);
assert.deepEqual([plays(AUDIO.brMagazineOut)-brCounts[0],plays(AUDIO.brMagazineIn)-brCounts[1],plays(AUDIO.brCharge)-brCounts[2]],[0,0,1]);
console.log('PASS: interrupted BR empty reload resumes chamber-only without replaying magazine cues');

// SMG composites retain native spacing, including late-frame start and one voice.
for(const hz of [30,60,144])for(const speed of [1,.75,.9])for(const ammo of [0,17]) {
  stopWeaponAudio();const w=weapon('smg'),ws:WeaponSlotState={ammo,reserve:192};beginWeaponReload(w,ws,speed);
  const track=ammo?AUDIO.smgReloadTactical:AUDIO.smgReloadEmpty,before=plays(track);
  playWeaponReloadAudio(w,ws);assert.equal(plays(track),before);
  while(ws.reloading){advanceWeaponReload(w,ws,1/hz);updateSmgReloadAudio(ws);}
  assert.equal(plays(track),before+1,'Exactly one complete SMG composite per reload');
  assert.ok(Math.abs(latest(track).playbackRate-1/speed)<1e-8);
  assert.ok(latest(track).currentTime<1/(hz*speed)+1e-8,'Late start seeks the real audio cursor');
  stopWeaponReloadAudio();updateSmgReloadAudio(ws);assert.equal(plays(track),before+1);
}
const smgManifest=JSON.parse(readFileSync(new URL('../src/assets/audio/weapons/batch2/clip_manifest.json',import.meta.url),'utf8'));
const emptySmg=smgManifest.clips.find((c:any)=>c.filename==='smg_reload_empty.wav');
assert.equal(emptySmg.source_cuts.length,3,'Empty asset already contains magazine-out/in and charging');
const chargeOnset=SMG.empty.open+1.338,phaseStart=SMG.empty.open+SMG.empty.eject+SMG.empty.insert;
assert.ok(Math.abs(phaseStart+SMG.empty.chamber*.306-chargeOnset)<.001,'Handle starts pulling on the embedded charging cue');
console.log('PASS: SMG approach delay, native-rate single composite, late-frame cursor, cancellation and embedded charging synchronization at three frame rates/class speeds');

for(const [key,url]of Object.entries(LMG_MECHANICAL_AUDIO_URLS)) {
 const track=AUDIO[key as keyof typeof LMG_MECHANICAL_AUDIO_URLS];assert.equal(track.confirmedSrc,url);assert.equal(track.duration,wavDuration(url));
}
for(const hz of [30,60,144])for(const speed of [1,.75,.9])for(const ammo of [0,43]) {
 stopWeaponAudio();const ws:WeaponSlotState={ammo,reserve:300},w=weapon('lmg');beginWeaponReload(w,ws,speed);
 const before=[plays(AUDIO.lmgBoxOut),plays(AUDIO.lmgBoxIn),plays(AUDIO.lmgCharge),plays(AUDIO.lmgCoverClose)];playWeaponReloadAudio(w,ws);
 assert.ok(AUDIO.lmgReloadTactical.pool.every(a=>a.paused)&&AUDIO.lmgReloadEmpty.pool.every(a=>a.paused),'No duplicate composite');
 while(ws.reloading)advanceWeaponReload(w,ws,1/hz,undefined,undefined,undefined,undefined,playLmgMechanicalEvent);
 assert.deepEqual([plays(AUDIO.lmgBoxOut)-before[0],plays(AUDIO.lmgBoxIn)-before[1],plays(AUDIO.lmgCharge)-before[2],plays(AUDIO.lmgCoverClose)-before[3]],[1,1,ammo?0:1,1]);
 assert.ok(Math.abs(latest(AUDIO.lmgBoxIn).playbackRate-1/speed)<1e-8);
 const coverBefore=Object.values(AUDIO).reduce((n,t)=>n+plays(t),0);playLmgMechanicalEvent('cover',speed,0);
 assert.equal(Object.values(AUDIO).reduce((n,t)=>n+plays(t),0),coverBefore+1,'Approved cover event plays exactly its own track');
 assert.equal(latest(AUDIO.lmgCoverClose).playbackRate,1/speed);
 playLmgMechanicalEvent('cover',speed,.10);assert.equal(latest(AUDIO.lmgCoverClose).currentTime,.10/speed);
 const closed=plays(AUDIO.lmgCoverClose);playLmgMechanicalEvent('cover',speed,1);assert.equal(plays(AUDIO.lmgCoverClose),closed,'Obsolete late closure is skipped');
 stopWeaponReloadAudio();assert.ok([AUDIO.lmgBoxOut,AUDIO.lmgBoxIn,AUDIO.lmgCharge,AUDIO.lmgCoverClose].every(t=>t.pool.every(a=>a.paused&&a.currentTime===0)));
}
const chamberLmg:WeaponSlotState={ammo:100,reserve:200,needsChamber:true};beginWeaponReload(weapon('lmg'),chamberLmg);playWeaponReloadAudio(weapon('lmg'),chamberLmg);
const boxes=[plays(AUDIO.lmgBoxOut),plays(AUDIO.lmgBoxIn)],charges=plays(AUDIO.lmgCharge);
advanceWeaponReload(weapon('lmg'),chamberLmg,5,undefined,undefined,undefined,undefined,playLmgMechanicalEvent);
assert.deepEqual([plays(AUDIO.lmgBoxOut),plays(AUDIO.lmgBoxIn)],boxes);assert.equal(plays(AUDIO.lmgCharge),charges,'A skipped obsolete charging clip is not replayed');
assert.equal(AUDIO.lmgFire.duration,1.20,'Single shot retains its attack with a smooth quieter decay');
assert.equal(AUDIO.lmgAuto.duration,.92,'Eight distinct .115 s source-report windows');
assert.equal(AUDIO.lmgCoverClose.duration,.3185,'Original WAV second clang and brief latch decay');
console.log('PASS: LMG isolated box/charge/approved cover cues, one cue per contact, class rates, late skip and cleanup; M60 asset durations');

for(const speed of [1,.75,.9]) {
 stopWeaponAudio();const state:WeaponSlotState={ammo:43,reserve:300};beginWeaponReload(weapon('lmg'),state,speed);const initial=plays(AUDIO.lmgCoverClose);
 advanceWeaponReload(weapon('lmg'),state,(3.1656-.001)*speed,undefined,undefined,undefined,undefined,playLmgMechanicalEvent);assert.equal(plays(AUDIO.lmgCoverClose),initial);
 advanceWeaponReload(weapon('lmg'),state,.002*speed,undefined,undefined,undefined,undefined,playLmgMechanicalEvent);assert.equal(plays(AUDIO.lmgCoverClose),initial+1,'Original second-clang cue coincides with lock');
 advanceWeaponReload(weapon('lmg'),state,100,undefined,undefined,undefined,undefined,playLmgMechanicalEvent);assert.equal(plays(AUDIO.lmgCoverClose),initial+1);
 const cancelled:WeaponSlotState={ammo:0,reserve:300};beginWeaponReload(weapon('lmg'),cancelled,speed);advanceWeaponReload(weapon('lmg'),cancelled,3.10*speed,undefined,undefined,undefined,undefined,playLmgMechanicalEvent);cancelWeaponReload(cancelled);
 advanceWeaponReload(weapon('lmg'),cancelled,100,undefined,undefined,undefined,undefined,playLmgMechanicalEvent);assert.equal(plays(AUDIO.lmgCoverClose),initial+1,'Cancellation before closure adds no impact');
}
console.log('PASS: original WAV cover impact exactly once at 3.1656 s with class scaling; cancelled pre-lock reloads remain silent');
