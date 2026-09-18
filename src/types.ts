import * as THREE from 'three';

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
  eliteRole?: 'heavy' | 'medic' | 'recon' | 'engineer';
  eliteSlot?: number;
  callsign?: string;
  focusTargetId?: number | null;
  meleeAnimTimer?: number;
  deployedCoverCooldown?: number;
  regenAuraTimer?: number;
  reconPingTimer?: number;
  classId?: ClassId;
  healSlot?: {
    medkitCount: number;
    shieldPotCount: number;
    healCooldown: number;
  };
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

export type DeploymentProtocol = 'elite' | 'battalion';

export type SquadDirective = 'follow_lead' | 'hold_position' | 'push_objective' | 'focus_target';

export interface EliteCompanionConfig {
  slotId: number; // 2, 3, 4, 5
  roleTitle: string;
  callsign: string;
  archetype: 'heavy' | 'medic' | 'recon' | 'engineer';
  icon: string;
  primaryWeapon: string;
  secondaryWeapon: string;
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
    gearPlate: 'heavy',
    perkDescription: 'LMG suppression fire & heavy ballistic plate plating.'
  },
  {
    slotId: 3,
    roleTitle: 'Combat Medic',
    callsign: 'DOC-3',
    archetype: 'medic',
    icon: '🩺',
    primaryWeapon: 'ar',
    secondaryWeapon: 'shotgun',
    gearPlate: 'standard',
    perkDescription: 'Deploys localized health regen field restoring +15 HP/s.'
  },
  {
    slotId: 4,
    roleTitle: 'Recon Scout',
    callsign: 'SPECTRE-4',
    archetype: 'recon',
    icon: '👁️',
    primaryWeapon: 'sniper',
    secondaryWeapon: 'pistol',
    gearPlate: 'spec_ops',
    perkDescription: 'Active telemetry pings revealing hostiles on motion radar.'
  },
  {
    slotId: 5,
    roleTitle: 'Combat Engineer',
    callsign: 'WRENCH-5',
    archetype: 'engineer',
    icon: '🛠️',
    primaryWeapon: 'smg',
    secondaryWeapon: 'shotgun',
    gearPlate: 'heavy',
    perkDescription: 'Constructs deployable fortified barricades under pressure.'
  }
];

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

export type ClassId = 'assault' | 'heavy' | 'recon' | 'medic' | 'engineer' | 'breacher' | 'juggernaut' | 'vanguard';

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

export interface ToxicPuddle {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  radius: number;
  duration: number;
  maxDuration: number;
  dps: number;
}

declare global {
  interface Window {
    aiDirectorState: any;
  }
}
