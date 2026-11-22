import * as THREE from 'three';

/** Presentation only: a fixed two-handed load, with no camera/input/gameplay owner. */
export const MINIGUN_CARRY = Object.freeze({
  frequency: 18, poseResponse: 10, gaitScale: .45,
  lateralTravel: .0018, forwardTravel: .0013, compression: .00035,
  maxSpeed: 8.6, adsScale: .35,
});

/** Exact critical damping for a held velocity target: no overshoot or idle drift.
 * Local velocity changes move the whole supported assembly; both hands inherit it.
 */
export function createMinigunCarry() {
  const position = new THREE.Vector3(), rotation = new THREE.Vector3();
  const velocity = new THREE.Vector3(), angularVelocity = new THREE.Vector3();
  const targetPosition = new THREE.Vector3(), targetRotation = new THREE.Vector3();
  function reset() { position.set(0, 0, 0); rotation.set(0, 0, 0); velocity.set(0, 0, 0); angularVelocity.set(0, 0, 0); }
  function integrate(value: THREE.Vector3, speed: THREE.Vector3, target: THREE.Vector3, dt: number) {
    const omega = MINIGUN_CARRY.frequency, decay = Math.exp(-omega * dt);
    for (let i = 0; i < 3; i++) {
      const error = value.getComponent(i) - target.getComponent(i), v = speed.getComponent(i), k = v + omega * error;
      value.setComponent(i, target.getComponent(i) + (error + k * dt) * decay);
      speed.setComponent(i, (v - omega * k * dt) * decay);
    }
  }
  function update(dt: number, lateral: number, forward: number, aiming: boolean, handling: boolean) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    lateral = Number.isFinite(lateral) ? lateral : 0; forward = Number.isFinite(forward) ? forward : 0;
    const magnitude = Math.hypot(lateral, forward), bound = Math.min(1, MINIGUN_CARRY.maxSpeed / Math.max(1e-8, magnitude));
    const scale = handling ? 0 : aiming ? MINIGUN_CARRY.adsScale : 1;
    lateral *= bound * scale; forward *= bound * scale;
    targetPosition.set(-lateral * MINIGUN_CARRY.lateralTravel, -Math.hypot(lateral, forward) * MINIGUN_CARRY.compression, forward * MINIGUN_CARRY.forwardTravel);
    targetRotation.set(-forward * .0015, lateral * .001, lateral * .002);
    integrate(position, velocity, targetPosition, dt); integrate(rotation, angularVelocity, targetRotation, dt);
  }
  return { position, rotation, update, reset };
}
