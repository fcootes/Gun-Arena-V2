import * as THREE from 'three';
import { WeaponDef, WeaponSlotState, ARSENAL } from './types';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createWeaponAssembly, orientHeldWeapon, type WeaponAssembly } from './weaponModels';
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
  triggerShotgunPump: () => void;
  triggerSmgBoltFire: () => void;
  setRailgunChargeProgress: (progress: number) => void;
  setMinigunSpin: (deltaAngle: number, isVenting: boolean) => void;
  addRecoil: (kick: number, rotX: number) => void;
  triggerKnifeSlash: () => void;
  triggerRadioTransmit?: (isHold: boolean) => void;
  triggerMuzzleFlash: (id?: string) => void;
  getMuzzlePosition: (target: THREE.Vector3) => THREE.Vector3;
  resetEffects: () => void;
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
      hands: THREE.Group;
    }
  >();
  let selected: ReturnType<typeof getModel> | null = null;
  let currentId = 'ar',
    recoil = 0,
    recoilRotation = 0,
    time = 0,
    bob = 0;
  let slideTimer = 0,
    pumpTimer = 0,
    boltTimer = 0,
    charge = 0,
    spin = 0,
    venting = false,
    radioTimer = 0,
    radioHold = false;
  const gloveMaterial = new THREE.MeshStandardMaterial({
    color: 0x20282b,
    roughness: 0.88,
  });
  const sleeveMaterial = new THREE.MeshStandardMaterial({
    color: 0x303a30,
    roughness: 0.94,
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
    const assembly = createWeaponAssembly(id),
      effects = createWeaponMuzzleEffect(assembly),
      hands = new THREE.Group();
    hands.name = 'GlovedHands';
    orientHeldWeapon(assembly, 'negative-z');
    addBox(hands, 0.05, 0.065, 0.075, 0.018, -0.095, 0.09, gloveMaterial);
    addBox(
      hands,
      0.07,
      0.07,
      0.22,
      0.053,
      -0.14,
      0.235,
      sleeveMaterial,
    ).rotation.x = 0.24;
    if (id !== 'pistol') {
      addBox(hands, 0.051, 0.047, 0.083, -0.01, -0.055, -0.24, gloveMaterial);
      addBox(
        hands,
        0.065,
        0.07,
        0.2,
        -0.07,
        -0.12,
        -0.14,
        sleeveMaterial,
      ).rotation.z = -0.45;
    }
    assembly.root.add(hands);
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
    model = { assembly, effects, pose, hands };
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
    const w =
      typeof slotOrWeapon === 'number'
        ? (WEAPONS[slotOrWeapon] ?? WEAPONS[0])
        : slotOrWeapon;
    const ws = Array.isArray(states)
      ? states[typeof slotOrWeapon === 'number' ? slotOrWeapon : 0]
      : states;
    root.visible = alive && playing;
    time += dt;
    bob += dt * (sprinting ? 14 : 9.5);
    slideTimer = Math.max(0, slideTimer - dt);
    pumpTimer = Math.max(0, pumpTimer - dt);
    boltTimer = Math.max(0, boltTimer - dt);
    radioTimer = Math.max(0, radioTimer - dt);
    recoil = Math.max(0, recoil - dt * 0.55);
    recoilRotation = Math.max(0, recoilRotation - dt * 3.8);
    currentId = w.id;
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
    if (!selected) return;
    const { assembly, pose, hands } = selected,
      parts = assembly.parts;
    for (const [part, transform] of pose) {
      part.position.copy(transform.position);
      if (part !== parts.rotor) part.quaternion.copy(transform.quaternion);
      part.visible = true;
    }
    const scoped = aiming && !!w.scoped;
    parts.receiver.visible = !scoped;
    hands.visible = !scoped;
    const walk = moving && onGround ? 1 : 0;
    assembly.root.position.set(
      aiming ? 0 : 0.18,
      aiming ? -0.1 : -0.2,
      -0.36 + recoil,
    );
    assembly.root.position.x += Math.cos(bob * 0.5) * 0.008 * walk;
    assembly.root.position.y +=
      Math.abs(Math.sin(bob)) * 0.012 * walk + Math.sin(time * 1.5) * 0.002;
    assembly.root.rotation.set(recoilRotation, 0, sprinting ? -0.15 : 0);
    if (ws?.reloading && (ws.totalReloadT ?? 0) > 0) {
      const p = THREE.MathUtils.clamp(
          1 - (ws.reloadT ?? 0) / ws.totalReloadT!,
          0,
          1,
        ),
        heave = Math.sin(p * Math.PI);
      assembly.root.rotation.z = -heave * 0.24;
      assembly.root.position.y += heave * 0.035;
      if (parts.magazine) {
        const offset = p < 0.45 ? p / 0.45 : (1 - p) / 0.55;
        parts.magazine.position.y -= Math.sin((offset * Math.PI) / 2) * 0.27;
        parts.magazine.visible = p < 0.4 || p > 0.55;
      }
      if (parts.feedTray) parts.feedTray.rotation.x = heave * 1.0;
      if (parts.bolt)
        parts.bolt.position.z +=
          Math.sin(Math.max(0, (p - 0.65) / 0.35) * Math.PI) * 0.045;
      if (parts.pump) parts.pump.position.z += heave * 0.075;
      if (w.id === 'grenade_launcher' && parts.magazine) {
        parts.magazine.position.x += heave * 0.1;
        parts.magazine.rotation.z = (heave * Math.PI) / 3;
      }
    } else {
      if (parts.slide)
        parts.slide.position.z +=
          Math.sin((slideTimer / 0.12) * Math.PI) * 0.045;
      if (parts.bolt)
        parts.bolt.position.z += Math.sin((boltTimer / 0.07) * Math.PI) * 0.025;
      if (parts.pump)
        parts.pump.position.z += Math.sin((pumpTimer / 0.42) * Math.PI) * 0.075;
    }
    assembly.update(dt, charge, spin);
    spin = 0;
    if (venting) assembly.root.rotation.z += Math.sin(time * 16) * 0.014;
  }
  return {
    root,
    update,
    triggerPistolSlideFire() {
      slideTimer = 0.12;
    },
    triggerShotgunPump() {
      pumpTimer = 0.42;
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
      const model = getModel(id);
      model.effects.trigger();
    },
    getMuzzlePosition(target) {
      const model = selected ?? getModel(currentId);
      root.updateWorldMatrix(true, true);
      return model.assembly.muzzle.getWorldPosition(target);
    },
    resetEffects() {
      models.forEach((model) => model.effects.reset());
    },
  };
}
