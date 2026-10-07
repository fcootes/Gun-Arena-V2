import * as THREE from "three";
import { ExtractionGameLoop } from "./gameLoop";
import type { ExtractionManagerConfig } from "./gameLoop";
import type { Bot, CampaignEntity } from "./types";
import { audioManager } from "./campaignAudio";

/** Faction-safe finite encounters with boss references retained through corpse cleanup. */
export class Area51ExtractionGameLoop extends ExtractionGameLoop {
  private mission: ExtractionManagerConfig;
  private bosses: Bot[] = [];
  private encounters = new Set<number>();
  private spawnClock = 1;
  private pending: { zone: number; remaining: number } | null = null;
  private ended = false;
  private radioClock = 7;
  private eyeOffset: number;
  constructor(config: ExtractionManagerConfig) {
    super(config);
    this.mission = config;
    const facility = config.world.facility;
    if (!facility) throw new Error("Area 51 campaign requires facility world");
    facility.setFaction(config.faction);
    this.eyeOffset = config.player.pos.y;
    this.state.campaign = "area51";
    this.state.sector4ObjectiveType = "HOLD_THE_LINE";
    this.state.hackDuration = 8;
    this.state.objectiveTitle =
      config.faction === "usmc"
        ? "SECURE THE BIOLOGICAL VIAL"
        : "PURGE THE USMC MAINFRAME";
    this.state.objectiveDetail =
      "Advance through Staging and Decontamination to the central Bio-Lab. Use E at the objective.";
  }
  private spawnEnemy(zone: number, boss = false, index = 0): Bot {
    const { world, faction, makeBot } = this.mission;
    const entity: CampaignEntity =
      faction === "apex"
        ? boss
          ? "spartan"
          : zone === 1
            ? "security"
            : "marine"
        : "marine";
    const bot: Bot =
      faction === "apex"
        ? makeBot("red", undefined, false, undefined, entity)
        : makeBot(
            "zombie",
            boss
              ? "megaboss"
              : zone === 1
                ? "walker"
                : zone === 2
                  ? index % 2
                    ? "runner"
                    : "walker"
                  : ["runner", "brute", "bloater"][index % 3],
            false,
          );
    const points = world
      .getSpawnPoints("ffa")
      .filter((p) => world.facility!.getZone(p.position) === zone);
    const point =
      points[index % points.length]?.position ?? world.facility!.bossPosition;
    bot.pos.copy(point);
    bot.patrolAnchor = point.clone();
    bot.group.position.copy(bot.pos);
    if (boss) {
      if (faction === "usmc") {
        bot.pos.copy(world.facility!.bossPosition);
        bot.pos.y = 24;
        bot.health = bot.maxHealth = 1600;
      } else {
        bot.pos.set(index % 2 ? -16 : 16, 15, -190 + index * 6);
        bot.armor = bot.maxArmor = 140;
        bot.health = bot.maxHealth = Math.max(420, bot.health);
      }
      bot.group.position.copy(bot.pos);
      bot.userData = {
        ...bot.userData,
        entranceActive: true,
        entryStart: bot.pos.clone(),
      };
      this.bosses.push(bot);
    }
    return bot;
  }
  private spawnThreat() {
    if (this.state.bossSpawned) return;
    this.state.bossSpawned = true;
    this.state.stage = "BOSS_ENCOUNTER";
    this.state.objectiveTitle =
      this.state.faction === "usmc"
        ? "TERMINATE THE ABOMINATION"
        : "ELIMINATE SPARTAN SQUAD";
    this.state.objectiveDetail =
      "Pickup has arrived, let's get the hell out of here! Clear the warehouse threat to unlock the rear blast doors.";
    const count = this.state.faction === "usmc" ? 1 : 3;
    for (let i = 0; i < count; i++) this.spawnEnemy(4, true, i);
    audioManager.play("evac_inbound");
    if (this.state.faction === "apex") audioManager.play("spartan_radio");
    this.mission.pushKillFeed(
      this.state.faction === "usmc"
        ? "ABOMINATION: CEILING BREACH!"
        : "SPARTAN SQUAD: REAR SECURITY BREACH!",
      true,
    );
  }
  update(dt: number, keys: Record<string, boolean>) {
    const { world, player } = this.mission,
      facility = world.facility!;
    if (this.ended)
      return { interactionPrompt: null, isPromptObjective: false };
    this.state.missionDuration += dt;
    this.state.currentSector = facility.getZone(player.pos);
    const zone = this.state.currentSector;
    // Encounters are finite and capped; no ever-growing horde in either campaign.
    if (zone < 4 && !this.encounters.has(zone)) {
      this.encounters.add(zone);
      this.pending = { zone, remaining: zone === 1 ? 6 : zone === 2 ? 8 : 10 };
      this.spawnClock = 0.2;
    }
    if (this.pending && facility.phase === "INFILTRATE") {
      this.spawnClock -= dt;
      if (
        this.spawnClock <= 0 &&
        this.mission.bots.filter((b: Bot) => b.alive && b.team !== "blue")
          .length < 18
      ) {
        this.spawnEnemy(this.pending.zone, false, this.pending.remaining);
        this.pending.remaining--;
        this.spawnClock = 2.5;
        if (this.pending.remaining <= 0) this.pending = null;
      }
    }
    let interactionPrompt: string | null = null;
    const pressed = () => {
      if (!keys.KeyE) return false;
      keys.KeyE = false;
      return true;
    };
    if (
      !facility.objectiveComplete &&
      zone === 3 &&
      player.pos.distanceTo(facility.objectivePosition) < 3.5
    ) {
      if (this.state.faction === "usmc") {
        interactionPrompt = "[E] SECURE BLUE BIOLOGICAL VIAL";
        if (pressed()) {
          this.state.hasBioCylinder = true;
          facility.objectiveComplete = true;
          world.bioCylinderGroup!.visible = false;
        }
      } else {
        interactionPrompt = this.state.isHacking
          ? `PURGING SERVER: ${Math.floor((this.state.hackProgress / this.state.hackDuration) * 100)}%`
          : "[E] UPLOAD SERVER PURGE CODE";
        if (pressed()) this.state.isHacking = !this.state.isHacking;
        if (this.state.isHacking) {
          this.state.stage = "HACKING";
          this.state.hackProgress = Math.min(
            this.state.hackDuration,
            this.state.hackProgress + dt,
          );
          if (this.state.hackProgress >= this.state.hackDuration) {
            facility.objectiveComplete = true;
            this.state.mainframeHacked = true;
            this.state.isHacking = false;
          }
        }
      }
      if (facility.objectiveComplete) {
        this.state.stage = "PROCEED_EVAC";
        this.state.objectiveTitle = "REACH THE LEVEL 4 LIFT";
        this.state.objectiveDetail =
          "Use the lift at the west side of the Bio-Lab. Dispatch evacuation at the upper warehouse console.";
        this.mission.pushKillFeed(
          this.state.faction === "usmc"
            ? "BIO VIAL SECURED"
            : "SERVER PURGE COMPLETE",
          true,
        );
      }
    } else this.state.isHacking = false;
    if (
      !facility.controlsLocked && facility.isNearLift(player.pos)
    ) {
      const upper = player.pos.y > 10;
      interactionPrompt =
        !upper && !facility.objectiveComplete
          ? "LIFT LOCKED: COMPLETE THE BIO-LAB OBJECTIVE"
          : upper
            ? "[E] RETURN TO BIO-LAB"
            : "[ E ] - ENTER ELEVATOR (LEVEL 4 WAREHOUSE)";
      if (
        (upper || facility.objectiveComplete) &&
        pressed() &&
        facility.transferLift(player.pos, upper ? 0 : 15, this.eyeOffset)
      ) {
        interactionPrompt = "ELEVATOR IN TRANSIT";
      }
    }
    if (
      zone === 4 &&
      facility.phase === "ARRIVAL" &&
      player.pos.distanceTo(facility.consolePosition) < 3.5
    ) {
      interactionPrompt = "[E] DISPATCH HELICOPTER EVACUATION";
      if (pressed() && facility.activateEvac()) this.spawnThreat();
    }
    if (facility.phase === "INTRO") {
      interactionPrompt = "EVAC INBOUND // THREAT DETECTED";
      const t = THREE.MathUtils.smoothstep(facility.introElapsed / 3, 0, 1);
      this.bosses.forEach((bot, i) => {
        const start = bot.userData!.entryStart as THREE.Vector3;
        if (this.state.faction === "usmc") {
          bot.pos.copy(start);
          bot.pos.y = 15 + (1 - t) * 9;
        } else bot.pos.set(start.x * (1 - 0.35 * t), 15, start.z + 8 * t);
        bot.group.position.copy(bot.pos);
        bot.fireTimer = 1;
        bot.vel.set(0, 0, 0);
      });
    } else if (facility.phase === "BOSS") {
      this.bosses.forEach((b) => {
        if (b.userData) b.userData.entranceActive = false;
      });
      if (this.bosses.length && this.bosses.every((b) => !b.alive)) {
        this.unlockEvac();
      }
      this.radioClock -= dt;
      if (this.state.faction === "apex" && this.radioClock <= 0) {
        this.radioClock = 7 + Math.random() * 4;
        audioManager.play("spartan_radio");
      }
    }
    if (facility.phase === "BOARD") {
      interactionPrompt =
        player.pos.z < -203 ? "ENTER THE HELICOPTER CABIN TO BOARD" : null;
      if (facility.tryBoard(player.pos)) {
        audioManager.play("rotor");
        this.state.objectiveTitle = "SQUAD BOARDED // DEPARTING";
        this.state.objectiveDetail = "Evacuation transport lifting off.";
        let seat = 0;
        for (const bot of this.mission.bots as Bot[])
          if (bot.alive && bot.team === "blue") {
            bot.userData = { ...bot.userData, boarded: true };
            bot.healthEl.style.display = "none";
            bot.pos.set(
              seat % 2 ? -0.95 : 0.95,
              0.8,
              -0.7 + (Math.floor(seat / 2) % 3) * 0.9,
            );
            bot.group.visible = seat < 6;
            facility.helicopter.group.add(bot.group);
            bot.group.position.copy(bot.pos);
            bot.group.rotation.set(0, seat % 2 ? -Math.PI / 2 : Math.PI / 2, 0);
            seat++;
          }
      }
    }
    if (facility.phase === "COMPLETE") {
      this.ended = true;
      this.state.stage = "COMPLETED";
      audioManager.stop();
      this.mission.onVictory();
    }
    return { interactionPrompt, isPromptObjective: interactionPrompt !== null };
  }
  private unlockEvac() {
    if (this.state.bossDefeated) return;
    this.state.bossDefeated = true;
    this.state.evacReady = true;
    this.state.stage = "EVAC_READY";
    this.mission.world.facility!.openBlastDoors();
    audioManager.play("blast_doors");
    this.state.objectiveTitle = "BOARD THE EXTRACTION HELICOPTER";
    this.state.objectiveDetail =
      "Rear blast doors are opening. Cross the rainy helipad and walk into the open cabin.";
    this.mission.pushKillFeed("WAREHOUSE SECURED // HELIPAD ACCESS OPEN", true);
  }
  recordBossDefeated() {
    if (this.bosses.length && this.bosses.every((b) => !b.alive))
      this.unlockEvac();
  }
  recordMutantKill(_bot?: Bot) {
    this.state.mutantsKilled++;
  }
  canOpenDoor(_position?: THREE.Vector3): { allowed: boolean; reason?: string } {
    return { allowed: this.state.bossDefeated };
  }
}
