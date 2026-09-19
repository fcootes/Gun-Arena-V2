import * as THREE from 'three';

/* =============================================================================
 * OPERATION VAULTDASH — CORE TYPE SYSTEM
 * -----------------------------------------------------------------------------
 * SECTION 1  Legacy combat types (preserved verbatim for App.tsx / world.ts)
 * SECTION 2  Heavy-grind meta economy + tactical gear locker
 * SECTION 3  Expanded arsenal + explosive/tech weapon definitions
 * SECTION 4  Advanced tactical AI state
 * SECTION 5  Elite squad protocol (regen field, telemetry, tripod MG)
 * SECTION 6  localStorage persistence layer
 * ===========================================================================*/

/* =============================================================================
 * SECTION 1 — LEGACY COMBAT TYPES
 * ===========================================================================*/

export interface WeaponDef {
  id: string;
  name: string;
  type: 'weapon' | 'grenade' | 'consumable' | 'empty' | 'gadget';
  damage?: number;
  headshotMult?: number;
  pellets?: number;
  spread?: number;
  adsSpread?: number;
  fireRate?: number;
  mag?: number;
  reserve?: number;
  reloadTime?: number;
  range?: number;
  auto?: boolean;
  burst?: boolean;
  burstCount?: number;
  burstRate?: number;
  isLaser?: boolean;
  isMinigun?: boolean;
  isRailgun?: boolean;
  adsFov?: number;
  scoped?: boolean;
  kick?: number;
  count?: number;
  maxCount?: number;
  radius?: number;
  healAmount?: number;
  maxHealCap?: number;
  useTime?: number;
}

export interface WeaponSlotState {
  ammo?: number;
  reserve?: number;
  reloading?: boolean;
  reloadT?: number;
  totalReloadT?: number;
  isTacticalReload?: boolean;
  lastFired?: number;
  count?: number;
  using?: boolean;
  heat?: number;
  overheated?: boolean;
  burstRemaining?: number;
  burstTimer?: number;
  spinWarmup?: number;
  spinSpeed?: number;
  ventTimer?: number;
  chargeTimer?: number;
  charging?: boolean;
}

export type MutantType = 'WALKER' | 'RUNNER' | 'BRUTE' | 'BANSHEE' | 'BLOATER' | 'MEGABOSS';

export interface ToxicPuddle {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  radius: number;
  duration: number;
  maxDuration: number;
  dps: number;
}

export interface WorldCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  active: boolean;
  isDoor?: boolean;
  isStair?: boolean;
  isRamp?: boolean;
  isTripod?: boolean;
}

export interface Door {
  hingeGroup: THREE.Group;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  isOpen: boolean;
  currentAngle: number;
  targetAngle: number;
  collider: WorldCollider;
  isArmory?: boolean;
}

export type Sector4ObjectiveType = 'HOLD_THE_LINE' | 'VOLATILE_CONTAINER' | 'REACTOR_OVERRIDE';

export interface GroundPickup {
  group: THREE.Group;
  typeIndex: number;
  ammo: number;
  label: string;
}

export interface ActiveGrenade {
  group: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  rotAxis: THREE.Vector3;
  rotSpeed: number;
  timeAlive: number;
  maxFuse: number;
  hasHitGround: boolean;
  ownerTeam: string;
}

export interface ExplosionEffect {
  mesh: THREE.Mesh;
  light: THREE.PointLight | null;
  scale: number;
  life: number;
}

export type DeploymentProtocol = 'elite' | 'battalion' | 'standard';

export type SquadDirective = 'follow_lead' | 'hold_position' | 'push_objective' | 'focus_target';

export type ClassId =
  | 'assault'
  | 'heavy'
  | 'recon'
  | 'medic'
  | 'engineer'
  | 'breacher'
  | 'juggernaut'
  | 'vanguard';

export interface ClassConfig {
  id: ClassId;
  name: string;
  tagline: string;
  perkName: string;
  perkDesc: string;
  color: string;
  defaultPrimary: string;
  defaultSecondary: string;
  reloadMultiplier: number;
  speedMultiplier: number;
  maxHealth: number;
  initialHealth: number;
  maxShield: number;
  initialShield: number;
}

export interface ArmoryOption {
  id: string;
  label: string;
  slotNum: string;
}

export type GameMode = 'ffa' | 'team' | 'zombie' | 'extraction';

export interface MatchConfig {
  mode: GameMode;
  faction?: 'usmc' | 'apex';
  friendlyCount: number;
  enemyCount: number;
  targetScore: number;
  startingWave: number;
  deploymentProtocol?: DeploymentProtocol;
  eliteSquad?: EliteCompanionConfig[];
}

export interface DifficultyConfig {
  label: string;
  botHealthMult: number;
  botDamageMult: number;
  botFireRateMult: number;
  botAccuracy: number;
}

/* =============================================================================
 * SECTION 2 — HEAVY-GRIND META ECONOMY & TACTICAL GEAR LOCKER
 * ===========================================================================*/

export const GAME_PERSISTENCE_KEY = 'GAME_PERSISTENCE_KEY';
export const PERSISTENCE_SCHEMA_VERSION = 3;

/** Kill payouts. Deliberately punishing: top-tier gear is a 900+ standard-kill grind. */
export const KILL_REWARD_STANDARD = 15;
export const KILL_REWARD_HEAVY = 50;

export type FactionId = 'USMC_SPEC_OPS' | 'MERCENARY_VANGUARD';

export type HeadgearId = 'BARE_HEAD' | 'FAST_HELMET' | 'HEAVY_EOD_VISOR' | 'BALLISTIC_SKULL';
export type TorsoId = 'CANVAS_RIG' | 'RECON_RIG' | 'CERAMIC_CARRIER' | 'EXO_HARNESS';
export type LowerRigId = 'BDU_PANTS' | 'THIGH_HOLSTER' | 'HEAVY_POUCHES' | 'EXO_BRACES';

export type GearSlot = 'HEADGEAR' | 'TORSO' | 'LOWER';

/**
 * Every modifier is expressed as a pure multiplier (1.0 == unchanged) or an
 * additive flat value, so the aggregator can fold an arbitrary number of pieces
 * together without special-casing individual items.
 */
export interface GearModifiers {
  /** Multiplies incoming headshot damage. 0.75 == "-25% headshot damage taken". */
  headshotDamageMult: number;
  /** Multiplies all incoming bullet damage. */
  bulletDamageMult: number;
  /** Multiplies walk velocity. */
  moveSpeedMult: number;
  /** Multiplies sprint velocity (stacks on top of moveSpeedMult). */
  sprintSpeedMult: number;
  /** Multiplies reload DURATION. 0.85 == "+15% reload speed". */
  reloadSpeedMult: number;
  /** Multiplies weapon draw/swap DURATION. 0.80 == "+25% draw speed". */
  drawSpeedMult: number;
  /** Multiplies reserve ammo granted at spawn / on pickup. */
  reserveAmmoMult: number;
  /** Extra magazines handed to the sidearm slot at spawn. */
  sidearmMagBonus: number;
  /** Added suppression pressure this operator applies to enemy AI, in percent. */
  suppressionBonusPct: number;
  /** Cannot be staggered by explosions, brute slams or suppression. */
  staggerImmune: boolean;
  /** Jump does not accrue stamina/landing penalty. */
  zeroJumpFatigue: boolean;
}

export interface GearItemDef<TId extends string = string> {
  id: TId;
  name: string;
  slot: GearSlot;
  price: number;
  blurb: string;
  /** Absolute armor pool. Torso pieces only; 0 means "does not set armor". */
  armorCapacity: number;
  modifiers: Partial<GearModifiers>;
}

export const DEFAULT_GEAR_MODIFIERS: GearModifiers = {
  headshotDamageMult: 1.0,
  bulletDamageMult: 1.0,
  moveSpeedMult: 1.0,
  sprintSpeedMult: 1.0,
  reloadSpeedMult: 1.0,
  drawSpeedMult: 1.0,
  reserveAmmoMult: 1.0,
  sidearmMagBonus: 0,
  suppressionBonusPct: 0,
  staggerImmune: false,
  zeroJumpFatigue: false
};

export const HEADGEAR_CATALOG: Record<HeadgearId, GearItemDef<HeadgearId>> = {
  BARE_HEAD: {
    id: 'BARE_HEAD',
    name: 'Bare Head',
    slot: 'HEADGEAR',
    price: 0,
    blurb: 'No protection. Nothing between a marksman and your skull.',
    armorCapacity: 0,
    modifiers: {}
  },
  FAST_HELMET: {
    id: 'FAST_HELMET',
    name: 'FAST Ballistic Helmet',
    slot: 'HEADGEAR',
    price: 12000,
    blurb: 'High-cut Kevlar shell with NVG shroud. Takes a quarter off every headshot.',
    armorCapacity: 0,
    modifiers: { headshotDamageMult: 0.75 }
  },
  HEAVY_EOD_VISOR: {
    id: 'HEAVY_EOD_VISOR',
    name: 'Heavy EOD Visor',
    slot: 'HEADGEAR',
    price: 28000,
    blurb: 'Bomb-disposal faceplate. Halves headshot damage; the weight slows you down.',
    armorCapacity: 0,
    modifiers: { headshotDamageMult: 0.5, moveSpeedMult: 0.95 }
  },
  BALLISTIC_SKULL: {
    id: 'BALLISTIC_SKULL',
    name: 'Ballistic Skull Mask',
    slot: 'HEADGEAR',
    price: 45000,
    blurb: 'Composite skull plate. Sheds bullet damage and makes hostiles break contact sooner.',
    armorCapacity: 0,
    modifiers: { bulletDamageMult: 0.85, suppressionBonusPct: 35 }
  }
};

export const TORSO_CATALOG: Record<TorsoId, GearItemDef<TorsoId>> = {
  CANVAS_RIG: {
    id: 'CANVAS_RIG',
    name: 'Canvas Chest Rig',
    slot: 'TORSO',
    price: 0,
    blurb: 'Issue webbing. 100 armor, no penalties, no help.',
    armorCapacity: 100,
    modifiers: {}
  },
  RECON_RIG: {
    id: 'RECON_RIG',
    name: 'Recon Rig',
    slot: 'TORSO',
    price: 15000,
    blurb: 'Stripped-down plate bag. Trades armor for pace and faster mag changes.',
    armorCapacity: 75,
    modifiers: { moveSpeedMult: 1.1, reloadSpeedMult: 0.85 }
  },
  CERAMIC_CARRIER: {
    id: 'CERAMIC_CARRIER',
    name: 'Ceramic Plate Carrier',
    slot: 'TORSO',
    price: 32000,
    blurb: 'Front and back ceramic inserts. 180 armor at the cost of a step.',
    armorCapacity: 180,
    modifiers: { moveSpeedMult: 0.92 }
  },
  EXO_HARNESS: {
    id: 'EXO_HARNESS',
    name: 'Exo Harness',
    slot: 'TORSO',
    price: 55000,
    blurb: 'Powered load-bearing frame. 250 armor and nothing knocks you off your feet.',
    armorCapacity: 250,
    modifiers: { moveSpeedMult: 0.88, staggerImmune: true }
  }
};

export const LOWER_CATALOG: Record<LowerRigId, GearItemDef<LowerRigId>> = {
  BDU_PANTS: {
    id: 'BDU_PANTS',
    name: 'BDU Trousers',
    slot: 'LOWER',
    price: 0,
    blurb: 'Standard combat trousers. Baseline everything.',
    armorCapacity: 0,
    modifiers: {}
  },
  THIGH_HOLSTER: {
    id: 'THIGH_HOLSTER',
    name: 'Drop-Leg Holster',
    slot: 'LOWER',
    price: 10000,
    blurb: 'Kydex quick-draw rig. One extra sidearm mag and a much faster swap.',
    armorCapacity: 0,
    modifiers: { sidearmMagBonus: 1, drawSpeedMult: 0.8 }
  },
  HEAVY_POUCHES: {
    id: 'HEAVY_POUCHES',
    name: 'Heavy Pouch Belt',
    slot: 'LOWER',
    price: 24000,
    blurb: 'Deep MOLLE pouches. Half again as much reserve ammo on every weapon.',
    armorCapacity: 0,
    modifiers: { reserveAmmoMult: 1.5 }
  },
  EXO_BRACES: {
    id: 'EXO_BRACES',
    name: 'Exo Leg Braces',
    slot: 'LOWER',
    price: 42000,
    blurb: 'Actuated knee braces. Faster sprint and you land ready to move.',
    armorCapacity: 0,
    modifiers: { sprintSpeedMult: 1.15, zeroJumpFatigue: true }
  }
};

export interface FactionStarterAvatar {
  id: FactionId;
  name: string;
  callsign: string;
  doctrine: string;
  accentHex: string;
  palette: {
    shirt: number;
    pants: number;
    vest: number;
    helmet: number;
    pouches: number;
    skin: number;
    accent: number;
  };
  startingHeadgear: HeadgearId;
  startingTorso: TorsoId;
  startingLower: LowerRigId;
  startingPrimary: WeaponID;
  startingSecondary: WeaponID;
}

export const FACTION_AVATARS: Record<FactionId, FactionStarterAvatar> = {
  USMC_SPEC_OPS: {
    id: 'USMC_SPEC_OPS',
    name: 'USMC Spec-Ops',
    callsign: 'VAULT ACTUAL',
    doctrine: 'Secure the bio-samples, purge the anomalies, walk everyone back out.',
    accentHex: '#8fae5d',
    palette: {
      shirt: 0x3e4a2d,
      pants: 0x28331f,
      vest: 0x485834,
      helmet: 0x364228,
      pouches: 0x6e6149,
      skin: 0xd2a482,
      accent: 0x8fae5d
    },
    startingHeadgear: 'BARE_HEAD',
    startingTorso: 'CANVAS_RIG',
    startingLower: 'BDU_PANTS',
    startingPrimary: 'M4A1_TACTICAL',
    startingSecondary: 'COMBAT_9MM'
  },
  MERCENARY_VANGUARD: {
    id: 'MERCENARY_VANGUARD',
    name: 'Mercenary Vanguard',
    callsign: 'REDLINE',
    doctrine: 'Take the payload, bill the client, leave the facility burning.',
    accentHex: '#c8443a',
    palette: {
      shirt: 0x181a1e,
      pants: 0x121316,
      vest: 0x241014,
      helmet: 0x141518,
      pouches: 0x2a1a1c,
      skin: 0xcbb39e,
      accent: 0xc8443a
    },
    startingHeadgear: 'BARE_HEAD',
    startingTorso: 'CANVAS_RIG',
    startingLower: 'BDU_PANTS',
    startingPrimary: 'M4A1_TACTICAL',
    startingSecondary: 'COMBAT_9MM'
  }
};

/* =============================================================================
 * SECTION 3 — EXPANDED ARSENAL & EXPLOSIVE ENGINE DEFINITIONS
 * ===========================================================================*/

export type WeaponID =
  // Assault
  | 'M4A1_TACTICAL'
  | 'AK47_VULCAN'
  // Shotgun
  | 'EXPEDITE_12'
  | 'DRUM_STRIKER'
  // Pistol
  | 'COMBAT_9MM'
  | 'MAGNUM_EXECUTIONER'
  // Precision
  | 'BR76_BATTLE'
  | 'HEAVY_AP_SNIPER'
  // SMG
  | 'VEL46_SUB'
  | 'VECTOR9'
  // Heavy
  | 'SAKIN_LMG'
  | 'VULCAN_ROTARY'
  // Explosive & Tech
  | 'RPG7_ROCKET'
  | 'M32_GRENADE'
  | 'KINETIC_RAILGUN';

export type WeaponClass =
  | 'ASSAULT'
  | 'SHOTGUN'
  | 'PISTOL'
  | 'PRECISION'
  | 'SMG'
  | 'HEAVY'
  | 'EXPLOSIVE'
  | 'TECH';

export type ProjectileKind = 'HITSCAN' | 'ROCKET' | 'ARC_GRENADE' | 'PENETRATING_RAIL';

export interface ArsenalWeaponDef {
  id: WeaponID;
  name: string;
  weaponClass: WeaponClass;
  price: number;
  /** Maps onto the existing WEAPONS[] entry in weapons.ts so viewmodels keep working. */
  legacyId: string;
  damage: number;
  headshotMult: number;
  pellets: number;
  spread: number;
  adsSpread: number;
  /** Seconds between shots. */
  fireRate: number;
  mag: number;
  reserve: number;
  reloadTime: number;
  range: number;
  auto: boolean;
  burst: boolean;
  burstCount: number;
  burstRate: number;
  kick: number;
  adsFov: number;
  scoped: boolean;
  projectile: ProjectileKind;
  /** metres/second, projectile weapons only */
  projectileSpeed: number;
  /** metres/second², 0 for flat-flight rockets */
  projectileGravity: number;
  /** metres, AABB half-extent used for the splash overlap test */
  splashRadius: number;
  splashDamage: number;
  /** metres a penetrating rail shot travels through geometry */
  penetrationRange: number;
  /** How hard sustained fire from this weapon pins enemy AI down. */
  suppressionWeight: number;
  blurb: string;
}

/**
 * NOTE ON COUNT: the brief is headed "13-Weapon Arsenal" but the itemised list
 * specifies 12 core platforms plus 3 explosive/tech platforms. The list is
 * implemented in full — 15 entries — since that is the explicit spec.
 */
export const ARSENAL: Record<WeaponID, ArsenalWeaponDef> = {
  M4A1_TACTICAL: {
    id: 'M4A1_TACTICAL',
    name: 'M4A1 Tactical',
    weaponClass: 'ASSAULT',
    price: 0,
    legacyId: 'ar',
    damage: 20,
    headshotMult: 2.2,
    pellets: 1,
    spread: 0.016,
    adsSpread: 0.006,
    fireRate: 0.11,
    mag: 30,
    reserve: 150,
    reloadTime: 2.4,
    range: 170,
    auto: true,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.018,
    adsFov: 55,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 1.0,
    blurb: 'Issue carbine. Flat recoil, honest damage, never lets you down.'
  },
  AK47_VULCAN: {
    id: 'AK47_VULCAN',
    name: 'AK47 Vulcan',
    weaponClass: 'ASSAULT',
    price: 12000,
    legacyId: 'ar',
    damage: 29,
    headshotMult: 2.3,
    pellets: 1,
    spread: 0.028,
    adsSpread: 0.012,
    fireRate: 0.135,
    mag: 30,
    reserve: 150,
    reloadTime: 2.9,
    range: 160,
    auto: true,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.034,
    adsFov: 56,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 1.35,
    blurb: 'Heavier round, heavier climb. Two-shots unarmored torsos inside 40m.'
  },
  EXPEDITE_12: {
    id: 'EXPEDITE_12',
    name: 'Expedite 12',
    weaponClass: 'SHOTGUN',
    price: 11000,
    legacyId: 'shotgun',
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
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.05,
    adsFov: 62,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 0.8,
    blurb: 'Pump twelve-gauge. Doorways and corridor corners belong to you.'
  },
  DRUM_STRIKER: {
    id: 'DRUM_STRIKER',
    name: 'Drum Striker',
    weaponClass: 'SHOTGUN',
    price: 28000,
    legacyId: 'shotgun',
    damage: 8.2,
    headshotMult: 1.7,
    pellets: 8,
    spread: 0.108,
    adsSpread: 0.086,
    fireRate: 0.28,
    mag: 12,
    reserve: 60,
    reloadTime: 3.4,
    range: 34,
    auto: true,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.058,
    adsFov: 64,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 1.6,
    blurb: 'Twelve-shell drum on full auto. Clears a breach room in under two seconds.'
  },
  COMBAT_9MM: {
    id: 'COMBAT_9MM',
    name: 'Combat 9mm',
    weaponClass: 'PISTOL',
    price: 0,
    legacyId: 'pistol',
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
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.024,
    adsFov: 60,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 0.5,
    blurb: 'Service sidearm. Always loaded, always there when the primary runs dry.'
  },
  MAGNUM_EXECUTIONER: {
    id: 'MAGNUM_EXECUTIONER',
    name: 'Magnum Executioner',
    weaponClass: 'PISTOL',
    price: 9000,
    legacyId: 'pistol',
    damage: 72,
    headshotMult: 2.6,
    pellets: 1,
    spread: 0.03,
    adsSpread: 0.006,
    fireRate: 0.62,
    mag: 6,
    reserve: 36,
    reloadTime: 2.6,
    range: 110,
    auto: false,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.085,
    adsFov: 54,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 1.1,
    blurb: 'Six rounds of hand cannon. Drops a runner mid-lunge if you time it.'
  },
  BR76_BATTLE: {
    id: 'BR76_BATTLE',
    name: 'BR-76 Battle Rifle',
    weaponClass: 'PRECISION',
    price: 22000,
    legacyId: 'br',
    damage: 28,
    headshotMult: 2.2,
    pellets: 1,
    spread: 0.012,
    adsSpread: 0.003,
    fireRate: 0.42,
    mag: 36,
    reserve: 180,
    reloadTime: 1.8,
    range: 220,
    auto: false,
    burst: true,
    burstCount: 3,
    burstRate: 0.075,
    kick: 0.016,
    adsFov: 38,
    scoped: true,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 1.2,
    blurb: 'Three-round burst with a low-power optic. Corridor-length answer to everything.'
  },
  HEAVY_AP_SNIPER: {
    id: 'HEAVY_AP_SNIPER',
    name: 'Heavy AP Sniper',
    weaponClass: 'PRECISION',
    price: 38000,
    legacyId: 'sniper',
    damage: 70,
    headshotMult: 3.5,
    pellets: 1,
    spread: 0.006,
    adsSpread: 0.0006,
    fireRate: 1.45,
    mag: 5,
    reserve: 25,
    reloadTime: 2.7,
    range: 420,
    auto: false,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.09,
    adsFov: 14,
    scoped: true,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 1.4,
    blurb: 'Anti-materiel bolt gun. No falloff at any range in the facility.'
  },
  VEL46_SUB: {
    id: 'VEL46_SUB',
    name: 'VEL-46 Sub',
    weaponClass: 'SMG',
    price: 14000,
    legacyId: 'smg',
    damage: 15,
    headshotMult: 1.85,
    pellets: 1,
    spread: 0.036,
    adsSpread: 0.016,
    fireRate: 0.072,
    mag: 32,
    reserve: 192,
    reloadTime: 1.8,
    range: 85,
    auto: true,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.042,
    adsFov: 62,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 1.15,
    blurb: 'Armor-piercing PDW. Fastest thing you can carry through a three-metre corridor.'
  },
  VECTOR9: {
    id: 'VECTOR9',
    name: 'Vector 9',
    weaponClass: 'SMG',
    price: 26000,
    legacyId: 'smg',
    damage: 14,
    headshotMult: 1.9,
    pellets: 1,
    spread: 0.024,
    adsSpread: 0.009,
    fireRate: 0.055,
    mag: 40,
    reserve: 240,
    reloadTime: 1.6,
    range: 78,
    auto: true,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.02,
    adsFov: 63,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 1.5,
    blurb: 'Delayed-recoil bolt. Absurd rate of fire that barely moves off target.'
  },
  SAKIN_LMG: {
    id: 'SAKIN_LMG',
    name: 'Sakin LMG',
    weaponClass: 'HEAVY',
    price: 35000,
    legacyId: 'lmg',
    damage: 24,
    headshotMult: 2.0,
    pellets: 1,
    spread: 0.026,
    adsSpread: 0.012,
    fireRate: 0.115,
    mag: 100,
    reserve: 300,
    reloadTime: 4.2,
    range: 160,
    auto: true,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.026,
    adsFov: 56,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 2.2,
    blurb: 'Hundred-round drum. Holds a chokepoint by itself as long as you stay fed.'
  },
  VULCAN_ROTARY: {
    id: 'VULCAN_ROTARY',
    name: 'Vulcan Rotary',
    weaponClass: 'HEAVY',
    price: 48000,
    legacyId: 'minigun',
    damage: 16,
    headshotMult: 1.8,
    pellets: 1,
    spread: 0.034,
    adsSpread: 0.024,
    fireRate: 0.045,
    mag: 999,
    reserve: 999,
    reloadTime: 2.0,
    range: 160,
    auto: true,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.012,
    adsFov: 60,
    scoped: false,
    projectile: 'HITSCAN',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 0,
    suppressionWeight: 2.8,
    blurb: 'Motorised six-barrel. Half-second spin-up, then nothing walks toward you.'
  },
  RPG7_ROCKET: {
    id: 'RPG7_ROCKET',
    name: 'RPG-7',
    weaponClass: 'EXPLOSIVE',
    price: 45000,
    legacyId: 'railgun',
    damage: 120,
    headshotMult: 1.0,
    pellets: 1,
    spread: 0.004,
    adsSpread: 0.002,
    fireRate: 1.6,
    mag: 1,
    reserve: 6,
    reloadTime: 3.6,
    range: 220,
    auto: false,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.16,
    adsFov: 48,
    scoped: false,
    projectile: 'ROCKET',
    projectileSpeed: 30,
    projectileGravity: 0,
    splashRadius: 6.0,
    splashDamage: 200,
    penetrationRange: 0,
    suppressionWeight: 3.0,
    blurb: 'Flat-flight rocket at 30 m/s. Six metres of lethal splash on contact.'
  },
  M32_GRENADE: {
    id: 'M32_GRENADE',
    name: 'M32 Grenade Launcher',
    weaponClass: 'EXPLOSIVE',
    price: 42000,
    legacyId: 'shotgun',
    damage: 60,
    headshotMult: 1.0,
    pellets: 1,
    spread: 0.01,
    adsSpread: 0.005,
    fireRate: 0.75,
    mag: 6,
    reserve: 18,
    reloadTime: 4.0,
    range: 120,
    auto: false,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.1,
    adsFov: 58,
    scoped: false,
    projectile: 'ARC_GRENADE',
    projectileSpeed: 34,
    projectileGravity: -22,
    splashRadius: 5.0,
    splashDamage: 140,
    penetrationRange: 0,
    suppressionWeight: 2.4,
    blurb: 'Six arcing 40mm shells. Lob them over cover; they burst on contact.'
  },
  KINETIC_RAILGUN: {
    id: 'KINETIC_RAILGUN',
    name: 'Kinetic Railgun',
    weaponClass: 'TECH',
    price: 50000,
    legacyId: 'railgun',
    damage: 160,
    headshotMult: 2.5,
    pellets: 1,
    spread: 0.001,
    adsSpread: 0.0001,
    fireRate: 1.3,
    mag: 1,
    reserve: 30,
    reloadTime: 1.4,
    range: 100,
    auto: false,
    burst: false,
    burstCount: 0,
    burstRate: 0,
    kick: 0.12,
    adsFov: 32,
    scoped: false,
    projectile: 'PENETRATING_RAIL',
    projectileSpeed: 0,
    projectileGravity: 0,
    splashRadius: 0,
    splashDamage: 0,
    penetrationRange: 100,
    suppressionWeight: 2.0,
    blurb: 'Tungsten slug that ignores cover. Everything on the line for 100 metres takes it.'
  }
};

export const ARSENAL_ORDER: WeaponID[] = [
  'M4A1_TACTICAL',
  'AK47_VULCAN',
  'EXPEDITE_12',
  'DRUM_STRIKER',
  'COMBAT_9MM',
  'MAGNUM_EXECUTIONER',
  'BR76_BATTLE',
  'HEAVY_AP_SNIPER',
  'VEL46_SUB',
  'VECTOR9',
  'SAKIN_LMG',
  'VULCAN_ROTARY',
  'RPG7_ROCKET',
  'M32_GRENADE',
  'KINETIC_RAILGUN'
];

export const WEAPON_CLASS_ORDER: WeaponClass[] = [
  'ASSAULT',
  'SHOTGUN',
  'PISTOL',
  'PRECISION',
  'SMG',
  'HEAVY',
  'EXPLOSIVE',
  'TECH'
];

/** Weapons legal in the secondary slot. */
export const SECONDARY_LEGAL: WeaponID[] = [
  'COMBAT_9MM',
  'MAGNUM_EXECUTIONER',
  'VEL46_SUB',
  'VECTOR9',
  'EXPEDITE_12'
];

export function arsenalToWeaponDef(id: WeaponID): WeaponDef {
  const a = ARSENAL[id];
  return {
    id: a.legacyId,
    name: a.name.toUpperCase(),
    type: 'weapon',
    damage: a.damage,
    headshotMult: a.headshotMult,
    pellets: a.pellets,
    spread: a.spread,
    adsSpread: a.adsSpread,
    fireRate: a.fireRate,
    mag: a.mag,
    reserve: a.reserve,
    reloadTime: a.reloadTime,
    range: a.range,
    auto: a.auto,
    burst: a.burst,
    burstCount: a.burstCount,
    burstRate: a.burstRate,
    isMinigun: a.id === 'VULCAN_ROTARY',
    isRailgun: a.id === 'KINETIC_RAILGUN',
    adsFov: a.adsFov,
    scoped: a.scoped,
    kick: a.kick
  };
}

/* =============================================================================
 * SECTION 4 — ADVANCED TACTICAL AI STATE
 * ===========================================================================*/

export type TacticalStance =
  | 'ADVANCE'
  | 'SUPPRESS'
  | 'SEEK_COVER'
  | 'IN_COVER'
  | 'FLANK'
  | 'REGROUP';

export type BoundingRole = 'MOVER' | 'ANCHOR';

export interface CoverPoint {
  pos: THREE.Vector3;
  quality: number;
  collider: WorldCollider;
}

export interface TacticalAIState {
  stance: TacticalStance;
  boundingRole: BoundingRole;
  boundingTimer: number;
  fireTeamId: number;
  fireTeamPartnerId: number | null;
  coverTarget: CoverPoint | null;
  coverSearchCooldown: number;
  coverHoldTimer: number;
  suppressionBurst: number;
  suppressionTimer: number;
  flankSide: -1 | 0 | 1;
  flankWaypoint: THREE.Vector3 | null;
  flankTimer: number;
  lastKnownTargetPos: THREE.Vector3 | null;
  losTimer: number;
  regroupTimer: number;
  repathTimer: number;
  /** Set by the engine each frame; read by the firing code in App.tsx. */
  holdFire: boolean;
  spreadPenalty: number;
  fireRateMult: number;
}

export function createTacticalState(fireTeamId = -1): TacticalAIState {
  return {
    stance: 'ADVANCE',
    boundingRole: 'MOVER',
    boundingTimer: 0,
    fireTeamId,
    fireTeamPartnerId: null,
    coverTarget: null,
    coverSearchCooldown: 0,
    coverHoldTimer: 0,
    suppressionBurst: 0,
    suppressionTimer: 0,
    flankSide: 0,
    flankWaypoint: null,
    flankTimer: 0,
    lastKnownTargetPos: null,
    losTimer: 0,
    regroupTimer: 0,
    repathTimer: 0,
    holdFire: false,
    spreadPenalty: 0,
    fireRateMult: 1
  };
}

export const TACTICAL_TUNING = {
  /** HP fraction under which a bot breaks LOS and pathfinds to cover. */
  coverSeekHealthPct: 0.4,
  /** Seconds before a fire team swaps MOVER / ANCHOR roles. */
  boundCycleSeconds: 2.6,
  /** Rounds the anchor dumps per suppression burst. */
  suppressionBurstCount: 9,
  /** Extra inaccuracy applied while suppressing (high volume, low precision). */
  suppressionSpread: 0.085,
  /** Fire-rate multiplier while suppressing (lower = faster). */
  suppressionFireRateMult: 0.42,
  suppressionRange: 55,
  /** Seconds the player must hold position before a flank is ordered. */
  flankTriggerSeconds: 5.0,
  /** Player movement under this many m/s counts as "stationary". */
  flankStationarySpeed: 0.9,
  flankMaxBots: 2,
  flankLateralOffset: 12.0,
  flankForwardOffset: 5.0,
  flankTimeout: 9.0,
  coverSearchRadius: 18.0,
  coverStandoff: 1.35,
  coverArrivalDist: 1.2,
  coverHoldSeconds: 3.5,
  /** Minimum collider height that counts as usable hard cover. */
  coverMinHeight: 0.9,
  fireTeamAssignInterval: 1.5,
  fireTeamPairRadius: 26.0,
  regroupSeconds: 3.0
} as const;

/* Anomaly swarm maneuvers */
export const SWARM_TUNING = {
  /** Cosine of the half-angle that counts as "player reticle resting on me". */
  reticleDotThreshold: 0.994,
  reticleMaxRange: 70,
  /** Seconds the reticle must rest before weaving kicks in. */
  reticleDwellSeconds: 0.25,
  weaveFrequency: 7.5,
  weaveAmplitude: 2.1,
  enrageHealthPct: 0.5,
  enrageSpeedMult: 1.5
} as const;

/* =============================================================================
 * SECTION 5 — ELITE SQUAD PROTOCOL
 * ===========================================================================*/

export type EliteArchetype = 'heavy' | 'medic' | 'recon' | 'engineer';

export interface EliteCompanionConfig {
  slotId: number; // 2, 3, 4, 5
  roleTitle: string;
  callsign: string;
  archetype: EliteArchetype;
  icon: string;
  primaryWeapon: string;
  secondaryWeapon: string;
  arsenalPrimary?: WeaponID;
  gearPlate: 'standard' | 'heavy' | 'spec_ops';
  perkDescription: string;
}

export const DEFAULT_ELITE_SQUAD: EliteCompanionConfig[] = [
  {
    slotId: 2,
    roleTitle: 'Second-in-Command',
    callsign: 'TITAN-2',
    archetype: 'heavy',
    icon: '🛡️',
    primaryWeapon: 'lmg',
    secondaryWeapon: 'pistol',
    arsenalPrimary: 'SAKIN_LMG',
    gearPlate: 'heavy',
    perkDescription: 'Holds open sightlines and lays continuous LMG suppression. Double armor plating.'
  },
  {
    slotId: 3,
    roleTitle: 'Combat Medic',
    callsign: 'DOC-3',
    archetype: 'medic',
    icon: '🩺',
    primaryWeapon: 'ar',
    secondaryWeapon: 'shotgun',
    arsenalPrimary: 'M4A1_TACTICAL',
    gearPlate: 'standard',
    perkDescription: 'Stays within 10m and drops a regen field restoring 15 HP/s to anyone inside.'
  },
  {
    slotId: 4,
    roleTitle: 'Recon Scout',
    callsign: 'SPECTRE-4',
    archetype: 'recon',
    icon: '👁️',
    primaryWeapon: 'sniper',
    secondaryWeapon: 'pistol',
    arsenalPrimary: 'HEAVY_AP_SNIPER',
    gearPlate: 'spec_ops',
    perkDescription: 'Pushes high ground and paints hostiles within 40m every 15 seconds.'
  },
  {
    slotId: 5,
    roleTitle: 'Combat Engineer',
    callsign: 'WRENCH-5',
    archetype: 'engineer',
    icon: '🛠️',
    primaryWeapon: 'smg',
    secondaryWeapon: 'shotgun',
    arsenalPrimary: 'VEL46_SUB',
    gearPlate: 'heavy',
    perkDescription: 'On Hold posture, builds a mountable tripod machine gun. Press E to man it.'
  }
];

export const ELITE_STAT_MULTIPLIER = 2.5;
export const ELITE_HEAVY_ARMOR_MULTIPLIER = 2.0;

/* --- Medic regen field --- */
export const REGEN_FIELD_RADIUS = 4.5;
export const REGEN_FIELD_HPS = 15;
export const REGEN_FIELD_DURATION = 12.0;
export const REGEN_FIELD_COOLDOWN = 18.0;
export const MEDIC_LEASH_DISTANCE = 10.0;

export interface RegenField {
  id: number;
  ownerBotId: number;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  radius: number;
  healPerSecond: number;
  life: number;
  maxLife: number;
}

/* --- Recon telemetry ping --- */
export const TELEMETRY_PING_INTERVAL = 15.0;
export const TELEMETRY_PING_RADIUS = 40.0;
export const TELEMETRY_MARK_DURATION = 4.0;

export interface TelemetryMark {
  botId: number;
  marker: THREE.Group;
  life: number;
  maxLife: number;
}

/* --- Engineer tripod machine gun --- */
export const TRIPOD_INTERACT_KEY = 'KeyE';
export const TRIPOD_MOUNT_RADIUS = 1.8;
export const TRIPOD_RPM = 1000;
export const TRIPOD_FIRE_INTERVAL = 60 / TRIPOD_RPM; // 0.06s
export const TRIPOD_MOUNT_COOLDOWN = 0.35;
export const TRIPOD_DAMAGE = 21;
export const TRIPOD_HEADSHOT_MULT = 1.9;
export const TRIPOD_RANGE = 140;
export const TRIPOD_TRAVERSE_LIMIT = Math.PI * 0.42; // ±75° from deployed facing
export const TRIPOD_MAX_HEAT = 100;
export const TRIPOD_HEAT_PER_SHOT = 1.05;
export const TRIPOD_COOL_RATE = 26;
export const TRIPOD_BUILD_COOLDOWN = 30.0;
export const TRIPOD_MAX_ACTIVE = 2;

export interface DeployedTripod {
  id: number;
  group: THREE.Group;
  barrelPivot: THREE.Group;
  muzzlePoint: THREE.Object3D;
  pos: THREE.Vector3;
  /** Facing the tripod was built at; traverse is clamped around this. */
  facing: number;
  currentYaw: number;
  currentPitch: number;
  health: number;
  maxHealth: number;
  heat: number;
  overheated: boolean;
  /** 'none' | 'player' | numeric bot id */
  occupant: 'none' | 'player' | number;
  mountAnchor: THREE.Vector3;
  fireCooldown: number;
  builtByBotId: number;
  collider: WorldCollider;
  alive: boolean;
  lifetime: number;
}

export interface MountedGunSession {
  tripodId: number;
  anchor: THREE.Vector3;
  mountedAt: number;
  cooldown: number;
}

/* --- Explosive projectiles --- */
export interface ActiveProjectile {
  id: number;
  kind: 'ROCKET' | 'ARC_GRENADE';
  weaponId: WeaponID;
  group: THREE.Group;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  splashRadius: number;
  splashDamage: number;
  ownerTeam: string;
  ownerIsPlayer: boolean;
  ownerBotId: number;
  life: number;
  armed: boolean;
  trailTimer: number;
}

/* =============================================================================
 * SECTION 6 — BOT ENTITY
 * ===========================================================================*/

export interface Bot {
  id: number;
  team: string;
  isZombie: boolean;
  zType: 'walker' | 'runner' | 'tank' | 'brute' | 'banshee' | 'bloater' | 'megaboss';
  mutantType?: MutantType;
  attackRange?: number;
  attackCooldown?: number;
  specialAbilityTimer?: number;
  isStaggered?: boolean;
  staggerTimer?: number;
  staggerImmune?: boolean;
  hoverHeight?: number;
  isExploding?: boolean;
  explosionTimer?: number;
  stunTimer?: number;
  weavePhase?: number;
  flankAngle?: number;
  roarCooldown?: number;
  isCharging?: boolean;
  chargeCooldown?: number;
  isVIP?: boolean;
  isTankBoss?: boolean;
  isElite?: boolean;
  eliteRole?: EliteArchetype;
  eliteSlot?: number;
  callsign?: string;
  focusTargetId?: number | null;
  meleeAnimTimer?: number;
  deployedCoverCooldown?: number;
  regenAuraTimer?: number;
  reconPingTimer?: number;
  classId?: ClassId;

  /* --- Advanced tactical AI --- */
  tactical?: TacticalAIState;
  /** 0..1 pressure applied by incoming fire; degrades accuracy and forces cover. */
  suppression?: number;
  /** Anomaly swarm: reticle dwell + enrage flags. */
  underReticle?: boolean;
  reticleDwell?: number;
  isEnraged?: boolean;

  /* --- Elite squad --- */
  regenFieldCooldown?: number;
  telemetryPingTimer?: number;
  tripodBuildCooldown?: number;
  mountedTripodId?: number | null;
  highGroundTarget?: THREE.Vector3 | null;
  highGroundTimer?: number;
  sightlineScore?: number;

  /* --- Arsenal --- */
  arsenalWeapon?: WeaponID;

  slideVel?: THREE.Vector3;
  kills: number;
  meleeDmg: number;
  meleeCooldown: number;
  isSprinting?: boolean;
  sprintSpeed?: number;
  patrolSpeed?: number;
  userData?: Record<string, any>;
  runnerTorsoLean?: number;
  lungeTimer?: number;
  lungeDir?: THREE.Vector3;
  attackRecoveryTimer?: number;
  group: THREE.Group;
  torsoGroup: THREE.Group;
  armLPivot: THREE.Group;
  armRPivot: THREE.Group;
  armLLowerPivot?: THREE.Group;
  armRLowerPivot?: THREE.Group;
  legLPivot: THREE.Group;
  legRPivot: THREE.Group;
  legLLowerPivot?: THREE.Group;
  legRLowerPivot?: THREE.Group;
  faction?: 'usmc' | 'apex' | 'zombie';
  subClass?: string;
  gunMesh: THREE.Group | null;
  muzzleFlash: THREE.Sprite | null;
  muzzleFlashT: number;
  weaponTypeIndex: number;
  weaponType: string;
  flashMats: THREE.MeshStandardMaterial[];
  hitParts: THREE.Mesh[];
  healthEl: HTMLDivElement;
  fillEl: HTMLDivElement;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  facing: number;
  health: number;
  maxHealth: number;
  armor?: number;
  maxArmor?: number;
  speed: number;
  walkPhase: number;
  preferredRange: number;
  strafeDir: number;
  strafeTimer: number;
  target: Bot | 'player' | null;
  waypoint: THREE.Vector3 | null;
  waypointTimer: number;
  fireTimer: number;
  alive: boolean;
  deathT: number;
  fallAxis: 'x' | 'z';
  fallDir: number;
  anchoredPos?: THREE.Vector3 | null;
  idleBehaviorState?: 'crouch_snipe' | 'low_ready_patrol' | 'medic_heal' | 'engineer_fortify' | 'idle';
  idleTimer?: number;
  idlePatrolDir?: number;
  patrolAnchor?: THREE.Vector3;
  deployedTurretCooldown?: number;
  medicHealParticleTimer?: number;
  healSlot?: {
    medkitCount: number;
    shieldPotCount: number;
    healCooldown: number;
  };
}

/* =============================================================================
 * SECTION 7 — PERSISTENCE LAYER (localStorage)
 * ===========================================================================*/

export interface PersistedLoadout {
  faction: FactionId;
  headgear: HeadgearId;
  torso: TorsoId;
  lower: LowerRigId;
  primary: WeaponID;
  secondary: WeaponID;
}

export interface GamePersistence {
  version: number;
  funds: number;
  lifetimeFunds: number;
  totalKills: number;
  heavyKills: number;
  deployments: number;
  extractions: number;
  bestSector: number;
  ownedWeapons: WeaponID[];
  ownedHeadgear: HeadgearId[];
  ownedTorso: TorsoId[];
  ownedLower: LowerRigId[];
  loadout: PersistedLoadout;
}

export interface AggregatedGearStats extends GearModifiers {
  maxArmor: number;
}

export function createDefaultPersistence(faction: FactionId = 'USMC_SPEC_OPS'): GamePersistence {
  const avatar = FACTION_AVATARS[faction];
  return {
    version: PERSISTENCE_SCHEMA_VERSION,
    funds: 0,
    lifetimeFunds: 0,
    totalKills: 0,
    heavyKills: 0,
    deployments: 0,
    extractions: 0,
    bestSector: 1,
    ownedWeapons: ['M4A1_TACTICAL', 'COMBAT_9MM'],
    ownedHeadgear: ['BARE_HEAD'],
    ownedTorso: ['CANVAS_RIG'],
    ownedLower: ['BDU_PANTS'],
    loadout: {
      faction,
      headgear: avatar.startingHeadgear,
      torso: avatar.startingTorso,
      lower: avatar.startingLower,
      primary: avatar.startingPrimary,
      secondary: avatar.startingSecondary
    }
  };
}

function coerceArray<T extends string>(raw: unknown, legal: readonly T[], fallback: T[]): T[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out = raw.filter((v): v is T => typeof v === 'string' && (legal as readonly string[]).includes(v));
  for (const f of fallback) {
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

export function loadPersistence(): GamePersistence {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultPersistence();
  }
  try {
    const raw = window.localStorage.getItem(GAME_PERSISTENCE_KEY);
    if (!raw) {
      const fresh = createDefaultPersistence();
      savePersistence(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<GamePersistence>;
    const base = createDefaultPersistence(
      parsed.loadout?.faction === 'MERCENARY_VANGUARD' ? 'MERCENARY_VANGUARD' : 'USMC_SPEC_OPS'
    );

    const merged: GamePersistence = {
      version: PERSISTENCE_SCHEMA_VERSION,
      funds: Number.isFinite(parsed.funds) ? Math.max(0, Math.floor(parsed.funds as number)) : 0,
      lifetimeFunds: Number.isFinite(parsed.lifetimeFunds) ? Math.max(0, Math.floor(parsed.lifetimeFunds as number)) : 0,
      totalKills: Number.isFinite(parsed.totalKills) ? Math.max(0, Math.floor(parsed.totalKills as number)) : 0,
      heavyKills: Number.isFinite(parsed.heavyKills) ? Math.max(0, Math.floor(parsed.heavyKills as number)) : 0,
      deployments: Number.isFinite(parsed.deployments) ? Math.max(0, Math.floor(parsed.deployments as number)) : 0,
      extractions: Number.isFinite(parsed.extractions) ? Math.max(0, Math.floor(parsed.extractions as number)) : 0,
      bestSector: Number.isFinite(parsed.bestSector) ? Math.max(1, Math.floor(parsed.bestSector as number)) : 1,
      ownedWeapons: coerceArray<WeaponID>(parsed.ownedWeapons, ARSENAL_ORDER, base.ownedWeapons),
      ownedHeadgear: coerceArray<HeadgearId>(
        parsed.ownedHeadgear,
        Object.keys(HEADGEAR_CATALOG) as HeadgearId[],
        base.ownedHeadgear
      ),
      ownedTorso: coerceArray<TorsoId>(parsed.ownedTorso, Object.keys(TORSO_CATALOG) as TorsoId[], base.ownedTorso),
      ownedLower: coerceArray<LowerRigId>(parsed.ownedLower, Object.keys(LOWER_CATALOG) as LowerRigId[], base.ownedLower),
      loadout: { ...base.loadout, ...(parsed.loadout || {}) }
    };

    // Never leave the operator holding equipment they do not own.
    if (!merged.ownedHeadgear.includes(merged.loadout.headgear)) merged.loadout.headgear = 'BARE_HEAD';
    if (!merged.ownedTorso.includes(merged.loadout.torso)) merged.loadout.torso = 'CANVAS_RIG';
    if (!merged.ownedLower.includes(merged.loadout.lower)) merged.loadout.lower = 'BDU_PANTS';
    if (!merged.ownedWeapons.includes(merged.loadout.primary)) merged.loadout.primary = 'M4A1_TACTICAL';
    if (!merged.ownedWeapons.includes(merged.loadout.secondary)) merged.loadout.secondary = 'COMBAT_9MM';

    return merged;
  } catch {
    return createDefaultPersistence();
  }
}

export function savePersistence(data: GamePersistence): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(GAME_PERSISTENCE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded or storage disabled — gameplay continues, progress is not kept */
  }
}

export function resetPersistence(faction: FactionId = 'USMC_SPEC_OPS'): GamePersistence {
  const fresh = createDefaultPersistence(faction);
  savePersistence(fresh);
  return fresh;
}

/** True when a kill should pay the heavy bounty rather than the standard one. */
export function isHeavyTarget(bot: Bot): boolean {
  if (bot.isElite) return true;
  if (bot.isTankBoss) return true;
  if (bot.isZombie) {
    return bot.zType === 'brute' || bot.zType === 'tank' || bot.zType === 'megaboss' || bot.zType === 'bloater';
  }
  return bot.subClass === 'heavy_gunner' || bot.subClass === 'juggernaut';
}

export function killReward(bot: Bot): number {
  return isHeavyTarget(bot) ? KILL_REWARD_HEAVY : KILL_REWARD_STANDARD;
}

export function awardKillFunds(data: GamePersistence, bot: Bot): { data: GamePersistence; amount: number } {
  const heavy = isHeavyTarget(bot);
  const amount = heavy ? KILL_REWARD_HEAVY : KILL_REWARD_STANDARD;
  const next: GamePersistence = {
    ...data,
    funds: data.funds + amount,
    lifetimeFunds: data.lifetimeFunds + amount,
    totalKills: data.totalKills + 1,
    heavyKills: data.heavyKills + (heavy ? 1 : 0)
  };
  savePersistence(next);
  return { data: next, amount };
}

export function creditFunds(data: GamePersistence, amount: number): GamePersistence {
  const safe = Math.max(0, Math.floor(amount));
  const next: GamePersistence = {
    ...data,
    funds: data.funds + safe,
    lifetimeFunds: data.lifetimeFunds + safe
  };
  savePersistence(next);
  return next;
}

export type PurchaseResult =
  | { ok: true; data: GamePersistence }
  | { ok: false; reason: string; data: GamePersistence };

export function purchaseWeapon(data: GamePersistence, id: WeaponID): PurchaseResult {
  if (data.ownedWeapons.includes(id)) return { ok: true, data };
  const def = ARSENAL[id];
  if (!def) return { ok: false, reason: 'Unknown weapon', data };
  if (data.funds < def.price) {
    return { ok: false, reason: `Need $${(def.price - data.funds).toLocaleString()} more`, data };
  }
  const next: GamePersistence = {
    ...data,
    funds: data.funds - def.price,
    ownedWeapons: [...data.ownedWeapons, id]
  };
  savePersistence(next);
  return { ok: true, data: next };
}

export function purchaseGear(
  data: GamePersistence,
  slot: GearSlot,
  id: HeadgearId | TorsoId | LowerRigId
): PurchaseResult {
  const def =
    slot === 'HEADGEAR'
      ? HEADGEAR_CATALOG[id as HeadgearId]
      : slot === 'TORSO'
      ? TORSO_CATALOG[id as TorsoId]
      : LOWER_CATALOG[id as LowerRigId];

  if (!def) return { ok: false, reason: 'Unknown item', data };

  const owned =
    slot === 'HEADGEAR'
      ? data.ownedHeadgear.includes(id as HeadgearId)
      : slot === 'TORSO'
      ? data.ownedTorso.includes(id as TorsoId)
      : data.ownedLower.includes(id as LowerRigId);

  if (owned) return { ok: true, data };

  if (data.funds < def.price) {
    return { ok: false, reason: `Need $${(def.price - data.funds).toLocaleString()} more`, data };
  }

  const next: GamePersistence = {
    ...data,
    funds: data.funds - def.price,
    ownedHeadgear:
      slot === 'HEADGEAR' ? [...data.ownedHeadgear, id as HeadgearId] : data.ownedHeadgear,
    ownedTorso: slot === 'TORSO' ? [...data.ownedTorso, id as TorsoId] : data.ownedTorso,
    ownedLower: slot === 'LOWER' ? [...data.ownedLower, id as LowerRigId] : data.ownedLower
  };
  savePersistence(next);
  return { ok: true, data: next };
}

export function equipLoadout(data: GamePersistence, patch: Partial<PersistedLoadout>): GamePersistence {
  const next: GamePersistence = { ...data, loadout: { ...data.loadout, ...patch } };
  savePersistence(next);
  return next;
}

/** Folds every equipped piece into a single stat block the gameplay loop reads. */
export function resolveGearModifiers(loadout: PersistedLoadout): AggregatedGearStats {
  const pieces: GearItemDef[] = [
    HEADGEAR_CATALOG[loadout.headgear],
    TORSO_CATALOG[loadout.torso],
    LOWER_CATALOG[loadout.lower]
  ];

  const out: AggregatedGearStats = { ...DEFAULT_GEAR_MODIFIERS, maxArmor: 100 };

  for (const piece of pieces) {
    if (!piece) continue;
    const m = piece.modifiers;
    if (m.headshotDamageMult !== undefined) out.headshotDamageMult *= m.headshotDamageMult;
    if (m.bulletDamageMult !== undefined) out.bulletDamageMult *= m.bulletDamageMult;
    if (m.moveSpeedMult !== undefined) out.moveSpeedMult *= m.moveSpeedMult;
    if (m.sprintSpeedMult !== undefined) out.sprintSpeedMult *= m.sprintSpeedMult;
    if (m.reloadSpeedMult !== undefined) out.reloadSpeedMult *= m.reloadSpeedMult;
    if (m.drawSpeedMult !== undefined) out.drawSpeedMult *= m.drawSpeedMult;
    if (m.reserveAmmoMult !== undefined) out.reserveAmmoMult *= m.reserveAmmoMult;
    if (m.sidearmMagBonus !== undefined) out.sidearmMagBonus += m.sidearmMagBonus;
    if (m.suppressionBonusPct !== undefined) out.suppressionBonusPct += m.suppressionBonusPct;
    if (m.staggerImmune) out.staggerImmune = true;
    if (m.zeroJumpFatigue) out.zeroJumpFatigue = true;
    if (piece.armorCapacity > 0) out.maxArmor = piece.armorCapacity;
  }

  return out;
}

/** Total cost of everything not yet owned — drives the "grind remaining" readout. */
export function outstandingGrindCost(data: GamePersistence): number {
  let total = 0;
  for (const id of ARSENAL_ORDER) {
    if (!data.ownedWeapons.includes(id)) total += ARSENAL[id].price;
  }
  (Object.keys(HEADGEAR_CATALOG) as HeadgearId[]).forEach((k) => {
    if (!data.ownedHeadgear.includes(k)) total += HEADGEAR_CATALOG[k].price;
  });
  (Object.keys(TORSO_CATALOG) as TorsoId[]).forEach((k) => {
    if (!data.ownedTorso.includes(k)) total += TORSO_CATALOG[k].price;
  });
  (Object.keys(LOWER_CATALOG) as LowerRigId[]).forEach((k) => {
    if (!data.ownedLower.includes(k)) total += LOWER_CATALOG[k].price;
  });
  return total;
}

declare global {
  interface Window {
    aiDirectorState: any;
    radarScrambleTimer?: number;
    IS_DEV_MODE?: boolean;
  }
}
