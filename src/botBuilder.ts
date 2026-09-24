import * as THREE from 'three';
import {
  EliteArchetype,
  FactionId,
  FACTION_AVATARS,
  ELITE_STAT_MULTIPLIER,
  ELITE_HEAVY_ARMOR_MULTIPLIER,
  REGEN_FIELD_RADIUS,
  createTacticalState,
  TacticalAIState
} from './types';

/* =============================================================================
 * PROCEDURAL SURFACE DETAIL — cached canvas bump maps & physical glass
 * Built once per session and reused across every material that wants them, so
 * spawning dozens of bots never re-generates a canvas. Applied as bumpMap only
 * (never as the base color map) so faction palettes stay in full control of
 * the actual color while gaining a tactile, non-reflective micro-surface.
 * ===========================================================================*/

let _weaveTex: THREE.CanvasTexture | null = null;
/** Tight cross-hatch ripstop weave for Cordura vests, BDUs, and slings. */
function getBallisticWeaveTexture(): THREE.CanvasTexture {
  if (_weaveTex) return _weaveTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const cell = 6;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const horizontal = ((x / cell) + (y / cell)) % 2 === 0;
      const shade = 118 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      if (horizontal) {
        ctx.fillRect(x, y, cell, cell * 0.42);
      } else {
        ctx.fillRect(x, y, cell * 0.42, cell);
      }
    }
  }
  // A few longer scuff threads to break the perfect grid
  ctx.strokeStyle = 'rgba(40,40,40,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x1 = Math.random() * size;
    const y1 = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + (Math.random() - 0.5) * 10, y1 + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  _weaveTex = tex;
  return tex;
}

let _scratchTex: THREE.CanvasTexture | null = null;
/** Directional brushed streaks + micro-scuffs for parkerized/anodized metal. */
function getScratchedMetalTexture(): THREE.CanvasTexture {
  if (_scratchTex) return _scratchTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 2) {
    const shade = 74 + Math.floor(Math.random() * 40);
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + (Math.random() - 0.5) * 2);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }
  // Bright edge burnish scuffs
  ctx.strokeStyle = 'rgba(230,230,230,0.35)';
  for (let i = 0; i < 14; i++) {
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size * 0.3, y);
    ctx.lineTo(Math.random() * size * 0.3 + size * 0.5, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  _scratchTex = tex;
  return tex;
}

/** Visors, NVG lenses, specimen glass — real transmission/clearcoat glass. */
function makeGlassMaterial(
  color: number,
  opts?: { emissive?: number; emissiveIntensity?: number; opacity?: number }
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.15,
    ior: 1.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.95,
    transparent: true,
    opacity: opts?.opacity ?? 0.9,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0
  });
}

export interface BotVisualBuildResult {
  rootGroup: THREE.Group;
  torsoGroup: THREE.Group;
  armLPivot: THREE.Group;
  armRPivot: THREE.Group;
  armLLowerPivot: THREE.Group;
  armRLowerPivot: THREE.Group;
  legLPivot: THREE.Group;
  legRPivot: THREE.Group;
  legLLowerPivot: THREE.Group;
  legRLowerPivot: THREE.Group;
  gunMesh: THREE.Group | null;
  muzzleFlash: THREE.Sprite | null;
  flashMats: THREE.MeshStandardMaterial[];
  hitParts: THREE.Mesh[];
  headParts: Set<THREE.Mesh>;
  faction: 'usmc' | 'apex' | 'zombie';
  subClass: string;
  speedMultiplier: number;
  healthMultiplier: number;
  armorMultiplier: number;
  tactical: TacticalAIState;
}

export interface BotBuildOptions {
  botId: number;
  team: string;
  isZombie: boolean;
  zType: 'walker' | 'runner' | 'tank' | 'brute' | 'banshee' | 'bloater' | 'megaboss';
  isVIP: boolean;
  weaponTypeIndex: number;
  weaponType: string;
  factionAlignment: 'usmc' | 'apex';
  /** Meta-economy faction identity. Drives the MARPAT vs Charcoal/Crimson baseline. */
  factionId?: FactionId;
  gearTier?: 'standard' | 'specialized';
  headgear?: string;
  torsoConfig?: string;
  lowerConfig?: string;
  mode?: string;
  /** Elite squad archetype — drives 2.5x stats and role-specific silhouette. */
  eliteRole?: EliteArchetype;
  eliteSlot?: number;
  makeFlashSprite: (depthTest: boolean) => THREE.Sprite;
}

/* =============================================================================
 * PALETTE RESOLUTION
 * ===========================================================================*/

interface BotPalette {
  shirt: number;
  pants: number;
  vest: number;
  helmet: number;
  pouches: number;
  skin: number;
  accent: number;
}

function resolveFactionPalette(factionId: FactionId | undefined, legacy: 'usmc' | 'apex'): BotPalette {
  const resolved: FactionId =
    factionId || (legacy === 'usmc' ? 'USMC_SPEC_OPS' : 'MERCENARY_VANGUARD');
  const avatar = FACTION_AVATARS[resolved];
  return { ...avatar.palette };
}

/**
 * A 4-sided radial cylinder rotated 45° reads as a chamfered rectangular
 * plate rather than a raw box, and giving top/bottom different radii adds a
 * free "shooter's cut" taper toward the shoulders — the single cheapest
 * anti-blockiness win for armor plates, helmets and boot toes.
 */
function makeChamferedPlate(
  topRadius: number,
  bottomRadius: number,
  height: number,
  mat: THREE.Material
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(topRadius, bottomRadius, height, 4, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 4;
  return mesh;
}

/* =============================================================================
 * MAIN BOT VISUAL BUILDER
 * ===========================================================================*/

export function buildBotVisuals(options: BotBuildOptions): BotVisualBuildResult {
  const {
    botId,
    team,
    isZombie,
    zType,
    isVIP,
    weaponTypeIndex,
    weaponType,
    factionAlignment,
    factionId,
    gearTier = 'standard',
    eliteRole,
    makeFlashSprite
  } = options;

  const rootGroup = new THREE.Group();
  const hitParts: THREE.Mesh[] = [];
  const headParts = new Set<THREE.Mesh>();
  const flashMats: THREE.MeshStandardMaterial[] = [];

  let speedMultiplier = 1.0;
  let healthMultiplier = 1.0;
  let armorMultiplier = 1.0;

  const isSpecializedBot = !isZombie && !isVIP && (gearTier === 'specialized' || botId % 3 === 0);

  // Determine faction
  let faction: 'usmc' | 'apex' | 'zombie' = 'usmc';
  if (isZombie) {
    faction = 'zombie';
  } else if (isVIP) {
    faction = 'usmc';
  } else if (team === 'blue') {
    faction = factionAlignment === 'usmc' ? 'usmc' : 'apex';
  } else if (team === 'red') {
    faction = factionAlignment === 'usmc' ? 'apex' : 'usmc';
  } else {
    faction = botId % 2 === 0 ? 'usmc' : 'apex';
  }

  // Determine sub-class
  let subClass = 'rifleman';
  if (eliteRole) {
    subClass =
      eliteRole === 'heavy'
        ? 'elite_heavy'
        : eliteRole === 'medic'
        ? 'elite_medic'
        : eliteRole === 'recon'
        ? 'elite_recon'
        : 'elite_engineer';
  } else if (faction === 'usmc') {
    const usmcList = ['rifleman', 'sergeant', 'pointman', 'corpsman', 'heavy_gunner', 'engineer'];
    if (isVIP) subClass = 'sergeant';
    else if (weaponTypeIndex === 5 || weaponTypeIndex === 8) subClass = 'heavy_gunner';
    else if (weaponTypeIndex === 1) subClass = 'pointman';
    else subClass = usmcList[botId % usmcList.length];
  } else if (faction === 'apex') {
    const apexList = ['ghost', 'infiltrator', 'recon', 'juggernaut'];
    if (weaponTypeIndex === 5 || weaponTypeIndex === 8) subClass = 'juggernaut';
    else if (weaponTypeIndex === 2) subClass = 'recon';
    else subClass = apexList[botId % apexList.length];
  }

  /* --------------------------- COLOUR PALETTE --------------------------- */
  const basePalette = resolveFactionPalette(
    factionId,
    faction === 'zombie' ? factionAlignment : (faction as 'usmc' | 'apex')
  );

  let shirtColor = basePalette.shirt;
  let pantsColor = basePalette.pants;
  let vestColor = basePalette.vest;
  let helmetColor = basePalette.helmet;
  let pouchesColor = basePalette.pouches;
  let skinColor = basePalette.skin;
  const accentColor = basePalette.accent;

  if (isVIP) {
    vestColor = 0x0099ff;
    helmetColor = 0x00bfff;
    shirtColor = 0x0055aa;
    pantsColor = 0x003366;
    skinColor = 0xd2a482;
  } else if (isZombie) {
    if (zType === 'walker') {
      skinColor = 0x5a5c55;
      shirtColor = 0x3d3935;
      pantsColor = 0x2b2825;
      vestColor = 0x3a3d35;
      helmetColor = 0x4a4d45;
    } else if (zType === 'runner') {
      skinColor = 0x4d423d;
      shirtColor = 0x2a2220;
      pantsColor = 0x1f1a18;
      vestColor = 0x3a2a26;
      helmetColor = 0x47342e;
    } else if (zType === 'brute') {
      skinColor = 0x2e2c2a;
      shirtColor = 0x1c1a18;
      pantsColor = 0x141414;
      vestColor = 0x242220;
      helmetColor = 0x1f1e1c;
    } else if (zType === 'bloater') {
      skinColor = 0x384a28;
      shirtColor = 0x2d3a20;
      pantsColor = 0x202816;
      vestColor = 0x324024;
      helmetColor = 0x2a361e;
    } else if (zType === 'banshee') {
      skinColor = 0xb8e2f2;
      shirtColor = 0x3a4855;
      pantsColor = 0x242e38;
      vestColor = 0x405260;
      helmetColor = 0x4c6274;
    } else {
      skinColor = 0x1a1a1c;
      shirtColor = 0x101012;
      pantsColor = 0x0c0c0e;
      vestColor = 0x161618;
      helmetColor = 0x141416;
    }
  } else if (faction === 'usmc') {
    // MARPAT olive baseline
    shirtColor = 0x3e4a2d;
    pantsColor = 0x28331f;
    vestColor = 0x485834;
    helmetColor = 0x364228;
    pouchesColor = 0x6e6149;
    skinColor = 0xd2a482;
  } else {
    // Mercenary Vanguard charcoal/crimson baseline
    shirtColor = 0x181a1e;
    pantsColor = 0x121316;
    vestColor = 0x241014;
    helmetColor = 0x141518;
    pouchesColor = 0x2a1a1c;
    skinColor = 0xcbb39e;
  }

  /* ------------------------------ MATERIALS ------------------------------ */
  const weaveTex = getBallisticWeaveTexture();
  const scratchTex = getScratchedMetalTexture();

  const matShirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8, bumpMap: weaveTex, bumpScale: 0.006 });
  const matPants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85, bumpMap: weaveTex, bumpScale: 0.006 });
  const matVest = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.75, bumpMap: weaveTex, bumpScale: 0.008 });
  const matPouches = new THREE.MeshStandardMaterial({ color: pouchesColor, roughness: 0.85, bumpMap: weaveTex, bumpScale: 0.006 });
  const matHelmet = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.65, metalness: 0.2, bumpMap: scratchTex, bumpScale: 0.004 });
  const matSkin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
  const matGun = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.32, metalness: 0.88, bumpMap: scratchTex, bumpScale: 0.006 });
  const matBoots = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 });
  const matBootSole = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.95 });
  const matGloves = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.85 });
  const matAccent = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.45,
    roughness: 0.4
  });

  const matBeard = new THREE.MeshStandardMaterial({ color: 0x241c16, roughness: 0.95 });
  const matChevron = new THREE.MeshStandardMaterial({ color: 0xf5d061, roughness: 0.5, metalness: 0.4 });
  const matRedCross = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });
  const matWhiteCross = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 });
  const matSkullMask = new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: 0.7 });
  const matSocketRecess = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.95 });
  const matHoodFabric = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.9, bumpMap: weaveTex, bumpScale: 0.007 });
  const matNvgGlow = new THREE.MeshStandardMaterial({
    color: 0x00ff66,
    emissive: 0x00ff66,
    emissiveIntensity: 2.5,
    roughness: 0.15
  });
  const matFoliage = new THREE.MeshStandardMaterial({ color: 0x3d4b2e, roughness: 0.95 });
  const matFoliageSage = new THREE.MeshStandardMaterial({ color: 0x51603f, roughness: 0.95 });
  const matSteelArmor = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.35, metalness: 0.85, bumpMap: scratchTex, bumpScale: 0.005 });
  const matVisorTint = makeGlassMaterial(0x152219, { opacity: 0.85 });
  const matInnerCavity = new THREE.MeshStandardMaterial({ color: 0x070303, roughness: 0.95 });
  const matBoneRibs = new THREE.MeshStandardMaterial({ color: 0xd8d3bc, roughness: 0.55 });
  const matZombieEyes = new THREE.MeshStandardMaterial({
    color: 0xff0022,
    emissive: 0xff0022,
    emissiveIntensity: 2.8,
    roughness: 0.1
  });
  const matWalkerEyes = new THREE.MeshStandardMaterial({
    color: 0x44ff55,
    emissive: 0x22bb33,
    emissiveIntensity: 1.1,
    roughness: 0.25
  });
  const matBioPustule = new THREE.MeshStandardMaterial({
    color: 0x39ff14,
    emissive: 0x39ff14,
    emissiveIntensity: 2.4,
    roughness: 0.15
  });
  const matBoneCarapace = new THREE.MeshStandardMaterial({ color: 0x9e9780, roughness: 0.5, metalness: 0.2 });
  const matZombieSocket = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1.0 });
  const matZombieClaw = new THREE.MeshStandardMaterial({ color: 0x140808, roughness: 0.4 });
  const matBloaterBelly = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 2.0,
    roughness: 0.35,
    transparent: true,
    opacity: 0.88
  });
  const matCalcifiedArmor = new THREE.MeshStandardMaterial({ color: 0x232428, roughness: 0.88, metalness: 0.35 });
  const matBansheeSkin = new THREE.MeshStandardMaterial({
    color: 0xb8e2f2,
    emissive: 0x0088b3,
    emissiveIntensity: 0.8,
    roughness: 0.5,
    transparent: true,
    opacity: 0.92
  });
  const matBansheeShroud = new THREE.MeshStandardMaterial({
    color: 0x14202c,
    transparent: true,
    opacity: 0.72,
    roughness: 0.9
  });
  const matMegaBossCore = new THREE.MeshStandardMaterial({
    color: 0xff3300,
    emissive: 0xff2200,
    emissiveIntensity: 3.0,
    roughness: 0.2
  });
  const matWireBundle = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 });
  const matTapeWrap = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
  const matZipTie = new THREE.MeshStandardMaterial({ color: 0x2a2a26, roughness: 0.4 });
  const matBrassShell = new THREE.MeshStandardMaterial({ color: 0xb08d3f, roughness: 0.4, metalness: 0.7 });

  flashMats.push(
    matShirt,
    matPants,
    matVest,
    matPouches,
    matHelmet,
    matSkin,
    matBoots,
    matBootSole,
    matGloves,
    matBeard,
    matSkullMask,
    matHoodFabric,
    matFoliage,
    matSteelArmor,
    matBoneCarapace,
    matBloaterBelly,
    matCalcifiedArmor,
    matBansheeSkin,
    matMegaBossCore,
    matAccent
  );

  /* ============================ 1. TORSO ============================ */
  const torsoGroup = new THREE.Group();
  rootGroup.add(torsoGroup);
  if (isZombie) {
    if (zType === 'runner') torsoGroup.rotation.x = 0.61;
    else if (zType === 'walker') torsoGroup.rotation.x = 0.14;
    else if (zType === 'tank') torsoGroup.rotation.x = 0.22;
  }

  const lowerTorso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.22), matPants);
  lowerTorso.position.y = 0.98;
  lowerTorso.castShadow = true;
  torsoGroup.add(lowerTorso);
  hitParts.push(lowerTorso);

  const upperTorso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.26), matShirt);
  upperTorso.position.y = 1.28;
  upperTorso.castShadow = true;
  torsoGroup.add(upperTorso);
  hitParts.push(upperTorso);

  if (!isZombie) {
    if (options.torsoConfig) {
      if (options.torsoConfig === 'molle_vest' || options.torsoConfig === 'CERAMIC_CARRIER' || options.torsoConfig === 'EXO_HARNESS') {
        // Heavy carrier: chamfered frustum plates instead of raw boxes, tapered
        // narrower toward the top so the shoulders have clearance to swing.
        const iotvCarrier = makeChamferedPlate(0.34, 0.40, 0.38, matVest);
        iotvCarrier.position.set(0, 1.29, 0.01);
        iotvCarrier.castShadow = true;
        torsoGroup.add(iotvCarrier);
        hitParts.push(iotvCarrier);

        const neckGuard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.30), matSteelArmor);
        neckGuard.position.set(0, 1.50, 0.01);
        torsoGroup.add(neckGuard);
        hitParts.push(neckGuard);

        [-0.14, -0.05, 0.05, 0.14].forEach((px) => {
          const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.08), matPouches);
          pouch.position.set(px, 1.20, 0.19);
          torsoGroup.add(pouch);
          hitParts.push(pouch);
        });

        if (options.torsoConfig === 'EXO_HARNESS') {
          // Powered load-bearing spine frame
          const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.1), matSteelArmor);
          spine.position.set(0, 1.26, -0.2);
          torsoGroup.add(spine);
          hitParts.push(spine);
          [-0.24, 0.24].forEach((px) => {
            const actuator = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.34, 8), matAccent);
            actuator.position.set(px, 1.24, -0.14);
            torsoGroup.add(actuator);
          });
        }
      } else {
        const standardPlate = makeChamferedPlate(0.29, 0.34, 0.34, matVest);
        standardPlate.position.set(0, 1.28, 0.02);
        torsoGroup.add(standardPlate);
        hitParts.push(standardPlate);

        [-0.12, 0, 0.12].forEach((px) => {
          const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.06), matPouches);
          pouch.position.set(px, 1.18, 0.17);
          torsoGroup.add(pouch);
          hitParts.push(pouch);
        });
      }
    } else {
      const vestMesh = makeChamferedPlate(
        0.32,
        0.38,
        0.34,
        subClass === 'juggernaut' || subClass === 'elite_heavy' ? matSteelArmor : matVest
      );
      vestMesh.position.y = 1.28;
      vestMesh.castShadow = true;
      torsoGroup.add(vestMesh);
      hitParts.push(vestMesh);

      if (['rifleman', 'sergeant', 'ghost', 'infiltrator'].includes(subClass)) {
        [-0.13, 0, 0.13].forEach((px) => {
          const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.14, 0.065), matPouches);
          pouch.position.set(px, 1.22, 0.175);
          pouch.castShadow = true;
          torsoGroup.add(pouch);
          hitParts.push(pouch);
        });
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.09), matPouches);
        sideL.position.set(-0.27, 1.24, 0.02);
        torsoGroup.add(sideL);
        hitParts.push(sideL);
      }
    }

    /* ------------------- FACTION-SPECIFIC ACCESSORY DETAIL ------------------- */
    if (faction === 'usmc') {
      // Chest admin panel with pen/knife insert lines + PTT radio button
      const adminPanel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), matPouches);
      adminPanel.position.set(0.2, 1.15, 0.19);
      torsoGroup.add(adminPanel);
      const insertLineA = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.06, 0.006), matTapeWrap);
      insertLineA.position.set(0.195, 1.15, 0.201);
      const insertLineB = insertLineA.clone();
      insertLineB.position.x = 0.205;
      torsoGroup.add(insertLineA, insertLineB);
      const pttButton = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10), matAccent);
      pttButton.rotation.x = Math.PI / 2;
      pttButton.position.set(-0.24, 1.36, 0.16);
      torsoGroup.add(pttButton);

      // Shoulder-routed antenna: two angled thin cylinder segments
      const antennaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.16, 6), matWireBundle);
      antennaBase.position.set(-0.3, 1.5, -0.04);
      antennaBase.rotation.z = 0.12;
      const antennaTip = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.22, 6), matWireBundle);
      antennaTip.position.set(-0.32, 1.66, -0.06);
      antennaTip.rotation.z = 0.28;
      torsoGroup.add(antennaBase, antennaTip);

      // Dump pouch, left hip
      const dumpPouch = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.09), matPouches);
      dumpPouch.position.set(-0.24, 0.92, 0.05);
      torsoGroup.add(dumpPouch);
      hitParts.push(dumpPouch);
    } else {
      // Mercenary: Kevlar neck collar as a torus arc (curved, not a box)
      const neckCollarGeo = new THREE.TorusGeometry(0.15, 0.035, 8, 16, Math.PI * 1.3);
      const neckCollar = new THREE.Mesh(neckCollarGeo, matSteelArmor);
      neckCollar.rotation.x = Math.PI / 2;
      neckCollar.rotation.z = Math.PI * 0.85;
      neckCollar.position.set(0, 1.48, 0);
      torsoGroup.add(neckCollar);
      hitParts.push(neckCollar);

      // Bolted steel pauldron, left shoulder only (asymmetric)
      const pauldronPlate = makeChamferedPlate(0.1, 0.14, 0.16, matSteelArmor);
      pauldronPlate.position.set(-0.33, 1.46, 0);
      pauldronPlate.rotation.z = 0.1;
      torsoGroup.add(pauldronPlate);
      hitParts.push(pauldronPlate);
      for (let b = 0; b < 4; b++) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 6), matAccent);
        bolt.rotation.x = Math.PI / 2;
        const a = (b / 4) * Math.PI * 2;
        bolt.position.set(-0.33 + Math.cos(a) * 0.06, 1.46 + Math.sin(a) * 0.06, 0.1);
        torsoGroup.add(bolt);
      }

      // Crossed bandolier with shotgun-shell loops
      const bandolier = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.02), matTapeWrap);
      bandolier.position.set(0.05, 1.28, 0.16);
      bandolier.rotation.z = 0.5;
      torsoGroup.add(bandolier);
      for (let s = 0; s < 5; s++) {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.045, 8), matBrassShell);
        shell.position.set(0.05 - 0.06 * s * 0.35, 1.44 - 0.09 * s, 0.17);
        shell.rotation.z = 0.5;
        torsoGroup.add(shell);
      }

      // Zip-tied loose gear
      [0.18, -0.05].forEach((px) => {
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 10), matZipTie);
        tie.position.set(px, 1.1, 0.18);
        torsoGroup.add(tie);
      });

      // High-capacity assault rucksack on the back
      const rucksack = makeChamferedPlate(0.16, 0.2, 0.36, matVest);
      rucksack.position.set(0, 1.24, -0.24);
      rucksack.rotation.y = Math.PI / 4;
      torsoGroup.add(rucksack);
      hitParts.push(rucksack);
    }

    if (subClass === 'corpsman') {
      const medBackpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.20), matVest);
      medBackpack.position.set(0, 1.28, -0.23);
      medBackpack.castShadow = true;
      const patchBg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), matRedCross);
      patchBg.position.set(0, 0, -0.105);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.025), matWhiteCross);
      crossV.position.set(0, 0, -0.108);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.025), matWhiteCross);
      crossH.position.set(0, 0, -0.108);
      medBackpack.add(patchBg, crossV, crossH);
      torsoGroup.add(medBackpack);
      hitParts.push(medBackpack);
    }

    if (subClass === 'pointman') {
      const throatGuard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.26), matVest);
      throatGuard.position.set(0, 1.48, 0.02);
      throatGuard.castShadow = true;
      torsoGroup.add(throatGuard);
      hitParts.push(throatGuard);
    }

    if (subClass === 'recon' || subClass === 'elite_recon') {
      for (let i = 0; i < 8; i++) {
        const mat = i % 2 === 0 ? matFoliage : matFoliageSage;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.04), mat);
        strip.position.set((Math.random() - 0.5) * 0.4, 1.2 + (Math.random() - 0.5) * 0.2, 0.16);
        strip.rotation.set(
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4
        );
        torsoGroup.add(strip);
        hitParts.push(strip);
      }
    }

    if (isSpecializedBot && !eliteRole) {
      if (faction === 'usmc') {
        const breacherNeck = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.28), matVest);
        breacherNeck.position.set(0, 1.48, 0.02);
        breacherNeck.castShadow = true;
        torsoGroup.add(breacherNeck);
        hitParts.push(breacherNeck);

        const breacherGroin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.06), matVest);
        breacherGroin.position.set(0, 0.82, 0.12);
        breacherGroin.castShadow = true;
        torsoGroup.add(breacherGroin);
        hitParts.push(breacherGroin);

        const throatMic = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.04), matGun);
        throatMic.position.set(0, 1.46, 0.145);
        torsoGroup.add(throatMic);

        healthMultiplier *= 1.15;
        speedMultiplier *= 0.95;
      } else {
        const lowVisRig = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.14), matSteelArmor);
        lowVisRig.position.set(0, 1.22, 0.13);
        lowVisRig.castShadow = true;
        torsoGroup.add(lowVisRig);
        hitParts.push(lowVisRig);

        healthMultiplier *= 0.9;
        speedMultiplier *= 1.1;
      }
    }

    if (subClass === 'juggernaut') {
      const waistPlate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.28), matSteelArmor);
      waistPlate.position.y = 0.98;
      torsoGroup.add(waistPlate);
      hitParts.push(waistPlate);
      speedMultiplier = 0.85;
      healthMultiplier = 2.0;
      rootGroup.scale.set(1.15, 1.15, 1.15);
    }

    if (subClass === 'heavy_gunner') {
      rootGroup.scale.set(1.1, 1.1, 1.1);
    }

    /* -------------------- ELITE SQUAD ARCHETYPE KIT -------------------- */
    if (eliteRole) {
      healthMultiplier *= ELITE_STAT_MULTIPLIER;
      speedMultiplier *= 1.05;

      // Cyan command band worn by every elite operator
      const commandBand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.16), matAccent);
      commandBand.position.set(-0.3, 1.34, 0);
      torsoGroup.add(commandBand);

      if (eliteRole === 'heavy') {
        // Titan-2 — double plating, ammo hopper, flexible articulated feed chute
        armorMultiplier = ELITE_HEAVY_ARMOR_MULTIPLIER;
        const frontPlate = makeChamferedPlate(0.36, 0.42, 0.42, matSteelArmor);
        frontPlate.position.set(0, 1.28, 0.2);
        frontPlate.castShadow = true;
        const backPlate = makeChamferedPlate(0.36, 0.42, 0.40, matSteelArmor);
        backPlate.position.set(0, 1.28, -0.2);
        const ammoHopper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.34, 10), matGun);
        ammoHopper.position.set(0, 1.26, -0.3);
        // Articulated ammo chute: three angled cylinder links approximating a
        // flexible belt feed from the hopper into the weapon receiver.
        const chuteLinkA = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 8), matSteelArmor);
        chuteLinkA.position.set(0.14, 1.32, -0.16);
        chuteLinkA.rotation.set(0.2, 0.5, 1.1);
        const chuteLinkB = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 8), matSteelArmor);
        chuteLinkB.position.set(0.24, 1.24, -0.04);
        chuteLinkB.rotation.set(0.1, 0.9, 1.3);
        const chuteLinkC = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 8), matSteelArmor);
        chuteLinkC.position.set(0.28, 1.1, 0.1);
        chuteLinkC.rotation.set(-0.1, 1.1, 1.5);
        torsoGroup.add(frontPlate, backPlate, ammoHopper, chuteLinkA, chuteLinkB, chuteLinkC);
        hitParts.push(frontPlate, backPlate, ammoHopper);
        rootGroup.scale.set(1.12, 1.12, 1.12);
        speedMultiplier *= 0.88;
      } else if (eliteRole === 'medic') {
        // Doc-3 — trauma pack w/ visible blood bags & tourniquets, shoulder emitter
        const medPack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.22), matVest);
        medPack.position.set(0, 1.28, -0.24);
        const bloodBagA = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.11, 0.03),
          new THREE.MeshStandardMaterial({ color: 0x8a1010, roughness: 0.3, transparent: true, opacity: 0.85 })
        );
        bloodBagA.position.set(-0.1, 1.4, -0.12);
        const bloodBagB = bloodBagA.clone();
        bloodBagB.position.set(0.1, 1.4, -0.12);
        const tourniquetA = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 12), matTapeWrap);
        tourniquetA.position.set(-0.28, 1.14, 0.02);
        tourniquetA.rotation.y = Math.PI / 2;
        const emitter = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.11, 0.16, 12),
          new THREE.MeshStandardMaterial({
            color: 0x22c55e,
            emissive: 0x22c55e,
            emissiveIntensity: 2.2,
            roughness: 0.2
          })
        );
        emitter.position.set(0, 1.5, -0.26);
        const patchBg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.02), matWhiteCross);
        patchBg.position.set(0, 1.3, 0.2);
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.03), matRedCross);
        crossV.position.set(0, 1.3, 0.212);
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.03), matRedCross);
        crossH.position.set(0, 1.3, 0.212);
        torsoGroup.add(medPack, bloodBagA, bloodBagB, tourniquetA, emitter, patchBg, crossV, crossH);
        hitParts.push(medPack);
      } else if (eliteRole === 'recon') {
        // Spectre-4 — ghillie thread bundles, rangefinder monocular, telemetry dish
        for (let g = 0; g < 10; g++) {
          const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1 + Math.random() * 0.08, 5), matFoliage);
          thread.position.set(
            (Math.random() - 0.5) * 0.5,
            1.1 + Math.random() * 0.5,
            -0.1 + (Math.random() - 0.5) * 0.2
          );
          thread.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
          torsoGroup.add(thread);
        }
        const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), matSteelArmor);
        dishMast.position.set(-0.24, 1.5, -0.12);
        const dish = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.02, 14),
          new THREE.MeshStandardMaterial({
            color: 0xff3344,
            emissive: 0xff2233,
            emissiveIntensity: 1.6,
            roughness: 0.3
          })
        );
        dish.position.set(-0.24, 1.64, -0.12);
        dish.rotation.x = 0.5;
        torsoGroup.add(dishMast, dish);
        speedMultiplier *= 1.12;
      } else {
        // Wrench-5 — welder's apron, oxy-acetylene mini-tanks, slung tripod
        const apron = makeChamferedPlate(0.24, 0.3, 0.5, matTapeWrap);
        apron.position.set(0, 1.02, 0.16);
        const toolBelt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.26), matPouches);
        toolBelt.position.set(0, 1.02, 0);
        const foldedTripod = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.1), matSteelArmor);
        foldedTripod.position.set(0.16, 1.3, -0.26);
        foldedTripod.rotation.z = 0.28;
        const oxyTankA = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), matAccent);
        oxyTankA.position.set(-0.22, 1.28, -0.2);
        const oxyTankB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), matSteelArmor);
        oxyTankB.position.set(-0.11, 1.28, -0.24);
        torsoGroup.add(apron, toolBelt, foldedTripod, oxyTankA, oxyTankB);
        hitParts.push(toolBelt, foldedTripod, apron);
      }
    }
  } else {
    /* --------------------------- ZOMBIE TORSO --------------------------- */
    const chestCavity = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.09), matInnerCavity);
    chestCavity.position.set(0, 1.28, 0.11);
    torsoGroup.add(chestCavity);

    // Torn uniform fabric shreds hanging asymmetrically off the exposed cavity
    for (let t = 0; t < 4; t++) {
      const shred = new THREE.Mesh(new THREE.BoxGeometry(0.05 + Math.random() * 0.05, 0.16 + Math.random() * 0.1, 0.015), matShirt);
      shred.position.set(-0.24 + t * 0.16, 1.1 + Math.random() * 0.06, 0.14);
      shred.rotation.z = (Math.random() - 0.5) * 0.5;
      shred.rotation.x = 0.15 + Math.random() * 0.2;
      torsoGroup.add(shred);
    }

    [1.16, 1.23, 1.3, 1.37].forEach((ry, idx) => {
      const ribW = idx === 0 || idx === 3 ? 0.24 : 0.3;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(ribW, 0.024, 0.052), matBoneRibs);
      rib.position.set(0, ry, 0.155);
      rib.castShadow = true;
      torsoGroup.add(rib);
      hitParts.push(rib);
    });

    if (zType === 'runner') {
      const pustulePositions = [
        [-0.22, 1.45, 0.06],
        [0.22, 1.45, 0.06],
        [-0.18, 1.48, -0.05],
        [0.18, 1.48, -0.05],
        [0.0, 1.42, -0.14],
        [0.03, 1.28, -0.15],
        [-0.03, 1.16, -0.14],
        [-0.14, 1.36, 0.12],
        [0.14, 1.36, 0.12]
      ];
      pustulePositions.forEach(([px, py, pz]) => {
        const pus = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045, 0), matBioPustule);
        pus.position.set(px, py, pz);
        torsoGroup.add(pus);
        hitParts.push(pus);
      });
    } else if (zType === 'brute') {
      const chestArmor = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.44, 0.28), matCalcifiedArmor);
      chestArmor.position.set(0, 1.28, 0.12);
      chestArmor.castShadow = true;
      const carapaceL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.32), matBoneCarapace);
      carapaceL.position.set(-0.38, 1.48, 0);
      carapaceL.castShadow = true;
      const carapaceR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.32), matBoneCarapace);
      carapaceR.position.set(0.38, 1.48, 0);
      carapaceR.castShadow = true;
      const spinePlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.14), matCalcifiedArmor);
      spinePlate.position.set(0, 1.28, -0.16);
      spinePlate.castShadow = true;
      const spikeL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 6), matBoneCarapace);
      spikeL.position.set(-0.44, 1.56, 0);
      spikeL.rotation.z = 0.55;
      const spikeR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 6), matBoneCarapace);
      spikeR.position.set(0.44, 1.56, 0);
      spikeR.rotation.z = -0.55;
      torsoGroup.add(chestArmor, carapaceL, carapaceR, spinePlate, spikeL, spikeR);
      hitParts.push(chestArmor, carapaceL, carapaceR, spinePlate, spikeL, spikeR);
    } else if (zType === 'bloater') {
      const bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), matBloaterBelly);
      bellyMesh.scale.set(1.18, 0.96, 1.26);
      bellyMesh.position.set(0, 1.05, 0.2);
      bellyMesh.castShadow = true;
      torsoGroup.add(bellyMesh);
      hitParts.push(bellyMesh);

      const pustulePositions = [
        [-0.18, 1.34, 0.14],
        [0.18, 1.34, 0.14],
        [0.0, 1.28, 0.24],
        [-0.22, 1.1, 0.18],
        [0.22, 1.1, 0.18]
      ];
      pustulePositions.forEach(([px, py, pz]) => {
        const pus = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055, 0), matBioPustule);
        pus.position.set(px, py, pz);
        torsoGroup.add(pus);
        hitParts.push(pus);
      });
    } else if (zType === 'banshee') {
      for (let i = 0; i < 4; i++) {
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.82, 0.02), matBansheeShroud);
        ribbon.position.set((i - 1.5) * 0.14, 0.88, -0.12);
        ribbon.rotation.x = 0.18;
        ribbon.rotation.z = (i - 1.5) * 0.08;
        torsoGroup.add(ribbon);
      }
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 4), matBansheeSkin);
      crest.position.set(0, 1.48, 0.08);
      crest.rotation.x = 0.4;
      torsoGroup.add(crest);
      hitParts.push(crest);
    } else if (zType === 'megaboss') {
      const coreMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), matMegaBossCore);
      coreMesh.position.set(0, 1.28, 0.16);
      coreMesh.castShadow = true;
      const carapaceL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.36), matBoneCarapace);
      carapaceL.position.set(-0.42, 1.5, 0);
      carapaceL.castShadow = true;
      const carapaceR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.36), matBoneCarapace);
      carapaceR.position.set(0.42, 1.5, 0);
      carapaceR.castShadow = true;
      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.32, 0.16), matBoneCarapace);
      chestPlate.position.set(0, 1.38, 0.18);
      chestPlate.castShadow = true;
      const spinePlate1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.16), matBoneCarapace);
      spinePlate1.position.set(0, 1.42, -0.2);
      spinePlate1.castShadow = true;
      const spinePlate2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.14), matBoneCarapace);
      spinePlate2.position.set(0, 1.2, -0.18);
      spinePlate2.castShadow = true;
      torsoGroup.add(coreMesh, carapaceL, carapaceR, chestPlate, spinePlate1, spinePlate2);
      hitParts.push(coreMesh, carapaceL, carapaceR, chestPlate, spinePlate1, spinePlate2);
    } else if (zType === 'tank') {
      const carapaceL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.28), matBoneCarapace);
      carapaceL.position.set(-0.35, 1.46, 0);
      carapaceL.castShadow = true;
      const carapaceR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.28), matBoneCarapace);
      carapaceR.position.set(0.35, 1.46, 0);
      carapaceR.castShadow = true;
      torsoGroup.add(carapaceL, carapaceR);
      hitParts.push(carapaceL, carapaceR);
    }
  }

  /* ============================ 2. NECK ============================ */
  if (!isZombie) {
    const neckCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.24, 12), matSkin);
    neckCylinder.position.set(0, 1.42, 0);
    neckCylinder.castShadow = true;
    torsoGroup.add(neckCylinder);
    hitParts.push(neckCylinder);
  }

  /* ============================ 3. HEAD ============================ */
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0);
  torsoGroup.add(headGroup);

  if (!isZombie) {
    // Non-uniformly scaled sphere instead of a box gives a real cranium
    // silhouette; a small wedge underneath suggests the jawline.
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), matSkin);
    headMesh.scale.set(0.9, 1.05, 0.96);
    headMesh.position.y = 0.08;
    headMesh.castShadow = true;
    headGroup.add(headMesh);
    hitParts.push(headMesh);
    headParts.add(headMesh);

    const jawWedge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.09, 0.07, 4, 1), matSkin);
    jawWedge.rotation.set(Math.PI, Math.PI / 4, 0);
    jawWedge.position.set(0, -0.035, 0.03);
    jawWedge.scale.set(1.0, 0.6, 1.15);
    headGroup.add(jawWedge);
    hitParts.push(jawWedge);

    const hg = options.headgear;
    if (hg) {
      if (hg === 'fast' || hg === 'FAST_HELMET') {
        // Half-sphere shell reads as a real dome rather than a cube.
        const helmetMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
          matHelmet
        );
        helmetMesh.position.set(0, 0.16, -0.02);
        helmetMesh.castShadow = true;
        headGroup.add(helmetMesh);
        hitParts.push(helmetMesh);
        headParts.add(helmetMesh);

        // Ear cutout notches: small dark inset boxes over the shell
        [-1, 1].forEach((side) => {
          const notch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.09), matSocketRecess);
          notch.position.set(side * 0.15, 0.08, 0.01);
          headGroup.add(notch);
        });

        const nvgBracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.04), matSteelArmor);
        nvgBracket.position.set(0, 0.16, 0.15);
        headGroup.add(nvgBracket);

        // Rail teeth along both sides of the shell
        for (let r = 0; r < 5; r++) {
          const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.03), matSteelArmor);
          tooth.position.set(-0.155, 0.14, 0.06 - r * 0.035);
          const toothR = tooth.clone();
          toothR.position.x = 0.155;
          headGroup.add(tooth, toothR);
        }

        // Ops-Core headset ear cups + flexible boom mic
        const commL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), matSteelArmor);
        commL.rotation.z = Math.PI / 2;
        commL.position.set(-0.15, 0.04, 0);
        const commR = commL.clone();
        commR.position.x = 0.15;
        headGroup.add(commL, commR);
        const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.12, 6), matGun);
        boomArm.position.set(-0.1, 0.0, 0.09);
        boomArm.rotation.set(0, 0.4, 1.3);
        const boomMic = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.02, 8), matGun);
        boomMic.position.set(-0.05, -0.04, 0.14);
        headGroup.add(boomArm, boomMic);

        // Flip-down dual-tube PVS-31 NVG, modeled in the lowered position
        const nvgBridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), matSteelArmor);
        nvgBridge.position.set(0, -0.02, 0.17);
        [-1, 1].forEach((side) => {
          const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.09, 10), matSteelArmor);
          tube.rotation.x = Math.PI / 2;
          tube.position.set(side * 0.045, -0.02, 0.21);
          const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), matNvgGlow);
          lens.position.set(side * 0.045, -0.02, 0.255);
          headGroup.add(tube, lens);
        });
        headGroup.add(nvgBridge);

        // ESS ballistic goggles strapped over the crown — a curved torus arc
        const gogglesBand = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 16, Math.PI * 0.7), matTapeWrap);
        gogglesBand.rotation.set(Math.PI / 2, 0, Math.PI / 2);
        gogglesBand.position.set(0, 0.24, -0.02);
        headGroup.add(gogglesBand);
      } else if (hg === 'HEAVY_EOD_VISOR') {
        const eodShell = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), matSteelArmor);
        eodShell.position.set(0, 0.16, -0.01);
        eodShell.castShadow = true;
        const eodVisor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), matVisorTint);
        eodVisor.position.set(0, 0.1, 0.17);
        const eodCollar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.34), matSteelArmor);
        eodCollar.position.set(0, -0.04, 0);
        headGroup.add(eodShell, eodVisor, eodCollar);
        hitParts.push(eodShell, eodCollar);
        headParts.add(eodShell);
      } else if (hg === 'boonie') {
        const hatBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.26), matVest);
        hatBase.position.set(0, 0.18, 0);
        const hatRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16), matVest);
        hatRim.position.set(0, 0.14, 0);
        headGroup.add(hatBase, hatRim);
        hitParts.push(hatBase);
        headParts.add(hatBase);
      } else if (hg === 'skull' || hg === 'BALLISTIC_SKULL') {
        const skullMask = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.13), matSkullMask);
        skullMask.position.set(0, 0.02, 0.1);
        skullMask.castShadow = true;
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.045), matSocketRecess);
        eyeL.position.set(-0.06, 0.05, 0.15);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.045), matSocketRecess);
        eyeR.position.set(0.06, 0.05, 0.15);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.25), matShirt);
        cap.position.set(0, 0.22, 0);
        headGroup.add(skullMask, eyeL, eyeR, cap);
        hitParts.push(skullMask, cap);
        headParts.add(skullMask);
        headParts.add(cap);
      }
    } else if (subClass === 'elite_heavy') {
      const helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
        matSteelArmor
      );
      helmetMesh.position.set(0, 0.16, -0.02);
      helmetMesh.castShadow = true;
      const faceShield = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.04), matSteelArmor);
      faceShield.position.set(0, 0.08, 0.15);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), matAccent);
      slit.position.set(0, 0.1, 0.155);
      headGroup.add(helmetMesh, faceShield, slit);
      hitParts.push(helmetMesh, faceShield);
      headParts.add(helmetMesh);
      headParts.add(faceShield);
    } else if (subClass === 'elite_medic') {
      const helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
        matHelmet
      );
      helmetMesh.position.set(0, 0.16, -0.02);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.02), matWhiteCross);
      crossV.position.set(0, 0.17, 0.155);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.02), matWhiteCross);
      crossH.position.set(0, 0.17, 0.155);
      headGroup.add(helmetMesh, crossV, crossH);
      hitParts.push(helmetMesh);
      headParts.add(helmetMesh);
    } else if (subClass === 'elite_recon') {
      const helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
        matHelmet
      );
      helmetMesh.position.set(0, 0.16, -0.02);
      headGroup.add(helmetMesh);
      hitParts.push(helmetMesh);
      headParts.add(helmetMesh);
      for (let i = 0; i < 6; i++) {
        const mat = i % 2 === 0 ? matFoliage : matFoliageSage;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), mat);
        strip.position.set((Math.random() - 0.5) * 0.26, 0.22 + Math.random() * 0.06, (Math.random() - 0.5) * 0.26);
        strip.rotation.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4);
        headGroup.add(strip);
      }
      const monocle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), matNvgGlow);
      monocle.rotation.x = Math.PI / 2;
      monocle.position.set(0.055, 0.13, 0.17);
      headGroup.add(monocle);
    } else if (subClass === 'elite_engineer') {
      const helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
        matHelmet
      );
      helmetMesh.position.set(0, 0.16, -0.02);
      const goggleBridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), matPouches);
      goggleBridge.position.set(0, 0.2, 0.14);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.03), matVisorTint);
      lens.position.set(0, 0.2, 0.17);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.04, 10), matAccent);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(-0.1, 0.24, 0.13);
      // Flip-down tinted blast visor
      const flipVisor = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.015), matVisorTint);
      flipVisor.position.set(0, 0.06, 0.165);
      headGroup.add(helmetMesh, goggleBridge, lens, lamp, flipVisor);
      hitParts.push(helmetMesh);
      headParts.add(helmetMesh);
    } else if (subClass === 'sergeant') {
      const capCrown = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), matHelmet);
      capCrown.position.set(0, 0.16, 0);
      const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.11), matHelmet);
      capBrim.position.set(0, 0.11, -0.16);
      headGroup.add(capCrown, capBrim);
      hitParts.push(capCrown, capBrim);
      headParts.add(capCrown);
      headParts.add(capBrim);

      const beardJaw = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.09, 0.14), matBeard);
      beardJaw.position.set(0, 0.01, 0.1);
      const beardChin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.08), matBeard);
      beardChin.position.set(0, -0.04, 0.13);
      headGroup.add(beardJaw, beardChin);
      hitParts.push(beardJaw, beardChin);
      headParts.add(beardJaw);
      headParts.add(beardChin);

      const earL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), matPouches);
      earL.position.set(-0.15, 0.08, 0);
      const earR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), matPouches);
      earR.position.set(0.15, 0.08, 0);
      const mic = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.13), matGun);
      mic.position.set(-0.13, 0.03, 0.08);
      mic.rotation.y = 0.35;
      headGroup.add(earL, earR, mic);
    } else if (subClass === 'heavy_gunner') {
      const helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
        matHelmet
      );
      helmetMesh.position.set(0, 0.16, -0.02);
      const faceShield = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.04), matHelmet);
      faceShield.position.set(0, 0.08, 0.14);
      const visionSlit = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.05), matVisorTint);
      visionSlit.position.set(0, 0.1, 0.145);
      headGroup.add(helmetMesh, faceShield, visionSlit);
      hitParts.push(helmetMesh, faceShield);
      headParts.add(helmetMesh);
      headParts.add(faceShield);
    } else if (subClass === 'engineer') {
      const helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
        matHelmet
      );
      helmetMesh.position.set(0, 0.16, -0.02);
      const goggleBridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.07), matPouches);
      goggleBridge.position.set(0, 0.17, 0.15);
      const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8), matVisorTint);
      lensL.rotation.x = Math.PI / 2;
      lensL.position.set(-0.05, 0.17, 0.19);
      const lensR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8), matVisorTint);
      lensR.rotation.x = Math.PI / 2;
      lensR.position.set(0.05, 0.17, 0.19);
      headGroup.add(helmetMesh, goggleBridge, lensL, lensR);
      hitParts.push(helmetMesh);
      headParts.add(helmetMesh);
    } else if (subClass === 'ghost') {
      const skullPlate = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.19, 0.05), matSkullMask);
      skullPlate.position.set(0, 0.05, 0.14);
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.045), matSocketRecess);
      eyeL.position.set(-0.06, 0.09, 0.15);
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.045), matSocketRecess);
      eyeR.position.set(0.06, 0.09, 0.15);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.035, 0.045), matSocketRecess);
      nose.position.set(0, 0.04, 0.15);
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.045), matSocketRecess);
      teeth.position.set(0, -0.015, 0.16);
      const hoodBack = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.28, 0.15), matHoodFabric);
      hoodBack.position.set(0, 0.07, -0.08);
      const hoodCollar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.24), matHoodFabric);
      hoodCollar.position.set(0, -0.05, 0);
      // Taped comms wiring from the mask down to the collar
      const wireA = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 6), matWireBundle);
      wireA.position.set(-0.11, -0.02, 0.09);
      wireA.rotation.set(0.3, 0, 0.6);
      const wireB = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6), matWireBundle);
      wireB.position.set(-0.14, -0.12, 0.02);
      wireB.rotation.set(0.6, 0, 0.3);
      headGroup.add(skullPlate, eyeL, eyeR, nose, teeth, hoodBack, hoodCollar, wireA, wireB);
      hitParts.push(skullPlate, hoodBack);
      headParts.add(skullPlate);
      headParts.add(hoodBack);
    } else if (subClass === 'infiltrator') {
      const balaclava = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.7), matHoodFabric);
      balaclava.position.y = 0.05;
      // Quad-tube panoramic GPNVG-18 in a 2x2 cluster
      [-0.05, 0.05].forEach((lx) => {
        [0.03, -0.03].forEach((ly) => {
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.05, 8), matPouches);
          barrel.rotation.x = Math.PI / 2;
          barrel.position.set(lx, 0.15 + ly, 0.24);
          const glowLens = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 8), matNvgGlow);
          glowLens.rotation.x = Math.PI / 2;
          glowLens.position.set(lx, 0.15 + ly, 0.265);
          headGroup.add(barrel, glowLens);
          hitParts.push(barrel);
        });
      });
      const nvgMountArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.08), matPouches);
      nvgMountArm.position.set(0, 0.17, 0.18);
      headGroup.add(balaclava, nvgMountArm);
      hitParts.push(balaclava);
      headParts.add(balaclava);
    } else if (subClass === 'recon') {
      const helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
        matHelmet
      );
      helmetMesh.position.set(0, 0.16, -0.02);
      headGroup.add(helmetMesh);
      hitParts.push(helmetMesh);
      headParts.add(helmetMesh);

      for (let i = 0; i < 8; i++) {
        const mat = i % 2 === 0 ? matFoliage : matFoliageSage;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), mat);
        strip.position.set((Math.random() - 0.5) * 0.26, 0.22 + Math.random() * 0.06, (Math.random() - 0.5) * 0.26);
        strip.rotation.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4);
        headGroup.add(strip);
        hitParts.push(strip);
      }
    } else {
      const helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
        subClass === 'juggernaut' ? matSteelArmor : matHelmet
      );
      helmetMesh.position.set(0, 0.16, -0.02);
      helmetMesh.castShadow = true;
      const visorBrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.024, 0.09),
        subClass === 'juggernaut' ? matSteelArmor : matHelmet
      );
      visorBrim.position.set(0, 0.1, 0.16);
      visorBrim.rotation.x = 0.16;
      headGroup.add(helmetMesh, visorBrim);
      hitParts.push(helmetMesh, visorBrim);
      headParts.add(helmetMesh);
      headParts.add(visorBrim);

      if (isSpecializedBot && faction === 'apex') {
        const mandible = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.12), matSteelArmor);
        mandible.position.set(0, 0.02, 0.09);
        headGroup.add(mandible);
        hitParts.push(mandible);
        headParts.add(mandible);

        const headsetL = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.06, 10), matPouches);
        headsetL.rotation.z = Math.PI / 2;
        headsetL.position.set(-0.15, 0.08, 0);
        const headsetR = headsetL.clone();
        headsetR.position.x = 0.15;
        headGroup.add(headsetL, headsetR);
      }
    }
  } else {
    const skullTop = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), matSkin);
    skullTop.scale.set(0.92, 0.86, 0.98);
    skullTop.position.y = 0.1;
    skullTop.castShadow = true;
    headGroup.add(skullTop);
    hitParts.push(skullTop);
    headParts.add(skullTop);

    const innerMaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), matInnerCavity);
    innerMaw.position.set(0, 0.03, 0.02);
    headGroup.add(innerMaw);

    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.2), matSkin);
    lowerJaw.position.set(0, -0.06, 0.06);
    lowerJaw.rotation.x = 0.38;
    headGroup.add(lowerJaw);
    hitParts.push(lowerJaw);
    headParts.add(lowerJaw);

    const upperTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.03), matBoneRibs);
    upperTeeth.position.set(0, 0.06, 0.115);
    const lowerTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.03), matBoneRibs);
    lowerTeeth.position.set(0, -0.025, 0.115);
    headGroup.add(upperTeeth, lowerTeeth);

    const activeEyeMat =
      zType === 'walker' ? matWalkerEyes : zType === 'runner' ? matBioPustule : matZombieEyes;
    const socketL = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.035), matZombieSocket);
    socketL.position.set(-0.055, 0.11, 0.125);
    const socketR = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.035), matZombieSocket);
    socketR.position.set(0.055, 0.11, 0.125);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.025), activeEyeMat);
    eyeL.position.set(-0.055, 0.11, 0.136);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.025), activeEyeMat);
    eyeR.position.set(0.055, 0.11, 0.136);
    headGroup.add(socketL, socketR, eyeL, eyeR);
  }

  /* ============================ 4. ARMS ============================ */
  const armLPivot = new THREE.Group();
  armLPivot.position.set(-0.3, 1.42, 0);
  torsoGroup.add(armLPivot);

  const armRPivot = new THREE.Group();
  armRPivot.position.set(0.3, 1.42, 0);
  torsoGroup.add(armRPivot);

  const armLLowerPivot = new THREE.Group();
  const armRLowerPivot = new THREE.Group();

  let gunMeshRef: THREE.Group | null = null;
  let muzzleFlashRef: THREE.Sprite | null = null;

  if (!isZombie) {
    const isApexSpecialized = isSpecializedBot && faction === 'apex';
    const isUsmcSpecialized = isSpecializedBot && faction === 'usmc';
    const lowerArmMat = isApexSpecialized ? matSkin : matShirt;

    // Tapered biceps (wider at the shoulder) instead of a straight box.
    const armLUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.26, 8), matShirt);
    armLUpper.position.set(0, -0.13, 0);
    armLUpper.castShadow = true;
    armLPivot.add(armLUpper);
    hitParts.push(armLUpper);
    const elbowCapL = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), matShirt);
    elbowCapL.position.set(0, -0.26, 0);
    armLPivot.add(elbowCapL);

    armLLowerPivot.position.set(0, -0.26, 0);
    armLPivot.add(armLLowerPivot);
    const armLLower = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.26, 8), lowerArmMat);
    armLLower.position.set(0, -0.13, 0.02);
    armLLower.castShadow = true;
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1), matGloves);
    handL.position.set(0, -0.27, 0.02);
    armLLowerPivot.add(armLLower, handL);
    hitParts.push(armLLower, handL);

    const armRUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.26, 8), matShirt);
    armRUpper.position.set(0, -0.13, 0);
    armRUpper.castShadow = true;
    armRPivot.add(armRUpper);
    hitParts.push(armRUpper);
    const elbowCapR = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), matShirt);
    elbowCapR.position.set(0, -0.26, 0);
    armRPivot.add(elbowCapR);

    armRLowerPivot.position.set(0, -0.26, 0);
    armRPivot.add(armRLowerPivot);
    const armRLower = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.26, 8), lowerArmMat);
    armRLower.position.set(0, -0.13, 0.02);
    armRLower.castShadow = true;
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1), matGloves);
    handR.position.set(0, -0.27, 0.02);
    armRLowerPivot.add(armRLower, handR);
    hitParts.push(armRLower, handR);

    if (isUsmcSpecialized || subClass === 'elite_heavy') {
      const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.16), matVest);
      pauldronL.position.set(0, -0.06, 0);
      armLUpper.add(pauldronL);
      const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.16), matVest);
      pauldronR.position.set(0, -0.06, 0);
      armRUpper.add(pauldronR);
    }

    if (subClass === 'sergeant') {
      [-0.01, 0, 0.01].forEach((cy) => {
        const chevL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 0.08), matChevron);
        chevL.position.set(-0.065, -0.1 + cy * 2, 0);
        armLUpper.add(chevL);
        const chevR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 0.08), matChevron);
        chevR.position.set(0.065, -0.1 + cy * 2, 0);
        armRUpper.add(chevR);
      });
    }

    if (subClass === 'corpsman' || subClass === 'elite_medic') {
      const redPatchL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.08), matRedCross);
      redPatchL.position.set(-0.065, -0.1, 0);
      const crossVL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), matWhiteCross);
      crossVL.position.set(-0.066, -0.1, 0);
      const crossHL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), matWhiteCross);
      crossHL.position.set(-0.066, -0.1, 0);
      armLUpper.add(redPatchL, crossVL, crossHL);

      const redPatchR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.08), matRedCross);
      redPatchR.position.set(0.065, -0.1, 0);
      const crossVR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), matWhiteCross);
      crossVR.position.set(0.066, -0.1, 0);
      const crossHR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), matWhiteCross);
      crossHR.position.set(0.066, -0.1, 0);
      armRUpper.add(redPatchR, crossVR, crossHR);
    }

    if (subClass === 'heavy_gunner' || subClass === 'juggernaut') {
      const matPaul = subClass === 'juggernaut' ? matSteelArmor : matVest;
      const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), matPaul);
      pauldronL.position.set(-0.03, -0.04, 0);
      armLPivot.add(pauldronL);
      hitParts.push(pauldronL);

      const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), matPaul);
      pauldronR.position.set(0.03, -0.04, 0);
      armRPivot.add(pauldronR);
      hitParts.push(pauldronR);
    }

    armRPivot.rotation.set(-0.45, -0.15, 0);
    armRLowerPivot.rotation.x = -0.22;
    armLPivot.rotation.set(-0.45, 0.25, 0);
    armLLowerPivot.rotation.x = -0.35;

    const gGun = new THREE.Group();
    const barrelLen =
      weaponType === 'shotgun'
        ? 0.26
        : weaponType === 'sniper'
        ? 0.58
        : weaponType === 'pistol'
        ? 0.18
        : weaponType === 'lmg' || weaponType === 'minigun'
        ? 0.46
        : 0.32;
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.11, weaponType === 'pistol' ? 0.22 : 0.32),
      matGun
    );
    const isFluted = weaponType === 'sniper' || weaponType === 'lmg';
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, barrelLen, isFluted ? 10 : 6), matGun);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, barrelLen / 2 + 0.14);
    gGun.add(receiver, barrel);

    if (isFluted) {
      // Fluting: 5 thin darker recess grooves running the barrel length
      for (let f = 0; f < 5; f++) {
        const a = (f / 5) * Math.PI * 2;
        const flute = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, barrelLen * 0.85, 5), matSteelArmor);
        flute.rotation.x = Math.PI / 2;
        flute.position.set(Math.cos(a) * 0.014, 0.015 + Math.sin(a) * 0.014, barrelLen / 2 + 0.14);
        gGun.add(flute);
      }
    }

    // Ringed flash hider with a visible venting shadow ring
    const flashHiderOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.055, 10), matGun);
    flashHiderOuter.rotation.x = Math.PI / 2;
    flashHiderOuter.position.set(0, 0.015, barrelLen + 0.14 + 0.02);
    const flashHiderVent = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.057, 10), matSocketRecess);
    flashHiderVent.rotation.x = Math.PI / 2;
    flashHiderVent.position.copy(flashHiderOuter.position);
    gGun.add(flashHiderOuter, flashHiderVent);

    if (weaponType === 'lmg' || weaponType === 'minigun') {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 12), matGun);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(0, -0.09, 0.04);
      gGun.add(drum);
    } else {
      // Curved "banana" magazine composed of two angled box segments —
      // the layered-prism technique for shapes too complex for a single box.
      const magSegA = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.1, 0.05), matGun);
      magSegA.position.set(0, -0.12, 0.02);
      magSegA.rotation.x = 0.12;
      const magSegB = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, 0.048), matGun);
      magSegB.position.set(0, -0.2, -0.02);
      magSegB.rotation.x = 0.32;
      gGun.add(magSegA, magSegB);
    }

    gGun.position.set(0, -0.3, 0.16);
    gGun.rotation.x = 0.45;
    armRLowerPivot.add(gGun);
    gunMeshRef = gGun;

    const muzzleFlash = makeFlashSprite(true);
    muzzleFlash.position.set(0, 0.015, barrelLen + 0.16);
    gGun.add(muzzleFlash);
    muzzleFlashRef = muzzleFlash;

    /* ---- 3D compound starburst, slaved to the sprite's own animation ----
     * The sprite's scale/opacity is already driven every frame by App.tsx's
     * existing per-shot timer. Rather than add a second animation path (which
     * would need App.tsx changes, out of scope this pass), the starburst
     * mirrors the sprite via onBeforeRender — a per-object hook Three.js
     * already calls each frame the sprite is rendered, so this works with
     * zero changes anywhere else. */
    const starburstGroup = new THREE.Group();
    starburstGroup.position.copy(muzzleFlash.position);
    starburstGroup.scale.setScalar(0);
    const bladeMat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    for (let bl = 0; bl < 4; bl++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.014), bladeMat);
      blade.rotation.z = (bl / 4) * Math.PI;
      starburstGroup.add(blade);
    }
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const coreCone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), coreMat);
    coreCone.rotation.x = -Math.PI / 2;
    coreCone.position.z = 0.03;
    starburstGroup.add(coreCone);
    const starburstLight = new THREE.PointLight(0xff9922, 0, 6, 1.4);
    starburstGroup.add(starburstLight);
    gGun.add(starburstGroup);

    muzzleFlash.onBeforeRender = () => {
      const k = muzzleFlash.scale.x;
      starburstGroup.visible = k > 0.02;
      starburstGroup.scale.setScalar(k * 1.6);
      starburstGroup.rotation.z += 0.5;
      const op = muzzleFlash.material.opacity ?? 0;
      bladeMat.opacity = op;
      coreMat.opacity = op * 0.9;
      starburstLight.intensity = 4.5 * op;
    };
  } else {
    armLPivot.rotation.set(-1.35, 0.12, 0);
    armRPivot.rotation.set(-1.35, -0.12, 0);

    const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.058, 0.44, 8), matSkin);
    armLMesh.position.set(0, -0.2, 0);
    armLMesh.castShadow = true;
    armLPivot.add(armLMesh);
    hitParts.push(armLMesh);

    const armRUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.46, 8), matSkin);
    armRUpper.position.set(0, -0.21, 0);
    armRUpper.castShadow = true;
    armRPivot.add(armRUpper);
    hitParts.push(armRUpper);

    const boneSpur = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), matBoneRibs);
    boneSpur.position.set(0.08, -0.4, 0);
    boneSpur.rotation.z = -0.6;
    armRPivot.add(boneSpur);
    hitParts.push(boneSpur);

    const armRForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.06, 0.58, 8), matSkin);
    armRForearm.position.set(0.06, -0.66, 0.06);
    armRForearm.rotation.z = -0.22;
    armRForearm.rotation.x = -0.32;
    armRForearm.castShadow = true;
    armRPivot.add(armRForearm);
    hitParts.push(armRForearm);

    const clawHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), matSkin);
    clawHand.position.set(0.08, -0.98, 0.1);
    // Jagged bone talons, ~0.2m as specified
    const talon1 = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.2, 4), matZombieClaw);
    talon1.position.set(0.05, -1.14, 0.08);
    talon1.rotation.x = Math.PI;
    const talon2 = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.2, 4), matZombieClaw);
    talon2.position.set(0.11, -1.14, 0.12);
    talon2.rotation.x = Math.PI;
    armRPivot.add(clawHand, talon1, talon2);
    hitParts.push(clawHand);
  }

  /* ============================ 5. LEGS ============================ */
  const legLPivot = new THREE.Group();
  legLPivot.position.set(-0.13, 0.86, 0);
  rootGroup.add(legLPivot);

  const legRPivot = new THREE.Group();
  legRPivot.position.set(0.13, 0.86, 0);
  rootGroup.add(legRPivot);

  const legLLowerPivot = new THREE.Group();
  const legRLowerPivot = new THREE.Group();

  /** Sole + raised heel + tapered toe cap, replacing a single flat box boot. */
  function buildBoot(): THREE.Group {
    const bootGroup = new THREE.Group();
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.035, 0.24), matBootSole);
    sole.position.set(0, -0.4, 0.02);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.09), matBootSole);
    heel.position.set(0, -0.365, -0.06);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.2), matBoots);
    upper.position.set(0, -0.335, 0.02);
    const toeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), matBoots);
    toeCap.rotation.z = Math.PI / 2;
    toeCap.scale.set(1, 1, 0.55);
    toeCap.position.set(0, -0.36, 0.13);
    bootGroup.add(sole, heel, upper, toeCap);
    return bootGroup;
  }

  if (!isZombie) {
    const legLUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.072, 0.36, 8), matPants);
    legLUpper.position.set(0, -0.18, 0);
    legLUpper.castShadow = true;
    legLPivot.add(legLUpper);
    hitParts.push(legLUpper);
    const kneeCapL = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 6), matPants);
    kneeCapL.position.set(0, -0.36, 0);
    legLPivot.add(kneeCapL);

    legLLowerPivot.position.set(0, -0.36, 0);
    legLPivot.add(legLLowerPivot);
    const legLLower = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.36, 8), matPants);
    legLLower.position.set(0, -0.18, -0.01);
    legLLower.castShadow = true;
    const bootL = buildBoot();
    bootL.position.set(0, 0, 0.04);
    legLLowerPivot.add(legLLower, bootL);
    hitParts.push(legLLower);
    bootL.children.forEach((c) => hitParts.push(c as THREE.Mesh));

    const legRUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.072, 0.36, 8), matPants);
    legRUpper.position.set(0, -0.18, 0);
    legRUpper.castShadow = true;
    legRPivot.add(legRUpper);
    hitParts.push(legRUpper);
    const kneeCapR = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 6), matPants);
    kneeCapR.position.set(0, -0.36, 0);
    legRPivot.add(kneeCapR);

    legRLowerPivot.position.set(0, -0.36, 0);
    legRPivot.add(legRLowerPivot);
    const legRLower = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.36, 8), matPants);
    legRLower.position.set(0, -0.18, -0.01);
    legRLower.castShadow = true;
    const bootR = buildBoot();
    bootR.position.set(0, 0, 0.04);
    legRLowerPivot.add(legRLower, bootR);
    hitParts.push(legRLower);
    bootR.children.forEach((c) => hitParts.push(c as THREE.Mesh));

    const lc = options.lowerConfig;
    if (lc) {
      if (lc === 'holster' || lc === 'THIGH_HOLSTER') {
        const holsterDrop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.14), matSteelArmor);
        holsterDrop.position.set(0.12, -0.05, 0);
        legRUpper.add(holsterDrop);
        hitParts.push(holsterDrop);
        // Visible sidearm nested in the holster
        const sidearmSlide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.1), matGun);
        sidearmSlide.position.set(0.12, 0.05, 0.03);
        legRUpper.add(sidearmSlide);
      } else if (lc === 'HEAVY_POUCHES') {
        [-0.11, 0.11].forEach((px) => {
          const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), matPouches);
          pouch.position.set(px, -0.06, 0.06);
          (px < 0 ? legLUpper : legRUpper).add(pouch);
          hitParts.push(pouch);
        });
      } else if (lc === 'EXO_BRACES') {
        [legLLowerPivot, legRLowerPivot].forEach((pivot) => {
          const brace = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.2, 0.06), matSteelArmor);
          brace.position.set(0, -0.08, 0.1);
          const actuator = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.22, 8), matAccent);
          actuator.position.set(0.09, -0.1, 0.02);
          pivot.add(brace, actuator);
          hitParts.push(brace);
        });
      }
    } else {
      if (subClass === 'pointman' || subClass === 'elite_engineer') {
        const kneePadL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.06), matVest);
        kneePadL.position.set(0, -0.06, 0.1);
        legLLowerPivot.add(kneePadL);
        hitParts.push(kneePadL);

        const kneePadR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.06), matVest);
        kneePadR.position.set(0, -0.06, 0.1);
        legRLowerPivot.add(kneePadR);
        hitParts.push(kneePadR);
      }

      if (subClass === 'juggernaut' || subClass === 'elite_heavy') {
        const thighPlateL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.2), matSteelArmor);
        thighPlateL.position.set(0, -0.2, 0);
        legLPivot.add(thighPlateL);
        hitParts.push(thighPlateL);

        const thighPlateR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.2), matSteelArmor);
        thighPlateR.position.set(0, -0.2, 0);
        legRPivot.add(thighPlateR);
        hitParts.push(thighPlateR);
      }

      if (faction === 'apex') {
        // BDU cargo pants: reinforced knee braces + thigh utility pouch + knife sheath
        const kneeBraceL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.06), matSteelArmor);
        kneeBraceL.position.set(0, -0.04, 0.1);
        legLLowerPivot.add(kneeBraceL);
        hitParts.push(kneeBraceL);
        const kneeBraceR = kneeBraceL.clone();
        legRLowerPivot.add(kneeBraceR);
        hitParts.push(kneeBraceR);

        const thighPouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.08), matPouches);
        thighPouch.position.set(0, -0.05, 0.09);
        legLUpper.add(thighPouch);
        hitParts.push(thighPouch);

        const sheath = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.03), matTapeWrap);
        sheath.position.set(0.08, -0.1, 0.08);
        legRUpper.add(sheath);
        const knifeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), matGun);
        knifeHandle.position.set(0.08, -0.02, 0.08);
        legRUpper.add(knifeHandle);
        hitParts.push(sheath);
      }
    }
  } else {
    const legLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.86, 8), matPants);
    legLMesh.position.set(0, -0.43, 0);
    legLMesh.castShadow = true;
    legLPivot.add(legLMesh);
    hitParts.push(legLMesh);

    const legRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.86, 8), matPants);
    legRMesh.position.set(0, -0.43, 0);
    legRMesh.castShadow = true;
    legRPivot.add(legRMesh);
    hitParts.push(legRMesh);
  }

  /* ---------------------- MUTANT SCALE & POSTURE ---------------------- */
  if (isZombie) {
    if (zType === 'walker') rootGroup.scale.set(1.0, 1.0, 1.0);
    else if (zType === 'runner') rootGroup.scale.set(0.85, 0.722, 0.85);
    else if (zType === 'brute') rootGroup.scale.set(1.222, 1.222, 1.222);
    else if (zType === 'bloater') rootGroup.scale.set(1.15, 0.944, 1.15);
    else if (zType === 'banshee') rootGroup.scale.set(0.85, 1.111, 0.85);
    else if (zType === 'megaboss') rootGroup.scale.set(1.555, 1.555, 1.555);
    else if (zType === 'tank') rootGroup.scale.set(1.5, 1.5, 1.5);
  }

  return {
    rootGroup,
    torsoGroup,
    armLPivot,
    armRPivot,
    armLLowerPivot,
    armRLowerPivot,
    legLPivot,
    legRPivot,
    legLLowerPivot,
    legRLowerPivot,
    gunMesh: gunMeshRef,
    muzzleFlash: muzzleFlashRef,
    flashMats,
    hitParts,
    headParts,
    faction,
    subClass,
    speedMultiplier,
    healthMultiplier,
    armorMultiplier,
    tactical: createTacticalState(-1)
  };
}

/* =============================================================================
 * ENGINEER DEPLOYABLE: TRIPOD MACHINE GUN
 * Barricade + M2-style mounted gun. The returned barrelPivot yaws/pitches
 * independently of the barricade so the mounted operator can traverse.
 * ===========================================================================*/

export interface TripodBuildResult {
  group: THREE.Group;
  barrelPivot: THREE.Group;
  muzzlePoint: THREE.Object3D;
  hitMeshes: THREE.Mesh[];
}

export function buildTripodMachineGun(accentHex = 0x2de2e6): TripodBuildResult {
  const group = new THREE.Group();
  const hitMeshes: THREE.Mesh[] = [];

  const matFrame = new THREE.MeshStandardMaterial({ color: 0x2b333c, roughness: 0.55, metalness: 0.7, bumpMap: getScratchedMetalTexture(), bumpScale: 0.005 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.4, metalness: 0.85, bumpMap: getScratchedMetalTexture(), bumpScale: 0.006 });
  const matSandbag = new THREE.MeshStandardMaterial({ color: 0x5a5042, roughness: 0.95 });
  const matGlow = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.6,
    roughness: 0.3
  });
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xb08d3f, roughness: 0.35, metalness: 0.75 });

  /* --- Barricade: sandbag crescent + ballistic shield --- */
  // A shallow arc of overlapping cylindrical sandbags reads as a crescent,
  // not a straight-edged box.
  for (let s = -2; s <= 2; s++) {
    const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.42, 10), matSandbag);
    bag.rotation.z = Math.PI / 2;
    const a = s * 0.22;
    bag.position.set(Math.sin(a) * 1.1, 0.2, 0.2 + Math.cos(a) * 0.15 - 0.15);
    bag.rotation.y = a;
    bag.castShadow = true;
    bag.receiveShadow = true;
    group.add(bag);
    hitMeshes.push(bag);
  }

  const plate = makeChamferedPlate(1.15, 1.25, 0.66, matFrame);
  plate.position.set(0, 0.71, 0.3);
  plate.rotation.y = 0;
  plate.castShadow = true;
  group.add(plate);
  hitMeshes.push(plate);

  // Gun port cut into the plate, marked with accent trim, plus a status beacon strip
  const portTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.2), matGlow);
  portTrimL.position.set(-0.34, 0.86, 0.32);
  const portTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.2), matGlow);
  portTrimR.position.set(0.34, 0.86, 0.32);
  const sightSlit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), matSocketRecessLocal());
  sightSlit.position.set(0, 0.98, 0.34);
  group.add(portTrimL, portTrimR, sightSlit);

  /* --- Tripod legs with locking pins and ground claw pads --- */
  const legAngles = [-0.62, 0.62, Math.PI];
  legAngles.forEach((a) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.05, 8), matSteel);
    leg.position.set(Math.sin(a) * 0.3, 0.5, Math.cos(a) * 0.3);
    leg.rotation.x = Math.cos(a) * 0.28;
    leg.rotation.z = -Math.sin(a) * 0.28;
    leg.castShadow = true;
    group.add(leg);

    const lockPin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 6), matBrass);
    lockPin.position.set(Math.sin(a) * 0.3, 0.72, Math.cos(a) * 0.3);
    lockPin.rotation.z = Math.PI / 2;
    group.add(lockPin);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 6), matSteel);
    foot.position.set(Math.sin(a) * 0.46, 0.03, Math.cos(a) * 0.46);
    group.add(foot);
    for (let claw = 0; claw < 3; claw++) {
      const ca = (claw / 3) * Math.PI * 2;
      const clawPad = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 4), matSteel);
      clawPad.position.set(
        Math.sin(a) * 0.46 + Math.cos(ca) * 0.09,
        -0.01,
        Math.cos(a) * 0.46 + Math.sin(ca) * 0.09
      );
      clawPad.rotation.x = Math.PI;
      group.add(clawPad);
    }
  });

  const cradle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 12), matSteel);
  cradle.position.set(0, 1.04, 0);
  group.add(cradle);
  hitMeshes.push(cradle);

  /* --- Traversing gun assembly: M2-style receiver --- */
  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0, 1.14, 0);
  group.add(barrelPivot);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.62), matSteel);
  receiver.position.set(0, 0, 0.04);
  receiver.castShadow = true;
  barrelPivot.add(receiver);
  hitMeshes.push(receiver);

  const barrelShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.78, 12), matFrame);
  barrelShroud.rotation.x = Math.PI / 2;
  barrelShroud.position.set(0, 0.03, 0.62);
  barrelPivot.add(barrelShroud);

  // Circular cooling ports ringing the jacket, not just flat vent slats
  for (let ring = 0; ring < 4; ring++) {
    const ringZ = 0.4 + ring * 0.12;
    for (let hole = 0; hole < 6; hole++) {
      const a = (hole / 6) * Math.PI * 2;
      const port = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6), matSocketRecessLocal());
      port.rotation.z = Math.PI / 2;
      port.position.set(Math.cos(a) * 0.058, 0.03 + Math.sin(a) * 0.058, ringZ);
      barrelPivot.add(port);
    }
  }

  const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.14), matSteel);
  muzzleBrake.position.set(0, 0.03, 1.06);
  barrelPivot.add(muzzleBrake);

  // 250-round ammo can with a beaded chain hinting at belted rounds
  const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.34), matFrame);
  ammoBox.position.set(-0.26, -0.06, -0.06);
  barrelPivot.add(ammoBox);
  hitMeshes.push(ammoBox);

  const beltFeed = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.1), matGlow);
  beltFeed.position.set(-0.14, 0.02, -0.02);
  barrelPivot.add(beltFeed);

  for (let round = 0; round < 6; round++) {
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6), matBrass);
    shell.rotation.z = Math.PI / 2;
    shell.position.set(-0.2 - round * 0.018, 0.0, -0.06);
    barrelPivot.add(shell);
  }

  const spadeBar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.05), matSteel);
  spadeBar.position.set(0, -0.02, -0.3);
  barrelPivot.add(spadeBar);

  [-0.18, 0.18].forEach((gx) => {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), matSteel);
    grip.position.set(gx, -0.13, -0.3);
    barrelPivot.add(grip);
    // Butterfly trigger tab
    const triggerTab = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.015), matBrass);
    triggerTab.position.set(gx, -0.2, -0.26);
    triggerTab.rotation.x = 0.4;
    barrelPivot.add(triggerTab);
  });

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.03, 1.2);
  barrelPivot.add(muzzlePoint);

  // Status beacon so the deployable reads clearly at a distance
  const beacon = new THREE.PointLight(accentHex, 1.9, 7, 1.5);
  beacon.position.set(0, 1.42, 0);
  group.add(beacon);

  return { group, barrelPivot, muzzlePoint, hitMeshes };
}

/** Small shared dark-recess material for vents/sights on deployables. */
function matSocketRecessLocal(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.95 });
}

/* =============================================================================
 * MEDIC REGEN FIELD — dual-layer holographic sphere
 * ===========================================================================*/

export function buildRegenFieldMesh(radius = REGEN_FIELD_RADIUS): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    wireframe: true,
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);

  // Second, smaller wireframe layer — inherits the outer mesh's rotation for
  // a free dual-layer holographic look with no extra per-frame driving needed.
  const innerWireGeo = new THREE.IcosahedronGeometry(radius * 0.78, 1);
  const innerWireMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    wireframe: true,
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  });
  mesh.add(new THREE.Mesh(innerWireGeo, innerWireMat));

  // Solid inner glow shell keeps the field readable against bright floors
  const innerGeo = new THREE.SphereGeometry(radius * 0.6, 20, 16);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x16a34a,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    side: THREE.BackSide
  });
  mesh.add(new THREE.Mesh(innerGeo, innerMat));

  return mesh;
}

/* =============================================================================
 * RECON TELEMETRY MARK — inverted caret + bounding tracking bracket
 * ===========================================================================*/

export function buildTelemetryMarker(): THREE.Group {
  const group = new THREE.Group();

  const markMat = new THREE.MeshBasicMaterial({
    color: 0xff3344,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  });

  const caret = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), markMat);
  caret.rotation.x = Math.PI;
  caret.position.y = 2.35;
  group.add(caret);

  const cageMat = new THREE.MeshBasicMaterial({
    color: 0xff3344,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    depthTest: false
  });
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.85, 0.7), cageMat);
  cage.position.y = 0.95;
  group.add(cage);

  // Bracket-box corner ticks for a HUD tracking-reticle look
  const tickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false });
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];
  corners.forEach(([sx, sz]) => {
    const tickH = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.014), tickMat);
    tickH.position.set(sx * 0.42, 1.85, sz * 0.35);
    const tickV = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.14), tickMat);
    tickV.position.copy(tickH.position);
    group.add(tickH, tickV);
  });

  group.renderOrder = 999;
  return group;
}

/* =============================================================================
 * REUSABLE IMPACT PARTICLE SYSTEM — dust chips, ricochet sparks, blood
 * -----------------------------------------------------------------------------
 * Self-contained and ready to integrate: call createImpactParticleSystem(scene)
 * once, call .update(dt) every frame, and call the spawn* methods wherever a
 * hit is currently handled. Not wired into App.tsx's existing hit-handling
 * calls in this pass — that file is out of scope here — but this drop-in
 * module can replace the ad-hoc sparkPool there with zero behavioural change
 * beyond richer, three-tier particle types.
 * ===========================================================================*/

interface ImpactParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  spin: THREE.Vector3;
}

export interface ImpactParticleSystem {
  group: THREE.Group;
  spawnDust: (pos: THREE.Vector3) => void;
  spawnSpark: (pos: THREE.Vector3, dir?: THREE.Vector3) => void;
  spawnBlood: (pos: THREE.Vector3, dir?: THREE.Vector3) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createImpactParticleSystem(scene: THREE.Scene): ImpactParticleSystem {
  const group = new THREE.Group();
  scene.add(group);

  const particles: ImpactParticle[] = [];

  const dustGeo = new THREE.BoxGeometry(0.035, 0.035, 0.035);
  const dustMat = new THREE.MeshStandardMaterial({ color: 0x9a8f7c, roughness: 0.95 });

  const sparkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.06);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

  const bloodGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
  const bloodMatBase = { color: 0x7a0e0e, roughness: 0.35 };

  function spawn(mesh: THREE.Mesh, pos: THREE.Vector3, vel: THREE.Vector3, life: number, gravity: number) {
    mesh.position.copy(pos);
    group.add(mesh);
    particles.push({
      mesh,
      vel,
      life,
      maxLife: life,
      gravity,
      spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8)
    });
  }

  function spawnDust(pos: THREE.Vector3): void {
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 2.2, Math.random() * 1.6, (Math.random() - 0.5) * 2.2);
      spawn(mesh, pos, vel, 0.6 + Math.random() * 0.3, 6);
    }
  }

  function spawnSpark(pos: THREE.Vector3, dir?: THREE.Vector3): void {
    const base = dir ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      const vel = base
        .clone()
        .multiplyScalar(-2.5)
        .add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
      spawn(mesh, pos, vel, 0.15 + Math.random() * 0.1, 10);
    }
  }

  function spawnBlood(pos: THREE.Vector3, dir?: THREE.Vector3): void {
    const base = dir ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 7; i++) {
      const shade = 0x50 + Math.floor(Math.random() * 30);
      const mat = new THREE.MeshStandardMaterial({ ...bloodMatBase, color: (bloodMatBase.color & 0xffff00) | shade });
      const mesh = new THREE.Mesh(bloodGeo, mat);
      const vel = base
        .clone()
        .multiplyScalar(-1.8)
        .add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.4 + 1, (Math.random() - 0.5) * 3));
      spawn(mesh, pos, vel, 1.2 + Math.random() * 0.5, 14);
    }
  }

  function update(dt: number): void {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        group.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      const mat = p.mesh.material as THREE.Material & { opacity: number; transparent: boolean };
      if (p.life < p.maxLife * 0.3) {
        mat.transparent = true;
        mat.opacity = Math.max(0, p.life / (p.maxLife * 0.3));
      }
    }
  }

  function dispose(): void {
    particles.forEach((p) => {
      group.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    particles.length = 0;
    scene.remove(group);
    dustGeo.dispose();
    dustMat.dispose();
    sparkGeo.dispose();
    sparkMat.dispose();
    bloodGeo.dispose();
  }

  return { group, spawnDust, spawnSpark, spawnBlood, update, dispose };
}
