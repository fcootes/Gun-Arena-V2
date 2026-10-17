import * as THREE from 'three';

/** One cycle = a left/right stride pair, not a footfall. At 8.6 m/s this is
 * 4.10 steps/s. The former bob*.5 oscillator was only 2.23 steps/s.
 * All positions are camera-local metres; shoulders are virtual, offscreen bones.
 */
export const PISTOL_SPRINT = Object.freeze({
  referenceSpeed: 8.6, pairsPerSecond: 2.05, minSpeedRatio: .72, maxSpeedRatio: 1.25,
  enterTime: .095, exitTime: .065, resetThreshold: .00002, reloadRecoveryTime: .08,
  upperArm: .26, forearm: .285, cuffOffset: .047,
  shoulderY: -.23, rightShoulderX: .205, leftShoulderX: -.215,
  rightShoulderZ: -.07, leftShoulderZ: -.19,
  inertiaSeconds: .035, inertiaPitch: .045, torsoYaw: .025, compression: .006,
  rightGrip: [.038, -.10, .105] as const,
  rightGripRotation: [-Math.PI / 2, Math.PI / 2, 0] as const,
});
interface Track { times: readonly number[]; coefficients: Float64Array; }
const wrap = (p: number) => p - Math.floor(p);
/** Closed quintic Hermite: position, velocity AND acceleration agree at every
 * key and across the seam. Monotone harmonic tangents suppress path overshoot.
 * Nonuniform key spacing authors the drive/recovery timing; no wrist oscillator.
 */
function track(times: readonly number[], values: readonly number[]): Track {
  const n = times.length, slopes = new Float64Array(n), tangents = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, h = (j ? times[j] : 1) - times[i];
    slopes[i] = (values[j] - values[i]) / h;
  }
  for (let i = 0; i < n; i++) {
    const a = slopes[(i + n - 1) % n], b = slopes[i];
    tangents[i] = a * b > 0 ? 2 * a * b / (a + b) : 0;
  }
  const coefficients = new Float64Array(n * 6);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, h = (j ? times[j] : 1) - times[i];
    const delta = values[j] - values[i], a = tangents[i] * h, b = tangents[j] * h, k = i * 6;
    coefficients[k] = values[i]; coefficients[k + 1] = a; coefficients[k + 2] = 0;
    coefficients[k + 3] = 10 * delta - 6 * a - 4 * b;
    coefficients[k + 4] = -15 * delta + 8 * a + 7 * b;
    coefficients[k + 5] = 6 * delta - 3 * a - 3 * b;
  }
  return { times, coefficients };
}
function sample(curve: Track, phase: number): number {
  const p = wrap(phase), times = curve.times;
  let i = 0; while (i + 1 < times.length && p >= times[i + 1]) i++;
  const u = (p - times[i]) / ((i + 1 < times.length ? times[i + 1] : 1) - times[i]), k = i * 6, c = curve.coefficients;
  return c[k] + u * (c[k + 1] + u * (c[k + 2] + u * (c[k + 3] + u * (c[k + 4] + u * c[k + 5]))));
}
export const PISTOL_GAIT_KEYS = [0, .115, .255, .395, .515, .64, .78, .91] as const;
const rightDrive = track(PISTOL_GAIT_KEYS, [.90, 1, .20, -.72, -1, -.76, -.10, .64]);
const leftDrive = track(PISTOL_GAIT_KEYS, [-.96, -1, -.22, .82, 1, .46, -.40, -.87]);
const shoulderTwist = track(PISTOL_GAIT_KEYS, [.75, 1, .35, -.62, -.90, -.60, .12, .60]);
const leftFistTwist = track(PISTOL_GAIT_KEYS, [-.55, -.50, -.72, -1.02, -1.10, -.88, -.64, -.56]);
// Two weight-acceptance pulses per pair: compress, rebound, settle.
const bodyImpact = track([0,.035,.105,.20,.35,.50,.535,.605,.70,.85], [0,-1,.28,0,0,0,-1,.28,0,0]);

export interface SprintArm {
  shoulder: THREE.Vector3; elbow: THREE.Vector3; wrist: THREE.Vector3;
  rotation: THREE.Quaternion; shoulderPitch: number; elbowFlexion: number;
}
export interface PistolSprintPose {
  phase: number; cadence: number; blend: number; running: boolean;
  right: SprintArm; left: SprintArm;
  weaponPosition: THREE.Vector3; weaponRotation: THREE.Quaternion;
  compression: number; inertia: number;
}
function arm(): SprintArm {
  return { shoulder: new THREE.Vector3(), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), rotation: new THREE.Quaternion(), shoulderPitch: 0, elbowFlexion: 0 };
}
export function createPistolSprintPose(): PistolSprintPose {
  return { phase: 0, cadence: PISTOL_SPRINT.pairsPerSecond, blend: 0, running: false,
    right: arm(), left: arm(), weaponPosition: new THREE.Vector3(), weaponRotation: new THREE.Quaternion(), compression: 0, inertia: 0 };
}
/** FK upper arm + elbow flexion produce BOTH elbow and wrist. The rendered cuff
 * and bounded forearm use these same bones; the hand is never a detached spline.
 */
function articulate(a: SprintArm, pitch: number, flexion: number, side: number, twist: number, euler: THREE.Euler) {
  a.shoulderPitch = pitch; a.elbowFlexion = flexion;
  const upper = PISTOL_SPRINT.upperArm, lower = PISTOL_SPRINT.forearm;
  // Small abduction, rather than swinging an elbow across the torso.
  const outward = side * .075;
  a.elbow.set(a.shoulder.x + Math.sin(outward) * upper,
    a.shoulder.y - Math.cos(pitch) * Math.cos(outward) * upper,
    a.shoulder.z - Math.sin(pitch) * Math.cos(outward) * upper);
  const forearmPitch = pitch + flexion;
  a.wrist.set(a.elbow.x - side * .018,
    a.elbow.y - Math.cos(forearmPitch) * Math.sqrt(lower * lower - .018 * .018),
    a.elbow.z - Math.sin(forearmPitch) * Math.sqrt(lower * lower - .018 * .018));
  // Palm longitudinal axis follows the forearm; twist turns knuckles outward.
  a.rotation.setFromEuler(euler.set(forearmPitch - Math.PI, twist, side * -.045));
}
/** Per-controller scratch: no shared mutable scratch between managers. */
export function createPistolGaitEvaluator() {
  const euler = new THREE.Euler(), grip = new THREE.Vector3().fromArray(PISTOL_SPRINT.rightGrip);
  const gripRotation = new THREE.Quaternion().setFromEuler(euler.set(...PISTOL_SPRINT.rightGripRotation));
  const offset = new THREE.Vector3();
  return (phase: number, cadence: number, pose: PistolSprintPose) => {
    pose.phase = wrap(phase); pose.cadence = cadence;
    const r = sample(rightDrive, phase), l = sample(leftDrive, phase), torso = sample(shoulderTwist, phase);
    pose.compression = sample(bodyImpact, phase) * PISTOL_SPRINT.compression;
    // A short delayed response to shoulder-drive reversal. This phase-domain
    // filter is bounded, periodic and stable at arbitrary dt; gun AND hand lag.
    pose.inertia = (sample(rightDrive, phase - PISTOL_SPRINT.inertiaSeconds * cadence) - r) * PISTOL_SPRINT.inertiaPitch;
    const counter = torso * PISTOL_SPRINT.torsoYaw;
    pose.right.shoulder.set(PISTOL_SPRINT.rightShoulderX + counter * .10, PISTOL_SPRINT.shoulderY + pose.compression, PISTOL_SPRINT.rightShoulderZ - counter * .20);
    pose.left.shoulder.set(PISTOL_SPRINT.leftShoulderX + counter * .10, PISTOL_SPRINT.shoulderY + pose.compression, PISTOL_SPRINT.leftShoulderZ + counter * .20);
    articulate(pose.right, .41 + .17 * r, 1.755 - .125 * r, 1, 0, euler);
    articulate(pose.left, .26 + .57 * l, 1.48 - .06 * l, -1, sample(leftFistTwist,phase), euler);
    // Constrained carry: derive the weapon root from the FK firing wrist and
    // inverse grip. There is no independent positional weapon bob afterward.
    pose.weaponRotation.setFromEuler(euler.set(.43 + .035 * r + pose.inertia, -.14 + counter, -.20 - .035 * r));
    pose.right.rotation.multiplyQuaternions(pose.weaponRotation, gripRotation);
    offset.copy(grip).applyQuaternion(pose.weaponRotation);
    pose.weaponPosition.copy(pose.right.wrist).sub(offset);
  };
}
/** Closed-form critically damped envelopes and integrated phase use seconds. No animation changes
 * gameplay speed. Zero-speed/default callers retain the established API contract.
 */
export function createPistolSprintController() {
  const pose = createPistolSprintPose(), evaluate = createPistolGaitEvaluator();
  let phase = 0, blendVelocity = 0;
  evaluate(0, PISTOL_SPRINT.pairsPerSecond, pose);
  return {
    pose,
    reset() { phase = 0; blendVelocity = 0; pose.blend = 0; pose.running = false; evaluate(0, PISTOL_SPRINT.pairsPerSecond, pose); },
    update(dt: number, running: boolean, horizontalSpeed: number = PISTOL_SPRINT.referenceSpeed) {
      const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      const speed = Number.isFinite(horizontalSpeed) ? Math.max(0, horizontalSpeed) : PISTOL_SPRINT.referenceSpeed;
      const cadence = PISTOL_SPRINT.pairsPerSecond * Math.sqrt(THREE.MathUtils.clamp(speed / PISTOL_SPRINT.referenceSpeed, PISTOL_SPRINT.minSpeedRatio, PISTOL_SPRINT.maxSpeedRatio));
      if (running && !pose.running && pose.blend < PISTOL_SPRINT.resetThreshold) phase = 0;
      const time = running ? PISTOL_SPRINT.enterTime : PISTOL_SPRINT.exitTime;
      const target = running ? 1 : 0, omega = 2 / time, displacement = pose.blend - target;
      const coupled = blendVelocity + omega * displacement, decay = Math.exp(-omega * delta);
      pose.blend = target + (displacement + coupled * delta) * decay;
      blendVelocity = (blendVelocity - omega * coupled * delta) * decay;
      pose.running = running;
      if (running || pose.blend >= PISTOL_SPRINT.resetThreshold) phase = wrap(phase + delta * cadence);
      else { phase = 0; pose.blend = 0; blendVelocity = 0; }
      evaluate(phase, cadence, pose);
    },
  };
}
