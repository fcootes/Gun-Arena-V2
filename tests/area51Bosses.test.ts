import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBotVisuals, disposeBotVisuals, disposeBotTextureCache } from '../src/botBuilder';
import { createWorld, buildHelicopterMesh } from '../src/world';
import { animateFacilityBossIntro, updateAbominationCombat } from '../src/area51Bosses';
import { updateClassCombatBot, type BioMutantAIContext, type CombatSystemsContext } from '../src/gameLoop';
import type { Bot } from '../src/types';
const context = new Proxy({}, { get: (_o, k) => String(k).includes('Gradient') ? () => ({ addColorStop() {} }) : () => {} });
(globalThis as any).document = { createElement: () => ({ width: 256, height: 256, getContext: () => context }) };
const scene = new THREE.Scene(), world = createWorld(scene, 'area51');
const actors: Bot[] = [];
function actor(id: number, zombie = false, slot = 0): Bot {
  const v = buildBotVisuals({ botId: id, team: zombie ? 'zombie' : 'red', isZombie: zombie, zType: zombie ? 'megaboss' : 'walker', isVIP: false, weaponType: 'ar', weaponTypeIndex: 0, factionAlignment: 'apex', campaignEntity: zombie ? undefined : 'spartan' });
  const bot = { ...v, group: v.rootGroup, pos: new THREE.Vector3(0, 15, -170), vel: new THREE.Vector3(), team: zombie ? 'zombie' : 'red', isZombie: zombie, zType: zombie ? 'megaboss' : 'walker', campaignEntity: zombie ? undefined : 'spartan', spartanSlot: slot, id, alive: true, health: 1600, maxHealth: 1600, speed: 5, facing: 0, walkPhase: 0, fireTimer: 0, meleeCooldown: 0, preferredRange: 20, weaponType: 'ar', weaponTypeIndex: 0, classId: 'assault', userData: {} } as unknown as Bot;
  actors.push(bot); scene.add(bot.group); return bot;
}
const boss = actor(10, true);
assert.equal(boss.group.scale.y, 2);
assert.ok(boss.group.getObjectByName('Abomination_MutatedClub'));
boss.userData!.entryStart = new THREE.Vector3(0, 24, -170);
animateFacilityBossIntro(boss, 0.4, 0, 'usmc'); assert.ok(boss.pos.y > 15);
animateFacilityBossIntro(boss, 1, 0, 'usmc'); assert.equal(boss.pos.y, 15); assert.ok(boss.group.scale.y < 1.6);
animateFacilityBossIntro(boss, 3, 0, 'usmc'); assert.equal(boss.group.scale.y, 2);
let playerHits = 0, alliedHits = 0;
const player = { pos: new THREE.Vector3(0, 16.65, -168), yaw: 0, pitch: 0, health: 100, maxHealth: 100, alive: true, team: 'blue', applyDamage(d: number) { assert.ok(d > 0); playerHits++; }, heal() {} };
const ctx = { player, bots: actors, world, scene, camera: new THREE.PerspectiveCamera(), focusTargetId: null, squadDirective: 'follow_lead', damageBot() { alliedHits++; }, pushKillFeed() {}, makeBot() { assert.fail('facility Abomination must not summon ground-floor hordes'); }, scrambleRadar() {} } as BioMutantAIContext & CombatSystemsContext;
function reset(action: 'hunt' | 'smash' | 'club' | 'charge', attacks = 0) {
  boss.pos.set(0, 15, -170); boss.group.position.copy(boss.pos); boss.health = 1600;
  boss.abomination = { action, elapsed: 0, cooldown: 0, chargeCooldown: 0, hit: false, lastHealth: boss.health, attacks };
  playerHits = 0;
}
reset('hunt');
for (let i = 0; i < 29; i++) updateAbominationCombat(boss, .05, ctx, player.pos);
assert.equal(playerHits, 1, 'club hits once in its swing');
assert.equal(boss.abomination!.action, 'club');
player.pos.set(0, 16.65, -165.5); reset('hunt', 1);
let maxY = 15;
for (let i = 0; i < 38; i++) { updateAbominationCombat(boss, .05, ctx, player.pos); maxY = Math.max(maxY, boss.pos.y); }
assert.ok(maxY > 16, 'smash is a real jump'); assert.equal(playerHits, 1, 'smash AOE hits once'); assert.equal(boss.pos.y, 15);
player.pos.set(0, 16.65, -160); reset('smash');
for (let i = 0; i < 38; i++) updateAbominationCombat(boss, .05, ctx, player.pos);
assert.equal(playerHits, 0, 'smash cannot damage distant player');
player.pos.set(0, 16.65, -155); reset('hunt'); boss.health -= 20;
updateAbominationCombat(boss, .1, ctx, player.pos); assert.equal(boss.abomination!.action, 'charge');
for (let i = 0; i < 5; i++) updateAbominationCombat(boss, .1, ctx, player.pos);
assert.ok(boss.vel.length() > 8, 'damage at range triggers berserker sprint');
assert.ok(boss.pos.z > -170);
const destinations: THREE.Vector3[] = [];
for (let slot = 0; slot < 3; slot++) {
  const spartan = actor(slot, false, slot); spartan.pos.set(-12 + slot * 10, 15, -173);
  spartan.userData!.entryStart = new THREE.Vector3(17.8, 15, -193 - slot * 2.6);
  animateFacilityBossIntro(spartan, 1.4, slot, 'apex');
  assert.ok(!world.worldColliders.some(c => c.active !== false && c.minY < 17 && c.maxY > 15.5 && spartan.pos.x > c.minX - .55 && spartan.pos.x < c.maxX + .55 && spartan.pos.z > c.minZ - .55 && spartan.pos.z < c.maxZ + .55), 'file entry clears cover');
  animateFacilityBossIntro(spartan, 3, slot, 'apex');
  assert.ok(spartan.armRPivot.rotation.x < -.9);
  player.pos.set(0, 16.65, -170);
  for (let i = 0; i < 5; i++) updateClassCombatBot(spartan, .1, ctx, { accuracy: 0, damageMultiplier: 1, fireRateMultiplier: 1 });
  assert.ok(spartan.isSprinting); assert.ok(spartan.torsoGroup.rotation.x > .1);
  destinations.push(spartan.classAI!.destination!.clone());
}
assert.ok(destinations[1].distanceTo(destinations[2]) > 10, 'wings take separated flanks');
const helicopter = buildHelicopterMesh();
assert.ok(helicopter.group.getObjectByName('UH60_RoundedNose'));
for (const name of ['UH60_AngledWindshield_-1', 'UH60_AngledWindshield_1']) assert.ok(helicopter.group.getObjectByName(name));
helicopter.group.updateMatrixWorld(true);
helicopter.group.traverse((o: any) => { if (o.isMesh) { for (const name of ['position', 'normal']) assert.ok([...o.geometry.getAttribute(name).array].every(Number.isFinite), `finite ${name}`); assert.ok(o.matrixWorld.determinant() > 0, 'no inverted helicopter transforms'); } });
helicopter.dispose(); helicopter.dispose();
for (const bot of actors) { disposeBotVisuals(bot.group); bot.group.removeFromParent(); }
world.dispose(); disposeBotTextureCache();
console.log('PASS: boss scaling/club, drop-impact-roar, single-hit localized attacks, ranged charge, clear file entrances, Spartan aim/sprint/flanks and finite helicopter normals');
