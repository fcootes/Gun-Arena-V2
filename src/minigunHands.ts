import * as THREE from 'three';
import type {WeaponSlotState} from './types';

const ease = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Presentation follows the existing vent sequence, including class scaling.
 * No independent heat, reload, audio or ammunition clock is introduced.
 */
export function minigunVentProgress(state: WeaponSlotState | null | undefined) {
  const sequence = state?.reloading ? state.reloadSequence : undefined;
  if (!sequence || sequence.kind !== 'vent') return -1;
  let elapsed = sequence.elapsed, duration = 0;
  for (let i = 0; i < sequence.phases.length; i++) {
    const span = sequence.phases[i].duration;
    duration += span;
    if (i < sequence.index) elapsed += span;
  }
  return THREE.MathUtils.clamp(elapsed / Math.max(duration, 1e-8), 0, 1);
}

/** Unhook above the upper carry bracket before moving outboard. Return above
 * the same bracket, then settle down onto it; never cut through the hot motor.
 */
export function createMinigunHandAnimator() {
  const rotation = new THREE.Quaternion(), euler = new THREE.Euler();
  return (state: WeaponSlotState | null | undefined, target: THREE.Vector3, orientation: THREE.Quaternion) => {
    const p = minigunVentProgress(state);
    if (p < 0) return 1;
    const release = ease(p / .13);
    const lift = ease((p - .04) / .12) * (1 - ease((p - .88) / .12));
    const withdraw = ease((p - .14) / .20);
    const returnToGrip = ease((p - .62) / .29);
    const away = withdraw * (1 - returnToGrip);
    // Lift first, then pull toward the left elbow with a short rearward bias.
    target.x -= .105 * away;
    target.y += .055 * lift;
    target.z += .025 * away;
    // Clear the front of the real transverse bar during the last lowering
    // stroke, then settle back into the authored wrap rather than cutting in.
    target.z -= .006 * Math.sin(Math.PI * THREE.MathUtils.clamp((p - .85) / .15, 0, 1));
    const reaction = Math.sin(Math.PI * THREE.MathUtils.clamp((p - .32) / .24, 0, 1));
    const settle = ease((p - .91) / .09);
    target.y += .003 * reaction;
    rotation.setFromEuler(euler.set(.055 * away, -.045 * away, -.075 * away - .055 * reaction));
    orientation.premultiply(rotation);
    // Start/end and the two existing phase boundaries are position-, rotation-
    // and finger-continuous. Reclose as the palm settles onto the upper support.
    return 1 - .18 * release * (1 - settle);
  };
}

/** Camera-local two-bone arm solve. The upper sleeves keep visible elbows
 * connected to an off-screen torso; the forearm cannot stretch into a rifle pose.
 */
export function createMinigunArmSolver() {
  const axis = new THREE.Vector3(), bend = new THREE.Vector3();
  return (side: 'left' | 'right', cuff: THREE.Vector3, shoulder: THREE.Vector3, elbow: THREE.Vector3) => {
    const upper = .36, fore = .32, maximum = upper + fore - .008;
    shoulder.set(side === 'left' ? -.20 : .32, side === 'left' ? -.52 : -.46, side === 'left' ? -.30 : -.24);
    axis.subVectors(cuff, shoulder);
    let distance = axis.length();axis.divideScalar(Math.max(distance, 1e-8));
    // Small torso lean absorbs the long rotary receiver without moving camera,
    // weapon, aiming or the player's movement/physics anchor.
    shoulder.addScaledVector(axis, THREE.MathUtils.clamp(distance - maximum + .06, 0, side === 'left' ? .24 : .18));
    axis.subVectors(cuff, shoulder);distance = axis.length();axis.divideScalar(Math.max(distance, 1e-8));
    const reach = THREE.MathUtils.clamp(distance, Math.abs(upper - fore) + .025, maximum);
    const along = (upper * upper - fore * fore + reach * reach) / (2 * reach);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    // Keep the left elbow forward/outboard of the belt chute; a rearward rifle
    // pole would route the upper sleeve through the flexible ammunition feed.
    bend.set(side === 'left' ? -1 : 1, side === 'left' ? .20 : -.45, side === 'left' ? -.70 : .10);
    bend.addScaledVector(axis, -axis.dot(bend)).normalize();
    elbow.copy(shoulder).addScaledVector(axis, along).addScaledVector(bend, height);
  };
}
