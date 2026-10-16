import * as THREE from 'three';
import type { ReloadPhase, ReloadSequence } from './weaponReload';
import type { WeaponAssembly } from './weaponModels';

export const BATTLE_RIFLE = Object.freeze({ lift: .40, extract: .45, acquire: .30,
  insert: .65, chamber: .60, lower: .45, magazineZ: .21, extraction: .19,
  // +X pitch raises the -Z muzzle. Roll alone cannot create this silhouette.
  pitch: 1.40, yaw: .10, roll: -.35, position: [.16, -.17, -.66] as const });
export const brEase = (v: number) => { const p = Math.max(0, Math.min(1, v)); return p * p * (3 - 2 * p); };
export function brReloadLift(sequence: ReloadSequence): number {
  const stage = sequence.phases[sequence.index], p = sequence.elapsed / stage.duration;
  return stage.phase === 'open' ? brEase(p) : stage.phase === 'close' ? 1 - brEase(p) : 1;
}
export function brChargingStroke(p: number): number {
  return .045 * brEase((p - .22) / .28) * (1 - brEase((p - .62) / .20));
}
export function brChargingReach(p: number): number { return brEase(p / .18) * (1 - brEase((p - .84) / .16)); }
export type BattleRifleEvent = 'extract' | 'insert' | 'chamber';
export type BattleRifleListener = (event: BattleRifleEvent, speed: number, late: number) => void;
export function brCueTime(phase: ReloadPhase, duration: number): number | undefined {
  return phase === 'eject' ? duration * (.08 / BATTLE_RIFLE.extract)
    : phase === 'insert' ? duration * (.08 / BATTLE_RIFLE.insert)
    : phase === 'chamber' ? duration * .22 : undefined;
}

/** One cached animator per BR assembly. Two magazine groups share their baked
 * buffers/materials; no replacement model or scratch object is made per frame. */
export function createBattleRifleAnimator(assembly: WeaponAssembly) {
  const old = assembly.parts.magazine, fresh = assembly.parts.freshMagazine;
  const origin = old.position.clone(), position = new THREE.Vector3().fromArray(BATTLE_RIFLE.position);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(BATTLE_RIFLE.pitch, BATTLE_RIFLE.yaw, BATTLE_RIFLE.roll));
  return (sequence: ReloadSequence) => {
    const stage = sequence.phases[sequence.index], p = sequence.elapsed / stage.duration;
    const lift = brReloadLift(sequence), exchange = sequence.phases.some(p => p.phase === 'pickup');
    assembly.root.position.lerp(position, lift); assembly.root.quaternion.slerp(rotation, lift);
    assembly.parts.stock.visible = lift > .60;
    old.position.copy(origin); fresh.position.copy(origin); old.visible = true; fresh.visible = false;
    if (!exchange) {
      // Interrupted empty reload: operate only the receiver control, no extra mag.
    } else if (stage.phase === 'eject') {
      old.position.y -= BATTLE_RIFLE.extraction * brEase((p - .10) / .78);
    } else if (stage.phase === 'pickup') {
      const stow = brEase(p / .55), acquire = brEase((p - .45) / .55);
      old.position.x -= stow * .14; old.position.y -= BATTLE_RIFLE.extraction + stow * .10;
      old.position.z += stow * .65; old.visible = p < .58;
      fresh.position.x -= .16 * (1 - acquire) + .04 * acquire;
      fresh.position.y -= .29 * (1 - acquire) + BATTLE_RIFLE.extraction * acquire;
      fresh.position.z += .56 * (1 - acquire); fresh.visible = p >= .40;
    } else if (stage.phase === 'insert') {
      old.visible = false; fresh.visible = true;
      fresh.position.x -= .04 * (1 - brEase(p / .22));
      const approach = brEase((p - .22) / .53), seat = brEase((p - .75) / .20);
      fresh.position.y -= BATTLE_RIFLE.extraction * (1 - approach) + .030 * approach * (1 - seat);
      const impulse = Math.sin(Math.PI * THREE.MathUtils.clamp((p - .92) / .08, 0, 1));
      assembly.root.position.y += impulse * .006; assembly.root.rotation.x -= impulse * .012;
    } else if (stage.phase === 'chamber' || stage.phase === 'close') {
      old.visible = false; fresh.visible = true;
    }
    if (stage.phase === 'chamber') assembly.parts.bolt.position.z += brChargingStroke(p);
  };
}
