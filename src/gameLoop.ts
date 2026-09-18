import * as THREE from 'three';
import { WorldManager } from './world';
import { Bot, MutantType, ToxicPuddle, Sector4ObjectiveType } from './types';

export type { ToxicPuddle };

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
  hackProgress: number; // 0 to 100%
  hackDuration: number; // in seconds
  isHacking: boolean;

  // Sector 4 Dynamic Primary Objective
  sector4ObjectiveType: Sector4ObjectiveType;
  holdTheLineTimer: number;
  holdTheLineTotal: number;
  holdTheLineActive: boolean;
  holdTheLineComplete: boolean;

  breakerAlphaPulled: boolean;
  breakerBetaPulled: boolean;
  reactorOverrideComplete: boolean;

  volatileContainerDeposited: boolean;

  // Sector 3 Locked Optional Armory
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
  private cylinderTaken: boolean = false;
  private evacAudioTriggered: boolean = false;
  private armoryKeycardGroup: THREE.Group | null = null;

  constructor(config: ExtractionManagerConfig) {
    this.config = config;

    const objTypes: Sector4ObjectiveType[] = ['HOLD_THE_LINE', 'VOLATILE_CONTAINER', 'REACTOR_OVERRIDE'];
    const chosenObjType = objTypes[Math.floor(Math.random() * objTypes.length)];

    const initialTitle = chosenObjType === 'HOLD_THE_LINE'
      ? 'SECTOR 4: INITIATE MAINFRAME LOCKDOWN'
      : chosenObjType === 'VOLATILE_CONTAINER'
      ? 'PRIMARY OBJECTIVE: SECURE VOLATILE CANISTER'
      : 'SECTOR 4: DUAL REACTOR CIRCUIT OVERRIDE';

    const initialDetail = chosenObjType === 'HOLD_THE_LINE'
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
      missionDuration: 0,
    };
  }

  public update(dt: number, keys: Record<string, boolean>): {
    interactionPrompt: string | null;
    isPromptObjective: boolean;
  } {
    this.state.missionDuration += dt;
    const playerPos = this.config.player.pos;

    // 1. Calculate Current Sector along strict Z-axis
    let sector: 1 | 2 | 3 | 4 | 5 = 1;
    if (playerPos.z > -20) {
      sector = 1;
    } else if (playerPos.z > -60) {
      sector = 2;
    } else if (playerPos.z > -100) {
      sector = 3;
    } else if (playerPos.z > -140) {
      sector = 4;
    } else {
      sector = 5;
    }
    this.state.currentSector = sector;

    let interactionPrompt: string | null = null;
    let isPromptObjective = false;

    // 2. Animate and pulse Bio-Cylinder mesh if active
    if (this.config.world.bioCylinderGroup && !this.state.hasBioCylinder) {
      this.config.world.bioCylinderGroup.rotation.y += dt * 1.8;
      this.config.world.bioCylinderGroup.position.y = 1.2 + Math.sin(this.state.missionDuration * 3.5) * 0.08;
    }

    // 3. Sector 3 Optional Armory Keycard & Crate Handling
    // A. Keycard Pickup on the ground
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

    // B. Armory Crate Interaction (inside armory room at x = 13.0, z = -80.0)
    if (this.state.currentSector === 3 || playerPos.x >= 7.5) {
      const distToArmoryCrate = Math.hypot(playerPos.x - 13.0, playerPos.z - (-80.0));
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
              if ((c as THREE.Mesh).isMesh && ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive) {
                (((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive as THREE.Color).setHex(0x00ff88);
              }
            });
          }

          // Also spawn extra ammo pickups inside the room
          this.config.world.createGroundPickup(12.5, -81.5, 0, 90);
          this.config.world.createGroundPickup(13.5, -78.5, 5, 120);

          this.config.pushKillFeed('ARMORY LOOT CLAIMED: +100 HP, +100 SHIELD, FULL MUNITIONS CACHE!', true);
        }
      }
    }

    // 4. Dynamic Sector 4 Objective Processing
    const sec4Type = this.state.sector4ObjectiveType;

    if (sec4Type === 'HOLD_THE_LINE') {
      if (!this.state.holdTheLineComplete) {
        const distToConsole = Math.hypot(playerPos.x - 0, playerPos.z - (-120));
        if (!this.state.holdTheLineActive) {
          if (distToConsole < 4.0) {
            interactionPrompt = '[E] INITIATE 45s MAINFRAME LOCKDOWN DEFENSE';
            isPromptObjective = true;
            if (keys['KeyE']) {
              keys['KeyE'] = false;
              this.state.holdTheLineActive = true;
              this.state.stage = 'OBJECTIVE_ACTIVE';
              this.state.objectiveTitle = 'HOLD THE LINE: 45s';
              this.state.objectiveDetail = 'Mutant horde converging from North & South corridors! Defend the Mainframe!';
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

          // Spawn converging mutants every 2.4s from North (Z = -135) and South (Z = -105)
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
        // Breaker Alpha at (-11.35, 1.3, -115)
        const distA = Math.hypot(playerPos.x - (-11.35), playerPos.z - (-115));
        // Breaker Beta at (11.35, 1.3, -125)
        const distB = Math.hypot(playerPos.x - 11.35, playerPos.z - (-125));

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
          this.state.objectiveTitle = `REACTOR OVERRIDE: ${this.state.breakerAlphaPulled ? 'ALPHA ✔' : 'ALPHA ✖'} | ${this.state.breakerBetaPulled ? 'BETA ✔' : 'BETA ✖'}`;
          this.state.objectiveDetail = 'Engage Circuit Breakers on East and West walls in Sector 4.';
        }
      }
    } else if (sec4Type === 'VOLATILE_CONTAINER') {
      // In Sector 3 (Z = -80) retrieve leaking Bio-Cylinder
      if (!this.state.hasBioCylinder) {
        const distToCylinder = Math.hypot(playerPos.x - 0, playerPos.z - (-80));
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
        // Receptacle in Sector 5 at (0, 0.4, -155)
        const distToReceptacle = Math.hypot(playerPos.x - 0, playerPos.z - (-155));
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

    // 5. Sector 5 Mega-Boss Encounter
    if (sector === 5) {
      if (!this.state.bossSpawned) {
        this.state.bossSpawned = true;
        this.state.stage = 'BOSS_ENCOUNTER';
        this.state.objectiveTitle = 'CRITICAL ALERT: DESTROY SPECIMEN ZERO';
        this.state.objectiveDetail = 'Specimen Zero is guarding the Evac Elevator. Terminate it to escape!';

        // Spawn the Mega-Boss sitting flat on the floor at y = 0.0
        const boss = this.config.makeBot('zombie', 'megaboss', false);
        if (boss) {
          boss.pos.set(0, 0.0, -162);
          boss.group.position.copy(boss.pos);
          this.megaBossBot = boss;
        }

        // Accompanying escort mutants
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

          // Highlight Evac Pad
          if (this.config.world.evacPadMesh && (this.config.world.evacPadMesh.material as THREE.MeshStandardMaterial).emissive) {
            ((this.config.world.evacPadMesh.material as THREE.MeshStandardMaterial).emissive as THREE.Color).setHex(0x00ff88);
          }
          this.config.pushKillFeed('COMMAND: MEGA-BOSS TERMINATED! EVAC ELEVATOR ONLINE.', true);
        }
      }
    }

    // 6. Check Sector 5 Evac Zone Step-On Trigger
    // Evac Pad is at (0, 0.05, -170) with 5m x 5m bounds: X in [-2.8, 2.8], Z in [-173, -167]
    const onEvacPad = Math.abs(playerPos.x) <= 2.8 && playerPos.z <= -167 && playerPos.z >= -173;
    if (onEvacPad) {
      const objectiveCompleted =
        this.state.sector4ObjectiveType === 'HOLD_THE_LINE'
          ? this.state.holdTheLineComplete
          : this.state.sector4ObjectiveType === 'REACTOR_OVERRIDE'
          ? this.state.reactorOverrideComplete
          : this.state.volatileContainerDeposited;

      if (objectiveCompleted && this.state.bossDefeated) {
        // VICTORY ACHIEVED!
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

    // 7. Progressive Mutant-Only Spawning
    this.updateProgressiveSpawning(dt, playerPos.z, sector);

    return {
      interactionPrompt,
      isPromptObjective
    };
  }

  public canOpenDoor(doorPos: THREE.Vector3): { allowed: boolean; reason?: string } {
    // Sector 3 Optional Armory Door: X >= 8.5 and Z around -80
    if (doorPos.x >= 8.5 && Math.abs(doorPos.z - (-80)) < 4.5) {
      if (!this.state.hasArmoryKeycard) {
        return {
          allowed: false,
          reason: 'SECURITY LOCKED: REQUIRES ARMORY KEYCARD (ELIMINATE SECTOR 3 BRUTE)'
        };
      }
      this.state.armoryDoorOpened = true;
      if (this.config.world.armoryKeypadMesh && (this.config.world.armoryKeypadMesh.material as THREE.MeshStandardMaterial).emissive) {
        ((this.config.world.armoryKeypadMesh.material as THREE.MeshStandardMaterial).emissive as THREE.Color).setHex(0x00ff88);
      }
      return { allowed: true };
    }

    // Door 1: Z = -20 (Sector 1 to Corridor/Sector 2)
    if (Math.abs(doorPos.z - (-20)) < 2.0) {
      return { allowed: true };
    }

    // Door 2: Z = -60 (Sector 2 to Corridor/Sector 3)
    if (Math.abs(doorPos.z - (-60)) < 2.0) {
      return { allowed: true };
    }

    // Door 3: Z = -100 (Sector 3 to Corridor/Sector 4)
    if (Math.abs(doorPos.z - (-100)) < 2.0) {
      return { allowed: true };
    }

    // Door 4: Z = -140 (Sector 4 to Corridor/Sector 5)
    if (Math.abs(doorPos.z - (-140)) < 2.0) {
      if (this.state.sector4ObjectiveType === 'HOLD_THE_LINE' && !this.state.holdTheLineComplete) {
        return {
          allowed: false,
          reason: 'AIRLOCK SEALED: DEFEND MAINFRAME FOR 45 SECONDS FIRST'
        };
      }
      if (this.state.sector4ObjectiveType === 'REACTOR_OVERRIDE' && !this.state.reactorOverrideComplete) {
        return {
          allowed: false,
          reason: 'AIRLOCK SEALED: OVERRIDE BOTH CIRCUIT BREAKERS FIRST'
        };
      }
      if (this.state.sector4ObjectiveType === 'VOLATILE_CONTAINER' && !this.state.hasBioCylinder) {
        return {
          allowed: false,
          reason: 'AIRLOCK SEALED: RETRIEVE LEAKING VOLATILE BIO-CANISTER FIRST'
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }

  private updateProgressiveSpawning(dt: number, playerZ: number, sector: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    // Reset spawn timer (spawns waves every 5.0 to 7.5 seconds)
    this.spawnTimer = 5.0 + Math.random() * 2.5;

    // Count alive mutants
    const aliveMutants = this.config.bots.filter(b => b.alive && b.isZombie).length;
    if (aliveMutants >= 18) return;

    // Determine mutant types based on player's current sector progress
    let allowedTypes: string[] = [];
    if (sector === 1 || sector === 2) {
      allowedTypes = ['walker', 'walker', 'runner'];
    } else if (sector === 3 || sector === 4) {
      allowedTypes = ['runner', 'brute', 'banshee', 'bloater'];
    } else {
      allowedTypes = ['banshee', 'bloater', 'brute', 'runner'];
    }

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
    // Ground mutants sit flat on the floor at y = 0.0m; Banshees hover at y = 1.2m
    bot.pos.set(spawnX, isBanshee ? 1.2 : 0.0, spawnZ);
    bot.group.position.copy(bot.pos);
  }

  public recordMutantKill(bot?: Bot): void {
    this.state.mutantsKilled++;
    // Sector 3 Nugget Brute Keycard Drop
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

// ---------------------------------------------------------------------------
// BIO-MUTANT BEHAVIORAL MATRIX & HAZARD SIMULATION ENGINE
// ---------------------------------------------------------------------------

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
    opacity: 0.82,
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
    dps: 10,
  };
  activeToxicPuddles.push(puddle);
  return puddle;
}

export function updateToxicPuddles(
  dt: number,
  scene: THREE.Scene,
  player: { pos: THREE.Vector3; alive: boolean; applyDamage: (dmg: number, isHeadshot: boolean, isExplosion: boolean, attacker: any) => void },
  bots: Bot[],
  damageBot?: (bot: Bot, amount: number, isHeadshot: boolean, attacker: any) => void
): void {
  for (let i = activeToxicPuddles.length - 1; i >= 0; i--) {
    const puddle = activeToxicPuddles[i];
    puddle.duration -= dt;

    // Emissive bubbling pulse
    const mat = puddle.mesh.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissiveIntensity = 0.8 + Math.sin(puddle.duration * 5.0) * 0.35;
      if (puddle.duration < 1.8) {
        mat.opacity = Math.max(0, (puddle.duration / 1.8) * 0.82);
      }
    }

    // 10 DPS hazard to player standing in puddle
    if (player.alive) {
      const dPlayer = Math.hypot(player.pos.x - puddle.pos.x, player.pos.z - puddle.pos.z);
      if (dPlayer <= puddle.radius) {
        player.applyDamage(puddle.dps * dt, false, false, null);
      }
    }

    // 10 DPS hazard to friendly squad bots standing in puddle
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
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(pos.x, pos.y + 0.6, pos.z);
  scene.add(ring);

  activeDistortionRings.push({
    mesh: ring,
    life: 0.75,
    maxLife: 0.75,
    maxRadius: 18.0,
  });
}

export function updateSonicDistortionRings(dt: number, scene: THREE.Scene): void {
  for (let i = activeDistortionRings.length - 1; i >= 0; i--) {
    const ring = activeDistortionRings[i];
    ring.life -= dt;
    const progress = 1 - Math.max(0, ring.life) / ring.maxLife;

    const currentScale = 1 + progress * (ring.maxRadius - 1);
    ring.mesh.scale.set(currentScale, currentScale, currentScale);

    const mat = ring.mesh.material as THREE.MeshBasicMaterial;
    if (mat) {
      mat.opacity = Math.max(0, (1 - progress) * 0.9);
    }

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

  // Spawn persistent green toxic floor puddle (radius: 3.5m, duration: 8 seconds, 10 DPS)
  spawnToxicPuddle(ctx.scene, bot.pos);
  ctx.pushKillFeed('HAZARD: BLOATER DETONATED! TOXIC PUDDLE PERSISTS FOR 8s!');

  bot.alive = false;
  bot.health = 0;
  bot.deathT = 2.8;
  bot.group.visible = false;
}

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

export function updateBioMutantAI(bot: Bot, dt: number, ctx: BioMutantAIContext): void {
  if (!bot.alive) return;

  const mType: MutantType = bot.mutantType || (
    bot.zType === 'runner' ? 'RUNNER' :
    bot.zType === 'brute' ? 'BRUTE' :
    bot.zType === 'banshee' ? 'BANSHEE' :
    bot.zType === 'bloater' ? 'BLOATER' :
    bot.zType === 'megaboss' ? 'MEGABOSS' : 'WALKER'
  );
  bot.mutantType = mType;

  // Stagger state handling (e.g. Brute armor broken by focus fire or high-caliber impact)
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

  // Stun state handling (e.g. Banshee sonic pulse stun)
  if (bot.stunTimer && bot.stunTimer > 0) {
    bot.stunTimer -= dt;
    bot.vel.set(0, 0, 0);
    return;
  }

  // Bloater Swelling & Exploding State
  if (bot.isExploding) {
    bot.explosionTimer = (bot.explosionTimer ?? 0.6) - dt;
    const elapsed = 0.6 - Math.max(0, bot.explosionTimer);
    const swell = 1 + (elapsed / 0.6) * 1.8;
    bot.group.scale.set(1.15 * swell, 0.944 * swell, 1.15 * swell);

    bot.flashMats.forEach(m => {
      if (m.emissive) {
        m.emissive.setHex(0x22c55e);
        m.emissiveIntensity = 2.5 + Math.sin(performance.now() * 0.04) * 2.0;
      }
    });

    bot.vel.set(0, 0, 0);
    if (bot.explosionTimer <= 0) {
      detonateBloater(bot, ctx);
    }
    return;
  }

  // 1. Target Acquisition (Player vs Squad Allies)
  let targetPos: THREE.Vector3 | null = null;
  let targetIsPlayer = false;
  let targetAlly: Bot | null = null;
  let closestDist = Infinity;

  if (ctx.player.alive) {
    closestDist = bot.pos.distanceTo(ctx.player.pos);
    targetPos = ctx.player.pos;
    targetIsPlayer = true;
  }

  // Check if an ally bot is closer or attacking this mutant
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

  if (bot.attackCooldown && bot.attackCooldown > 0) {
    bot.attackCooldown -= dt;
  }
  if (bot.meleeCooldown > 0) {
    bot.meleeCooldown -= dt;
  }

  // 2. Behavioral Matrix by Mutant Type
  switch (mType) {
    case 'WALKER': {
      // Walker (Standard Meatshield): Slow 1.8 m/s, directly pathfinds to flood corridors
      bot.speed = 1.8;
      bot.attackRange = 1.4;
      const moveSpeed = 1.8;

      bot.vel.x = ndx * moveSpeed;
      bot.vel.z = ndz * moveSpeed;
      bot.facing = Math.atan2(dx, dz);
      bot.group.rotation.y = bot.facing;

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 0.9;
        if (targetIsPlayer && ctx.player.alive) {
          ctx.player.applyDamage(16, false, false, bot);
        } else if (targetAlly && targetAlly.alive) {
          ctx.damageBot(targetAlly, 16, false, bot);
        }
      }
      break;
    }

    case 'RUNNER': {
      // Runner (Aggressive Flanker): Very fast 5.2 m/s. Sine-wave weaving. Targets player rear arc!
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

      // Sine-wave side-to-side offset to weave around gunfire
      bot.weavePhase = (bot.weavePhase ?? (bot.id * 1.5)) + dt * 6.5;
      const perpX = -steerZ;
      const perpZ = steerX;
      const weaveOffset = Math.sin(bot.weavePhase) * 1.8;

      const runSpeed = 5.2;
      bot.vel.x = steerX * runSpeed + perpX * weaveOffset;
      bot.vel.z = steerZ * runSpeed + perpZ * weaveOffset;

      bot.facing = Math.atan2(bot.vel.x, bot.vel.z);
      bot.group.rotation.y = bot.facing;

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 0.5;
        if (targetIsPlayer && ctx.player.alive) {
          ctx.player.applyDamage(14, false, false, bot);
        } else if (targetAlly && targetAlly.alive) {
          ctx.damageBot(targetAlly, 14, false, bot);
        }
      }
      break;
    }

    case 'BRUTE': {
      // Nugget Brute (Choke-Point Tank): Medium-slow 2.2 m/s. Wide AABB collider (width 1.8m, height 2.2m).
      bot.speed = 2.2;
      bot.attackRange = 2.0;
      const moveSpeed = 2.2;

      bot.vel.x = ndx * moveSpeed;
      bot.vel.z = ndz * moveSpeed;
      bot.facing = Math.atan2(dx, dz);
      bot.group.rotation.y = bot.facing;

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 1.2;
        if (targetIsPlayer && ctx.player.alive) {
          ctx.player.applyDamage(32, false, false, bot);
        } else if (targetAlly && targetAlly.alive) {
          ctx.damageBot(targetAlly, 32, false, bot);
        }
      }
      break;
    }

    case 'BANSHEE': {
      // Banshee (Distortion Disruptor): Fast 4.0 m/s. Hover height: 1.2m off floor.
      // Maintains 8.0m stand-off distance behind other zombies!
      // Every 6s: sonic wave emits visual distortion ring, scrambles minimap radar (3s), stuns squad bots (1.5s).
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

      // Special Ability: Sonic Distortion Pulse (every 6.0 seconds)
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
        if (targetIsPlayer && ctx.player.alive) {
          ctx.player.applyDamage(18, false, false, bot);
        } else if (targetAlly && targetAlly.alive) {
          ctx.damageBot(targetAlly, 18, false, bot);
        }
      }
      break;
    }

    case 'BLOATER': {
      // Bloater (Area-Denial Hazard): Slow 1.5 m/s. Waddles toward squad.
      // Proximity <= 2.0m starts rapid swelling and detonation into 8s toxic puddle!
      bot.speed = 1.5;
      bot.attackRange = 2.0;

      const waddleRoll = Math.sin(performance.now() * 0.008 + bot.id) * 0.14;
      bot.group.rotation.z = waddleRoll;

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
      // Mega-Boss (Sector 5 Apex Encounter): Dynamic speed (2.5 m/s, charges at 6.0 m/s below 50% HP).
      // Periodic roar force-spawns 3x Runners and 1x Brute from adjacent vents!
      const isEnraged = bot.health < bot.maxHealth * 0.5;
      bot.isCharging = isEnraged;
      bot.speed = isEnraged ? 6.0 : 2.5;
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
            const isBansheeType = type === 'banshee';
            spawnBot.pos.set(
              bot.pos.x + Math.sin(offsetAngle) * offsetDist,
              isBansheeType ? 1.2 : 0.0,
              bot.pos.z + Math.cos(offsetAngle) * offsetDist
            );
            spawnBot.group.position.copy(spawnBot.pos);
          }
        }
      }

      if (dist <= bot.attackRange && (bot.attackCooldown ?? 0) <= 0) {
        bot.attackCooldown = 1.4;
        if (targetIsPlayer && ctx.player.alive) {
          ctx.player.applyDamage(45, false, false, bot);
        } else if (targetAlly && targetAlly.alive) {
          ctx.damageBot(targetAlly, 45, false, bot);
        }
      }
      break;
    }
  }

  // 3. Collision & Physics Movement with differentiated hitboxes
  const colRadius = mType === 'BRUTE' ? 0.9 :
    mType === 'MEGABOSS' ? 1.1 :
    mType === 'BLOATER' ? 0.55 :
    mType === 'RUNNER' ? 0.35 : 0.38;

  const colHeight = mType === 'BRUTE' ? 2.2 :
    mType === 'MEGABOSS' ? 2.8 :
    mType === 'BLOATER' ? 1.7 :
    mType === 'BANSHEE' ? 2.0 :
    mType === 'RUNNER' ? 1.3 : 1.8;

  if (mType !== 'BANSHEE') {
    // Ground mutants: Sit flat on the floor at y = 0.0m offset
    const floorY = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, bot.pos.y);
    bot.pos.y = floorY;
    ctx.world.moveEntityWithCollision(
      bot.pos,
      bot.vel,
      colRadius,
      bot.pos.y,
      bot.pos.y + colHeight,
      dt
    );
    const postFloorY = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, bot.pos.y);
    bot.pos.y = postFloorY;
  } else {
    // Banshee: Explicit hovering altitude at y = 1.2m above floor with sine-wave float
    bot.pos.x += bot.vel.x * dt;
    bot.pos.z += bot.vel.z * dt;
    const baseFloorY = ctx.world.getHighestSurface(bot.pos.x, bot.pos.z, 0);
    bot.pos.y = baseFloorY + 1.2 + Math.sin(performance.now() * 0.0035 + bot.id) * 0.16;
  }

  bot.group.position.copy(bot.pos);

  // 4. Walk phase animation
  const isMoving = bot.vel.lengthSq() > 0.05;
  if (isMoving) {
    bot.walkPhase = (bot.walkPhase || 0) + dt * (bot.speed * 2.5);
    const swing = Math.sin(bot.walkPhase) * 0.45;

    if (bot.legLPivot && bot.legRPivot && mType !== 'BANSHEE') {
      bot.legLPivot.rotation.x = swing;
      bot.legRPivot.rotation.x = -swing;
    }
    if (bot.armLPivot && bot.armRPivot) {
      if (mType === 'RUNNER') {
        bot.armLPivot.rotation.x = -0.5 + Math.sin(bot.walkPhase) * 0.2;
        bot.armRPivot.rotation.x = -0.5 - Math.sin(bot.walkPhase) * 0.2;
      } else {
        bot.armLPivot.rotation.x = -swing * 0.8;
        bot.armRPivot.rotation.x = swing * 0.8;
      }
    }
  }
}
