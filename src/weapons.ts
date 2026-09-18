import * as THREE from 'three';
import { WeaponDef, WeaponSlotState } from './types';

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
    kick: 0.018
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
    kick: 0.05
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
    kick: 0.09
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
    kick: 0.024
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
    kick: 0.042 // Heavy vertical recoil kick
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
    kick: 0.026
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
    kick: 0.016
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
    kick: 0.006
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
    kick: 0.012
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
    kick: 0.12
  },
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
    kick: 0.03
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
    kick: 0
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
    kick: 0
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
    kick: 0
  }
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
    isPlaying: boolean
  ) => void;
  triggerPistolSlideFire: () => void;
  triggerShotgunPump: () => void;
  triggerSmgBoltFire: () => void;
  setRailgunChargeProgress: (progress: number) => void;
  setMinigunSpin: (deltaAngle: number, isVenting: boolean) => void;
  addRecoil: (kick: number, rotX: number) => void;
  triggerKnifeSlash: () => void;
  triggerRadioTransmit?: (isHold: boolean) => void;
}

export function createViewmodelManager(): ViewmodelManager {
  const root = new THREE.Group();

  // Common shared materials
  const vmMatMetalDark = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.45, metalness: 0.75 });
  const vmMatMetalGrey = new THREE.MeshStandardMaterial({ color: 0x3d4248, roughness: 0.5, metalness: 0.65 });
  const vmMatMetalAccent = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.6, metalness: 0.4 });
  const vmMatSlideSilver = new THREE.MeshStandardMaterial({ color: 0x484d54, roughness: 0.38, metalness: 0.85 });
  const vmMatWood = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.85 });
  const vmMatSniperGreen = new THREE.MeshStandardMaterial({ color: 0x2e352b, roughness: 0.6, metalness: 0.5 });
  const vmMatSniperScope = new THREE.MeshStandardMaterial({ color: 0x111314, roughness: 0.35, metalness: 0.85 });
  const vmMatGrenadeBody = new THREE.MeshStandardMaterial({ color: 0x2f3d2a, roughness: 0.7, metalness: 0.3 });
  
  // New Weapon Special Materials
  const vmMatSmgReceiver = new THREE.MeshStandardMaterial({ color: 0x292d32, roughness: 0.48, metalness: 0.7 });
  const vmMatSmgOrange = new THREE.MeshStandardMaterial({ color: 0xd66820, roughness: 0.6, metalness: 0.2 });
  const vmMatLmgDark = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.55, metalness: 0.8 });
  const vmMatBrFrame = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.42, metalness: 0.75 });
  const vmMatOpticGlass = new THREE.MeshStandardMaterial({
    color: 0x2de2e6,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
    emissive: 0x095258,
    emissiveIntensity: 0.8
  });

  // Covenant-style alien purple & glowing materials
  const vmMatCovenantPurple = new THREE.MeshStandardMaterial({
    color: 0x6e259e,
    roughness: 0.28,
    metalness: 0.82
  });
  const vmMatCovenantDark = new THREE.MeshStandardMaterial({
    color: 0x1b1428,
    roughness: 0.38,
    metalness: 0.9
  });
  const vmMatCovenantGlow = new THREE.MeshStandardMaterial({
    color: 0x3ae2ff,
    roughness: 0.15,
    emissive: 0x1ca2db,
    emissiveIntensity: 1.6
  });
  const vmMatVentHeat = new THREE.MeshStandardMaterial({
    color: 0xff6622,
    roughness: 0.2,
    emissive: 0xff3300,
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0.9
  });

  const vmMatPotionGlass = new THREE.MeshStandardMaterial({
    color: 0x5cdbf0,
    transparent: true,
    opacity: 0.78,
    roughness: 0.15,
    metalness: 0.1,
    emissive: 0x168ba0,
    emissiveIntensity: 0.55
  });
  const vmMatPotionLiquid = new THREE.MeshStandardMaterial({
    color: 0x26c0e8,
    transparent: true,
    opacity: 0.88,
    roughness: 0.2,
    emissive: 0x1da5c9,
    emissiveIntensity: 0.75
  });
  const vmMatCork = new THREE.MeshStandardMaterial({ color: 0x7c5432, roughness: 0.95 });

  // 1. Assault Rifle (Slot 0)
  const arVmGroup = new THREE.Group();
  const arBodyGroup = new THREE.Group();
  const arMagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.06), vmMatMetalAccent);
  arMagMesh.position.set(0, -0.09, -0.04);
  arMagMesh.rotation.x = -0.2;

  const arBoltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, 0.045), vmMatMetalGrey);
  arBoltMesh.position.set(0.024, 0.036, -0.02);

  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.075, 0.32), vmMatMetalDark);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.3), vmMatMetalGrey);
    barrel.position.set(0, 0.014, -0.28);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.05, 0.18), vmMatMetalAccent);
    handguard.position.set(0, 0.012, -0.2);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.045), vmMatMetalAccent);
    grip.position.set(0, -0.08, 0.1);
    grip.rotation.x = 0.34;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.07, 0.16), vmMatMetalDark);
    stock.position.set(0, -0.01, 0.22);
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.26), vmMatMetalGrey);
    topRail.position.set(0, 0.044, -0.03);

    arBodyGroup.add(body, barrel, handguard, grip, stock, topRail, arBoltMesh);
    arVmGroup.add(arBodyGroup, arMagMesh);
  }

  // 2. Pump Shotgun (Slot 1)
  const shotgunVmGroup = new THREE.Group();
  const shotgunBodyGroup = new THREE.Group();
  const shotgunPumpMesh = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.06, 0.14), vmMatWood);
  shotgunPumpMesh.position.set(0, -0.018, -0.22);

  {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.26), vmMatMetalDark);
    const thickBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.34), vmMatMetalGrey);
    thickBarrel.position.set(0, 0.022, -0.28);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.3), vmMatMetalAccent);
    tube.position.set(0, -0.02, -0.26);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.085, 0.24), vmMatWood);
    stock.position.set(0, -0.035, 0.22);
    stock.rotation.x = -0.08;

    shotgunBodyGroup.add(receiver, thickBarrel, tube, stock, shotgunPumpMesh);
    shotgunVmGroup.add(shotgunBodyGroup);
  }

  // 3. Heavy Sniper (Slot 2)
  const sniperVmGroup = new THREE.Group();
  const sniperBodyGroup = new THREE.Group();
  const sniperMagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.08, 0.07), vmMatMetalAccent);
  sniperMagMesh.position.set(0, -0.07, -0.04);

  const sniperBoltGroup = new THREE.Group();
  sniperBoltGroup.position.set(0.024, 0.04, 0.05);
  {
    const boltShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.038, 8), vmMatMetalGrey);
    boltShaft.rotation.z = -Math.PI / 3;
    boltShaft.position.set(0.015, 0.008, 0);
    const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), vmMatMetalDark);
    boltKnob.position.set(0.031, 0.016, 0);
    sniperBoltGroup.add(boltShaft, boltKnob);
  }

  {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.08, 0.44), vmMatSniperGreen);
    const longBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.52), vmMatMetalDark);
    longBarrel.position.set(0, 0.018, -0.45);
    const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.07), vmMatMetalAccent);
    muzzleBrake.position.set(0, 0.018, -0.72);
    const scopeMountF = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.032, 0.018), vmMatMetalAccent);
    scopeMountF.position.set(0, 0.054, -0.09);
    const scopeMountR = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.032, 0.018), vmMatMetalAccent);
    scopeMountR.position.set(0, 0.054, 0.05);
    const boxScope = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.24), vmMatSniperScope);
    boxScope.position.set(0, 0.08, -0.02);
    const scopeBellF = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.045), vmMatMetalAccent);
    scopeBellF.position.set(0, 0.08, -0.14);
    const scopeBellR = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.045), vmMatMetalAccent);
    scopeBellR.position.set(0, 0.08, 0.1);
    const buttStock = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.085, 0.24), vmMatSniperGreen);
    buttStock.position.set(0, -0.02, 0.31);

    sniperBodyGroup.add(chassis, longBarrel, muzzleBrake, scopeMountF, scopeMountR, boxScope, scopeBellF, scopeBellR, buttStock);
    sniperVmGroup.add(sniperBodyGroup, sniperMagMesh, sniperBoltGroup);
  }

  // 4. Combat Pistol (Slot 3) - FIXED MESH ALIGNMENT (Slide & Mag inside BodyGroup)
  const pistolVmGroup = new THREE.Group();
  const pistolBodyGroup = new THREE.Group();

  // Lower frame & receiver
  const pistolFrame = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.19), vmMatMetalDark);
  pistolFrame.position.set(0, 0.01, -0.02);

  // Pistol handle/grip (angled back at 0.22 rad)
  const pistolHandle = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.12, 0.05), vmMatMetalAccent);
  pistolHandle.position.set(0, -0.065, 0.045);
  pistolHandle.rotation.x = 0.22;

  // Trigger guard & trigger
  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.032, 0.055), vmMatMetalDark);
  triggerGuard.position.set(0, -0.022, 0.01);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.012), vmMatMetalGrey);
  trigger.position.set(0, -0.02, 0.012);
  trigger.rotation.x = -0.3;

  // Barrel inner cylinder
  const pistolBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 12), vmMatMetalGrey);
  pistolBarrel.rotation.x = Math.PI / 2;
  pistolBarrel.position.set(0, 0.03, -0.05);

  // Top Slide Mesh Group - child of pistolBodyGroup so it shares all body rotations perfectly!
  const pistolSlideGroup = new THREE.Group();
  pistolSlideGroup.position.set(0, 0.032, -0.02);

  const slideMain = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.19), vmMatSlideSilver);
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.01, 0.008), vmMatMetalAccent);
  frontSight.position.set(0, 0.022, -0.085);
  const rearSightL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.008), vmMatMetalAccent);
  rearSightL.position.set(-0.01, 0.022, 0.085);
  const rearSightR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.008), vmMatMetalAccent);
  rearSightR.position.set(0.01, 0.022, 0.085);
  pistolSlideGroup.add(slideMain, frontSight, rearSightL, rearSightR);

  // Magazine Group - child of pistolBodyGroup
  const pistolMagGroup = new THREE.Group();
  pistolMagGroup.position.set(0, -0.065, 0.045);
  pistolMagGroup.rotation.x = 0.22;

  const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.118, 0.038), vmMatMetalGrey);
  const magBasePlate = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.014, 0.046), vmMatMetalAccent);
  magBasePlate.position.set(0, -0.062, 0);
  pistolMagGroup.add(magBody, magBasePlate);

  // Add all pistol sub-components into pistolBodyGroup
  pistolBodyGroup.add(pistolFrame, pistolHandle, triggerGuard, trigger, pistolBarrel, pistolSlideGroup, pistolMagGroup);
  pistolVmGroup.add(pistolBodyGroup);

  // 5. Submachine Gun (SMG) (Slot 4)
  // Compact rectangular box model with a vertical magazine stick extending down
  const smgVmGroup = new THREE.Group();
  const smgBodyGroup = new THREE.Group();

  const smgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.072, 0.24), vmMatSmgReceiver);
  const smgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.12, 10), vmMatMetalGrey);
  smgBarrel.rotation.x = Math.PI / 2;
  smgBarrel.position.set(0, 0.014, -0.17);
  const smgMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.035), vmMatMetalAccent);
  smgMuzzle.position.set(0, 0.014, -0.23);
  const smgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.10, 0.042), vmMatMetalAccent);
  smgGrip.position.set(0, -0.075, 0.07);
  smgGrip.rotation.x = 0.28;
  const smgTopRail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.20), vmMatMetalDark);
  smgTopRail.position.set(0, 0.042, -0.02);
  const smgStripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.01, 0.08), vmMatSmgOrange);
  smgStripe.position.set(0, 0.02, 0.04);

  // Long vertical magazine stick extending straight down
  const smgMagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.17, 0.036), vmMatMetalAccent);
  smgMagMesh.position.set(0, -0.10, -0.03);

  // Small side-bolt release block
  const smgBoltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.032), vmMatMetalGrey);
  smgBoltMesh.position.set(0.026, 0.024, 0.02);

  smgBodyGroup.add(smgReceiver, smgBarrel, smgMuzzle, smgGrip, smgTopRail, smgStripe, smgBoltMesh, smgMagMesh);
  smgVmGroup.add(smgBodyGroup);

  // 6. Heavy Light Machine Gun (LMG) (Slot 5)
  // Massive stretched heavy metal chassis with bulky cylinder drum magazine box underneath
  const lmgVmGroup = new THREE.Group();
  const lmgBodyGroup = new THREE.Group();

  const lmgChassis = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.105, 0.44), vmMatLmgDark);
  const lmgBarrelShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 12), vmMatMetalGrey);
  lmgBarrelShroud.rotation.x = Math.PI / 2;
  lmgBarrelShroud.position.set(0, 0.02, -0.36);
  const lmgMuzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.044, 0.06), vmMatMetalDark);
  lmgMuzzleBrake.position.set(0, 0.02, -0.54);
  const lmgStock = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.095, 0.22), vmMatMetalDark);
  lmgStock.position.set(0, -0.015, 0.32);
  const lmgCarryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.038, 0.18), vmMatMetalAccent);
  lmgCarryHandle.position.set(0, 0.075, -0.06);
  const lmgRearSight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.02), vmMatMetalAccent);
  lmgRearSight.position.set(0, 0.065, 0.14);

  // Charging lever box sub-component on the side
  const lmgCockingHandle = new THREE.Group();
  lmgCockingHandle.position.set(0.038, 0.044, 0.02);
  const lmgLeverBlock = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.042), vmMatMetalGrey);
  const lmgLeverKnob = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.016, 0.02), vmMatMetalAccent);
  lmgLeverKnob.position.set(0.012, 0, 0);
  lmgCockingHandle.add(lmgLeverBlock, lmgLeverKnob);

  // Independent lower AMMO DRUM BOX sub-component attached underneath receiver
  const lmgDrumGroup = new THREE.Group();
  lmgDrumGroup.position.set(0, -0.115, 0.01);

  const lmgDrumBox = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.088, 0.12), vmMatLmgDark);
  const lmgDrumCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.084, 16), vmMatMetalDark);
  lmgDrumCylinder.rotation.z = Math.PI / 2;
  const lmgDrumLatch = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.045, 0.058), vmMatMetalAccent);
  lmgDrumLatch.position.set(0, 0.045, 0);
  const lmgDrumBaseRib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.014, 0.124), vmMatMetalAccent);
  lmgDrumBaseRib.position.set(0, -0.046, 0);
  lmgDrumGroup.add(lmgDrumBox, lmgDrumCylinder, lmgDrumLatch, lmgDrumBaseRib);

  lmgBodyGroup.add(lmgChassis, lmgBarrelShroud, lmgMuzzleBrake, lmgStock, lmgCarryHandle, lmgRearSight, lmgCockingHandle, lmgDrumGroup);
  lmgVmGroup.add(lmgBodyGroup);

  // 7. Battle Rifle / FAMAS (Slot 6)
  // Sleek geometric bullpup rifle frame with top-mounted optic box structure and rear curved mag
  const brVmGroup = new THREE.Group();
  const brBodyGroup = new THREE.Group();

  const brChassis = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.084, 0.40), vmMatBrFrame);
  const brBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.22), vmMatMetalGrey);
  brBarrel.position.set(0, 0.014, -0.27);
  const brMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.045), vmMatMetalAccent);
  brMuzzle.position.set(0, 0.014, -0.39);
  const brForwardGrip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.10, 0.045), vmMatMetalAccent);
  brForwardGrip.position.set(0, -0.075, -0.06);
  brForwardGrip.rotation.x = 0.2;

  // Integrated carry handle & top-mounted optic box structure
  const brOpticRiser = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.045, 0.26), vmMatMetalDark);
  brOpticRiser.position.set(0, 0.062, -0.04);
  const brOpticBox = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.034, 0.13), vmMatSniperScope);
  brOpticBox.position.set(0, 0.092, -0.04);
  const brOpticLens = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.008), vmMatOpticGlass);
  brOpticLens.position.set(0, 0.092, 0.026);

  // Top charging lever block sub-component along top rail
  const brChargingHandle = new THREE.Group();
  brChargingHandle.position.set(0.025, 0.064, -0.11);
  const brLeverBlock = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.022, 0.038), vmMatMetalGrey);
  const brLeverKnob = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.020), vmMatMetalAccent);
  brLeverKnob.position.set(0.012, 0, 0);
  brChargingHandle.add(brLeverBlock, brLeverKnob);

  // Independent curved MAGAZINE BOX at the very back of the stock (behind pistol grip)
  const brMagGroup = new THREE.Group();
  brMagGroup.position.set(0, 0.0, 0.15);
  brMagGroup.rotation.x = -0.18;

  const brMagBox = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.13, 0.058), vmMatBrFrame);
  brMagBox.position.set(0, -0.075, 0);
  const brMagBase = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.018, 0.066), vmMatMetalDark);
  brMagBase.position.set(0, -0.141, 0.004);
  const brMagRib = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.018, 0.060), vmMatMetalAccent);
  brMagRib.position.set(0, -0.095, 0.002);
  const brMagFeed = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.048), vmMatMetalGrey);
  brMagFeed.position.set(0, -0.013, -0.004);
  brMagGroup.add(brMagBox, brMagBase, brMagRib, brMagFeed);

  brBodyGroup.add(brChassis, brBarrel, brMuzzle, brForwardGrip, brOpticRiser, brOpticBox, brOpticLens, brChargingHandle, brMagGroup);
  brVmGroup.add(brBodyGroup);

  // 8. Covenant-Style Laser Gun (Slot 7)
  // Unique, curved purple geometric block assembly with glowing battery and cooling vent door
  const laserVmGroup = new THREE.Group();
  const laserBodyGroup = new THREE.Group();

  // Curved alien geometric carapace
  const laserUpperFront = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.062, 0.18), vmMatCovenantPurple);
  laserUpperFront.position.set(0, 0.02, -0.10);
  laserUpperFront.rotation.x = 0.14;

  const laserUpperRear = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.075, 0.22), vmMatCovenantPurple);
  laserUpperRear.position.set(0, 0.025, 0.08);
  laserUpperRear.rotation.x = -0.16;

  const laserLowerChassis = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.048, 0.32), vmMatCovenantDark);
  laserLowerChassis.position.set(0, -0.02, -0.02);

  const laserGrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.11, 0.048), vmMatCovenantDark);
  laserGrip.position.set(0, -0.08, 0.06);
  laserGrip.rotation.x = 0.28;

  // Dual plasma emitter prongs at front
  const prongL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.028, 0.12), vmMatCovenantDark);
  prongL.position.set(-0.022, 0.005, -0.24);
  const prongR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.028, 0.12), vmMatCovenantDark);
  prongR.position.set(0.022, 0.005, -0.24);
  const laserEmitterCore = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), vmMatCovenantGlow);
  laserEmitterCore.position.set(0, 0.005, -0.22);

  // Upper cooling vent door block (hinged to swing open on 'R')
  const laserVentDoorGroup = new THREE.Group();
  laserVentDoorGroup.position.set(0, 0.058, 0.01);
  const laserVentDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.014, 0.12), vmMatCovenantDark);
  laserVentDoorMesh.position.set(0, 0.007, 0.05);
  laserVentDoorGroup.add(laserVentDoorMesh);

  // Inner GLOWING BATTERY CELL block
  const laserBatteryMesh = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.032, 0.10), vmMatCovenantGlow);
  laserBatteryMesh.position.set(0, 0.035, 0.03);

  // Thermal steam / heat glow indicator
  const laserVentSteamMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.024, 0.08), vmMatVentHeat);
  laserVentSteamMesh.position.set(0, 0.055, 0.03);
  laserVentSteamMesh.visible = false;

  laserBodyGroup.add(
    laserUpperFront,
    laserUpperRear,
    laserLowerChassis,
    laserGrip,
    prongL,
    prongR,
    laserEmitterCore,
    laserBatteryMesh,
    laserVentDoorGroup,
    laserVentSteamMesh
  );
  laserVmGroup.add(laserBodyGroup);

  // 9. Heavy Minigun (Slot 8 / Key 9)
  // Wide, elongated dark grey cylinder cluster mesh occupying lower right corner
  const minigunVmGroup = new THREE.Group();
  const minigunBodyGroup = new THREE.Group();
  const minigunBarrelCluster = new THREE.Group();

  const vmMatMinigunDark = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.52, metalness: 0.85 });
  const vmMatMinigunGunmetal = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.42, metalness: 0.9 });
  const vmMatMinigunRings = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.6, metalness: 0.7 });
  const vmMatMinigunSteam = new THREE.MeshStandardMaterial({
    color: 0xffd000,
    emissive: 0xffa000,
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0.85,
    roughness: 0.3
  });

  // Main motor / housing block
  const minigunMotorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.28), vmMatMinigunDark);
  minigunMotorHousing.position.set(0, 0, 0.04);

  // Top heavy carry handle / bracket
  const minigunHandleMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.065, 0.22), vmMatMinigunRings);
  minigunHandleMount.position.set(0, 0.095, 0.04);
  const minigunTopGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.16), vmMatMetalAccent);
  minigunTopGrip.position.set(0, 0.13, 0.04);

  // Left ammo belt feed box
  const minigunAmmoChute = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.14), vmMatMinigunGunmetal);
  minigunAmmoChute.position.set(-0.085, -0.01, 0.06);

  // Rear dual spade grip assembly
  const minigunSpadeBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.026, 0.028), vmMatMinigunRings);
  minigunSpadeBar.position.set(0, 0.02, 0.19);
  const minigunGripL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.11, 0.03), vmMatMetalAccent);
  minigunGripL.position.set(-0.08, -0.02, 0.19);
  const minigunGripR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.11, 0.03), vmMatMetalAccent);
  minigunGripR.position.set(0.08, -0.02, 0.19);

  // Overheat Steam Vents on top/sides
  const minigunVentMesh1 = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), vmMatMinigunSteam);
  minigunVentMesh1.position.set(-0.03, 0.08, -0.04);
  const minigunVentMesh2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), vmMatMinigunSteam);
  minigunVentMesh2.position.set(0, 0.09, -0.01);
  const minigunVentMesh3 = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), vmMatMinigunSteam);
  minigunVentMesh3.position.set(0.03, 0.08, -0.04);
  minigunVentMesh1.visible = false;
  minigunVentMesh2.visible = false;
  minigunVentMesh3.visible = false;

  minigunBodyGroup.add(
    minigunMotorHousing,
    minigunHandleMount,
    minigunTopGrip,
    minigunAmmoChute,
    minigunSpadeBar,
    minigunGripL,
    minigunGripR,
    minigunVentMesh1,
    minigunVentMesh2,
    minigunVentMesh3
  );

  // Rotating 6-Barrel Cluster
  minigunBarrelCluster.position.set(0, -0.005, -0.10);
  const minigunCentralAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8), vmMatMinigunRings);
  minigunCentralAxle.rotation.x = Math.PI / 2;
  minigunCentralAxle.position.set(0, 0, -0.22);
  minigunBarrelCluster.add(minigunCentralAxle);

  const barrelRadius = 0.044;
  for (let i = 0; i < 6; i++) {
    const angle = i * (Math.PI * 2 / 6);
    const bx = Math.cos(angle) * barrelRadius;
    const by = Math.sin(angle) * barrelRadius;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.48, 8), vmMatMinigunGunmetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(bx, by, -0.22);
    minigunBarrelCluster.add(barrel);
  }

  // Stabilization Rings along barrels
  const minigunFrontRing = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.022, 16), vmMatMinigunRings);
  minigunFrontRing.rotation.x = Math.PI / 2;
  minigunFrontRing.position.set(0, 0, -0.42);

  const minigunMidRing = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.022, 16), vmMatMinigunRings);
  minigunMidRing.rotation.x = Math.PI / 2;
  minigunMidRing.position.set(0, 0, -0.24);

  const minigunRearRing = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.035, 16), vmMatMinigunRings);
  minigunRearRing.rotation.x = Math.PI / 2;
  minigunRearRing.position.set(0, 0, -0.04);

  minigunBarrelCluster.add(minigunFrontRing, minigunMidRing, minigunRearRing);
  minigunVmGroup.add(minigunBodyGroup, minigunBarrelCluster);

  // 10. Tactical Railgun (Halo-Inspired) (Slot 9 / Key 0)
  // 10. Tactical Railgun (Slot 0)
  // Rugged industrial magnetic accelerator chassis with central break-open hinge assembly and glowing core power cell
  const railgunVmGroup = new THREE.Group();
  const railgunBodyGroup = new THREE.Group();

  const vmMatRailgunTitanium = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.45, metalness: 0.88 });
  const vmMatRailgunCarbon = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.65, metalness: 0.65 });
  const vmMatRailgunCoil = new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.48, metalness: 0.85 });
  const vmMatRailgunNeon = new THREE.MeshStandardMaterial({
    color: 0x22252a,
    emissive: 0x000000,
    roughness: 0.55,
    metalness: 0.85
  });
  const vmMatRailgunCoreNeon = new THREE.MeshStandardMaterial({
    color: 0x1a1d22,
    emissive: 0x000000,
    roughness: 0.52,
    metalness: 0.82
  });
  const vmMatRailgunLens = new THREE.MeshStandardMaterial({
    color: 0x16191f,
    transparent: true,
    opacity: 0.9,
    emissive: 0x000000,
    roughness: 0.25,
    metalness: 0.9
  });

  // Stock, rear receiver, and grip fixed to the rear chassis
  const railgunStock = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.095, 0.22), vmMatRailgunCarbon);
  railgunStock.position.set(0, -0.015, 0.28);

  const railgunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.048), vmMatRailgunCarbon);
  railgunGrip.position.set(0, -0.08, 0.10);
  railgunGrip.rotation.x = 0.28;

  const railgunRearChassis = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.088, 0.14), vmMatRailgunTitanium);
  railgunRearChassis.position.set(0, 0, 0.14);

  // Central Hinge Pivot pin
  const railgunHingePin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.052, 12), vmMatRailgunCoil);
  railgunHingePin.rotation.z = Math.PI / 2;
  railgunHingePin.position.set(0, -0.02, 0.05);

  // Removable / swappable Glowing Neon Blue Cylindrical Core Cell inside the chamber
  const railgunCoreCellGroup = new THREE.Group();
  railgunCoreCellGroup.position.set(0, 0.022, 0.04);
  {
    const coreCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.11, 14), vmMatRailgunCoreNeon);
    coreCylinder.rotation.x = Math.PI / 2;
    const coreCapFront = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.016, 12), vmMatRailgunCoil);
    coreCapFront.rotation.x = Math.PI / 2;
    coreCapFront.position.set(0, 0, -0.05);
    const coreCapRear = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.016, 12), vmMatRailgunCoil);
    coreCapRear.rotation.x = Math.PI / 2;
    coreCapRear.position.set(0, 0, 0.05);
    railgunCoreCellGroup.add(coreCylinder, coreCapFront, coreCapRear);
  }

  // Break-Open Hinge Assembly: Front barrel, rails, coils, and optics pivot downward around central hinge at (0, -0.02, 0.05)
  const railgunHingeGroup = new THREE.Group();
  railgunHingeGroup.position.set(0, -0.02, 0.05);

  // Front receiver extending forward from the hinge
  const railgunFrontReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.088, 0.28), vmMatRailgunTitanium);
  railgunFrontReceiver.position.set(0, 0.02, -0.14);

  const railgunUpperFairing = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.34), vmMatRailgunCarbon);
  railgunUpperFairing.position.set(0, 0.072, -0.11);

  // Integrated optical scope attached to front assembly
  const railgunScopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.03, 0.16), vmMatRailgunCarbon);
  railgunScopeMount.position.set(0, 0.102, -0.07);
  const railgunScopeOptic = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.036, 0.15), vmMatRailgunCoil);
  railgunScopeOptic.position.set(0, 0.13, -0.07);
  const railgunScopeReticle = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.008), vmMatRailgunLens);
  railgunScopeReticle.position.set(0, 0.13, 0.005);

  // Dual metallic magnetic acceleration guide rails
  const railgunTopGuide = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.52), vmMatRailgunCoil);
  railgunTopGuide.position.set(0, 0.048, -0.33);

  const railgunBottomGuide = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.52), vmMatRailgunCoil);
  railgunBottomGuide.position.set(0, -0.008, -0.33);

  // Center Glowing Neon Blue Rail running down center barrel
  const railgunCenterBeam = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.54), vmMatRailgunNeon);
  railgunCenterBeam.position.set(0, 0.02, -0.33);

  // 4 Magnetic accelerator coils along barrel (positioned relative to hinge pivot)
  const coilZPositions = [-0.15, -0.25, -0.37, -0.49];
  coilZPositions.forEach(cz => {
    const coil = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.062, 0.026), vmMatRailgunCoil);
    coil.position.set(0, 0.02, cz);
    const coilStripe = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.012, 0.022), vmMatRailgunNeon);
    coilStripe.position.set(0, 0.02, cz);
    railgunHingeGroup.add(coil, coilStripe);
  });

  railgunHingeGroup.add(
    railgunFrontReceiver,
    railgunUpperFairing,
    railgunScopeMount,
    railgunScopeOptic,
    railgunScopeReticle,
    railgunTopGuide,
    railgunBottomGuide,
    railgunCenterBeam
  );

  railgunBodyGroup.add(
    railgunStock,
    railgunGrip,
    railgunRearChassis,
    railgunHingePin,
    railgunCoreCellGroup,
    railgunHingeGroup
  );
  railgunVmGroup.add(railgunBodyGroup);

  // 11. Tactical Grenade (Slot 10)
  const grenadeVmGroup = new THREE.Group();
  {
    const gBody = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), vmMatGrenadeBody);
    gBody.scale.set(1, 1.22, 1);
    const gCap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 8), vmMatMetalAccent);
    gCap.position.y = 0.075;
    const gLever = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.005), vmMatMetalGrey);
    gLever.position.set(0.022, 0.045, 0);
    gLever.rotation.z = -0.12;
    const gRing = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), vmMatMetalAccent);
    gRing.position.set(-0.025, 0.075, 0);
    grenadeVmGroup.add(gBody, gCap, gLever, gRing);
    grenadeVmGroup.position.set(0.04, -0.03, -0.02);
    grenadeVmGroup.rotation.set(0.2, -0.15, -0.1);
  }

  // 12. Mini Shield (Slot 11)
  const miniVmGroup = new THREE.Group();
  {
    const potionBody = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.13, 16), vmMatPotionGlass);
    const potionLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.095, 16), vmMatPotionLiquid);
    potionLiquid.position.set(0, -0.015, 0);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.032, 16), vmMatPotionGlass);
    neck.position.set(0, 0.078, 0);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.028, 12), vmMatCork);
    cork.position.set(0, 0.098, 0);
    miniVmGroup.add(potionBody, potionLiquid, neck, cork);
    miniVmGroup.rotation.set(0.18, -0.3, -0.15);
  }

  // 13. Tactical Hunting Knife (Close-Quarters Melee)
  const knifeVmGroup = new THREE.Group();
  {
    const matKnifeBlade = new THREE.MeshStandardMaterial({
      color: 0xdde2eb,
      metalness: 0.96,
      roughness: 0.16
    });
    const matKnifeEdge = new THREE.MeshStandardMaterial({
      color: 0xf4f7fa,
      metalness: 0.98,
      roughness: 0.1
    });
    const matKnifeHandle = new THREE.MeshStandardMaterial({
      color: 0x16181b,
      roughness: 0.75,
      metalness: 0.3
    });
    const matKnifeGuard = new THREE.MeshStandardMaterial({
      color: 0x2b2f36,
      metalness: 0.85,
      roughness: 0.35
    });

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.038, 0.13), matKnifeHandle);
    handle.position.set(0, 0, 0.075);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.068, 0.014), matKnifeGuard);
    guard.position.set(0, 0, 0.008);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.048, 0.22), matKnifeBlade);
    blade.position.set(0, 0.005, -0.10);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.014, 0.21), matKnifeEdge);
    edge.position.set(0, -0.022, -0.10);

    const matVmGlove = new THREE.MeshStandardMaterial({ color: 0x1f2126, roughness: 0.75, metalness: 0.25 });
    const matVmKnuckleArmor = new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 0.4, metalness: 0.7 });
    const matVmSleeve = new THREE.MeshStandardMaterial({ color: 0x323a2a, roughness: 0.85 });

    // Multi-jointed gloved hand and forearm frame
    const glovedFist = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.056, 0.09), matVmGlove);
    glovedFist.position.set(0, -0.005, 0.075);
    const knuckleGuard = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.022, 0.075), matVmKnuckleArmor);
    knuckleGuard.position.set(0, 0.022, 0.075);

    const vmForearm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.072, 0.22), matVmSleeve);
    vmForearm.position.set(0, -0.04, 0.21);
    vmForearm.rotation.x = 0.22;

    knifeVmGroup.add(handle, guard, blade, edge, glovedFist, knuckleGuard, vmForearm);
    root.add(knifeVmGroup);
    knifeVmGroup.visible = false;
  }

  // 14. Tactical Handheld Radio Viewmodel
  const radioVmGroup = new THREE.Group();
  let radioPttMesh: THREE.Mesh;
  let radioLedMesh: THREE.Mesh;
  let radioScreenMesh: THREE.Mesh;
  let radioTransmitTimer = 0;
  let radioTransmitIsHold = false;
  {
    const matRadioBody = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.7, metalness: 0.25 });
    const matRadioGrip = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.9 });
    const matRadioAntenna = new THREE.MeshStandardMaterial({ color: 0x161719, roughness: 0.6, metalness: 0.4 });
    const matRadioKnob = new THREE.MeshStandardMaterial({ color: 0x32373e, metalness: 0.8, roughness: 0.3 });
    const matRadioScreen = new THREE.MeshStandardMaterial({ color: 0x071e12, emissive: 0x18e065, emissiveIntensity: 0.85, roughness: 0.2 });
    const matRadioLed = new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x00ff44, emissiveIntensity: 0.4 });
    const matRadioPtt = new THREE.MeshStandardMaterial({ color: 0x485059, metalness: 0.6, roughness: 0.4 });
    const matRadioGrill = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.95 });

    // Rugged transceiver chassis
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.14, 0.042), matRadioBody);
    body.position.set(0, 0, 0);

    // Rubberized side grips
    const gripL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.12, 0.044), matRadioGrip);
    gripL.position.set(-0.038, 0, 0);
    const gripR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.12, 0.044), matRadioGrip);
    gripR.position.set(0.038, 0, 0);

    // Long flexible rubber whip antenna on top-left
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0065, 0.22, 8), matRadioAntenna);
    antenna.position.set(-0.024, 0.17, 0);
    const antennaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.010, 0.025, 8), matRadioKnob);
    antennaBase.position.set(-0.024, 0.075, 0);

    // Channel Selector knob on top-right
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.022, 12), matRadioKnob);
    knob.position.set(0.022, 0.075, 0);

    // Backlit LCD screen
    radioScreenMesh = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.038, 0.005), matRadioScreen);
    radioScreenMesh.position.set(0, 0.032, 0.021);

    // Transmit LED status indicator
    radioLedMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), matRadioLed);
    radioLedMesh.position.set(0.024, 0.056, 0.021);

    // Push-to-Talk side switch
    radioPttMesh = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.038, 0.020), matRadioPtt);
    radioPttMesh.position.set(-0.042, 0.018, 0);

    // Speaker grill slits
    const grill = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.042, 0.004), matRadioGrill);
    grill.position.set(0, -0.025, 0.021);

    // Gloved tactical hand holding radio
    const matVmGlove = new THREE.MeshStandardMaterial({ color: 0x1f2126, roughness: 0.75, metalness: 0.25 });
    const glovedHand = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.075, 0.082), matVmGlove);
    glovedHand.position.set(0.005, -0.055, 0.01);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.032, 0.055), matVmGlove);
    thumb.position.set(-0.044, 0.01, 0.02);
    thumb.rotation.y = 0.35;

    const armSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.24), new THREE.MeshStandardMaterial({ color: 0x2e3628, roughness: 0.85 }));
    armSleeve.position.set(0.04, -0.12, 0.16);
    armSleeve.rotation.x = 0.35;

    radioVmGroup.add(
      body, gripL, gripR, antenna, antennaBase, knob,
      radioScreenMesh, radioLedMesh, radioPttMesh, grill,
      glovedHand, thumb, armSleeve
    );

    radioVmGroup.position.set(0.18, -0.16, -0.36);
    radioVmGroup.rotation.set(0.15, -0.22, 0.08);
  }

  const vmModels = [
    arVmGroup,        // 0: AR (Slot 1)
    shotgunVmGroup,   // 1: Shotgun (Slot 2)
    sniperVmGroup,    // 2: Sniper (Slot 3)
    pistolVmGroup,    // 3: Combat Pistol (Slot 4)
    smgVmGroup,       // 4: SMG (Slot 5)
    lmgVmGroup,       // 5: LMG (Slot 6)
    brVmGroup,        // 6: Battle Rifle (Slot 7)
    laserVmGroup,     // 7: Laser Gun (Slot 8)
    minigunVmGroup,   // 8: Heavy Minigun (Slot 9)
    railgunVmGroup,   // 9: Tactical Railgun (Slot 0)
    grenadeVmGroup,   // 10: Grenade (Slot 11)
    miniVmGroup,      // 11: Mini Shield (Slot 12)
    miniVmGroup,      // 12: Tactical Heal Medkit
    radioVmGroup      // 13: Tactical Radio (Slot 3 / Gadget)
  ];
  vmModels.forEach(g => root.add(g));

  const VM_BASE_X = 0.22;
  const VM_BASE_Y = -0.19;
  const VM_BASE_Z = -0.42;

  let vmRecoilZ = 0;
  let vmRecoilRotX = 0;
  let vmWalkBobPhase = 0;
  let vmIdleTimer = 0;
  let shotgunPumpTimer = 0;
  let pistolSlideFireTimer = 0;
  let smgBoltFireTimer = 0;
  let knifeMeleePhase = 0;

  function update(
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
    isPlaying: boolean
  ): void {
    if (!isPlaying || !isAlive) {
      root.visible = false;
      return;
    }

    const w: WeaponDef = typeof slotOrWeapon === 'number'
      ? (WEAPONS[slotOrWeapon] ?? WEAPONS[0])
      : (slotOrWeapon ?? WEAPONS[0]);

    const activeModelIdx = WEAPONS.findIndex(wp => wp.id === w.id);
    const showScope = playerAiming && !!w?.scoped;
    root.visible = !showScope;

    if (isMeleeing) {
      for (let i = 0; i < vmModels.length; i++) {
        vmModels[i].visible = false;
      }
      knifeVmGroup.visible = true;
      knifeMeleePhase = Math.min(1.0, knifeMeleePhase + dt / 0.32);
      const p = knifeMeleePhase;
      // Sharp horizontal metallic blade cutting dynamically from lower left across screen to upper right
      knifeVmGroup.position.set(-0.35 + p * 0.65, -0.26 + p * 0.40, -0.38 + Math.sin(p * Math.PI) * 0.12);
      knifeVmGroup.rotation.set(0.35 - p * 0.7, 0.4 - p * 0.8, -0.7 + p * 1.4);
    } else {
      knifeMeleePhase = 0;
      knifeVmGroup.visible = false;
      for (let i = 0; i < vmModels.length; i++) {
        vmModels[i].visible = (i === activeModelIdx);
      }
    }

    const moveSpeed = isMoving && playerOnGround ? (playerSprinting ? 1.55 : 1.0) : 0;
    if (moveSpeed > 0) {
      vmWalkBobPhase += dt * (playerSprinting ? 14 : 9.5);
    } else {
      vmWalkBobPhase *= 0.9;
    }
    vmIdleTimer += dt * 1.5;

    const walkBobX = Math.cos(vmWalkBobPhase * 0.5) * (playerSprinting ? 0.016 : 0.01) * moveSpeed;
    const walkBobY = Math.abs(Math.sin(vmWalkBobPhase)) * (playerSprinting ? 0.018 : 0.011) * moveSpeed;
    const idleBobX = Math.cos(vmIdleTimer * 0.8) * 0.0025;
    const idleBobY = Math.sin(vmIdleTimer * 1.4) * 0.0035;

    vmRecoilZ = Math.max(0, vmRecoilZ - dt * 0.55);
    vmRecoilRotX = Math.max(0, vmRecoilRotX - dt * 3.8);

    if (shotgunPumpTimer > 0) {
      shotgunPumpTimer -= dt;
      const pumpPhase = 1 - (shotgunPumpTimer / 0.42);
      if (pumpPhase < 0.45) {
        shotgunPumpMesh.position.z = -0.22 + (pumpPhase / 0.45) * 0.07;
      } else {
        shotgunPumpMesh.position.z = -0.15 - ((pumpPhase - 0.45) / 0.55) * 0.07;
      }
    } else {
      shotgunPumpMesh.position.z = -0.22;
    }

    if (pistolSlideFireTimer > 0) {
      pistolSlideFireTimer -= dt;
    }
    if (smgBoltFireTimer > 0) {
      smgBoltFireTimer -= dt;
    }

    const currentWs: WeaponSlotState | null | undefined = Array.isArray(weaponStatesOrWs)
      ? (typeof slotOrWeapon === 'number' ? weaponStatesOrWs[slotOrWeapon] : weaponStatesOrWs[activeModelIdx])
      : weaponStatesOrWs;

    // ==========================================
    // 0. ASSAULT RIFLE RELOAD ANIMATION
    // ==========================================
    if (activeModelIdx === 0) {
      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const p = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));
        let bodyTilt = 0;
        if (p < 0.15) bodyTilt = p / 0.15;
        else if (p < 0.85) bodyTilt = 1.0;
        else bodyTilt = 1.0 - (p - 0.85) / 0.15;

        arBodyGroup.rotation.z = -bodyTilt * 0.32;
        arBodyGroup.rotation.x = -bodyTilt * 0.14;
        arBodyGroup.position.y = -bodyTilt * 0.04;

        if (p < 0.15) {
          arMagMesh.visible = true;
          arMagMesh.position.set(0, -0.09, -0.04);
        } else if (p < 0.38) {
          const dropP = (p - 0.15) / 0.23;
          arMagMesh.visible = true;
          arMagMesh.position.set(0, -0.09 - dropP * 0.32, -0.04);
        } else if (p < 0.46) {
          arMagMesh.visible = false;
        } else if (p < 0.70) {
          const inP = (p - 0.46) / 0.24;
          const smoothIn = THREE.MathUtils.smoothstep(inP, 0, 1);
          arMagMesh.visible = true;
          arMagMesh.position.set(0, -0.40 + smoothIn * 0.31, -0.04);
        } else {
          arMagMesh.visible = true;
          arMagMesh.position.set(0, -0.09, -0.04);
        }

        if (!currentWs.isTacticalReload && p > 0.72 && p < 0.86) {
          const boltP = (p - 0.72) / 0.14;
          const boltBack = Math.sin(boltP * Math.PI) * 0.045;
          arBoltMesh.position.z = -0.02 + boltBack;
        } else {
          arBoltMesh.position.z = -0.02;
        }
      } else {
        arBodyGroup.rotation.set(0, 0, 0);
        arBodyGroup.position.set(0, 0, 0);
        arMagMesh.visible = true;
        arMagMesh.position.set(0, -0.09, -0.04);
        arBoltMesh.position.z = -0.02;
      }
    }

    // ==========================================
    // 1. PUMP SHOTGUN RELOAD ANIMATION (FIXED)
    // Main weapon chassis stays steady (no sideways tilt)
    // Horizontal foregrip slides backward and forward along barrel
    // ==========================================
    if (activeModelIdx === 1) {
      shotgunBodyGroup.rotation.set(0, 0, 0);
      shotgunBodyGroup.position.set(0, 0, 0);

      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const p = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));
        let pumpZ = -0.22;
        // Slide horizontal foregrip back and forth along barrel
        if (p < 0.28) {
          pumpZ = -0.22;
        } else if (p < 0.48) {
          const backP = (p - 0.28) / 0.20;
          const smooth = THREE.MathUtils.smoothstep(backP, 0, 1);
          pumpZ = -0.22 + smooth * 0.08;
        } else if (p < 0.68) {
          const fwdP = (p - 0.48) / 0.20;
          const smooth = THREE.MathUtils.smoothstep(fwdP, 0, 1);
          pumpZ = -0.14 - smooth * 0.08;
        } else {
          pumpZ = -0.22;
        }
        shotgunPumpMesh.position.set(0, -0.018, pumpZ);
      } else if (shotgunPumpTimer > 0) {
        // Firing pump is handled by timer
      } else {
        shotgunPumpMesh.position.set(0, -0.018, -0.22);
      }
    }

    // ==========================================
    // 2. HEAVY SNIPER RELOAD ANIMATION
    // ==========================================
    if (activeModelIdx === 2) {
      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const p = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));
        let bodyTilt = 0;
        if (p < 0.18) bodyTilt = p / 0.18;
        else if (p < 0.86) bodyTilt = 1.0;
        else bodyTilt = 1.0 - (p - 0.86) / 0.14;

        sniperBodyGroup.rotation.x = -bodyTilt * 0.28;
        sniperBodyGroup.rotation.z = bodyTilt * 0.12;
        sniperBodyGroup.position.y = -bodyTilt * 0.05;

        if (p < 0.18) {
          sniperMagMesh.visible = true;
          sniperMagMesh.position.set(0, -0.07, -0.04);
        } else if (p < 0.38) {
          const dropP = (p - 0.18) / 0.20;
          sniperMagMesh.visible = true;
          sniperMagMesh.position.set(0, -0.07 - dropP * 0.28, -0.04);
        } else if (p < 0.44) {
          sniperMagMesh.visible = false;
        } else if (p < 0.66) {
          const inP = (p - 0.44) / 0.22;
          const smoothIn = THREE.MathUtils.smoothstep(inP, 0, 1);
          sniperMagMesh.visible = true;
          sniperMagMesh.position.set(0, -0.35 + smoothIn * 0.28, -0.04);
        } else {
          sniperMagMesh.visible = true;
          sniperMagMesh.position.set(0, -0.07, -0.04);
        }

        if (p < 0.66) {
          sniperBoltGroup.position.set(0.024, 0.04, 0.05);
          sniperBoltGroup.rotation.set(0, 0, 0);
        } else if (p < 0.72) {
          const rotP = (p - 0.66) / 0.06;
          sniperBoltGroup.rotation.z = -rotP * 0.7;
          sniperBoltGroup.position.set(0.024, 0.04, 0.05);
        } else if (p < 0.80) {
          const slideP = (p - 0.72) / 0.08;
          sniperBoltGroup.rotation.z = -0.7;
          sniperBoltGroup.position.set(0.024, 0.04, 0.05 + slideP * 0.065);
        } else if (p < 0.86) {
          const fwdP = (p - 0.80) / 0.06;
          sniperBoltGroup.rotation.z = -0.7;
          sniperBoltGroup.position.set(0.024, 0.04, 0.115 - fwdP * 0.065);
        } else if (p < 0.90) {
          const lockP = (p - 0.86) / 0.04;
          sniperBoltGroup.rotation.z = -0.7 + lockP * 0.7;
          sniperBoltGroup.position.set(0.024, 0.04, 0.05);
        } else {
          sniperBoltGroup.position.set(0.024, 0.04, 0.05);
          sniperBoltGroup.rotation.set(0, 0, 0);
        }
      } else {
        sniperBodyGroup.rotation.set(0, 0, 0);
        sniperBodyGroup.position.set(0, 0, 0);
        sniperMagMesh.visible = true;
        sniperMagMesh.position.set(0, -0.07, -0.04);
        sniperBoltGroup.position.set(0.024, 0.04, 0.05);
        sniperBoltGroup.rotation.set(0, 0, 0);
      }
    }

    // =========================================================================
    // 3. COMBAT PISTOL (Slot 3) - FIXED MESH ALIGNMENT & RELOAD LOOP
    // Both pistolSlideGroup and pistolMagGroup are direct children of pistolBodyGroup,
    // translating strictly along local Z/Y axis without any vertical clipping or misalignment!
    // =========================================================================
    // 3. COMBAT PISTOL (Slot 3) - VIEWPORT VISIBILITY CORRECTION & RELOAD LOOP
    // When pistol reload begins, use a progressive translation loop to lift the entire
    // pistol viewmodel upwards by +0.3 units on the Y-axis and rotate it slightly inward
    // toward the center of the screen so the bottom magazine swap is fully visible.
    // While held high, animate the MAGAZINE MESH block sliding smoothly out of the
    // bottom of the handle, dropping out of view, and a new fresh magazine block sliding
    // up into the magwell before the gun returns to its lower resting position.
    // Top slide rack motion remains completely intact!
    // =========================================================================
    if (activeModelIdx === 3) {
      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const p = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));

        let liftP = 0;
        if (p < 0.14) {
          liftP = THREE.MathUtils.smoothstep(p / 0.14, 0, 1);
        } else if (p < 0.86) {
          liftP = 1.0;
        } else {
          liftP = THREE.MathUtils.smoothstep((1 - p) / 0.14, 0, 1);
        }

        // Lift entire pistol viewmodel upwards by +0.15 units on Y-axis and rotate slightly inward toward center of screen
        pistolBodyGroup.position.y = liftP * 0.15;
        pistolBodyGroup.position.x = -liftP * 0.04;
        pistolBodyGroup.position.z = -liftP * 0.01;
        pistolBodyGroup.rotation.y = -liftP * 0.14;
        pistolBodyGroup.rotation.z = liftP * 0.07;
        pistolBodyGroup.rotation.x = -liftP * 0.04;

        // Visual magazine swap: smoothly sliding out of bottom of handle, dropping out of view,
        // and new fresh magazine sliding up into magwell
        if (p < 0.14) {
          pistolMagGroup.visible = true;
          pistolMagGroup.position.set(0, -0.065, 0.045);
        } else if (p < 0.36) {
          const dropP = (p - 0.14) / 0.22;
          const smoothDrop = THREE.MathUtils.smoothstep(dropP, 0, 1);
          pistolMagGroup.visible = true;
          pistolMagGroup.position.set(
            0,
            -0.065 - smoothDrop * 0.28,
            0.045 + smoothDrop * 0.065
          );
        } else if (p < 0.44) {
          pistolMagGroup.visible = false;
        } else if (p < 0.68) {
          const insertP = (p - 0.44) / 0.24;
          const smoothInsert = THREE.MathUtils.smoothstep(insertP, 0, 1);
          pistolMagGroup.visible = true;
          pistolMagGroup.position.set(
            0,
            -0.345 + smoothInsert * 0.28,
            0.110 - smoothInsert * 0.065
          );
        } else {
          pistolMagGroup.visible = true;
          pistolMagGroup.position.set(0, -0.065, 0.045);
        }

        // Top SLIDE MESH block translates backward and forward along local Z (kept completely intact)
        if (currentWs.isTacticalReload || p < 0.68) {
          pistolSlideGroup.position.set(0, 0.032, -0.02);
        } else if (p < 0.80) {
          const rackP = (p - 0.68) / 0.12;
          const smoothRack = THREE.MathUtils.smoothstep(rackP, 0, 1);
          pistolSlideGroup.position.set(0, 0.032, -0.02 + smoothRack * 0.052);
        } else if (p < 0.86) {
          const snapFwdP = (p - 0.80) / 0.06;
          pistolSlideGroup.position.set(0, 0.032, 0.032 - snapFwdP * 0.052);
        } else {
          pistolSlideGroup.position.set(0, 0.032, -0.02);
        }
      } else if (pistolSlideFireTimer > 0) {
        // Firing recoil slide action: cleanly translates back along local Z and returns
        const cycle = 1 - (pistolSlideFireTimer / 0.12);
        let slideOffsetZ = 0;
        if (cycle < 0.4) {
          slideOffsetZ = (cycle / 0.4) * 0.042;
        } else {
          slideOffsetZ = (1 - ((cycle - 0.4) / 0.6)) * 0.042;
        }
        pistolSlideGroup.position.set(0, 0.032, -0.02 + slideOffsetZ);
        pistolBodyGroup.rotation.set(0, 0, 0);
        pistolBodyGroup.position.set(0, 0, 0);
        pistolMagGroup.visible = true;
        pistolMagGroup.position.set(0, -0.065, 0.045);
      } else {
        pistolBodyGroup.rotation.set(0, 0, 0);
        pistolBodyGroup.position.set(0, 0, 0);
        pistolSlideGroup.position.set(0, 0.032, -0.02);
        pistolMagGroup.visible = true;
        pistolMagGroup.position.set(0, -0.065, 0.045);
      }
    }

    // =========================================================================
    // 4. SUBMACHINE GUN (SMG) (Slot 4)
    // Multi-stage reload: Gun tilts, long magazine stick translates down and vanishes,
    // fresh mag snaps in, visual tap on side bolt release block
    // =========================================================================
    if (activeModelIdx === 4) {
      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const p = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));
        let bodyTilt = 0;
        if (p < 0.15) bodyTilt = p / 0.15;
        else if (p < 0.85) bodyTilt = 1.0;
        else bodyTilt = 1.0 - (p - 0.85) / 0.15;

        smgBodyGroup.rotation.z = -bodyTilt * 0.32;
        smgBodyGroup.rotation.x = -bodyTilt * 0.16;
        smgBodyGroup.position.y = -bodyTilt * 0.035;

        // Long magazine stick drops out and fresh mag snaps back up
        if (p < 0.15) {
          smgMagMesh.visible = true;
          smgMagMesh.position.set(0, -0.10, -0.03);
        } else if (p < 0.36) {
          const dropP = (p - 0.15) / 0.21;
          const smoothDrop = THREE.MathUtils.smoothstep(dropP, 0, 1);
          smgMagMesh.visible = true;
          smgMagMesh.position.set(0, -0.10 - smoothDrop * 0.30, -0.03);
        } else if (p < 0.44) {
          smgMagMesh.visible = false;
        } else if (p < 0.68) {
          const inP = (p - 0.44) / 0.24;
          const smoothIn = THREE.MathUtils.smoothstep(inP, 0, 1);
          smgMagMesh.visible = true;
          smgMagMesh.position.set(0, -0.40 + smoothIn * 0.30, -0.03);
        } else {
          smgMagMesh.visible = true;
          smgMagMesh.position.set(0, -0.10, -0.03);
        }

        // Side-bolt release tap animation
        if (!currentWs.isTacticalReload && p > 0.72 && p < 0.86) {
          const tapP = (p - 0.72) / 0.14;
          const tapOffset = Math.sin(tapP * Math.PI) * 0.012;
          smgBoltMesh.position.x = 0.026 - tapOffset;
        } else {
          smgBoltMesh.position.x = 0.026;
        }
      } else if (smgBoltFireTimer > 0) {
        // Quick bolt cycling during rapid fire
        const cycle = 1 - (smgBoltFireTimer / 0.07);
        const boltOffsetZ = Math.sin(cycle * Math.PI) * 0.028;
        smgBoltMesh.position.z = 0.02 + boltOffsetZ;
        smgBodyGroup.rotation.set(0, 0, 0);
        smgBodyGroup.position.set(0, 0, 0);
        smgMagMesh.visible = true;
        smgMagMesh.position.set(0, -0.10, -0.03);
      } else {
        smgBodyGroup.rotation.set(0, 0, 0);
        smgBodyGroup.position.set(0, 0, 0);
        smgMagMesh.visible = true;
        smgMagMesh.position.set(0, -0.10, -0.03);
        smgBoltMesh.position.set(0.026, 0.024, 0.02);
      }
    }

    // =========================================================================
    // 5. LIGHT MACHINE GUN (LMG) (Slot 5)
    // Component-based reload: Main chassis stays relatively stable (no static downward tilting).
    // Lower AMMO DRUM BOX physically slides straight down out of bottom receiver and vanishes.
    // After mechanical delay, fresh drum box slides back up and clicks into place,
    // followed by small charging lever box on the side snapping backward and forward.
    // =========================================================================
    if (activeModelIdx === 5) {
      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const p = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));

        // Main chassis stays relatively stable - subtle natural handling heave only (no downward tilt!)
        const heave = Math.sin(p * Math.PI);
        lmgBodyGroup.rotation.set(0, 0, -heave * 0.02);
        lmgBodyGroup.position.set(0, -heave * 0.006, 0);

        // Heavy AMMO DRUM BOX physically slides straight down out of bottom receiver and vanishes
        if (p < 0.10) {
          lmgDrumGroup.visible = true;
          lmgDrumGroup.position.set(0, -0.115, 0.01);
        } else if (p < 0.35) {
          const dropP = (p - 0.10) / 0.25;
          const smoothDrop = THREE.MathUtils.smoothstep(dropP, 0, 1);
          lmgDrumGroup.visible = true;
          lmgDrumGroup.position.set(0, -0.115 - smoothDrop * 0.42, 0.01);
        } else if (p < 0.52) {
          // Set mechanical delay: old drum removed, reaching for fresh drum
          lmgDrumGroup.visible = false;
        } else if (p < 0.74) {
          // Fresh drum box slides back up into receiver feed
          const inP = (p - 0.52) / 0.22;
          const smoothIn = THREE.MathUtils.smoothstep(inP, 0, 1);
          lmgDrumGroup.visible = true;
          lmgDrumGroup.position.set(0, -0.535 + smoothIn * 0.42, 0.01);
        } else {
          // Clicks into place
          lmgDrumGroup.visible = true;
          lmgDrumGroup.position.set(0, -0.115, 0.01);
        }

        // Small charging lever box on the side snapping backward and forward
        if (currentWs.isTacticalReload || p < 0.76) {
          lmgCockingHandle.position.set(0.038, 0.044, 0.02);
        } else if (p < 0.86) {
          const rackBackP = (p - 0.76) / 0.10;
          const smoothRack = THREE.MathUtils.smoothstep(rackBackP, 0, 1);
          lmgCockingHandle.position.set(0.038, 0.044, 0.02 + smoothRack * 0.088);
        } else if (p < 0.92) {
          const snapFwdP = (p - 0.86) / 0.06;
          lmgCockingHandle.position.set(0.038, 0.044, 0.108 - snapFwdP * 0.088);
        } else {
          lmgCockingHandle.position.set(0.038, 0.044, 0.02);
        }
      } else {
        lmgBodyGroup.rotation.set(0, 0, 0);
        lmgBodyGroup.position.set(0, 0, 0);
        lmgDrumGroup.visible = true;
        lmgDrumGroup.position.set(0, -0.115, 0.01);
        lmgCockingHandle.position.set(0.038, 0.044, 0.02);
      }
    }

    // =========================================================================
    // 6. BATTLE RIFLE / FAMAS (Slot 6)
    // Rear Bullpup reload: Tilts barrel down slightly to clear view (not upward).
    // Rear MAGAZINE BOX smoothly slides out diagonally backward from the stock and disappears.
    // A new magazine box slides cleanly back up into the rear stock slot,
    // followed by charging handle block on top cycling backward and forward.
    // =========================================================================
    // 6. BATTLE RIFLE / FAMAS (Slot 6) - MULTI-STAGE BULLPUP RELOAD FIX
    // Sequenced Loop Animation:
    // - Tilts rifle barrel slightly down to frame the sequence clearly (no upward chassis tilt).
    // - STAGE 1: Rear curved MAGAZINE BOX physically detaches, sliding downward out of
    //   bottom of bullpup stock and disappearing.
    // - STAGE 2: After a mechanical audio delay, a fresh curved magazine box slides back up
    //   into stock cavity until it sits flush.
    // =========================================================================
    // 6. F2000 BATTLE RIFLE (Slot 6) - RELOAD STATE MACHINE OVERHAUL
    // Absolute time-based position translation (lerp) sequence for magazine sub-mesh:
    // - Milestone 1 (0.0s - 0.6s): Separate magazine mesh block and translate
    //   its Y-axis downward away from main receiver to a distance of -0.8 units.
    // - Milestone 2 (0.6s - 1.2s): Instantly instantiate filled magazine mesh position
    //   back at -0.8 units and smoothly translate it up into mag-well, locking it at 0.0 units.
    // - Milestone 3 (1.2s - 1.8s / Only if empty magazine reload): Trigger a 45-degree
    //   rotation tweak on bolt-handle charging mechanism mesh.
    // - Tactical reload (mag count > 0) strictly skips Milestone 3 (total duration 1.2s).
    // =========================================================================
    if (activeModelIdx === 6) {
      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const nominalTotal = currentWs.isTacticalReload ? 1.2 : 1.8;
        const progress = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));
        const elapsedSec = progress * nominalTotal;

        // Receiver chassis remains stable (no rotational tilts that loop or fail)
        brBodyGroup.rotation.set(0, 0, 0);
        brBodyGroup.position.set(0, 0, 0);

        if (elapsedSec < 0.6) {
          // Milestone 1 (0.0s - 0.6s): Separate magazine mesh block and translate Y-axis downward to -0.8 units
          const t1 = Math.max(0, Math.min(1, elapsedSec / 0.6));
          const magY = THREE.MathUtils.lerp(0.0, -0.8, t1);
          brMagGroup.visible = true;
          brMagGroup.position.set(0, magY, 0.15);
          brChargingHandle.position.set(0.025, 0.064, -0.11);
          brChargingHandle.rotation.set(0, 0, 0);
        } else if (elapsedSec < 1.2) {
          // Milestone 2 (0.6s - 1.2s): Instantly instantiate filled magazine mesh position back at -0.8 units and smoothly translate up into mag-well, locking at 0.0 units
          const t2 = Math.max(0, Math.min(1, (elapsedSec - 0.6) / 0.6));
          const magY = THREE.MathUtils.lerp(-0.8, 0.0, t2);
          brMagGroup.visible = true;
          brMagGroup.position.set(0, magY, 0.15);
          brChargingHandle.position.set(0.025, 0.064, -0.11);
          brChargingHandle.rotation.set(0, 0, 0);
        } else if (!currentWs.isTacticalReload && elapsedSec <= 1.8) {
          // Milestone 3 (1.2s - 1.8s / Only if empty magazine reload): Trigger 45-degree rotation tweak on bolt-handle charging mechanism mesh
          brMagGroup.visible = true;
          brMagGroup.position.set(0, 0.0, 0.15);
          const t3 = Math.max(0, Math.min(1, (elapsedSec - 1.2) / 0.6));
          // 45 degrees = Math.PI / 4 radians
          const angle45 = Math.PI / 4;
          const tweakRot = Math.sin(t3 * Math.PI) * angle45;
          brChargingHandle.position.set(0.025, 0.064, -0.11);
          brChargingHandle.rotation.set(0, 0, tweakRot);
        } else {
          // Locked in mag-well at 0.0 units
          brMagGroup.visible = true;
          brMagGroup.position.set(0, 0.0, 0.15);
          brChargingHandle.position.set(0.025, 0.064, -0.11);
          brChargingHandle.rotation.set(0, 0, 0);
        }
      } else {
        brBodyGroup.rotation.set(0, 0, 0);
        brBodyGroup.position.set(0, 0, 0);
        brMagGroup.visible = true;
        brMagGroup.position.set(0, 0.0, 0.15);
        brChargingHandle.position.set(0.025, 0.064, -0.11);
        brChargingHandle.rotation.set(0, 0, 0);
      }
    }

    // =========================================================================
    // 7. COVENANT-STYLE LASER GUN (Slot 7)
    // Multi-stage Venting animation: Upper cooling vent door block swings open on hinge,
    // glowing heat particles / steam glows, inner GLOWING BATTERY CELL block slides outward
    // slightly to cool off, resets heat meter to 0%, returns to idle
    // =========================================================================
    if (activeModelIdx === 7) {
      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const p = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));

        let ventTilt = 0;
        if (p < 0.16) ventTilt = p / 0.16;
        else if (p < 0.84) ventTilt = 1.0;
        else ventTilt = 1.0 - (p - 0.84) / 0.16;

        laserBodyGroup.rotation.z = -ventTilt * 0.22;
        laserBodyGroup.rotation.x = -ventTilt * 0.12;
        laserBodyGroup.position.y = -ventTilt * 0.025;

        // Vent door swings open on hinge
        if (p < 0.20) {
          const doorP = p / 0.20;
          laserVentDoorGroup.rotation.x = -doorP * 1.25;
        } else if (p < 0.80) {
          laserVentDoorGroup.rotation.x = -1.25;
        } else {
          const closeP = (p - 0.80) / 0.20;
          laserVentDoorGroup.rotation.x = -1.25 + closeP * 1.25;
        }

        // Inner glowing battery cell slides outward slightly to vent heat
        if (p < 0.22) {
          laserBatteryMesh.position.set(0, 0.035, 0.03);
        } else if (p < 0.48) {
          const slideOutP = (p - 0.22) / 0.26;
          const smoothOut = THREE.MathUtils.smoothstep(slideOutP, 0, 1);
          laserBatteryMesh.position.set(0, 0.035 + smoothOut * 0.038, 0.03 + smoothOut * 0.02);
        } else if (p < 0.76) {
          laserBatteryMesh.position.set(0, 0.073, 0.05);
        } else {
          const returnP = (p - 0.76) / 0.24;
          const smoothIn = THREE.MathUtils.smoothstep(returnP, 0, 1);
          laserBatteryMesh.position.set(0, 0.073 - smoothIn * 0.038, 0.05 - smoothIn * 0.02);
        }

        // Thermal vent steam glow
        if (p > 0.22 && p < 0.78) {
          laserVentSteamMesh.visible = true;
          const steamScale = 0.8 + Math.sin(p * 24) * 0.35;
          laserVentSteamMesh.scale.set(steamScale, steamScale, steamScale);
        } else {
          laserVentSteamMesh.visible = false;
        }
      } else {
        laserBodyGroup.rotation.set(0, 0, 0);
        laserBodyGroup.position.set(0, 0, 0);
        laserVentDoorGroup.rotation.set(0, 0, 0);
        laserBatteryMesh.position.set(0, 0.035, 0.03);
        laserVentSteamMesh.visible = false;
      }
    }

    // =========================================================================
    // 8. TACTICAL RAILGUN (Slot 9 / Key 0)
    // Multi-stage cinematic break-open reload sequence:
    // 1. Frame breaks open downward at central hinge pivot
    // 2. Empty glowing neon blue cylindrical core cell slides backward and vanishes
    // 3. Fresh brilliant neon blue power cell block slides forward into chamber
    // 4. Frame snaps heavily back together into a single solid chassis, rails pulse bright
    // =========================================================================
    if (activeModelIdx === 9) {
      if (currentWs?.reloading && (currentWs.totalReloadT ?? 0) > 0) {
        const p = Math.max(0, Math.min(1, 1 - (currentWs.reloadT! / currentWs.totalReloadT!)));

        let bodyRoll = 0;
        if (p < 0.16) bodyRoll = p / 0.16;
        else if (p < 0.86) bodyRoll = 1.0;
        else bodyRoll = 1.0 - (p - 0.86) / 0.14;

        railgunBodyGroup.rotation.z = -bodyRoll * 0.18;
        railgunBodyGroup.rotation.x = -bodyRoll * 0.10;
        railgunBodyGroup.position.y = -bodyRoll * 0.035;

        // Stage 1 & 4: Break open downward on central hinge, then snap shut
        if (p < 0.22) {
          const hingeP = p / 0.22;
          const smoothHinge = THREE.MathUtils.smoothstep(hingeP, 0, 1);
          railgunHingeGroup.rotation.x = -smoothHinge * 0.65;
        } else if (p < 0.72) {
          railgunHingeGroup.rotation.x = -0.65;
        } else if (p < 0.82) {
          const snapP = (p - 0.72) / 0.10;
          const smoothSnap = THREE.MathUtils.smoothstep(snapP, 0, 1);
          railgunHingeGroup.rotation.x = -0.65 + smoothSnap * 0.65;
        } else {
          railgunHingeGroup.rotation.x = 0;
        }

        // Stage 2 & 3: Core cell slide backward / out, then fresh cell slides forward / in
        if (p < 0.22) {
          railgunCoreCellGroup.visible = true;
          railgunCoreCellGroup.position.set(0, 0.022, 0.04);
          vmMatRailgunCoreNeon.emissiveIntensity = 0.5;
        } else if (p < 0.44) {
          const ejectP = (p - 0.22) / 0.22;
          const smoothEject = THREE.MathUtils.smoothstep(ejectP, 0, 1);
          railgunCoreCellGroup.visible = true;
          railgunCoreCellGroup.position.set(0, 0.022, 0.04 + smoothEject * 0.25);
          vmMatRailgunCoreNeon.emissiveIntensity = 0.2;
        } else if (p < 0.50) {
          railgunCoreCellGroup.visible = false;
        } else if (p < 0.72) {
          const insertP = (p - 0.50) / 0.22;
          const smoothInsert = THREE.MathUtils.smoothstep(insertP, 0, 1);
          railgunCoreCellGroup.visible = true;
          railgunCoreCellGroup.position.set(0, 0.022, 0.29 - smoothInsert * 0.25);
          vmMatRailgunCoreNeon.emissiveIntensity = 2.4;
        } else {
          railgunCoreCellGroup.visible = true;
          railgunCoreCellGroup.position.set(0, 0.022, 0.04);
          vmMatRailgunCoreNeon.emissiveIntensity = 0;
        }

        // Rugged dark steel chassis maintains matte industrial finish
        vmMatRailgunNeon.emissiveIntensity = 0;
        vmMatRailgunCoreNeon.emissiveIntensity = 0;
      } else {
        railgunBodyGroup.rotation.set(0, 0, 0);
        railgunBodyGroup.position.set(0, 0, 0);
        railgunHingeGroup.rotation.set(0, 0, 0);
        railgunCoreCellGroup.visible = true;
        railgunCoreCellGroup.position.set(0, 0.022, 0.04);
        vmMatRailgunCoreNeon.emissiveIntensity = 0;
      }
    }

    // ==========================================
    // ADS & EYE POSITIONING CALCULATIONS
    // ==========================================
    const isAds = playerAiming && !w?.scoped;
    let targetX = isAds ? 0.06 : VM_BASE_X;
    let targetY = isAds ? -0.15 : VM_BASE_Y;
    let targetZ = isAds ? -0.36 : VM_BASE_Z;

    if (activeModelIdx === 3) {
      // Pistol: centered eye alignment
      targetX = isAds ? 0.0 : 0.19;
      targetY = isAds ? -0.14 : -0.18;
      targetZ = isAds ? -0.32 : -0.38;
    } else if (activeModelIdx === 4) {
      // SMG: compact, forward
      targetX = isAds ? 0.0 : 0.20;
      targetY = isAds ? -0.14 : -0.18;
      targetZ = isAds ? -0.33 : -0.40;
    } else if (activeModelIdx === 5) {
      // LMG: heavy stance, wider
      targetX = isAds ? 0.0 : 0.24;
      targetY = isAds ? -0.15 : -0.22;
      targetZ = isAds ? -0.34 : -0.44;
    } else if (activeModelIdx === 6) {
      // Battle Rifle: align top optic box directly with crosshair
      targetX = isAds ? 0.0 : 0.21;
      targetY = isAds ? -0.142 : -0.19;
      targetZ = isAds ? -0.33 : -0.42;
    } else if (activeModelIdx === 7) {
      // Laser Gun: futuristic alien forward position
      targetX = isAds ? 0.0 : 0.22;
      targetY = isAds ? -0.14 : -0.20;
      targetZ = isAds ? -0.32 : -0.42;
    } else if (activeModelIdx === 8) {
      // Heavy Minigun: wide heavy hip stance occupying lower right
      targetX = 0.28;
      targetY = -0.24;
      targetZ = -0.40;
      minigunBarrelCluster.rotation.z = minigunSpinAngle;
      if (minigunIsVenting) {
        const p = performance.now() * 0.015;
        const scale1 = 1.0 + Math.sin(p) * 0.35;
        const scale2 = 1.2 + Math.cos(p * 1.4) * 0.4;
        minigunVentMesh1.visible = true;
        minigunVentMesh2.visible = true;
        minigunVentMesh3.visible = true;
        minigunVentMesh1.scale.set(scale1, scale1, scale1);
        minigunVentMesh2.scale.set(scale2, scale2, scale2);
        minigunVentMesh3.scale.set(scale1, scale1, scale1);
      } else {
        minigunVentMesh1.visible = false;
        minigunVentMesh2.visible = false;
        minigunVentMesh3.visible = false;
      }
    } else if (activeModelIdx === 9) {
      // Tactical Railgun: Halo-inspired precision rail chassis
      targetX = isAds ? 0.0 : 0.21;
      targetY = isAds ? -0.144 : -0.19;
      targetZ = isAds ? -0.33 : -0.41;
      if (!currentWs?.reloading) {
        vmMatRailgunNeon.emissiveIntensity = 0;
        vmMatRailgunCoreNeon.emissiveIntensity = 0;
      }
    } else if (activeModelIdx >= 10) {
      // Grenades & Minis
      targetX = 0.24;
      targetY = -0.21;
      targetZ = VM_BASE_Z;
    }

    const meleeLower = isMeleeing ? -0.14 : 0;

    root.position.set(
      targetX + idleBobX + walkBobX,
      targetY + idleBobY - walkBobY + meleeLower,
      targetZ + vmRecoilZ
    );

    root.rotation.x = -vmRecoilRotX;
    root.rotation.y = walkBobX * 0.6;
    root.rotation.z = -walkBobX * 0.8;

    // Mini Shield drinking animation (Slot 11)
    if (activeModelIdx === 11 && isDrinking) {
      miniVmGroup.rotation.x = -0.3 + Math.sin(drinkTimer * 10) * 0.12;
    } else if (activeModelIdx === 11) {
      miniVmGroup.rotation.x = 0.18;
    }

    // Tactical Handheld Radio animation (Slot 13)
    if (activeModelIdx === 13) {
      if (radioTransmitTimer > 0) {
        radioTransmitTimer -= dt;
        radioPttMesh.position.x = -0.038; // PTT button depressed
        const ledMat = radioLedMesh.material as THREE.MeshStandardMaterial;
        ledMat.emissive.setHex(radioTransmitIsHold ? 0xf5a623 : 0x00f0ff);
        ledMat.emissiveIntensity = 3.5;
        const screenMat = radioScreenMesh.material as THREE.MeshStandardMaterial;
        screenMat.emissiveIntensity = 1.8;
        radioVmGroup.rotation.x = 0.22;
      } else {
        radioPttMesh.position.x = -0.042;
        const ledMat = radioLedMesh.material as THREE.MeshStandardMaterial;
        ledMat.emissive.setHex(0x00ff44);
        ledMat.emissiveIntensity = 0.4;
        const screenMat = radioScreenMesh.material as THREE.MeshStandardMaterial;
        screenMat.emissiveIntensity = 0.85;
        radioVmGroup.rotation.x = 0.15;
      }
    }
  }

  let minigunSpinAngle = 0;
  let minigunIsVenting = false;
  let railgunChargeNorm = 0;

  function setRailgunChargeProgress(progress: number): void {
    railgunChargeNorm = progress;
  }

  function setMinigunSpin(deltaAngle: number, isVenting: boolean): void {
    minigunSpinAngle += deltaAngle;
    minigunIsVenting = isVenting;
  }

  function triggerPistolSlideFire(): void {
    pistolSlideFireTimer = 0.12;
  }

  function triggerShotgunPump(): void {
    shotgunPumpTimer = 0.42;
  }

  function triggerSmgBoltFire(): void {
    smgBoltFireTimer = 0.07;
  }

  function addRecoil(kick: number, rotX: number): void {
    vmRecoilZ = kick;
    vmRecoilRotX = rotX;
  }

  function triggerRadioTransmit(isHold: boolean): void {
    radioTransmitTimer = 0.38;
    radioTransmitIsHold = isHold;
    addRecoil(0.015, 0.02);
  }

  return {
    root,
    update,
    triggerPistolSlideFire,
    triggerShotgunPump,
    triggerSmgBoltFire,
    setRailgunChargeProgress,
    setMinigunSpin,
    addRecoil,
    triggerKnifeSlash: () => {
      knifeMeleePhase = 0;
    },
    triggerRadioTransmit
  };
}
