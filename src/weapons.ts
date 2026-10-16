import * as THREE from 'three';
import { WeaponDef, WeaponSlotState, ARSENAL } from './types';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createWeaponAssembly, orientHeldWeapon, disposeWeaponObject, type WeaponAssembly, type WeaponModelId } from './weaponModels';
import { createFirstPersonHands } from './viewmodelHands';
import { VIEWMODEL_GRIPS, arChargingStroke } from './viewmodelGrips';
import { SHOTGUN, shotgunEase, shotgunPumpStroke, shotgunShellPose } from './shotgunMechanics';
import type { FactionType } from './lobbyAvatar';
import {
  createWeaponMuzzleEffect,
  type WeaponMuzzleEffect,
} from './weaponEffects';

export const WEAPONS: WeaponDef[] = [
  {
    id: 'ar',
    name: 'ASSAULT RIFLE',
    type: 'weapon',
    damage: 20,
    headshotMult: 2.2,
    pellets: 1,
    spread: 0.016,
    adsSpread: 0.006,
    fireRate: 0.11,
    mag: 30,
    reserve: 150,
    reloadTime: 3.1,
    range: 170,
    auto: true,
    adsFov: 55,
    scoped: false,
    kick: 0.018,
  },
  {
    id: 'shotgun',
    name: 'PUMP SHOTGUN',
    type: 'weapon',
    damage: 9.5,
    headshotMult: 1.8,
    pellets: 9,
    spread: 0.095,
    adsSpread: 0.075,
    fireRate: 0.85,
    mag: 6,
    reserve: 36,
    reloadTime: 2.1,
    range: 38,
    auto: false,
    adsFov: 62,
    scoped: false,
    kick: 0.05,
  },
  {
    id: 'sniper',
    name: 'HEAVY SNIPER',
    type: 'weapon',
    damage: 70,
    headshotMult: 3.5,
    pellets: 1,
    spread: 0.006,
    adsSpread: 0.0006,
    fireRate: 1.45,
    mag: 5,
    reserve: 20,
    reloadTime: 2.7,
    range: 420,
    auto: false,
    adsFov: 14,
    scoped: true,
    kick: 0.09,
  },
  {
    id: 'pistol',
    name: 'COMBAT PISTOL',
    type: 'weapon',
    damage: 28,
    headshotMult: 2.0,
    pellets: 1,
    spread: 0.022,
    adsSpread: 0.008,
    fireRate: 0.22,
    mag: 15,
    reserve: 60,
    reloadTime: 1.9,
    range: 95,
    auto: false,
    adsFov: 60,
    scoped: false,
    kick: 0.024,
  },
  {
    id: 'smg',
    name: 'SUBMACHINE GUN',
    type: 'weapon',
    damage: 15,
    headshotMult: 1.85,
    pellets: 1,
    spread: 0.036,
    adsSpread: 0.016,
    fireRate: 0.072, // Rapid full-auto fire
    mag: 32,
    reserve: 192,
    reloadTime: 1.8,
    range: 85,
    auto: true,
    adsFov: 62,
    scoped: false,
    kick: 0.042, // Heavy vertical recoil kick
  },
  {
    id: 'lmg',
    name: 'HEAVY LMG',
    type: 'weapon',
    damage: 24,
    headshotMult: 2.0,
    pellets: 1,
    spread: 0.026,
    adsSpread: 0.012,
    fireRate: 0.115,
    mag: 100, // Massive 100-round drum capacity
    reserve: 300,
    reloadTime: 4.2, // Heavy, deliberate reload
    range: 160,
    auto: true,
    adsFov: 56,
    scoped: false,
    kick: 0.026,
  },
  {
    id: 'br',
    name: 'BATTLE RIFLE',
    type: 'weapon',
    damage: 28,
    headshotMult: 2.2,
    pellets: 1,
    spread: 0.012,
    adsSpread: 0.003,
    fireRate: 0.42, // Cooldown break between bursts
    burst: true,
    burstCount: 3, // 3-round burst
    burstRate: 0.075,
    mag: 36,
    reserve: 180,
    reloadTime: 1.2,
    range: 220,
    auto: false,
    adsFov: 38, // Slight zoom-in scope optic view
    scoped: true,
    kick: 0.016,
  },
  {
    id: 'laser',
    name: 'PLASMA RIFLE',
    type: 'weapon',
    damage: 5,
    headshotMult: 1.7,
    pellets: 1,
    spread: 0.008,
    adsSpread: 0.003,
    fireRate: 0.055, // Continuous high-frequency plasma beam
    isLaser: true,
    mag: 100,
    reserve: 100,
    reloadTime: 2.0, // Venting duration
    range: 130,
    auto: true,
    adsFov: 58,
    scoped: false,
    kick: 0.006,
  },
  {
    id: 'minigun',
    name: 'HEAVY MINIGUN',
    type: 'weapon',
    damage: 16,
    headshotMult: 1.8,
    pellets: 1,
    spread: 0.034,
    adsSpread: 0.024,
    fireRate: 0.045, // Hyper-fast full-auto fire rate
    isMinigun: true,
    mag: 999, // Continuous belt-fed
    reserve: 999,
    reloadTime: 2.0, // 2-second mandatory cooling phase
    range: 160,
    auto: true,
    adsFov: 60,
    scoped: false,
    kick: 0.012,
  },
  {
    id: 'railgun',
    name: 'TACTICAL RAILGUN',
    type: 'weapon',
    damage: 160, // Massive high-damage single slug
    headshotMult: 2.5,
    pellets: 1,
    spread: 0.001,
    adsSpread: 0.0001,
    fireRate: 1.3,
    isRailgun: true,
    mag: 1,
    reserve: 30,
    reloadTime: 1.4,
    range: 500,
    auto: false,
    adsFov: 32, // Halo tactical zoom
    scoped: false,
    kick: 0.12,
  },
  ...(['RPG7_ROCKET', 'M32_GRENADE'] as const).map((id) => {
    const def = ARSENAL[id];
    return { ...def, id: def.legacyId, type: 'weapon' as const, arsenalId: id };
  }),
  {
    id: 'grenade',
    name: 'TACTICAL GRENADE',
    type: 'grenade',
    count: 3,
    maxCount: 6,
    damage: 125,
    radius: 7.5,
    fireRate: 0.75,
    auto: false,
    adsFov: 70,
    scoped: false,
    kick: 0.03,
  },
  {
    id: 'mini',
    name: 'MINI SHIELD (x3)',
    type: 'consumable',
    count: 3,
    maxCount: 6,
    healAmount: 25,
    maxHealCap: 50,
    useTime: 2.0,
    auto: false,
    adsFov: 70,
    scoped: false,
    kick: 0,
  },
  {
    id: 'medkit',
    name: 'TACTICAL HEAL (x2)',
    type: 'consumable',
    count: 2,
    maxCount: 2,
    healAmount: 50,
    maxHealCap: 100,
    useTime: 3.0,
    auto: false,
    adsFov: 70,
    scoped: false,
    kick: 0,
  },
  {
    id: 'radio',
    name: 'TACTICAL RADIO',
    type: 'gadget',
    count: 1,
    maxCount: 1,
    auto: false,
    adsFov: 65,
    scoped: false,
    kick: 0,
  },
];

export interface ViewmodelManager {
  root: THREE.Group;
  prepare: (ids: readonly string[]) => void;
  update: (
    dt: number,
    slotOrWeapon: number | WeaponDef,
    weaponStatesOrWs: WeaponSlotState[] | WeaponSlotState | null | undefined,
    playerAiming: boolean,
    playerSprinting: boolean,
    playerOnGround: boolean,
    isMoving: boolean,
    isMeleeing: boolean,
    isDrinking: boolean,
    drinkTimer: number,
    isAlive: boolean,
    isPlaying: boolean,
  ) => void;
  triggerPistolSlideFire: () => void;
  triggerSmgBoltFire: () => void;
  setRailgunChargeProgress: (progress: number) => void;
  setMinigunSpin: (deltaAngle: number, isVenting: boolean) => void;
  addRecoil: (kick: number, rotX: number) => void;
  triggerKnifeSlash: () => void;
  triggerRadioTransmit?: (isHold: boolean) => void;
  triggerMuzzleFlash: (id?: string) => void;
  getMuzzlePosition: (target: THREE.Vector3) => THREE.Vector3;
  resetEffects: () => void;
  setFaction: (faction: FactionType) => void;
  dispose: () => void;
}

export function createViewmodelManager(): ViewmodelManager {
  const root = new THREE.Group();
  root.name = 'FirstPersonWeapons';
  const models = new Map<
    string,
    {
      assembly: WeaponAssembly;
      effects: WeaponMuzzleEffect;
      pose: Map<
        THREE.Object3D,
        { position: THREE.Vector3; quaternion: THREE.Quaternion }
      >;
    }
  >();
  let selected: ReturnType<typeof getModel> | null = null;
  let currentId = 'ar',
    recoil = 0,
    recoilRotation = 0,
    time = 0,
    bob = 0;
  let slideTimer = 0,
    boltTimer = 0,
    charge = 0,
    spin = 0,
    venting = false,
    radioTimer = 0,
    radioHold = false;
  const shellPose = { x: 0, y: 0, z: 0, angle: 0 };
  const reloadRotation = new THREE.Quaternion(), reloadEuler = new THREE.Euler(), reloadPosition = new THREE.Vector3();
  const hands = createFirstPersonHands(); hands.root.visible = false; root.add(hands.root);
  const viewPosition = new THREE.Vector3(), targetPosition = new THREE.Vector3();
  const viewRotation = new THREE.Quaternion(), targetRotation = new THREE.Quaternion(), targetEuler = new THREE.Euler();
  let poseInitialized = false, previousId = '', walkBlend = 0, runBlend = 0, equip = 0, disposed = false;
  root.userData.cleanupWeaponEffect = () => { disposed = true; hands.releaseInstances(); models.clear(); selected = null; };
  const gloveMaterial = new THREE.MeshStandardMaterial({
    color: 0x20282b,
    roughness: 0.88,
  });
  const utilityMaterial = new THREE.MeshStandardMaterial({
    color: 0x34424b,
    metalness: 0.5,
    roughness: 0.65,
  });
  const utility = new THREE.Group();
  root.add(utility);
  const knife = new THREE.Group(),
    radio = new THREE.Group(),
    kit = new THREE.Group(),
    grenade = new THREE.Group();
  const addBox = (
    parent: THREE.Group,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.12),
      material,
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9c4c9,
    metalness: 0.97,
    roughness: 0.18,
  });
  addBox(knife, 0.012, 0.035, 0.22, 0, 0, -0.11, bladeMaterial);
  addBox(knife, 0.03, 0.04, 0.11, 0, 0, 0.045, gloveMaterial);
  addBox(knife, 0.012, 0.065, 0.01, 0, 0, -0.01, utilityMaterial);
  addBox(radio, 0.073, 0.14, 0.04, 0, 0, 0, utilityMaterial);
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: 0x12332a,
    emissive: 0x33c697,
    emissiveIntensity: 0.6,
  });
  addBox(radio, 0.055, 0.037, 0.003, 0, 0.022, -0.022, screenMaterial);
  addBox(radio, 0.006, 0.18, 0.006, -0.026, 0.15, 0, gloveMaterial);
  for (let i = 0; i < 8; i++)
    addBox(
      radio,
      0.043,
      0.003,
      0.003,
      0,
      -0.021 - i * 0.006,
      -0.023,
      gloveMaterial,
    );
  addBox(kit, 0.14, 0.1, 0.07, 0, 0, 0, utilityMaterial);
  const crossMaterial = new THREE.MeshStandardMaterial({ color: 0xdcded9 });
  addBox(kit, 0.065, 0.013, 0.002, 0, 0, -0.037, crossMaterial);
  addBox(kit, 0.013, 0.065, 0.002, 0, 0, -0.038, crossMaterial);
  const grenadeBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.049, 14, 12),
    utilityMaterial,
  );
  grenadeBody.scale.y = 1.2;
  grenade.add(grenadeBody);
  addBox(grenade, 0.009, 0.09, 0.008, 0.02, 0.04, 0, bladeMaterial);
  const pin = new THREE.Mesh(
    new THREE.TorusGeometry(0.013, 0.002, 6, 16),
    bladeMaterial,
  );
  pin.position.set(-0.02, 0.065, 0);
  grenade.add(pin);
  utility.add(knife, radio, kit, grenade);
  function getModel(id: string) {
    let model = models.get(id);
    if (model) return model;
    const assembly = createWeaponAssembly(id, { firstPerson: true }),
      effects = createWeaponMuzzleEffect(assembly);
    orientHeldWeapon(assembly, 'negative-z');
    root.add(assembly.root);
    assembly.root.visible = false;
    const pose = new Map<
      THREE.Object3D,
      { position: THREE.Vector3; quaternion: THREE.Quaternion }
    >();
    Object.values(assembly.parts).forEach((part) =>
      pose.set(part, {
        position: part.position.clone(),
        quaternion: part.quaternion.clone(),
      }),
    );
    model = { assembly, effects, pose };
    models.set(id, model);
    return model;
  }
  function update(
    dt: number,
    slotOrWeapon: number | WeaponDef,
    states: WeaponSlotState[] | WeaponSlotState | null | undefined,
    aiming: boolean,
    sprinting: boolean,
    onGround: boolean,
    moving: boolean,
    melee: boolean,
    drinking: boolean,
    drinkTimer: number,
    alive: boolean,
    playing: boolean,
  ) {
    if (disposed) return;
    if (!alive) { root.visible = false; return; }
    if (!playing) return; // Pausing freezes pose, joints, timers and recoil.
    dt = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .1) : 0;
    const w =
      typeof slotOrWeapon === 'number'
        ? (WEAPONS[slotOrWeapon] ?? WEAPONS[0])
        : slotOrWeapon;
    const ws = Array.isArray(states)
      ? states[typeof slotOrWeapon === 'number' ? slotOrWeapon : 0]
      : states;
    root.visible = true;
    time += dt;
    bob += dt * (sprinting ? 14 : 9.5);
    slideTimer = Math.max(0, slideTimer - dt);
    boltTimer = Math.max(0, boltTimer - dt);
    radioTimer = Math.max(0, radioTimer - dt);
    recoil = Math.max(0, recoil - dt * 0.55);
    recoilRotation = Math.max(0, recoilRotation - dt * 3.8);
    currentId = w.id;
    if (w.id !== 'minigun') venting = false;
    selected = w.type === 'weapon' ? getModel(w.id) : null;
    for (const [id, model] of models) {
      model.assembly.root.visible = id === w.id && !melee && radioTimer === 0;
      model.effects.update(dt);
    }
    utility.visible = !selected || melee || radioTimer > 0;
    knife.visible = melee;
    radio.visible = radioTimer > 0 && !melee;
    kit.visible = drinking || w.type === 'consumable';
    grenade.visible = w.type === 'grenade' && !melee && !drinking;
    utility.position.set(0.16, -0.2, -0.43);
    utility.rotation.set(0, 0, 0);
    if (melee) {
      utility.position.x = 0.35 * Math.sin(time * 12);
      utility.rotation.z = Math.sin(time * 12) * 0.9;
    }
    if (drinking) {
      utility.position.set(
        0.03,
        -0.06 + Math.sin(drinkTimer * 6) * 0.015,
        -0.32,
      );
      utility.rotation.z = 0.3;
    }
    if (radioTimer > 0) {
      utility.position.set(-0.16, -0.06, -0.35);
      screenMaterial.emissiveIntensity = radioHold ? 1.9 : 1.2;
    }
    if (!selected) { hands.root.visible = false; previousId = w.id; return; }
    const { assembly, pose } = selected,
      parts = assembly.parts;
    if (hands.root.parent !== assembly.root) assembly.root.add(hands.root);
    for (const [part, transform] of pose) {
      part.position.copy(transform.position);
      if (part !== parts.rotor) part.quaternion.copy(transform.quaternion);
      part.visible = true;
    }
    const scoped = aiming && !!w.scoped;
    parts.receiver.visible = !scoped;
    // The shouldered stock sits behind the eye in first person. Drawing it at
    // the camera near plane obscures the hands; actor/studio stocks stay intact.
    if (parts.stock) parts.stock.visible = false;
    hands.root.visible = !scoped;
    const grip = VIEWMODEL_GRIPS[w.id as WeaponModelId];
    const alpha = 1 - Math.exp(-14 * dt);
    targetPosition.fromArray(aiming ? grip.aim : sprinting ? grip.sprint : grip.hip);
    if (aiming) targetEuler.set(...grip.aimRotation);
    else if (sprinting) targetEuler.set(...grip.sprintRotation);
    else targetEuler.set(0, 0, 0);
    targetRotation.setFromEuler(targetEuler);
    if (!poseInitialized) { viewPosition.copy(targetPosition); viewRotation.copy(targetRotation); poseInitialized = true; }
    else { viewPosition.lerp(targetPosition, alpha); viewRotation.slerp(targetRotation, alpha); }
    if (previousId && previousId !== w.id) equip = 1;
    previousId = w.id; equip *= Math.exp(-18 * dt);
    walkBlend += ((moving && onGround ? 1 : 0) - walkBlend) * (1 - Math.exp(-12 * dt));
    runBlend += ((sprinting && !aiming && moving && onGround ? 1 : 0) - runBlend) * (1 - Math.exp(-12 * dt));
    const walk = walkBlend * (aiming ? .18 : 1) * (1 - runBlend);
    assembly.root.position.copy(viewPosition);
    assembly.root.position.z += recoil + equip * .025;
    assembly.root.position.y -= equip * .06;
    assembly.root.position.x += Math.cos(bob * 0.5) * 0.008 * walk + Math.sin(bob * .5) * .0045 * runBlend;
    assembly.root.position.y +=
      Math.abs(Math.sin(bob)) * 0.012 * walk + Math.cos(bob) * .003 * runBlend + Math.sin(time * 1.5) * 0.002;
    assembly.root.quaternion.copy(viewRotation); assembly.root.rotation.x += recoilRotation;
    assembly.root.rotation.z += Math.sin(bob * .5) * .004 * runBlend;
    if (parts.reloadRound) parts.reloadRound.visible = false;
    const sequence = ws?.reloadSequence;
    if (ws?.reloading && sequence) {
      const phase = sequence.phases[sequence.index];
      const p = THREE.MathUtils.smoothstep(sequence.elapsed / phase.duration, 0, 1);
      const progress = 1 - (ws.reloadT ?? 0) / (ws.totalReloadT || 1);
      const lift = w.id === 'shotgun' ? phase.phase === 'open' ? p : phase.phase === 'close' ? 1 - p : 1 : Math.min(1, progress * 7, (1 - progress) * 7);
      reloadRotation.setFromEuler(w.id === 'shotgun' ? reloadEuler.set(-.06, .08, -.52) : reloadEuler.set(.14, -.18, -.38));
      assembly.root.quaternion.slerp(reloadRotation, lift);
      reloadPosition.copy(assembly.root.position); reloadPosition.x += w.id === 'shotgun' ? .07 : -.02; reloadPosition.y += w.id === 'shotgun' ? .06 : .05; reloadPosition.z += w.id === 'shotgun' ? -.025 : .025;
      assembly.root.position.lerp(reloadPosition, lift);
      const removed = phase.phase === 'eject' ? p : phase.phase === 'insert' ? 1 - p : 0;
      if (parts.magazine && sequence.kind !== 'shell') {
        const base = pose.get(parts.magazine)!;
        reloadPosition.copy(base.position); reloadPosition.x += sequence.kind === 'cylinder' ? .15 : -.035; reloadPosition.y -= .25; reloadPosition.z += .025;
        parts.magazine.position.lerpVectors(base.position, reloadPosition, removed);
        reloadRotation.setFromEuler(reloadEuler.set(0, 0, sequence.kind === 'cylinder' ? .85 : -.18));
        parts.magazine.quaternion.slerp(reloadRotation, removed);
      }
      const opened = phase.phase === 'open' ? p : phase.phase === 'close' ? 1 - p : 1;
      if (parts.feedTray) { reloadRotation.setFromEuler(reloadEuler.set(-.9, 0, 0)); parts.feedTray.quaternion.slerp(reloadRotation, opened); }
      if (parts.vent) { reloadRotation.setFromEuler(reloadEuler.set(0, 0, -.95)); parts.vent.quaternion.slerp(reloadRotation, phase.phase === 'close' ? 1-p : opened); }
      if (phase.phase === 'chamber' && sequence.empty) {
        const pull = Math.sin(p * Math.PI);
        if (parts.bolt) parts.bolt.position.z += w.id === 'ar' ? arChargingStroke(sequence.elapsed / phase.duration) : pull * (w.id === 'br' ? .07 : .045);
        if (parts.slide) parts.slide.position.z += pull * .048;
        if (parts.pump) parts.pump.position.z += w.id === 'shotgun' ? shotgunPumpStroke(sequence.elapsed, phase.duration) : pull * .08;
      }
      if (w.id === 'shotgun' && phase.phase === 'insert' && parts.reloadRound) {
        const t = sequence.elapsed / phase.duration;
        shotgunShellPose(t, shellPose);
        parts.reloadRound.position.set(shellPose.x, shellPose.y, shellPose.z);
        parts.reloadRound.rotation.x = shellPose.angle;
        parts.reloadRound.visible = t >= .10 && !sequence.shellSeated;
        // A short receiver response to firm seating, not a camera kick.
        assembly.root.position.y += .004 * Math.sin(Math.PI * Math.max(0, Math.min(1, (t - .68) / .13)));
      } else if (parts.reloadRound && phase.phase === 'insert') {
        const base = pose.get(parts.reloadRound)!;
        reloadPosition.copy(base.position); reloadPosition.x -= .15; reloadPosition.y -= .12; reloadPosition.z += w.id === 'rocket' ? -.2 : .08;
        parts.reloadRound.position.lerpVectors(reloadPosition, base.position, p);
        parts.reloadRound.visible = p < .92;
      }
    } else {
      if (parts.slide) parts.slide.position.z += Math.sin((slideTimer / .12) * Math.PI) * .045;
      if (parts.bolt) parts.bolt.position.z += Math.sin((boltTimer / .07) * Math.PI) * .025;
      if (w.id === 'shotgun' && ws?.shotgunCycle && parts.pump) {
        const cycle = ws.shotgunCycle, t = cycle.elapsed * SHOTGUN.cycle / cycle.duration;
        parts.pump.position.z += shotgunPumpStroke(cycle.elapsed, cycle.duration);
        if (cycle.kind === 'fire') {
          const mass = t < .035 ? shotgunEase(t / .035) : Math.pow(1 - shotgunEase((t - .035) / .25), 1.3);
          assembly.root.position.z += mass * .038;
          assembly.root.rotation.x += mass * .070;
        }
        const rearStop = Math.max(0, 1 - Math.abs(t - (SHOTGUN.rearEnd + SHOTGUN.rearStop * .5)) / (SHOTGUN.rearStop + .01));
        const lock = t >= SHOTGUN.pumpEnd ? Math.sin((t - SHOTGUN.pumpEnd) / SHOTGUN.settle * Math.PI) * Math.exp(-(t - SHOTGUN.pumpEnd) * 28) : 0;
        assembly.root.position.z += rearStop * .0035 - lock * .002;
        assembly.root.rotation.x += rearStop * .008 - lock * .004;
      }
      if (w.id === 'sniper' && (ws?.boltCycleT ?? 0) > 0 && parts.bolt) {
        const p = 1 - ws!.boltCycleT! / .85;
        parts.bolt.position.z += Math.sin(p * Math.PI) * .085;
        reloadRotation.setFromEuler(reloadEuler.set(0, 0, Math.sin(p * Math.PI) * .9));
        parts.bolt.quaternion.slerp(reloadRotation, 1);
      }
    }
    assembly.update(dt, charge, spin);
    spin = 0;
    if (venting) assembly.root.rotation.z += Math.sin(time * 16) * 0.014;
    hands.update(w.id as WeaponModelId, dt, assembly, ws, aiming);
  }
  return {
    root,
    update,
    prepare(ids: readonly string[]) { if (!disposed) ids.forEach(id => getModel(id)); },
    setFaction(faction) { hands.setFaction(faction); },
    dispose() { if (!disposed) disposeWeaponObject(root); },
    triggerPistolSlideFire() {
      slideTimer = 0.12;
    },

    triggerSmgBoltFire() {
      boltTimer = 0.07;
    },
    setRailgunChargeProgress(value) {
      charge = THREE.MathUtils.clamp(value, 0, 1);
    },
    setMinigunSpin(value, isVenting) {
      spin += value;
      venting = isVenting;
    },
    addRecoil(kick, rotation) {
      recoil = Math.max(recoil, kick);
      recoilRotation = Math.max(recoilRotation, rotation);
    },
    triggerKnifeSlash() {
      time = 0;
    },
    triggerRadioTransmit(hold) {
      radioTimer = 0.38;
      radioHold = hold;
    },
    triggerMuzzleFlash(id = currentId) {
      if (disposed) return;
      const model = getModel(id);
      model.effects.trigger();
    },
    getMuzzlePosition(target) {
      if (disposed) return target.set(0, 0, 0);
      const model = selected ?? getModel(currentId);
      root.updateWorldMatrix(true, true);
      return model.assembly.muzzle.getWorldPosition(target);
    },
    resetEffects() {
      models.forEach((model) => model.effects.reset());
      recoil = recoilRotation = slideTimer = boltTimer = equip = walkBlend = runBlend = time = bob = 0;
      charge = spin = radioTimer = 0; venting = radioHold = false;
      poseInitialized = false; previousId = '';
    },
  };
}
