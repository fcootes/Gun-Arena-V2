import * as THREE from 'three';
import type { ReloadSequence } from './weaponReload';
import type { WeaponAssembly } from './weaponModels';
import type { WeaponSlotState } from './types';

/** Existing batch1 composite cues, normalized to their authoritative phases.
 * No extra chamber sound: the empty recording already contains the action. */
export const PISTOL = Object.freeze({ slideTravel: .038, releaseAt: .18,
  magazineGrip: [-.036, -.025, .022] as const,
  magazineRotation: [-Math.PI / 2, -Math.PI / 2, 0] as const,
  releaseGrip: [-.034, -.045, .063] as const,
  releaseRotation: [-Math.PI / 2, -Math.PI / 2, -.18] as const });
const tacticalPickup = Object.freeze({ stow: .14, appear: .16, acquire: .15, reach: .20, seat: .38 });
const emptyPickup = Object.freeze({ stow: .22, appear: .24, acquire: .25, reach: .30, seat: .57 });
export const pistolPickup = (empty: boolean) => empty ? emptyPickup : tacticalPickup;
export const pistolEase = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
export function pistolReloadLift(sequence: ReloadSequence) {
  const stage = sequence.phases[sequence.index], p = sequence.elapsed / stage.duration;
  return stage.phase === 'eject' ? pistolEase(p / .35) : stage.phase === 'close' ? 1 - pistolEase(p) : 1;
}
export function pistolSlideLock(state: WeaponSlotState | null | undefined) {
  const q = state?.reloading ? state.reloadSequence : undefined, stage = q?.phases[q.index];
  if (stage?.phase === 'chamber') return 1 - pistolEase((q!.elapsed / stage.duration - PISTOL.releaseAt) / .22);
  return state?.ammo === 0 || !!state?.needsChamber ? 1 : 0;
}
export function pistolReleasePress(progress: number) {
  return pistolEase(progress / .12) * (1 - pistolEase((progress - .28) / .18));
}
/** Cached buffers and scratch math; the state clock alone selects every pose. */
export function createPistolAnimator(assembly: WeaponAssembly) {
  const old = assembly.parts.magazine, fresh = assembly.parts.freshMagazine;
  const origin = old.position.clone(), rotation = old.quaternion.clone();
  const carry = new THREE.Vector3(.10, -.105, -.46);
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(.18, -.18, -.68));
  return (state: WeaponSlotState | null | undefined, shotStroke: number) => {
    old.position.copy(origin); old.quaternion.copy(rotation); old.visible = true;
    fresh.position.copy(origin); fresh.quaternion.copy(rotation); fresh.visible = false;
    const q = state?.reloading ? state.reloadSequence : undefined, stage = q?.phases[q.index];
    if (q && stage) {
      const p = q.elapsed / stage.duration, lift = pistolReloadLift(q);
      assembly.root.position.lerp(carry, lift); assembly.root.quaternion.slerp(tilt, lift);
      if (stage.phase === 'eject') {
        const out = pistolEase((p - .20) / .80);
        old.position.y -= .135 * out; old.position.z += .022 * out;
        assembly.parts.magazineRelease.position.x += .002 * Math.sin(Math.PI * pistolEase(p / .30));
      } else if (stage.phase === 'insert') {
        // Removed mag is stowed below the frame; replacement enters from the
        // same belt location. Visibility changes occur below the viewport.
        const timing = pistolPickup(q.empty);
        const stow = pistolEase(p / timing.stow), acquire = pistolEase((p - timing.acquire) / timing.reach);
        old.position.set(origin.x - .18 * stow, origin.y - .135 - .20 * stow, origin.z + .022);
        old.visible = p < timing.appear - .01;
        fresh.position.set(origin.x - .18 * (1 - acquire), origin.y - .335 + .200 * acquire, origin.z + .022);
        fresh.visible = p >= timing.appear;
        const align = pistolEase((p - timing.seat + .02) / .12);
        fresh.position.x *= 1 - align;
        const seat = pistolEase((p - timing.seat) / (.96 - timing.seat));
        fresh.position.y = origin.y - (origin.y - fresh.position.y) * (1 - seat);
        fresh.position.z = origin.z + .022 * (1 - seat);
        const settle = Math.sin(Math.PI * THREE.MathUtils.clamp((p - .94) / .06, 0, 1));
        assembly.root.position.y += settle * .003;
      } else if (q.phases.some(s => s.phase === 'insert')) { old.visible = false; fresh.visible = true; }
      if (stage.phase === 'chamber') assembly.parts.slideRelease.rotation.z -= .18 * pistolReleasePress(p);
    }
    const lock = pistolSlideLock(state);
    assembly.parts.slide.position.z += PISTOL.slideTravel * Math.max(lock, shotStroke);
  };
}

/** The free wrist is authored in CAMERA space. The rig converts it back to
 * weapon space, so pistol/right-arm motion cannot drag the left arm along. */
export function pistolSprintWrist(phase: number, position: THREE.Vector3, rotation: THREE.Quaternion, euler: THREE.Euler) {
  const swing = Math.sin(phase * .5), lift = Math.cos(phase * .5);
  position.set(-.205 + .025 * lift, -.225 + .065 * swing, -.40 - .065 * swing);
  rotation.setFromEuler(euler.set(-.90 + .25 * swing, -.45, -.45 + .12 * lift));
}
