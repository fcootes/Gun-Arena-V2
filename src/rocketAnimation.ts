import * as THREE from 'three';
import type { WeaponAssembly } from './weaponModels';
import type { WeaponSlotState } from './types';

export const ROCKET_MODULE_SEAT = [-.055, -.012, .029] as const;
const OUTSIDE = [-.188, -.012, .029] as const;
const PICKUP = [-.192, -.235, .060] as const;
export const ROCKET_HATCH_LOCK = .65;
const HATCH_ANGLE = -2.06;
const open = (value: number, start: number, end: number) =>
  THREE.MathUtils.smoothstep(value, start, end);

function rocketStage(state?: WeaponSlotState | null) {
  return state?.reloading && state.reloadSequence?.kind === 'tube' ? state.reloadSequence : undefined;
}

export function createRocketAnimator(assembly: WeaponAssembly, firstPerson: boolean) {
  const { rocketHatch: hatch, reloadRound: round } = assembly.parts;
  const pickup = new THREE.Vector3(...PICKUP);
  const outside = new THREE.Vector3(...OUTSIDE);
  const seat = new THREE.Vector3(...ROCKET_MODULE_SEAT);
  return (state?: WeaponSlotState) => {
    const sequence = rocketStage(state);
    const stage = sequence?.phases[sequence.index];
    const t = stage ? sequence!.elapsed / stage.duration : 0;
    let access = 0, present = 0, impulse = 0;
    round.visible = false;
    round.position.copy(seat);
    if (stage?.phase === 'open') {
      present = open(t, 0, .83);
      access = open(t, .52, .98);
    } else if (stage?.phase === 'insert') {
      access = present = 1;
      round.visible = t >= .22;
      round.position.lerpVectors(pickup, outside, open(t, .22, .59));
      round.position.lerp(seat, open(t, .64, .91));
      impulse = open(t, .84, .92) * (1 - open(t, .92, 1));
    } else if (stage?.phase === 'close') {
      present = 1 - open(t, .6, 1);
      access = 1 - open(t, .34, ROCKET_HATCH_LOCK);
      impulse = open(t, .57, ROCKET_HATCH_LOCK) * (1 - open(t, ROCKET_HATCH_LOCK, .79));
      round.visible = true;
    }
    hatch.rotation.z = access === 0 ? 0 : HATCH_ANGLE * access;
    if (firstPerson && stage) {
      assembly.root.position.x += .065 * present + .008 * impulse;
      assembly.root.position.y += .104 * present - .009 * impulse;
      assembly.root.position.z -= .056 * present;
      assembly.root.rotation.y += .34 * present;
      assembly.root.rotation.z += .05 * present - .045 * impulse;
    }
  };
}

export function createRocketHandAnimator() {
  const latch = new THREE.Vector3();
  const pickup = new THREE.Vector3(...PICKUP);
  const atCassette = new THREE.Vector3();
  const clearance = new THREE.Vector3(-.202, -.106, -.100);
  const gripOffset = new THREE.Vector3(-.067, -.021, .013);
  const reach = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, -Math.PI / 2, .30));
  return (assembly: WeaponAssembly, state: WeaponSlotState | null | undefined,
          support: THREE.Vector3, target: THREE.Vector3, orientation: THREE.Quaternion) => {
    const sequence = rocketStage(state);
    if (!sequence) return .95;
    const stage = sequence.phases[sequence.index];
    const t = sequence.elapsed / stage.duration;
    const { rocketHatch: hatch, reloadRound: round } = assembly.parts;
    hatch.updateMatrix();
    latch.set(-.036, -.084, .058).applyMatrix4(hatch.matrix);
    atCassette.copy(round.position).add(gripOffset);

    if (stage.phase === 'open') {
      target.lerpVectors(support, clearance, open(t, 0, .26));
      target.lerp(latch, open(t, .26, .52));
      orientation.slerp(reach, open(t, .2, .52));
    } else if (stage.phase === 'insert') {
      if (t < .22) target.lerpVectors(latch, pickup, open(t, 0, .22)).addScaledVector(gripOffset, open(t, 0, .22));
      else target.copy(atCassette);
      orientation.copy(reach);
    } else {
      target.lerpVectors(atCassette, clearance, open(t, 0, .15));
      target.lerp(latch, open(t, .15, .34));
      target.lerp(clearance, open(t, ROCKET_HATCH_LOCK, .79));
      target.lerp(support, open(t, .79, 1));
      orientation.slerp(reach, 1 - open(t, ROCKET_HATCH_LOCK, 1));
    }
    return .95;
  };
}
