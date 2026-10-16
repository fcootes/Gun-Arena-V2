import type { WeaponSlotState } from './types';

// One clock for hand contact, receiver travel, the mechanical cue and lockout.
export const SNIPER = Object.freeze({ reach: .16, unlock: .14, rearward: .22, stop: .06,
  forward: .25, lock: .18, release: .16, mechanical: .85, cycle: 1.17, stroke: .055,
  reloadOpen: .14, reloadEject: .4212, reloadInsert: .9477, reloadClose: .3159 });
export interface SniperCycle { elapsed: number; soundStarted: boolean; resumeSound?: boolean; }
export type SniperBoltListener = (duration: number, late: number) => void;
export const sniperEase = (v: number) => { const p = Math.max(0, Math.min(1, v)); return p * p * (3 - 2 * p); };

/** Ammo is committed by the existing firing path; cycling never grants a round. */
export function requireSniperBolt(state: WeaponSlotState): void {
  state.needsChamber = true; state.sniperCycle = undefined; state.boltCycleT = 0;
  state.sniperRecoveryT = .34;
}
export function beginSniperCycle(state: WeaponSlotState): boolean {
  if (!state.needsChamber || state.reloading || state.sniperCycle || (state.ammo ?? 0) <= 0) return false;
  state.sniperCycle = { elapsed: 0, soundStarted: false };
  state.boltCycleT = SNIPER.cycle;
  return true;
}
export function advanceSniperAction(state: WeaponSlotState, delta: number, onBolt?: SniperBoltListener): void {
  if (!Number.isFinite(delta) || delta <= 0) return;
  state.sniperRecoveryT = Math.max(0, (state.sniperRecoveryT ?? 0) - delta);
  const cycle = state.sniperCycle;
  // Bots retain their existing timer; manual cycling is a player interaction.
  if (!cycle) { state.boltCycleT = Math.max(0, (state.boltCycleT ?? 0) - delta); return; }
  cycle.elapsed = Math.min(SNIPER.cycle, cycle.elapsed + delta);
  if ((!cycle.soundStarted || cycle.resumeSound) && cycle.elapsed + 1e-8 >= SNIPER.reach) {
    cycle.soundStarted = true; cycle.resumeSound = false;
    if (cycle.elapsed < SNIPER.reach + SNIPER.mechanical) onBolt?.(SNIPER.mechanical, cycle.elapsed - SNIPER.reach);
  }
  state.boltCycleT = Math.max(0, SNIPER.cycle - cycle.elapsed);
  if (state.boltCycleT < 1e-8) {
    state.sniperCycle = undefined; state.boltCycleT = 0; state.needsChamber = false;
  }
}
export function sniperBoltSlide(t: number): number {
  const rear = SNIPER.reach + SNIPER.unlock, back = rear + SNIPER.rearward, forward = back + SNIPER.stop;
  if (t <= rear || t >= forward + SNIPER.forward) return 0;
  if (t < back) return SNIPER.stroke * sniperEase((t - rear) / SNIPER.rearward);
  if (t <= forward) return SNIPER.stroke;
  return SNIPER.stroke * (1 - sniperEase((t - forward) / SNIPER.forward));
}
export function sniperBoltRoll(t: number): number {
  const closing = SNIPER.reach + SNIPER.unlock + SNIPER.rearward + SNIPER.stop + SNIPER.forward;
  return -.85 * sniperEase((t - SNIPER.reach) / SNIPER.unlock) * (1 - sniperEase((t - closing) / SNIPER.lock));
}
export function sniperHandReach(t: number): number {
  return sniperEase(t / SNIPER.reach) * (1 - sniperEase((t - SNIPER.reach - SNIPER.mechanical) / SNIPER.release));
}
/** Vertical removal from the real magwell, with a short reach and firm seating. */
export function sniperMagazineDrop(phase: string, p: number): number {
  return phase === 'eject' ? .19 * sniperEase((p - .25) / .65)
    : phase === 'insert' ? .19 * (1 - sniperEase((p - .12) / .80)) : 0;
}
