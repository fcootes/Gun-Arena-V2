import {beginPlasmaAction,advancePlasmaAction,cancelPlasmaAction} from './plasmaMechanics';
import {beginRailgunReload,advanceRailgunReload,type RailgunListener} from './railgunMechanics';
import { LMG, lmgCue, lmgPhaseSeconds, type LmgListener } from './lmgMechanics';
import { SMG } from './smgMechanics';
import type { WeaponDef, WeaponSlotState } from './types';
import { SHOTGUN, advanceShotgunCycle, beginShotgunCycle, type ShotgunEventListener } from './shotgunMechanics';
import { SNIPER, advanceSniperAction, type SniperBoltListener } from './sniperMechanics';
import { BATTLE_RIFLE, brCueTime, type BattleRifleListener } from './battleRifleMechanics';

export type ReloadPhase = 'open' | 'eject' | 'pickup' | 'insert' | 'chamber' | 'close' | 'vent' | 'lift' | 'feed' | 'slap' | 'present' | 'unlock' | 'retract' | 'slideForward' | 'raiseCradle' | 'lowerCradle' | 'lock' | 'recover' | 'react';
export type ReloadPhaseListener = (phase: ReloadPhase, duration: number, empty: boolean) => void;
export interface ReloadSequence {
  kind: 'magazine' | 'shell' | 'battery' | 'tube' | 'cylinder' | 'vent' | 'railgun' | 'plasmaSwap' | 'plasmaVent';
  phases: { phase: ReloadPhase; duration: number }[];
  index: number;
  elapsed: number;
  empty: boolean;
  shellsRemaining: number;
  inserted: number;
  plasmaHadCylinder?:boolean;plasmaStartHeat?:number;plasmaForcedVent?:boolean;plasmaSpeed?:number;plasmaAligned?:boolean;
  shellSeated?: boolean;
  brCuePlayed?: boolean;
  lmgCuePlayed?: boolean;
  railgunEjectTilt?:number;railgunStartCradle?:number;railgunStartCover?:number;railgunStartLatch?:number;railgunSpeed?:number;railgunCuePlayed?:boolean;railgunHadCarrier?:boolean;railgunRecoveryOnly?:boolean;
}

export function cancelWeaponReload(state: WeaponSlotState) {
  if(state.reloadSequence?.kind==='plasmaSwap'||state.reloadSequence?.kind==='plasmaVent')cancelPlasmaAction(state);
  state.reloading = false; state.reloadT = 0; state.reloadSequence = undefined;
}

export function beginWeaponReload(weapon: WeaponDef, state: WeaponSlotState, multiplier = 1, playerHandling = true): boolean {
  if (weapon.type !== 'weapon' || state.reloading || (state.boltCycleT ?? 0) > 0) return false;
  if(weapon.id==='laser')return beginPlasmaAction(state,multiplier);
  if(weapon.id==='railgun'&&playerHandling)return beginRailgunReload(state,multiplier);
  const vent = weapon.id === 'minigun';
  const chamberOnly = !!state.needsChamber && (state.ammo ?? 0) > 0;
  if (!chamberOnly && (vent ? (state.heat ?? 0) <= 0 : (state.ammo ?? 0) >= (weapon.mag ?? 0) || (state.reserve ?? 0) <= 0)) return false;
  const empty = (state.ammo ?? 0) === 0;
  const duration = (weapon.reloadTime ?? 2.4) * Math.max(.1, Number.isFinite(multiplier) ? multiplier : 1) * (!empty && !vent ? .78 : 1.1);
  const phases: ReloadSequence['phases'] = [];
  let kind: ReloadSequence['kind'] = 'magazine';
  const add = (phase: ReloadPhase, fraction: number) => phases.push({ phase, duration: duration * fraction });
  const missing = Math.min((weapon.mag ?? 0) - (state.ammo ?? 0), state.reserve ?? 0);
  if (weapon.id === 'shotgun') {
    const speed = Math.max(.1, Number.isFinite(multiplier) ? multiplier : 1);
    const timed = (phase: ReloadPhase, seconds: number) => phases.push({ phase, duration: seconds * speed });
    if (chamberOnly) { timed('chamber', SHOTGUN.cycle); timed('close', .18); }
    else {
      kind = 'shell'; timed('open', SHOTGUN.open); timed('insert', SHOTGUN.shell);
      if (empty) timed('chamber', SHOTGUN.cycle);
      timed('close', empty ? .18 : SHOTGUN.close);
    }
  } else if (weapon.id === 'sniper' && playerHandling) {
    // R cycles a pending bolt in App; a magazine exchange never chambers itself.
    if (chamberOnly) return false;
    const speed = Math.max(.1, Number.isFinite(multiplier) ? multiplier : 1);
    phases.push({phase:'open',duration:SNIPER.reloadOpen*speed}, {phase:'eject',duration:SNIPER.reloadEject*speed},
      {phase:'insert',duration:SNIPER.reloadInsert*speed}, {phase:'close',duration:SNIPER.reloadClose*speed});
  } else if (weapon.id === 'br' && playerHandling) {
    const speed = Math.max(.1, Number.isFinite(multiplier) ? multiplier : 1);
    const timed = (phase: ReloadPhase, seconds: number) => phases.push({phase,duration:seconds*speed});
    timed('open', chamberOnly ? .20 : BATTLE_RIFLE.lift);
    if (!chamberOnly) { timed('eject', BATTLE_RIFLE.extract); timed('pickup', BATTLE_RIFLE.acquire); timed('insert', BATTLE_RIFLE.insert); }
    if (empty || chamberOnly) timed('chamber', BATTLE_RIFLE.chamber);
    timed('close', chamberOnly ? .35 : BATTLE_RIFLE.lower);
  } else if (weapon.id === 'lmg' && playerHandling) {
    const speed = Math.max(.1, Number.isFinite(multiplier) ? multiplier : 1);
    const timed = (phase: ReloadPhase) => phases.push({phase,duration:lmgPhaseSeconds(phase)*speed});
    if (!chamberOnly) for(const phase of ['lift','open','eject','pickup','insert','feed','slap'] as const) timed(phase);
    if(empty || chamberOnly)timed('chamber');
    timed('close');
  } else if (weapon.id === 'smg' && playerHandling) {
    const speed = Math.max(.1, Number.isFinite(multiplier) ? multiplier : 1);
    const timing = empty || chamberOnly ? SMG.empty : SMG.tactical;
    if (!chamberOnly) for (const phase of ['open','eject','insert'] as const) phases.push({phase,duration:timing[phase]*speed});
    if (empty || chamberOnly) phases.push({phase:'chamber',duration:SMG.empty.chamber*speed});
    phases.push({phase:'close',duration:timing.close*speed});
  } else if (chamberOnly) { add('chamber', .25); add('close', .15);
  } else if (vent) {
    kind = 'vent'; add('vent', .25);add('close', .75);
  } else if (weapon.id === 'railgun') {
    kind = 'battery'; add('vent', .2); add('eject', .2); add('insert', .4); add('close', .2);
  } else if (weapon.id === 'rocket') {
    kind = 'tube'; add('open', .18); add('insert', .62); add('close', .2);
  } else if (weapon.id === 'grenade_launcher') {
    kind = 'cylinder'; add('open', .2); add('eject', .15); add('insert', .45); add('close', .2);
  } else {
    if (weapon.id === 'lmg') add('open', .15);
    add('eject', .2); add('insert', .45);
    if (empty) add('chamber', .2);
    add('close', weapon.id === 'lmg' ? .2 : .15);
  }
  state.reloadSequence = { kind, phases, index: 0, elapsed: 0, empty: empty || chamberOnly, shellsRemaining: missing, inserted: 0 };
  state.needsChamber = chamberOnly || (empty && ['ar','pistol','smg','br','lmg','sniper','shotgun'].includes(weapon.id));
  state.isTacticalReload = !empty && !chamberOnly; state.reloading = true;
  state.burstRemaining = 0; state.burstTimer = 0; state.charging = false; state.chargeTimer = 0;
  state.totalReloadT = phases.reduce((s, p) => s + p.duration, 0) + (kind === 'shell' ? Math.max(0, missing - 1) * phases[1].duration : 0);
  state.reloadT = state.totalReloadT;
  return true;
}

/** Advance through phase boundaries without losing shell events on slow frames. */
export function advanceWeaponReload(weapon: WeaponDef, state: WeaponSlotState, delta: number, onPhaseStart?: ReloadPhaseListener, onShotgunEvent?: ShotgunEventListener, onSniperBolt?: SniperBoltListener, onBattleRifle?: BattleRifleListener, onLmg?: LmgListener, onRailgun?:RailgunListener): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  if(weapon.id==='laser')return advancePlasmaAction(state,delta);
  if(weapon.id==='railgun'&&state.reloadSequence?.kind==='railgun')return advanceRailgunReload(state,delta,onRailgun,onPhaseStart);
  if (weapon.id === 'sniper') advanceSniperAction(state, delta, onSniperBolt);
  else if (weapon.id === 'shotgun' && state.shotgunCycle) advanceShotgunCycle(state, delta, onShotgunEvent);
  else state.boltCycleT = Math.max(0, (state.boltCycleT ?? 0) - delta);
  const sequence = state.reloadSequence;
  if (!state.reloading || !sequence) return 0;
  let remaining = delta, inserts = 0;
  while (remaining > 0 && state.reloading) {
    const stage = sequence.phases[sequence.index];
    // Seat and pump cues are boundary events on this very clock, not timers in
    // the renderer/audio layer. A slow frame can cross multiple real transfers.
    const seat = sequence.kind === 'shell' && stage.phase === 'insert' && !sequence.shellSeated;
    const pumpStart = weapon.id === 'shotgun' && stage.phase === 'chamber' && sequence.elapsed < stage.duration * SHOTGUN.recovery / SHOTGUN.cycle - 1e-8;
    const brCue = weapon.id === 'br' && !sequence.brCuePlayed ? brCueTime(stage.phase, stage.duration) : undefined;
    const lmgAction = weapon.id === 'lmg' && (sequence.phases[0].phase === 'lift' || sequence.phases[0].phase === 'chamber') && !sequence.lmgCuePlayed ? lmgCue(stage.phase,stage.duration) : undefined;
    const boundary = lmgAction ?? brCue ?? (seat ? stage.duration * SHOTGUN.seat : pumpStart ? stage.duration * SHOTGUN.recovery / SHOTGUN.cycle : stage.duration);
    const step = Math.min(remaining, Math.max(0, boundary - sequence.elapsed));
    sequence.elapsed += step; remaining -= step; state.reloadT = Math.max(0, (state.reloadT ?? 0) - step);
    if (seat && sequence.elapsed + 1e-8 >= boundary) {
      sequence.shellSeated = true;
      if ((state.reserve ?? 0) > 0 && (state.ammo ?? 0) < (weapon.mag ?? 0)) {
        state.ammo = (state.ammo ?? 0) + 1; state.reserve = (state.reserve ?? 0) - 1; sequence.inserted++; inserts++;
        onShotgunEvent?.('seat', stage.duration * .48 / SHOTGUN.shell, sequence.empty, remaining);
      }
    }
    if (pumpStart && sequence.elapsed + 1e-8 >= boundary) onShotgunEvent?.('pump', stage.duration * SHOTGUN.pumpDuration / SHOTGUN.cycle, sequence.empty, remaining);
    if (brCue !== undefined && sequence.elapsed + 1e-8 >= boundary) {
      sequence.brCuePlayed = true;
      onBattleRifle?.(stage.phase === 'eject' ? 'extract' : stage.phase === 'insert' ? 'insert' : 'chamber', stage.duration / (stage.phase === 'eject' ? BATTLE_RIFLE.extract : stage.phase === 'insert' ? BATTLE_RIFLE.insert : BATTLE_RIFLE.chamber), remaining);
    }
    if(lmgAction !== undefined && sequence.elapsed + 1e-8 >= boundary) {
      sequence.lmgCuePlayed=true;
      onLmg?.(stage.phase==='eject'?'extract':stage.phase==='insert'?'seat':stage.phase==='slap'?'cover':'charge',stage.duration/lmgPhaseSeconds(stage.phase),remaining);
    }
    if (sequence.elapsed + 1e-8 < stage.duration) { if (remaining > 1e-8) continue; break; }
    if (stage.phase === 'insert') {
      if (sequence.kind === 'shell') {
        sequence.shellsRemaining--; sequence.shellSeated = false;
        if (sequence.shellsRemaining > 0 && (state.reserve ?? 0) > 0) {
          sequence.elapsed = 0;
          onPhaseStart?.(stage.phase, stage.duration, sequence.empty);
          continue;
        }
      } else {
        const take = Math.max(0, Math.min((weapon.mag ?? 0) - (state.ammo ?? 0), state.reserve ?? 0));
        state.ammo = (state.ammo ?? 0) + take; state.reserve = (state.reserve ?? 0) - take; sequence.inserted = take;
      }
    }
    if (stage.phase === 'chamber') state.needsChamber = false;
    sequence.index++; sequence.elapsed = 0; sequence.brCuePlayed = false; if(weapon.id==='lmg')sequence.lmgCuePlayed = false;
    if (sequence.index === sequence.phases.length) {
      if (sequence.kind === 'battery' || sequence.kind === 'vent') { state.heat = 0; state.overheated = false; if(weapon.id==='minigun')state.ammo=weapon.mag; }
      cancelWeaponReload(state);
    } else {
      const next = sequence.phases[sequence.index];
      onPhaseStart?.(next.phase, next.duration, sequence.empty);
    }
  }
  return inserts;
}

export function interruptShellReload(weapon: WeaponDef, state: WeaponSlotState): boolean {
  if (weapon.id !== 'shotgun' || !state.reloading || (state.ammo ?? 0) <= 0 || (state.reloadSequence?.empty && state.reloadSequence.inserted === 0)) return false;
  state.pendingReloadShot = true;
  if (state.needsChamber) {
    const sequence = state.reloadSequence!, stage = sequence.phases[sequence.index];
    const continuing = stage.phase === 'chamber';
    const duration = continuing ? stage.duration : SHOTGUN.cycle * sequence.phases[0].duration / SHOTGUN.open;
    const elapsed = continuing ? sequence.elapsed : 0;
    beginShotgunCycle(state, 'chamber', duration, elapsed, elapsed >= duration * SHOTGUN.recovery / SHOTGUN.cycle);
    state.pendingReloadShot = true;
  }
  cancelWeaponReload(state); return true;
}
