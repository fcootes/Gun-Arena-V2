import type { WeaponDef, WeaponSlotState } from './types';

export type ReloadPhase = 'open' | 'eject' | 'insert' | 'chamber' | 'close' | 'vent';
export type ReloadPhaseListener = (phase: ReloadPhase, duration: number, empty: boolean) => void;
export interface ReloadSequence {
  kind: 'magazine' | 'shell' | 'battery' | 'tube' | 'cylinder' | 'vent';
  phases: { phase: ReloadPhase; duration: number }[];
  index: number;
  elapsed: number;
  empty: boolean;
  shellsRemaining: number;
  inserted: number;
}

export function cancelWeaponReload(state: WeaponSlotState) {
  state.reloading = false; state.reloadT = 0; state.reloadSequence = undefined;
}

export function beginWeaponReload(weapon: WeaponDef, state: WeaponSlotState, multiplier = 1): boolean {
  if (weapon.type !== 'weapon' || state.reloading || (state.boltCycleT ?? 0) > 0) return false;
  const vent = weapon.id === 'laser' || weapon.id === 'minigun';
  const chamberOnly = !!state.needsChamber && (state.ammo ?? 0) > 0;
  if (!chamberOnly && (vent ? (state.heat ?? 0) <= 0 : (state.ammo ?? 0) >= (weapon.mag ?? 0) || (state.reserve ?? 0) <= 0)) return false;
  const empty = (state.ammo ?? 0) === 0;
  const duration = (weapon.reloadTime ?? 2.4) * Math.max(.1, Number.isFinite(multiplier) ? multiplier : 1) * (!empty && !vent ? .78 : 1.1);
  const phases: ReloadSequence['phases'] = [];
  let kind: ReloadSequence['kind'] = 'magazine';
  const add = (phase: ReloadPhase, fraction: number) => phases.push({ phase, duration: duration * fraction });
  const missing = Math.min((weapon.mag ?? 0) - (state.ammo ?? 0), state.reserve ?? 0);
  if (chamberOnly) { add('chamber', .25); add('close', .15); }
  else if (weapon.id === 'shotgun') {
    kind = 'shell'; add('open', .16); add('insert', .24); if (empty) add('chamber', .18); add('close', .12);
  } else if (vent) {
    kind = weapon.id === 'laser' ? 'battery' : 'vent'; add('vent', .25);
    if (kind === 'battery') { add('eject', .2); add('insert', .35); }
    add('close', kind === 'battery' ? .2 : .75);
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
export function advanceWeaponReload(weapon: WeaponDef, state: WeaponSlotState, delta: number, onPhaseStart?: ReloadPhaseListener): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  state.boltCycleT = Math.max(0, (state.boltCycleT ?? 0) - delta);
  const sequence = state.reloadSequence;
  if (!state.reloading || !sequence) return 0;
  let remaining = delta, inserts = 0;
  while (remaining > 0 && state.reloading) {
    const stage = sequence.phases[sequence.index];
    const step = Math.min(remaining, stage.duration - sequence.elapsed);
    sequence.elapsed += step; remaining -= step; state.reloadT = Math.max(0, (state.reloadT ?? 0) - step);
    if (sequence.elapsed + 1e-8 < stage.duration) break;
    if (stage.phase === 'insert') {
      if (sequence.kind === 'shell') {
        if ((state.reserve ?? 0) > 0 && (state.ammo ?? 0) < (weapon.mag ?? 0)) {
          state.ammo = (state.ammo ?? 0) + 1; state.reserve = (state.reserve ?? 0) - 1; sequence.inserted++; inserts++;
        }
        sequence.shellsRemaining--;
        if (sequence.shellsRemaining > 0 && (state.reserve ?? 0) > 0) {
          sequence.elapsed = 0;
          onPhaseStart?.(stage.phase, stage.duration, sequence.empty);
          continue;
        }
      } else if (weapon.id === 'laser') { state.ammo = weapon.mag;
      } else {
        const take = Math.max(0, Math.min((weapon.mag ?? 0) - (state.ammo ?? 0), state.reserve ?? 0));
        state.ammo = (state.ammo ?? 0) + take; state.reserve = (state.reserve ?? 0) - take; sequence.inserted = take;
      }
    }
    if (stage.phase === 'chamber') state.needsChamber = false;
    sequence.index++; sequence.elapsed = 0;
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
  if (state.needsChamber) { state.boltCycleT = .42; state.needsChamber=false; state.pendingReloadShot=true; }
  cancelWeaponReload(state); return true;
}
