import { SMG, smgEase, smgReach, smgSwap } from './smgMechanics';
import type { PistolSprintPose } from './pistolSprint';
import { PISTOL, pistolEase, pistolPickup } from './pistolMechanics';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { WeaponAssembly, WeaponModelId } from './weaponModels';
import type { WeaponSlotState } from './types';
import type { FactionType } from './lobbyAvatar';
import { SHOTGUN, shotgunEase, shotgunShellPose } from './shotgunMechanics';
import { VIEWMODEL_GRIPS, arChamberReach, arChamberRelease, type HandAttachment } from './viewmodelGrips';
import { sniperEase, sniperHandReach } from './sniperMechanics';
import { brEase } from './battleRifleMechanics';

interface Digit { joints: THREE.Object3D[]; lengths: number[]; radius: number; thumb: boolean; index: boolean; spread: number; }
interface Hand {
  wrist: THREE.Group; sleeve: THREE.Mesh; digits: Digit[];
  target: THREE.Vector3; orientation: THREE.Quaternion; phaseStart: THREE.Vector3; phaseRotation: THREE.Quaternion;
  curl: number;
}
const runningFingerAngles = [.95, 1.35, .95], runningThumbAngles = [.35, .70, .45];
const pistolFingerAngles = [.85, 1.20, .90], pistolThumbAngles = [.25, .55, .45];
const thumbAngles = [.20, .35, .30], triggerAngles = [.10, .50, .65], gripAngles = [.5, .9, .65];

/** One pair per manager. All 30 phalanges share two instanced draws. Static
 * palm/cuff/panel details are merged per hand; sleeves share one tapered buffer.
 * Ordinary viewmodel traversal owns geometry/material disposal. The hook releases
 * instance buffers too, including callers using legacy disposeBotVisuals(root).
 */
export function createFirstPersonHands() {
  const root = new THREE.Group(); root.name = 'FirstPersonHands';
  const cloth = new THREE.MeshStandardMaterial({ color: 0x43463b, roughness: .95 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x282d2a, roughness: .87, metalness: .025 });
  const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x535a45, roughness: .97 });
  function capsule(length: number, caps: number) {
    const geometry = new THREE.CapsuleGeometry(.5, length, caps, 6);
    // Lathed pole triangles can be degenerate. Keep a real first triangle so
    // existing one-primitive deployment preparation executes fragment shading.
    const position = geometry.attributes.position, index = geometry.index!;
    const indices: number[] = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i)); b.fromBufferAttribute(position, index.getX(i + 1)); c.fromBufferAttribute(position, index.getX(i + 2));
      if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-12) indices.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
    geometry.setIndex(indices); return geometry;
  }
  const digitGeometry = capsule(1, 3);
  const padGeometry = capsule(.5, 2);
  const segments = new THREE.InstancedMesh(digitGeometry, cloth, 30); segments.name = 'GlovePhalanges';
  const pads = new THREE.InstancedMesh(padGeometry, rubber, 30); pads.name = 'GloveKnucklePads';
  for (const mesh of [segments, pads]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false; root.add(mesh);
  }
  const scratch = new THREE.Object3D(), inverse = new THREE.Matrix4(), matrix = new THREE.Matrix4(), instanceTransform = new THREE.Matrix4();
  const direction = new THREE.Vector3(), end = new THREE.Vector3(), elbow = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const targetRotation = new THREE.Quaternion(), euler = new THREE.Euler(), attachmentPosition = new THREE.Vector3();
  const inverseWeaponRotation = new THREE.Quaternion();
  const supportGrip = new THREE.Vector3(), shotgunPickup = new THREE.Vector3(-.078, -.170, -.03536);
  const shellPose = { x: 0, y: 0, z: 0, angle: 0 };
  let selected: WeaponModelId = 'ar', phase = '', disposed = false, initialized = false;

  function merge(parts: THREE.BufferGeometry[]) {
    const triangles = parts.map(part => part.index ? part.toNonIndexed() : part);
    try {
      const result = mergeGeometries(triangles, false);
      if (!result) throw new Error('First-person hand geometry attributes cannot be merged');
      return result;
    } finally {
      parts.forEach(part => part.dispose());
      triangles.forEach((part, index) => { if (part !== parts[index]) part.dispose(); });
    }
  }
  function at(geometry: THREE.BufferGeometry, x: number, y: number, z: number) { return geometry.translate(x, y, z); }
  function rounded(w: number, h: number, d: number, x: number, y: number, z: number) {
    return at(new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * .23), x, y, z);
  }
  const palmParts = [
    at(new THREE.SphereGeometry(1, 12, 8).scale(.0395, .047, .0225), 0, .021, 0),
    at(new THREE.SphereGeometry(1, 10, 6).scale(.026, .031, .023), 0, -.023, 0),
    at(new THREE.SphereGeometry(1, 10, 6).scale(.021, .029, .018), -.024, .012, -.004),
  ];
  for (const x of [-.029, -.010, .010, .028])
    palmParts.push(at(new THREE.SphereGeometry(1, 8, 6).scale(.0115, .021, .017), x, .052, 0));
  const palmGeometry = merge(palmParts);
  // Mirror once in the owned buffer, with matching winding. A negative mesh
  // scale would introduce a separate front-face driver state during first use.
  const leftPalmGeometry = palmGeometry.clone().scale(-1, 1, 1);
  for (const value of Object.values(leftPalmGeometry.attributes)) {
    const attribute = value as THREE.BufferAttribute, array = attribute.array;
    for (let vertex = 0; vertex < attribute.count; vertex += 3) for (let component = 0; component < attribute.itemSize; component++) {
      const a = vertex * attribute.itemSize + component, b = (vertex + 1) * attribute.itemSize + component;
      const temporary = array[a]; array[a] = array[b]; array[b] = temporary;
    }
  }
  const details: THREE.BufferGeometry[] = [
    rounded(.052, .042, .007, 0, .029, .019),
    rounded(.040, .013, .006, 0, -.015, .023),
    at(new THREE.CylinderGeometry(.030, .032, .024, 20), 0, -.045, 0),
  ];
  for (const x of [-.029, -.010, .010, .028]) {
    details.push(rounded(.012, .017, .008, x, .059, .018));
    details.push(rounded(.002, .035, .002, x, .023, .018));
  }
  const detailGeometry = merge(details);
  const sleeveParts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(.033, .058, 1, 12, 1)];
  for (const y of [-.30, -.12, .10, .31]) {
    const radius = .0455 - y * .025;
    const fold = new THREE.TorusGeometry(radius, .0025, 4, 12); fold.rotateX(Math.PI / 2); fold.translate(.002, y, 0); sleeveParts.push(fold);
  }
  const sleeveGeometry = merge(sleeveParts);
  function makeHand(side: 'right' | 'left'): Hand {
    const sign = side === 'right' ? 1 : -1;
    const wrist = new THREE.Group(); wrist.name = `${side}Hand`; root.add(wrist);
    const body = new THREE.Mesh(side === 'right' ? palmGeometry : leftPalmGeometry, cloth); body.name = `${side}GlovePalm`;
    const detail = new THREE.Mesh(detailGeometry, rubber); detail.name = `${side}GloveSeamsAndCuff`;
    wrist.add(body, detail);
    const sleeve = new THREE.Mesh(sleeveGeometry, sleeveMaterial); sleeve.name = `${side}Forearm`; root.add(sleeve);
    const digits: Digit[] = [];
    for (let digit = 0; digit < 5; digit++) {
      const thumb = digit === 4;
      const lengths = thumb ? [.028, .022, .018] : digit === 3 ? [.023, .018, .015] : [.031, .023, .018];
      const joints: THREE.Object3D[] = [];
      for (let segment = 0; segment < 3; segment++) {
        const joint = new THREE.Object3D(); joint.name = `${side}_${thumb ? 'thumb' : ['index', 'middle', 'ring', 'little'][digit]}_${segment}`;
        if (segment === 0) {
          joint.position.set((thumb ? -.043 : [-.029, -.010, .010, .028][digit]) * sign, thumb ? .010 : .064 - (digit === 3 ? .006 : 0), thumb ? -.005 : 0);
          wrist.add(joint);
        } else { joint.position.y = lengths[segment - 1]; joints[segment - 1].add(joint); }
        joints.push(joint);
      }
      digits.push({ joints, lengths, radius: thumb ? .0095 : digit === 3 ? .0072 : .0085, thumb, index: digit === 0, spread: thumb ? sign * .18 : sign * (digit - 1.5) * -.015 });
    }
    return { wrist, sleeve, digits, target: new THREE.Vector3(), orientation: new THREE.Quaternion(), phaseStart: new THREE.Vector3(), phaseRotation: new THREE.Quaternion(), curl: 1 };
  }
  const right = makeHand('right'), left = makeHand('left');
  const hands = [right, left], sides = [['right', right], ['left', left]] as const;
  root.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = false; });

  function setAttachment(hand: Hand, attachment: HandAttachment) {
    hand.target.fromArray(attachment.position);
    hand.orientation.setFromEuler(euler.set(...attachment.rotation));
  }
  function releaseInstances() {
    if (disposed) return; disposed = true; segments.dispose(); pads.dispose();
  }
  root.userData.cleanupWeaponEffect = releaseInstances;
  return {
    root, right: right.wrist, left: left.wrist,
    setFaction(faction: FactionType) {
      cloth.color.setHex(faction === 'apex' ? 0x414c53 : 0x43463b);
      sleeveMaterial.color.setHex(faction === 'apex' ? 0x394b59 : 0x535a45);
    },
    releaseInstances,
    reset() { initialized = false; phase = ''; },
    update(id: WeaponModelId, dt: number, assembly: WeaponAssembly, state: WeaponSlotState | null | undefined, aiming: boolean, sprint?: Readonly<PistolSprintPose>) {
      if (disposed) return;
      const changed = !initialized || selected !== id; selected = id;
      const config = VIEWMODEL_GRIPS[id];
      setAttachment(right, config.right); setAttachment(left, config.left);
      const tracked = config.left.followPart ? assembly.parts[config.left.followPart] : undefined;
      if (tracked && config.left.partOffset) {
        tracked.updateWorldMatrix(true, false); assembly.root.updateWorldMatrix(true, false);
        inverse.copy(assembly.root.matrixWorld).invert(); matrix.multiplyMatrices(inverse, tracked.matrixWorld);
        left.target.fromArray(config.left.partOffset).applyMatrix4(matrix);
      }
      supportGrip.copy(left.target);
      const sequence = state?.reloading ? state.reloadSequence : undefined;
      const stage = sequence?.phases[sequence.index];
      const pistolSprintBlend = id === 'pistol' && !stage ? sprint?.blend ?? 0 : 0;
      const nextPhase = stage?.phase ?? '';
      if (changed) { left.wrist.position.copy(left.target); left.wrist.quaternion.copy(left.orientation); phase = ''; }
      if (phase !== nextPhase) { left.phaseStart.copy(left.wrist.position); left.phaseRotation.copy(left.wrist.quaternion); phase = nextPhase; }
      const p = stage ? THREE.MathUtils.smoothstep(sequence!.elapsed / stage.duration, 0, 1) : 0;
      let curl = config.left.curl;
      let shellGrip = 0, shellPress = 0, brGrip = 0, pistolContact = 0;
      if (stage && id !== 'br' && id !== 'pistol' && id !== 'smg') {
        const part = stage.phase === 'chamber' ? assembly.parts.bolt ?? assembly.parts.slide ?? assembly.parts.pump :
          sequence!.kind === 'vent' ? assembly.parts.feedTray ?? assembly.parts.receiver :
          assembly.parts.magazine ?? assembly.parts.reloadRound ?? assembly.parts.vent ?? assembly.parts.receiver;
        part.updateWorldMatrix(true, false); assembly.root.updateWorldMatrix(true, false);
        inverse.copy(assembly.root.matrixWorld).invert();
        attachmentPosition.setFromMatrixPosition(part.matrixWorld).applyMatrix4(inverse);
        left.target.copy(attachmentPosition).add(end.fromArray(config.reloadReach));
        targetRotation.setFromEuler(euler.set(-Math.PI / 2, -Math.PI / 2, 0));
        left.orientation.copy(targetRotation);
        if (stage.phase === 'open' || stage.phase === 'vent') left.target.lerpVectors(left.phaseStart, left.target, p);
        if (stage.phase === 'close') {
          left.target.lerpVectors(left.phaseStart, supportGrip, p);
          left.orientation.setFromEuler(euler.set(...config.left.rotation));
        }
        curl = stage.phase === 'chamber' ? .65 : stage.phase === 'vent' ? .45 : .8;
        if (tracked && stage.phase === 'chamber') {
          left.target.copy(supportGrip); left.orientation.setFromEuler(euler.set(...config.left.rotation)); curl = config.left.curl;
        }
      }
      const arChamber = id === 'ar' && stage?.phase === 'chamber' && sequence?.empty && config.chamber;
      if (arChamber) {
        const control = assembly.parts[arChamber.followPart!];
        control.updateWorldMatrix(true, false); assembly.root.updateWorldMatrix(true, false);
        inverse.copy(assembly.root.matrixWorld).invert(); matrix.multiplyMatrices(inverse, control.matrixWorld);
        left.target.fromArray(arChamber.partOffset!).applyMatrix4(matrix);
        targetRotation.setFromEuler(euler.set(...arChamber.rotation));
        const progress = sequence!.elapsed / stage!.duration;
        left.orientation.slerpQuaternions(left.phaseRotation, targetRotation, arChamberReach(progress));
        left.target.lerpVectors(left.phaseStart, left.target, arChamberReach(progress));
        left.target.lerp(supportGrip, arChamberRelease(progress));
        targetRotation.setFromEuler(euler.set(...config.left.rotation));
        left.orientation.slerp(targetRotation, arChamberRelease(progress));
        curl = arChamber.curl;
      }
      if (id === 'sniper') {
        if (state?.sniperCycle && config.chamber) {
          const control = assembly.parts.bolt, attachment = config.chamber;
          control.updateWorldMatrix(true, false); assembly.root.updateWorldMatrix(true, false);
          inverse.copy(assembly.root.matrixWorld).invert(); matrix.multiplyMatrices(inverse, control.matrixWorld);
          attachmentPosition.fromArray(attachment.partOffset!).applyMatrix4(matrix);
          const reach = sniperHandReach(state.sniperCycle.elapsed);
          left.target.lerpVectors(supportGrip, attachmentPosition, reach);
          targetRotation.setFromEuler(euler.set(...attachment.rotation));
          // The grip rotates with the actual handle, including unlocking/locking.
          targetRotation.premultiply(control.quaternion);
          left.orientation.slerp(targetRotation, reach); curl = attachment.curl;
        } else if (stage) {
          const t = sequence!.elapsed / stage.duration;
          if (stage.phase === 'open') {
            left.target.lerpVectors(supportGrip, left.target, sniperEase(t));
            targetRotation.setFromEuler(euler.set(...config.left.rotation));
            left.orientation.slerpQuaternions(targetRotation, left.orientation, sniperEase(t));
          } else if (stage.phase === 'close') {
            left.target.lerpVectors(left.phaseStart, supportGrip, sniperEase(t));
            targetRotation.setFromEuler(euler.set(...config.left.rotation));
            left.orientation.slerpQuaternions(left.phaseRotation, targetRotation, sniperEase(t));
          }
          curl = .9;
        }
      }
      if (id === 'br' && stage && config.magazineGrip) {
        const t = sequence!.elapsed / stage.duration;
        const attachment = stage.phase === 'chamber' ? config.chamber! : config.magazineGrip;
        const usingFresh = ['insert','chamber','close'].includes(stage.phase);
        const part = stage.phase === 'chamber' ? assembly.parts.bolt : usingFresh ? assembly.parts.freshMagazine : assembly.parts.magazine;
        part.updateWorldMatrix(true,false); assembly.root.updateWorldMatrix(true,false);
        inverse.copy(assembly.root.matrixWorld).invert(); matrix.multiplyMatrices(inverse,part.matrixWorld);
        attachmentPosition.fromArray(attachment.partOffset ?? attachment.position).applyMatrix4(matrix);
        left.target.copy(attachmentPosition); targetRotation.setFromEuler(euler.set(...attachment.rotation)); left.orientation.copy(targetRotation);
        brGrip = 1; curl = attachment.curl;
        if (stage.phase === 'open') {
          left.target.lerpVectors(supportGrip,attachmentPosition,brEase(t));
          left.orientation.setFromEuler(euler.set(...config.left.rotation));left.orientation.slerp(targetRotation,brEase(t));brGrip=brEase(t);
        } else if (stage.phase === 'pickup') {
          const fresh=assembly.parts.freshMagazine;
          fresh.updateWorldMatrix(true,false);matrix.multiplyMatrices(inverse,fresh.matrixWorld);
          attachmentPosition.fromArray(attachment.position).applyMatrix4(matrix);
          left.target.lerp(attachmentPosition,brEase((t-.40)/.25));
          curl = .65 + .30 * Math.abs(2*t-1);
        } else if (stage.phase === 'chamber') {
          const reach=brEase(t/.18),release=brEase((t-.84)/.16);
          left.target.lerpVectors(left.phaseStart,left.target,reach);left.target.lerp(left.phaseStart,release);
          left.orientation.slerpQuaternions(left.phaseRotation,targetRotation,reach);
          left.orientation.slerp(left.phaseRotation,release);brGrip=0;
        } else if (stage.phase === 'close') {
          const recover=brEase((t-.30)/.70);
          left.target.lerpVectors(left.phaseStart,supportGrip,recover);
          targetRotation.setFromEuler(euler.set(...config.left.rotation));left.orientation.slerpQuaternions(left.phaseRotation,targetRotation,recover);brGrip=1-recover;
        }
      }
      if (id === 'shotgun' && config.shellLoad) {
        const load = config.shellLoad;
        left.orientation.setFromEuler(euler.set(...config.left.rotation));
        if (stage?.phase === 'open') {
          const t = sequence!.elapsed / stage.duration;
          attachmentPosition.set(-.024, -.090, -.040);
          left.target.lerpVectors(supportGrip, attachmentPosition, shotgunEase(t / .40));
          left.target.lerp(shotgunPickup, shotgunEase((t - .40) / .60));
          targetRotation.setFromEuler(euler.set(...load.grip.rotation));
          shellGrip = shotgunEase(t / .75);
          left.orientation.slerp(targetRotation, shellGrip); curl = .85;
        } else if (stage?.phase === 'insert') {
          const t = sequence!.elapsed / stage.duration;
          const press = shotgunEase((t - .52) / (SHOTGUN.seat - .52));
          const release = shotgunEase((t - .80) / .20);
          shotgunShellPose(Math.min(t, SHOTGUN.seat), shellPose);
          left.target.set(shellPose.x, shellPose.y, shellPose.z).add(attachmentPosition.fromArray(load.grip.position));
          // Fingers stay outside the narrow port. The opposed thumb guides the
          // last rise/forward press instead of driving the whole palm inside.
          left.target.lerp(attachmentPosition.fromArray(load.press.position), press);
          if (t >= .52) left.target.y = Math.min(left.target.y, load.press.position[1]);
          left.orientation.setFromEuler(euler.set(...load.grip.rotation));
          targetRotation.setFromEuler(euler.set(...load.press.rotation)); left.orientation.slerp(targetRotation, press);
          const last = sequence!.shellsRemaining === 1;
          left.target.lerp(last ? supportGrip : shotgunPickup, release);
          targetRotation.setFromEuler(euler.set(...(last ? config.left.rotation : load.grip.rotation))); left.orientation.slerp(targetRotation, release);
          shellGrip = last ? 1 - release : 1; shellPress = press * (1 - release); curl = 1;
        } else if (stage?.phase === 'chamber' || stage?.phase === 'close') {
          // Start from the hand that actually ended the prior phase, including
          // the last shell reset. Never snap back to the pickup position.
          const reach = stage.phase === 'chamber' ? shotgunEase(sequence!.elapsed / (stage.duration * SHOTGUN.recovery / SHOTGUN.cycle)) : p;
          left.target.lerpVectors(left.phaseStart, supportGrip, reach);
          targetRotation.setFromEuler(euler.set(...config.left.rotation));left.orientation.slerpQuaternions(left.phaseRotation,targetRotation,reach);
          curl = config.left.curl;
        } else {
          left.target.copy(supportGrip);
          if (state?.shotgunCycle?.kind === 'chamber') left.target.lerpVectors(left.phaseStart, supportGrip, shotgunEase(state.shotgunCycle.elapsed / (state.shotgunCycle.duration * SHOTGUN.recovery / SHOTGUN.cycle)));
        }
      }
      if (id === 'smg' && stage) {
        const t=sequence!.elapsed/stage.duration, old=assembly.parts.magazine, fresh=assembly.parts.freshMagazine;
        const part=stage.phase==='open'||stage.phase==='eject'||(stage.phase==='insert'&&t<smgSwap)?old:fresh;
        part.updateMatrix();
        attachmentPosition.fromArray(SMG.magazineGrip).applyMatrix4(part.matrix);
        targetRotation.setFromEuler(euler.set(...SMG.magazineRotation)).premultiply(part.quaternion);
        left.target.copy(attachmentPosition);left.orientation.copy(targetRotation);curl=.95;
        if(stage.phase==='open') {
          const reach=smgEase(t);
          left.target.lerpVectors(supportGrip,attachmentPosition,reach);
          left.orientation.setFromEuler(euler.set(...config.left.rotation));left.orientation.slerp(targetRotation,reach);
        } else if(stage.phase==='chamber') {
          // Start from the fully seated magazine, or the forward grip when
          // resuming a chamber-only interruption. Transform through the real
          // receiver hierarchy, including any future parent orientation.
          if(!sequence!.phases.some(s=>s.phase==='insert'))left.target.copy(supportGrip);
          const control=assembly.parts.bolt;
          control.updateWorldMatrix(true,false);assembly.root.updateWorldMatrix(true,false);
          inverse.copy(assembly.root.matrixWorld).invert();matrix.multiplyMatrices(inverse,control.matrixWorld);
          attachmentPosition.fromArray(SMG.chargingGrip).applyMatrix4(matrix);
          const reach=smgReach(t);left.target.lerp(attachmentPosition,reach);
          targetRotation.setFromEuler(euler.set(...SMG.chargingRotation)).premultiply(control.quaternion);
          left.orientation.slerp(targetRotation,reach);curl=.8;
        } else if(stage.phase==='close') {
          if(sequence!.empty) {
            const control=assembly.parts.bolt;
            control.updateWorldMatrix(true,false);assembly.root.updateWorldMatrix(true,false);
            inverse.copy(assembly.root.matrixWorld).invert();matrix.multiplyMatrices(inverse,control.matrixWorld);
            left.target.fromArray(SMG.chargingGrip).applyMatrix4(matrix);
            left.orientation.setFromEuler(euler.set(...SMG.chargingRotation)).premultiply(control.quaternion);
          }
          const recover=smgEase(t);
          left.target.lerp(supportGrip,recover);
          targetRotation.setFromEuler(euler.set(...config.left.rotation));left.orientation.slerp(targetRotation,recover);
          curl=.8+(config.left.curl-.8)*recover;
        }
      }
      if (id === 'pistol') {
        left.target.copy(supportGrip); left.orientation.setFromEuler(euler.set(...config.left.rotation));
        if (stage) {
          const t = sequence!.elapsed / stage.duration;
          const old = assembly.parts.magazine, fresh = assembly.parts.freshMagazine;
          const part = stage.phase === 'eject' || (stage.phase === 'insert' && t < pistolPickup(sequence!.empty).appear - .005) ? old : fresh;
          part.updateMatrix();
          attachmentPosition.fromArray(PISTOL.magazineGrip).applyMatrix4(part.matrix);
          targetRotation.setFromEuler(euler.set(...PISTOL.magazineRotation)).premultiply(part.quaternion);
          left.target.copy(attachmentPosition); left.orientation.copy(targetRotation);
          pistolContact = 1; curl = .95;
          if (stage.phase === 'eject') {
            const reach = pistolEase(t / .20);
            left.target.lerpVectors(left.phaseStart, attachmentPosition, reach);
            left.orientation.slerpQuaternions(left.phaseRotation, targetRotation, reach);
            pistolContact = reach;
          } else if (stage.phase === 'chamber') {
            // Thumb reaches the actual slide-release paddle. The slide return
            // follows the same normalized phase, after the mag transfer.
            const reach = pistolEase(t / .16);
            left.target.lerp(attachmentPosition.fromArray(PISTOL.releaseGrip), reach);
            targetRotation.setFromEuler(euler.set(...PISTOL.releaseRotation)); left.orientation.slerp(targetRotation, reach);
            pistolContact = 1 - reach;
          } else if (stage.phase === 'close') {
            if (sequence!.empty) { left.target.fromArray(PISTOL.releaseGrip); left.orientation.setFromEuler(euler.set(...PISTOL.releaseRotation)); }
            const recover = pistolEase(t);
            left.target.lerp(supportGrip, recover);
            targetRotation.setFromEuler(euler.set(...config.left.rotation)); left.orientation.slerp(targetRotation, recover);
            pistolContact = 1 - recover; curl = config.left.curl;
          }
        } else if (pistolSprintBlend > 1e-5) {
          assembly.root.updateMatrix(); inverse.copy(assembly.root.matrix).invert();
          attachmentPosition.copy(sprint!.left.wrist); targetRotation.copy(sprint!.left.rotation);
          attachmentPosition.applyMatrix4(inverse);
          // Remove the weapon carry rotation from the camera-space free wrist.
          targetRotation.premultiply(inverseWeaponRotation.copy(assembly.root.quaternion).invert());
          left.target.lerp(attachmentPosition, pistolSprintBlend);
          left.orientation.slerp(targetRotation, pistolSprintBlend); curl = 1.05;
        }
      }
      const alpha = changed || dt === 0 ? 1 : 1 - Math.exp(-24 * dt);
      right.wrist.position.copy(right.target); right.wrist.quaternion.copy(right.orientation);
      // AR control contact is authored against the current moving part, without
      // an exponential lag that would leave fingers behind the charging latch.
      left.wrist.position.lerp(left.target, arChamber || id === 'smg' || id === 'shotgun' || id === 'sniper' || id === 'br' || (id === 'pistol' && (!!stage || pistolSprintBlend > 1e-5)) ? 1 : alpha);
      left.wrist.quaternion.slerp(left.orientation, arChamber || id === 'smg' || id === 'shotgun' || id === 'sniper' || id === 'br' || (id === 'pistol' && (!!stage || pistolSprintBlend > 1e-5)) ? 1 : alpha);
      // Solve the sleeve from its posed cuff toward a camera-local torso bend.
      // Receiver tilt must not rotate a cut-off sleeve end into the viewport.
      assembly.root.updateMatrix(); inverse.copy(assembly.root.matrix).invert();
      for (const [side, hand] of sides) {
        const attachment = config[side];
        const targetCurl = side === 'left' ? curl : attachment.curl;
        hand.curl += (targetCurl - hand.curl) * alpha;
        end.set(0, -.047, 0).applyQuaternion(hand.wrist.quaternion).add(hand.wrist.position);
        // Bend toward a local torso target rather than reaching across the screen.
        // The camera-space cuff supplies a floor for the elbow drop and bend.
        attachmentPosition.copy(end).applyMatrix4(assembly.root.matrix);
        elbow.fromArray(config.elbows[side]);
        elbow.x = THREE.MathUtils.clamp(elbow.x, attachmentPosition.x - .12, attachmentPosition.x + .12);
        elbow.y = Math.min(elbow.y, attachmentPosition.y - .30);
        elbow.z = Math.min(-.14, Math.max(elbow.z, attachmentPosition.z + .22));
        if (pistolSprintBlend > 0) elbow.lerp(sprint![side].elbow, pistolSprintBlend);
        elbow.applyMatrix4(inverse);
        // A distant body target determines direction, never cylinder length.
        // Keep a bounded forearm while its broad end tucks down toward the torso.
        direction.copy(elbow).sub(end);
        direction.setLength(Math.min(config.sleeveLength, direction.length()));
        elbow.copy(end).add(direction);
        hand.sleeve.position.copy(elbow).add(end).multiplyScalar(.5);
        direction.copy(end).sub(elbow); hand.sleeve.scale.set(1, direction.length() + .012, 1);
        hand.sleeve.quaternion.setFromUnitVectors(up, direction.normalize());
        for (const digit of hand.digits) for (let segment = 0; segment < 3; segment++) {
          let angle = (digit.thumb ? attachment.thumbAngles ?? thumbAngles : digit.index && side === 'right' && attachment.triggerFinger !== false ? triggerAngles : attachment.fingerAngles ?? gripAngles)[segment];
          if (side === 'left' && config.magazineGrip && brGrip > 0) {
            const gripAngle=(digit.thumb ? config.magazineGrip.thumbAngles! : config.magazineGrip.fingerAngles!)[segment];
            angle += (gripAngle-angle)*brGrip;
          }
          if (side === 'left' && config.shellLoad && shellGrip > 0) {
            const load = config.shellLoad, gripAngle = (digit.thumb ? load.grip.thumbAngles! : load.grip.fingerAngles!)[segment];
            const pressAngle = (digit.thumb ? load.press.thumbAngles! : load.press.fingerAngles!)[segment];
            angle += (gripAngle + (pressAngle - gripAngle) * shellPress - angle) * shellGrip;
          }
          if (side === 'left' && pistolContact > 0) {
            const contactAngle = (digit.thumb ? pistolThumbAngles : pistolFingerAngles)[segment];
            angle += (contactAngle - angle) * pistolContact;
          }
          if (side === 'left' && pistolSprintBlend > 0) {
            const runningAngle = (digit.thumb ? runningThumbAngles : runningFingerAngles)[segment];
            angle += (runningAngle - angle) * pistolSprintBlend;
          }
          digit.joints[segment].rotation.set(-angle * (hand.curl + (aiming ? .025 : 0)), 0, segment === 0 ? digit.spread : 0);
          if (side === 'left' && pistolSprintBlend > 0 && digit.thumb && segment === 0) {
            digit.joints[segment].rotation.y = -.35 * pistolSprintBlend;
            digit.joints[segment].rotation.z += .30 * pistolSprintBlend;
          }
          if (side === 'left' && config.magazineGrip && brGrip > 0 && digit.thumb && segment === 0) {
            digit.joints[segment].rotation.z += (config.magazineGrip.thumbOpposition ?? 0)*brGrip;
            digit.joints[segment].rotation.y = -.25*brGrip;
          }
          if (side === 'left' && config.shellLoad && digit.thumb && segment === 0) {
            digit.joints[segment].rotation.y = -.65 * shellGrip;
            const load = config.shellLoad;
            digit.joints[segment].rotation.z += (load.grip.thumbOpposition! + (load.press.thumbOpposition! - load.grip.thumbOpposition!) * shellPress) * shellGrip;
          }
        }
      }
      root.updateWorldMatrix(true, true); inverse.copy(root.matrixWorld).invert();
      let instance = 0;
      for (const hand of hands) for (const digit of hand.digits) for (let segment = 0; segment < 3; segment++) {
        const joint = digit.joints[segment], length = digit.lengths[segment];
        matrix.multiplyMatrices(inverse, joint.matrixWorld);
        scratch.position.set(0, length * .5, 0); scratch.quaternion.identity(); scratch.scale.set(digit.radius * 2, (length + .007) * .5, digit.radius * 2); scratch.updateMatrix();
        segments.setMatrixAt(instance, instanceTransform.multiplyMatrices(matrix, scratch.matrix));
        scratch.position.set(0, length * .53, digit.radius * .85); scratch.scale.set(digit.radius * 1.65, length * .307, digit.radius * .26); scratch.updateMatrix();
        pads.setMatrixAt(instance++, matrix.multiply(scratch.matrix));
      }
      segments.instanceMatrix.needsUpdate = pads.instanceMatrix.needsUpdate = true;
      initialized = true;
    },
  };
}
