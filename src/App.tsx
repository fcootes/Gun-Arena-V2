import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Bot,
  WeaponDef,
  WeaponSlotState,
  ActiveGrenade,
  ExplosionEffect,
  MatchConfig,
  GameMode,
  DifficultyConfig,
  ClassId,
  ClassConfig,
  ArmoryOption,
  WorldCollider,
  DeploymentProtocol,
  SquadDirective,
  EliteCompanionConfig,
  DEFAULT_ELITE_SQUAD
} from './types';
import { WEAPONS, createViewmodelManager } from './weapons';
import {
  AUDIO,
  unlockAudioEngine,
  getSpatialVolume,
  grenadeThrowSound,
  grenadeExplosionSound,
  PISTOL_AUDIO_FILENAMES,
  updateRailgunChargeAudio,
  playRailgunSlugBlast,
  updateMinigunSpinAudio,
  playMinigunFireShot,
  playMinigunVentHiss,
  updateAdrenalineHeartbeat,
  playKnifeSlashWhoosh
} from './audio';
import { createWorld, terrainHeight, randomMapPoint } from './world';
import { buildBotVisuals } from './botBuilder';
import { createLobbyAvatar, VisorType, FactionType, LobbyAvatarController } from './lobbyAvatar';
import { HelmetHUD, RadarPing } from './HelmetHUD';
import { LobbyTerminal, LobbyTab } from './LobbyTerminal';
import { useFaction } from './FactionContext';
import {
  ExtractionGameLoop,
  ExtractionState,
  updateBioMutantAI,
  BioMutantAIContext,
  updateToxicPuddles,
  detonateBloater
} from './gameLoop';
import { MutantType } from './types';
import { ExtractionObjectiveHUD, ExtractionEndScreen } from './UI';
import {
  getCareerLedger,
  calculateMatchRewards,
  MatchRewardBreakdown,
  FactionCareerLedger,
  getRankTitle,
  getXpForRank
} from './careerLedger';

export const CLASSES: Record<ClassId, ClassConfig> = {
  assault: {
    id: 'assault',
    name: 'ASSAULT',
    tagline: 'FRONTLINE RIFLE SPECIALIST',
    perkName: 'TACTICAL SLEIGHT OF HAND',
    perkDesc: '+25% Faster Weapon Reload Animation Speed across all guns',
    color: '#57d1c9',
    defaultPrimary: 'ar',
    defaultSecondary: 'pistol',
    reloadMultiplier: 0.75, // 25% faster reload duration
    speedMultiplier: 1.0,
    maxHealth: 100,
    initialHealth: 100,
    maxShield: 100,
    initialShield: 100
  },
  heavy: {
    id: 'heavy',
    name: 'HEAVY',
    tagline: 'HEAVY SUPPRESSION TANK',
    perkName: 'TITAN ARMORED PLATING',
    perkDesc: 'Boosts max White Health pool to 200 points (-15% Movement Velocity penalty)',
    color: '#e0473f',
    defaultPrimary: 'minigun',
    defaultSecondary: 'lmg',
    reloadMultiplier: 1.0,
    speedMultiplier: 0.85, // -15% movement velocity
    maxHealth: 200,
    initialHealth: 200,
    maxShield: 100,
    initialShield: 100
  },
  recon: {
    id: 'recon',
    name: 'RECON',
    tagline: 'HIGH-VELOCITY SCOUT & MARKSMAN',
    perkName: 'LIGHTWEIGHT AGILITY',
    perkDesc: '+20% Base Walking & Sprinting Velocity',
    color: '#00e5ff',
    defaultPrimary: 'sniper',
    defaultSecondary: 'smg',
    reloadMultiplier: 1.0,
    speedMultiplier: 1.20, // +20% movement velocity
    maxHealth: 100,
    initialHealth: 100,
    maxShield: 100,
    initialShield: 100
  },
  medic: {
    id: 'medic',
    name: 'MEDIC',
    tagline: 'COMBAT TRIAGE & SHIELD BIO-GEN',
    perkName: 'FIELD TRIAGE NANITES',
    perkDesc: 'Reinforced 125 HP & 125 Shield with rapid biological regeneration',
    color: '#22c55e',
    defaultPrimary: 'br',
    defaultSecondary: 'pistol',
    reloadMultiplier: 0.9,
    speedMultiplier: 1.05,
    maxHealth: 125,
    initialHealth: 125,
    maxShield: 125,
    initialShield: 125
  },
  engineer: {
    id: 'engineer',
    name: 'ENGINEER',
    tagline: 'FORTIFIED DEMOLITIONS & DEFENSE',
    perkName: 'OVERCHARGED ENERGY GRID',
    perkDesc: '150 Overcharged Blue Shield points and reinforced blast protection',
    color: '#3f8fe0',
    defaultPrimary: 'shotgun',
    defaultSecondary: 'railgun',
    reloadMultiplier: 1.0,
    speedMultiplier: 1.0,
    maxHealth: 100,
    initialHealth: 100,
    maxShield: 150,
    initialShield: 150
  },
  breacher: {
    id: 'breacher',
    name: 'BREACHER',
    tagline: 'FORTIFIED POINTMAN',
    perkName: 'OVERCHARGED ENERGY SHIELD',
    perkDesc: 'Initializes match with 150 Blue Shield points (Cap: 150)',
    color: '#3f8fe0',
    defaultPrimary: 'shotgun',
    defaultSecondary: 'laser',
    reloadMultiplier: 1.0,
    speedMultiplier: 1.0,
    maxHealth: 100,
    initialHealth: 100,
    maxShield: 150,
    initialShield: 150
  },
  juggernaut: {
    id: 'juggernaut',
    name: 'JUGGERNAUT',
    tagline: 'HEAVY SUPPRESSION TANK',
    perkName: 'TITAN ARMORED PLATING',
    perkDesc: 'Boosts max White Health pool to 200 points (-15% Movement Velocity penalty)',
    color: '#e0473f',
    defaultPrimary: 'minigun',
    defaultSecondary: 'lmg',
    reloadMultiplier: 1.0,
    speedMultiplier: 0.85,
    maxHealth: 200,
    initialHealth: 200,
    maxShield: 100,
    initialShield: 100
  },
  vanguard: {
    id: 'vanguard',
    name: 'VANGUARD',
    tagline: 'ALL-ROUND STRIKE SPECIALIST',
    perkName: 'STANDARDIZED PRECISION',
    perkDesc: 'Standard balanced 100 HP / 100 Shield military loadout',
    color: '#f5a623',
    defaultPrimary: 'br',
    defaultSecondary: 'railgun',
    reloadMultiplier: 1.0,
    speedMultiplier: 1.0,
    maxHealth: 100,
    initialHealth: 100,
    maxShield: 100,
    initialShield: 100
  }
};

export const ARMORY_OPTIONS: ArmoryOption[] = [
  { id: 'ar', label: 'Assault Rifle', slotNum: '1' },
  { id: 'shotgun', label: 'Pump Shotgun', slotNum: '2' },
  { id: 'sniper', label: 'Bolt-Action Sniper', slotNum: '3' },
  { id: 'pistol', label: 'Combat Pistol', slotNum: '4' },
  { id: 'smg', label: 'Rapid SMG', slotNum: '5' },
  { id: 'lmg', label: 'Heavy Drum LMG', slotNum: '6' },
  { id: 'br', label: 'Battle Rifle (Burst)', slotNum: '7' },
  { id: 'laser', label: 'Covenant Laser', slotNum: '8' },
  { id: 'minigun', label: 'Heavy Minigun', slotNum: '9' },
  { id: 'railgun', label: 'Tactical Railgun', slotNum: '0' }
];

const PLAYER_EYE = 1.65;
const PLAYER_EYE_CROUCH = 1.0;
const PLAYER_RADIUS = 0.42;
const GRAVITY = -22;
const JUMP_SPEED = 7.2;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.6;
const CROUCH_SPEED = 2.6;
const HIP_FOV = 74;
const STORM_SAFE_TIME = 28;
const STORM_SHRINK_TIME = 220;
const STORM_START_R = 70;
const STORM_MIN_R = 8;
const STORM_DPS = 4.5;
const BOT_BASE_HEALTH = 85;

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  easy:   { label: 'EASY',   botHealthMult: 0.75, botDamageMult: 0.6,  botFireRateMult: 1.35, botAccuracy: 0.28 },
  medium: { label: 'MEDIUM', botHealthMult: 1.0,  botDamageMult: 1.0,  botFireRateMult: 1.0,  botAccuracy: 0.40 },
  hard:   { label: 'HARD',   botHealthMult: 1.3,  botDamageMult: 1.5,  botFireRateMult: 0.75, botAccuracy: 0.58 }
};

// Fast 2D line segment vs AABB intersection test for zombie LOS
function lineIntersectsAABB(
  x1: number, z1: number,
  x2: number, z2: number,
  minX: number, maxX: number,
  minZ: number, maxZ: number
): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;

  if (Math.abs(dx) < 1e-6) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    const invDx = 1 / dx;
    let t1 = (minX - x1) * invDx;
    let t2 = (maxX - x1) * invDx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dz) < 1e-6) {
    if (z1 < minZ || z1 > maxZ) return false;
  } else {
    const invDz = 1 / dz;
    let t1 = (minZ - z1) * invDz;
    let t2 = (maxZ - z1) * invDz;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}

// Line of sight check between zombie and target against active world colliders
function checkZombieLOS(
  botPos: THREE.Vector3,
  targetPos: THREE.Vector3,
  colliders: WorldCollider[]
): boolean {
  const minY = Math.min(botPos.y, targetPos.y) + 0.2;
  const maxY = Math.max(botPos.y, targetPos.y) + 1.8;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.active === false || c.isDoor || c.isStair || c.isRamp) continue;
    if (maxY < c.minY || minY > c.maxY) continue;
    if (lineIntersectsAABB(botPos.x, botPos.z, targetPos.x, targetPos.z, c.minX, c.maxX, c.minZ, c.maxZ)) {
      return false;
    }
  }
  return true;
}

// Raycast obstacle avoidance for zombies navigating around walls, corridors, and platforms
function findClearPathAngle(
  originX: number, originZ: number,
  desiredDx: number, desiredDz: number,
  colliders: WorldCollider[],
  radius = 0.42,
  castDist = 2.4
): { dx: number; dz: number } {
  const baseAngle = Math.atan2(desiredDx, desiredDz);
  const testOffsets = [
    0,
    Math.PI / 6,
    -Math.PI / 6,
    Math.PI / 3,
    -Math.PI / 3,
    Math.PI / 2,
    -Math.PI / 2,
    (Math.PI * 2) / 3,
    -(Math.PI * 2) / 3,
    (Math.PI * 5) / 6,
    -(Math.PI * 5) / 6
  ];

  for (let i = 0; i < testOffsets.length; i++) {
    const angle = baseAngle + testOffsets[i];
    const testDx = Math.sin(angle);
    const testDz = Math.cos(angle);
    const endX = originX + testDx * castDist;
    const endZ = originZ + testDz * castDist;

    let blocked = false;
    for (let j = 0; j < colliders.length; j++) {
      const c = colliders[j];
      if (c.active === false || c.isDoor || c.isStair || c.isRamp) continue;
      if (lineIntersectsAABB(originX, originZ, endX, endZ, c.minX - radius, c.maxX + radius, c.minZ - radius, c.maxZ + radius)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      return { dx: testDx, dz: testDz };
    }
  }

  return { dx: desiredDx, dz: desiredDz };
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  // React UI state for overlays and audio guidance
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'DEATH_SCREEN'>('start');
  const [endResult, setEndResult] = useState<{ victory: boolean; title: string; sub: string }>({ victory: true, title: 'VICTORY', sub: '' });
  const [matchRewards, setMatchRewards] = useState<MatchRewardBreakdown | null>(null);
  const [showAudioHelper, setShowAudioHelper] = useState(false);
  const [extractionState, setExtractionState] = useState<ExtractionState | null>(null);

  // Match Config & Difficulty UI
  const [matchMode, setMatchMode] = useState<GameMode>('extraction');
  const { faction: factionAlignment, setFaction: setFactionAlignment, gearTier } = useFaction();
  const [friendlyCount, setFriendlyCount] = useState(3);
  const [enemyCount, setEnemyCount] = useState(5);
  const [targetScore, setTargetScore] = useState(20);
  const [difficultyKey, setDifficultyKey] = useState<string>('medium');
  const [sensitivityVal, setSensitivityVal] = useState(11);

  // Battlefront-Style 5-Class Selection & Armory Customization
  const [selectedClassId, setSelectedClassId] = useState<ClassId>('assault');
  const [selectedPrimary, setSelectedPrimary] = useState<string>('ar');
  const [selectedSecondary, setSelectedSecondary] = useState<string>('pistol');
  
  const [selectedMapState, setSelectedMapState] = useState<'training' | 'hangar'>('training');
  const [isDevMode, setIsDevMode] = useState(false);
  
  // Update window global for non-React contexts
  useEffect(() => {
    (window as any).IS_DEV_MODE = isDevMode;
  }, [isDevMode]);

  // Game stats for UI readout
  const [stats, setStats] = useState({
    health: 100,
    shield: 100,
    kills: 0,
    funds: 0,
    time: '00:00',
    wave: 1,
    zombies: 0,
    blueScore: 0,
    redScore: 0,
    zoneStatus: 'SAFE',
    headshotPct: 0,
    combatScore: 0,
    wavesCleared: 1,
    damageDealt: 0,
    accuracyPct: 0
  });

  const selectedMapStateRef = useRef(selectedMapState);
  selectedMapStateRef.current = selectedMapState;

  // Strict Map Rules State Guardrail: Horde Mode strictly enforces Subterranean Hangar map
  useEffect(() => {
    if (matchMode === 'zombie' && selectedMapState !== 'hangar') {
      setSelectedMapState('hangar');
    }
  }, [matchMode, selectedMapState]);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const matchModeRef = useRef(matchMode);
  matchModeRef.current = matchMode;
  const factionAlignmentRef = useRef(factionAlignment);
  factionAlignmentRef.current = factionAlignment;
  const gearTierRef = useRef(gearTier);
  gearTierRef.current = gearTier;
  const friendlyCountRef = useRef(friendlyCount);
  friendlyCountRef.current = friendlyCount;
  const enemyCountRef = useRef(enemyCount);
  enemyCountRef.current = enemyCount;
  const targetScoreRef = useRef(targetScore);
  targetScoreRef.current = targetScore;
  const difficultyKeyRef = useRef(difficultyKey);
  difficultyKeyRef.current = difficultyKey;
  const sensitivityValRef = useRef(sensitivityVal);
  sensitivityValRef.current = sensitivityVal;

  const selectedClassIdRef = useRef(selectedClassId);
  selectedClassIdRef.current = selectedClassId;
  const selectedPrimaryRef = useRef(selectedPrimary);
  selectedPrimaryRef.current = selectedPrimary;
  const selectedSecondaryRef = useRef(selectedSecondary);
  selectedSecondaryRef.current = selectedSecondary;

  // Elite Task Force vs Standard Battalion deployment doctrine
  const [deploymentProtocol, setDeploymentProtocol] = useState<DeploymentProtocol>('elite');
  const deploymentProtocolRef = useRef<DeploymentProtocol>(deploymentProtocol);
  deploymentProtocolRef.current = deploymentProtocol;

  const [eliteSquad, setEliteSquad] = useState<EliteCompanionConfig[]>(DEFAULT_ELITE_SQUAD);
  const eliteSquadRef = useRef<EliteCompanionConfig[]>(eliteSquad);
  eliteSquadRef.current = eliteSquad;

  const [squadDirective, setSquadDirective] = useState<SquadDirective>('follow_lead');
  const squadDirectiveRef = useRef<SquadDirective>(squadDirective);
  squadDirectiveRef.current = squadDirective;

  const [squadDirectiveBanner, setSquadDirectiveBanner] = useState<{
    directive: SquadDirective;
    text: string;
    sub: string;
    timer: number;
  } | null>(null);

  const [targetingPhase, setTargetingPhase] = useState(false);
  const targetingPhaseRef = useRef(false);
  const focusTargetIDRef = useRef<number | null>(null);
  targetingPhaseRef.current = targetingPhase;


  useEffect(() => {
    if (!squadDirectiveBanner) return;
    const t = setTimeout(() => {
      setSquadDirectiveBanner(null);
    }, 2800);
    return () => clearTimeout(t);
  }, [squadDirectiveBanner]);

  const [activeTab, setActiveTab] = useState<LobbyTab>('play');
  const [visorType, setVisorType] = useState<VisorType>('standard');
  const visorTypeRef = useRef<VisorType>(visorType);
  visorTypeRef.current = visorType;

  const radarPingsRef = useRef<RadarPing[]>([]);
  const deployHandlerRef = useRef<() => void>();
  const resumeHandlerRef = useRef<() => void>();
  const restartHandlerRef = useRef<() => void>();
  const lobbyHandlerRef = useRef<() => void>();

  const [hudData, setHudData] = useState({
    health: 100,
    maxHealth: 100,
    shield: 100,
    maxShield: 100,
    currentWeapon: WEAPONS[0],
    weaponSlotState: { ammo: 30, reserve: 120, reloading: false, overheated: false } as WeaponSlotState,
    slotIndex: 0,
    playerLoadout: WEAPONS.slice(0, 3),
    playerLoadoutStates: [] as WeaponSlotState[],
    playerPos: { x: 0, z: 0 },
    playerYaw: 0,
    kills: 0,
    timeStr: '00:00',
    zoneStatus: 'SAFE',
    blueScore: 0,
    redScore: 0,
    targetScore: 20,
    currentWave: 1,
    zombiesRemaining: 0
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Set up Three.js Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const viewport = containerRef.current.querySelector('#viewport') as HTMLDivElement;
    if (viewport) {
      viewport.innerHTML = '';
      viewport.appendChild(renderer.domElement);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(HIP_FOV, window.innerWidth / window.innerHeight, 0.05, 500);
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    // Sky & Lighting (Combat)
    const combatLightGroup = new THREE.Group();
    scene.add(combatLightGroup);

    const isHangar = selectedMapStateRef.current === 'hangar';
    const hemiLightIntensity = isHangar ? 0.05 : 0.65;
    const sunLightIntensity = isHangar ? 0.0 : 1.05;

    const hemiLight = new THREE.HemisphereLight(0xbfd9ff, 0x3a3226, hemiLightIntensity);
    combatLightGroup.add(hemiLight);
    const sunLight = new THREE.DirectionalLight(0xfff2d9, sunLightIntensity);
    sunLight.position.set(120, 180, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -140;
    sunLight.shadow.camera.right = 140;
    sunLight.shadow.camera.top = 140;
    sunLight.shadow.camera.bottom = -140;
    sunLight.shadow.camera.far = 450;
    combatLightGroup.add(sunLight);
    const combatFog = new THREE.Fog(0xbfd6e6, 80, 360);
    scene.fog = combatFog;

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(420, 20, 20);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x2f6fb0) },
        bottomColor: { value: new THREE.Color(0xdcecf6) },
        offset: { value: 18 },
        exponent: { value: 0.75 }
      },
      vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorldPosition = wp.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0), exponent), 0.0)), 1.0); }`,
      side: THREE.BackSide
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    combatLightGroup.add(skyMesh);

    // Subterranean Concrete Hangar Bunker Environment & Armory (Lobby Scene)
    const lobbyFog = new THREE.Fog(0x0a0d12, 10, 32);
    let hangarGroup: THREE.Group | null = null;
    let lobbyAvatar: LobbyAvatarController | null = null;

    function setupLobbyScene() {
      if (hangarGroup || lobbyAvatar) {
        teardownLobbyScene();
      }

      hangarGroup = new THREE.Group();
      hangarGroup.position.set(0, 1000, 0);
      scene.add(hangarGroup);
      
      // 1. Concrete Floor with Polished Surface & Tactical Markings
      const floorGeo = new THREE.PlaneGeometry(36, 50);
      const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x14181d, 
        roughness: 0.52, 
        metalness: 0.25 
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      hangarGroup.add(floorMesh);

      // Hazard Border Lines along hangar edges (X = -4.2 and +4.2)
      const hazardMat = new THREE.MeshBasicMaterial({ color: 0xd49b28 });
      const hazardL = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 45), hazardMat);
      hazardL.rotation.x = -Math.PI / 2;
      hazardL.position.set(-4.2, 0.005, -5);
      const hazardR = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 45), hazardMat);
      hazardR.rotation.x = -Math.PI / 2;
      hazardR.position.set(4.2, 0.005, -5);
      hangarGroup.add(hazardL, hazardR);

      // 2. Vaulted Arch Concrete Ceiling / Bunker Tunnel
      const archMat = new THREE.MeshStandardMaterial({
        color: 0x181c22,
        roughness: 0.88,
        metalness: 0.12,
        side: THREE.BackSide
      });
      const archGeo = new THREE.CylinderGeometry(8.5, 8.5, 46, 36, 1, true, -Math.PI / 2, Math.PI);
      const archMesh = new THREE.Mesh(archGeo, archMat);
      archMesh.rotation.z = Math.PI / 2;
      archMesh.position.set(0, 0, -5);
      hangarGroup.add(archMesh);

      // Reinforced Concrete Support Rib Arches along Z
      const ribMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.8 });
      [-20, -14, -8, -2, 4, 10].forEach((rz) => {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(8.46, 0.28, 12, 36, Math.PI), ribMat);
        rib.position.set(0, 0, rz);
        hangarGroup!.add(rib);
      });

      // 3. Overhead Recessed Industrial Bunker Ceiling Lamps & Spotlights
      const lampHousingMat = new THREE.MeshStandardMaterial({ color: 0x121519, roughness: 0.4 });
      const lampLensMat = new THREE.MeshBasicMaterial({ color: 0xd8efff });
      [-18, -12, -6, 0, 6].forEach((lz) => {
        const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 16), lampHousingMat);
        lampHousing.position.set(0, 8.35, lz);
        const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), lampLensMat);
        lampLens.rotation.x = Math.PI / 2;
        lampLens.position.set(0, 8.27, lz);
        hangarGroup!.add(lampHousing, lampLens);

        // Downward pool of light on the tunnel floor
        const tunnelSpot = new THREE.SpotLight(0xd8efff, 2.5, 16, Math.PI / 4.5, 0.6, 1.2);
        tunnelSpot.position.set(0, 8.2, lz);
        tunnelSpot.target.position.set(0, 0, lz);
        hangarGroup!.add(tunnelSpot);
        hangarGroup!.add(tunnelSpot.target);
      });

      // 4. Subterranean Bunker Blast Door / Bulkhead at far end (Z = -22)
      const bulkheadMat = new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.7, metalness: 0.3 });
      const bulkheadWall = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), bulkheadMat);
      bulkheadWall.position.set(0, 7, -22.5);
      hangarGroup.add(bulkheadWall);

      const doorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 5.8, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x0e1115, roughness: 0.5, metalness: 0.6 })
      );
      doorFrame.position.set(0, 2.9, -22.3);
      const doorPanel = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 5.4, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x1b2027, roughness: 0.4, metalness: 0.5 })
      );
      doorPanel.position.set(0, 2.9, -22.25);
      hangarGroup.add(doorFrame, doorPanel);

      // 5. Server Racks and Tactical Storage Equipment along walls
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.6, metalness: 0.4 });
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x2d3527, roughness: 0.8 });
      const hardCaseMat = new THREE.MeshStandardMaterial({ color: 0x262b32, roughness: 0.5 });

      [-14, -10, -6, -2].forEach((sz) => {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.8, 0.9), rackMat);
        rack.position.set(-5.6, 1.9, sz);
        hangarGroup!.add(rack);

        const ledMat = new THREE.MeshBasicMaterial({ 
          color: sz % 4 === 0 ? 0x2de2e6 : (sz % 3 === 0 ? 0x22c55e : 0xf5a623) 
        });
        const ledStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 2.8), ledMat);
        ledStrip.rotation.y = Math.PI / 2;
        ledStrip.position.set(-4.99, 1.9, sz);
        hangarGroup!.add(ledStrip);
      });

      [-12, -7, -3].forEach((cz) => {
        const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.0), crateMat);
        crate1.position.set(5.5, 0.4, cz);
        const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), hardCaseMat);
        crate2.position.set(5.5, 1.15, cz + 0.1);
        hangarGroup!.add(crate1, crate2);
      });

      // 6. Background Tactical Guard Silhouettes (matching reference image)
      const guardMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.9 });
      const createGuardFigure = (x: number, z: number) => {
        const gGroup = new THREE.Group();
        gGroup.position.set(x, 0, z);
        const gLegs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.25), guardMat);
        gLegs.position.y = 0.45;
        const gTorso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.3), guardMat);
        gTorso.position.y = 1.2;
        const gHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), guardMat);
        gHead.position.y = 1.68;
        gGroup.add(gLegs, gTorso, gHead);
        return gGroup;
      };
      hangarGroup.add(createGuardFigure(-4.2, -16));
      hangarGroup.add(createGuardFigure(4.4, -14));

      // 7. Cinematic Downward Directional Spotlights directly casting onto Operator (Requirement 1)
      const operatorKeySpot = new THREE.SpotLight(0xeef6ff, 7.5, 18, Math.PI / 5.2, 0.45, 1.2);
      operatorKeySpot.position.set(0, 5.4, 1.4);
      operatorKeySpot.target.position.set(0, 1.1, 0);
      operatorKeySpot.castShadow = true;
      operatorKeySpot.shadow.bias = -0.0005;
      operatorKeySpot.shadow.mapSize.set(2048, 2048);
      hangarGroup.add(operatorKeySpot);
      hangarGroup.add(operatorKeySpot.target);

      const operatorTopSpot = new THREE.SpotLight(0xffffff, 4.2, 14, Math.PI / 6, 0.5, 1.2);
      operatorTopSpot.position.set(0, 5.8, -0.1);
      operatorTopSpot.target.position.set(0, 1.2, 0);
      hangarGroup.add(operatorTopSpot);
      hangarGroup.add(operatorTopSpot.target);

      const hangarAmbient = new THREE.AmbientLight(0x0e131a, 0.45);
      hangarGroup.add(hangarAmbient);

      // 3D Humanoid Lobby Avatar Showcase
      lobbyAvatar = createLobbyAvatar(scene, new THREE.Vector3(0, 1000, 0));
      (window as any).__lobbyAvatar = lobbyAvatar;
    }

    function teardownLobbyScene() {
      // 1. Purge, dispose, and remove Lobby Avatar meshes
      if (lobbyAvatar) {
        try {
          lobbyAvatar.destroy();
          lobbyAvatar.group.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              if (m.geometry) m.geometry.dispose();
              if (Array.isArray(m.material)) {
                m.material.forEach(mat => mat.dispose());
              } else if (m.material) {
                m.material.dispose();
              }
            }
          });
          scene.remove(lobbyAvatar.group);
        } catch (e) {
          console.warn('Lobby avatar teardown exception:', e);
        }
        lobbyAvatar = null;
        (window as any).__lobbyAvatar = null;
      }

      // 2. Completely tear down, purge, and dispose of Lobby Operator's turntable meshes and light variables
      if (hangarGroup) {
        try {
          hangarGroup.traverse((obj) => {
            if ((obj as THREE.Light).isLight) {
              const l = obj as THREE.Light;
              if (l.dispose) l.dispose();
            }
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              if (m.geometry) m.geometry.dispose();
              if (Array.isArray(m.material)) {
                m.material.forEach(mat => mat.dispose());
              } else if (m.material) {
                m.material.dispose();
              }
            }
          });
          scene.remove(hangarGroup);
          hangarGroup.clear();
        } catch (e) {
          console.warn('Hangar group teardown exception:', e);
        }
        hangarGroup = null;
      }
    }

    // Initialize lobby turntable scene
    setupLobbyScene();

    // World & Colliders
    let world = createWorld(scene, 'training');

    // Muzzle flash particle sprite
    function buildFlashTexture(): THREE.CanvasTexture {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.22, 'rgba(255,224,160,0.95)');
      grad.addColorStop(0.5, 'rgba(255,150,40,0.55)');
      grad.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(canvas);
    }
    const flashTexture = buildFlashTexture();
    function makeFlashSprite(depthTest: boolean): THREE.Sprite {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: flashTexture,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest
        })
      );
      sprite.scale.set(0, 0, 0);
      return sprite;
    }

    const playerFlash = makeFlashSprite(false);
    playerFlash.position.set(0.2, -0.16, -0.65);
    camera.add(playerFlash);
    let playerFlashT = 0;
    function triggerPlayerFlash() {
      playerFlashT = 0.07;
      playerFlash.material.rotation = Math.random() * Math.PI * 2;
    }

    // 3D Laser Plasma Beam mesh for continuous fire
    const laserBeamGeo = new THREE.CylinderGeometry(0.015, 0.024, 1, 8);
    laserBeamGeo.translate(0, 0.5, 0);
    laserBeamGeo.rotateX(Math.PI / 2);
    const laserBeamMat = new THREE.MeshBasicMaterial({
      color: 0x3ae2ff,
      transparent: true,
      opacity: 0.85
    });
    const laserBeamMesh = new THREE.Mesh(laserBeamGeo, laserBeamMat);
    laserBeamMesh.visible = false;
    scene.add(laserBeamMesh);

    // Crimson charge-up laser pointer beam for Kinetic Railgun
    const railgunLaserGeo = new THREE.CylinderGeometry(0.005, 0.008, 1, 6);
    railgunLaserGeo.translate(0, 0.5, 0);
    railgunLaserGeo.rotateX(Math.PI / 2);
    const railgunLaserMat = new THREE.MeshBasicMaterial({
      color: 0xff0033,
      transparent: true,
      opacity: 0.85
    });
    const railgunAimLaserMesh = new THREE.Mesh(railgunLaserGeo, railgunLaserMat);
    railgunAimLaserMesh.visible = false;
    scene.add(railgunAimLaserMesh);

    // Viewmodels
    const vmManager = createViewmodelManager();
    camera.add(vmManager.root);

    // Storm
    const storm = {
      center: new THREE.Vector3(0, 0, 0),
      radius: STORM_START_R,
      elapsed: 0,
      mesh: new THREE.Mesh(
        new THREE.CylinderGeometry(STORM_START_R, STORM_START_R, 260, 48, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x7a4adf, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
      ),
      finished: false
    };
    storm.mesh.position.set(0, 100, 0);
    scene.add(storm.mesh);

    // Match Config
    const matchConfig: MatchConfig = {
      mode: matchMode,
      friendlyCount,
      enemyCount,
      targetScore,
      startingWave: 1
    };
    let currentDifficulty = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medium;

    // Player State
    const player = {
      pos: new THREE.Vector3(0, terrainHeight(0, 0) + PLAYER_EYE, 0),
      vel: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      onGround: false,
      crouching: false,
      sprinting: false,
      health: 100,
      maxHealth: 100,
      shield: 100,
      maxShield: 100,
      classReloadMultiplier: 1.0,
      classSpeedMultiplier: 1.0,
      kills: 0,
      alive: true,
      slotIndex: 0,
      fireHeld: false,
      aiming: false,
      isDrinking: false,
      drinkTimer: 0,
      isMeleeing: false,
      meleeTimer: 0,
      continuousShots: 0,
      shotsFired: 0,
      shotsHit: 0,
      headshots: 0,
      damageDealt: 0,
      team: 'player'
    };

    // Player's hard-locked 3-slot tactical loadout:
    // Slot 0: Primary (chosen in lobby dropdown)
    // Slot 1: Secondary (chosen in lobby dropdown)
    // Slot 2: Grenades (tactical explosives)
    let playerLoadout: WeaponDef[] = [];
    let playerWeaponState: WeaponSlotState[] = [];

    function setupPlayerLoadout() {
      const prim = WEAPONS.find(w => w.id === selectedPrimaryRef.current) || WEAPONS[0];
      const sec = WEAPONS.find(w => w.id === selectedSecondaryRef.current) || WEAPONS[3];
      const gren = WEAPONS.find(w => w.type === 'grenade') || WEAPONS[10];

      const heal = WEAPONS.find(w => w.id === 'medkit') || WEAPONS[11]; playerLoadout = [prim, sec, gren, heal];

      playerWeaponState = playerLoadout.map(w => {
        if (w.type === 'grenade' || w.type === 'consumable') {
          return { count: w.count ?? 3, using: false };
        }
        return {
          ammo: w.mag,
          reserve: w.reserve,
          reloading: false,
          reloadT: 0,
          totalReloadT: 0,
          lastFired: -999,
          heat: 0,
          overheated: false,
          burstRemaining: 0,
          burstTimer: 0,
          spinWarmup: 0,
          spinSpeed: 0,
          ventTimer: 0,
          chargeTimer: 0,
          charging: false
        };
      });

      player.slotIndex = 0;
    }
    setupPlayerLoadout();

    let teamScoreBlue = 0;
    let teamScoreRed = 0;
    let playerPoints = 0;
    let currentWave = 1;
    let zombiesRemaining = 0;
    
    let waveIntermission = false;
    let intermissionTimer = 0;
    
    // EXTRACTION MECHANICS
    let extractionDirector: ExtractionGameLoop | null = null;
    let extractionPhase = false;
    let extractionState = 'none'; // 'mainframe_search' | 'hacking' | 'evac' | 'cryo_search' | 'carrying' | 'defend'
    let extractionTimer = 0;
    let extractionTargetObj = null; // THREE.Object3D or Vector3
    let extractionTankBossSpawned = false;

    let zombieTypeIndex = 0;
    let recoilPitch = 0;
    let recoilKick = 0;
    let mouseSensitivity = sensitivityVal / 5000;
    let bobPhase = 0;
    const keys: Record<string, boolean> = {};

    const activeGrenades: ActiveGrenade[] = [];
    const explosionEffects: ExplosionEffect[] = [];
    const sparkPool: { mesh: THREE.Mesh; life: number; vel?: THREE.Vector3 }[] = [];
    const smokePool: { mesh: THREE.Mesh; life: number; maxLife: number; vel: THREE.Vector3 }[] = [];
    
    interface SeveredLimb {
      mesh: THREE.Mesh | THREE.Group;
      vel: THREE.Vector3;
      rotAxis: THREE.Vector3;
      rotSpeed: number;
      life: number;
    }
    const limbPool: SeveredLimb[] = [];

    const smokeGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xffd000, transparent: true, opacity: 0.85 });

    function spawnYellowSmoke(point: THREE.Vector3, velSpread = 0.35) {
      const m = new THREE.Mesh(smokeGeo, smokeMat.clone());
      m.position.copy(point);
      scene.add(m);
      smokePool.push({
        mesh: m,
        life: 0.85,
        maxLife: 0.85,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * velSpread,
          0.65 + Math.random() * 0.6,
          (Math.random() - 0.5) * velSpread
        )
      });
    }

    function severLimb(bot: Bot, part: THREE.Object3D, impactDir: THREE.Vector3, isRagdoll = false) {
      if (part.userData.severed) return;
      part.userData.severed = true;
      part.visible = false;
      
      const mesh = part as THREE.Mesh;
      if (!mesh.geometry || !mesh.material) return;
      
      const newLimb = new THREE.Mesh(mesh.geometry, mesh.material);
      part.getWorldPosition(newLimb.position);
      part.getWorldQuaternion(newLimb.quaternion);
      
      const speed = isRagdoll ? 2 + Math.random()*3 : 4 + Math.random()*3;
      const vel = impactDir.clone().normalize().multiplyScalar(speed).add(new THREE.Vector3((Math.random()-0.5)*1.5, 1 + Math.random()*2, (Math.random()-0.5)*1.5));
      const rotAxis = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
      
      scene.add(newLimb);
      limbPool.push({ mesh: newLimb, vel, rotAxis, rotSpeed: 1 + Math.random()*4, life: 3.0 });
      
      if (!isRagdoll || Math.random() < 0.3) {
        for(let i=0; i<6; i++) {
          const blood = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0x4a0000 }));
          blood.position.copy(newLimb.position);
          const bVel = vel.clone().multiplyScalar(0.4).add(new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2));
          scene.add(blood);
          limbPool.push({ mesh: blood, vel: bVel, rotAxis: new THREE.Vector3(1,1,1), rotSpeed: 0, life: 1.5 });
        }
      }
    }

    interface RailgunKineticProjectile {
      group: THREE.Group;
      slugMesh: THREE.Mesh;
      trailMesh: THREE.Mesh;
      start: THREE.Vector3;
      dir: THREE.Vector3;
      dist: number;
      life: number;
      maxLife: number;
    }
    const railgunProjectiles: RailgunKineticProjectile[] = [];

    function spawnRailgunBeam(start: THREE.Vector3, end: THREE.Vector3) {
      const dist = Math.max(0.5, start.distanceTo(end));
      const dir = end.clone().sub(start).normalize();

      const group = new THREE.Group();

      // Rugged solid silver metallic kinetic slug sabot block cutting through the screen instantly
      const slugGeo = new THREE.BoxGeometry(0.062, 0.062, 1.8);
      const slugMat = new THREE.MeshStandardMaterial({
        color: 0xd8dfe6,
        metalness: 0.96,
        roughness: 0.12,
        emissive: 0x90a2b0,
        emissiveIntensity: 0.35
      });
      const slugMesh = new THREE.Mesh(slugGeo, slugMat);
      slugMesh.position.copy(start);
      slugMesh.lookAt(end);
      group.add(slugMesh);

      // High-velocity shockwave vapor trail dissipating behind the kinetic slug
      const trailGeo = new THREE.CylinderGeometry(0.018, 0.024, dist, 6);
      trailGeo.rotateX(Math.PI / 2);
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0xdde5ee,
        transparent: true,
        opacity: 0.85
      });
      const trailMesh = new THREE.Mesh(trailGeo, trailMat);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      trailMesh.position.copy(mid);
      trailMesh.lookAt(end);
      group.add(trailMesh);

      scene.add(group);
      railgunProjectiles.push({
        group,
        slugMesh,
        trailMesh,
        start: start.clone(),
        dir,
        dist,
        life: 0.22,
        maxLife: 0.22
      });
    }

    // Global Weapon Damage Range Falloff Calculation
    function getDamageRangeFalloff(weaponId: string, distance: number): number {
      // Sniper & Railgun: Zero damage falloff (100% maximum lethal damage across any distance)
      if (weaponId === 'sniper' || weaponId === 'railgun') {
        return 1.0;
      }
      // Pump Shotgun: High base damage close up, but damage aggressively falls off to 0 if target is > 25 units away
      if (weaponId === 'shotgun') {
        if (distance >= 25) return 0.0;
        if (distance <= 8) return 1.0;
        return Math.max(0.0, 1.0 - (distance - 8) / (25 - 8));
      }
      // SMG & Pistol: Steady damage falloff starting after 40 units of distance
      if (weaponId === 'pistol' || weaponId === 'smg') {
        if (distance <= 40) return 1.0;
        const over = distance - 40;
        return Math.max(0.35, 1.0 - (over / 60) * 0.65);
      }
      // AR & Minigun: Steady damage falloff starting after 90 units of distance
      if (weaponId === 'ar' || weaponId === 'minigun') {
        if (distance <= 90) return 1.0;
        const over = distance - 90;
        return Math.max(0.40, 1.0 - (over / 70) * 0.60);
      }
      if (weaponId === 'lmg') {
        if (distance <= 75) return 1.0;
        return Math.max(0.45, 1.0 - ((distance - 75) / 65) * 0.55);
      }
      if (weaponId === 'br') {
        if (distance <= 85) return 1.0;
        return Math.max(0.50, 1.0 - ((distance - 85) / 75) * 0.50);
      }
      if (weaponId === 'laser') {
        if (distance <= 60) return 1.0;
        return Math.max(0.40, 1.0 - ((distance - 60) / 60) * 0.60);
      }
      return 1.0;
    }

    const bots: Bot[] = [];
    const botHealthLayer = document.createElement('div');
    botHealthLayer.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:5;';
    document.body.appendChild(botHealthLayer);
    let botIdCounter = 0;

    function addPoints(pts: number) {
      playerPoints += pts;
    }

    function pushKillFeed(msg: string, isPriority = false) {
      const feed = containerRef.current?.querySelector('#killfeed');
      if (!feed) return;
      const el = document.createElement('div');
      el.className = isPriority ? 'kill-msg font-bold text-amber-400' : 'kill-msg';
      el.textContent = msg;
      feed.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
      }, isPriority ? 3600 : 2400);
    }

    function showHitmarker(isHeadshot: boolean) {
      AUDIO.hitmarkerTic.play(1.0);
      const el = containerRef.current?.querySelector('#hitmarker');
      if (!el) return;
      el.classList.toggle('headshot', !!isHeadshot);
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 50);
    }

    function flashVignette() {
      const v = containerRef.current?.querySelector('#vignette');
      if (!v) return;
      v.classList.add('hit');
      setTimeout(() => v.classList.remove('hit'), 90);
    }

    function showBloodSplatter() {
      const overlay = containerRef.current?.querySelector('#blood-splatter-overlay') as HTMLElement | null;
      if (!overlay) return;
      overlay.innerHTML = '';
      overlay.style.opacity = '1';
      const count = 5 + Math.floor(Math.random() * 4); // 4-8 droplets
      for (let i = 0; i < count; i++) {
        const drop = document.createElement('div');
        drop.className = 'blood-drop';
        const size = 20 + Math.random() * 32;
        const x = 12 + Math.random() * 76;
        const y = 15 + Math.random() * 70;
        const dripLen = 25 + Math.random() * 55;
        drop.style.left = `${x}%`;
        drop.style.top = `${y}%`;
        drop.style.width = `${size}px`;
        drop.style.height = `${size}px`;
        drop.style.setProperty('--drip-len', `${dripLen}px`);
        overlay.appendChild(drop);
      }
      setTimeout(() => {
        if (overlay) overlay.style.opacity = '0';
      }, 1100);
      setTimeout(() => {
        if (overlay) overlay.innerHTML = '';
      }, 1550);
    }

    function spawnImpactSpark(point: THREE.Vector3, isBlood = false) {
      if (isBlood) {
        for (let i = 0; i < 6; i++) {
          const geo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
          const mat = new THREE.MeshBasicMaterial({ color: 0x5a0808 });
          const m = new THREE.Mesh(geo, mat);
          m.position.copy(point);
          scene.add(m);
          sparkPool.push({
            mesh: m,
            life: 0.4 + Math.random() * 0.2,
            vel: new THREE.Vector3(
              (Math.random() - 0.5) * 4,
              Math.random() * 3 + 1,
              (Math.random() - 0.5) * 4
            )
          });
        }
      } else {
        const geo = new THREE.SphereGeometry(0.05, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(point);
        scene.add(m);
        sparkPool.push({ mesh: m, life: 0.15 });
      }
    }

    // Grenade throw (Slot 2 of hard-locked loadout)
    let lastGrenadeThrow = 0;
    function throwGrenade() {
      const ws = playerWeaponState[2];
      if (!ws || (ws.count ?? 0) <= 0) {
        pushKillFeed('NO GRENADES REMAINING');
        return;
      }
      const now = performance.now() / 1000;
      if (now - lastGrenadeThrow < 0.6) return;
      lastGrenadeThrow = now;

      ws.count = (ws.count ?? 1) - 1;
      grenadeThrowSound.play(1.0);
      recoilKick += 0.04;
      recoilPitch += 0.015;

      const origin = camera.position.clone();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const spawnPos = origin.clone()
        .add(dir.clone().multiplyScalar(0.45))
        .add(right.clone().multiplyScalar(0.14))
        .add(new THREE.Vector3(0, -0.08, 0));

      const gGroup = new THREE.Group();
      const bodyGeo = new THREE.SphereGeometry(0.12, 12, 10);
      bodyGeo.scale(1, 1.25, 1);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3d2a, roughness: 0.65, metalness: 0.35 });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.castShadow = true;
      gGroup.add(bodyMesh);

      const capMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.045, 0.06, 8),
        new THREE.MeshStandardMaterial({ color: 0x1f221e, metalness: 0.7, roughness: 0.4 })
      );
      capMesh.position.y = 0.16;
      gGroup.add(capMesh);
      gGroup.position.copy(spawnPos);
      scene.add(gGroup);

      const throwSpeed = player.sprinting ? 22.0 : 18.0;
      const vel = dir.clone().multiplyScalar(throwSpeed);
      vel.y += 3.6;

      activeGrenades.push({
        group: gGroup,
        pos: spawnPos,
        vel,
        radius: 0.14,
        rotAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        rotSpeed: 14 + Math.random() * 8,
        timeAlive: 0,
        maxFuse: 2.7,
        hasHitGround: false,
        ownerTeam: player.team
      });
    }

    function detonateGrenade(pos: THREE.Vector3, ownerTeam: string) {
      const spatialVol = getSpatialVolume(camera.position, pos);
      grenadeExplosionSound.play(spatialVol);
      const distToPlayer = camera.position.distanceTo(pos);
      if (distToPlayer < 24) {
        const shake = (1 - distToPlayer / 24) * 0.12;
        recoilKick += shake * 1.5;
        recoilPitch += shake * 0.6;
      }

      const BLAST_RADIUS = 7.5;
      const MAX_DAMAGE = 130;

      for (const bot of bots) {
        if (!bot.alive) continue;
        if (bot.team === ownerTeam) continue;

        const bDist = bot.pos.distanceTo(pos);
        if (bDist < BLAST_RADIUS) {
          const factor = 1 - (bDist / BLAST_RADIUS);
          const splashDmg = Math.round(MAX_DAMAGE * Math.max(0.2, factor));
          damageBot(bot, splashDmg, false, 'player');
          flashHit(bot);
          showHitmarker(false);
        }
      }

      if (player.alive && (false || ownerTeam !== player.team)) {
        const pDist = player.pos.distanceTo(pos);
        if (pDist < BLAST_RADIUS) {
          const pFactor = 1 - (pDist / BLAST_RADIUS);
          let pDmg = Math.round(MAX_DAMAGE * Math.max(0.18, pFactor));
          if (factionAlignmentRef.current === 'usmc' && gearTierRef.current === 'specialized') {
            pDmg = Math.round(pDmg * 0.80); // Fortified perk: -20% explosive damage
          }
          applyDamageToPlayer(pDmg, false, false, null);
          pushKillFeed('HIT BY EXPLOSION BLAST!');
        }
      }

      // Environmental block destruction from explosive blast: 100%
      const destBlocks = world.hittableObjects.filter(obj => obj.userData?.destructible);
      for (const obj of destBlocks) {
        const m = obj as THREE.Mesh;
        const blockPos = new THREE.Vector3();
        m.getWorldPosition(blockPos);
        if (blockPos.distanceTo(pos) <= BLAST_RADIUS + 1.5) {
          world.damageEnvironmentalBlock(m, 100);
        }
      }

      const flashSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.95 })
      );
      flashSphere.position.copy(pos);
      scene.add(flashSphere);

      const shockLight = new THREE.PointLight(0xff6611, 4.5, 18);
      shockLight.position.copy(pos);
      shockLight.position.y += 0.5;
      scene.add(shockLight);

      for (let s = 0; s < 10; s++) {
        spawnImpactSpark(
          pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 1.2, (Math.random() - 0.5) * 1.4))
        );
      }

      explosionEffects.push({
        mesh: flashSphere,
        light: shockLight,
        scale: 0.6,
        life: 0.32
      });
    }

    function flashHit(bot: Bot) {
      bot.flashMats.forEach(m => {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 1;
      });
    }

    function applyDamageToPlayer(amount: number, ignoreShield: boolean, skipFlash: boolean, attackerBot: Bot | null) {
      if (!player.alive) return;
      if (!ignoreShield && player.shield > 0) {
        const absorbed = Math.min(player.shield, amount);
        player.shield -= absorbed;
        amount -= absorbed;
      }
      if (amount > 0) player.health -= amount;
      if (!skipFlash) {
        flashVignette();
        AUDIO.bulletHit.play(1.0);
      }
      if (player.health <= 0) {
        player.health = 0;
        player.alive = false;
        AUDIO.arSpray.stop();

        if (matchConfig.mode === 'extraction') {
          pushKillFeed('MISSION FAILED: OPERATOR KILLED');
          triggerGameOver(false);
        } else if (matchConfig.mode === 'zombie') {
          pushKillFeed('YOU HAVE BEEN OVERWHELMED BY THE HORDE!');
          triggerGameOver(false);
        } else {
          if (attackerBot) {
            attackerBot.kills = (attackerBot.kills || 0) + 1;
            pushKillFeed(`YOU WERE ELIMINATED BY BOT #${attackerBot.id}! (${attackerBot.kills}/${matchConfig.targetScore})`);
          } else {
            pushKillFeed('YOU WERE ELIMINATED!');
          }
          checkMatchOutcome();
          if (player.health <= 0 && gameStateRef.current === 'playing') {
            triggerGameOver(false);
          }
        }
      }
    }

    function getMutantAIContext(): BioMutantAIContext {
      return {
        player: {
          pos: player.pos,
          yaw: player.yaw,
          health: player.health,
          maxHealth: player.maxHealth,
          alive: player.alive,
          applyDamage: (dmg, isHead, isExp, attacker) => applyDamageToPlayer(dmg, false, false, attacker),
        },
        bots,
        world,
        scene,
        camera,
        pushKillFeed,
        makeBot,
        damageBot,
        focusTargetId: focusTargetIDRef.current,
        scrambleRadar: (duration: number) => {
          (window as any).radarScrambleTimer = Math.max((window as any).radarScrambleTimer || 0, duration);
        },
        selectedMap: selectedMapStateRef.current as any
      };
    }

    function damageBot(bot: Bot, amount: number, isHeadshot: boolean, attacker: 'player' | Bot, impactDir?: THREE.Vector3) {
      if (!bot.alive) return;

      const mType = bot.mutantType || (bot.zType ? bot.zType.toUpperCase() : 'WALKER');
      if (bot.isZombie && (mType === 'BRUTE' || bot.zType === 'tank')) {
        const isStaggered = (bot.staggerTimer ?? 0) > 0;
        if (!isStaggered && !isHeadshot) {
          const facing = bot.group.rotation.y;
          const forward = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
          const incoming = impactDir ? impactDir.clone().negate().setY(0).normalize() : (attacker === 'player' ? player.pos.clone().sub(bot.pos).setY(0).normalize() : null);
          if (incoming && forward.dot(incoming) > 0.1) {
            amount *= 0.5; // 50% damage reduction from front-facing torso shots
          }
        }
        if (focusTargetIDRef.current === bot.id) {
          bot.staggerTimer = 2.0;
          bot.isStaggered = true;
        }
      }

      bot.health -= amount;
      if (attacker === 'player') {
        player.damageDealt += Math.round(amount);
      }
      if (bot.health <= 0) {
        bot.health = 0;
        bot.alive = false;
        bot.deathT = 2.8;

        if (bot.isZombie && mType === 'BLOATER' && !bot.userData?.detonated) {
          bot.userData = bot.userData || {};
          bot.userData.detonated = true;
          detonateBloater(bot, getMutantAIContext());
        }

        if (bot.isZombie) {
          // Restrict zombie dismemberment to heavy calibers or lethal headshots
          const isHeavy = isHeadshot || (impactDir && impactDir.lengthSq() > 0);
          if (isHeavy && impactDir) {
            bot.group.visible = false;
            bot.hitParts.forEach(part => {
              if (part.userData.severed) return;
              severLimb(bot, part, impactDir, true);
            });
          } else {
            bot.fallAxis = Math.random() < 0.5 ? 'x' : 'z';
            bot.fallDir = Math.random() < 0.5 ? 1 : -1;
          }
        } else {
          // Dismemberment is strictly disabled for humanoid bots!
          // Apply dramatic physics-driven tip-and-slide drop vector
          bot.fallAxis = 'x';
          bot.fallDir = -1;
          const facing = bot.group.rotation.y;
          const forward = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
          const slide = impactDir ? impactDir.clone().setY(0).normalize().multiplyScalar(4.5) : forward.clone().negate().multiplyScalar(3.6);
          bot.slideVel = slide;
        }

        const deathVol = getSpatialVolume(camera.position, bot.pos);
        AUDIO.bulletHit.play(deathVol);

        if (attacker === 'player') {
          player.kills++;
          try {
            const raw = localStorage.getItem('gun_arena_persistent_intel');
            const pData = raw ? JSON.parse(raw) : { totalKills: 0, totalHeadshots: 0, totalShots: 0, totalHits: 0, totalFunds: 0, highestWave: 1, matchesPlayed: 0, matchesWon: 0 };
            pData.totalKills = (pData.totalKills || 0) + 1;
            if (isHeadshot) pData.totalHeadshots = (pData.totalHeadshots || 0) + 1;
            pData.totalFunds = (pData.totalFunds || 0) + (isHeadshot ? 150 : 100);
            localStorage.setItem('gun_arena_persistent_intel', JSON.stringify(pData));
          } catch (e) {}

          if (matchConfig.mode === 'zombie') {
            addPoints(100);
            zombiesRemaining--;
            pushKillFeed(isHeadshot ? 'HEADSHOT ELIMINATION! (+ $100)' : 'ZOMBIE KILLED! (+ $100)');
          } else if (matchConfig.mode === 'extraction') {
            if (extractionDirector && bot.isZombie) {
              extractionDirector.recordMutantKill(bot);
              if (bot.zType === 'megaboss') {
                extractionDirector.recordBossDefeated();
              }
            }
            pushKillFeed(isHeadshot ? 'HEADSHOT ELIMINATION! MUTANT KILLED!' : 'MUTANT KILLED!');
          } else {
            pushKillFeed(isHeadshot ? `HEADSHOT ELIMINATION! (${player.kills}/${matchConfig.targetScore})` : `ELIMINATED BOT #${bot.id}! (${player.kills}/${matchConfig.targetScore})`);
          }
        } else if (typeof attacker === 'object') {
          attacker.kills = (attacker.kills || 0) + 1;
          if (matchConfig.mode === 'zombie') {
            if (bot.isZombie) {
              zombiesRemaining--;
              pushKillFeed('SURVIVOR ALLY ELIMINATED A ZOMBIE!');
            } else {
              pushKillFeed('A SURVIVOR ALLY HAS FALLEN TO THE HORDE!');
            }
          } else if (matchConfig.mode === 'extraction') {
            if (attacker.team === 'blue' && bot.isZombie) {
              if (extractionDirector) {
                extractionDirector.recordMutantKill(bot);
                if (bot.zType === 'megaboss') {
                  extractionDirector.recordBossDefeated();
                }
              }
              pushKillFeed('SQUAD ELIMINATED A MUTANT!');
            } else if (bot.team === 'blue' && attacker.isZombie) {
              pushKillFeed('A SQUAD MEMBER WAS KILLED BY A MUTANT!');
            }
          }
        }

        if (!bot.isZombie) {
          const droppedAmmo = bot.weaponTypeIndex === 0 ? 30 : (bot.weaponTypeIndex === 1 ? 8 : (bot.weaponTypeIndex === 2 ? 4 : 24));
          world.createGroundPickup(bot.pos.x, bot.pos.z, bot.weaponTypeIndex, droppedAmmo);
        }
        if (Math.random() < 0.25) world.createGroundPickup(bot.pos.x + (Math.random() - 0.5) * 1.5, bot.pos.z + (Math.random() - 0.5) * 1.5, 5, 1);
        if (Math.random() < 0.20) world.createGroundPickup(bot.pos.x + (Math.random() - 0.5) * 1.5, bot.pos.z + (Math.random() - 0.5) * 1.5, 4, 2);

        bot.hitParts.forEach(part => world.unregisterHittable(part));
        checkMatchOutcome();
      }
    }

    function checkMatchOutcome() {
      
      if (matchConfig.mode === 'zombie') {
        if (zombiesRemaining <= 0 && !waveIntermission && !extractionPhase) {
          if (currentWave >= 3) {
            // Trigger Extraction
            extractionPhase = true;
            if (factionAlignmentRef.current === 'apex') {
              extractionState = 'mainframe_search';
              pushKillFeed('HQ: MAINFRAME LOCATED. INITIATE DATA HEIST.', true);
            } else {
              extractionState = 'cryo_search';
              pushKillFeed('COMMAND: CRYO-POD DETECTED. SECURE THE ASSET.', true);
            }
            
            // Spawn target at a random spot
            const geo = new THREE.BoxGeometry(1.5, 2.5, 1.5);
            const mat = new THREE.MeshStandardMaterial({ color: factionAlignmentRef.current === 'apex' ? 0xff0000 : 0x00aaff, emissive: factionAlignmentRef.current === 'apex' ? 0x440000 : 0x004488 });
            extractionTargetObj = new THREE.Mesh(geo, mat);
            extractionTargetObj.position.set((Math.random() - 0.5) * 40, 1.25, (Math.random() - 0.5) * 40);
            scene.add(extractionTargetObj);
            
            // Add a point light to make it visible
            const light = new THREE.PointLight(factionAlignmentRef.current === 'apex' ? 0xff0000 : 0x00aaff, 2, 10);
            light.position.set(0, 2, 0);
            extractionTargetObj.add(light);
            
            addPoints(500);
          } else {
            waveIntermission = true;
            intermissionTimer = 5.0;
            addPoints(250);
          }
        }
      }
      else if (matchConfig.mode === 'extraction') {
        // Handled strictly by Evac Elevator trigger (Victory) or Player Death (Defeat).
        // Score targets do NOT trigger victory or defeat in Subterranean Extraction.
      } else if (false) {
        const vip = bots.find(b => b.isVIP);
        if (!vip || !vip.alive) {
           triggerGameOver(false); // VIP killed
        }
      } else {
        if (player.kills >= matchConfig.targetScore) {
          triggerGameOver(true);
          return;
        }
        for (const b of bots) {
          if (b.kills >= matchConfig.targetScore) {
            triggerGameOver(false, b);
            return;
          }
        }
      }
    }

    function triggerGameOver(victory: boolean, winningBot: Bot | null = null) {
      AUDIO.arSpray.stop();
      updateAdrenalineHeartbeat(false);
      const adrenalineEl = containerRef.current?.querySelector('#adrenaline-overlay') as HTMLElement | null;
      if (adrenalineEl) adrenalineEl.style.display = 'none';

      if (document.pointerLockElement) {
        try { document.exitPointerLock?.(); } catch {}
      }

      const tSec = Math.floor(storm.elapsed);
      const acc = player.shotsFired > 0 ? Math.round((player.shotsHit / player.shotsFired) * 100) : 0;
      const hsPct = player.shotsHit > 0 ? Math.round((player.headshots / player.shotsHit) * 100) : (player.kills > 0 ? Math.round((player.headshots / player.kills) * 100) : 0);
      const combatScore = matchConfig.mode === 'zombie' ? playerPoints : (player.kills * 150 + player.headshots * 75 + Math.round(player.damageDealt * 0.5));
      const wavesCleared = Math.max(0, currentWave - 1);
      
      // Extraction reward
      if (victory && matchConfig.mode === 'zombie' && extractionPhase) {
         try {
           const ledgerRaw = localStorage.getItem('__career_ledger');
           if (ledgerRaw) {
             const ledger = JSON.parse(ledgerRaw);
             ledger.xp = (ledger.xp || 0) + 1000;
             ledger.funds = (ledger.funds || 0) + 500;
             localStorage.setItem('__career_ledger', JSON.stringify(ledger));
             
             // Update player points to reflect in the UI immediately
             playerPoints += 500;
           }
         } catch(e) {}
      }


      setStats({
        health: Math.ceil(Math.max(0, player.health)),
        shield: Math.ceil(Math.max(0, player.shield)),
        kills: player.kills,
        funds: playerPoints,
        time: `${String(Math.floor(tSec / 60)).padStart(2, '0')}:${String(tSec % 60).padStart(2, '0')}`,
        wave: currentWave,
        zombies: Math.max(0, zombiesRemaining),
        blueScore: teamScoreBlue,
        redScore: teamScoreRed,
        zoneStatus: matchConfig.mode === 'zombie' ? 'ACTIVE' : (Math.hypot(player.pos.x, player.pos.z) > storm.radius ? 'DANGER' : 'SAFE'),
        headshotPct: hsPct,
        combatScore,
        wavesCleared,
        damageDealt: Math.round(player.damageDealt),
        accuracyPct: acc
      });

      let subText = '';
      if (matchConfig.mode === 'zombie') {
        subText = `OVERWHELMED ON WAVE ${currentWave}`;
      } else if (matchConfig.mode === 'team') {
        const allyLabel = matchConfig.faction === 'usmc' ? 'USMC COALITION' : 'APEX MERCENARIES';
        const opLabel = matchConfig.faction === 'usmc' ? 'APEX MERCENARIES' : 'USMC COALITION';
        subText = victory ? `${allyLabel} HIT TARGET SCORE FIRST` : `${opLabel} OUTPERFORMED YOUR SQUAD`;
      } else if (matchConfig.mode === 'extraction') {
        subText = victory ? 'SUCCESSFUL EXTRACTION' : 'MISSION FAILED';
      } else {
        if (victory) subText = 'YOU REACHED THE TARGET SCORE FIRST';
        else if (winningBot) subText = `BOT #${winningBot.id} REACHED ${matchConfig.targetScore} KILLS FIRST`;
        else subText = 'ZONE / OPPONENT ELIMINATED YOU';
      }

      setEndResult({
        victory,
        title: matchConfig.mode === 'zombie' ? 'SURVIVAL TERMINATED' : (victory ? 'VICTORY' : 'DEFEAT'),
        sub: subText
      });

      // Calculate and persist Faction Career Progression rewards:
      // 100 XP & $50 per regular bot elimination
      // 250 XP & $150 per completed Zombie wave milestone
      // 500 XP flat bonus for victory
      try {
        const currentLedger = getCareerLedger();
        // Update total shots and hits from this match
        currentLedger.totalShots += player.shotsFired;
        currentLedger.totalHits += player.shotsHit;
        currentLedger.totalHeadshots += player.headshots;

        const { breakdown, updatedLedger } = calculateMatchRewards({
          kills: player.kills,
          wavesCleared,
          victory,
          currentLedger
        });

        setMatchRewards(breakdown);
      } catch (e) {
        console.error('Error calculating career ledger rewards:', e);
      }

      setGameState('DEATH_SCREEN');
    }

    // Bot factory
    function makeBot(
      assignedTeam: string | null = null,
      zombieTypeOverride: 'walker' | 'runner' | 'tank' | 'brute' | 'banshee' | 'bloater' | 'megaboss' | null = null,
      isVIP = false,
      eliteConfig?: EliteCompanionConfig
    ): Bot {
      const p = randomMapPoint(14);
      const y = terrainHeight(p.x, p.z);
      const botId = botIdCounter++;
      const isZombie = ((matchConfig.mode === "zombie" || assignedTeam === "zombie") && assignedTeam !== "blue");
      let team = assignedTeam;
      if (eliteConfig) team = "blue";
      else if (isVIP) team = "blue";
      else if (isZombie) team = "zombie";
      else if (matchConfig.mode === "ffa") team = "ffa_" + botId;
      else if (!team) team = Math.random() < 0.5 ? "blue" : "red";

      let zType: "walker" | "runner" | "tank" | "brute" | "banshee" | "bloater" | "megaboss" = "walker";
      if (isZombie) {
        if (zombieTypeOverride) zType = zombieTypeOverride;
        else {
          const types: ("walker" | "runner" | "tank" | "brute" | "banshee" | "bloater" | "megaboss")[] = ["walker", "walker", "runner", "brute", "banshee", "bloater"];
          zType = types[(zombieTypeIndex++) % types.length];
        }
      }

      // Weapon types: AR (0), Shotgun (1), Sniper (2), Combat Pistol (3), SMG (4), LMG (5), BR (6)
      const roll = Math.random();
      let weaponTypeIndex = 0;
      if (eliteConfig) {
        const wIdx = WEAPONS.findIndex(w => w.id === eliteConfig.primaryWeapon);
        weaponTypeIndex = wIdx >= 0 ? wIdx : 0;
      } else if (isVIP) {
        weaponTypeIndex = 3;
      } else if (roll < 0.22) weaponTypeIndex = 0; // AR
      else if (roll < 0.38) weaponTypeIndex = 1; // Shotgun
      else if (roll < 0.50) weaponTypeIndex = 3; // Combat Pistol
      else if (roll < 0.65) weaponTypeIndex = 4; // SMG
      else if (roll < 0.78) weaponTypeIndex = 5; // LMG
      else if (roll < 0.90) weaponTypeIndex = 6; // Battle Rifle
      else weaponTypeIndex = 2; // Sniper
      const weaponType = WEAPONS[weaponTypeIndex].id;

      const pHeadgear = localStorage.getItem('gun_arena_headgear') || 'fast';
      const pTorso = localStorage.getItem('gun_arena_torso') || 'chest_rig';
      const pLower = localStorage.getItem('gun_arena_lower') || 'pouches';

      const visuals = buildBotVisuals({
        botId,
        team,
        isZombie,
        zType,
        isVIP,
        weaponTypeIndex,
        weaponType,
        factionAlignment: factionAlignmentRef.current,
        gearTier: gearTierRef.current,
        headgear: team === 'blue' ? pHeadgear : undefined,
        torsoConfig: team === 'blue' ? pTorso : undefined,
        lowerConfig: team === 'blue' ? pLower : undefined,
        mode: matchConfig.mode,
        makeFlashSprite
      });

      const rootGroup = visuals.rootGroup;
      rootGroup.position.set(p.x, y, p.z);
      scene.add(rootGroup);

      const healthEl = document.createElement('div');
      healthEl.className = 'panel';
      healthEl.style.cssText = 'position:absolute; width:54px; height:6px; padding:0; transform:translate(-50%,-100%); overflow:hidden; display:none;';
      const fillEl = document.createElement('div');
      let barGradient = 'linear-gradient(90deg, #5a2320, #e0473f)';
      if (eliteConfig) barGradient = 'linear-gradient(90deg, #2de2e6, #00ffff)';
      else if (team === 'blue') barGradient = visuals.faction === 'usmc' ? 'linear-gradient(90deg, #2b3d1e, #628243)' : 'linear-gradient(90deg, #18283a, #3f7de0)';
      else if (isZombie) {
        if (zType === 'megaboss') barGradient = 'linear-gradient(90deg, #581c87, #c084fc)';
        else if (zType === 'bloater') barGradient = 'linear-gradient(90deg, #14532d, #22c55e)';
        else if (zType === 'banshee') barGradient = 'linear-gradient(90deg, #155e75, #67e8f9)';
        else if (zType === 'brute' || zType === 'tank') barGradient = 'linear-gradient(90deg, #78350f, #d97706)';
        else if (zType === 'runner') barGradient = 'linear-gradient(90deg, #831843, #f43f5e)';
        else barGradient = 'linear-gradient(90deg, #1b5e20, #4caf50)';
      }
      fillEl.style.cssText = `height:100%; width:100%; background:${barGradient}; transition:width 0.1s ease-out;`;
      healthEl.appendChild(fillEl);
      botHealthLayer.appendChild(healthEl);

      let baseHealth = BOT_BASE_HEALTH * currentDifficulty.botHealthMult * visuals.healthMultiplier;
      if (eliteConfig) {
        // 2.5x stat multipliers for elite squad
        baseHealth *= 2.5;
      }
      let moveSpeed = (3.6 + Math.random() * 1.2) * visuals.speedMultiplier;
      let meleeDmg = (eliteConfig ? 85 : 16) * currentDifficulty.botDamageMult;

      let sprintSpeed: number | undefined;
      let patrolSpeed: number | undefined;
      let mutantType: MutantType | undefined;
      let attackRange: number | undefined;
      let attackCooldown: number | undefined;
      let specialAbilityTimer: number | undefined;
      let hoverHeight: number | undefined;

      if (isZombie) {
        const isExtraction = matchConfig.mode === 'extraction';
        const waveScale = isExtraction ? 1.0 : Math.pow(1.18, Math.max(0, currentWave - 1));
        const speedScale = isExtraction ? 1.0 : 1 + Math.min(0.75, (currentWave - 1) * 0.05);

        if (zType === 'runner') {
          mutantType = 'RUNNER';
          baseHealth = 55 * waveScale;
          moveSpeed = 5.2 * speedScale;
          sprintSpeed = 5.2 * speedScale;
          patrolSpeed = 3.0 * speedScale;
          meleeDmg = 14;
          attackRange = 1.6;
          attackCooldown = 0.5;
        } else if (zType === 'brute' || zType === 'tank') {
          mutantType = 'BRUTE';
          baseHealth = 340 * waveScale;
          moveSpeed = 2.2 * speedScale;
          meleeDmg = 32;
          attackRange = 2.0;
          attackCooldown = 1.2;
        } else if (zType === 'banshee') {
          mutantType = 'BANSHEE';
          baseHealth = 110 * waveScale;
          moveSpeed = 4.0 * speedScale;
          meleeDmg = 18;
          attackRange = 2.2;
          attackCooldown = 1.0;
          specialAbilityTimer = 6.0;
          hoverHeight = 1.2;
        } else if (zType === 'bloater') {
          mutantType = 'BLOATER';
          baseHealth = 160 * waveScale;
          moveSpeed = 1.5 * speedScale;
          meleeDmg = 20;
          attackRange = 2.0;
          attackCooldown = 1.0;
        } else if (zType === 'megaboss') {
          mutantType = 'MEGABOSS';
          baseHealth = 1200;
          moveSpeed = 2.5;
          meleeDmg = 45;
          attackRange = 2.8;
          attackCooldown = 1.4;
          specialAbilityTimer = 12.0;
        } else {
          // Walker (Standard)
          mutantType = 'WALKER';
          baseHealth = 85 * waveScale;
          moveSpeed = 1.8 * speedScale;
          meleeDmg = 16;
          attackRange = 1.4;
          attackCooldown = 0.9;
        }
      }

      const bot: Bot = {
        id: botId,
        team,
        isZombie,
        zType,
        mutantType,
        attackRange,
        attackCooldown,
        specialAbilityTimer,
        hoverHeight,
        isStaggered: false,
        staggerTimer: 0,
        isCharging: false,
        isExploding: false,
        weavePhase: Math.random() * Math.PI * 2,
        faction: visuals.faction,
        subClass: visuals.subClass,
        isElite: !!eliteConfig,
        eliteRole: eliteConfig?.archetype,
        eliteSlot: eliteConfig?.slotId,
        callsign: eliteConfig?.callsign,
        regenAuraTimer: 0,
        reconPingTimer: 0,
        deployedCoverCooldown: 0,
        kills: 0,
        meleeDmg,
        meleeCooldown: 0,
        isSprinting: false,
        sprintSpeed,
        patrolSpeed,
        runnerTorsoLean: 0,
        lungeTimer: 0,
        lungeDir: new THREE.Vector3(),
        attackRecoveryTimer: 0,
        healSlot: isZombie ? undefined : {
          medkitCount: 1,
          shieldPotCount: 1,
          healCooldown: 0
        },
        group: rootGroup,
        torsoGroup: visuals.torsoGroup,
        armLPivot: visuals.armLPivot,
        armRPivot: visuals.armRPivot,
        armLLowerPivot: visuals.armLLowerPivot,
        armRLowerPivot: visuals.armRLowerPivot,
        legLPivot: visuals.legLPivot,
        legRPivot: visuals.legRPivot,
        legLLowerPivot: visuals.legLLowerPivot,
        legRLowerPivot: visuals.legRLowerPivot,
        gunMesh: visuals.gunMesh,
        muzzleFlash: visuals.muzzleFlash,
        muzzleFlashT: 0,
        weaponTypeIndex,
        weaponType,
        flashMats: visuals.flashMats,
        hitParts: visuals.hitParts,
        healthEl,
        fillEl,
        pos: new THREE.Vector3(p.x, (isZombie && zType === 'banshee') ? y + 1.2 : y, p.z),
        vel: new THREE.Vector3(0, 0, 0),
        facing: 0,
        health: baseHealth,
        maxHealth: baseHealth,
        speed: moveSpeed,
        walkPhase: Math.random() * Math.PI * 2,
        preferredRange: isZombie ? 0.8 : (weaponType === 'shotgun' ? 7 : (weaponType === 'sniper' ? 24 : (weaponType === 'pistol' ? 9 : 13))),
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        strafeTimer: 1 + Math.random() * 2,
        target: null,
        waypoint: null,
        waypointTimer: 0,
        fireTimer: 0.5 + Math.random() * 1.0,
        alive: true,
        deathT: 0,
        fallAxis: 'x',
        fallDir: 1
      };

      visuals.hitParts.forEach(part => {
        const isHead = visuals.headParts.has(part);
        part.userData = { type: 'botpart', part: isHead ? 'head' : 'body', ref: bot };
        world.registerHittable(part);
      });

      bots.push(bot);
      return bot;
    }

    function removeBot(bot: Bot) {
      scene.remove(bot.group);
      bot.healthEl.remove();
      const i = bots.indexOf(bot);
      if (i >= 0) bots.splice(i, 1);
    }

    function clearMatchEntities() {
      extractionPhase = false;
      extractionState = 'none';
      extractionTimer = 0;
      if (extractionTargetObj && extractionTargetObj instanceof THREE.Object3D) {
         scene.remove(extractionTargetObj);
      }
      extractionTargetObj = null;
      extractionTankBossSpawned = false;

      for (const b of [...bots]) removeBot(b);
      for (const g of activeGrenades) scene.remove(g.group);
      activeGrenades.length = 0;
      for (const fx of explosionEffects) {
        scene.remove(fx.mesh);
        if (fx.light) scene.remove(fx.light);
      }
      explosionEffects.length = 0;
      const banner = containerRef.current?.querySelector('#wave-banner') as HTMLElement | null;
      if (banner) banner.style.display = 'none';
    }

    function startNextZombieWave(waveNum: number) {
      currentWave = waveNum;
      const banner = containerRef.current?.querySelector('#wave-banner') as HTMLElement | null;
      const bannerTitle = containerRef.current?.querySelector('#wave-banner-title');
      const bannerSub = containerRef.current?.querySelector('#wave-banner-sub');
      if (banner && bannerTitle && bannerSub) {
        banner.style.display = 'block';
        bannerTitle.textContent = `WAVE ${currentWave}`;
        bannerSub.textContent = `SURVIVE THE HORDE`;
        setTimeout(() => { if (!waveIntermission) banner.style.display = 'none'; }, 2400);
      }

      const count = Math.floor(matchConfig.enemyCount * Math.pow(1.25, currentWave - 1) + currentWave * 2);
      zombiesRemaining = count;
      for (let i = 0; i < count; i++) {
        makeBot(null);
      }
    }

    function initMatch() {
      // 1. Completely tear down, purge, and dispose of the Lobby Operator's Three.js turntable meshes and light variables before instantiating the match arena.
      teardownLobbyScene();

      clearMatchEntities();
      
      // Reset AI Director
      window.aiDirectorState = {
        currentSector: 1,
        spawnTimer: 0,
        waveCount: 0
      };
      
      // Guardrail: If matchMode is zombie or extraction, strictly enforce Subterranean Hangar map
      const isFacilityMode = (
        matchConfig.mode === 'zombie' ||
        matchConfig.mode === 'extraction' ||
        matchModeRef.current === 'zombie' ||
        matchModeRef.current === 'extraction'
      );
      const activeMap = isFacilityMode ? 'hangar' : selectedMapStateRef.current;
      selectedMapStateRef.current = activeMap;

      world.dispose();
      world = createWorld(scene, activeMap);
      
      const isHangar = activeMap === 'hangar';
      combatLightGroup.visible = true;
      hemiLight.intensity = isHangar ? 0.55 : 0.65;
      sunLight.intensity = isHangar ? 0.75 : 1.05;
      
      if (isHangar) {
         scene.background = new THREE.Color(0x14181f);
         scene.fog = new THREE.Fog(0x14181f, 25, 140);
         skyMesh.visible = false;
      } else {
         scene.background = null;
         scene.fog = combatFog;
         skyMesh.visible = true;
      }

      teamScoreBlue = 0;
      teamScoreRed = 0;
      player.kills = 0;
      playerPoints = 0;

      // Apply selected Battlefront-style class configuration and stat overrides
      const activeClass = CLASSES[selectedClassIdRef.current] || CLASSES.assault;
      player.health = activeClass.initialHealth;
      player.maxHealth = activeClass.maxHealth;
      player.shield = activeClass.initialShield;
      player.maxShield = activeClass.maxShield;
      player.classReloadMultiplier = activeClass.reloadMultiplier;
      player.classSpeedMultiplier = activeClass.speedMultiplier;

      // Apply passive gear tier perks
      if (gearTierRef.current === 'specialized') {
        if (factionAlignmentRef.current === 'usmc') {
          // Fortified: +15% maximum body armor capacity
          player.maxShield = Math.floor(player.maxShield * 1.15);
          player.shield = player.maxShield;
        } else if (factionAlignmentRef.current === 'apex') {
          // Stalker: +10% base movement speed
          player.classSpeedMultiplier *= 1.10;
        }
      }

      if (matchConfig.mode === 'extraction') {
        player.pos.set(0, 1.2, 5); // Sector 1: Ingress Airlock
        player.vel.set(0, 0, 0);
        player.yaw = 0; // Look forward down negative Z towards Sector 2, 3, 4, 5
      } else {
        player.pos.set(0, 1.2, -45);
        player.vel.set(0, 0, 0);
        player.yaw = Math.PI; // Face directly down the corridor (North)
      }
      player.pitch = 0;
      player.alive = true;
      player.aiming = false;
      player.isDrinking = false;
      player.team = matchConfig.mode === 'ffa' ? 'player' : 'blue';

      if (matchConfig.mode === 'extraction') {
        extractionDirector = new ExtractionGameLoop({
          faction: factionAlignmentRef.current,
          player,
          world,
          scene,
          makeBot,
          bots,
          pushKillFeed,
          onVictory: () => {
            pushKillFeed('MISSION ACCOMPLISHED: EXTRACTION SUCCESSFUL!', true);
            triggerGameOver(true);
          },
          onDefeat: () => {
            pushKillFeed('M.I.A.: OPERATIVE ELIMINATED!', true);
            triggerGameOver(false);
          }
        });
        setExtractionState({ ...extractionDirector.state });
      } else {
        extractionDirector = null;
        setExtractionState(null);
      }

      // Initialize strictly isolated 3-slot loadout (Primary, Secondary, Grenades)
      setupPlayerLoadout();
      pushKillFeed(`DEPLOYED: ${activeClass.name.toUpperCase()} [${activeClass.perkName}]`);

      storm.elapsed = 0;
      storm.radius = (matchConfig.mode === 'zombie') ? 9999 : STORM_START_R;
      storm.finished = false;

      if (matchConfig.mode === 'zombie') {
        const isElite = deploymentProtocolRef.current === 'elite';
        if (isElite) {
          const squad = eliteSquadRef.current || DEFAULT_ELITE_SQUAD;
          const formationOffsets = [
            { x: 3.2, z: 2.2 },   // Slot 2 Heavy: Front-Right
            { x: 0.0, z: -3.8 },  // Slot 3 Medic: Rear-Center
            { x: -3.8, z: -2.0 }, // Slot 4 Recon: Rear-Left
            { x: -3.2, z: 2.2 }   // Slot 5 Engineer: Front-Left
          ];
          squad.forEach((companion, idx) => {
            const off = formationOffsets[idx] || { x: 3, z: 3 };
            const bot = makeBot('blue', null, false, companion);
            bot.pos.set(player.pos.x + off.x, terrainHeight(player.pos.x + off.x, player.pos.z + off.z), player.pos.z + off.z);
            bot.group.position.copy(bot.pos);
          });
          pushKillFeed('COMMAND: ELITE TASK FORCE DEPLOYED');
        } else {
          for (let i = 0; i < matchConfig.friendlyCount; i++) {
            const bot = makeBot('blue');
            bot.pos.set(player.pos.x + (Math.random() - 0.5) * 4, 1.2, player.pos.z + (Math.random() - 0.5) * 4);
            bot.group.position.copy(bot.pos);
          }
        }
        waveIntermission = false;
        currentWave = matchConfig.startingWave || 1;
        startNextZombieWave(currentWave);
      } else if (matchConfig.mode === 'extraction') {
        const isElite = deploymentProtocolRef.current === 'elite';
        if (isElite) {
          const squad = eliteSquadRef.current || DEFAULT_ELITE_SQUAD;
          const formationOffsets = [
            { x: 3.2, z: 2.2 },
            { x: 0.0, z: -3.8 },
            { x: -3.8, z: -2.0 },
            { x: -3.2, z: 2.2 }
          ];
          squad.forEach((companion, idx) => {
            const off = formationOffsets[idx] || { x: 3, z: 3 };
            const bot = makeBot('blue', null, false, companion);
            bot.pos.set(player.pos.x + off.x, terrainHeight(player.pos.x + off.x, player.pos.z + off.z), player.pos.z + off.z);
            bot.group.position.copy(bot.pos);
          });
          pushKillFeed('COMMAND: ELITE TASK FORCE DEPLOYED');
        } else {
          for (let i = 0; i < matchConfig.friendlyCount; i++) {
            const bot = makeBot('blue');
            bot.pos.set(player.pos.x + (Math.random() - 0.5) * 4, 1.2, player.pos.z + (Math.random() - 0.5) * 4);
            bot.group.position.copy(bot.pos);
          }
        }
        // AI Director will handle hostile spawns in EXTRACTION.
      } else if (matchConfig.mode === 'team') {
        const isElite = deploymentProtocolRef.current === 'elite';
        if (isElite) {
          const squad = eliteSquadRef.current || DEFAULT_ELITE_SQUAD;
          squad.forEach((companion) => makeBot('blue', null, false, companion));
          pushKillFeed('COMMAND: ELITE TASK FORCE DEPLOYED');
        } else {
          for (let i = 0; i < matchConfig.friendlyCount; i++) {
            const bot = makeBot('blue');
            bot.pos.set(player.pos.x + (Math.random() - 0.5) * 4, 1.2, player.pos.z + (Math.random() - 0.5) * 4);
            bot.group.position.copy(bot.pos);
          }
        }
        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot('red');
      } else if (matchConfig.mode === 'ffa') {
        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot();
      }
    }

    // Weapons firing and reload: hard-locked to active 3-slot loadout
    function currentSlot(): WeaponDef { return playerLoadout[player.slotIndex] || playerLoadout[0] || WEAPONS[0]; }
    function currentSlotState(): WeaponSlotState { return playerWeaponState[player.slotIndex] || playerWeaponState[0] || { ammo: 30, reserve: 90 }; }

    function fireWeapon() {
      const w = currentSlot();
      if (w.type === 'consumable') {
        const ws = currentSlotState();
        if ((ws.count ?? 0) <= 0) return;
        if (player.isDrinking) return;

        if (w.id === 'mini') {
          if (player.shield >= 50) {
            pushKillFeed('SHIELD ALREADY AT MAX CAP FOR MINIS (50)');
            return;
          }
          player.isDrinking = true;
          player.drinkTimer = 2.0;
          AUDIO.miniDrink.play(1.0);
          pushKillFeed('DRINKING MINI SHIELD...');
        } else if (w.id === 'medkit') {
          if (player.health >= player.maxHealth && player.shield >= player.maxShield) {
            pushKillFeed('HEALTH AND SHIELD ALREADY FULL');
            return;
          }
          player.isDrinking = true;
          player.drinkTimer = 3.0;
          AUDIO.miniDrink.play(1.0); // using the same sound for simplicity or if they added one
          pushKillFeed('APPLYING TACTICAL HEAL...');
        }
        return;
      }
      if (w.type === 'grenade') {
        throwGrenade();
        return;
      }

      // Minigun and Railgun have distinct state-driven firing loops (spin warmup & charge sequence)
      if (w.id === 'minigun' || w.id === 'railgun') {
        return;
      }

      const ws = currentSlotState();
      if (ws.reloading) return;

      // Laser gun heat & overheat check
      if (w.id === 'laser') {
        if (ws.overheated) return;
      }

      const now = performance.now() / 1000;
      if (now - (ws.lastFired ?? 0) < (w.fireRate ?? 0.2)) return;

      if (w.id !== 'laser' && (ws.ammo ?? 0) <= 0) {
        reloadWeapon();
        return;
      }

      ws.lastFired = now;
      if (w.id !== 'laser') {
        ws.ammo = (ws.ammo ?? 1) - 1;
      }
      player.continuousShots++;

      // Weapon specific recoil & sound execution
      if (w.id === 'pistol') {
        // Combat Pistol: slide recoil + crisp shot
        vmManager.triggerPistolSlideFire();
        vmManager.addRecoil(0.045, 0.055);
        AUDIO.pistolShot.play(1.0, true);
      } else if (w.id === 'smg') {
        // SMG: rapid bolt cycle + smg fire sound
        vmManager.triggerSmgBoltFire();
        vmManager.addRecoil(0.038, 0.045);
        AUDIO.smgFire.play(1.0, true);
      } else if (w.id === 'lmg') {
        // Heavy LMG: high recoil + heavy shot sound
        vmManager.addRecoil(0.052, 0.062);
        AUDIO.lmgFire.play(1.0, true);
      } else if (w.id === 'br') {
        // Battle Rifle: tight burst recoil + burst sound
        vmManager.addRecoil(0.038, 0.044);
        AUDIO.brBurst.play(1.0, true);
        ws.burstRemaining = (w.burstCount ?? 3) - 1;
        ws.burstTimer = w.burstRate ?? 0.075;
      } else if (w.id === 'laser') {
        // Covenant Laser Gun: plasma hum/beam + heat accumulation
        vmManager.addRecoil(0.016, 0.022);
        AUDIO.laserBeam.playContinuous(1.0);
        ws.heat = Math.min(100, (ws.heat ?? 0) + 1.9);
        if (ws.heat >= 100) {
          ws.heat = 100;
          ws.overheated = true;
          AUDIO.laserBeam.stop();
          laserBeamMesh.visible = false;
          AUDIO.laserVent.play(1.0);
          reloadWeapon();
        }
      } else if (w.id === 'sniper') {
        vmManager.addRecoil(0.09, 0.12);
        AUDIO.sniperShot.play(1.0, true);
      } else if (w.id === 'shotgun') {
        vmManager.addRecoil(0.075, 0.095);
        vmManager.triggerShotgunPump();
        AUDIO.shotgunShot.play(1.0, true);
      } else {
        vmManager.addRecoil(0.038, 0.045);
        if (player.continuousShots <= 1) AUDIO.arSingle.play(1.0, true);
        else AUDIO.arSpray.playContinuous(1.0);
      }

      recoilKick += (w.kick ?? 0.02) * 1.5;
      if (w.id === 'sniper') recoilPitch += 0.050;
      else if (w.id === 'shotgun') recoilPitch += 0.038;
      else if (w.id === 'lmg') recoilPitch += 0.036;
      else if (w.id === 'ar') recoilPitch += 0.020;
      else if (w.id === 'br') recoilPitch += 0.022;
      else if (w.id === 'smg') recoilPitch += 0.014;
      else if (w.id === 'pistol') recoilPitch += 0.012;
      else recoilPitch += (w.kick ?? 0.02);
      player.shotsFired++;
      triggerPlayerFlash();

      const spread = player.aiming ? (w.adsSpread ?? 0.01) : (w.spread ?? 0.02);
      const pellets = w.pellets ?? 1;
      for (let p = 0; p < pellets; p++) {
        const ndcX = (Math.random() - 0.5) * spread * 2;
        const ndcY = (Math.random() - 0.5) * spread * 2;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        raycaster.far = w.range ?? 100;
        const hits = raycaster.intersectObjects(world.hittableObjects, false);
        if (hits.length > 0) {
          const hit = hits[0];
          const ud = hit.object.userData;
          spawnImpactSpark(hit.point, ud.type === 'botpart');

          if (hit.object.userData.destructible) {
            let degAmount = 0;
            if (w.id === 'sniper') degAmount = 45;
            else if (w.id === 'lmg') degAmount = 20;
            if (degAmount > 0) world.damageEnvironmentalBlock(hit.object as THREE.Mesh, degAmount);
          }

          if (ud.type === 'botpart' && ud.ref) {
            const bot = ud.ref as Bot;
            if (bot.team === player.team) continue;

            player.shotsHit++;
            const dist = camera.position.distanceTo(hit.point);
            const falloff = getDamageRangeFalloff(w.id, dist);
            if (falloff <= 0) continue;

            const isHead = ud.part === 'head';
            if (isHead) player.headshots++;
            let finalDamage = (w.damage ?? 25) * falloff;
            if (isHead) finalDamage *= (w.headshotMult ?? 2.0);

            damageBot(bot, finalDamage, isHead, 'player', raycaster.ray.direction);
            flashHit(bot);
            showHitmarker(isHead);
            if (bot.isZombie) addPoints(10);
            if (['sniper', 'laser', 'lmg', 'minigun'].includes(w.id)) { const d = camera.position.distanceTo(hit.point); const v = Math.max(0, 1.0 - d / 50); AUDIO.bulletHit.play(v); }
          } else if (['sniper', 'lmg', 'br'].includes(w.id)) {
            // Material penetration logic (4 units depth)
            const secHit = hits.find(h => h.object.userData.type === 'botpart' && h.distance - hit.distance <= 4.0);
            if (secHit && secHit.object.userData.ref) {
              const bot = secHit.object.userData.ref as Bot;
              if (bot.team === player.team) continue;

              player.shotsHit++;
              const dist = camera.position.distanceTo(secHit.point);
              const falloff = getDamageRangeFalloff(w.id, dist);
              if (falloff > 0) {
                const isHead = secHit.object.userData.part === 'head';
                if (isHead) player.headshots++;
                let finalDamage = (w.damage ?? 25) * falloff * 0.5; // 50% damage
                if (isHead) finalDamage *= (w.headshotMult ?? 2.0);
                damageBot(bot, finalDamage, isHead, 'player', raycaster.ray.direction);
                flashHit(bot);
                showHitmarker(isHead);
                if (bot.isZombie) addPoints(10);
                if (['sniper', 'lmg'].includes(w.id)) AUDIO.bulletHit.play(1.0);
                pushKillFeed(isHead ? 'HEADSHOT COVER PIERCE!' : 'COVER PIERCE HIT!');
              }
            }
          }
        }
      }
    }

    // Heavy Minigun firing logic: high rate of fire with distance falloff
    function fireMinigunBullet() {
      const w = currentSlot();
      if (w.id !== 'minigun') return;
      const ws = currentSlotState();
      if (ws.overheated) return;

      const now = performance.now() / 1000;
      if (now - (ws.lastFired ?? 0) < (w.fireRate ?? 0.045)) return;
      ws.lastFired = now;

      player.continuousShots++;
      player.shotsFired++;
      vmManager.addRecoil(0.012, 0.016);
      recoilKick += 0.007;
      recoilPitch += (Math.random() - 0.48) * 0.006 + 0.006;
      triggerPlayerFlash();

      playMinigunFireShot(1.0);
      AUDIO.minigunFire.playContinuous(1.0);

      const spread = player.aiming ? (w.adsSpread ?? 0.024) : (w.spread ?? 0.034);
      const ndcX = (Math.random() - 0.5) * spread * 2;
      const ndcY = (Math.random() - 0.5) * spread * 2;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      raycaster.far = w.range ?? 160;
      const hits = raycaster.intersectObjects(world.hittableObjects, false);
      if (hits.length > 0) {
        const hit = hits[0];
        const ud = hit.object.userData;
        spawnImpactSpark(hit.point, ud.type === 'botpart');

        if (hit.object.userData.destructible) {
          world.damageEnvironmentalBlock(hit.object as THREE.Mesh, 15);
        }

        if (ud.type === 'botpart' && ud.ref) {
          const bot = ud.ref as Bot;
          if (bot.team === player.team) return;

          player.shotsHit++;
          const dist = camera.position.distanceTo(hit.point);
          const falloff = getDamageRangeFalloff('minigun', dist);
          if (falloff <= 0) return;

          const isHead = ud.part === 'head';
          if (isHead) player.headshots++;
          let finalDamage = (w.damage ?? 16) * falloff;
          if (isHead) finalDamage *= (w.headshotMult ?? 1.8);

          damageBot(bot, finalDamage, isHead, 'player', raycaster.ray.direction);
          flashHit(bot);
          showHitmarker(isHead);
          if (bot.isZombie) addPoints(10);
          if (['sniper', 'laser', 'lmg', 'minigun'].includes(w.id)) { const d = camera.position.distanceTo(hit.point); const v = Math.max(0, 1.0 - d / 50); AUDIO.bulletHit.play(v); }
        }
      }
    }

    // Tactical Railgun Slug: Pierces solid building walls and doors, zero distance falloff
    function fireRailgunSlug() {
      const w = currentSlot();
      if (w.id !== 'railgun') return;
      const ws = currentSlotState();

      ws.lastFired = performance.now() / 1000;
      player.shotsFired++;
      vmManager.addRecoil(0.12, 0.16);
      recoilKick += 0.08;
      recoilPitch += 0.055;
      triggerPlayerFlash();

      playRailgunSlugBlast();
      AUDIO.railgunFire.play(1.0, true);

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const raycaster = new THREE.Raycaster(camera.position, dir, 0.1, w.range ?? 500);
      const allHits = raycaster.intersectObjects(world.hittableObjects, false);

      // Environmental block degradation from railgun (+75%)
      for (const hit of allHits) {
        if (hit.object.userData.destructible) {
          world.damageEnvironmentalBlock(hit.object as THREE.Mesh, 75);
        }
      }

      // Compute muzzle origin for beam visual
      const origin = camera.position.clone();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const muzzlePt = origin.clone()
        .add(dir.clone().multiplyScalar(0.42))
        .add(right.clone().multiplyScalar(0.16))
        .add(new THREE.Vector3(0, -0.09, 0));

      let endPt = origin.clone().add(dir.clone().multiplyScalar(w.range ?? 300));
      if (allHits.length > 0) {
        endPt = allHits[allHits.length - 1].point.clone().add(dir.clone().multiplyScalar(2.5));
      }
      spawnRailgunBeam(muzzlePt, endPt);

      // Pierce Physics: pierce through solid building walls and doors, dealing full lethal damage with NO falloff
      const hitBotIds = new Set<number>();
      for (const hit of allHits) {
        const ud = hit.object.userData;
        spawnImpactSpark(hit.point, ud.type === 'botpart');

        if (ud.type === 'botpart' && ud.ref) {
          const bot = ud.ref as Bot;
          if (hitBotIds.has(bot.id)) continue;
          hitBotIds.add(bot.id);

          if (bot.team === player.team) continue;

          player.shotsHit++;
          // Railgun has ZERO falloff: 100% full lethal damage across any distance
          const dist = camera.position.distanceTo(hit.point);
          const falloff = getDamageRangeFalloff('railgun', dist); // 1.0
          const isHead = ud.part === 'head';
          if (isHead) player.headshots++;
          let finalDamage = (w.damage ?? 160) * falloff;
          if (isHead) finalDamage *= (w.headshotMult ?? 2.5);

          damageBot(bot, finalDamage, isHead, 'player', raycaster.ray.direction);
          flashHit(bot);
          showHitmarker(isHead);
          if (bot.isZombie) addPoints(25);
          if (['sniper', 'laser', 'lmg', 'minigun'].includes(w.id)) { const d = camera.position.distanceTo(hit.point); const v = Math.max(0, 1.0 - d / 50); AUDIO.bulletHit.play(v); }
          pushKillFeed(isHead ? 'RAILGUN HEADSHOT COVER PIERCE!' : 'RAILGUN SOLID COVER PIERCE HIT!');
        }
      }
    }

    function reloadWeapon() {
      const w = currentSlot();
      if (w.type !== 'weapon') return;
      const ws = currentSlotState();

      // Minigun manual overheat vent
      if (w.id === 'minigun') {
        if (ws.overheated || (ws.heat ?? 0) <= 0) return;
        ws.overheated = true;
        ws.ventTimer = 2.0;
        ws.spinWarmup = 0;
        ws.spinSpeed = 0;
        AUDIO.minigunFire.stop();
        updateMinigunSpinAudio(false, 0);
        playMinigunVentHiss();
        AUDIO.minigunOverheat.play(1.0);
        pushKillFeed('MANUAL VENTING MINIGUN CORES...');
        return;
      }

      // Laser gun venting reload
      if (w.id === 'laser') {
        if (ws.reloading || (ws.heat ?? 0) <= 0) return;
        ws.reloading = true;
        AUDIO.laserBeam.stop();
        laserBeamMesh.visible = false;
        
        ws.heat = 0;
        ws.overheated = false;

        const reloadDur = (w.reloadTime ?? 2.2) * player.classReloadMultiplier;
        ws.reloadT = reloadDur;
        ws.totalReloadT = reloadDur;
        AUDIO.laserVent.play(1.0);
        
        for (let s = 0; s < 12; s++) {
          const pt = new THREE.Vector3(0, 0, -0.6);
          pt.applyMatrix4(vmManager.root.matrixWorld);
          const sm = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.02, 0.02),
            new THREE.MeshBasicMaterial({ color: 0xffaa00 })
          );
          sm.position.copy(pt);
          const vel = new THREE.Vector3((Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5 - 2);
          vel.applyQuaternion(camera.quaternion);
          smokePool.push({ mesh: sm, life: 0.3 + Math.random()*0.3, maxLife: 0.6, vel });
          scene.add(sm);
        }
        return;
      }

      if (ws.reloading || ws.ammo === w.mag || (ws.reserve ?? 0) <= 0) return;

      ws.reloading = true;
      
      const isTactical = (ws.ammo ?? 0) > 0;
      ws.isTacticalReload = isTactical;
      
      AUDIO.arSpray.stop();
      AUDIO.laserBeam.stop();
      AUDIO.minigunFire.stop();
      laserBeamMesh.visible = false;
      player.continuousShots = 0;

      let reloadDur = (w.reloadTime ?? 2.4) * player.classReloadMultiplier;
      if (w.id === 'br') {
        ws.burstRemaining = 0;
        ws.burstTimer = 0;
        reloadDur = (isTactical ? 1.2 : 1.8) * player.classReloadMultiplier;
      } else if (!isTactical && ['pistol', 'smg', 'ar', 'lmg'].includes(w.id)) {
        reloadDur *= 1.4; // 40% slower empty reload
      }
      ws.reloadT = reloadDur;
      ws.totalReloadT = reloadDur;

      if (['pistol', 'smg', 'ar', 'lmg', 'br'].includes(w.id)) {
        if (isTactical) AUDIO.reloadTactical.play(1.0);
        else AUDIO.reloadEmpty.play(1.0);
      } else if (w.id === 'shotgun') {
        setTimeout(() => {
          if (player.alive && currentSlot().id === 'shotgun' && ws.reloading) {
            AUDIO.shotgunReload.play(1.0);
          }
        }, 150);
      } else if (w.id === 'sniper') {
        AUDIO.sniperReload.play(1.0);
      } else if (w.id === 'smg') {
        AUDIO.smgReload.play(1.0);
      } else if (w.id === 'lmg') {
        AUDIO.lmgReload.play(1.0);
      } else if (w.id === 'br') {
        AUDIO.brReload.play(1.0);
      } else if (w.id === 'railgun') {
        AUDIO.sniperReload.play(1.0);
      }
    }

    function activateMedkit() {
      if (player.isDrinking) return; // Already healing
      if (player.health < player.maxHealth) {
        player.isDrinking = true;
        player.drinkTimer = 2.0;
        // Medkit activation will finish in the update loop
        pushKillFeed('APPLYING MEDKIT...');
        AUDIO.sniperReload.play(0.65); // Radio sound effect proxy
      } else {
        pushKillFeed('HP FULL // MEDKIT CONSERVED', true);
      }
    }
    
    function switchSlot(index: number) {
      if (extractionState === 'carrying' && index === 0) {
         pushKillFeed('COMMAND: CANNOT EQUIP PRIMARY WHILE CARRYING CRYO-POD.', true);
         return;
      }

      if (index < 0 || index > 3) return; // Strictly truncated: only index 0, 1, 2
      if (player.slotIndex !== index) {
        AUDIO.arSpray.stop();
        AUDIO.laserBeam.stop();
        AUDIO.minigunFire.stop();
        AUDIO.minigunWindup.stop();
        AUDIO.railgunCharge.stop();
        updateMinigunSpinAudio(false, 0);
        updateRailgunChargeAudio(false, 0);
        laserBeamMesh.visible = false;
        railgunAimLaserMesh.visible = false;
        player.continuousShots = 0;
        player.isDrinking = false;
        AUDIO.arReload.stop();
        AUDIO.shotgunReload.stop();
        AUDIO.sniperReload.stop();
        AUDIO.pistolReload.stop();
        AUDIO.smgReload.stop();
        AUDIO.lmgReload.stop();
        AUDIO.brReload.stop();
        AUDIO.laserVent.stop();
        const oldWs = playerWeaponState[player.slotIndex];
        if (oldWs) {
          if (oldWs.reloading !== undefined) oldWs.reloading = false;
          oldWs.charging = false;
          oldWs.chargeTimer = 0;
          oldWs.spinWarmup = 0;
        }
        vmManager.setRailgunChargeProgress(0);
        player.slotIndex = index;
      }
    }

    // Safe pointer lock helper that catches permission errors in iframes
    const requestGamePointerLock = () => {
      try {
        const p = renderer.domElement.requestPointerLock?.();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // Pointer lock rejected or not supported in current iframe context
          });
        }
      } catch {
        // Fallback
      }
    };

    // Input listeners
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;

      // Escape or P to toggle pause menu cleanly
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameStateRef.current === 'playing') {
          setGameState('paused');
          AUDIO.arSpray.stop();
          player.continuousShots = 0;
          if (document.pointerLockElement) {
            try { document.exitPointerLock?.(); } catch {}
          }
        } else if (gameStateRef.current === 'paused') {
          setGameState('playing');
          requestGamePointerLock();
        }
        return;
      }

      if (gameStateRef.current !== 'playing') return;
      if (e.code === 'ShiftLeft') player.aiming = true;
      if (e.code === 'ControlLeft') player.crouching = true;
      if (e.code === 'Space' && player.onGround) player.vel.y = JUMP_SPEED;
      if (e.code === 'KeyR') reloadWeapon();
      if (e.code === 'KeyG') throwGrenade();
      
      // Squad Controls
      if (e.code === 'KeyZ') {
        const nextDirective = squadDirectiveRef.current === 'follow_lead' ? 'hold_position' : 'follow_lead';
        squadDirectiveRef.current = nextDirective;
        setSquadDirective(nextDirective);
        setSquadDirectiveBanner({
          directive: nextDirective,
          text: nextDirective === 'follow_lead' ? 'FOLLOW LEAD' : 'HOLD POSITION',
          sub: nextDirective === 'follow_lead' ? 'TETHER ACTIVE' : 'DEFENDING LOCAL NODE',
          timer: 2.8
        });
        AUDIO.sniperReload.play(0.65);
      }
      
      if (e.code === 'KeyX') {
        // Toggle targeting phase
        if (targetingPhaseRef.current) {
           targetingPhaseRef.current = false;
           setTargetingPhase(false);
        } else {
           targetingPhaseRef.current = true;
           setTargetingPhase(true);
        }
      }
      
      if (e.code === 'KeyC') {
        const nextDirective = 'push_objective';
        squadDirectiveRef.current = nextDirective;
        setSquadDirective(nextDirective);
        setSquadDirectiveBanner({
          directive: nextDirective,
          text: 'PUSH OBJECTIVE',
          sub: 'ADVANCING TO NEXT SECTOR',
          timer: 2.8
        });
        AUDIO.sniperReload.play(0.65);
      }

      // Melee: Key 'F' (and fallback 'V') - 'E' is preserved strictly for Interact!
      if (e.code === 'KeyF' || e.code === 'KeyV') {
        if (!player.isMeleeing && player.alive) {
          player.isMeleeing = true;
          player.meleeTimer = 0.38;
          playKnifeSlashWhoosh();
          vmManager.triggerKnifeSlash();
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
          raycaster.far = 3.2;
          const hits = raycaster.intersectObjects(world.hittableObjects, false);
          if (hits.length > 0) {
            const hit = hits[0];
            const ud = hit.object.userData;
            spawnImpactSpark(hit.point, ud.type === 'botpart');
            if (ud.type === 'botpart' && ud.ref) {
              const bot = ud.ref;
              if (bot.team === player.team) return;
              damageBot(bot, 65, false, 'player', raycaster.ray.direction);
              flashHit(bot);
              showHitmarker(false);
              showBloodSplatter();
              recoilKick += 0.04;
              recoilPitch += 0.02;
              AUDIO.bulletHit.play(1.0);
              if (bot.isZombie) addPoints(25);
            }
          }
        }
      }
      if (e.code === 'Digit1') switchSlot(0);
      if (e.code === 'Digit2') switchSlot(1);
      if (e.code === 'Digit3') switchSlot(2);
      if (e.code === 'Digit4') activateMedkit();
      
      // Digits 4 through 0 are completely eradicated to eliminate ghost inventories
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      if (e.code === 'ShiftLeft') player.aiming = false;
      if (e.code === 'ControlLeft') player.crouching = false;
    };

    let isMouseDown = false;
    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      if (gameStateRef.current !== 'playing') return;

      if (document.pointerLockElement !== renderer.domElement) {
        requestGamePointerLock();
      }

      if (e.button === 0) {
        if (targetingPhaseRef.current) {
          // X Key: Focus Target Lock Phase
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
          const hits = raycaster.intersectObjects(world.hittableObjects, false);
          let targetHit = null;
          for (const hit of hits) {
            const bot = hit.object.userData?.ref;
            if (bot && bot.alive && bot.team !== player.team) {
              targetHit = bot;
              break;
            }
          }
          if (targetHit) {
            focusTargetIDRef.current = targetHit.id;
                        setSquadDirectiveBanner({
              directive: 'focus_target',
              text: 'TARGET ACQUIRED',
              sub: `LOCKING ALL FIRE ON BOT #${targetHit.id}`,
              timer: 3.5
            });
            pushKillFeed(`SQUAD CMD: ALL FIRE ON BOT #${targetHit.id}`);
            AUDIO.sniperReload.play(0.85);
          } else {
            pushKillFeed('TARGETING PHASE FAILED - NO HOSTILE ACQUIRED');
          }
          targetingPhaseRef.current = false;
          setTargetingPhase(false);
          return; // Do not fire weapon during targeting phase click
        }
        
        player.fireHeld = true;
        if (!currentSlotState()?.reloading) {
          fireWeapon();
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      isMouseDown = false;
      if (e.button === 0) {
        player.fireHeld = false;
        AUDIO.arSpray.stop();
        AUDIO.laserBeam.stop();
        AUDIO.minigunFire.stop();
        AUDIO.minigunWindup.stop();
        AUDIO.railgunCharge.stop();
        updateMinigunSpinAudio(false, 0);
        updateRailgunChargeAudio(false, 0);
        laserBeamMesh.visible = false;
        railgunAimLaserMesh.visible = false;
        player.continuousShots = 0;

        const curWs = currentSlotState();
        if (curWs && curWs.charging) {
          curWs.charging = false;
          curWs.chargeTimer = 0;
          vmManager.setRailgunChargeProgress(0);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const isLocked = document.pointerLockElement === renderer.domElement;
      // Allow aiming when pointer locked, OR when dragging with mouse if pointer lock is restricted
      if (!isLocked && !isMouseDown) return;

      const sens = (sensitivityValRef.current || 11) / 5000;
      player.yaw -= e.movementX * sens;
      player.pitch -= e.movementY * sens;
      player.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, player.pitch));
    };

    const onWheel = (e: WheelEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = (player.slotIndex + dir + 3) % 3; // Strictly cycle active 3 slots
      switchSlot(next);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel);

    const onPointerLockChange = () => {
      // NOTE: We deliberately DO NOT force pause when pointer lock is released!
      // In web previews/iframes, browser pointer lock focus jitter was causing
      // the game to rapid-toggle between playing and paused (flashing the screen).
      if (document.pointerLockElement !== renderer.domElement) {
        AUDIO.arSpray.stop();
        player.continuousShots = 0;
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    onResize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        onResize();
      });
      resizeObserver.observe(containerRef.current);
    }

    const onBottomCenterClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('.hotbar-slot') as HTMLElement | null;
      if (!target || !target.id) return;
      const match = target.id.match(/slot-(\d+)/);
      if (match) {
        const slotIdx = parseInt(match[1], 10) - 1;
        if (slotIdx >= 0 && slotIdx < 3) {
          switchSlot(slotIdx);
        }
      }
    };
    const bottomCenterEl = containerRef.current?.querySelector('#bottom-center');
    bottomCenterEl?.addEventListener('click', onBottomCenterClick as EventListener);

    // Global action triggers from UI buttons
    const deployHandler = () => {
      unlockAudioEngine();
      setupPlayerLoadout();
      matchConfig.mode = matchModeRef.current;
      matchConfig.faction = factionAlignmentRef.current;
      matchConfig.friendlyCount = friendlyCountRef.current;
      matchConfig.enemyCount = enemyCountRef.current;
      matchConfig.targetScore = targetScoreRef.current;
      currentDifficulty = DIFFICULTIES[difficultyKeyRef.current] || DIFFICULTIES.medium;
      mouseSensitivity = (sensitivityValRef.current || 11) / 5000;

      // Map Rules State Guardrail: Horde and Extraction Modes strictly enforce Subterranean Hangar map
      if (matchConfig.mode === 'zombie' || matchConfig.mode === 'extraction') {
        selectedMapStateRef.current = 'hangar';
        setSelectedMapState('hangar');
      }

      initMatch();
      switchSlot(player.slotIndex);
      gameStateRef.current = 'playing';
      setGameState('playing');

      // Ensure active gameplay camera recalculates initial target projection parameters
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = HIP_FOV;
      camera.updateProjectionMatrix();

      // Immediately orient camera at player spawn location and eye level
      camera.position.set(player.pos.x, player.pos.y, player.pos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(player.pitch, player.yaw, 0);

      // Force fresh renderer.render() execution cycle immediately upon mounting
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.render(scene, camera);

      requestGamePointerLock();
    };

    const resumeHandler = () => {
      gameStateRef.current = 'playing';
      setGameState('playing');
      requestGamePointerLock();
    };

    const restartHandler = () => {
      if (
        matchConfig.mode === 'zombie' ||
        matchConfig.mode === 'extraction' ||
        matchModeRef.current === 'zombie' ||
        matchModeRef.current === 'extraction'
      ) {
        selectedMapStateRef.current = 'hangar';
        setSelectedMapState('hangar');
      }
      initMatch();
      switchSlot(player.slotIndex);
      gameStateRef.current = 'playing';
      setGameState('playing');

      // Ensure active gameplay camera recalculates initial target projection parameters
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = HIP_FOV;
      camera.updateProjectionMatrix();
      camera.position.set(player.pos.x, player.pos.y, player.pos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(player.pitch, player.yaw, 0);

      // Force fresh renderer.render() execution cycle
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.render(scene, camera);

      requestGamePointerLock();
    };

    const lobbyHandler = () => {
      AUDIO.arSpray.stop();
      if (document.pointerLockElement) {
        try { document.exitPointerLock?.(); } catch {}
      }
      clearMatchEntities();
      setupLobbyScene();
      gameStateRef.current = 'start';
      setGameState('start');

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = HIP_FOV;
      camera.updateProjectionMatrix();
      camera.position.set(0, 1000 + 1.25, 2.65);
      camera.lookAt(0, 1000 + 1.10, 0);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.render(scene, camera);
    };

    deployHandlerRef.current = deployHandler;
    resumeHandlerRef.current = resumeHandler;
    restartHandlerRef.current = restartHandler;
    lobbyHandlerRef.current = lobbyHandler;

    const deployBtn = containerRef.current?.querySelector('#btn-deploy');
    const resumeBtn = containerRef.current?.querySelector('#btn-resume');
    const restartBtn = containerRef.current?.querySelector('#btn-restart-end');
    const toLobbyPauseBtn = containerRef.current?.querySelector('#btn-to-lobby-pause');
    const toLobbyEndBtn = containerRef.current?.querySelector('#btn-to-lobby-end');

    deployBtn?.addEventListener('click', deployHandler);
    resumeBtn?.addEventListener('click', resumeHandler);
    restartBtn?.addEventListener('click', restartHandler);
    toLobbyPauseBtn?.addEventListener('click', lobbyHandler);
    toLobbyEndBtn?.addEventListener('click', lobbyHandler);

    // Main Game Loop
    const clock = new THREE.Clock();
    let animId = 0;

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());

      if (gameStateRef.current === 'playing') {
        if (hangarGroup) hangarGroup.visible = false;
        if (lobbyAvatar) lobbyAvatar.group.visible = false;
        combatLightGroup.visible = true;
        
        if (selectedMapStateRef.current === 'hangar') {
           scene.background = new THREE.Color(0x14181f);
           scene.fog = new THREE.Fog(0x14181f, 25, 140);
        } else {
           scene.background = null;
           scene.fog = combatFog;
        }
        // 1. Player movement & physics
        if (player.alive) {
          const eyeHeight = player.crouching ? PLAYER_EYE_CROUCH : PLAYER_EYE;
          let speed = player.crouching ? CROUCH_SPEED : (player.sprinting ? SPRINT_SPEED : WALK_SPEED);
          speed *= player.classSpeedMultiplier; // Recon: +20% (1.20), Juggernaut: -15% (0.85)
          const activeWId = currentSlot().id;
          if (activeWId === 'minigun' || activeWId === 'railgun') {
            speed *= 0.80; // Heavy weapon class: -20% speed penalty
          } else if (activeWId === 'lmg') {
            speed *= 0.85; // LMG heavy frame: -15% movement speed penalty
          }

          // Adrenaline rush at low health (< 30 HP)
          const isLowHealth = player.alive && player.health < 30;
          updateAdrenalineHeartbeat(isLowHealth);
          const adrenalineEl = containerRef.current?.querySelector('#adrenaline-overlay') as HTMLElement | null;
          if (adrenalineEl) {
            adrenalineEl.style.display = isLowHealth ? 'block' : 'none';
          }
          const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
          const right = new THREE.Vector3(Math.sin(player.yaw + Math.PI / 2), 0, Math.cos(player.yaw + Math.PI / 2));
          let moveX = 0, moveZ = 0;
          if (keys['KeyW']) { moveX += forward.x; moveZ += forward.z; }
          if (keys['KeyS']) { moveX -= forward.x; moveZ -= forward.z; }
          if (keys['KeyD']) { moveX += right.x; moveZ += right.z; }
          if (keys['KeyA']) { moveX -= right.x; moveZ -= right.z; }
          const moveLen = Math.hypot(moveX, moveZ);
          if (moveLen > 0.001) { moveX /= moveLen; moveZ /= moveLen; }

          player.vel.x = moveX * speed;
          player.vel.z = moveZ * speed;
          world.moveEntityWithCollision(player.pos, player.vel, PLAYER_RADIUS, player.pos.y - eyeHeight, player.pos.y + 0.25, dt);

          player.vel.y += GRAVITY * dt;
          player.pos.y += player.vel.y * dt;
          const ground = world.getHighestSurface(player.pos.x, player.pos.z, player.pos.y - eyeHeight) + eyeHeight;
          if (player.pos.y <= ground) {
            player.pos.y = ground;
            player.vel.y = 0;
            player.onGround = true;
          } else {
            player.onGround = false;
          }

          if (moveLen > 0.001 && player.onGround) {
            bobPhase += dt * (player.sprinting ? 14 : 9);
          } else {
            bobPhase *= 0.9;
          }
          const bobY = Math.sin(bobPhase) * (player.crouching ? 0.02 : 0.045);
          const bobX = Math.cos(bobPhase * 0.5) * (player.crouching ? 0.01 : 0.03);

          recoilPitch = Math.max(0, recoilPitch - dt * 0.8);
          camera.position.set(player.pos.x + bobX, player.pos.y + bobY, player.pos.z);
          camera.rotation.y = player.yaw;
          camera.rotation.x = player.pitch + recoilPitch;

          if (player.isMeleeing) {
            player.meleeTimer -= dt;
            if (player.meleeTimer <= 0) {
              player.isMeleeing = false;
              containerRef.current?.querySelector('#melee-arm')?.classList.remove('punch');
            }
          }

          if (player.isDrinking) {
            player.drinkTimer -= dt;
            if (player.drinkTimer <= 0) {
              player.isDrinking = false;
              const w = currentSlot();
              const ws = currentSlotState();
              if (w.id === 'mini') {
                player.shield = Math.min(50, player.shield + 25);
                pushKillFeed('+25 SHIELD APPLIED');
                ws.count = Math.max(0, (ws.count ?? 0) - 1);
              } else if (w.id === 'medkit') {
                if (player.health < player.maxHealth) {
                  player.health = Math.min(player.maxHealth, player.health + 50);
                  pushKillFeed('+50 HEALTH APPLIED');
                } else {
                  player.shield = Math.min(player.maxShield, player.shield + 50);
                  pushKillFeed('+50 SHIELD APPLIED');
                }
                ws.count = Math.max(0, (ws.count ?? 0) - 1);
              }
            }
          }

          // Storm damage
          if (matchConfig.mode !== 'zombie') {
            const distFromCenter = Math.hypot(player.pos.x - storm.center.x, player.pos.z - storm.center.z);
            if (distFromCenter > storm.radius) {
              applyDamageToPlayer(STORM_DPS * dt, true, true, null);
              containerRef.current?.querySelector('#stormvignette')?.classList.add('active');
            } else {
              containerRef.current?.querySelector('#stormvignette')?.classList.remove('active');
            }
          }
        }

        // 2. Weapon reload progress, cooling, & auto fire for the active 3-slot loadout
        playerLoadout.forEach((w, i) => {
          if (w.type !== 'weapon') return;
          const ws = playerWeaponState[i];
          if (!ws) return;

          if (w.id === 'laser') {
            // Passive cooling when not firing
            if (!player.fireHeld || player.slotIndex !== i) {
              if (ws.heat && ws.heat > 0) {
                ws.heat = Math.max(0, ws.heat - dt * 26);
              }
            }
            if (ws.reloading) {
              ws.reloadT = (ws.reloadT ?? 0) - dt;
              if (ws.reloadT <= 0) {
                ws.heat = 0;
                ws.overheated = false;
                ws.reloading = false;
                ws.reloadT = 0;
              }
            }
            return;
          }

          if (ws.reloading) {
            ws.reloadT = (ws.reloadT ?? 0) - dt;
            if (ws.reloadT <= 0) {
              const need = (w.mag ?? 30) - (ws.ammo ?? 0);
              const take = Math.min(need, ws.reserve ?? 0);
              ws.ammo = (ws.ammo ?? 0) + take;
              ws.reserve = (ws.reserve ?? 0) - take;
              ws.reloading = false;
              ws.reloadT = 0;
            }
          }
        });

        const curW = currentSlot();
        const curWs = currentSlotState();
        if (player.fireHeld && curW.auto && curW.type === 'weapon' && !curWs.reloading) {
          fireWeapon();
        }

        // Minigun update logic: spin warmup, hyper-auto fire, 4s overheat, 2s vent
        if (curW.id === 'minigun') {
          if (curWs.overheated) {
            curWs.ventTimer = (curWs.ventTimer ?? 2) - dt;
            curWs.spinWarmup = Math.max(0, (curWs.spinWarmup ?? 0) - dt * 2);
            curWs.spinSpeed = Math.max(0, (curWs.spinSpeed ?? 0) - dt * 15);
            updateMinigunSpinAudio(false, 0);

            // Vent yellow particle smoke from Minigun vents
            const origin = camera.position.clone();
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const ventPt = origin.clone()
              .add(dir.clone().multiplyScalar(0.40))
              .add(right.clone().multiplyScalar(0.18))
              .add(new THREE.Vector3(0, -0.12, 0));
            spawnYellowSmoke(ventPt, 0.4);

            if ((curWs.ventTimer ?? 0) <= 0) {
              curWs.overheated = false;
              curWs.heat = 0;
              curWs.ventTimer = 0;
              pushKillFeed('MINIGUN SYSTEM COOLED');
            }
          } else if (player.fireHeld && player.alive) {
            // Warmup barrel spin (0.5s delay)
            curWs.spinWarmup = Math.min(0.5, (curWs.spinWarmup ?? 0) + dt);
            const spinProgress = (curWs.spinWarmup ?? 0) / 0.5;
            curWs.spinSpeed = spinProgress * 28.0;
            updateMinigunSpinAudio(true, spinProgress);

            // If 0.5s spin warmup complete, fire hyper-auto bullets
            if ((curWs.spinWarmup ?? 0) >= 0.5) {
              fireMinigunBullet();
              // Heat increases: 4 seconds continuous fire -> 100%
              curWs.heat = Math.min(100, (curWs.heat ?? 0) + (dt / 4.0) * 100);
              if ((curWs.heat ?? 0) >= 100) {
                curWs.heat = 100;
                curWs.overheated = true;
                curWs.ventTimer = 2.0;
                AUDIO.minigunFire.stop();
                updateMinigunSpinAudio(false, 0);
                playMinigunVentHiss();
                AUDIO.minigunOverheat.play(1.0);
                pushKillFeed('MINIGUN OVERHEATED! 2s EMERGENCY VENT...');
              }
            }
          } else {
            // Spool down and cool down
            curWs.spinWarmup = Math.max(0, (curWs.spinWarmup ?? 0) - dt * 1.5);
            curWs.spinSpeed = Math.max(0, (curWs.spinSpeed ?? 0) - dt * 20);
            updateMinigunSpinAudio(false, (curWs.spinWarmup ?? 0) / 0.5);
            AUDIO.minigunFire.stop();
            // Cool down: ~22% per sec
            curWs.heat = Math.max(0, (curWs.heat ?? 0) - dt * 22);
          }

          vmManager.setMinigunSpin((curWs.spinSpeed ?? 0) * dt, !!curWs.overheated);
        } else {
          updateMinigunSpinAudio(false, 0);
          AUDIO.minigunFire.stop();
        }

        // Tactical Railgun: 1.2s charge cycle, auto-unleash slug, cancel if released early
        if (curW.id === 'railgun') {
          if (player.alive && player.fireHeld && !curWs.reloading && (curWs.ammo ?? 0) > 0) {
            curWs.charging = true;
            curWs.chargeTimer = Math.min(1.2, (curWs.chargeTimer ?? 0) + dt);
            const prog = (curWs.chargeTimer ?? 0) / 1.2;
            updateRailgunChargeAudio(true, prog);
            vmManager.setRailgunChargeProgress(prog);

            if ((curWs.chargeTimer ?? 0) >= 1.2) {
              // At exactly 1.2s, auto-unleash slug
              curWs.charging = false;
              curWs.chargeTimer = 0;
              curWs.ammo = (curWs.ammo ?? 1) - 1;
              updateRailgunChargeAudio(false, 0);
              vmManager.setRailgunChargeProgress(0);
              fireRailgunSlug();
              if ((curWs.ammo ?? 0) <= 0) {
                reloadWeapon();
              }
            }
          } else {
            if (curWs.charging || (curWs.chargeTimer ?? 0) > 0) {
              curWs.charging = false;
              curWs.chargeTimer = 0;
              updateRailgunChargeAudio(false, 0);
              vmManager.setRailgunChargeProgress(0);
            }
          }
        } else {
          updateRailgunChargeAudio(false, 0);
        }

        // Battle Rifle 3-round burst continuation
        if (curW.id === 'br' && (curWs.burstRemaining ?? 0) > 0 && !curWs.reloading) {
          curWs.burstTimer = (curWs.burstTimer ?? 0) - dt;
          if ((curWs.burstTimer ?? 0) <= 0) {
            curWs.burstRemaining = (curWs.burstRemaining ?? 1) - 1;
            curWs.burstTimer = curW.burstRate ?? 0.075;
            if ((curWs.ammo ?? 0) > 0) {
              curWs.ammo = (curWs.ammo ?? 1) - 1;
              vmManager.addRecoil(0.035, 0.040);
              AUDIO.brBurst.play(1.0, true);
              triggerPlayerFlash();

              const spread = player.aiming ? (curW.adsSpread ?? 0.008) : (curW.spread ?? 0.018);
              const ndcX = (Math.random() - 0.5) * spread * 2;
              const ndcY = (Math.random() - 0.5) * spread * 2;
              const raycaster = new THREE.Raycaster();
              raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
              raycaster.far = curW.range ?? 120;
              const hits = raycaster.intersectObjects(world.hittableObjects, false);
              if (hits.length > 0) {
                const hit = hits[0];
                const ud = hit.object.userData;
                spawnImpactSpark(hit.point, ud.type === 'botpart');
                if (ud.type === 'botpart' && ud.ref) {
                  const bot = ud.ref as Bot;
                  if (bot.team !== player.team) {
                    const isHead = ud.part === 'head';
                    const dist = camera.position.distanceTo(hit.point);
                    const falloff = getDamageRangeFalloff(curW.id, dist);
                    let finalDamage = (curW.damage ?? 32) * falloff;
                    if (isHead) finalDamage *= (curW.headshotMult ?? 2.1);
                    damageBot(bot, finalDamage, isHead, 'player', raycaster.ray.direction);
                    flashHit(bot);
                    showHitmarker(isHead);
                    if (bot.isZombie) addPoints(10);
                    if (['sniper', 'laser', 'lmg', 'minigun'].includes(curW.id)) { const d = camera.position.distanceTo(hit.point); const v = Math.max(0, 1.0 - d / 50); AUDIO.bulletHit.play(v); }
                  }
                } else if (curW.id === 'br') {
                  const secHit = hits.find(h => h.object.userData.type === 'botpart' && h.distance - hit.distance <= 4.0);
                  if (secHit && secHit.object.userData.ref) {
                    const bot = secHit.object.userData.ref as Bot;
                    if (bot.team !== player.team) {
                      const dist = camera.position.distanceTo(secHit.point);
                      const falloff = getDamageRangeFalloff(curW.id, dist);
                      if (falloff > 0) {
                        const isHead = secHit.object.userData.part === 'head';
                        let finalDamage = (curW.damage ?? 32) * falloff * 0.5;
                        if (isHead) finalDamage *= (curW.headshotMult ?? 2.1);
                        damageBot(bot, finalDamage, isHead, 'player', raycaster.ray.direction);
                        flashHit(bot);
                        showHitmarker(isHead);
                        if (bot.isZombie) addPoints(10);
                        pushKillFeed(isHead ? 'HEADSHOT COVER PIERCE!' : 'COVER PIERCE HIT!');
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Covenant Laser Gun continuous plasma beam positioning
        if (player.alive && curW.id === 'laser' && player.fireHeld && !curWs.overheated && !curWs.reloading) {
          laserBeamMesh.visible = true;
          const origin = camera.position.clone();
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const startPt = origin.clone()
            .add(dir.clone().multiplyScalar(0.35))
            .add(right.clone().multiplyScalar(0.12))
            .add(new THREE.Vector3(0, -0.09, 0));

          const raycaster = new THREE.Raycaster(camera.position, dir, 0.1, curW.range ?? 95);
          const hits = raycaster.intersectObjects(world.hittableObjects, false);
          let endPt = camera.position.clone().add(dir.clone().multiplyScalar(curW.range ?? 95));
          if (hits.length > 0) {
            endPt = hits[0].point;
            spawnImpactSpark(endPt, hits[0].object.userData.type === 'botpart');
          }
          const beamLen = startPt.distanceTo(endPt);
          laserBeamMesh.position.copy(startPt);
          laserBeamMesh.lookAt(endPt);
          laserBeamMesh.scale.set(1, 1, Math.max(0.1, beamLen));
        } else {
          laserBeamMesh.visible = false;
        }

        // Kinetic Railgun crimson laser pointer sight during 1.2s charge
        if (player.alive && curW.id === 'railgun' && curWs.charging) {
          railgunAimLaserMesh.visible = true;
          const origin = camera.position.clone();
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const startPt = origin.clone()
            .add(dir.clone().multiplyScalar(0.40))
            .add(right.clone().multiplyScalar(0.14))
            .add(new THREE.Vector3(0, -0.08, 0));

          const raycaster = new THREE.Raycaster(camera.position, dir, 0.1, curW.range ?? 300);
          const hits = raycaster.intersectObjects(world.hittableObjects, false);
          let endPt = camera.position.clone().add(dir.clone().multiplyScalar(curW.range ?? 300));
          if (hits.length > 0) {
            endPt = hits[0].point;
          }
          const beamLen = startPt.distanceTo(endPt);
          railgunAimLaserMesh.position.copy(startPt);
          railgunAimLaserMesh.lookAt(endPt);
          railgunAimLaserMesh.scale.set(1, 1, Math.max(0.1, beamLen));
        } else {
          railgunAimLaserMesh.visible = false;
        }

        // 3. Aim FoV transition
        const targetFov = player.aiming ? (curW.adsFov ?? HIP_FOV) : HIP_FOV;
        let adsSpeed = 10;
        if (factionAlignmentRef.current === 'apex' && gearTierRef.current === 'specialized') {
          adsSpeed = 11.5; // Stalker perk: +15% faster ADS transition
        }
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * adsSpeed);
        camera.updateProjectionMatrix();
        const showScope = player.aiming && !!curW.scoped;
        const scopeEl = containerRef.current?.querySelector('#scope-overlay') as HTMLElement | null;
        const crossEl = containerRef.current?.querySelector('#crosshair') as HTMLElement | null;
        if (scopeEl) scopeEl.style.display = showScope ? 'block' : 'none';
        if (crossEl) crossEl.style.display = showScope ? 'none' : 'block';

        // 4. Muzzle flash fade
        if (playerFlashT > 0) {
          playerFlashT -= dt;
          const k = Math.max(0, playerFlashT / 0.07);
          const s = 0.55 * k + 0.12;
          playerFlash.scale.set(s, s, 1);
          playerFlash.material.opacity = k;
          
          const targetX = player.aiming ? 0 : 0.2;
          const targetY = player.aiming ? -0.05 : -0.16;
          playerFlash.position.x += (targetX - playerFlash.position.x) * dt * 15;
          playerFlash.position.y += (targetY - playerFlash.position.y) * dt * 15;
        } else {
          playerFlash.scale.set(0, 0, 0);
        }

        // 5. Viewmodels update
        const isMoving = player.onGround && (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD']);
        vmManager.update(
          dt,
          curW,
          curWs,
          player.aiming,
          player.sprinting,
          player.onGround,
          isMoving,
          player.isMeleeing,
          player.isDrinking,
          player.drinkTimer,
          player.alive,
          true
        );

        
        // === SUBTERRANEAN EXTRACTION GAME LOOP & AI DIRECTOR ===
        let extPromptResult: { interactionPrompt: string | null; isPromptObjective: boolean } = {
          interactionPrompt: null,
          isPromptObjective: false
        };
        if (matchConfig.mode === 'extraction' && extractionDirector) {
          extPromptResult = extractionDirector.update(dt, keys);
          if (animId % 6 === 0) {
            setExtractionState({ ...extractionDirector.state });
          }
        }
        
        // 6. World doors & interactions
        world.updateDoors(dt);

        let nearestDoor = null;
        let nearestDoorDist = 999;
        for (const d of world.doors) {
          const dist = player.pos.distanceTo(d.pos);
          if (dist < 3.2 && dist < nearestDoorDist) {
            nearestDoor = d;
            nearestDoorDist = dist;
          }
        }

        let nearestPickup = null;
        let nearestPickupDist = 999;
        for (let i = world.groundPickups.length - 1; i >= 0; i--) {
          const item = world.groundPickups[i];
          item.group.rotation.y += dt * 1.6;
          item.group.position.y = terrainHeight(item.group.position.x, item.group.position.z) + 0.55 + Math.sin(storm.elapsed * 3 + i) * 0.08;
          const dist = Math.hypot(player.pos.x - item.group.position.x, player.pos.z - item.group.position.z);
          if (dist < 2.3 && dist < nearestPickupDist) {
            nearestPickup = item;
            nearestPickupDist = dist;
          }
        }

        const promptEl = containerRef.current?.querySelector('#pickup-prompt') as HTMLElement | null;
        if (promptEl) {
          if (extPromptResult.interactionPrompt) {
            promptEl.style.display = 'block';
            promptEl.textContent = extPromptResult.interactionPrompt;
            promptEl.style.color = extPromptResult.isPromptObjective ? '#2de2e6' : 'white';
          } else if (nearestDoor) {
            let canOpen = true;
            let doorReason = '';
            if (matchConfig.mode === 'extraction' && extractionDirector) {
              const check = extractionDirector.canOpenDoor(nearestDoor.pos);
              canOpen = check.allowed;
              doorReason = check.reason || 'DOOR LOCKED';
            }
            
            promptEl.style.display = 'block';
            if (!canOpen && !nearestDoor.isOpen) {
              promptEl.textContent = doorReason;
              promptEl.style.color = '#ff3333';
            } else {
              promptEl.textContent = nearestDoor.isOpen ? 'Press E to Close Door' : 'Press E to Open Door';
              promptEl.style.color = 'white';
              if (keys['KeyE']) {
                keys['KeyE'] = false;
                nearestDoor.isOpen = !nearestDoor.isOpen;
                nearestDoor.targetAngle = nearestDoor.isOpen ? -Math.PI / 2 : 0;
                nearestDoor.collider.active = !nearestDoor.isOpen;
              }
            }
          } else if (nearestPickup) {
            promptEl.style.display = 'block';
            promptEl.textContent = `[E] ${nearestPickup.label}`;
            if (keys['KeyE']) {
              keys['KeyE'] = false;
              const pItem = nearestPickup;
              const wType = WEAPONS[pItem.typeIndex];
              if (wType) {
                if (wType.type === 'grenade') {
                  playerWeaponState[2].count = Math.min(6, (playerWeaponState[2].count ?? 0) + pItem.ammo);
                  pushKillFeed(`+${pItem.ammo} TACTICAL GRENADES`);
                } else if (wType.id === playerLoadout[0].id) {
                  playerWeaponState[0].reserve = (playerWeaponState[0].reserve ?? 0) + pItem.ammo;
                  pushKillFeed(`+${pItem.ammo} ${playerLoadout[0].name} AMMO`);
                } else if (wType.id === playerLoadout[1].id) {
                  playerWeaponState[1].reserve = (playerWeaponState[1].reserve ?? 0) + pItem.ammo;
                  pushKillFeed(`+${pItem.ammo} ${playerLoadout[1].name} AMMO`);
                } else {
                  pushKillFeed(`COLLECTED ${wType.name} AMMO (+ $50 CONVERTED)`);
                  addPoints(50);
                }
                scene.remove(pItem.group);
                const idxInArr = world.groundPickups.indexOf(pItem);
                if (idxInArr >= 0) world.groundPickups.splice(idxInArr, 1);
              }
            }
          } else {
            promptEl.style.display = 'none';
          }
        }

        // 7. Active Grenades physics
        for (let i = activeGrenades.length - 1; i >= 0; i--) {
          const g = activeGrenades[i];
          g.timeAlive += dt;
          g.group.rotation.x += g.rotAxis.x * g.rotSpeed * dt;
          g.group.rotation.y += g.rotAxis.y * g.rotSpeed * dt;
          g.group.rotation.z += g.rotAxis.z * g.rotSpeed * dt;
          g.vel.y += GRAVITY * dt;
          g.pos.x += g.vel.x * dt;
          g.pos.z += g.vel.z * dt;
          g.pos.y += g.vel.y * dt;

          const surfaceY = world.getHighestSurface(g.pos.x, g.pos.z, g.pos.y);
          const groundLimit = surfaceY + g.radius;
          let isHighImpact = false;
          if (g.pos.y <= groundLimit) {
            const impactSpeed = Math.abs(g.vel.y);
            g.pos.y = groundLimit;
            g.hasHitGround = true;
            if (impactSpeed > 7.5 && g.timeAlive > 0.25) isHighImpact = true;
            g.vel.y = -g.vel.y * 0.42;
            g.vel.x *= 0.76;
            g.vel.z *= 0.76;
            if (Math.abs(g.vel.y) < 0.28) g.vel.y = 0;
          }
          g.group.position.copy(g.pos);

          if (isHighImpact || (g.timeAlive >= g.maxFuse && g.hasHitGround)) {
            detonateGrenade(g.pos, g.ownerTeam);
            scene.remove(g.group);
            activeGrenades.splice(i, 1);
          }
        }

        // 8. Explosion particles
        for (let i = explosionEffects.length - 1; i >= 0; i--) {
          const fx = explosionEffects[i];
          fx.life -= dt;
          fx.scale += dt * 14.0;
          fx.mesh.scale.set(fx.scale, fx.scale, fx.scale);
          (fx.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fx.life / 0.32);
          if (fx.light) fx.light.intensity = (fx.life / 0.32) * 4.5;
          if (fx.life <= 0) {
            scene.remove(fx.mesh);
            if (fx.light) scene.remove(fx.light);
            explosionEffects.splice(i, 1);
          }
        }

        // 9. Sparks
        for (let i = sparkPool.length - 1; i >= 0; i--) {
          const s = sparkPool[i];
          s.life -= dt;
          if (s.vel) {
            s.mesh.position.addScaledVector(s.vel, dt);
            s.vel.y -= 9.8 * dt; // gravity
          } else {
            s.mesh.scale.multiplyScalar(1 + dt * 4);
          }
          if (s.life <= 0) {
            scene.remove(s.mesh);
            sparkPool.splice(i, 1);
          }
        }

        // Update severed limbs / ragdolls
        for (let i = limbPool.length - 1; i >= 0; i--) {
          const l = limbPool[i];
          l.vel.y += GRAVITY * dt;
          l.mesh.position.addScaledVector(l.vel, dt);
          l.mesh.rotateOnWorldAxis(l.rotAxis, l.rotSpeed * dt);
          
          const gY = terrainHeight(l.mesh.position.x, l.mesh.position.z) + 0.1;
          if (l.mesh.position.y <= gY) {
            l.mesh.position.y = gY;
            l.vel.set(0,0,0);
            l.rotSpeed = 0;
          }
          
          l.life -= dt;
          if (l.life <= 0) {
            scene.remove(l.mesh);
            limbPool.splice(i, 1);
          }
        }

        // Update yellow smoke particles (Minigun venting)
        for (let i = smokePool.length - 1; i >= 0; i--) {
          const sm = smokePool[i];
          sm.life -= dt;
          sm.mesh.position.addScaledVector(sm.vel, dt);
          const s = 1.0 + (1.0 - sm.life / sm.maxLife) * 2.2;
          sm.mesh.scale.set(s, s, s);
          (sm.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (sm.life / sm.maxLife) * 0.75);
          if (sm.life <= 0) {
            scene.remove(sm.mesh);
            smokePool.splice(i, 1);
          }
        }

        // Update Railgun solid silver kinetic projectile tracers
        for (let i = railgunProjectiles.length - 1; i >= 0; i--) {
          const rp = railgunProjectiles[i];
          rp.life -= dt;
          const progress = 1 - Math.max(0, rp.life / rp.maxLife); // 0 to 1
          // Projectile slug cuts through the screen at hypersonic speed (~0.05s)
          const travelP = Math.min(1, progress * 4.5);
          rp.slugMesh.position.copy(rp.start).addScaledVector(rp.dir, travelP * rp.dist);
          if (travelP >= 1) {
            rp.slugMesh.visible = false;
          }

          // Shockwave trail dissipates rapidly
          const trailAlpha = Math.max(0, rp.life / rp.maxLife);
          (rp.trailMesh.material as THREE.MeshBasicMaterial).opacity = trailAlpha * 0.85;
          const trailScale = 1.0 + (1 - trailAlpha) * 0.5;
          rp.trailMesh.scale.set(trailScale, trailScale, 1);

          if (rp.life <= 0) {
            scene.remove(rp.group);
            railgunProjectiles.splice(i, 1);
          }
        }

        // Update persistent toxic puddles from Bloater explosions
        updateToxicPuddles(dt, scene, {
          pos: player.pos,
          alive: player.alive,
          applyDamage: (dmg, isHead, isExp, attacker) => applyDamageToPlayer(dmg, false, false, attacker)
        }, bots, damageBot);

        // Update radar scramble countdown
        if ((window as any).radarScrambleTimer && (window as any).radarScrambleTimer > 0) {
          (window as any).radarScrambleTimer -= dt;
        }

        // 10. Bots & AI logic
        for (const bot of bots) {
          bot.flashMats.forEach(m => {
            if (m.emissiveIntensity > 0) m.emissiveIntensity = Math.max(0, m.emissiveIntensity - dt * 4);
          });
          if (bot.muzzleFlashT > 0 && bot.muzzleFlash) {
            bot.muzzleFlashT -= dt;
            const k = Math.max(0, bot.muzzleFlashT / 0.07);
            const s = 0.4 * k + 0.08;
            bot.muzzleFlash.scale.set(s, s, 1);
            bot.muzzleFlash.material.opacity = k;
          } else if (bot.muzzleFlash) {
            bot.muzzleFlash.scale.set(0, 0, 0);
          }

          if (bot.meleeCooldown > 0) bot.meleeCooldown -= dt;

          if (!bot.alive) {
            if (Math.abs(bot.group.rotation[bot.fallAxis]) < 1.55) {
              bot.group.rotation[bot.fallAxis] += bot.fallDir * dt * 3.2;
            }
            if (bot.slideVel) {
              bot.pos.addScaledVector(bot.slideVel, dt);
              bot.slideVel.multiplyScalar(Math.max(0, 1 - dt * 3.5));
              bot.group.position.copy(bot.pos);
            }
            bot.deathT -= dt;
            if (bot.deathT <= 0) removeBot(bot);
            continue;
          }

          if (bot.isZombie) {
            updateBioMutantAI(bot, dt, getMutantAIContext());

            const zDist = bot.pos.distanceTo(camera.position);
            if (zDist <= 32 && (bot.mutantType === 'RUNNER' || bot.mutantType === 'BANSHEE' || zDist <= 14 || bot.meleeCooldown > 0)) {
              const now = performance.now();
              const alreadyPinged = radarPingsRef.current.some(p => p.type === 'zombie' && Math.hypot(p.x - bot.pos.x, p.z - bot.pos.z) < 2.5 && (now - p.timestamp) < 400);
              if (!alreadyPinged) {
                radarPingsRef.current.push({
                  x: bot.pos.x,
                  z: bot.pos.z,
                  timestamp: now,
                  duration: 1.2,
                  type: 'zombie'
                });
              }
            }
            continue;
          }

          const curSpeed = Math.hypot(bot.vel.x, bot.vel.z);
          if (curSpeed > 0.2) {
            bot.walkPhase += dt * curSpeed * (bot.isZombie && bot.zType === 'runner' ? 3.8 : 2.8);
            const stride = Math.sin(bot.walkPhase);
            bot.legLPivot.rotation.x = stride * 0.65;
            bot.legRPivot.rotation.x = -stride * 0.65;

            // Multi-jointed anatomical knee flexion
            const kneeL = Math.max(0, -stride * 0.75);
            const kneeR = Math.max(0, stride * 0.75);
            if (bot.legLLowerPivot) bot.legLLowerPivot.rotation.x = kneeL;
            if (bot.legRLowerPivot) bot.legRLowerPivot.rotation.x = kneeR;

            if (!bot.isZombie) {
              bot.armLPivot.rotation.x = -stride * 0.45;
              bot.armRPivot.rotation.x = -0.45 + stride * 0.16;
              if (bot.armLLowerPivot) bot.armLLowerPivot.rotation.x = -0.25 - stride * 0.12;
              if (bot.armRLowerPivot) bot.armRLowerPivot.rotation.x = -0.32 + stride * 0.08;
            } else if (bot.zType === 'runner') {
              if (bot.isSprinting) {
                // RUNNER SPRINT MATRICES: Aggressive 35-degree forward torso lean and arms flung wildly backward
                bot.torsoGroup.rotation.x = 0.61 + Math.sin(bot.walkPhase * 2) * 0.08;
                bot.armLPivot.rotation.x = 1.15 + stride * 0.35;
                bot.armRPivot.rotation.x = 1.15 - stride * 0.35;
                bot.armLPivot.rotation.z = -0.28;
                bot.armRPivot.rotation.z = 0.28;
                if (bot.armLLowerPivot) bot.armLLowerPivot.rotation.x = 0.35;
                if (bot.armRLowerPivot) bot.armRLowerPivot.rotation.x = 0.35;
              } else {
                // RUNNER IDLE/PATROL: Upright standing/walking gait (NOT sprinting)
                bot.torsoGroup.rotation.x = 0.08;
                bot.armLPivot.rotation.x = -0.3 + stride * 0.3;
                bot.armRPivot.rotation.x = -0.3 - stride * 0.3;
                bot.armLPivot.rotation.z = -0.05;
                bot.armRPivot.rotation.z = 0.05;
                if (bot.armLLowerPivot) bot.armLLowerPivot.rotation.x = -0.15;
                if (bot.armRLowerPivot) bot.armRLowerPivot.rotation.x = -0.15;
              }
            } else {
              bot.armLPivot.rotation.x = -1.35 + Math.sin(bot.walkPhase * 0.8) * 0.15;
              bot.armRPivot.rotation.x = -1.35 - Math.sin(bot.walkPhase * 0.8) * 0.15;
            }
          } else {
            bot.legLPivot.rotation.x = 0;
            bot.legRPivot.rotation.x = 0;
            if (bot.legLLowerPivot) bot.legLLowerPivot.rotation.x = 0;
            if (bot.legRLowerPivot) bot.legRLowerPivot.rotation.x = 0;
            if (!bot.isZombie) {
              if (bot.armLLowerPivot) bot.armLLowerPivot.rotation.x = -0.25;
              if (bot.armRLowerPivot) bot.armRLowerPivot.rotation.x = -0.32;
            } else if (bot.zType === 'runner') {
              if (bot.isSprinting) {
                bot.torsoGroup.rotation.x = 0.61;
                bot.armLPivot.rotation.x = 1.0;
                bot.armRPivot.rotation.x = 1.0;
                bot.armLPivot.rotation.z = -0.25;
                bot.armRPivot.rotation.z = 0.25;
              } else {
                // Idle standing state
                bot.torsoGroup.rotation.x = 0.04;
                bot.armLPivot.rotation.x = -0.15;
                bot.armRPivot.rotation.x = -0.15;
                bot.armLPivot.rotation.z = -0.05;
                bot.armRPivot.rotation.z = 0.05;
                if (bot.armLLowerPivot) bot.armLLowerPivot.rotation.x = -0.15;
                if (bot.armRLowerPivot) bot.armRLowerPivot.rotation.x = -0.15;
              }
            }
          }

          if (bot.isZombie && bot.meleeCooldown > 0) {
            const slash = Math.sin((bot.meleeCooldown / 0.9) * Math.PI);
            bot.armRPivot.rotation.x = -1.6 - slash * 0.7;
          }

          // Target acquisition
          let targetPos: THREE.Vector3 | null = null;
          let targetObj: Bot | 'player' | null = null;
          let bestDist = 999;

          if (matchConfig.mode === 'zombie') {
            if (bot.isZombie) {
              if (player.alive && bot.team !== player.team) {
                bestDist = bot.pos.distanceTo(player.pos);
                targetObj = 'player';
                targetPos = camera.position.clone();
              }
              for (const other of bots) {
                if (!other.alive || other.team !== 'blue') continue;
                const d = bot.pos.distanceTo(other.pos);
                if (d < bestDist) {
                  bestDist = d;
                  targetObj = other;
                  targetPos = other.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                }
              }
            } else {
              let hasFocusTarget = false;
              if (bot.team === player.team && focusTargetIDRef.current !== null) {
                 const focusedBot = bots.find(b => b.id === focusTargetIDRef.current);
                 if (focusedBot && focusedBot.alive && focusedBot.isZombie) {
                    targetObj = focusedBot;
                    targetPos = focusedBot.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                    hasFocusTarget = true;
                 } else {
                    focusTargetIDRef.current = null;
                 }
              }
              if (!hasFocusTarget) {
                for (const other of bots) {
                  if (!other.alive || !other.isZombie) continue;
                  const d = bot.pos.distanceTo(other.pos);
                  if (d >= 60) continue;

                  // Squad tactical prioritization
                  let priorityWeight = d;
                  const mType = other.mutantType || (other.zType ? other.zType.toUpperCase() : 'WALKER');
                  if (mType === 'RUNNER' && d <= 5.0) {
                    priorityWeight -= 45.0; // Intercept charging runner
                  } else if (mType === 'BANSHEE') {
                    priorityWeight -= 30.0; // Silence sonic disruptor
                  } else if (mType === 'MEGABOSS') {
                    priorityWeight -= 18.0; // Focus boss fire
                  } else if (mType === 'BLOATER' && d <= 4.0) {
                    priorityWeight -= 12.0; // Detonation threshold
                  }

                  if (priorityWeight < bestDist) {
                    bestDist = priorityWeight;
                    targetObj = other;
                    targetPos = other.pos.clone().add(new THREE.Vector3(0, other.hoverHeight ? other.hoverHeight + 0.8 : 1.5, 0));
                  }
                }
              }
            }
          } else {
            if (player.alive && bot.team !== player.team) {
              const dPlayer = bot.pos.distanceTo(player.pos);
              if (dPlayer < 55) {
                bestDist = dPlayer;
                targetObj = 'player';
                targetPos = camera.position.clone();
              }
            }
            // Focus target override for friendly bots
            let hasFocusTarget = false;
            if (bot.team === player.team && focusTargetIDRef.current !== null) {
               const focusedBot = bots.find(b => b.id === focusTargetIDRef.current);
               if (focusedBot && focusedBot.alive) {
                  targetObj = focusedBot;
                  targetPos = focusedBot.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                  hasFocusTarget = true;
               } else {
                  focusTargetIDRef.current = null; // Clear if dead
               }
            }
            
            if (!hasFocusTarget) {
              for (const other of bots) {
                if (!other.alive || other === bot || other.team === bot.team) continue;
                const d = bot.pos.distanceTo(other.pos);
                if (d < 50 && d < bestDist) {
                  bestDist = d;
                  targetObj = other;
                  targetPos = other.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                }
              }
            }
          }

          if (targetPos) {
            const dx = targetPos.x - bot.pos.x;
            const dz = targetPos.z - bot.pos.z;
            const dist = Math.hypot(dx, dz) || 0.001;
            const ndx = dx / dist;
            const ndz = dz / dist;

            // Bot tactical healing logic below 35% health
              let isHealing = false;
              if (bot.healSlot) {
                if (bot.healSlot.healCooldown > 0) {
                  bot.healSlot.healCooldown -= dt;
                  isHealing = true;
                } else if (bot.health < bot.maxHealth * 0.35) {
                  if (bot.healSlot.medkitCount > 0) {
                    bot.healSlot.medkitCount--;
                    bot.healSlot.healCooldown = 2.0; // 2s pause
                    bot.health = Math.min(bot.maxHealth, bot.health + 50);
                    isHealing = true;
                  } else if (bot.healSlot.shieldPotCount > 0) {
                    bot.healSlot.shieldPotCount--;
                    bot.healSlot.healCooldown = 2.0;
                    bot.health = Math.min(bot.maxHealth, bot.health + 30);
                    isHealing = true;
                  }
                }
              }

              bot.strafeTimer -= dt;
              if (bot.strafeTimer <= 0) {
                bot.strafeDir *= -1;
                bot.strafeTimer = 1.2 + Math.random() * 1.4;
              }
              let moveX = -ndz * bot.strafeDir * 0.75;
              let moveZ = ndx * bot.strafeDir * 0.75;

              // Elite Squad Directives & Dynamic Behavior
              if (bot.team === 'blue' && bot.isElite) {
                const directive = squadDirectiveRef.current;
                const distToPlayer = bot.pos.distanceTo(player.pos);
                
                // Tethering Logic
                let tetherX = player.pos.x;
                let tetherZ = player.pos.z;
                
                if (directive === 'follow_lead') {
                  const pyaw = player.yaw;
                  const slotOffsets = {
                    2: { x: 3.2, z: 2.2 },   // Right flank
                    3: { x: 0.0, z: -3.8 },  // Rear guard
                    4: { x: -3.8, z: -2.0 }, // Left flank
                    5: { x: -3.2, z: 2.2 }   // Front left
                  };
                  const off = slotOffsets[bot.eliteSlot || 2] || { x: 2, z: 2 };
                  tetherX = player.pos.x + Math.sin(pyaw) * off.z + Math.cos(pyaw) * off.x;
                  tetherZ = player.pos.z + Math.cos(pyaw) * off.z - Math.sin(pyaw) * off.x;
                  
                  const dToSlot = Math.hypot(tetherX - bot.pos.x, tetherZ - bot.pos.z);
                  
                  if (distToPlayer > 14) {
                     // Hard Catch-up
                     bot.pos.x = tetherX;
                     bot.pos.z = tetherZ;
                  } else if (distToPlayer > 7.5) {
                     // Outer Sprint
                     moveX = ((tetherX - bot.pos.x) / dToSlot) * 2.0;
                     moveZ = ((tetherZ - bot.pos.z) / dToSlot) * 2.0;
                  } else if (distToPlayer > 3) {
                     // Inner Jog
                     moveX = ((tetherX - bot.pos.x) / dToSlot) * 1.3;
                     moveZ = ((tetherZ - bot.pos.z) / dToSlot) * 1.3;
                  } else {
                     // In formation
                     if (dToSlot > 1.5) {
                       moveX = (tetherX - bot.pos.x) * 0.8;
                       moveZ = (tetherZ - bot.pos.z) * 0.8;
                     }
                  }
                } else if (directive === 'hold_position') {
                  moveX *= 0.1;
                  moveZ *= 0.1; // Stay put
                } else if (directive === 'push_objective') {
                  // Push ahead of player (sector progression)
                  tetherZ = player.pos.z + 15; // Push forward
                  const dToSlot = Math.hypot(tetherX - bot.pos.x, tetherZ - bot.pos.z);
                  if (dToSlot > 2) {
                    moveX = ((tetherX - bot.pos.x) / dToSlot) * 1.5;
                    moveZ = ((tetherZ - bot.pos.z) / dToSlot) * 1.5;
                  }
                }

                // Elite Melee Combat Routine
                if (bot.meleeCooldown > 0) {
                  bot.meleeCooldown -= dt;
                } else if (dist <= 2.4) {
                  bot.meleeCooldown = 0.85;
                  if (bot.armRPivot) bot.armRPivot.rotation.x = -1.9;
                  if (targetObj && targetObj !== 'player' && targetObj.alive) {
                    damageBot(targetObj, bot.meleeDmg, false, bot);
                    flashHit(targetObj);
                    AUDIO.bulletHit.play(0.85);
                  }
                }

                // Elite Archetype Special Abilities
                if (bot.eliteRole === 'heavy') {
                  bot.fireTimer -= dt * 0.35;
                } else if (bot.eliteRole === 'medic') {
                  bot.regenAuraTimer = (bot.regenAuraTimer || 0) + dt;
                  if (bot.regenAuraTimer >= 1.0) {
                    bot.regenAuraTimer = 0;
                    if (player.alive && distToPlayer < 7.0 && player.health < player.maxHealth) {
                      player.health = Math.min(player.maxHealth, player.health + 8);
                    }
                    for (const ally of bots) {
                      if (ally.alive && ally.team === 'blue' && ally !== bot && bot.pos.distanceTo(ally.pos) < 7.0) {
                        ally.health = Math.min(ally.maxHealth, ally.health + 8);
                      }
                    }
                  }
                } else if (bot.eliteRole === 'recon') {
                  bot.reconPingTimer = (bot.reconPingTimer || 0) + dt;
                  if (bot.reconPingTimer >= 3.5) {
                    bot.reconPingTimer = 0;
                    const now = performance.now();
                    for (const hostile of bots) {
                      if (hostile.alive && (hostile.isZombie || hostile.team !== 'blue') && bot.pos.distanceTo(hostile.pos) <= 55) {
                        radarPingsRef.current.push({
                          x: hostile.pos.x,
                          z: hostile.pos.z,
                          timestamp: now,
                          duration: 2.2,
                          type: 'zombie'
                        });
                      }
                    }
                  }
                } else if (bot.eliteRole === 'engineer') {
                  if (bot.deployedCoverCooldown && bot.deployedCoverCooldown > 0) {
                    bot.deployedCoverCooldown -= dt;
                  } else if (dist <= 18) {
                    bot.deployedCoverCooldown = 25.0;
                    world.spawnDeployableCover(bot.pos, bot.facing);
                    pushKillFeed('WRENCH-5: DEPLOYED FORTIFIED COVER!');
                    AUDIO.sniperReload.play(0.65);
                  }
                }
              }

              // Non-sniper bot engagement range restricted to 45 units (90 for snipers)
              const maxEngageRange = bot.weaponType === 'sniper' ? 90 : 45;
              if (dist > maxEngageRange) {
                // Out of range: sprint/advance forward into tactical engagement range
                moveX = ndx * 1.2;
                moveZ = ndz * 1.2;
              } else {
                if (dist > bot.preferredRange + 2) { moveX += ndx; moveZ += ndz; }
                else if (dist < bot.preferredRange - 2) { moveX -= ndx; moveZ -= ndz; }
              }

              const vx = moveX * bot.speed * 0.65;
              const vz = moveZ * bot.speed * 0.65;
              bot.vel.x += (vx - bot.vel.x) * Math.min(1, dt * 6);
              bot.vel.z += (vz - bot.vel.z) * Math.min(1, dt * 6);
              world.moveEntityWithCollision(bot.pos, bot.vel, 0.38, bot.pos.y, bot.pos.y + 1.8, dt);
              bot.pos.y = world.getHighestSurface(bot.pos.x, bot.pos.z, bot.pos.y);
              bot.group.position.copy(bot.pos);
              bot.group.rotation.y = Math.atan2(dx, dz);

              if (dist <= maxEngageRange && !isHealing) {
                bot.fireTimer -= dt;
                if (bot.fireTimer <= 0) {
                const origin = bot.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                const tgtPos = targetPos || camera.position;
                const dir = new THREE.Vector3().subVectors(tgtPos, origin).normalize();
                const rc = new THREE.Raycaster(origin, dir, 0.1, 80);
                const hits = rc.intersectObjects(world.hittableObjects, false);
                let hasLoS = true;
                if (hits.length > 0) {
                  const wallDist = hits[0].distance;
                  const tgtDist = origin.distanceTo(tgtPos);
                  if (wallDist < tgtDist - 1.0) hasLoS = false;
                }

                if (hasLoS) {
                  const bDist = bot.pos.distanceTo(camera.position);
                  if (bDist <= 50) {
                    radarPingsRef.current.push({
                      x: bot.pos.x,
                      z: bot.pos.z,
                      timestamp: performance.now(),
                      duration: 1.2,
                      type: 'gunfire'
                    });
                  }

                  bot.fireTimer = (
                    bot.weaponType === 'smg' ? 0.35 :
                    bot.weaponType === 'lmg' ? 0.55 :
                    bot.weaponType === 'br' ? 0.8 :
                    bot.weaponType === 'pistol' ? 0.7 :
                    bot.weaponType === 'shotgun' ? 1.4 : 1.0
                  ) * currentDifficulty.botFireRateMult;
                  bot.muzzleFlashT = 0.07;
                  const shotVol = getSpatialVolume(camera.position, bot.pos);
                  if (bot.weaponType === 'pistol') AUDIO.pistolShot.play(shotVol);
                  else if (bot.weaponType === 'smg') AUDIO.smgFire.play(shotVol);
                  else if (bot.weaponType === 'lmg') AUDIO.lmgFire.play(shotVol);
                  else if (bot.weaponType === 'br') AUDIO.brBurst.play(shotVol);
                  else if (bot.weaponType === 'ar') AUDIO.arSingle.play(shotVol);
                  else if (bot.weaponType === 'shotgun') AUDIO.shotgunShot.play(shotVol);
                  else if (bot.weaponType === 'sniper') AUDIO.sniperShot.play(shotVol);

                  if (Math.random() < currentDifficulty.botAccuracy) {
                    let hitDmg = 12;
                    if (bot.weaponType === 'pistol') hitDmg = 14;
                    else if (bot.weaponType === 'smg') hitDmg = 10;
                    else if (bot.weaponType === 'lmg') hitDmg = 16;
                    else if (bot.weaponType === 'br') hitDmg = 18;
                    else if (bot.weaponType === 'shotgun') hitDmg = 18;
                    else if (bot.weaponType === 'sniper') hitDmg = 34;

                    const distToTgt = targetPos ? bot.pos.distanceTo(targetPos) : 20;
                    const falloff = getDamageRangeFalloff(bot.weaponType, distToTgt);
                    hitDmg *= falloff;

                    if (targetObj === 'player') applyDamageToPlayer(hitDmg * currentDifficulty.botDamageMult, false, false, bot);
                    else if (targetObj && targetObj.alive) {
                      damageBot(targetObj, hitDmg * currentDifficulty.botDamageMult, false, bot);
                      flashHit(targetObj);
                    }
                  }
                } else {
                  // No LOS, try again shortly and keep moving
                  bot.fireTimer = 0.25;
                }
              }
            }
          }

          // Health bar in screen space
          const eyePos = bot.pos.clone().add(new THREE.Vector3(0, bot.zType === 'tank' ? 2.4 : 1.8, 0)).project(camera);
          if (eyePos.z < 1 && bot.health < bot.maxHealth) {
            bot.healthEl.style.display = 'block';
            bot.healthEl.style.left = `${(eyePos.x * 0.5 + 0.5) * window.innerWidth}px`;
            bot.healthEl.style.top = `${(-eyePos.y * 0.5 + 0.5) * window.innerHeight}px`;
            bot.fillEl.style.width = `${Math.max(0, (bot.health / bot.maxHealth) * 100)}%`;
          } else {
            bot.healthEl.style.display = 'none';
          }
        }

        // Zombie wave intermission
        if (matchConfig.mode === 'zombie' && waveIntermission) {
          intermissionTimer -= dt;
          const banner = containerRef.current?.querySelector('#wave-banner') as HTMLElement | null;
          const bannerTitle = containerRef.current?.querySelector('#wave-banner-title');
          const bannerSub = containerRef.current?.querySelector('#wave-banner-sub');
          if (banner && bannerTitle && bannerSub) {
            banner.style.display = 'block';
            bannerTitle.textContent = 'WAVE COMPLETED!';
            bannerSub.textContent = `NEXT WAVE IN ${Math.max(1, Math.ceil(intermissionTimer))}...`;
          }
          if (intermissionTimer <= 0) {
            waveIntermission = false;
            if (banner) banner.style.display = 'none';
            startNextZombieWave(currentWave + 1);
          }
        }

        
        // Extraction Mechanics Update
        if (extractionPhase && gameStateRef.current === 'playing') {
          const banner = containerRef.current?.querySelector('#wave-banner');
          const bannerTitle = containerRef.current?.querySelector('#wave-banner-title');
          const bannerSub = containerRef.current?.querySelector('#wave-banner-sub');
          
          if (factionAlignmentRef.current === 'apex') {
            if (extractionState === 'mainframe_search') {
              if (banner && bannerTitle && bannerSub) {
                banner.style.display = 'block';
                bannerTitle.textContent = 'DATA HEIST: SEARCH MAINFRAME';
                bannerSub.textContent = 'LOCATE THE RED SERVER RACK';
              }
              const dist = player.pos.distanceTo(extractionTargetObj.position);
              if (dist < 4) {
                extractionState = 'hacking';
                extractionTimer = 60.0;
                pushKillFeed('HQ: LINK ESTABLISHED. HOLD POSITION FOR 60s.', true);
              }
            } else if (extractionState === 'hacking') {
              extractionTimer -= dt;
              if (banner && bannerTitle && bannerSub) {
                bannerTitle.textContent = 'DATA HEIST: HACKING';
                bannerSub.textContent = `DEFEND MAINFRAME: ${Math.ceil(extractionTimer)}s`;
              }
              const dist = player.pos.distanceTo(extractionTargetObj.position);
              if (dist > 8) {
                extractionState = 'mainframe_search';
                pushKillFeed('HQ: CONNECTION LOST. RETURN TO MAINFRAME.', true);
              }
              // Spawn runners periodically
              if (Math.random() < 0.05 * dt * 10) {
                 zombiesRemaining++;
                 makeBot(null);
              }
              if (extractionTimer <= 0) {
                extractionState = 'evac';
                pushKillFeed('HQ: DOWNLOAD COMPLETE. PROCEED TO EVAC.', true);
                extractionTargetObj.position.set((Math.random() - 0.5) * 40, 1.25, (Math.random() - 0.5) * 40);
                (extractionTargetObj.material).color.setHex(0x00ff00);
                (extractionTargetObj.material).emissive.setHex(0x004400);
              }
            } else if (extractionState === 'evac') {
              if (banner && bannerTitle && bannerSub) {
                bannerTitle.textContent = 'DATA HEIST: EVAC';
                bannerSub.textContent = 'REACH THE GREEN AIRLOCK';
              }
              const dist = player.pos.distanceTo(extractionTargetObj.position);
              if (dist < 4) {
                triggerGameOver(true);
              }
            }
          } else {
            // USMC: Bio-containment
            if (extractionState === 'cryo_search') {
              if (banner && bannerTitle && bannerSub) {
                banner.style.display = 'block';
                bannerTitle.textContent = 'BIO-CONTAINMENT: SEARCH';
                bannerSub.textContent = 'LOCATE THE BLUE CRYO-POD';
              }
              const dist = player.pos.distanceTo(extractionTargetObj.position);
              if (dist < 4) {
                extractionState = 'carrying';
                pushKillFeed('COMMAND: CRYO-POD SECURED. CARRY TO EVAC.', true);
                scene.remove(extractionTargetObj);
                
                // Spawn Evac
                const geo = new THREE.BoxGeometry(1.5, 2.5, 1.5);
                const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x004400 });
                extractionTargetObj = new THREE.Mesh(geo, mat);
                extractionTargetObj.position.set((Math.random() - 0.5) * 40, 1.25, (Math.random() - 0.5) * 40);
                scene.add(extractionTargetObj);
              }
            } else if (extractionState === 'carrying') {
              if (banner && bannerTitle && bannerSub) {
                bannerTitle.textContent = 'BIO-CONTAINMENT: CARRYING';
                bannerSub.textContent = 'CARRY ASSET TO GREEN EVAC ZONE';
              }
              
              // Apply Debuff
              player.classSpeedMultiplier = 0.5;
              if (player.slotIndex === 0 && playerWeaponState[1]) {
                // Force swap to sidearm
                switchSlot(1);
              }
              
              const dist = player.pos.distanceTo(extractionTargetObj.position);
              if (dist < 4) {
                extractionState = 'defend';
                pushKillFeed('COMMAND: PREPARING EVAC. DEFEND AGAINST TANK BOSS.', true);
                extractionTimer = 0;
              }
            } else if (extractionState === 'defend') {
              if (banner && bannerTitle && bannerSub) {
                bannerTitle.textContent = 'BIO-CONTAINMENT: DEFEND';
                bannerSub.textContent = 'ELIMINATE THE TANK BOSS';
              }
              if (!extractionTankBossSpawned) {
                extractionTankBossSpawned = true;
                const boss = makeBot(null);
                if (boss) {
                   boss.health = 3000;
                   boss.maxHealth = 3000;
                   boss.group.scale.set(1.5, 1.5, 1.5);
                   boss.flashMats.forEach(mat => {
                     mat.color.setHex(0x550000);
                   });
                   boss.isTankBoss = true;
                }
              } else {
                // Check if boss is dead
                let bossExists = false;
                for (const b of bots) {
                  if (b.isTankBoss) bossExists = true;
                }
                if (!bossExists) {
                  triggerGameOver(true);
                }
              }
            }
          }
        }

        // Storm shrink
        if (matchConfig.mode !== 'zombie') {
          storm.elapsed += dt;

          if (false && storm.elapsed >= 180) {
            triggerGameOver(true);
            return;
          }

          const t = Math.max(0, Math.min(1, (storm.elapsed - STORM_SAFE_TIME) / STORM_SHRINK_TIME));
          storm.radius = STORM_START_R - (STORM_START_R - STORM_MIN_R) * t;
          storm.mesh.scale.set(storm.radius / STORM_START_R, 1, storm.radius / STORM_START_R);

          // Continuous bot spawning to maintain counts
          if (matchConfig.mode === 'extraction') {
            let blueAlive = 0;
            for (let i = 0; i < bots.length; i++) {
              if (bots[i].alive && bots[i].team === 'blue') blueAlive++;
            }
            if (blueAlive < matchConfig.friendlyCount) makeBot('blue');
            // Hostile mutants are spawned exclusively by ExtractionGameLoop AI Director
          } else if (false) {
            let redAlive = 0;
            for (let i = 0; i < bots.length; i++) {
              if (bots[i].alive && bots[i].team === 'red') redAlive++;
            }
            if (redAlive < matchConfig.enemyCount) makeBot('red');
          } else if (false) {
            let aliveCount = 0;
            for (let i = 0; i < bots.length; i++) {
              if (bots[i].alive) aliveCount++;
            }
            if (aliveCount < matchConfig.enemyCount) makeBot();
          }
        }

        // Direct DOM update for zero React re-render, 60fps responsiveness & no screen flashing
        const tSec = Math.floor(storm.elapsed);
        const timeStr = `${String(Math.floor(tSec / 60)).padStart(2, '0')}:${String(tSec % 60).padStart(2, '0')}`;
        const zoneStr = matchConfig.mode === 'zombie' ? 'ACTIVE' : (Math.hypot(player.pos.x, player.pos.z) > storm.radius ? 'DANGER' : 'SAFE');
        const hpVal = Math.ceil(Math.max(0, player.health));
        const shVal = Math.ceil(Math.max(0, player.shield));

        const hpFillEl = containerRef.current?.querySelector('#bar-fill-health') as HTMLElement | null;
        const hpNumEl = containerRef.current?.querySelector('#bar-num-health');
        const shFillEl = containerRef.current?.querySelector('#bar-fill-shield') as HTMLElement | null;
        const shNumEl = containerRef.current?.querySelector('#bar-num-shield');
        if (hpFillEl) hpFillEl.style.width = `${Math.min(100, (hpVal / (player.maxHealth || 100)) * 100)}%`;
        if (hpNumEl) hpNumEl.textContent = `${hpVal}`;
        if (shFillEl) shFillEl.style.width = `${Math.min(100, (shVal / (player.maxShield || 100)) * 100)}%`;
        if (shNumEl) shNumEl.textContent = `${shVal}`;

        const fundsEl = containerRef.current?.querySelector('#currency-val');
        if (fundsEl) fundsEl.textContent = `$${playerPoints}`;

        const teleKills = containerRef.current?.querySelector('#telemetry-kills');
        const teleTime = containerRef.current?.querySelector('#telemetry-time');
        const teleZone = containerRef.current?.querySelector('#telemetry-zone');
        const teleDiff = containerRef.current?.querySelector('#telemetry-diff');
        if (teleKills) teleKills.textContent = `${player.kills}`;
        if (teleTime) teleTime.textContent = timeStr;
        if (teleZone) teleZone.textContent = zoneStr;
        if (teleDiff) teleDiff.textContent = currentDifficulty.label;

        const scoreBoardEl = containerRef.current?.querySelector('#match-scoreboard');
        if (scoreBoardEl) {
          if (matchConfig.mode === 'zombie') {
            scoreBoardEl.innerHTML = `<span class="score-zombie">WAVE ${currentWave}</span> <span> | </span> <span class="score-red">ZOMBIES: ${Math.max(0, zombiesRemaining)}</span>`;
          } else if (false) {
            const timeLeft = Math.max(0, 180 - storm.elapsed);
            const m = Math.floor(timeLeft / 60);
            const s = Math.floor(timeLeft % 60);
            scoreBoardEl.innerHTML = `<span class="score-blue">DEFEND VIP</span> <span> | </span> <span class="score-target-tag">(TIME: ${m}:${s < 10 ? '0' : ''}${s})</span>`;
          } else if (matchConfig.mode === 'extraction') {
            scoreBoardEl.innerHTML = '';
          } else {
            scoreBoardEl.innerHTML = `<span class="score-blue">YOU ${player.kills}</span> <span> | </span> <span class="score-target-tag">(TARGET: ${matchConfig.targetScore})</span>`;
          }
        }

        // Update DOM Crosshair recoil scale & Ammo UI directly for maximum 60fps responsiveness
        recoilKick = Math.max(0, recoilKick - 0.06);
        const cross = containerRef.current?.querySelector('#crosshair') as HTMLElement | null;
        if (cross) cross.style.transform = `translate(-50%,-50%) scale(${1 + recoilKick * 3})`;

        const activeWs = currentSlotState();
        const ammoEl = containerRef.current?.querySelector('#ammo-readout');
        const reloadTagEl = containerRef.current?.querySelector('#reload-tag');
        const weaponNameEl = containerRef.current?.querySelector('#weapon-name');

        if (weaponNameEl) weaponNameEl.textContent = curW.name;
        if (ammoEl) {
          if (curW.id === 'laser') {
            const heatPct = Math.round(activeWs.heat ?? 0);
            ammoEl.innerHTML = `${100 - heatPct}% <span class="reserve">CHARGE (HEAT ${heatPct}%)</span>`;
          } else if (curW.id === 'minigun') {
            const heatPct = Math.round(activeWs.heat ?? 0);
            ammoEl.innerHTML = `${heatPct}% <span class="reserve">HEAT (MAX 100%)</span>`;
          } else if (curW.id === 'railgun') {
            ammoEl.innerHTML = `${activeWs.ammo ?? 1} <span class="reserve">/ ${activeWs.reserve ?? 30} SLUGS</span>`;
          } else if (curW.type === 'weapon') {
            ammoEl.innerHTML = `${activeWs.ammo ?? 0} <span class="reserve">/ ${activeWs.reserve ?? 0}</span>`;
          } else if (curW.type === 'grenade') {
            ammoEl.innerHTML = `${activeWs.count ?? 0} <span class="reserve">GRENADES</span>`;
          } else {
            ammoEl.innerHTML = `${activeWs.count ?? 0} <span class="reserve">MINIS</span>`;
          }
        }
        if (reloadTagEl) {
          if (curW.id === 'laser') {
            reloadTagEl.textContent = activeWs.overheated
              ? 'OVERHEATED! [R] TO VENT'
              : (activeWs.reloading ? 'VENTING CORE…' : (player.fireHeld ? 'FIRING CONTINUOUS BEAM' : ''));
          } else if (curW.id === 'minigun') {
            reloadTagEl.textContent = activeWs.overheated
              ? `OVERHEATED! VENTING ${(activeWs.ventTimer ?? 0).toFixed(1)}s`
              : ((activeWs.spinWarmup ?? 0) > 0 && (activeWs.spinWarmup ?? 0) < 0.5
                ? 'SPINNING UP BARRELS...'
                : (player.fireHeld && (activeWs.spinWarmup ?? 0) >= 0.5 ? 'FIRING HYPER-AUTO' : 'HOLD LMB TO SPIN & FIRE'));
          } else if (curW.id === 'railgun') {
            reloadTagEl.textContent = activeWs.reloading
              ? 'RELOADING SLUG...'
              : (activeWs.charging
                ? `CHARGING RAILGUN ${Math.round(((activeWs.chargeTimer ?? 0) / 1.2) * 100)}%`
                : 'HOLD LMB (1.2s) TO FIRE PIERCING SLUG');
          } else if (curW.type === 'weapon') {
            reloadTagEl.textContent = activeWs.reloading ? 'RELOADING…' : '';
          } else if (curW.type === 'grenade') {
            reloadTagEl.textContent = 'LMB OR [G] TO THROW';
          } else {
            reloadTagEl.textContent = player.isDrinking ? `DRINKING ${player.drinkTimer.toFixed(1)}s` : 'LMB OR [X] TO DRINK';
          }
        }

        // Highlight selected inventory slot across the 3 locked loadout assets
        for (let s = 0; s < 3; s++) {
          const slotEl = containerRef.current?.querySelector(`#slot-${s + 1}`);
          if (slotEl) {
            slotEl.classList.toggle('selected', player.slotIndex === s);
            const labelEl = slotEl.children[1] as HTMLElement;
            if (labelEl) {
              const itemW = playerLoadout[s];
              const itemWs = playerWeaponState[s];
              if (!itemW || !itemWs) continue;
              if (itemW.type === 'grenade') labelEl.textContent = `GRENADES (x${itemWs?.count ?? 0})`;
              else if (itemW.id === 'laser') labelEl.textContent = `LASER (${Math.round(itemWs?.heat ?? 0)}%)`;
              else if (itemW.id === 'minigun') labelEl.textContent = `MINIGUN (${Math.round(itemWs?.heat ?? 0)}%)`;
              else if (itemW.id === 'railgun') labelEl.textContent = `RAILGUN (${itemWs?.ammo ?? 0})`;
              else labelEl.textContent = `${itemW.name.toUpperCase()} (${itemWs?.ammo ?? 0})`;
            }
          }
        }

        // Update compass
        const deg = ((player.yaw * 180 / Math.PI) % 360 + 360) % 360;
        const strip = containerRef.current?.querySelector('#compass-strip') as HTMLElement | null;
        if (strip) {
          const pxPerDeg = 40 / 45;
          strip.style.left = `${140 - deg * pxPerDeg}px`;
        }

        if (lobbyAvatar) lobbyAvatar.group.visible = false;
        hudSyncTimer += dt;
        if (hudSyncTimer >= 0.05) {
          hudSyncTimer = 0;
          setHudData({
            health: Math.max(0, Math.ceil(player.health)),
            maxHealth: player.maxHealth,
            shield: Math.max(0, Math.ceil(player.shield)),
            maxShield: player.maxShield,
            currentWeapon: curW,
            weaponSlotState: { ...activeWs },
            slotIndex: player.slotIndex,
            playerLoadout: [...playerLoadout],
            playerLoadoutStates: playerWeaponState.map(s => ({ ...s })),
            playerPos: { x: player.pos.x, z: player.pos.z },
            playerYaw: player.yaw,
            kills: player.kills,
            timeStr: `${String(Math.floor(Math.floor(storm.elapsed) / 60)).padStart(2, '0')}:${String(Math.floor(storm.elapsed) % 60).padStart(2, '0')}`,
            zoneStatus: matchConfig.mode === 'zombie' ? 'ACTIVE' : (Math.hypot(player.pos.x, player.pos.z) > storm.radius ? 'DANGER' : 'SAFE'),
            blueScore: teamScoreBlue,
            redScore: teamScoreRed,
            targetScore: matchConfig.targetScore,
            currentWave,
            zombiesRemaining: Math.max(0, zombiesRemaining)
          });
        }
      } else if (gameStateRef.current === 'start') {
        if (!hangarGroup || !lobbyAvatar) {
          setupLobbyScene();
        }
        combatLightGroup.visible = false;
        if (hangarGroup) hangarGroup.visible = true;
        scene.background = new THREE.Color(0x0a0d12);
        scene.fog = lobbyFog;

        vmManager.root.visible = false;
        if (lobbyAvatar) {
          lobbyAvatar.group.visible = true;
          const t = performance.now() * 0.001;
          lobbyAvatar.update(t);
          lobbyAvatar.setFaction(factionAlignmentRef.current);
          lobbyAvatar.setGearTier(gearTierRef.current);
          lobbyAvatar.setVisor(visorTypeRef.current);
          
          // Pass locker cosmetic configs
          const h = localStorage.getItem('gun_arena_headgear') as import('./FactionContext').HeadgearOption || 'fast';
          const tConf = localStorage.getItem('gun_arena_torso') as import('./FactionContext').TorsoOption || 'chest_rig';
          const lConf = localStorage.getItem('gun_arena_lower') as import('./FactionContext').LowerOption || 'pouches';
          
          lobbyAvatar.setHeadgear(h);
          lobbyAvatar.setTorsoConfig(tConf);
          lobbyAvatar.setLowerConfig(lConf);
          
          lobbyAvatar.setWeapon(selectedPrimaryRef.current);

          // Position camera directly in front of the operator in the subterranean bunker at Y=1000!
          const swayX = Math.sin(t * 0.3) * 0.06;
          const swayY = Math.cos(t * 0.4) * 0.02;
          camera.position.set(swayX, 1000 + 1.25 + swayY, 2.65);
          camera.lookAt(0, 1000 + 1.10, 0);
        }
      } else {
        if (lobbyAvatar) lobbyAvatar.group.visible = false;
        vmManager.root.visible = false;
      }

      renderer.render(scene, camera);
    }
    let hudSyncTimer = 0;
    animate();

    // Setup compass DOM once
    const compassStrip = containerRef.current?.querySelector('#compass-strip');
    if (compassStrip && compassStrip.children.length === 0) {
      const labels = ['N', '', 'E', '', 'S', '', 'W', ''];
      let html = '';
      for (let cycle = 0; cycle < 2; cycle++) {
        for (let d = 0; d < 360; d += 45) {
          const idx = d / 45;
          html += `<span class="${labels[idx] ? 'card' : ''}">${labels[idx] || d}</span>`;
        }
      }
      compassStrip.innerHTML = html;
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
      bottomCenterEl?.removeEventListener('click', onBottomCenterClick as EventListener);
      lobbyAvatar?.destroy();
      world?.dispose();
      botHealthLayer?.remove();
      renderer?.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-screen max-h-screen select-none overflow-hidden font-mono bg-black text-[#e8edf0]">
      {/* 3D Viewport */}
      <div id="viewport" className="absolute inset-0 z-0" />

      {/* Halo-Style Diegetic Helmet Visor HUD Layer */}
      {gameState === 'playing' && (
        <>
          <div id="vignette" />
          <div id="stormvignette" />

          {/* Tactical Pause Quick Button */}
          <div className="absolute top-4 left-6 z-40 flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => {
                setGameState('paused');
                AUDIO.arSpray.stop();
                if (document.pointerLockElement) {
                  try { document.exitPointerLock?.(); } catch {}
                }
              }}
              className="px-3 py-1 text-xs text-[#2de2e6] bg-black/80 hover:bg-[#2de2e6]/20 cursor-pointer flex items-center gap-1.5 border border-[#2de2e6]/50 rounded-xs shadow-lg backdrop-blur-md transition-colors"
            >
              <span>⏸ PAUSE</span>
              <span className="text-[10px] text-[#8b98a1]">(ESC / P)</span>
            </button>
          </div>

          {/* Dynamic Squad Command Visor HUD & Companion Matrix */}
          {(matchMode === 'extraction' || matchMode === 'zombie') && (
            <div className="absolute top-14 left-6 z-40 pointer-events-none flex flex-col gap-1.5 font-mono">
              <div className="flex flex-col gap-1 px-3 py-1.5 bg-black/80 border border-[#2de2e6]/50 backdrop-blur-md rounded-xs shadow-[0_0_12px_rgba(45,226,230,0.25)]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#2de2e6] tracking-widest font-bold">SQUAD POSTURE [Z]</span>
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                    {squadDirective === 'follow_lead' && '⚡ FOLLOW LEAD (TETHER)'}
                    {squadDirective === 'hold_position' && '🛡️ HOLD POSITION (ANCHOR)'}
                    {squadDirective === 'push_objective' && '🎯 PUSH OBJECTIVE (ADVANCE)'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-400">
                  <span>[X] TARGET LOCK</span>
                  <span>|</span>
                  <span>[C] PUSH OBJ</span>
                  <span>|</span>
                  <span>[4] MEDKIT (+50 HP)</span>
                </div>
              </div>
              {deploymentProtocol === 'elite' && (
                <div className="flex items-center gap-2 px-2.5 py-1 bg-black/70 border border-[#2de2e6]/25 backdrop-blur-sm rounded-xs text-[9px]">
                  <span className="text-[#2de2e6] font-bold tracking-wider">TASK FORCE:</span>
                  <span className="text-[#8b98a1]">S2 [HEAVY]</span>
                  <span className="text-[#2de2e6]">•</span>
                  <span className="text-[#00e5ff]">S3 [MEDIC]</span>
                  <span className="text-[#2de2e6]">•</span>
                  <span className="text-[#8b98a1]">S4 [RECON]</span>
                  <span className="text-[#2de2e6]">•</span>
                  <span className="text-[#8b98a1]">S5 [ENG]</span>
                </div>
              )}
            </div>
          )}

          {/* Tactical Directive Center Visor Banner */}
          {squadDirectiveBanner && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center justify-center animate-pulse">
              <div className="px-6 py-2 bg-black/90 border-2 border-[#2de2e6] shadow-[0_0_25px_rgba(45,226,230,0.55)] rounded-xs flex flex-col items-center">
                <div className="text-[10px] font-bold tracking-[0.25em] text-[#2de2e6] uppercase">
                  SQUAD DIRECTIVE TRANSMITTED
                </div>
                <div className="text-xl font-black tracking-widest text-white uppercase mt-0.5">
                  {squadDirectiveBanner.text}
                </div>
                <div className="text-[10px] tracking-wider text-[#8b98a1] mt-0.5">
                  {squadDirectiveBanner.sub}
                </div>
              </div>
            </div>
          )}

          {/* Subterranean Extraction Custom Tactical Objective HUD */}
          {matchMode === 'extraction' && extractionState && (
            <ExtractionObjectiveHUD
              state={extractionState}
              timeStr={hudData.timeStr}
              kills={hudData.kills}
            />
          )}

          {/* Diegetic Visor Helmet Overlay with Motion Tracker and Munitions Matrix */}
          <HelmetHUD
            visorType={visorType}
            gearTier={gearTier}
            health={hudData.health}
            maxHealth={hudData.maxHealth}
            shield={hudData.shield}
            maxShield={hudData.maxShield}
            currentWeapon={hudData.currentWeapon}
            weaponSlotState={hudData.weaponSlotState}
            slotIndex={hudData.slotIndex}
            playerLoadout={hudData.playerLoadout}
            playerLoadoutStates={hudData.playerLoadoutStates}
            matchMode={matchMode}
            factionAlignment={factionAlignment}
            blueScore={hudData.blueScore}
            redScore={hudData.redScore}
            targetScore={hudData.targetScore}
            currentWave={hudData.currentWave}
            zombiesRemaining={hudData.zombiesRemaining}
            kills={hudData.kills}
            timeStr={hudData.timeStr}
            zoneStatus={hudData.zoneStatus}
            playerPos={hudData.playerPos}
            playerYaw={hudData.playerYaw}
            radarPingsRef={radarPingsRef}
          />

          {/* In-Game 1st-Person Combat FX: Crosshair, Scope, Hitmarker, Pickups, Killfeed */}
          <div id="crosshair" style={{ borderColor: targetingPhase ? '#ff4444' : 'rgba(255,255,255,0.7)' }}>
            {targetingPhase && <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', color: '#ff4444', fontSize: 12, fontWeight: 'bold', textShadow: '0 0 4px red', whiteSpace: 'nowrap' }}>[ PHASE 1: TARGETING ]</div>}
            <div className="tick t" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
            <div className="tick b" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
            <div className="tick l" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
            <div className="tick r" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
            <div className="dot" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
          </div>
          <div id="scope-overlay">
            <div id="scope-hole">
              <div id="scope-dot" />
            </div>
          </div>
          <div id="hitmarker">
            <div className="l1" />
            <div className="l2" />
          </div>
          <div id="melee-arm" />
          <div id="pickup-prompt">[E] PICK UP</div>
          <div id="killfeed" />
        </>
      )}

      {/* 1v1.lol Inspired Tabbed Main Menu Lobby */}
      {gameState === 'start' && (
        <LobbyTerminal
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          factionAlignment={factionAlignment}
          setFactionAlignment={setFactionAlignment}
          visorType={visorType}
          setVisorType={setVisorType}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          selectedPrimary={selectedPrimary}
          setSelectedPrimary={setSelectedPrimary}
          selectedSecondary={selectedSecondary}
          setSelectedSecondary={setSelectedSecondary}
          matchMode={matchMode}
          setMatchMode={setMatchMode}
          friendlyCount={friendlyCount}
          setFriendlyCount={setFriendlyCount}
          enemyCount={enemyCount}
          setEnemyCount={setEnemyCount}
          targetScore={targetScore}
          setTargetScore={setTargetScore}
          difficultyKey={difficultyKey}
          setDifficultyKey={setDifficultyKey}
          selectedMapState={selectedMapState}
          setSelectedMapState={setSelectedMapState}
          isDevMode={isDevMode}
          setIsDevMode={setIsDevMode}
          deploymentProtocol={deploymentProtocol}
          setDeploymentProtocol={setDeploymentProtocol}
          eliteSquad={eliteSquad}
          setEliteSquad={setEliteSquad}
          onDeploy={() => deployHandlerRef.current?.()}
          showAudioHelper={showAudioHelper}
          setShowAudioHelper={setShowAudioHelper}
        />
      )}

      {/* Pause Screen */}
      <div className={`overlay ${gameState === 'paused' ? '' : 'hidden'}`}>
        <div className="overlay-box panel" style={{ width: '420px' }}>
          <div className="overlay-title" style={{ fontSize: '22px' }}>PAUSED</div>
          <div className="overlay-sub">SYSTEM STANDBY</div>
          <div className="cfg-row mb-4">
            <label>SENSITIVITY</label>
            <input
              type="range"
              min="4"
              max="30"
              value={sensitivityVal}
              onChange={(e) => setSensitivityVal(parseInt(e.target.value, 10))}
            />
            <span className="val-display">{sensitivityVal}</span>
          </div>
          <div className="btn" id="btn-resume" onClick={() => resumeHandlerRef.current?.()}>RESUME MATCH</div>
          <div className="btn secondary" id="btn-to-lobby-pause" onClick={() => lobbyHandlerRef.current?.()}>RETURN TO LOBBY</div>
          <div className="mt-3 text-center">
            <a
              href="https://ais-dev-mlmvjg57dudsycsch4poan-271150104517.asia-southeast1.run.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#57d1c9] hover:underline inline-flex items-center gap-1"
            >
              <span>Play in Separate Full Tab</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Subterranean Extraction Dedicated Debrief / End Screen */}
      {gameState === 'DEATH_SCREEN' && matchMode === 'extraction' && extractionState && (
        <ExtractionEndScreen
          isVictory={endResult.victory}
          state={extractionState}
          kills={stats.kills}
          accuracyPct={stats.accuracyPct ?? 0}
          headshotPct={stats.headshotPct ?? 0}
          timeStr={stats.time || '00:00'}
          onRedeploy={() => restartHandlerRef.current?.()}
          onLobby={() => lobbyHandlerRef.current?.()}
        />
      )}

      {/* Match Result Post-Scoreboard Matrix Screen with Interactive Faction Career Rewards Ledger */}
      <div className={`overlay ${(gameState === 'DEATH_SCREEN' && matchMode !== 'extraction') ? '' : 'hidden'}`}>
        <div className="overlay-box panel" style={{ width: '560px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
          <div className={`overlay-title text-center text-3xl font-bold tracking-wider ${endResult.victory ? 'text-[#57d1c9]' : 'text-[#e0473f]'}`}>
            {endResult.title}
          </div>
          <div className="overlay-sub text-center mb-3">{endResult.sub}</div>

          {/* Interactive Faction Career Rewards Breakdown Ledger */}
          {matchRewards && (
            <div className="mb-4 p-3 bg-gradient-to-b from-[#141d24] to-[#0d1217] rounded-lg border border-[#2de2e6]/30 shadow-lg text-left">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2de2e6] animate-ping" />
                  <span className="text-xs font-extrabold tracking-wider text-white uppercase">
                    FACTION CAREER LEDGER // POST-MATCH REWARDS
                  </span>
                </div>
                <div className="text-[10px] font-bold text-[#f5a623] px-2 py-0.5 bg-[#f5a623]/10 border border-[#f5a623]/30 rounded">
                  {getRankTitle(matchRewards.newRank).badge} • {getRankTitle(matchRewards.newRank).title}
                </div>
              </div>

              {/* Reward Items Breakdown */}
              <div className="space-y-1.5 text-xs">
                {/* 1. Bot Eliminations */}
                <div className="flex justify-between items-center bg-black/40 px-2.5 py-1.5 rounded border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8b98a1]">Hostile Eliminations ({matchRewards.kills}x)</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-[#2de2e6] font-bold">+{matchRewards.killXp} XP</span>
                    <span className="text-[#f5a623] font-bold">+${matchRewards.killFunds}</span>
                  </div>
                </div>

                {/* 2. Zombie Wave Milestones */}
                {matchRewards.wavesCleared > 0 && (
                  <div className="flex justify-between items-center bg-black/40 px-2.5 py-1.5 rounded border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-[#8b98a1]">Wave Milestones Survived ({matchRewards.wavesCleared}x)</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-[#2de2e6] font-bold">+{matchRewards.waveXp} XP</span>
                      <span className="text-[#f5a623] font-bold">+${matchRewards.waveFunds}</span>
                    </div>
                  </div>
                )}

                {/* 3. Victory Bonus */}
                {matchRewards.victory && (
                  <div className="flex justify-between items-center bg-[#57d1c9]/10 px-2.5 py-1.5 rounded border border-[#57d1c9]/30">
                    <div className="flex items-center gap-2">
                      <span className="text-[#57d1c9] font-bold">★ OPERATION VICTORY BONUS</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-[#2de2e6] font-bold">+{matchRewards.victoryXp} XP</span>
                      <span className="text-[#f5a623] font-bold">+${matchRewards.victoryFunds}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Total Earned Summary & Rank Progress Bar */}
              <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-col gap-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-[11px] font-bold tracking-wider text-[#8b98a1]">TOTAL MATCH EARNED:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-[#2de2e6]">+{matchRewards.totalXpEarned} XP</span>
                    <span className="text-sm font-extrabold text-[#f5a623]">+${matchRewards.totalFundsEarned}</span>
                  </div>
                </div>

                {/* Rank Up Announcement Banner if leveled up */}
                {matchRewards.leveledUp && (
                  <div className="p-2 bg-gradient-to-r from-[#2de2e6]/20 via-[#00ff66]/20 to-[#2de2e6]/20 border border-[#00ff66]/40 rounded text-center animate-pulse">
                    <span className="text-xs font-black tracking-widest text-[#00ff66] uppercase">
                      RANK PROMOTION ACHIEVED: RANK {matchRewards.newRank} // {getRankTitle(matchRewards.newRank).title}
                    </span>
                  </div>
                )}

                {/* Rank Tier Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[#8b98a1] font-mono">
                    <span>PROGRESSION: TIER {matchRewards.newRank} (RANK {matchRewards.newRank}/50)</span>
                    <span className="text-white font-bold">{matchRewards.newXp} TOTAL XP</span>
                  </div>
                  <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                    {(() => {
                      const curRankMin = getXpForRank(matchRewards.newRank);
                      const nextRankMin = getXpForRank(matchRewards.newRank + 1);
                      const rankSpan = Math.max(1, nextRankMin - curRankMin);
                      const pct = Math.min(100, Math.max(0, Math.round(((matchRewards.newXp - curRankMin) / rankSpan) * 100)));
                      return (
                        <div
                          className="h-full bg-gradient-to-r from-[#2de2e6] to-[#00ff66] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Combat Matrix Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-black/40 rounded-lg border border-white/10">
            <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Combat Score</span>
              <span className="text-2xl font-bold text-[#57d1c9]">{stats.combatScore ?? 0}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Eliminations</span>
              <span className="text-2xl font-bold text-white">{stats.kills}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Headshot %</span>
              <span className="text-xl font-bold text-[#f5a623]">{stats.headshotPct ?? 0}%</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Accuracy</span>
              <span className="text-xl font-bold text-blue-400">{stats.accuracyPct ?? 0}%</span>
            </div>
          </div>

          <div className="stat-row"><span className="label">Total Damage Dealt</span><span className="text-red-400 font-semibold">{stats.damageDealt ?? 0} HP</span></div>
          
          {matchMode === 'zombie' && (
            <>
              <div className="stat-row"><span className="label">Waves Survived</span><span className="text-emerald-400 font-semibold">{stats.wavesCleared ?? 0} Waves</span></div>
              <div className="stat-row"><span className="label">In-Match Points</span><span className="text-[#f5a623] font-semibold">${stats.funds}</span></div>
            </>
          )}

          <div className="stat-row"><span className="label">Operation Time</span><span className="font-mono">{stats.time}</span></div>

          <div className="btn mt-4" id="btn-restart-end" onClick={() => restartHandlerRef.current?.()}>RESPAWN / RETRY MISSION</div>
          <div className="btn secondary" id="btn-to-lobby-end" onClick={() => lobbyHandlerRef.current?.()}>RETURN TO MAIN MENU</div>
          <div className="mt-3 text-center">
            <a
              href="https://ais-dev-mlmvjg57dudsycsch4poan-271150104517.asia-southeast1.run.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#57d1c9] hover:underline inline-flex items-center gap-1"
            >
              <span>Play in Separate Full Tab</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
