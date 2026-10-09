import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { WEAPONS } from '../src/weapons';
import { INSPECTOR_DAMAGE, INSPECTOR_HEALTH } from '../src/inspectorMode';
import { OPERATIONAL_MAPS, mapForMode, resolveMapId } from '../src/mapRegistry';
import { disposeBotVisuals } from '../src/botBuilder';
import { clearCombatSystems, spawnToxicPuddle, spawnSonicDistortionRing, activeToxicPuddles, activeDistortionRings } from '../src/gameLoop';

assert.deepEqual(OPERATIONAL_MAPS.map(m => m.id).sort(), ['area51', 'shattered_wall', 'training']);
assert.equal(resolveMapId('retired-bunker'), 'area51');
for (const mode of ['team', 'ffa', 'zombie', 'extraction'] as const) {
  assert.equal(mapForMode('area51', mode), 'area51');
  assert.equal(mapForMode('shattered_wall', mode), 'shattered_wall');
  assert.equal(mapForMode('training', mode), mode === 'team' || mode === 'ffa' ? 'training' : 'area51');
}
console.log('PASS: explicit Area 51 registration/default, retired-key normalization, Pacific Rim and Training preservation');

// Exercise the actual committed handlers without requiring a native WebGL context.
const source = ts.createSourceFile('App.tsx', readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(source));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) functions.set(node.name.text, node.initializer.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
function handler(name: string, context: object): (...args: any[]) => any {
  assert.ok(functions.has(name), `Actual ${name} handler exists`);
  return vm.runInNewContext(ts.transpile(`(${functions.get(name)})`), context);
}
const sound = { stop() {}, play() {} };
for (const id of ['smg', 'lmg', 'br', 'laser']) {
  for (const tactical of [false, true]) {
    const w = WEAPONS.find(w => w.id === id)!, ws = { isTacticalReload: tactical };
    let selected = 0, generic = 0;
    const reload = handler('reloadWeapon', {
      currentSlot: () => w, currentSlotState: () => ws,
      beginWeaponReload: () => true, player: { classReloadMultiplier: .75, aiming: true, continuousShots: 5 },
      AUDIO: { arSpray: sound, lmgAuto: sound, smgAuto: sound, laserBeam: sound, minigunFire: sound, reloadTactical: { play() { generic++; } }, reloadEmpty: { play() { generic++; } } },
      laserBeamMesh: { visible: true }, playWeaponReloadAudio(weapon: unknown, state: unknown) { assert.equal(weapon, w); assert.equal(state, ws); selected++; return true; },
    });
    reload(); assert.equal(selected, 1); assert.equal(generic, 0);
  }
}
console.log('PASS: actual SMG/LMG/BR/plasma reload handlers select dedicated audio once without generic doubling');
for (const inspectorMode of [false, true]) {
  const player = { alive: true, health: inspectorMode ? INSPECTOR_HEALTH : 100, shield: 50 };
  let deaths = 0, audioStops = 0;
  const apply = handler('applyDamageToPlayer', { player, world: {}, matchConfig: { inspectorMode, mode: 'extraction' }, AUDIO: { arSpray: sound, bulletHit: sound }, stopWeaponAudio() { audioStops++; }, flashVignette() {}, pushKillFeed() {}, triggerGameOver() { deaths++; } });
  apply(1_000_000, true, false, null);
  assert.equal(player.health, inspectorMode ? INSPECTOR_HEALTH : 0);
  assert.equal(player.alive, inspectorMode);
  assert.equal(deaths, inspectorMode ? 0 : 1);
  assert.equal(audioStops, inspectorMode ? 0 : 1, 'Actual death stops integrated weapon audio; inspector immunity does not');
}
function actor(health: number) {
  return { alive: true, downed: false, health, pos: new THREE.Vector3(), group: new THREE.Group(), team: 'red', campaignEntity: 'spartan', armor: 140, hitParts: [], isZombie: false, healthEl: { style: {} }, weaponTypeIndex: 0 };
}
const player = { pos: new THREE.Vector3(), damageDealt: 0, kills: 0 };
const context = { THREE, INSPECTOR_DAMAGE, player, bots: [] as any[], world: { createGroundPickup() {}, unregisterHittable() {} }, matchConfig: { inspectorMode: true, mode: 'extraction' }, extractionDirector: null, focusTargetIDRef: { current: null }, camera: { position: new THREE.Vector3() }, AUDIO: { bulletHit: sound }, getSpatialVolume: () => 0, pushKillFeed() {}, checkMatchOutcome() {} };
const damage = handler('damageBot', context);
const highHealth = actor(200_000);
damage(highHealth, 1, false, 'player');
assert.equal(highHealth.health, 200_000 - INSPECTOR_DAMAGE, 'Body armor cannot reduce inspector hit damage');
for (const weapon of WEAPONS.filter(w => w.type === 'weapon')) {
  const target = actor(1_600);
  context.bots = [target, { alive: true, team: 'red', classId: 'medic' }];
  damage(target, weapon.damage ?? 1, false, 'player');
  assert.equal(target.alive, false, `${weapon.id} kills in one body hit`);
  assert.ok(!target.downed, 'Inspector kills bypass medic downing');
}
context.matchConfig.inspectorMode = false;
const regular = actor(200_000); damage(regular, 100, false, 'player');
assert.equal(regular.health, 199_965, 'Normal armor damage restored');
console.log('PASS: actual incoming-damage immunity, exact 99,999 body damage, all firearm dispatches and normal damage restoration');

let generation = 0, initializations = 0, stops = 0;
const state = { current: 'DEATH_SCREEN' };
const actions = { pendingDeployment: null, runDeployment() { initializations++; state.current = 'loading'; }, gameStateRef: state, stopMatchInput() { stops++; }, initMatch() { initializations++; }, switchSlot() {}, player: { slotIndex: 0, pos: new THREE.Vector3(), yaw: 0, pitch: 0 }, setGameState() {}, camera: { aspect: 1, fov: 90, position: new THREE.Vector3(), rotation: new THREE.Euler(), updateProjectionMatrix() {} }, renderer: { setSize() {}, render() {} }, HIP_FOV: 90, window: { innerWidth: 800, innerHeight: 600 }, scene: {}, requestGamePointerLock() {}, setActiveTab() {}, setExtractionState() {}, setMatchRewards() {}, setTargetingPhase() {}, setSquadDirectiveBanner() {}, radarPingsRef: { current: [1] }, setEngineGeneration(update: (n: number) => number) { generation = update(generation); } };
const restart = handler('restartHandler', actions); restart(); restart();
assert.equal(initializations, 1, 'Repeated replay click cannot initialize twice');
assert.equal(state.current, 'loading', 'Replay enters loading synchronously and cannot reinitialize');
const lobby = handler('lobbyHandler', actions); lobby(); lobby();
assert.equal(state.current, 'start'); assert.equal(generation, 1, 'Lobby return unmounts the engine exactly once');
assert.equal(actions.radarPingsRef.current.length, 0); assert.equal(stops, 2);
console.log('PASS: replay/lobby handlers are idempotent and request a fresh lobby engine');

const scene = new THREE.Scene();
const owned = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); scene.add(m); return m; };
const grenade = owned(), spark = owned(), limb = owned(), projectile = owned(), flash = owned();
const smokeGeometry = new THREE.SphereGeometry(), smoke = new THREE.Mesh(smokeGeometry, new THREE.MeshBasicMaterial()); scene.add(smoke);
spawnToxicPuddle(scene, new THREE.Vector3()); spawnSonicDistortionRing(scene, new THREE.Vector3());
const ownedGeometries = [grenade, spark, limb, projectile, flash, activeToxicPuddles[0].mesh, activeDistortionRings[0].mesh].map(m => m.geometry);
let disposed = 0, sharedDisposed = 0;
ownedGeometries.forEach(g => g.addEventListener('dispose', () => disposed++));
smokeGeometry.addEventListener('dispose', () => sharedDisposed++);
const pools = { runtimeTimeouts: new Set(), clearTimeout() {}, scene, world: { groundPickups: [], clearDeployableCover() {} }, audioManager: sound, clearCombatSystems, disposeBotVisuals, THREE, vmManager: { resetEffects() {} }, thirdPersonActor: null, carriedWeapon: null, carriedId: '', extractionDirector: null, extractionPhase: false, extractionState: 'none', extractionTimer: 0, extractionTargetObj: null, extractionTankBossSpawned: false, bots: [], removeBot() {}, activeGrenades: [{ group: grenade }], explosionEffects: [{ mesh: flash }], sparkPool: [{ mesh: spark }], smokePool: [{ mesh: smoke }], limbPool: [{ mesh: limb }], railgunProjectiles: [{ group: projectile }], containerRef: { current: null } };
const clear = handler('clearMatchEntities', pools); clear(); clear();
assert.equal(disposed, ownedGeometries.length, 'Every transient owned geometry disposed exactly once');
assert.equal(sharedDisposed, 0, 'Session smoke geometry survives replay');
assert.equal(scene.children.length, 0); assert.equal(activeToxicPuddles.length + activeDistortionRings.length, 0);
smokeGeometry.dispose();
console.log('PASS: replay cleanup releases grenades, sparks, ragdolls, tracers, explosions, toxic puddles and distortion rings');
