import type { WeaponSlotState } from './types';

// One timeline, in seconds at standard class speed. Recovery is perceptibly
// later; the .84 s mechanical lock remains inside the unchanged .85 s cadence.
const recovery = .32, rearward = .20, rearStop = .02, forward = .22, settle = .08;
const rearEnd = recovery + rearward, forwardStart = rearEnd + rearStop, pumpEnd = forwardStart + forward;
export const SHOTGUN = Object.freeze({ recovery, rearward, rearStop, forward, settle, rearEnd, forwardStart, pumpEnd,
  pumpDuration: rearward + rearStop + forward, cycle: pumpEnd + settle,
  stroke: .075, open: .30, shell: .85, seat: .72, close: .26 });
export interface ShotgunCycle { elapsed: number; duration: number; kind: 'fire' | 'chamber'; pumpStarted: boolean; }
export type ShotgunEventListener = (event: 'pump' | 'seat', duration: number, empty: boolean, late: number) => void;
export const shotgunEase = (v: number) => { const p = Math.max(0, Math.min(1, v)); return p * p * (3 - 2 * p); };

/** Pump displacement in metres. A genuine rear stop and forward endpoint,
 * rather than a sine wave, shared by fire and reload chambering. */
export function shotgunPumpStroke(elapsed: number, duration: number = SHOTGUN.cycle): number {
  const t = elapsed * SHOTGUN.cycle / duration;
  if (t <= SHOTGUN.recovery || t >= SHOTGUN.pumpEnd) return 0;
  if (t < SHOTGUN.rearEnd) return SHOTGUN.stroke * shotgunEase((t - SHOTGUN.recovery) / SHOTGUN.rearward);
  if (t < SHOTGUN.forwardStart) return SHOTGUN.stroke;
  return SHOTGUN.stroke * (1 - shotgunEase((t - SHOTGUN.forwardStart) / SHOTGUN.forward));
}

export function beginShotgunCycle(state: WeaponSlotState, kind: ShotgunCycle['kind'] = 'fire', duration: number = SHOTGUN.cycle, elapsed = 0, pumpStarted = false): void {
  state.shotgunCycle = { elapsed, duration, kind, pumpStarted };
  state.boltCycleT = Math.max(0, duration - elapsed);
  state.needsChamber = true;
  if (kind === 'fire') state.pendingReloadShot = false;
}

/** Switching cancels a queued trigger, but cannot magically chamber a shell. */
export function cancelShotgunCycle(state: WeaponSlotState): void {
  if (!state.shotgunCycle) { state.pendingReloadShot = false; return; }
  state.shotgunCycle = undefined; state.boltCycleT = 0;
  state.pendingReloadShot = false; state.needsChamber = true;
}

export function advanceShotgunCycle(state: WeaponSlotState, delta: number, onEvent?: ShotgunEventListener): void {
  const cycle = state.shotgunCycle;
  if (!cycle) return;
  cycle.elapsed = Math.min(cycle.duration, cycle.elapsed + delta);
  const scale = cycle.duration / SHOTGUN.cycle, start = SHOTGUN.recovery * scale;
  if (!cycle.pumpStarted && cycle.elapsed + 1e-8 >= start) {
    cycle.pumpStarted = true;
    onEvent?.('pump', SHOTGUN.pumpDuration * scale, true, cycle.elapsed - start);
  }
  state.boltCycleT = Math.max(0, cycle.duration - cycle.elapsed);
  if (state.boltCycleT < 1e-8) {
    state.boltCycleT = 0; state.shotgunCycle = undefined; state.needsChamber = false;
  }
}

/** Reused output; +Y up, muzzle -Z. The shell rises through the open underside
 * before moving forward into the magazine. It never crosses a receiver wall. */
export function shotgunShellPose(progress: number, out: { x: number; y: number; z: number; angle: number }): void {
  const carry = shotgunEase((progress - .16) / .36), press = shotgunEase((progress - .52) / .20);
  out.x = -.08 + .074 * carry + .006 * press;
  out.y = -.115 + .040 * carry + .055 * press;
  out.z = -.045 - .015 * press;
  out.angle = -.20 * (1 - carry);
}
