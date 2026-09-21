import * as THREE from 'three';
import { WorldManager } from './world';
import { buildTripodMachineGun, buildRegenFieldMesh, buildTelemetryMarker } from './botBuilder';
import {
  Bot,
  MutantType,
  ToxicPuddle,
  Sector4ObjectiveType,
  WorldCollider,
  SquadDirective,
  TacticalAIState,
  CoverPoint,
  createTacticalState,
  TACTICAL_TUNING,
  SWARM_TUNING,
  ActiveProjectile,
  ArsenalWeaponDef,
  ARSENAL,
  WeaponID,
  DeployedTripod,
  MountedGunSession,
  RegenField,
  TelemetryMark,
  TRIPOD_MOUNT_RADIUS,
  TRIPOD_FIRE_INTERVAL,
  TRIPOD_MOUNT_COOLDOWN,
  TRIPOD_DAMAGE,
  TRIPOD_HEADSHOT_MULT,
  TRIPOD_RANGE,
  TRIPOD_TRAVERSE_LIMIT,
  TRIPOD_MAX_HEAT,
  TRIPOD_HEAT_PER_SHOT,
  TRIPOD_COOL_RATE,
  TRIPOD_BUILD_COOLDOWN,
  TRIPOD_MAX_ACTIVE,
  REGEN_FIELD_RADIUS,
  REGEN_FIELD_HPS,
  REGEN_FIELD_DURATION,
  REGEN_FIELD_COOLDOWN,
  MEDIC_LEASH_DISTANCE,
  TELEMETRY_PING_INTERVAL,
  TELEMETRY_PING_RADIUS,
  TELEMETRY_MARK_DURATION
} from './types';

export type { ToxicPuddle };

/* =============================================================================
 * SHARED GEOMETRY HELPERS
 * ===========================================================================*/

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

const PLAYER_BODY_RADIUS = 0.42;
const PLAYER_BODY_HEIGHT = 1.8;

/** 2D slab test: does segment (x1,z1)->(x2,z2) intersect the XZ box? */
export function segmentIntersectsAABB2D(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;

  if (Math.abs(dx) < 1e-6) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    const inv = 1 / dx;
    let t1 = (minX - x1) * inv;
    let t2 = (maxX - x1) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dz) < 1e-6) {
    if (z1 < minZ || z1 > maxZ) return false;
  } else {
    const inv = 1 / dz;
    let t1 = (minZ - z1) * inv;
    let t2 = (maxZ - z1) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}

/** True when hard geometry sits between the two points at chest height. */
export function sightlineBlocked(
  from: THREE.Vector3,
  to: THREE.Vector3,
  colliders: WorldCollider[],
  eyeHeight = 1.45
): boolean {
  const y = Math.min(from.y, to.y) + eyeHeight;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.active === false || c.isDoor || c.isStair || c.isRamp) continue;
    if (y < c.minY || y > c.maxY) continue;
    if (segmentIntersectsAABB2D(from.x, from.z, to.x, to.z, c.minX, c.maxX, c.minZ, c.maxZ)) {
      return true;
    }
  }
  return false;
}

/** Sweeps candidate headings until one is clear for castDist metres. */
export function steerAroundObstacles(
  originX: number,
  originZ: number,
  desiredDx: number,
  desiredDz: number,
  colliders: WorldCollider[],
  radius = 0.42,
  castDist = 2.6
): { dx: number; dz: number } {
  const baseAngle = Math.atan2(desiredDx, desiredDz);
  const offsets = [
    0,
    Math.PI / 7,
    -Math.PI / 7,
    Math.PI / 3.5,
    -Math.PI / 3.5,
    Math.PI / 2.2,
    -Math.PI / 2.2,
    Math.PI * 0.72,
    -Math.PI * 0.72
  ];

  for (let i = 0; i < offsets.length; i++) {
    const angle = baseAngle + offsets[i];
    const tdx = Math.sin(angle);
    const tdz = Math.cos(angle);
    const endX = originX + tdx * castDist;
    const endZ = originZ + tdz * castDist;

    let blocked = false;
    for (let j = 0; j < colliders.length; j++) {
      const c = colliders[j];
      if (c.active === false || c.isDoor || c.isStair || c.isRamp) continue;
      if (
        segmentIntersectsAABB2D(
          originX,
          originZ,
          endX,
          endZ,
          c.minX - radius,
          c.maxX + radius,
          c.minZ - radius,
          c.maxZ + radius
        )
      ) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return { dx: tdx, dz: tdz };
  }

  return { dx: desiredDx, dz: desiredDz };
}

/** AABB overlap between two axis-aligned boxes. */
function aabbOverlap(
  aMinX: number, aMaxX: number, aMinY: number, aMaxY: number, aMinZ: number, aMaxZ: number,
  bMinX: number, bMaxX: number, bMinY: number, bMaxY: number, bMinZ: number, bMaxZ: number
): boolean {
  return (
    aMinX <= bMaxX && aMaxX >= bMinX &&
    aMinY <= bMaxY && aMaxY >= bMinY &&
    aMinZ <= bMaxZ && aMaxZ >= bMinZ
  );
}

function botColliderRadius(bot: Bot): number {
  if (bot.isZombie) {
    if (bot.zType === 'brute' || bot.zType === 'tank') return 0.9;
    if (bot.zType === 'megaboss') return 1.1;
    if (bot.zType === 'bloater') return 0.55;
    if (bot.zType === 'runner') return 0.35;
    return 0.38;
  }
  return 0.42;
}

function botColliderHeight(bot: Bot): number {
  if (bot.isZombie) {
    if (bot.zType === 'brute' || bot.zType === 'tank') return 2.2;
    if (bot.zType === 'megaboss') return 2.8;
    if (bot.zType === 'bloater') return 1.7;
    if (bot.zType === 'banshee') return 2.0;
    if (bot.zType === 'runner') return 1.3;
    return 1.8;
  }
  return 1.8;
}

/* =============================================================================
 * EXTRACTION MISSION DIRECTOR (preserved)
 * ===========================================================================*/

export type ExtractionFaction = 'usmc' | 'apex';

export type ExtractionStage =
  | 'INFILTRATE'
  | 'OBJECTIVE_ACTIVE'
  | 'HACKING'
  | 'PROCEED_EVAC'
  | 'BOSS_ENCOUNTER'
  | 'EVAC_READY'
  | 'COMPLETED';

export interface ExtractionState {
  faction: ExtractionFaction;
  currentSector: 1 | 2 | 3 | 4 | 5;
  stage: ExtractionStage;
  objectiveTitle: string;
  objectiveDetail: string;
  hasBioCylinder: boolean;
  mainframeHacked: boolean;
  hackProgress: number;
  hackDuration: number;
  isHacking: boolean;

  sector4ObjectiveType: Sector4ObjectiveType;
  holdTheLineTimer: number;
  holdTheLineTotal: number;
  holdTheLineActive: boolean;
  holdTheLineComplete: boolean;

  breakerAlphaPulled: boolean;
  breakerBetaPulled: boolean;
  reactorOverrideComplete: boolean;

  volatileContainerDeposited: boolean;

  hasArmoryKeycard: boolean;
  armoryKeycardDropped: boolean;
  armoryDoorOpened: boolean;
  armoryCrateOpened: boolean;

  bossSpawned: boolean;
  bossDefeated: boolean;
  evacReady: boolean;
  mutantsKilled: number;
  missionDuration: number;
}

export interface ExtractionManagerConfig {
  faction: ExtractionFaction;
  player: {
    pos: THREE.Vector3;
    yaw: number;
    health: number;
    shield: number;
    kills: number;
  };
  world: WorldManager;
  scene: THREE.Scene;
  makeBot: (team: 'blue' | 'red' | 'zombie' | null, zType?: string, isVIP?: boolean, elite?: any) => any;
  bots: any[];
  pushKillFeed: (msg: string, isPriority?: boolean) => void;
  onVictory: () => void;
  onDefeat: () => void;
}

export class ExtractionGameLoop {
  public state: ExtractionState;
  private config: ExtractionManagerConfig;
  private spawnTimer: number = 2.5;
  private convergeTimer: number = 0;
  private megaBossBot: any = null;
  private armoryKeycardGroup: THREE.Group | null = null;

  constructor(config: ExtractionManagerConfig) {
    this.config = config;

    const objTypes: Sector4ObjectiveType[] = ['HOLD_THE_LINE', 'VOLATILE_CONTAINER', 'REACTOR_OVERRIDE'];
    const chosenObjType = objTypes[Math.floor(Math.random() * objTypes.length)];

    const initialTitle =
      chosenObjType === 'HOLD_THE_LINE'
        ? 'SECTOR 4: INITIATE MAINFRAME LOCKDOWN'
        : chosenObjType === 'VOLATILE_CONTAINER'
        ? 'PRIMARY OBJECTIVE: SECURE VOLATILE CANISTER'
        : 'SECTOR 4: DUAL REACTOR CIRCUIT OVERRIDE';

    const initialDetail =
      chosenObjType === 'HOLD_THE_LINE'
        ? 'Infiltrate deep facility. Prepare to defend Sector 4 Mainframe console for 45s.'
        : chosenObjType === 'VOLATILE_CONTAINER'
        ? 'Retrieve leaking volatile Bio-Canister in Sector 3 and transport to Sector 5 Decon Receptacle.'
        : 'Infiltrate Sector 4 and engage Circuit Breaker Alpha and Beta to restore power to Sector 5 airlock.';

    this.state = {
      faction: config.faction,
      currentSector: 1,
      stage: 'INFILTRATE',
      objectiveTitle: initialTitle,
      objectiveDetail: initialDetail,
      hasBioCylinder: false,
      mainframeHacked: false,
      hackProgress: 0,
      hackDuration: 10.0,
      isHacking: false,

      sector4ObjectiveType: chosenObjType,
      holdTheLineTimer: 45.0,
      holdTheLineTotal: 45.0,
      holdTheLineActive: false,
      holdTheLineComplete: false,

      breakerAlphaPulled: false,
      breakerBetaPulled: false,
      reactorOverrideComplete: false,

      volatileContainerDeposited: false,

      hasArmoryKeycard: false,
      armoryKeycardDropped: false,
      armoryDoorOpened: false,
      armoryCrateOpened: false,

      bossSpawned: false,
      bossDefeated: false,
      evacReady: false,
      mutantsKilled: 0,
      missionDuration: 0
    };
  }

  public update(dt: number, keys: Record<string, boolean>): {
    interactionPrompt: string | null;
    isPromptObjective: boolean;
  } {
    this.state.missionDuration += dt;
    const playerPos = this.config.player.pos;

    let sector: 1 | 2 | 3 | 4 | 5 = 1;
    if (playerPos.z > -20) sector = 1;
    else if (playerPos.z > -60) sector = 2;
    else if (playerPos.z > -100) sector = 3;
    else if (playerPos.z > -140) sector = 4;
    else sector = 5;
    this.state.currentSector = sector;

    let interactionPrompt: string | null = null;
    let isPromptObjective = false;

    if (this.config.world.bioCylinderGroup && !this.state.hasBioCylinder) {
      this.config.world.bioCylinderGroup.rotation.y += dt * 1.8;
      this.config.world.bioCylinderGroup.position.y = 1.2 + Math.sin(this.state.missionDuration * 3.5) * 0.08;
    }

    if (this.armoryKeycardGroup && !this.state.hasArmoryKeycard) {
      this.armoryKeycardGroup.rotation.y += dt * 3.2;
      this.armoryKeycardGroup.position.y = 0.45 + Math.sin(this.state.missionDuration * 4.0) * 0.08;
      const distToCard = Math.hypot(
        playerPos.x - this.armoryKeycardGroup.position.x,
        playerPos.z - this.armoryKeycardGroup.position.z
      );
      if (distToCard < 2.8) {
        interactionPrompt = '[E] RETRIEVE ARMORY SECURITY KEYCARD';
        isPromptObjective = true;
        if (keys['KeyE']) {
          keys['KeyE'] = false;
          this.state.hasArmoryKeycard = true;
          this.config.scene.remove(this.armoryKeycardGroup);
          this.armoryKeycardGroup = null;
          this.config.pushKillFeed('SECURITY KEYCARD SECURED! ACCESS AUTHORIZED TO SECTOR 3 ARMORY.', true);
        }
      }
    }

    if (this.state.currentSector === 3 || playerPos.x >= 7.5) {
      const distToArmoryCrate = Math.hypot(playerPos.x - 13.0, playerPos.z - -80.0);
      if (distToArmoryCrate < 3.2 && !this.state.armoryCrateOpened) {
        interactionPrompt = '[E] OPEN HIGH-TIER MUNITIONS CRATE';
        isPromptObjective = true;
        if (keys['KeyE']) {
          keys['KeyE'] = false;
          this.state.armoryCrateOpened = true;
          this.config.player.health = 100;
          this.config.player.shield = 100;

          if (this.config.world.armoryCrateGroup) {
            this.config.world.armoryCrateGroup.traverse((c) => {
              if (
                (c as THREE.Mesh).isMesh &&
                ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive
              ) {
                (((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive as THREE.Color).setHex(0x00ff88);
              }
            });
          }

          this.config.world.createGroundPickup(12.5, -81.5, 0, 90);
          this.config.world.createGroundPickup(13.5, -78.5, 5, 120);

          this.config.pushKillFeed('ARMORY LOOT CLAIMED: +100 HP, +100 SHIELD, FULL MUNITIONS CACHE!', true);
        }
      }
    }

    const sec4Type = this.state.sector4ObjectiveType;

    if (sec4Type === 'HOLD_THE_LINE') {
      if (!this.state.holdTheLineComplete) {
        const distToConsole = Math.hypot(playerPos.x - 0, playerPos.z - -120);
        if (!this.state.holdTheLineActive) {
          if (distToConsole < 4.0) {
            interactionPrompt = '[E] INITIATE 45s MAINFRAME LOCKDOWN DEFENSE';
            isPromptObjective = true;
            if (keys['KeyE']) {
              keys['KeyE'] = false;
              this.state.holdTheLineActive = true;
              this.state.stage = 'OBJECTIVE_ACTIVE';
              this.state.objectiveTitle = 'HOLD THE LINE: 45s';
              this.state.objectiveDetail =
                'Mutant horde converging from North & South corridors! Defend the Mainframe!';
              this.config.pushKillFeed('DEFENSE INITIATED! HOLD THE LINE FOR 45 SECONDS!', true);
            }
          }
        } else {
          this.state.holdTheLineTimer -= dt;
          const remaining = Math.max(0, Math.ceil(this.state.holdTheLineTimer));
          const pct = Math.floor((1 - this.state.holdTheLineTimer / this.state.holdTheLineTotal) * 100);
          this.state.objectiveTitle = `HOLD THE LINE: ${remaining}s (${pct}%)`;
          this.state.objectiveDetail = 'Mutant horde converging from North and South! Defend mainframe perimeter!';

          interactionPrompt = `HOLD THE LINE: ${remaining}s REMAINING`;
          isPromptObjective = true;

          this.convergeTimer = (this.convergeTimer || 0) - dt;
          if (this.convergeTimer <= 0) {
            this.convergeTimer = 2.4;
            const northBot = this.config.makeBot('zombie', 'runner', false);
            if (northBot) {
              northBot.pos.set((Math.random() - 0.5) * 4, 0.0, -135);
              northBot.group.position.copy(northBot.pos);
            }
            const southBot = this.config.makeBot('zombie', Math.random() < 0.5 ? 'bloater' : 'brute', false);
            if (southBot) {
              southBot.pos.set((Math.random() - 0.5) * 4, 0.0, -105);
              southBot.group.position.copy(southBot.pos);
            }
          }

          if (this.state.holdTheLineTimer <= 0) {
            this.state.holdTheLineComplete = true;
            this.state.holdTheLineActive = false;
            this.state.mainframeHacked = true;
            this.state.stage = 'PROCEED_EVAC';
            this.state.objectiveTitle = 'OBJECTIVE: PROCEED TO EVAC ELEVATOR';
            this.state.objectiveDetail = 'Mainframe lockdown successful. Sector 5 airlock unsealed. Proceed to Evac!';
            this.config.pushKillFeed('MAINFRAME DEFENSE SUCCESSFUL! SECTOR 5 AIRLOCK UNLOCKED.', true);
          }
        }
      }
    } else if (sec4Type === 'REACTOR_OVERRIDE') {
      if (!this.state.reactorOverrideComplete) {
        const distA = Math.hypot(playerPos.x - -11.35, playerPos.z - -115);
        const distB = Math.hypot(playerPos.x - 11.35, playerPos.z - -125);

        if (!this.state.breakerAlphaPulled && distA < 3.2) {
          interactionPrompt = '[E] ENGAGE CIRCUIT BREAKER ALPHA';
          isPromptObjective = true;
          if (keys['KeyE']) {
            keys['KeyE'] = false;
            this.state.breakerAlphaPulled = true;
            if (this.config.world.breakerAlphaLight) {
              this.config.world.breakerAlphaLight.color.setHex(0x00ff88);
            }
            this.config.pushKillFeed('BREAKER ALPHA ONLINE! (1/2)', true);
          }
        } else if (!this.state.breakerBetaPulled && distB < 3.2) {
          interactionPrompt = '[E] ENGAGE CIRCUIT BREAKER BETA';
          isPromptObjective = true;
          if (keys['KeyE']) {
            keys['KeyE'] = false;
            this.state.breakerBetaPulled = true;
            if (this.config.world.breakerBetaLight) {
              this.config.world.breakerBetaLight.color.setHex(0x00ff88);
            }
            this.config.pushKillFeed('BREAKER BETA ONLINE! (2/2)', true);
          }
        }

        if (this.state.breakerAlphaPulled && this.state.breakerBetaPulled) {
          this.state.reactorOverrideComplete = true;
          this.state.mainframeHacked = true;
          this.state.stage = 'PROCEED_EVAC';
          this.state.objectiveTitle = 'OBJECTIVE: PROCEED TO EVAC ELEVATOR';
          this.state.objectiveDetail = 'Both Circuit Breakers engaged. Sector 5 airlock powered.';
          this.config.pushKillFeed('REACTOR OVERRIDE COMPLETE! SECTOR 5 AIRLOCK POWERED.', true);
        } else {
          this.state.objectiveTitle = `REACTOR OVERRIDE: ${
            this.state.breakerAlphaPulled ? 'ALPHA ✔' : 'ALPHA ✖'
          } | ${this.state.breakerBetaPulled ? 'BETA ✔' : 'BETA ✖'}`;
          this.state.objectiveDetail = 'Engage Circuit Breakers on East and West walls in Sector 4.';
        }
      }
    } else if (sec4Type === 'VOLATILE_CONTAINER') {
      if (!this.state.hasBioCylinder) {
        const distToCylinder = Math.hypot(playerPos.x - 0, playerPos.z - -80);
        if (distToCylinder < 3.5) {
          interactionPrompt = '[E] RETRIEVE LEAKING VOLATILE BIO-CANISTER';
          isPromptObjective = true;
          if (keys['KeyE']) {
            keys['KeyE'] = false;
            this.state.hasBioCylinder = true;
            this.state.stage = 'OBJECTIVE_ACTIVE';
            this.state.objectiveTitle = 'TRANSPORT VOLATILE CANISTER';
            this.state.objectiveDetail = 'Canister unstable! Deliver to Sector 5 Decon Receptacle (Z = -155).';
            if (this.config.world.bioCylinderGroup) {
              this.config.world.bioCylinderGroup.visible = false;
            }
            this.config.pushKillFeed('VOLATILE CANISTER SECURED! TRANSPORT TO SECTOR 5 RECEPTACLE.', true);
          }
        }
      } else if (!this.state.volatileContainerDeposited) {
        const distToReceptacle = Math.hypot(playerPos.x - 0, playerPos.z - -155);
        if (distToReceptacle < 3.5) {
          interactionPrompt = '[E] DEPOSIT CANISTER IN DECON RECEPTACLE';
          isPromptObjective = true;
          if (keys['KeyE']) {
            keys['KeyE'] = false;
            this.state.volatileContainerDeposited = true;
            this.state.mainframeHacked = true;
            this.state.stage = 'PROCEED_EVAC';
            this.state.objectiveTitle = 'OBJECTIVE: TERMINATE SPECIMEN ZERO & EXTRACT';
            this.state.objectiveDetail = 'Bio-hazard neutralized. Eliminate Specimen Zero and extract!';
            if (this.config.world.volatileReceptacleLight) {
              this.config.world.volatileReceptacleLight.color.setHex(0x00ff88);
            }
            this.config.pushKillFeed('CANISTER DEPOSITED! DECONTAMINATION PROTOCOL COMPLETE.', true);
          }
        }
      }
    }

    if (sector === 5) {
      if (!this.state.bossSpawned) {
        this.state.bossSpawned = true;
        this.state.stage = 'BOSS_ENCOUNTER';
        this.state.objectiveTitle = 'CRITICAL ALERT: DESTROY SPECIMEN ZERO';
        this.state.objectiveDetail = 'Specimen Zero is guarding the Evac Elevator. Terminate it to escape!';

        const boss = this.config.makeBot('zombie', 'megaboss', false);
        if (boss) {
          boss.pos.set(0, 0.0, -162);
          boss.group.position.copy(boss.pos);
          this.megaBossBot = boss;
        }

        for (let i = 0; i < 3; i++) {
          this.spawnMutantAhead(-155, ['brute', 'banshee', 'runner']);
        }

        this.config.pushKillFeed('CRITICAL ALERT: SPECIMEN ZERO MEGA-BOSS DETECTED!', true);
      } else if (!this.state.bossDefeated) {
        if (this.megaBossBot && !this.megaBossBot.alive) {
          this.state.bossDefeated = true;
          this.state.stage = 'EVAC_READY';
          this.state.evacReady = true;
          this.state.objectiveTitle = 'EXTRACTION READY: STEP ONTO EVAC ELEVATOR';
          this.state.objectiveDetail = 'Evac pad is active at the back of Sector 5. Step onto the pad to extract!';

          if (
            this.config.world.evacPadMesh &&
            (this.config.world.evacPadMesh.material as THREE.MeshStandardMaterial).emissive
          ) {
            ((this.config.world.evacPadMesh.material as THREE.MeshStandardMaterial).emissive as THREE.Color).setHex(
              0x00ff88
            );
          }
          this.config.pushKillFeed('COMMAND: MEGA-BOSS TERMINATED! EVAC ELEVATOR ONLINE.', true);
        }
      }
    }

    const onEvacPad = Math.abs(playerPos.x) <= 2.8 && playerPos.z <= -167 && playerPos.z >= -173;
    if (onEvacPad) {
      const objectiveCompleted =
        this.state.sector4ObjectiveType === 'HOLD_THE_LINE'
          ? this.state.holdTheLineComplete
          : this.state.sector4ObjectiveType === 'REACTOR_OVERRIDE'
          ? this.state.reactorOverrideComplete
          : this.state.volatileContainerDeposited;

      if (objectiveCompleted && this.state.bossDefeated) {
        this.state.stage = 'COMPLETED';
        interactionPrompt = 'EXTRACTION IN PROGRESS... SUCCESS!';
        this.config.onVictory();
      } else if (!objectiveCompleted) {
        interactionPrompt = 'EVAC LOCKED: SECTOR OBJECTIVES NOT COMPLETED';
        isPromptObjective = true;
      } else if (!this.state.bossDefeated) {
        interactionPrompt = 'EVAC LOCKED: SPECIMEN ZERO MUST BE DESTROYED FIRST';
        isPromptObjective = true;
      }
    }

    this.updateProgressiveSpawning(dt, playerPos.z, sector);

    return { interactionPrompt, isPromptObjective };
  }

  public canOpenDoor(doorPos: THREE.Vector3): { allowed: boolean; reason?: string } {
    if (doorPos.x >= 8.5 && Math.abs(doorPos.z - -80) < 4.5) {
      if (!this.state.hasArmoryKeycard) {
        return {
          allowed: false,
          reason: 'SECURITY LOCKED: REQUIRES ARMORY KEYCARD (ELIMINATE SECTOR 3 BRUTE)'
        };
      }
      this.state.armoryDoorOpened = true;
      if (
        this.config.world.armoryKeypadMesh &&
        (this.config.world.armoryKeypadMesh.material as THREE.MeshStandardMaterial).emissive
      ) {
        ((this.config.world.armoryKeypadMesh.material as THREE.MeshStandardMaterial).emissive as THREE.Color).setHex(
          0x00ff88
        );
      }
      return { allowed: true };
    }

    if (Math.abs(doorPos.z - -20) < 2.0) return { allowed: true };
    if (Math.abs(doorPos.z - -60) < 2.0) return { allowed: true };
    if (Math.abs(doorPos.z - -100) < 2.0) return { allowed: true };

    if (Math.abs(doorPos.z - -140) < 2.0) {
      if (this.state.sector4ObjectiveType === 'HOLD_THE_LINE' && !this.state.holdTheLineComplete) {
        return { allowed: false, reason: 'AIRLOCK SEALED: DEFEND MAINFRAME FOR 45 SECONDS FIRST' };
      }
      if (this.state.sector4ObjectiveType === 'REACTOR_OVERRIDE' && !this.state.reactorOverrideComplete) {
        return { allowed: false, reason: 'AIRLOCK SEALED: OVERRIDE BOTH CIRCUIT BREAKERS FIRST' };
      }
      if (this.state.sector4ObjectiveType === 'VOLATILE_CONTAINER' && !this.state.hasBioCylinder) {
        return { allowed: false, reason: 'AIRLOCK SEALED: RETRIEVE LEAKING VOLATILE BIO-CANISTER FIRST' };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }

  private updateProgressiveSpawning(dt: number, playerZ: number, sector: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.spawnTimer = 5.0 + Math.random() * 2.5;

    const aliveMutants = this.config.bots.filter((b) => b.alive && b.isZombie).length;
    if (aliveMutants >= 18) return;

    let allowedTypes: string[] = [];
    if (sector === 1 || sector === 2) allowedTypes = ['walker', 'walker', 'runner'];
    else if (sector === 3 || sector === 4) allowedTypes = ['runner', 'brute', 'banshee', 'bloater'];
    else allowedTypes = ['banshee', 'bloater', 'brute', 'runner'];

    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      this.spawnMutantAhead(playerZ, allowedTypes);
    }
  }

  private spawnMutantAhead(playerZ: number, allowedTypes: string[]): void {
    const chosenType = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
    const bot = this.config.makeBot('zombie', chosenType, false);
    if (!bot) return;

    let spawnZ = playerZ - 12 - Math.random() * 16;
    if (spawnZ < -170) spawnZ = -170 + Math.random() * 5;

    let spawnSpreadX = 1.2;
    if (spawnZ > -10 && spawnZ < 10) spawnSpreadX = 5.0;
    else if (spawnZ > -50 && spawnZ < -30) spawnSpreadX = 7.0;
    else if (spawnZ > -90 && spawnZ < -70) spawnSpreadX = 8.5;
    else if (spawnZ > -130 && spawnZ < -110) spawnSpreadX = 8.5;
    else if (spawnZ < -150) spawnSpreadX = 10.0;

    const spawnX = (Math.random() - 0.5) * spawnSpreadX * 2;
    const isBanshee = chosenType === 'banshee';
    bot.pos.set(spawnX, isBanshee ? 1.2 : 0.0, spawnZ);
    bot.group.position.copy(bot.pos);
  }

  public recordMutantKill(bot?: Bot): void {
    this.state.mutantsKilled++;
    if (bot && !this.state.armoryKeycardDropped) {
      const isBrute = bot.zType === 'brute' || bot.mutantType === 'BRUTE';
      const inSector3 = bot.pos.z <= -60 && bot.pos.z >= -100;
      if (isBrute && inSector3) {
        this.state.armoryKeycardDropped = true;
        this.spawnArmoryKeycardPickup(bot.pos);
        this.config.pushKillFeed('HIGH-VALUE TARGET TERMINATED: ARMORY KEYCARD DROPPED!', true);
      }
    }
  }

  private spawnArmoryKeycardPickup(pos: THREE.Vector3): void {
    const cardGroup = new THREE.Group();
    cardGroup.position.set(pos.x, 0.45, pos.z);

    const cardGeo = new THREE.BoxGeometry(0.5, 0.08, 0.3);
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00aaaa,
      emissiveIntensity: 2.0,
      metalness: 0.8,
      roughness: 0.2
    });
    const cardMesh = new THREE.Mesh(cardGeo, cardMat);
    cardGroup.add(cardMesh);

    const cardLight = new THREE.PointLight(0x00ffff, 2.5, 6);
    cardLight.position.set(0, 0.5, 0);
    cardGroup.add(cardLight);

    this.config.scene.add(cardGroup);
    this.armoryKeycardGroup = cardGroup;
  }

  public recordBossDefeated(): void {
    if (!this.state.bossDefeated) {
      this.state.bossDefeated = true;
      this.state.stage = 'EVAC_READY';
      this.state.evacReady = true;
      this.state.objectiveTitle = 'EXTRACTION READY: STEP ONTO EVAC ELEVATOR';
      this.state.objectiveDetail = 'Evac pad is active at the back of Sector 5. Step onto the pad to extract!';
      this.config.pushKillFeed('SPECIMEN ZERO ELIMINATED! EVAC ELEVATOR UNLOCKED!', true);
    }
  }
}

/* =============================================================================
 * HAZARDS: TOXIC PUDDLES & SONIC DISTORTION (preserved)
 * ===========================================================================*/

export interface SonicDistortionRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxRadius: number;
}

export const activeToxicPuddles: ToxicPuddle[] = [];
export const activeDistortionRings: SonicDistortionRing[] = [];

export function spawnToxicPuddle(scene: THREE.Scene, pos: THREE.Vector3): ToxicPuddle {
  const geo = new THREE.CylinderGeometry(3.5, 3.5, 0.04, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x15803d,
    emissiveIntensity: 1.0,
    roughness: 0.25,
    transparent: true,
    opacity: 0.82
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, 0.04, pos.z);
  scene.add(mesh);

  const puddle: ToxicPuddle = {
    mesh,
    pos: pos.clone(),
    radius: 3.5,
    duration: 8.0,
    maxDuration: 8.0,
    dps: 10
  };
  activeToxicPuddles.push(puddle);
  return puddle;
}

export function updateToxicPuddles(
  dt: number,
  scene: THREE.Scene,
  player: {
    pos: THREE.Vector3;
    alive: boolean;
    applyDamage: (dmg: number, isHeadshot: boolean, isExplosion: boolean, attacker: any) => void;
  },
  bots: Bot[],
  damageBot?: (bot: Bot, amount: number, isHeadshot: boolean, attacker: any) => void
): void {
  for (let i = activeToxicPuddles.length - 1; i >= 0; i--) {
    const puddle = activeToxicPuddles[i];
    puddle.duration -= dt;

    const mat = puddle.mesh.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissiveIntensity = 0.8 + Math.sin(puddle.duration * 5.0) * 0.35;
      if (puddle.duration < 1.8) {
        mat.opacity = Math.max(0, (puddle.duration / 1.8) * 0.82);
      }
    }

    if (player.alive) {
      const dPlayer = Math.hypot(player.pos.x - puddle.pos.x, player.pos.z - puddle.pos.z);
      if (dPlayer <= puddle.radius) {
        player.applyDamage(puddle.dps * dt, false, false, null);
      }
    }

    for (const bot of bots) {
      if (bot.alive && bot.team === 'blue') {
        const dBot = Math.hypot(bot.pos.x - puddle.pos.x, bot.pos.z - puddle.pos.z);
        if (dBot <= puddle.radius) {
          bot.health -= puddle.dps * dt;
          if (bot.health <= 0 && damageBot) {
            damageBot(bot, 1, false, 'toxic');
          }
        }
      }
    }

    if (puddle.duration <= 0) {
      scene.remove(puddle.mesh);
      puddle.mesh.geometry.dispose();
      mat.dispose();
      activeToxicPuddles.splice(i, 1);
    }
  }
}

export function spawnSonicDistortionRing(scene: THREE.Scene, pos: THREE.Vector3): void {
  const geo = new THREE.RingGeometry(0.5, 0.8, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(pos.x, pos.y + 0.6, pos.z);
  scene.add(ring);

  activeDistortionRings.push({ mesh: ring, life: 0.75, maxLife: 0.75, maxRadius: 18.0 });
}

export function updateSonicDistortionRings(dt: number, scene: THREE.Scene): void {
  for (let i = activeDistortionRings.length - 1; i >= 0; i--) {
    const ring = activeDistortionRings[i];
    ring.life -= dt;
    const progress = 1 - Math.max(0, ring.life) / ring.maxLife;

    const currentScale = 1 + progress * (ring.maxRadius - 1);
    ring.mesh.scale.set(currentScale, currentScale, currentScale);

    const mat = ring.mesh.material as THREE.MeshBasicMaterial;
    if (mat) mat.opacity = Math.max(0, (1 - progress) * 0.9);

    if (ring.life <= 0) {
      scene.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      mat.dispose();
      activeDistortionRings.splice(i, 1);
    }
  }
}

export function detonateBloater(bot: Bot, ctx: BioMutantAIContext): void {
  const blastRadius = 4.0;
  const blastDmg = 35;

  if (ctx.player.alive) {
    const dPlayer = bot.pos.distanceTo(ctx.player.pos);
    if (dPlayer <= blastRadius) {
      const falloff = 1 - dPlayer / blastRadius;
      ctx.player.applyDamage(blastDmg * falloff, false, true, bot);
    }
  }

  for (const ally of ctx.bots) {
    if (ally.alive && ally.team === 'blue') {
      const dAlly = bot.pos.distanceTo(ally.pos);
      if (dAlly <= blastRadius) {
        const falloff = 1 - dAlly / blastRadius;
        ctx.damageBot(ally, blastDmg * falloff, false, bot);
      }
    }
  }

  spawnToxicPuddle(ctx.scene, bot.pos);
  ctx.pushKillFeed('HAZARD: BLOATER DETONATED! TOXIC PUDDLE PERSISTS FOR 8s!');

  bot.alive = false;
  bot.health = 0;
  bot.deathT = 2.8;
  bot.group.visible = false;
}

/* =============================================================================
 * ANOMALY SWARM AI
 * ===========================================================================*/

export interface BioMutantAIContext {
  player: {
    pos: THREE.Vector3;
    yaw: number;
    health: number;
    maxHealth: number;
    alive: boolean;
    applyDamage: (dmg: number, isHeadshot: boolean, isExplosion: boolean, attacker: any) => void;
  };
  bots: Bot[];
  world: WorldManager;
  scene: THREE.Scene;
  camera: THREE.Camera;
  pushKillFeed: (msg: string, isPriority?: boolean) => void;
  makeBot: (team: 'blue' | 'red' | 'zombie' | null, zType?: string, isVIP?: boolean, elite?: any) => any;
  damageBot: (bot: Bot, amount: number, isHeadshot: boolean, attacker: any, dir?: THREE.Vector3) => void;
  focusTargetId: number | null;
  scrambleRadar: (duration: number) => void;
  selectedMap?: 'training' | 'hangar';
}

/**
 * "Is the player's reticle resting on this mutant right now?"
 * Uses the camera forward vector rather than yaw so pitch is respected.
 */
function isUnderPlayerReticle(bot: Bot, ctx: BioMutantAIContext): boolean {
  if (!ctx.player.alive) return false;
  const cam = ctx.camera;
  cam.getWorldDirection(_v1);
  _v2.copy(bot.pos);
  _v2.y += 1.0;
  _v2.sub(cam.position);
  const dist = _v2.length();
  if (dist > SWARM_TUNING.reticleMaxRange || dist < 0.001) return false;
  _v2.divideScalar(dist);
  return _v1.dot(_v2) >= SWARM_TUNING.reticleDotThreshold;
}

export function updateBioMutantAI(bot: Bot, dt: number, ctx: BioMutantAIContext): void {
  if (!bot.alive) return;

  const mType: MutantType =
    bot.mutantType ||
    (bot.zType === 'runner'
      ? 'RUNNER'
      : bot.zType === 'brute'
      ? 'BRUTE'
      : bot.zType === 'banshee'
      ? 'BANSHEE'
      : bot.zType === 'bloater'
      ? 'BLOATER'
      : bot.zType === 'megaboss'
      ? 'MEGABOSS'
      : 'WALKER');
  bot.mutantType = mType;

  if (bot.staggerTimer && bot.staggerTimer > 0) {
    bot.staggerTimer -= dt;
    bot.isStaggered = true;
    bot.vel.multiplyScalar(Math.max(0, 1 - dt * 6.0));
    bot.group.rotation.z = Math.sin(performance.now() * 0.02) * 0.15;
    if (bot.staggerTimer <= 0) {
      bot.isStaggered = false;
      bot.group.rotation.z = 0;
    }
    return;
  }

  if (bot.stunTimer && bot.stunTimer > 0) {
    bot.stunTimer -= dt;
    bot.vel.set(0, 0, 0);
    return;
  }

  if (bot.isExploding) {
    bot.explosionTimer = (bot.explosionTimer ?? 0.6) - dt;
    const elapsed = 0.6 - Math.max(0, bot.explosionTimer);
    const swell = 1 + (elapsed / 0.6) * 1.8;
    bot.group.scale.set(1.15 * swell, 0.944 * swell, 1.15 * swell);

    bot.flashMats.forEach((m) => {
      if (m.emissive) {
        m.emissive.setHex(0x22c55e);
        m.emissiveIntensity = 2.5 + Math.sin(performance.now() * 0.04) * 2.0;
      }
    });

    bot.vel.set(0, 0, 0);
    if (bot.explosionTimer <= 0) detonateBloater(bot, ctx);
    return;
  }

  /* ---- Enraged charge & reticle-dwell weave state ---- */
  const enraged = bot.health < bot.maxHealth * SWARM_TUNING.enrageHealthPct;
  bot.isEnraged = enraged;

  if (isUnderPlayerReticle(bot, ctx)) {
    bot.reticleDwell = (bot.reticleDwell ?? 0) + dt;
  } else {
    bot.reticleDwell = 0;
  }
  bot.underReticle = (bot.reticleDwell ?? 0) >= SWARM_TUNING.reticleDwellSeconds;

  /* ---- Target acquisition ---- */
  let targetPos: THREE.Vector3 | null = null;
  let targetIsPlayer = false;
  let targetAlly: Bot | null = null;
  let closestDist = Infinity;

  if (ctx.player.alive) {
    closestDist = bot.pos.distanceTo(ctx.player.pos);
    targetPos = ctx.player.pos;
    targetIsPlayer = true;
  }

  for (const ally of ctx.bots) {
    if (!ally.alive || ally.team !== 'blue') continue;
    const d = bot.pos.distanceTo(ally.pos);
    const distWeight = mType === 'RUNNER' ? d * 1.6 : d;
    if (distWeight < closestDist) {
      closestDist = d;
      targetPos = ally.pos;
      targetIsPlayer = false;
      targetAlly = ally;
    }
  }

  if (!targetPos) return;

  const dx = targetPos.x - bot.pos.x;
  const dz = targetPos.z - bot.pos.z;
  const dist = Math.hypot(dx, dz);
  const ndx = dist > 0.001 ? dx / dist : 0;
  const ndz = dist > 0.001 ? dz / dist : 1;

  if (bot.attackCooldown && bot.attackCooldown > 0) bot.attackCooldown -= dt;
  if (bot.meleeCooldown > 0) bot.meleeCooldown -= dt;

  switch (mType) {
    case 'WALKER': {
      bot.speed = 1.8;
      bot.attackRange = 1.4;
      bot.vel.x = ndx * 1.8;
      bot.vel.z = ndz * 1.8;
      bot.facing = Math.atan2(dx, dz);
      bot.group.rotation.y = bot.facing;

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 0.9;
        if (targetIsPlayer && ctx.player.alive) ctx.player.applyDamage(16, false, false, bot);
        else if (targetAlly && targetAlly.alive) ctx.damageBot(targetAlly, 16, false, bot);
      }
      break;
    }

    case 'RUNNER': {
      bot.speed = 5.2;
      bot.attackRange = 1.6;

      let steerX = ndx;
      let steerZ = ndz;

      if (targetIsPlayer) {
        const pYaw = ctx.player.yaw;
        const forwardX = Math.sin(pYaw);
        const forwardZ = Math.cos(pYaw);
        const rearX = ctx.player.pos.x - forwardX * 3.2;
        const rearZ = ctx.player.pos.z - forwardZ * 3.2;

        if (dist > 3.0) {
          const rdx = rearX - bot.pos.x;
          const rdz = rearZ - bot.pos.z;
          const rdist = Math.hypot(rdx, rdz);
          if (rdist > 0.1) {
            steerX = rdx / rdist;
            steerZ = rdz / rdist;
          }
        }
      }

      bot.weavePhase = (bot.weavePhase ?? bot.id * 1.5) + dt * 6.5;
      const perpX = -steerZ;
      const perpZ = steerX;
      const weaveOffset = Math.sin(bot.weavePhase) * 1.8;

      bot.vel.x = steerX * 5.2 + perpX * weaveOffset;
      bot.vel.z = steerZ * 5.2 + perpZ * weaveOffset;

      bot.facing = Math.atan2(bot.vel.x, bot.vel.z);
      bot.group.rotation.y = bot.facing;

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 0.5;
        if (targetIsPlayer && ctx.player.alive) ctx.player.applyDamage(14, false, false, bot);
        else if (targetAlly && targetAlly.alive) ctx.damageBot(targetAlly, 14, false, bot);
      }
      break;
    }

    case 'BRUTE': {
      bot.speed = 2.2;
      bot.attackRange = 2.0;
      bot.vel.x = ndx * 2.2;
      bot.vel.z = ndz * 2.2;
      bot.facing = Math.atan2(dx, dz);
      bot.group.rotation.y = bot.facing;

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 1.2;
        if (targetIsPlayer && ctx.player.alive) ctx.player.applyDamage(32, false, false, bot);
        else if (targetAlly && targetAlly.alive) ctx.damageBot(targetAlly, 32, false, bot);
      }
      break;
    }

    case 'BANSHEE': {
      bot.speed = 4.0;
      bot.hoverHeight = 1.2;
      bot.attackRange = 2.2;

      const baseFloorY = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, bot.pos.y);
      bot.pos.y = baseFloorY + 1.2 + Math.sin(performance.now() * 0.0035 + bot.id) * 0.16;

      if (dist < 7.5) {
        bot.vel.x = -ndx * 3.5;
        bot.vel.z = -ndz * 3.5;
      } else if (dist > 8.8) {
        bot.vel.x = ndx * 4.0;
        bot.vel.z = ndz * 4.0;
      } else {
        const perpX = -ndz;
        const perpZ = ndx;
        const strafeDir = Math.sin(performance.now() * 0.002 + bot.id) > 0 ? 1 : -1;
        bot.vel.x = perpX * 2.8 * strafeDir;
        bot.vel.z = perpZ * 2.8 * strafeDir;
      }

      bot.facing = Math.atan2(dx, dz);
      bot.group.rotation.y = bot.facing;

      bot.specialAbilityTimer = (bot.specialAbilityTimer ?? 6.0) - dt;
      if (bot.specialAbilityTimer <= 0) {
        bot.specialAbilityTimer = 6.0;

        spawnSonicDistortionRing(ctx.scene, bot.pos);
        ctx.scrambleRadar(3.0);
        (window as any).radarScrambleTimer = 3.0;

        for (const ally of ctx.bots) {
          if (ally.alive && ally.team === 'blue') {
            if (bot.pos.distanceTo(ally.pos) <= 25.0) {
              ally.stunTimer = 1.5;
              ally.vel.set(0, 0, 0);
            }
          }
        }

        ctx.pushKillFeed('DISTORTION PULSE: BANSHEE SCREECH SCRAMBLED SQUAD RADAR!', true);
      }

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 1.0;
        if (targetIsPlayer && ctx.player.alive) ctx.player.applyDamage(18, false, false, bot);
        else if (targetAlly && targetAlly.alive) ctx.damageBot(targetAlly, 18, false, bot);
      }
      break;
    }

    case 'BLOATER': {
      bot.speed = 1.5;
      bot.attackRange = 2.0;

      bot.group.rotation.z = Math.sin(performance.now() * 0.008 + bot.id) * 0.14;

      bot.vel.x = ndx * 1.5;
      bot.vel.z = ndz * 1.5;
      bot.facing = Math.atan2(dx, dz);
      bot.group.rotation.y = bot.facing;

      if (dist <= 2.0 && !bot.isExploding) {
        bot.isExploding = true;
        bot.explosionTimer = 0.6;
        ctx.pushKillFeed('CRITICAL: BLOATER SWELLING RAPIDLY! CLEAR THE AREA!', true);
      }
      break;
    }

    case 'MEGABOSS': {
      bot.isCharging = enraged;
      bot.speed = enraged ? 6.0 : 2.5;
      bot.attackRange = 2.8;

      bot.vel.x = ndx * bot.speed;
      bot.vel.z = ndz * bot.speed;
      bot.facing = Math.atan2(dx, dz);
      bot.group.rotation.y = bot.facing;

      bot.specialAbilityTimer = (bot.specialAbilityTimer ?? 12.0) - dt;
      if (bot.specialAbilityTimer <= 0) {
        bot.specialAbilityTimer = 13.5;
        ctx.pushKillFeed('SPECIMEN ZERO ROARS! REINFORCEMENTS BURSTING FROM VENTS!', true);

        const spawnTypes = ['runner', 'runner', 'runner', 'brute'];
        for (const type of spawnTypes) {
          const spawnBot = ctx.makeBot('zombie', type, false);
          if (spawnBot) {
            const offsetDist = 5.0 + Math.random() * 4.0;
            const offsetAngle = Math.random() * Math.PI * 2;
            spawnBot.pos.set(
              bot.pos.x + Math.sin(offsetAngle) * offsetDist,
              0.0,
              bot.pos.z + Math.cos(offsetAngle) * offsetDist
            );
            spawnBot.group.position.copy(spawnBot.pos);
          }
        }
      }

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 1.4;
        if (targetIsPlayer && ctx.player.alive) ctx.player.applyDamage(45, false, false, bot);
        else if (targetAlly && targetAlly.alive) ctx.damageBot(targetAlly, 45, false, bot);
      }
      break;
    }
  }

  /* ---------------------------------------------------------------------
   * SWARM MANEUVER OVERRIDE
   * Enrage beats weave: below 50% HP the mutant abandons evasion and runs a
   * straight line at 1.5x. Otherwise, if the reticle has been resting on it,
   * it weaves perpendicular to its approach vector.
   * Banshees keep their stand-off orbit; bloaters mid-swell keep still.
   * ------------------------------------------------------------------- */
  if (mType !== 'BANSHEE' && !bot.isExploding) {
    if (enraged) {
      const chargeSpeed = bot.speed * SWARM_TUNING.enrageSpeedMult;
      bot.speed = chargeSpeed;
      bot.vel.x = ndx * chargeSpeed;
      bot.vel.z = ndz * chargeSpeed;
      bot.facing = Math.atan2(ndx, ndz);
      bot.group.rotation.y = bot.facing;
    } else if (bot.underReticle) {
      bot.weavePhase = (bot.weavePhase ?? bot.id) + dt * SWARM_TUNING.weaveFrequency;
      const perpX = -ndz;
      const perpZ = ndx;
      const w = Math.sin(bot.weavePhase) * SWARM_TUNING.weaveAmplitude;
      bot.vel.x = ndx * bot.speed + perpX * w;
      bot.vel.z = ndz * bot.speed + perpZ * w;
      bot.facing = Math.atan2(bot.vel.x, bot.vel.z);
      bot.group.rotation.y = bot.facing;
    }
  }

  /* ---- Collision & movement ---- */
  const colRadius = botColliderRadius(bot);
  const colHeight = botColliderHeight(bot);

  if (mType !== 'BANSHEE') {
    const floorY = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, bot.pos.y);
    bot.pos.y = floorY;
    ctx.world.moveEntityWithCollision(bot.pos, bot.vel, colRadius, bot.pos.y, bot.pos.y + colHeight, dt);
    const postFloorY = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, bot.pos.y);
    bot.pos.y = postFloorY;
  } else {
    bot.pos.x += bot.vel.x * dt;
    bot.pos.z += bot.vel.z * dt;
    const baseFloorY = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, 0);
    bot.pos.y = baseFloorY + 1.2 + Math.sin(performance.now() * 0.0035 + bot.id) * 0.16;
  }

  bot.group.position.copy(bot.pos);

  /* ---- Walk animation ---- */
  const isMoving = bot.vel.lengthSq() > 0.05;
  if (isMoving) {
    bot.walkPhase = (bot.walkPhase || 0) + dt * bot.speed * 2.5;
    const swing = Math.sin(bot.walkPhase) * 0.45;

    if (bot.legLPivot && bot.legRPivot && mType !== 'BANSHEE') {
      bot.legLPivot.rotation.x = swing;
      bot.legRPivot.rotation.x = -swing;
    }
    if (bot.armLPivot && bot.armRPivot) {
      if (mType === 'RUNNER' || enraged) {
        bot.armLPivot.rotation.x = -0.5 + Math.sin(bot.walkPhase) * 0.2;
        bot.armRPivot.rotation.x = -0.5 - Math.sin(bot.walkPhase) * 0.2;
      } else {
        bot.armLPivot.rotation.x = -swing * 0.8;
        bot.armRPivot.rotation.x = swing * 0.8;
      }
    }
  }
}

/* =============================================================================
 * SHARED COMBAT CONTEXT
 * ===========================================================================*/

export interface CombatPlayerProxy {
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  team: string;
  applyDamage: (dmg: number, isHeadshot: boolean, isExplosion: boolean, attacker: any) => void;
  heal: (amount: number) => void;
}

export interface CombatSystemsContext {
  player: CombatPlayerProxy;
  bots: Bot[];
  world: WorldManager;
  scene: THREE.Scene;
  camera: THREE.Camera;
  pushKillFeed: (msg: string, isPriority?: boolean) => void;
  damageBot: (
    bot: Bot,
    amount: number,
    isHeadshot: boolean,
    attacker: 'player' | Bot | string,
    dir?: THREE.Vector3
  ) => void;
  squadDirective: SquadDirective;
  focusTargetId: number | null;
  radarPing?: (x: number, z: number, type: 'gunfire' | 'zombie') => void;
  /** Called whenever a splash/penetrator kill should pay out. */
  onExplosionHit?: (target: Bot | 'player', damage: number) => void;
}

function isHostileTo(a: Bot, playerTeam: string): boolean {
  return a.alive && a.team !== playerTeam;
}

function nearestHostileToBot(bot: Bot, ctx: CombatSystemsContext, maxRange = 90): { pos: THREE.Vector3; target: Bot | 'player' } | null {
  let best: { pos: THREE.Vector3; target: Bot | 'player' } | null = null;
  let bestD = maxRange;

  if (ctx.player.alive && bot.team !== ctx.player.team) {
    const d = bot.pos.distanceTo(ctx.player.pos);
    if (d < bestD) {
      bestD = d;
      best = { pos: ctx.player.pos, target: 'player' };
    }
  }

  for (const other of ctx.bots) {
    if (!other.alive || other === bot) continue;
    if (other.team === bot.team) continue;
    const d = bot.pos.distanceTo(other.pos);
    if (d < bestD) {
      bestD = d;
      best = { pos: other.pos, target: other };
    }
  }

  return best;
}

/* =============================================================================
 * PART 3 — ADVANCED TACTICAL AI COMBAT ENGINE
 * Bounding overwatch · hard-cover raycasts · dynamic flanking
 * ===========================================================================*/

let fireTeamAssignTimer = 0;
let playerStationaryTimer = 0;
let flankOrderCooldown = 0;
const lastPlayerSample = new THREE.Vector3();
let lastPlayerSampleValid = false;

export function resetTacticalEngine(): void {
  fireTeamAssignTimer = 0;
  playerStationaryTimer = 0;
  flankOrderCooldown = 0;
  lastPlayerSampleValid = false;
}

/** How long the player has held position, in seconds. Drives flank orders. */
export function getPlayerStationaryTime(): number {
  return playerStationaryTimer;
}

/**
 * Scans nearby colliders for a standing position that is occluded from the
 * threat. Anchors sit one standoff distance off each of the box's four faces.
 */
export function findNearestCover(
  botPos: THREE.Vector3,
  threatPos: THREE.Vector3,
  colliders: WorldCollider[]
): CoverPoint | null {
  let best: CoverPoint | null = null;
  const off = TACTICAL_TUNING.coverStandoff;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.active === false || c.isDoor || c.isStair || c.isRamp) continue;
    if (c.maxY - c.minY < TACTICAL_TUNING.coverMinHeight) continue;

    const cx = (c.minX + c.maxX) * 0.5;
    const cz = (c.minZ + c.maxZ) * 0.5;
    const centreDist = Math.hypot(cx - botPos.x, cz - botPos.z);
    if (centreDist > TACTICAL_TUNING.coverSearchRadius) continue;

    const hw = (c.maxX - c.minX) * 0.5 + off;
    const hd = (c.maxZ - c.minZ) * 0.5 + off;

    const anchors = [
      { x: cx - hw, z: cz },
      { x: cx + hw, z: cz },
      { x: cx, z: cz - hd },
      { x: cx, z: cz + hd }
    ];

    for (let a = 0; a < anchors.length; a++) {
      const anchor = anchors[a];
      _v1.set(anchor.x, botPos.y, anchor.z);

      // The anchor is only cover if geometry sits between it and the threat.
      if (!sightlineBlocked(_v1, threatPos, colliders)) continue;

      const travel = Math.hypot(anchor.x - botPos.x, anchor.z - botPos.z);
      const height = c.maxY - c.minY;
      const quality = 10 / (1 + travel) + Math.min(height, 3) * 0.6;

      if (!best || quality > best.quality) {
        best = { pos: new THREE.Vector3(anchor.x, botPos.y, anchor.z), quality, collider: c };
      }
    }
  }

  return best;
}

function assignFireTeams(hostiles: Bot[]): void {
  const unassigned = hostiles.slice();
  let teamId = 0;

  for (let i = 0; i < unassigned.length; i++) {
    const a = unassigned[i];
    if (!a || !a.tactical) continue;
    if (a.tactical.fireTeamPartnerId !== null) continue;

    let partner: Bot | null = null;
    let bestD: number = TACTICAL_TUNING.fireTeamPairRadius;

    for (let j = i + 1; j < unassigned.length; j++) {
      const b = unassigned[j];
      if (!b || !b.tactical) continue;
      if (b.tactical.fireTeamPartnerId !== null) continue;
      if (b.team !== a.team) continue;
      const d = a.pos.distanceTo(b.pos);
      if (d < bestD) {
        bestD = d;
        partner = b;
      }
    }

    teamId++;
    a.tactical.fireTeamId = teamId;
    a.tactical.boundingRole = 'MOVER';

    if (partner && partner.tactical) {
      partner.tactical.fireTeamId = teamId;
      partner.tactical.fireTeamPartnerId = a.id;
      partner.tactical.boundingRole = 'ANCHOR';
      a.tactical.fireTeamPartnerId = partner.id;
    } else {
      // Lone operator runs both halves of the cycle itself.
      a.tactical.fireTeamPartnerId = null;
    }
  }
}

function orderFlank(hostiles: Bot[], ctx: CombatSystemsContext): void {
  const candidates = hostiles
    .filter((b) => b.tactical && b.tactical.stance !== 'IN_COVER' && b.tactical.stance !== 'SEEK_COVER')
    .filter((b) => b.tactical!.flankSide === 0)
    .sort((a, b) => a.pos.distanceTo(ctx.player.pos) - b.pos.distanceTo(ctx.player.pos));

  const alreadyFlanking = hostiles.filter((b) => b.tactical && b.tactical.flankSide !== 0).length;
  const slots = Math.max(0, TACTICAL_TUNING.flankMaxBots - alreadyFlanking);
  if (slots <= 0) return;

  const pYaw = ctx.player.yaw;
  const forwardX = -Math.sin(pYaw);
  const forwardZ = -Math.cos(pYaw);
  // 90° left / right of the player's facing
  const rightX = Math.sin(pYaw + Math.PI / 2);
  const rightZ = Math.cos(pYaw + Math.PI / 2);

  for (let i = 0; i < Math.min(slots, candidates.length); i++) {
    const bot = candidates[i];
    const t = bot.tactical!;
    const side: -1 | 1 = i % 2 === 0 ? 1 : -1;
    t.flankSide = side;
    t.flankTimer = TACTICAL_TUNING.flankTimeout;
    t.stance = 'FLANK';
    t.flankWaypoint = new THREE.Vector3(
      ctx.player.pos.x + rightX * TACTICAL_TUNING.flankLateralOffset * side + forwardX * TACTICAL_TUNING.flankForwardOffset,
      bot.pos.y,
      ctx.player.pos.z + rightZ * TACTICAL_TUNING.flankLateralOffset * side + forwardZ * TACTICAL_TUNING.flankForwardOffset
    );
  }

  if (slots > 0 && candidates.length > 0) {
    ctx.pushKillFeed('WARNING: HOSTILES BREAKING TO YOUR FLANKS', true);
  }
}

/**
 * Drives every non-anomaly hostile. Returns the ids of bots whose movement it
 * has already committed this frame, so the caller can skip its legacy loop.
 */
export function updateTacticalCombatEngine(dt: number, ctx: CombatSystemsContext): Set<number> {
  const managed = new Set<number>();
  const colliders = ctx.world.worldColliders;

  /* ---- Player stationary tracking (flank trigger) ---- */
  if (ctx.player.alive) {
    if (!lastPlayerSampleValid) {
      lastPlayerSample.copy(ctx.player.pos);
      lastPlayerSampleValid = true;
    }
    const moved = Math.hypot(ctx.player.pos.x - lastPlayerSample.x, ctx.player.pos.z - lastPlayerSample.z);
    const speed = dt > 0 ? moved / dt : 0;
    if (speed <= TACTICAL_TUNING.flankStationarySpeed) {
      playerStationaryTimer += dt;
    } else {
      playerStationaryTimer = 0;
    }
    lastPlayerSample.copy(ctx.player.pos);
  } else {
    playerStationaryTimer = 0;
  }

  const hostiles = ctx.bots.filter(
    (b) => b.alive && !b.isZombie && b.team !== ctx.player.team && b.team !== 'blue'
  );

  for (const bot of hostiles) {
    if (!bot.tactical) bot.tactical = createTacticalState(-1);
  }

  /* ---- Fire-team assignment ---- */
  fireTeamAssignTimer -= dt;
  if (fireTeamAssignTimer <= 0) {
    fireTeamAssignTimer = TACTICAL_TUNING.fireTeamAssignInterval;
    for (const bot of hostiles) {
      const partner = bot.tactical!.fireTeamPartnerId;
      if (partner !== null) {
        const stillAlive = ctx.bots.some((b) => b.id === partner && b.alive);
        if (!stillAlive) bot.tactical!.fireTeamPartnerId = null;
      }
    }
    assignFireTeams(hostiles);
  }

  /* ---- Flank orders ---- */
  flankOrderCooldown -= dt;
  if (playerStationaryTimer >= TACTICAL_TUNING.flankTriggerSeconds && flankOrderCooldown <= 0) {
    flankOrderCooldown = TACTICAL_TUNING.flankTimeout;
    orderFlank(hostiles, ctx);
  }

  /* ---- Per-bot tactical tick ---- */
  for (const bot of hostiles) {
    const t = bot.tactical!;
    t.coverSearchCooldown -= dt;
    t.repathTimer -= dt;
    bot.suppression = Math.max(0, (bot.suppression ?? 0) - dt * 0.55);

    const acquired = nearestHostileToBot(bot, ctx, 90);
    if (!acquired) {
      t.holdFire = true;
      continue;
    }

    const targetPos = acquired.pos;
    const hasLos = !sightlineBlocked(bot.pos, targetPos, colliders);
    if (hasLos) {
      t.losTimer += dt;
      if (!t.lastKnownTargetPos) t.lastKnownTargetPos = new THREE.Vector3();
      t.lastKnownTargetPos.copy(targetPos);
    } else {
      t.losTimer = 0;
    }

    const dxT = targetPos.x - bot.pos.x;
    const dzT = targetPos.z - bot.pos.z;
    const distT = Math.hypot(dxT, dzT) || 0.001;
    const ndxT = dxT / distT;
    const ndzT = dzT / distT;

    const hpPct = bot.health / Math.max(1, bot.maxHealth);

    /* ---------------- Stance selection ---------------- */
    if (t.flankSide !== 0) {
      t.flankTimer -= dt;
      if (t.flankTimer <= 0) {
        t.flankSide = 0;
        t.flankWaypoint = null;
        t.stance = 'ADVANCE';
      } else {
        t.stance = 'FLANK';
      }
    } else if (hpPct < TACTICAL_TUNING.coverSeekHealthPct && !bot.staggerImmune) {
      if (t.stance !== 'IN_COVER') t.stance = 'SEEK_COVER';
    } else if (t.stance === 'IN_COVER' || t.stance === 'SEEK_COVER') {
      // Recovered above the threshold — rejoin the advance.
      if (hpPct > 0.65) {
        t.stance = 'ADVANCE';
        t.coverTarget = null;
      }
    } else {
      /* Bounding overwatch: swap roles on a fixed cycle. */
      t.boundingTimer -= dt;
      if (t.boundingTimer <= 0) {
        t.boundingTimer = TACTICAL_TUNING.boundCycleSeconds;
        t.boundingRole = t.boundingRole === 'MOVER' ? 'ANCHOR' : 'MOVER';
      }
      t.stance = t.boundingRole === 'ANCHOR' && hasLos && distT <= TACTICAL_TUNING.suppressionRange ? 'SUPPRESS' : 'ADVANCE';
    }

    /* ---------------- Movement intent ---------------- */
    let moveX = 0;
    let moveZ = 0;
    let speedMult = 1.0;
    t.holdFire = false;
    t.spreadPenalty = 0;
    t.fireRateMult = 1.0;

    if (t.stance === 'SEEK_COVER') {
      if ((!t.coverTarget || t.repathTimer <= 0) && t.coverSearchCooldown <= 0) {
        t.coverTarget = findNearestCover(bot.pos, targetPos, colliders);
        t.coverSearchCooldown = 1.1;
        t.repathTimer = 2.0;
      }

      if (t.coverTarget) {
        const cdx = t.coverTarget.pos.x - bot.pos.x;
        const cdz = t.coverTarget.pos.z - bot.pos.z;
        const cd = Math.hypot(cdx, cdz) || 0.001;
        if (cd <= TACTICAL_TUNING.coverArrivalDist) {
          t.stance = 'IN_COVER';
          t.coverHoldTimer = TACTICAL_TUNING.coverHoldSeconds;
        } else {
          const steer = steerAroundObstacles(bot.pos.x, bot.pos.z, cdx / cd, cdz / cd, colliders);
          moveX = steer.dx;
          moveZ = steer.dz;
          speedMult = 1.35; // break contact quickly
        }
      } else {
        // Nothing to hide behind — reverse out of the engagement.
        const steer = steerAroundObstacles(bot.pos.x, bot.pos.z, -ndxT, -ndzT, colliders);
        moveX = steer.dx;
        moveZ = steer.dz;
        speedMult = 1.2;
      }
      t.holdFire = true;
    } else if (t.stance === 'IN_COVER') {
      t.coverHoldTimer -= dt;
      moveX = 0;
      moveZ = 0;
      t.holdFire = true;

      // Reload / patch up behind the wall.
      if (bot.healSlot) {
        if (bot.healSlot.healCooldown > 0) {
          bot.healSlot.healCooldown -= dt;
        } else if (bot.healSlot.medkitCount > 0 && hpPct < 0.75) {
          bot.healSlot.medkitCount--;
          bot.healSlot.healCooldown = 2.0;
          bot.health = Math.min(bot.maxHealth, bot.health + bot.maxHealth * 0.4);
        } else if (bot.healSlot.shieldPotCount > 0 && hpPct < 0.75) {
          bot.healSlot.shieldPotCount--;
          bot.healSlot.healCooldown = 2.0;
          bot.health = Math.min(bot.maxHealth, bot.health + bot.maxHealth * 0.25);
        }
      }

      if (t.coverHoldTimer <= 0) {
        t.stance = 'ADVANCE';
        t.coverTarget = null;
      }
    } else if (t.stance === 'FLANK') {
      const wp = t.flankWaypoint;
      if (wp) {
        const fdx = wp.x - bot.pos.x;
        const fdz = wp.z - bot.pos.z;
        const fd = Math.hypot(fdx, fdz) || 0.001;
        if (fd < 2.0) {
          // Arrived on the flank — turn in and engage.
          t.flankSide = 0;
          t.flankWaypoint = null;
          t.stance = 'ADVANCE';
        } else {
          const steer = steerAroundObstacles(bot.pos.x, bot.pos.z, fdx / fd, fdz / fd, colliders, 0.42, 3.2);
          moveX = steer.dx;
          moveZ = steer.dz;
          speedMult = 1.45;
          // Keep quiet while routing around.
          t.holdFire = fd > 6.0;
        }
      } else {
        t.stance = 'ADVANCE';
      }
    } else if (t.stance === 'SUPPRESS') {
      // Anchor holds the line and dumps rounds: high volume, low precision.
      moveX = 0;
      moveZ = 0;
      t.spreadPenalty = TACTICAL_TUNING.suppressionSpread;
      t.fireRateMult = TACTICAL_TUNING.suppressionFireRateMult;
      t.suppressionTimer += dt;

      // Pin the target down.
      if (acquired.target !== 'player') {
        const tb = acquired.target as Bot;
        tb.suppression = Math.min(1, (tb.suppression ?? 0) + dt * 0.7);
      }
    } else {
      // ADVANCE — close to preferred range, side-stepping into the approach.
      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeDir *= -1;
        bot.strafeTimer = 1.2 + Math.random() * 1.4;
      }

      const preferred = bot.preferredRange || 13;
      let desiredX = 0;
      let desiredZ = 0;

      if (distT > preferred + 2) {
        desiredX = ndxT;
        desiredZ = ndzT;
      } else if (distT < preferred - 2) {
        desiredX = -ndxT;
        desiredZ = -ndzT;
      }

      desiredX += -ndzT * bot.strafeDir * 0.6;
      desiredZ += ndxT * bot.strafeDir * 0.6;

      const dLen = Math.hypot(desiredX, desiredZ);
      if (dLen > 0.001) {
        const steer = steerAroundObstacles(bot.pos.x, bot.pos.z, desiredX / dLen, desiredZ / dLen, colliders);
        moveX = steer.dx;
        moveZ = steer.dz;
      }
      speedMult = t.boundingRole === 'MOVER' ? 1.25 : 0.85;
      t.holdFire = !hasLos;
    }

    /* ---------------- Suppression effects on this bot ---------------- */
    const suppressed = bot.suppression ?? 0;
    if (suppressed > 0.55) {
      t.spreadPenalty += suppressed * 0.06;
      speedMult *= 0.75;
    }

    /* ---------------- Commit movement ---------------- */
    const vx = moveX * bot.speed * 0.65 * speedMult;
    const vz = moveZ * bot.speed * 0.65 * speedMult;
    bot.vel.x += (vx - bot.vel.x) * Math.min(1, dt * 6);
    bot.vel.z += (vz - bot.vel.z) * Math.min(1, dt * 6);

    ctx.world.moveEntityWithCollision(bot.pos, bot.vel, 0.38, bot.pos.y, bot.pos.y + 1.8, dt);
    bot.pos.y = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, bot.pos.y);
    bot.group.position.copy(bot.pos);

    // Always face the threat, even while side-stepping or falling back.
    bot.facing = Math.atan2(dxT, dzT);
    bot.group.rotation.y = bot.facing;

    managed.add(bot.id);
  }

  return managed;
}

/* =============================================================================
 * PART 2 — EXPLOSIVE & TECH ENGINE
 * ===========================================================================*/

export const activeProjectiles: ActiveProjectile[] = [];
let projectileIdCounter = 1;

interface ExplosionFx {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  life: number;
  maxLife: number;
  scale: number;
  growth: number;
}
const explosionFx: ExplosionFx[] = [];

function buildRocketMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3d33, roughness: 0.6, metalness: 0.5 });
  const warheadMat = new THREE.MeshStandardMaterial({ color: 0x6b2b1e, roughness: 0.5, metalness: 0.4 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 10), bodyMat);
  body.rotation.x = Math.PI / 2;
  const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 10), warheadMat);
  warhead.rotation.x = Math.PI / 2;
  warhead.position.z = 0.36;

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.12), bodyMat);
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.2);
    fin.rotation.z = a;
    g.add(fin);
  }

  const exhaust = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.85 })
  );
  exhaust.position.z = -0.3;

  g.add(body, warhead, exhaust);
  return g;
}

function buildGrenadeShellMesh(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0x2f3d2a, roughness: 0.6, metalness: 0.4 })
  );
  shell.rotation.x = Math.PI / 2;
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.056, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.5, metalness: 0.6 })
  );
  tip.position.z = 0.07;
  g.add(shell, tip);
  return g;
}

export function spawnProjectile(
  scene: THREE.Scene,
  weaponId: WeaponID,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  ownerTeam: string,
  ownerIsPlayer: boolean,
  ownerBotId = -1
): ActiveProjectile | null {
  const def: ArsenalWeaponDef = ARSENAL[weaponId];
  if (!def) return null;
  if (def.projectile !== 'ROCKET' && def.projectile !== 'ARC_GRENADE') return null;

  const kind: 'ROCKET' | 'ARC_GRENADE' = def.projectile === 'ROCKET' ? 'ROCKET' : 'ARC_GRENADE';
  const group = kind === 'ROCKET' ? buildRocketMesh() : buildGrenadeShellMesh();

  const pos = origin.clone();
  group.position.copy(pos);
  group.lookAt(pos.clone().add(dir));
  scene.add(group);

  const proj: ActiveProjectile = {
    id: projectileIdCounter++,
    kind,
    weaponId,
    group,
    pos,
    prevPos: pos.clone(),
    vel: dir.clone().normalize().multiplyScalar(def.projectileSpeed),
    gravity: def.projectileGravity,
    splashRadius: def.splashRadius,
    splashDamage: def.splashDamage,
    ownerTeam,
    ownerIsPlayer,
    ownerBotId,
    life: kind === 'ROCKET' ? 7.0 : 9.0,
    armed: false,
    trailTimer: 0
  };

  activeProjectiles.push(proj);
  return proj;
}

/** 6-metre (or weapon-defined) AABB splash check. */
export function detonateExplosion(
  center: THREE.Vector3,
  radius: number,
  damage: number,
  ownerTeam: string,
  ownerIsPlayer: boolean,
  ctx: CombatSystemsContext,
  attacker: 'player' | Bot | string = 'player'
): void {
  const minX = center.x - radius;
  const maxX = center.x + radius;
  const minY = center.y - radius;
  const maxY = center.y + radius;
  const minZ = center.z - radius;
  const maxZ = center.z + radius;

  /* --- Bots --- */
  for (const bot of ctx.bots) {
    if (!bot.alive) continue;
    if (bot.team === ownerTeam) continue;

    const r = botColliderRadius(bot);
    const h = botColliderHeight(bot);
    const overlap = aabbOverlap(
      minX, maxX, minY, maxY, minZ, maxZ,
      bot.pos.x - r, bot.pos.x + r,
      bot.pos.y, bot.pos.y + h,
      bot.pos.z - r, bot.pos.z + r
    );
    if (!overlap) continue;

    const d = Math.hypot(bot.pos.x - center.x, bot.pos.y + h * 0.5 - center.y, bot.pos.z - center.z);
    const falloff = Math.max(0.25, 1 - d / radius);
    const dealt = damage * falloff;

    _v3.set(bot.pos.x - center.x, 0, bot.pos.z - center.z).normalize();
    ctx.damageBot(bot, dealt, false, attacker, _v3.clone());

    if (!bot.staggerImmune && !bot.isZombie) {
      bot.staggerTimer = Math.max(bot.staggerTimer ?? 0, 0.5);
      bot.isStaggered = true;
    }
    if (ctx.onExplosionHit) ctx.onExplosionHit(bot, dealt);
  }

  /* --- Player --- */
  if (ctx.player.alive && (!ownerIsPlayer || true)) {
    const pOverlap = aabbOverlap(
      minX, maxX, minY, maxY, minZ, maxZ,
      ctx.player.pos.x - PLAYER_BODY_RADIUS, ctx.player.pos.x + PLAYER_BODY_RADIUS,
      ctx.player.pos.y - PLAYER_BODY_HEIGHT, ctx.player.pos.y + 0.3,
      ctx.player.pos.z - PLAYER_BODY_RADIUS, ctx.player.pos.z + PLAYER_BODY_RADIUS
    );
    if (pOverlap && ownerTeam !== ctx.player.team) {
      const d = ctx.player.pos.distanceTo(center);
      const falloff = Math.max(0.25, 1 - d / radius);
      ctx.player.applyDamage(damage * falloff, false, true, null);
    } else if (pOverlap && ownerIsPlayer) {
      // Self-splash: heavily reduced, but real. Do not fire rockets at your feet.
      const d = ctx.player.pos.distanceTo(center);
      const falloff = Math.max(0.15, 1 - d / radius);
      ctx.player.applyDamage(damage * falloff * 0.45, false, true, null);
    }
  }

  /* --- Environment --- */
  const destructibles = ctx.world.hittableObjects.filter((o) => o.userData && o.userData.destructible);
  for (const obj of destructibles) {
    obj.getWorldPosition(_v1);
    if (_v1.distanceTo(center) <= radius + 1.5) {
      ctx.world.damageEnvironmentalBlock(obj, 100, _v1.clone());
    }
  }

  /* --- VFX --- */
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.7, radius * 0.22), 16, 14),
    new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.95, depthWrite: false })
  );
  flash.position.copy(center);
  ctx.scene.add(flash);

  const light = new THREE.PointLight(0xff6611, 7.0, radius * 4.5);
  light.position.copy(center);
  light.position.y += 0.6;
  ctx.scene.add(light);

  explosionFx.push({ mesh: flash, light, life: 0.42, maxLife: 0.42, scale: 1, growth: radius * 2.6 });

  if (ctx.radarPing) ctx.radarPing(center.x, center.z, 'gunfire');
}

export function updateProjectiles(dt: number, ctx: CombatSystemsContext): void {
  const colliders = ctx.world.worldColliders;

  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const p = activeProjectiles[i];
    p.life -= dt;
    p.armed = true;

    p.prevPos.copy(p.pos);

    if (p.gravity !== 0) p.vel.y += p.gravity * dt;
    p.pos.addScaledVector(p.vel, dt);

    p.group.position.copy(p.pos);
    if (p.vel.lengthSq() > 0.0001) {
      _v1.copy(p.pos).add(p.vel);
      p.group.lookAt(_v1);
    }

    let detonate = false;
    const impact = p.pos.clone();

    /* --- Floor / ceiling --- */
    const floorY = ctx.world.getHighestSurface(p.pos.x, p.pos.z, p.pos.y);
    if (p.pos.y <= floorY + 0.08) {
      impact.set(p.pos.x, floorY + 0.08, p.pos.z);
      detonate = true;
    }

    /* --- Hard geometry along the travelled segment --- */
    if (!detonate) {
      for (let c = 0; c < colliders.length; c++) {
        const col = colliders[c];
        if (col.active === false) continue;
        if (p.pos.y < col.minY || p.pos.y > col.maxY) continue;
        if (
          segmentIntersectsAABB2D(
            p.prevPos.x, p.prevPos.z, p.pos.x, p.pos.z,
            col.minX, col.maxX, col.minZ, col.maxZ
          )
        ) {
          detonate = true;
          break;
        }
      }
    }

    /* --- Direct hit on a hostile --- */
    if (!detonate) {
      for (const bot of ctx.bots) {
        if (!bot.alive || bot.team === p.ownerTeam) continue;
        const r = botColliderRadius(bot) + 0.25;
        const h = botColliderHeight(bot);
        if (
          p.pos.x >= bot.pos.x - r && p.pos.x <= bot.pos.x + r &&
          p.pos.z >= bot.pos.z - r && p.pos.z <= bot.pos.z + r &&
          p.pos.y >= bot.pos.y && p.pos.y <= bot.pos.y + h
        ) {
          impact.copy(p.pos);
          detonate = true;
          break;
        }
      }
    }

    /* --- Direct hit on the player (enemy ordnance) --- */
    if (!detonate && ctx.player.alive && p.ownerTeam !== ctx.player.team) {
      const dxy = Math.hypot(p.pos.x - ctx.player.pos.x, p.pos.z - ctx.player.pos.z);
      if (dxy < PLAYER_BODY_RADIUS + 0.25 && Math.abs(p.pos.y - (ctx.player.pos.y - 0.9)) < 1.2) {
        impact.copy(p.pos);
        detonate = true;
      }
    }

    /* --- Smoke trail --- */
    p.trailTimer -= dt;
    if (p.kind === 'ROCKET' && p.trailTimer <= 0) {
      p.trailTimer = 0.035;
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x9aa0a6, transparent: true, opacity: 0.45, depthWrite: false })
      );
      puff.position.copy(p.pos);
      ctx.scene.add(puff);
      explosionFx.push({
        mesh: puff,
        light: null as unknown as THREE.PointLight,
        life: 0.5,
        maxLife: 0.5,
        scale: 1,
        growth: 1.6
      });
    }

    if (detonate || p.life <= 0) {
      if (detonate) {
        detonateExplosion(
          impact,
          p.splashRadius,
          p.splashDamage,
          p.ownerTeam,
          p.ownerIsPlayer,
          ctx,
          p.ownerIsPlayer ? 'player' : (ctx.bots.find((b) => b.id === p.ownerBotId) as Bot) || 'player'
        );
      }
      ctx.scene.remove(p.group);
      p.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
          else (m.material as THREE.Material)?.dispose();
        }
      });
      activeProjectiles.splice(i, 1);
    }
  }

  /* --- Explosion / smoke VFX --- */
  for (let i = explosionFx.length - 1; i >= 0; i--) {
    const fx = explosionFx[i];
    fx.life -= dt;
    const k = Math.max(0, fx.life / fx.maxLife);
    fx.scale += fx.growth * dt;
    fx.mesh.scale.setScalar(fx.scale);
    (fx.mesh.material as THREE.MeshBasicMaterial).opacity = k * 0.95;
    if (fx.light) fx.light.intensity = k * 7.0;

    if (fx.life <= 0) {
      ctx.scene.remove(fx.mesh);
      fx.mesh.geometry.dispose();
      (fx.mesh.material as THREE.Material).dispose();
      if (fx.light) ctx.scene.remove(fx.light);
      explosionFx.splice(i, 1);
    }
  }
}

/**
 * KINETIC_RAILGUN: ignores standard hitbox occlusion and damages every hostile
 * on the line out to `maxRange`. Returns the number of targets struck.
 */
export function fireRailPenetrator(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  ctx: CombatSystemsContext,
  damage: number,
  headshotMult: number,
  maxRange: number,
  shooterTeam: string,
  attacker: 'player' | Bot = 'player'
): number {
  const d = dir.clone().normalize();
  let hits = 0;

  for (const bot of ctx.bots) {
    if (!bot.alive || bot.team === shooterTeam) continue;

    const r = botColliderRadius(bot) + 0.3;
    const h = botColliderHeight(bot);

    // Closest approach of the ray to the bot's vertical axis.
    _v1.set(bot.pos.x - origin.x, bot.pos.y + h * 0.5 - origin.y, bot.pos.z - origin.z);
    const t = _v1.dot(d);
    if (t < 0 || t > maxRange) continue;

    _v2.copy(d).multiplyScalar(t).add(origin);
    const perp = Math.hypot(_v2.x - bot.pos.x, _v2.z - bot.pos.z);
    if (perp > r) continue;
    if (_v2.y < bot.pos.y - 0.1 || _v2.y > bot.pos.y + h + 0.1) continue;

    const headBandLow = bot.pos.y + h - 0.42;
    const isHead = _v2.y >= headBandLow;
    const dealt = damage * (isHead ? headshotMult : 1);

    ctx.damageBot(bot, dealt, isHead, attacker, d.clone());
    hits++;
  }

  // Penetrating slugs still chew through destructible cover on the line.
  const destructibles = ctx.world.hittableObjects.filter((o) => o.userData && o.userData.destructible);
  for (const obj of destructibles) {
    obj.getWorldPosition(_v1);
    _v2.copy(_v1).sub(origin);
    const t = _v2.dot(d);
    if (t < 0 || t > maxRange) continue;
    _v3.copy(d).multiplyScalar(t).add(origin);
    if (_v3.distanceTo(_v1) <= 1.4) {
      ctx.world.damageEnvironmentalBlock(obj, 75, _v3.clone());
    }
  }

  // Tracer
  const len = maxRange;
  const geo = new THREE.CylinderGeometry(0.03, 0.05, len, 6);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, len / 2);
  const tracer = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0xdde5ee, transparent: true, opacity: 0.9, depthWrite: false })
  );
  tracer.position.copy(origin);
  tracer.lookAt(origin.clone().add(d));
  ctx.scene.add(tracer);
  explosionFx.push({
    mesh: tracer,
    light: null as unknown as THREE.PointLight,
    life: 0.18,
    maxLife: 0.18,
    scale: 1,
    growth: 0
  });

  return hits;
}

/* =============================================================================
 * PART 4 — ELITE SQUAD PROTOCOL
 * ===========================================================================*/

export const activeRegenFields: RegenField[] = [];
export const activeTelemetryMarks: TelemetryMark[] = [];
export const activeTripods: DeployedTripod[] = [];

let regenFieldIdCounter = 1;
let tripodIdCounter = 1;
let playerMount: MountedGunSession | null = null;

export function isPlayerMounted(): boolean {
  return playerMount !== null;
}

export function getPlayerMountAnchor(): THREE.Vector3 | null {
  return playerMount ? playerMount.anchor : null;
}

export function getMountedTripod(): DeployedTripod | null {
  if (!playerMount) return null;
  return activeTripods.find((t) => t.id === playerMount!.tripodId) || null;
}

/* ------------------------------ TRIPOD MG ------------------------------ */

export function deployTripod(
  ctx: CombatSystemsContext,
  pos: THREE.Vector3,
  facing: number,
  builtByBotId: number
): DeployedTripod | null {
  if (activeTripods.length >= TRIPOD_MAX_ACTIVE) return null;

  const built = buildTripodMachineGun(0x2de2e6);
  built.group.position.copy(pos);
  built.group.position.y = ctx.world.getHighestSurface(pos.x, pos.z, pos.y);
  built.group.rotation.y = facing;
  ctx.scene.add(built.group);

  built.hitMeshes.forEach((m) => {
    m.userData = { type: 'building', destructible: false };
    ctx.world.registerHittable(m);
  });

  const collider: WorldCollider = {
    minX: built.group.position.x - 1.3,
    maxX: built.group.position.x + 1.3,
    minY: built.group.position.y,
    maxY: built.group.position.y + 1.05,
    minZ: built.group.position.z - 0.6,
    maxZ: built.group.position.z + 0.6,
    active: true,
    isTripod: true
  };
  ctx.world.worldColliders.push(collider);

  // Operator stands one pace behind the spade grips.
  const anchor = new THREE.Vector3(
    built.group.position.x - Math.sin(facing) * 1.25,
    built.group.position.y,
    built.group.position.z - Math.cos(facing) * 1.25
  );

  const tripod: DeployedTripod = {
    id: tripodIdCounter++,
    group: built.group,
    barrelPivot: built.barrelPivot,
    muzzlePoint: built.muzzlePoint,
    pos: built.group.position.clone(),
    facing,
    currentYaw: 0,
    currentPitch: 0,
    health: 400,
    maxHealth: 400,
    heat: 0,
    overheated: false,
    occupant: 'none',
    mountAnchor: anchor,
    fireCooldown: 0,
    builtByBotId,
    collider,
    alive: true,
    lifetime: 0
  };

  activeTripods.push(tripod);
  ctx.pushKillFeed('WRENCH-5: TRIPOD MG DEPLOYED — PRESS E TO MAN IT', true);
  return tripod;
}

/** Prompt text for the interaction ladder in App.tsx, or null if out of range. */
export function getTripodInteractionPrompt(
  playerPos: THREE.Vector3
): { prompt: string; tripod: DeployedTripod } | null {
  if (playerMount) {
    const mounted = getMountedTripod();
    if (mounted) {
      return { prompt: '[E] DISMOUNT TRIPOD MG', tripod: mounted };
    }
  }

  let best: DeployedTripod | null = null;
  let bestD = TRIPOD_MOUNT_RADIUS;

  for (const t of activeTripods) {
    if (!t.alive || t.occupant !== 'none') continue;
    const d = Math.hypot(playerPos.x - t.mountAnchor.x, playerPos.z - t.mountAnchor.z);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }

  if (!best) return null;
  return { prompt: '[E] MAN TRIPOD MG — 1000 RPM, ZERO RECOIL', tripod: best };
}

/**
 * Mount or dismount. Returns true when the E press was consumed, so the
 * interaction ladder in App.tsx can stop before doors and pickups.
 */
export function tryToggleTripodMount(ctx: CombatSystemsContext): boolean {
  if (playerMount) {
    if (playerMount.cooldown > 0) return true; // swallow, but too soon to dismount
    const tripod = getMountedTripod();
    if (tripod) {
      tripod.occupant = 'none';
      ctx.pushKillFeed('DISMOUNTED TRIPOD MG');
    }
    playerMount = null;
    return true;
  }

  const found = getTripodInteractionPrompt(ctx.player.pos);
  if (!found) return false;

  const tripod = found.tripod;
  if (tripod.occupant !== 'none') return false;

  tripod.occupant = 'player';
  playerMount = {
    tripodId: tripod.id,
    anchor: tripod.mountAnchor.clone(),
    mountedAt: performance.now() / 1000,
    cooldown: TRIPOD_MOUNT_COOLDOWN
  };
  ctx.pushKillFeed('MOUNTED TRIPOD MG — HOLD FIRE TO SUPPRESS', true);
  return true;
}

export function forceDismountPlayer(): void {
  if (!playerMount) return;
  const tripod = getMountedTripod();
  if (tripod) tripod.occupant = 'none';
  playerMount = null;
}

function clampTraverse(current: number, desired: number, limit: number): number {
  let delta = desired - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const next = current + delta;
  return Math.max(-limit, Math.min(limit, next));
}

/**
 * Fires one mounted round. Zero recoil by design — App must not add kick while
 * `isPlayerMounted()` is true. Enforces the 1000 RPM cadence internally.
 */
export function firePlayerMountedGun(ctx: CombatSystemsContext): boolean {
  const tripod = getMountedTripod();
  if (!tripod || !tripod.alive) return false;
  if (tripod.overheated) return false;
  if (tripod.fireCooldown > 0) return false;

  tripod.fireCooldown = TRIPOD_FIRE_INTERVAL;
  tripod.heat = Math.min(TRIPOD_MAX_HEAT, tripod.heat + TRIPOD_HEAT_PER_SHOT);
  if (tripod.heat >= TRIPOD_MAX_HEAT) {
    tripod.overheated = true;
    ctx.pushKillFeed('TRIPOD MG OVERHEATED — VENTING');
  }

  tripod.muzzlePoint.getWorldPosition(_v1);
  ctx.camera.getWorldDirection(_v2);

  const raycaster = new THREE.Raycaster(_v1.clone(), _v2.clone().normalize(), 0.2, TRIPOD_RANGE);
  const hits = raycaster.intersectObjects(ctx.world.hittableObjects, false);

  if (hits.length > 0) {
    const hit = hits[0];
    const ud = hit.object.userData;
    if (ud && ud.type === 'botpart' && ud.ref) {
      const bot = ud.ref as Bot;
      if (bot.team !== ctx.player.team) {
        const isHead = ud.part === 'head';
        const dmg = TRIPOD_DAMAGE * (isHead ? TRIPOD_HEADSHOT_MULT : 1);
        ctx.damageBot(bot, dmg, isHead, 'player', raycaster.ray.direction.clone());
      }
    } else if (ud && ud.destructible) {
      ctx.world.damageEnvironmentalBlock(hit.object, 6, hit.point.clone());
    }
  }

  if (ctx.radarPing) ctx.radarPing(tripod.pos.x, tripod.pos.z, 'gunfire');
  return true;
}

function fireTripodAtTarget(tripod: DeployedTripod, target: Bot | 'player', ctx: CombatSystemsContext): void {
  tripod.fireCooldown = TRIPOD_FIRE_INTERVAL * 2.4; // bot gunners are less greedy with the trigger
  tripod.heat = Math.min(TRIPOD_MAX_HEAT, tripod.heat + TRIPOD_HEAT_PER_SHOT);
  if (tripod.heat >= TRIPOD_MAX_HEAT) tripod.overheated = true;

  if (target === 'player') {
    if (ctx.player.alive) ctx.player.applyDamage(TRIPOD_DAMAGE * 0.55, false, false, null);
  } else {
    ctx.damageBot(target, TRIPOD_DAMAGE, false, 'player');
  }
  if (ctx.radarPing) ctx.radarPing(tripod.pos.x, tripod.pos.z, 'gunfire');
}

export function updateTripods(dt: number, ctx: CombatSystemsContext): void {
  if (playerMount && playerMount.cooldown > 0) playerMount.cooldown -= dt;

  for (let i = activeTripods.length - 1; i >= 0; i--) {
    const tripod = activeTripods[i];
    tripod.lifetime += dt;
    tripod.fireCooldown -= dt;

    // Cooling / vent recovery
    tripod.heat = Math.max(0, tripod.heat - TRIPOD_COOL_RATE * dt);
    if (tripod.overheated && tripod.heat <= TRIPOD_MAX_HEAT * 0.25) {
      tripod.overheated = false;
    }

    if (!tripod.alive || tripod.health <= 0) {
      if (tripod.occupant === 'player') forceDismountPlayer();
      tripod.collider.active = false;
      ctx.scene.remove(tripod.group);
      tripod.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          ctx.world.unregisterHittable(m);
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
          else (m.material as THREE.Material)?.dispose();
        }
      });
      activeTripods.splice(i, 1);
      continue;
    }

    /* ---- Aiming ---- */
    if (tripod.occupant === 'player') {
      // Barrel mirrors the player's view, clamped to the traverse arc.
      const desiredYaw = ctx.player.yaw - tripod.facing;
      tripod.currentYaw = clampTraverse(tripod.currentYaw, desiredYaw, TRIPOD_TRAVERSE_LIMIT);
      tripod.currentPitch = Math.max(-0.35, Math.min(0.45, ctx.player.pitch));
    } else if (typeof tripod.occupant === 'number') {
      const gunner = ctx.bots.find((b) => b.id === tripod.occupant && b.alive);
      if (!gunner) {
        tripod.occupant = 'none';
      } else {
        const acquired = nearestHostileToBot(gunner, ctx, TRIPOD_RANGE);
        if (acquired) {
          const dxT = acquired.pos.x - tripod.pos.x;
          const dzT = acquired.pos.z - tripod.pos.z;
          const desiredYaw = Math.atan2(dxT, dzT) - tripod.facing;
          const clamped = clampTraverse(tripod.currentYaw, desiredYaw, TRIPOD_TRAVERSE_LIMIT);
          const onTarget = Math.abs(clamped - desiredYaw) < 0.12;
          tripod.currentYaw = clamped;

          if (
            onTarget &&
            !tripod.overheated &&
            tripod.fireCooldown <= 0 &&
            !sightlineBlocked(tripod.pos, acquired.pos, ctx.world.worldColliders)
          ) {
            fireTripodAtTarget(tripod, acquired.target, ctx);
          }
        }
        // Gunner physically holds the anchor.
        gunner.pos.copy(tripod.mountAnchor);
        gunner.pos.y = ctx.world.getHighestSurface(gunner.pos.x, gunner.pos.z, gunner.pos.y);
        gunner.group.position.copy(gunner.pos);
        gunner.group.rotation.y = tripod.facing;
        gunner.vel.set(0, 0, 0);
      }
    } else {
      // Unmanned: slow idle sweep so the deployable reads as active.
      tripod.currentYaw = Math.sin(tripod.lifetime * 0.5) * 0.35;
      tripod.currentPitch = 0;

      // A nearby allied bot with nothing better to do will take the gun.
      if (ctx.squadDirective === 'hold_position') {
        for (const bot of ctx.bots) {
          if (!bot.alive || bot.team !== 'blue' || bot.mountedTripodId) continue;
          const d = Math.hypot(bot.pos.x - tripod.mountAnchor.x, bot.pos.z - tripod.mountAnchor.z);
          if (d < 3.5) {
            tripod.occupant = bot.id;
            bot.mountedTripodId = tripod.id;
            break;
          }
        }
      }
    }

    tripod.barrelPivot.rotation.y = tripod.currentYaw;
    tripod.barrelPivot.rotation.x = -tripod.currentPitch;
  }

  // Release bot gunners when the posture changes.
  if (ctx.squadDirective !== 'hold_position') {
    for (const tripod of activeTripods) {
      if (typeof tripod.occupant === 'number') {
        const gunner = ctx.bots.find((b) => b.id === tripod.occupant);
        if (gunner) gunner.mountedTripodId = null;
        tripod.occupant = 'none';
      }
    }
  }
}

export function clearTripods(ctx: { scene: THREE.Scene; world: WorldManager }): void {
  forceDismountPlayer();
  for (const tripod of activeTripods) {
    tripod.collider.active = false;
    ctx.scene.remove(tripod.group);
    tripod.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        ctx.world.unregisterHittable(m);
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
        else (m.material as THREE.Material)?.dispose();
      }
    });
  }
  activeTripods.length = 0;
}

/* --------------------------- ELITE DIRECTOR --------------------------- */

/**
 * Applies the four elite archetype behaviours and returns a desired world
 * position per bot. App.tsx's existing tether code should treat an entry here
 * as an override of the formation slot for that frame.
 */
export function updateEliteSquad(dt: number, ctx: CombatSystemsContext): Map<number, THREE.Vector3> {
  const overrides = new Map<number, THREE.Vector3>();
  const colliders = ctx.world.worldColliders;

  for (const bot of ctx.bots) {
    if (!bot.alive || !bot.isElite || bot.team !== 'blue') continue;
    if (bot.mountedTripodId) continue; // manning a gun; position is owned by updateTripods

    const acquired = nearestHostileToBot(bot, ctx, 70);

    switch (bot.eliteRole) {
      /* ---------------- TITAN-2 · HEAVY ---------------- */
      case 'heavy': {
        // Prefers open sightlines: sample positions around the player and keep
        // the one with clear LOS to the most hostiles.
        bot.highGroundTimer = (bot.highGroundTimer ?? 0) - dt;
        if (bot.highGroundTimer <= 0) {
          bot.highGroundTimer = 1.4;
          let bestScore = -1;
          let bestPos: THREE.Vector3 | null = null;

          for (let s = 0; s < 8; s++) {
            const a = (s / 8) * Math.PI * 2;
            const cand = new THREE.Vector3(
              ctx.player.pos.x + Math.cos(a) * 5.0,
              bot.pos.y,
              ctx.player.pos.z + Math.sin(a) * 5.0
            );
            let score = 0;
            for (const h of ctx.bots) {
              if (!h.alive || h.team === 'blue') continue;
              if (cand.distanceTo(h.pos) > 55) continue;
              if (!sightlineBlocked(cand, h.pos, colliders)) score++;
            }
            if (score > bestScore) {
              bestScore = score;
              bestPos = cand;
            }
          }
          bot.sightlineScore = bestScore;
          bot.highGroundTarget = bestPos;
        }

        if (bot.highGroundTarget) overrides.set(bot.id, bot.highGroundTarget.clone());

        // Continuous suppression: the heavy's trigger discipline is deliberately poor.
        if (!bot.tactical) bot.tactical = createTacticalState();
        if (acquired && !sightlineBlocked(bot.pos, acquired.pos, colliders)) {
          bot.tactical.stance = 'SUPPRESS';
          bot.tactical.spreadPenalty = TACTICAL_TUNING.suppressionSpread * 0.8;
          bot.tactical.fireRateMult = 0.45;
          bot.tactical.holdFire = false;
          if (acquired.target !== 'player') {
            const tb = acquired.target as Bot;
            tb.suppression = Math.min(1, (tb.suppression ?? 0) + dt * 0.8);
          }
        } else {
          bot.tactical.holdFire = true;
        }
        break;
      }

      /* ---------------- DOC-3 · MEDIC ---------------- */
      case 'medic': {
        const distToPlayer = bot.pos.distanceTo(ctx.player.pos);

        // Hard leash: never further than 10m from the operator.
        if (distToPlayer > MEDIC_LEASH_DISTANCE) {
          _v1.copy(ctx.player.pos).sub(bot.pos).setY(0).normalize();
          overrides.set(
            bot.id,
            ctx.player.pos.clone().addScaledVector(_v1, -MEDIC_LEASH_DISTANCE * 0.65)
          );
        }

        bot.regenFieldCooldown = (bot.regenFieldCooldown ?? 0) - dt;

        const anyoneHurt =
          ctx.player.health < ctx.player.maxHealth * 0.8 ||
          ctx.bots.some((b) => b.alive && b.team === 'blue' && b.health < b.maxHealth * 0.8);

        if (bot.regenFieldCooldown <= 0 && anyoneHurt) {
          bot.regenFieldCooldown = REGEN_FIELD_COOLDOWN;
          const mesh = buildRegenFieldMesh(REGEN_FIELD_RADIUS);
          const fieldPos = bot.pos.clone();
          fieldPos.y += 0.9;
          mesh.position.copy(fieldPos);
          ctx.scene.add(mesh);

          activeRegenFields.push({
            id: regenFieldIdCounter++,
            ownerBotId: bot.id,
            mesh,
            pos: fieldPos,
            radius: REGEN_FIELD_RADIUS,
            healPerSecond: REGEN_FIELD_HPS,
            life: REGEN_FIELD_DURATION,
            maxLife: REGEN_FIELD_DURATION
          });

          ctx.pushKillFeed('DOC-3: REGEN FIELD DEPLOYED (+15 HP/s)', true);
        }
        break;
      }

      /* ---------------- SPECTRE-4 · RECON ---------------- */
      case 'recon': {
        // Pushes high ground: sample the local surface for the highest standable spot.
        bot.highGroundTimer = (bot.highGroundTimer ?? 0) - dt;
        if (bot.highGroundTimer <= 0) {
          bot.highGroundTimer = 2.2;
          let bestY = -Infinity;
          let bestPos: THREE.Vector3 | null = null;

          for (let s = 0; s < 12; s++) {
            const a = (s / 12) * Math.PI * 2;
            const rad = 6 + (s % 3) * 4;
            const cx = ctx.player.pos.x + Math.cos(a) * rad;
            const cz = ctx.player.pos.z + Math.sin(a) * rad;
            const y = ctx.world.getHighestSurface(cx, cz, bot.pos.y);
            if (y > bestY) {
              bestY = y;
              bestPos = new THREE.Vector3(cx, y, cz);
            }
          }
          bot.highGroundTarget = bestPos;
        }
        if (bot.highGroundTarget) overrides.set(bot.id, bot.highGroundTarget.clone());

        // Telemetry ping every 15s: paint hostiles within 40m for 4s.
        bot.telemetryPingTimer = (bot.telemetryPingTimer ?? TELEMETRY_PING_INTERVAL) - dt;
        if (bot.telemetryPingTimer <= 0) {
          bot.telemetryPingTimer = TELEMETRY_PING_INTERVAL;
          let painted = 0;

          for (const hostile of ctx.bots) {
            if (!hostile.alive || hostile.team === 'blue') continue;
            if (bot.pos.distanceTo(hostile.pos) > TELEMETRY_PING_RADIUS) continue;
            if (activeTelemetryMarks.some((m) => m.botId === hostile.id)) continue;

            const marker = buildTelemetryMarker();
            hostile.group.add(marker);
            activeTelemetryMarks.push({
              botId: hostile.id,
              marker,
              life: TELEMETRY_MARK_DURATION,
              maxLife: TELEMETRY_MARK_DURATION
            });
            painted++;

            if (ctx.radarPing) ctx.radarPing(hostile.pos.x, hostile.pos.z, 'zombie');
          }

          if (painted > 0) {
            ctx.pushKillFeed(`SPECTRE-4: ${painted} HOSTILE${painted > 1 ? 'S' : ''} PAINTED`, true);
          }
        }
        break;
      }

      /* ---------------- WRENCH-5 · ENGINEER ---------------- */
      case 'engineer': {
        bot.tripodBuildCooldown = (bot.tripodBuildCooldown ?? 0) - dt;

        if (
          ctx.squadDirective === 'hold_position' &&
          (bot.tripodBuildCooldown ?? 0) <= 0 &&
          activeTripods.length < TRIPOD_MAX_ACTIVE
        ) {
          bot.tripodBuildCooldown = TRIPOD_BUILD_COOLDOWN;

          // Build two paces in front of the operator, facing the threat axis.
          const facing = acquired
            ? Math.atan2(acquired.pos.x - ctx.player.pos.x, acquired.pos.z - ctx.player.pos.z)
            : ctx.player.yaw;

          const buildPos = new THREE.Vector3(
            ctx.player.pos.x + Math.sin(facing) * 2.6,
            bot.pos.y,
            ctx.player.pos.z + Math.cos(facing) * 2.6
          );

          deployTripod(ctx, buildPos, facing, bot.id);
        }

        // Stays near the emplacement while the squad is anchored.
        if (ctx.squadDirective === 'hold_position' && activeTripods.length > 0) {
          const nearest = activeTripods[0];
          overrides.set(
            bot.id,
            new THREE.Vector3(nearest.pos.x + 1.6, bot.pos.y, nearest.pos.z - 1.2)
          );
        }
        break;
      }

      default:
        break;
    }
  }

  /* ---- Regen fields ---- */
  for (let i = activeRegenFields.length - 1; i >= 0; i--) {
    const field = activeRegenFields[i];
    field.life -= dt;

    const k = Math.max(0, field.life / field.maxLife);
    const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.03;
    field.mesh.scale.setScalar(pulse);
    (field.mesh.material as THREE.MeshBasicMaterial).opacity = 0.12 + k * 0.22;
    field.mesh.rotation.y += dt * 0.35;

    if (ctx.player.alive && ctx.player.pos.distanceTo(field.pos) <= field.radius) {
      ctx.player.heal(field.healPerSecond * dt);
    }
    for (const ally of ctx.bots) {
      if (!ally.alive || ally.team !== 'blue') continue;
      if (ally.pos.distanceTo(field.pos) <= field.radius) {
        ally.health = Math.min(ally.maxHealth, ally.health + field.healPerSecond * dt);
      }
    }

    if (field.life <= 0) {
      ctx.scene.remove(field.mesh);
      field.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          (m.material as THREE.Material)?.dispose();
        }
      });
      activeRegenFields.splice(i, 1);
    }
  }

  /* ---- Telemetry marks ---- */
  for (let i = activeTelemetryMarks.length - 1; i >= 0; i--) {
    const mark = activeTelemetryMarks[i];
    mark.life -= dt;

    const owner = ctx.bots.find((b) => b.id === mark.botId);
    const expired = mark.life <= 0 || !owner || !owner.alive;

    if (!expired) {
      const k = mark.life / mark.maxLife;
      mark.marker.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          (m.material as THREE.MeshBasicMaterial).opacity = 0.35 + k * 0.6;
        }
      });
      mark.marker.rotation.y += dt * 1.6;
    } else {
      if (mark.marker.parent) mark.marker.parent.remove(mark.marker);
      mark.marker.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          (m.material as THREE.Material)?.dispose();
        }
      });
      activeTelemetryMarks.splice(i, 1);
    }
  }

  return overrides;
}

/* =============================================================================
 * LIFECYCLE
 * ===========================================================================*/

/** Call at the top of initMatch() to wipe every persistent combat system. */
export function clearCombatSystems(scene: THREE.Scene, world: WorldManager): void {
  resetTacticalEngine();

  for (const p of activeProjectiles) {
    scene.remove(p.group);
  }
  activeProjectiles.length = 0;

  for (const fx of explosionFx) {
    scene.remove(fx.mesh);
    if (fx.light) scene.remove(fx.light);
  }
  explosionFx.length = 0;

  for (const field of activeRegenFields) {
    scene.remove(field.mesh);
  }
  activeRegenFields.length = 0;

  for (const mark of activeTelemetryMarks) {
    if (mark.marker.parent) mark.marker.parent.remove(mark.marker);
  }
  activeTelemetryMarks.length = 0;

  clearTripods({ scene, world });

  for (const puddle of activeToxicPuddles) {
    scene.remove(puddle.mesh);
  }
  activeToxicPuddles.length = 0;

  for (const ring of activeDistortionRings) {
    scene.remove(ring.mesh);
  }
  activeDistortionRings.length = 0;
}
