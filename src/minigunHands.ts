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

/** Open the fingers, lower/outboard from the fixed cradle, react once, then
 * reverse that clear approach before wrapping the same grip. All scratch owned
 * by the hand rig; no reach toward a hot motor or free-floating receiver marker.
 */
export function createMinigunHandAnimator() {
  const rotation = new THREE.Quaternion(), euler = new THREE.Euler();
  return (state: WeaponSlotState | null | undefined, target: THREE.Vector3, orientation: THREE.Quaternion) => {
    const p = minigunVentProgress(state);
    if (p < 0) return 1;
    const release = ease(p / .13);
    const withdraw = ease((p - .10) / .20);
    const returnToGrip = ease((p - .62) / .29);
    const away = withdraw * (1 - returnToGrip);
    // The whole glove first clears the 27 mm-radius cylinder below/outboard.
    target.x -= .072 * away;
    target.y -= .072 * away;
    target.z += .036 * away;
    const reaction = Math.sin(Math.PI * THREE.MathUtils.clamp((p - .32) / .24, 0, 1));
    const settle = ease((p - .91) / .09);
    target.y -= .004 * reaction;
    rotation.setFromEuler(euler.set(.08 * away, -.07 * away, -.10 * away - .065 * reaction));
    orientation.premultiply(rotation);
    // Start/end and the two existing phase boundaries are position-, rotation-
    // and finger-continuous. Reclose only after the palm regains the underside.
    return 1 - .18 * release * (1 - settle);
  };
}
