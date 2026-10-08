import * as THREE from 'three';
import type { Bot } from './types';
import type { BioMutantAIContext } from './gameLoop';
import { traversalBlocked } from './tacticalNavigation';
import { audioManager } from './campaignAudio';

/** Both hands stay on the weapon during sprinting and deliberate high-guard aim. */
export function poseSpartan(bot: Bot, guard = 1, sprint = false): void {
  if (!bot.torsoGroup || !bot.armRPivot || !bot.armLPivot) return;
  const stride = Math.sin(bot.walkPhase ?? 0);
  bot.torsoGroup.rotation.x = sprint ? 0.15 : 0.02;
  bot.armRPivot.rotation.set(THREE.MathUtils.lerp(-0.35, -0.95, guard) + (sprint ? stride * 0.05 : 0), -0.12, 0.03);
  bot.armLPivot.rotation.set(THREE.MathUtils.lerp(-0.35, -1.05, guard), 0.3, -0.14);
  if (bot.armRLowerPivot) bot.armRLowerPivot.rotation.x = THREE.MathUtils.lerp(-0.22, 0.4, guard);
  if (bot.armLLowerPivot) bot.armLLowerPivot.rotation.x = THREE.MathUtils.lerp(-0.35, 0.55, guard);
}

/** Authored, staggered entrances; no combat runs while entranceActive is set. */
export function animateFacilityBossIntro(bot: Bot, elapsed: number, slot: number, faction: 'usmc' | 'apex'): void {
  const start = bot.userData?.entryStart as THREE.Vector3 | undefined;
  if (!start || !bot.alive) return;
  if (faction === 'apex') {
    const t = THREE.MathUtils.smoothstep((elapsed - slot * 0.22) / 2.3, 0, 1);
    bot.pos.set(start.x, 15, start.z + 8 * t);
    bot.facing = 0;
    bot.group.rotation.y = 0;
    bot.walkPhase = elapsed * 5 - slot * 0.5;
    if (bot.legLPivot && bot.legRPivot) {
      const stride = Math.sin(bot.walkPhase) * 0.3 * (t < 1 ? 1 : 0);
      bot.legLPivot.rotation.x = stride;
      bot.legRPivot.rotation.x = -stride;
    }
    poseSpartan(bot, THREE.MathUtils.smoothstep((elapsed - 0.8 - slot * 0.22) / 1.6, 0, 1));
  } else {
    // Fast gravity-shaped fall, compressed impact, then a slow roar/rear-up.
    const fall = Math.min(1, elapsed / 0.7);
    bot.pos.copy(start);
    bot.pos.y = 15 + 9 * (1 - fall * fall);
    const compression = elapsed < 0.7 ? 0 : elapsed < 1.1 ? THREE.MathUtils.smoothstep((elapsed - 0.7) / 0.4, 0, 1) : 1 - THREE.MathUtils.smoothstep((elapsed - 1.1) / 1.5, 0, 1);
    bot.group.scale.set(2.0, 2.0 * (1 - compression * 0.3), 2.0);
    if (bot.torsoGroup) bot.torsoGroup.rotation.x = compression * 0.38 - (elapsed > 1.8 ? Math.sin((elapsed - 1.8) * Math.PI / 1.2) * 0.18 : 0);
    if (bot.armRPivot) bot.armRPivot.rotation.x = -0.35 - (1 - compression) * 0.65;
    if (elapsed >= 0.7 && !bot.userData!.impactPlayed) { bot.userData!.impactPlayed = true; audioManager.play('abomination_impact'); }
    if (elapsed >= 1.4 && !bot.userData!.roarPlayed) { bot.userData!.roarPlayed = true; audioManager.play('abomination_roar'); }
  }
  bot.group.position.copy(bot.pos);
  bot.vel.set(0, 0, 0);
  bot.fireTimer = 1;
}

/** Telegraphs, fixed hit windows and collision-aware attacks; every target is damaged once. */
export function updateAbominationCombat(bot: Bot, dt: number, ctx: BioMutantAIContext, target: THREE.Vector3): void {
  const state = bot.abomination ??= { action: 'hunt', elapsed: 0, cooldown: 1.5, chargeCooldown: 0, hit: false, lastHealth: bot.health, attacks: 0 };
  const floor = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, bot.pos.y);
  const distance = Math.hypot(target.x - bot.pos.x, target.z - bot.pos.z);
  const shot = bot.health < state.lastHealth;
  state.lastHealth = bot.health;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.chargeCooldown = Math.max(0, state.chargeCooldown - dt);
  if (state.action === 'hunt') {
    if (shot && distance > 9 && state.chargeCooldown === 0) {
      state.action = 'charge'; state.chargeCooldown = 6;
      ctx.pushKillFeed('ABOMINATION: BERSERKER CHARGE', true);
    } else if (state.cooldown === 0 && distance < 8) {
      state.action = distance < 4 && state.attacks % 2 === 0 ? 'club' : 'smash';
      state.attacks++;
      ctx.pushKillFeed(state.action === 'smash' ? 'ABOMINATION: GROUND SMASH — CLEAR THE IMPACT' : 'ABOMINATION: CLUB SWEEP', true);
    }
    if (state.action !== 'hunt') { state.elapsed = 0; state.hit = false; }
  }
  state.elapsed += dt;
  const t = state.elapsed;
  const waypoint = ctx.world.getNavigationTarget?.(bot.pos, target) ?? target;
  const dx = waypoint.x - bot.pos.x, dz = waypoint.z - bot.pos.z, d = Math.hypot(dx, dz);
  if (!state.hit) {
    bot.facing = Math.atan2(target.x - bot.pos.x, target.z - bot.pos.z);
    bot.group.rotation.y = bot.facing;
  }
  const speed = state.action === 'hunt' ? 2.7 : state.action === 'charge' && t > 0.35 && t < 1.85 ? 11 : 0;
  bot.isCharging = state.action === 'charge';
  bot.vel.set(d > 0.1 ? dx / d * speed : 0, 0, d > 0.1 ? dz / d * speed : 0);
  ctx.world.moveEntityWithCollision(bot.pos, bot.vel, 1.2, floor, floor + 3.6, dt, bot.team);
  bot.pos.y = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, floor);
  if (state.action === 'smash' && t > 0.4 && t < 1.15) bot.pos.y += Math.sin((t - 0.4) / 0.75 * Math.PI) * 1.7;
  if (bot.torsoGroup) bot.torsoGroup.rotation.x = state.action === 'charge' ? 0.35 : state.action === 'smash' ? Math.sin(Math.min(1, t / 1.4) * Math.PI) * 0.35 : 0;
  if (bot.armRPivot) {
    if (state.action === 'club') bot.armRPivot.rotation.set(-1.05, -1.4 + THREE.MathUtils.smoothstep((t - 0.35) / 0.75, 0, 1) * 2.8, 0.65);
    else bot.armRPivot.rotation.set(state.action === 'smash' ? -2.6 + THREE.MathUtils.smoothstep((t - 0.8) / 0.35, 0, 1) * 2 : -0.65, -0.12, 0);
  }
  const impact = state.action === 'smash' && t >= 1.15 || state.action === 'club' && t >= 0.65 || state.action === 'charge' && t > 0.35 && distance < 3.3;
  if (impact && !state.hit) {
    state.hit = true;
    const radius = state.action === 'smash' ? 6 : state.action === 'club' ? 4.8 : 3.3;
    const damage = state.action === 'smash' ? 55 : state.action === 'club' ? 45 : 38;
    if (state.action === 'smash') audioManager.play('abomination_impact');
    const hitTarget = (p: THREE.Vector3, eye: number): number => {
      const x = p.x - bot.pos.x, z = p.z - bot.pos.z, range = Math.hypot(x, z);
      if (Math.abs(p.y - eye - floor) > 2.5 || range > radius || traversalBlocked(bot.pos, p, ctx.world.worldColliders)) return 0;
      if (state.action === 'club' && (Math.sin(bot.facing) * x + Math.cos(bot.facing) * z) / Math.max(range, 0.01) < -0.15) return 0;
      return damage * (state.action === 'smash' ? Math.max(0.35, 1 - range / radius) : 1);
    };
    if (ctx.player.alive) { const damage = hitTarget(ctx.player.pos, 1.65); if (damage) ctx.player.applyDamage(damage, false, state.action === 'smash', bot); }
    for (const ally of ctx.bots) if (ally.alive && ally.team === 'blue') { const damage = hitTarget(ally.pos, 0); if (damage) ctx.damageBot(ally, damage, false, bot); }
  }
  const duration = state.action === 'club' ? 1.5 : 2;
  if (state.action !== 'hunt' && t >= duration) { state.action = 'hunt'; state.elapsed = 0; state.cooldown = 1.4; state.hit = false; bot.isCharging = false; }
  bot.walkPhase = (bot.walkPhase ?? 0) + dt * speed * 2.2;
  if (bot.legLPivot && bot.legRPivot) { bot.legLPivot.rotation.x = Math.sin(bot.walkPhase) * (speed ? 0.6 : 0); bot.legRPivot.rotation.x = -bot.legLPivot.rotation.x; }
  bot.group.position.copy(bot.pos);
}
