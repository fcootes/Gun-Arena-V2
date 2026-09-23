import React, { useCallback, useMemo, useState } from 'react';
import {
  ARSENAL,
  ARSENAL_ORDER,
  ArsenalWeaponDef,
  DEFAULT_ELITE_SQUAD,
  EliteCompanionConfig,
  FACTION_AVATARS,
  FactionId,
  GamePersistence,
  GearItemDef,
  GearSlot,
  HEADGEAR_CATALOG,
  HeadgearId,
  LOWER_CATALOG,
  LowerRigId,
  PersistedLoadout,
  SECONDARY_LEGAL,
  Sector4ObjectiveType,
  TORSO_CATALOG,
  TorsoId,
  TRIPOD_RPM,
  WEAPON_CLASS_ORDER,
  WeaponClass,
  WeaponID,
  equipLoadout,
  loadPersistence,
  outstandingGrindCost,
  purchaseGear,
  purchaseWeapon,
  resetPersistence,
  resolveGearModifiers,
  KILL_REWARD_HEAVY,
  KILL_REWARD_STANDARD
} from './types';

/* =============================================================================
 * SHARED PRESENTATION HELPERS
 * ===========================================================================*/

const CYAN = '#2de2e6';
const AMBER = '#f5a623';

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

interface StatChipProps {
  label: string;
  tone?: 'good' | 'bad' | 'neutral';
}

const StatChip: React.FC<StatChipProps> = ({ label, tone = 'neutral' }) => {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
      : tone === 'bad'
      ? 'border-rose-500/40 text-rose-300 bg-rose-500/10'
      : 'border-slate-500/40 text-slate-300 bg-slate-500/10';
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono tracking-wide ${toneClass}`}>
      {label}
    </span>
  );
};

/** Turns a gear def's modifier block into readable chips. */
function gearStatChips(def: GearItemDef): { label: string; tone: 'good' | 'bad' | 'neutral' }[] {
  const chips: { label: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
  const m = def.modifiers;

  if (def.armorCapacity > 0) chips.push({ label: `${def.armorCapacity} armor`, tone: 'neutral' });
  if (m.headshotDamageMult !== undefined && m.headshotDamageMult !== 1) {
    chips.push({ label: `${Math.round((1 - m.headshotDamageMult) * 100)}% less headshot dmg`, tone: 'good' });
  }
  if (m.bulletDamageMult !== undefined && m.bulletDamageMult !== 1) {
    chips.push({ label: `${Math.round((1 - m.bulletDamageMult) * 100)}% less bullet dmg`, tone: 'good' });
  }
  if (m.moveSpeedMult !== undefined && m.moveSpeedMult !== 1) {
    const pct = Math.round((m.moveSpeedMult - 1) * 100);
    chips.push({ label: `${pct > 0 ? '+' : ''}${pct}% move speed`, tone: pct > 0 ? 'good' : 'bad' });
  }
  if (m.sprintSpeedMult !== undefined && m.sprintSpeedMult !== 1) {
    const pct = Math.round((m.sprintSpeedMult - 1) * 100);
    chips.push({ label: `${pct > 0 ? '+' : ''}${pct}% sprint speed`, tone: pct > 0 ? 'good' : 'bad' });
  }
  if (m.reloadSpeedMult !== undefined && m.reloadSpeedMult !== 1) {
    chips.push({ label: `+${Math.round((1 - m.reloadSpeedMult) * 100)}% reload speed`, tone: 'good' });
  }
  if (m.drawSpeedMult !== undefined && m.drawSpeedMult !== 1) {
    chips.push({ label: `+${Math.round((1 - m.drawSpeedMult) * 100)}% draw speed`, tone: 'good' });
  }
  if (m.reserveAmmoMult !== undefined && m.reserveAmmoMult !== 1) {
    chips.push({ label: `+${Math.round((m.reserveAmmoMult - 1) * 100)}% reserve ammo`, tone: 'good' });
  }
  if (m.sidearmMagBonus) chips.push({ label: `+${m.sidearmMagBonus} sidearm mag`, tone: 'good' });
  if (m.suppressionBonusPct) chips.push({ label: `+${m.suppressionBonusPct}% suppression`, tone: 'good' });
  if (m.staggerImmune) chips.push({ label: 'Stagger immune', tone: 'good' });
  if (m.zeroJumpFatigue) chips.push({ label: 'No jump fatigue', tone: 'good' });

  return chips;
}

function weaponStatChips(def: ArsenalWeaponDef): { label: string; tone: 'good' | 'bad' | 'neutral' }[] {
  const chips: { label: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
  if (def.projectile === 'ROCKET') {
    chips.push({ label: `${def.projectileSpeed} m/s rocket`, tone: 'neutral' });
    chips.push({ label: `${def.splashDamage} splash · ${def.splashRadius}m`, tone: 'good' });
  } else if (def.projectile === 'ARC_GRENADE') {
    chips.push({ label: 'Gravity arc', tone: 'neutral' });
    chips.push({ label: `${def.splashDamage} splash · ${def.splashRadius}m`, tone: 'good' });
  } else if (def.projectile === 'PENETRATING_RAIL') {
    chips.push({ label: `Penetrates ${def.penetrationRange}m`, tone: 'good' });
    chips.push({ label: `${def.damage} dmg`, tone: 'neutral' });
  } else {
    chips.push({ label: `${def.damage} dmg${def.pellets > 1 ? ` × ${def.pellets}` : ''}`, tone: 'neutral' });
    chips.push({ label: `${Math.round(60 / def.fireRate)} RPM`, tone: 'neutral' });
    chips.push({ label: `${def.mag} mag`, tone: 'neutral' });
  }
  if (def.scoped) chips.push({ label: 'Optic', tone: 'neutral' });
  if (def.burst) chips.push({ label: `${def.burstCount}-rnd burst`, tone: 'neutral' });
  return chips;
}

/* =============================================================================
 * ECONOMY FUNDS BADGE
 * ===========================================================================*/

export interface EconomyFundsBadgeProps {
  funds: number;
  lastPayout?: { amount: number; heavy: boolean } | null;
  compact?: boolean;
}

export const EconomyFundsBadge: React.FC<EconomyFundsBadgeProps> = ({ funds, lastPayout, compact }) => (
  <div
    className={`pointer-events-none flex items-center gap-2 rounded border border-amber-500/30 bg-slate-950/70 backdrop-blur-sm font-mono ${
      compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
    }`}
  >
    <span className="text-amber-400/70 text-[10px] tracking-[0.2em]">FUNDS</span>
    <span className="text-amber-300 font-semibold tabular-nums">{money(funds)}</span>
    {lastPayout && (
      <span className={`text-[11px] tabular-nums ${lastPayout.heavy ? 'text-cyan-300' : 'text-emerald-300'}`}>
        +{lastPayout.amount}
      </span>
    )}
  </div>
);

/* =============================================================================
 * GEAR LOCKER TERMINAL
 * Faction avatars · headgear · torso · lower rig · 15-weapon arsenal
 * ===========================================================================*/

type LockerTab = 'OPERATOR' | 'HEADGEAR' | 'TORSO' | 'LOWER' | 'ARSENAL';

const LOCKER_TABS: { id: LockerTab; label: string }[] = [
  { id: 'OPERATOR', label: 'Operator' },
  { id: 'HEADGEAR', label: 'Headgear' },
  { id: 'TORSO', label: 'Torso armor' },
  { id: 'LOWER', label: 'Lower rig' },
  { id: 'ARSENAL', label: 'Arsenal' }
];

export interface GearLockerTerminalProps {
  onDeploy: (loadout: PersistedLoadout, persistence: GamePersistence) => void;
  onClose?: () => void;
  /** Optional external state if the caller wants to own persistence. */
  persistence?: GamePersistence;
  onPersistenceChange?: (next: GamePersistence) => void;
}

export const GearLockerTerminal: React.FC<GearLockerTerminalProps> = ({
  onDeploy,
  onClose,
  persistence: externalPersistence,
  onPersistenceChange
}) => {
  const [internal, setInternal] = useState<GamePersistence>(() => externalPersistence ?? loadPersistence());
  const data = externalPersistence ?? internal;

  const [tab, setTab] = useState<LockerTab>('OPERATOR');
  const [notice, setNotice] = useState<string | null>(null);

  const commit = useCallback(
    (next: GamePersistence) => {
      setInternal(next);
      if (onPersistenceChange) onPersistenceChange(next);
    },
    [onPersistenceChange]
  );

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 2600);
  }, []);

  const stats = useMemo(() => resolveGearModifiers(data.loadout), [data.loadout]);
  const grindLeft = useMemo(() => outstandingGrindCost(data), [data]);
  const killsToClear = Math.ceil(grindLeft / KILL_REWARD_STANDARD);

  /* ------------------------------ handlers ------------------------------ */

  const handleFaction = useCallback(
    (faction: FactionId) => {
      commit(equipLoadout(data, { faction }));
    },
    [commit, data]
  );

  const handleBuyGear = useCallback(
    (slot: GearSlot, id: HeadgearId | TorsoId | LowerRigId, name: string) => {
      const res = purchaseGear(data, slot, id);
      if (!res.ok) {
        flash(res.reason || 'Purchase failed');
      } else {
        commit(res.data);
        flash(`${name} purchased.`);
      }
    },
    [commit, data, flash]
  );

  const handleEquipGear = useCallback(
    (slot: GearSlot, id: HeadgearId | TorsoId | LowerRigId) => {
      const patch: Partial<PersistedLoadout> =
        slot === 'HEADGEAR'
          ? { headgear: id as HeadgearId }
          : slot === 'TORSO'
          ? { torso: id as TorsoId }
          : { lower: id as LowerRigId };
      commit(equipLoadout(data, patch));
    },
    [commit, data]
  );

  const handleBuyWeapon = useCallback(
    (id: WeaponID) => {
      const res = purchaseWeapon(data, id);
      if (!res.ok) {
        flash(res.reason || 'Purchase failed');
      } else {
        commit(res.data);
        flash(`${ARSENAL[id].name} added to the locker.`);
      }
    },
    [commit, data, flash]
  );

  const handleEquipWeapon = useCallback(
    (id: WeaponID, slot: 'primary' | 'secondary') => {
      commit(equipLoadout(data, { [slot]: id } as Partial<PersistedLoadout>));
    },
    [commit, data]
  );

  const handleReset = useCallback(() => {
    const fresh = resetPersistence(data.loadout.faction);
    commit(fresh);
    flash('Progress wiped. Starting from zero.');
  }, [commit, data.loadout.faction, flash]);

  /* ------------------------------- render ------------------------------- */

  const renderGearGrid = <TId extends HeadgearId | TorsoId | LowerRigId>(
    slot: GearSlot,
    catalog: Record<TId, GearItemDef<TId>>,
    owned: TId[],
    equipped: TId
  ) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {(Object.keys(catalog) as TId[]).map((id) => {
        const def = catalog[id];
        const isOwned = owned.includes(id);
        const isEquipped = equipped === id;
        const affordable = data.funds >= def.price;

        return (
          <div
            key={id}
            className={`rounded border p-3 transition-colors ${
              isEquipped
                ? 'border-cyan-400/70 bg-cyan-400/5'
                : isOwned
                ? 'border-slate-600/60 bg-slate-900/50'
                : 'border-slate-700/50 bg-slate-950/50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm text-slate-100">{def.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 max-w-[34ch] leading-snug">{def.blurb}</div>
              </div>
              <div className="text-right shrink-0">
                {def.price === 0 ? (
                  <span className="font-mono text-[11px] text-slate-500">Issued</span>
                ) : (
                  <span className={`font-mono text-sm ${isOwned ? 'text-slate-600' : 'text-amber-300'}`}>
                    {money(def.price)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
              {gearStatChips(def).map((c, i) => (
                <StatChip key={i} label={c.label} tone={c.tone} />
              ))}
            </div>

            <div className="mt-3">
              {isEquipped ? (
                <div className="w-full text-center py-1.5 rounded bg-cyan-400/10 border border-cyan-400/40 font-mono text-[11px] text-cyan-300 tracking-wider">
                  Equipped
                </div>
              ) : isOwned ? (
                <button
                  onClick={() => handleEquipGear(slot, id)}
                  className="w-full py-1.5 rounded border border-slate-500/60 hover:border-cyan-400/60 hover:bg-cyan-400/10 font-mono text-[11px] text-slate-200 tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Equip
                </button>
              ) : (
                <button
                  onClick={() => handleBuyGear(slot, id, def.name)}
                  disabled={!affordable}
                  className={`w-full py-1.5 rounded border font-mono text-[11px] tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    affordable
                      ? 'border-amber-400/60 text-amber-300 hover:bg-amber-400/10'
                      : 'border-slate-700 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {affordable ? `Buy ${money(def.price)}` : `Short ${money(def.price - data.funds)}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const weaponsByClass = useMemo(() => {
    const groups = new Map<WeaponClass, WeaponID[]>();
    for (const id of ARSENAL_ORDER) {
      const cls = ARSENAL[id].weaponClass;
      if (!groups.has(cls)) groups.set(cls, []);
      groups.get(cls)!.push(id);
    }
    return groups;
  }, []);

  const avatar = FACTION_AVATARS[data.loadout.faction];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md overflow-y-auto text-slate-200">
      <div className="max-w-6xl mx-auto px-5 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div>
            <h1 className="font-mono text-2xl tracking-[0.25em] text-cyan-300">GEAR LOCKER</h1>
            <p className="text-sm text-slate-400 mt-1">
              Standard kills pay {money(KILL_REWARD_STANDARD)}. Heavies pay {money(KILL_REWARD_HEAVY)}. Everything
              here is earned.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-2xl text-amber-300 tabular-nums">{money(data.funds)}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                {data.totalKills} kills · {data.extractions} extractions
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-2 rounded border border-slate-600 hover:border-slate-400 font-mono text-xs tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Grind readout */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-mono text-slate-500">
          <span>
            Unowned inventory: <span className="text-slate-300">{money(grindLeft)}</span>
          </span>
          <span>
            ≈ <span className="text-slate-300">{killsToClear.toLocaleString()}</span> standard kills to clear
          </span>
          <span>
            Lifetime earnings: <span className="text-slate-300">{money(data.lifetimeFunds)}</span>
          </span>
          <button
            onClick={handleReset}
            className="ml-auto text-rose-400/70 hover:text-rose-300 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded"
          >
            Wipe progress
          </button>
        </div>

        {notice && (
          <div className="mt-3 px-3 py-2 rounded border border-cyan-400/40 bg-cyan-400/5 font-mono text-xs text-cyan-200">
            {notice}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mt-5">
          {LOCKER_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-t font-mono text-xs tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                tab === t.id
                  ? 'bg-slate-900 text-cyan-300 border-t border-x border-cyan-400/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-b rounded-tr border border-slate-700/60 bg-slate-900/40 p-5">
          {/* OPERATOR */}
          {tab === 'OPERATOR' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(FACTION_AVATARS) as FactionId[]).map((fid) => {
                const f = FACTION_AVATARS[fid];
                const selected = data.loadout.faction === fid;
                return (
                  <button
                    key={fid}
                    onClick={() => handleFaction(fid)}
                    className={`text-left rounded border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      selected ? 'border-cyan-400/70 bg-cyan-400/5' : 'border-slate-700/60 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-8 rounded-sm shrink-0"
                        style={{ backgroundColor: f.accentHex }}
                        aria-hidden
                      />
                      <div>
                        <div className="font-mono text-base text-slate-100">{f.name}</div>
                        <div className="font-mono text-[11px] text-slate-500 tracking-wider">{f.callsign}</div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 mt-3 leading-snug">{f.doctrine}</p>
                    {selected && (
                      <div className="mt-3 font-mono text-[11px] text-cyan-300">Active operator profile</div>
                    )}
                  </button>
                );
              })}

              {/* Aggregate stat readout */}
              <div className="md:col-span-2 mt-2 rounded border border-slate-700/60 bg-slate-950/50 p-4">
                <div className="font-mono text-xs text-slate-400 tracking-wider mb-3">Current loadout totals</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-sm">
                  <div>
                    <div className="text-slate-500 text-[11px]">Armor pool</div>
                    <div className="text-cyan-300 tabular-nums">{stats.maxArmor}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Move speed</div>
                    <div className="tabular-nums">{Math.round(stats.moveSpeedMult * 100)}%</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Headshot taken</div>
                    <div className="tabular-nums">{Math.round(stats.headshotDamageMult * 100)}%</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Reserve ammo</div>
                    <div className="tabular-nums">{Math.round(stats.reserveAmmoMult * 100)}%</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {stats.staggerImmune && <StatChip label="Stagger immune" tone="good" />}
                  {stats.zeroJumpFatigue && <StatChip label="No jump fatigue" tone="good" />}
                  {stats.suppressionBonusPct > 0 && (
                    <StatChip label={`+${stats.suppressionBonusPct}% suppression`} tone="good" />
                  )}
                  {stats.sidearmMagBonus > 0 && (
                    <StatChip label={`+${stats.sidearmMagBonus} sidearm mag`} tone="good" />
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'HEADGEAR' &&
            renderGearGrid<HeadgearId>('HEADGEAR', HEADGEAR_CATALOG, data.ownedHeadgear, data.loadout.headgear)}
          {tab === 'TORSO' &&
            renderGearGrid<TorsoId>('TORSO', TORSO_CATALOG, data.ownedTorso, data.loadout.torso)}
          {tab === 'LOWER' &&
            renderGearGrid<LowerRigId>('LOWER', LOWER_CATALOG, data.ownedLower, data.loadout.lower)}

          {/* ARSENAL */}
          {tab === 'ARSENAL' && (
            <div className="space-y-6">
              {WEAPON_CLASS_ORDER.map((cls) => {
                const ids = weaponsByClass.get(cls);
                if (!ids || ids.length === 0) return null;
                return (
                  <div key={cls}>
                    <div className="font-mono text-[11px] text-slate-500 tracking-[0.25em] mb-2">{cls}</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {ids.map((id) => {
                        const def = ARSENAL[id];
                        const isOwned = data.ownedWeapons.includes(id);
                        const isPrimary = data.loadout.primary === id;
                        const isSecondary = data.loadout.secondary === id;
                        const canSecondary = SECONDARY_LEGAL.includes(id);
                        const affordable = data.funds >= def.price;

                        return (
                          <div
                            key={id}
                            className={`rounded border p-3 transition-colors ${
                              isPrimary || isSecondary
                                ? 'border-cyan-400/70 bg-cyan-400/5'
                                : isOwned
                                ? 'border-slate-600/60 bg-slate-900/50'
                                : 'border-slate-700/50 bg-slate-950/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-mono text-sm text-slate-100">{def.name}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5 max-w-[38ch] leading-snug">
                                  {def.blurb}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {def.price === 0 ? (
                                  <span className="font-mono text-[11px] text-slate-500">Issued</span>
                                ) : (
                                  <span
                                    className={`font-mono text-sm ${isOwned ? 'text-slate-600' : 'text-amber-300'}`}
                                  >
                                    {money(def.price)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1 mt-2">
                              {weaponStatChips(def).map((c, i) => (
                                <StatChip key={i} label={c.label} tone={c.tone} />
                              ))}
                            </div>

                            <div className="mt-3 flex gap-2">
                              {!isOwned ? (
                                <button
                                  onClick={() => handleBuyWeapon(id)}
                                  disabled={!affordable}
                                  className={`flex-1 py-1.5 rounded border font-mono text-[11px] tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                                    affordable
                                      ? 'border-amber-400/60 text-amber-300 hover:bg-amber-400/10'
                                      : 'border-slate-700 text-slate-600 cursor-not-allowed'
                                  }`}
                                >
                                  {affordable ? `Buy ${money(def.price)}` : `Short ${money(def.price - data.funds)}`}
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEquipWeapon(id, 'primary')}
                                    disabled={isPrimary}
                                    className={`flex-1 py-1.5 rounded border font-mono text-[11px] tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                                      isPrimary
                                        ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300 cursor-default'
                                        : 'border-slate-500/60 text-slate-200 hover:border-cyan-400/60 hover:bg-cyan-400/10'
                                    }`}
                                  >
                                    {isPrimary ? 'Primary ✔' : 'Set primary'}
                                  </button>
                                  {canSecondary && (
                                    <button
                                      onClick={() => handleEquipWeapon(id, 'secondary')}
                                      disabled={isSecondary}
                                      className={`flex-1 py-1.5 rounded border font-mono text-[11px] tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                                        isSecondary
                                          ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300 cursor-default'
                                          : 'border-slate-500/60 text-slate-200 hover:border-cyan-400/60 hover:bg-cyan-400/10'
                                      }`}
                                    >
                                      {isSecondary ? 'Sidearm ✔' : 'Set sidearm'}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Deploy bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded border border-slate-700/60 bg-slate-900/60 px-5 py-4">
          <div className="font-mono text-xs text-slate-400 leading-relaxed">
            <span className="text-slate-200">{avatar.name}</span>
            <span className="mx-2 text-slate-600">/</span>
            {HEADGEAR_CATALOG[data.loadout.headgear].name}
            <span className="mx-2 text-slate-600">/</span>
            {TORSO_CATALOG[data.loadout.torso].name}
            <span className="mx-2 text-slate-600">/</span>
            {LOWER_CATALOG[data.loadout.lower].name}
            <br />
            <span className="text-cyan-300">{ARSENAL[data.loadout.primary].name}</span>
            <span className="mx-2 text-slate-600">+</span>
            <span className="text-cyan-300">{ARSENAL[data.loadout.secondary].name}</span>
          </div>
          <button
            onClick={() => onDeploy(data.loadout, data)}
            className="px-8 py-3 rounded bg-cyan-400/15 border border-cyan-400/60 font-mono text-sm tracking-[0.2em] text-cyan-200 hover:bg-cyan-400/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            DEPLOY
          </button>
        </div>
      </div>
    </div>
  );
};

/* =============================================================================
 * EXTRACTION OBJECTIVE HUD (preserved)
 * ===========================================================================*/

export interface ExtractionObjectiveHUDProps {
  state?: any;
  timeStr?: string;
  kills?: number;
  objectiveTitle?: string;
  objectiveDetail?: string;
  currentSector?: number;
  stage?: string;
  sector4ObjectiveType?: Sector4ObjectiveType;
  holdTheLineActive?: boolean;
  holdTheLineTimer?: number;
  holdTheLineTotal?: number;
  hasBioCylinder?: boolean;
  hasArmoryKeycard?: boolean;
  breakerAlphaPulled?: boolean;
  breakerBetaPulled?: boolean;
  bossSpawned?: boolean;
  bossDefeated?: boolean;
  evacReady?: boolean;
  mutantsKilled?: number;
  interactionPrompt?: string | null;
  isPromptObjective?: boolean;
}

export const ExtractionObjectiveHUD: React.FC<ExtractionObjectiveHUDProps> = (props) => {
  const s = props.state;
  const objectiveTitle = props.objectiveTitle ?? s?.objectiveTitle ?? 'SECURE THE ZONE';
  const objectiveDetail = props.objectiveDetail ?? s?.objectiveDetail ?? '';
  const currentSector = props.currentSector ?? s?.currentSector ?? 1;
  const rawStage = props.stage ?? s?.stage ?? 'INFILTRATE';
  const stage = typeof rawStage === 'string' ? rawStage.replace(/_/g, ' ') : '';
  const sector4ObjectiveType = props.sector4ObjectiveType ?? s?.sector4ObjectiveType;
  const holdTheLineActive = props.holdTheLineActive ?? s?.holdTheLineActive ?? false;
  const holdTheLineTimer = props.holdTheLineTimer ?? s?.holdTheLineTimer ?? 0;
  const holdTheLineTotal = props.holdTheLineTotal ?? s?.holdTheLineTotal ?? 45;
  const hasBioCylinder = props.hasBioCylinder ?? s?.hasBioCylinder ?? false;
  const hasArmoryKeycard = props.hasArmoryKeycard ?? s?.hasArmoryKeycard ?? false;
  const breakerAlphaPulled = props.breakerAlphaPulled ?? s?.breakerAlphaPulled ?? false;
  const breakerBetaPulled = props.breakerBetaPulled ?? s?.breakerBetaPulled ?? false;
  const bossSpawned = props.bossSpawned ?? s?.bossSpawned ?? false;
  const bossDefeated = props.bossDefeated ?? s?.bossDefeated ?? false;
  const evacReady = props.evacReady ?? s?.evacReady ?? false;
  const mutantsKilled = props.mutantsKilled ?? props.kills ?? s?.mutantsKilled ?? 0;
  const interactionPrompt = props.interactionPrompt ?? s?.interactionPrompt ?? null;
  const isPromptObjective = props.isPromptObjective ?? s?.isPromptObjective ?? false;

  const holdPct = holdTheLineActive
    ? Math.max(0, Math.min(100, (1 - holdTheLineTimer / Math.max(1, holdTheLineTotal)) * 100))
    : 0;

  return (
    <>
      {/* Objective panel */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none w-[min(560px,90vw)]">
        <div className="rounded border border-cyan-400/30 bg-slate-950/70 backdrop-blur-sm px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-400/70">
              SECTOR {currentSector} · {stage}
            </span>
            <span className="font-mono text-[10px] text-slate-500 tabular-nums">{mutantsKilled} purged</span>
          </div>

          <div className="font-mono text-sm text-cyan-200 mt-1 leading-snug">{objectiveTitle}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{objectiveDetail}</div>

          {holdTheLineActive && (
            <div className="mt-2">
              <div className="h-1.5 rounded bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-[width] duration-200"
                  style={{ width: `${holdPct}%` }}
                />
              </div>
              <div className="font-mono text-[10px] text-amber-300 mt-1 tabular-nums">
                {Math.max(0, Math.ceil(holdTheLineTimer))}s remaining
              </div>
            </div>
          )}

          {/* Objective trackers */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hasArmoryKeycard && <StatChip label="Armory keycard" tone="good" />}
            {sector4ObjectiveType === 'VOLATILE_CONTAINER' && hasBioCylinder && (
              <StatChip label="Canister secured" tone="good" />
            )}
            {sector4ObjectiveType === 'REACTOR_OVERRIDE' && (
              <>
                <StatChip label={breakerAlphaPulled ? 'Alpha online' : 'Alpha offline'} tone={breakerAlphaPulled ? 'good' : 'bad'} />
                <StatChip label={breakerBetaPulled ? 'Beta online' : 'Beta offline'} tone={breakerBetaPulled ? 'good' : 'bad'} />
              </>
            )}
            {bossSpawned && !bossDefeated && <StatChip label="Specimen Zero active" tone="bad" />}
            {evacReady && <StatChip label="Evac online" tone="good" />}
          </div>
        </div>
      </div>

      {/* Interaction prompt */}
      {interactionPrompt && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[22%] pointer-events-none select-none">
          <div
            className={`px-4 py-2 rounded border backdrop-blur-sm font-mono text-sm tracking-wide ${
              isPromptObjective
                ? 'border-amber-400/60 bg-amber-400/10 text-amber-200'
                : 'border-cyan-400/50 bg-slate-950/70 text-cyan-200'
            }`}
          >
            {interactionPrompt}
          </div>
        </div>
      )}
    </>
  );
};

/* =============================================================================
 * EXTRACTION END SCREEN (preserved)
 * ===========================================================================*/

export interface ExtractionEndScreenProps {
  victory: boolean;
  mutantsKilled: number;
  missionDuration: number;
  sectorReached: number;
  fundsEarned?: number;
  totalFunds?: number;
  onRestart: () => void;
  onReturnToLobby?: () => void;
  onOpenLocker?: () => void;
}

export const ExtractionEndScreen: React.FC<ExtractionEndScreenProps> = ({
  victory,
  mutantsKilled,
  missionDuration,
  sectorReached,
  fundsEarned = 0,
  totalFunds = 0,
  onRestart,
  onReturnToLobby,
  onOpenLocker
}) => {
  const mins = Math.floor(missionDuration / 60);
  const secs = Math.floor(missionDuration % 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 backdrop-blur-md">
      <div className="w-[min(520px,92vw)] rounded border border-slate-700/60 bg-slate-900/70 p-7">
        <div
          className="font-mono text-2xl tracking-[0.3em]"
          style={{ color: victory ? CYAN : '#f43f5e' }}
        >
          {victory ? 'EXTRACTION COMPLETE' : 'OPERATOR DOWN'}
        </div>
        <p className="text-sm text-slate-400 mt-2 leading-snug">
          {victory
            ? 'Evac elevator sealed with you inside. Samples are on their way to Command.'
            : 'The squad lost contact in Sector ' + sectorReached + '. Recovery was not possible.'}
        </p>

        <div className="grid grid-cols-3 gap-4 mt-6 font-mono">
          <div>
            <div className="text-[11px] text-slate-500">Anomalies purged</div>
            <div className="text-xl text-slate-100 tabular-nums">{mutantsKilled}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Time in facility</div>
            <div className="text-xl text-slate-100 tabular-nums">
              {mins}:{secs.toString().padStart(2, '0')}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Deepest sector</div>
            <div className="text-xl text-slate-100 tabular-nums">{sectorReached}</div>
          </div>
        </div>

        <div className="mt-5 rounded border border-amber-500/30 bg-amber-500/5 px-4 py-3 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-amber-400/80 tracking-[0.2em]">PAYOUT</span>
            <span className="text-lg text-amber-300 tabular-nums">+{money(fundsEarned)}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Locker balance: <span className="text-slate-300">{money(totalFunds)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          <button
            onClick={onRestart}
            className="flex-1 min-w-[140px] py-2.5 rounded bg-cyan-400/15 border border-cyan-400/60 font-mono text-xs tracking-[0.2em] text-cyan-200 hover:bg-cyan-400/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            REDEPLOY
          </button>
          {onOpenLocker && (
            <button
              onClick={onOpenLocker}
              className="flex-1 min-w-[140px] py-2.5 rounded border border-amber-400/50 font-mono text-xs tracking-[0.2em] text-amber-200 hover:bg-amber-400/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              GEAR LOCKER
            </button>
          )}
          {onReturnToLobby && (
            <button
              onClick={onReturnToLobby}
              className="flex-1 min-w-[140px] py-2.5 rounded border border-slate-600 font-mono text-xs tracking-[0.2em] text-slate-300 hover:border-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              LOBBY
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* =============================================================================
 * TRIPOD MOUNT HUD
 * ===========================================================================*/

export interface TripodMountHUDProps {
  mounted: boolean;
  /** 0–100 */
  heat: number;
  overheated: boolean;
  /** Prompt supplied by getTripodInteractionPrompt(), or null. */
  prompt?: string | null;
}

export const TripodMountHUD: React.FC<TripodMountHUDProps> = ({ mounted, heat, overheated, prompt }) => {
  if (!mounted) {
    if (!prompt) return null;
    return (
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[28%] pointer-events-none select-none">
        <div className="px-4 py-2 rounded border border-cyan-400/50 bg-slate-950/70 backdrop-blur-sm font-mono text-sm text-cyan-200 tracking-wide">
          {prompt}
        </div>
      </div>
    );
  }

  const heatPct = Math.max(0, Math.min(100, heat));

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-[14%] pointer-events-none select-none w-[min(320px,80vw)]">
      <div className="rounded border border-cyan-400/40 bg-slate-950/75 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.2em]">
          <span className="text-cyan-300">TRIPOD MG</span>
          <span className="text-slate-400 tabular-nums">{TRIPOD_RPM} RPM · 0 RECOIL</span>
        </div>

        <div className="mt-2 h-2 rounded bg-slate-800 overflow-hidden">
          <div
            className="h-full transition-[width] duration-100"
            style={{
              width: `${heatPct}%`,
              backgroundColor: overheated ? '#f43f5e' : heatPct > 70 ? AMBER : CYAN
            }}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5 font-mono text-[10px]">
          <span className={overheated ? 'text-rose-400' : 'text-slate-500'}>
            {overheated ? 'Overheated — venting' : 'Barrel heat'}
          </span>
          <span className="text-slate-400">[E] dismount</span>
        </div>
      </div>
    </div>
  );
};

/* =============================================================================
 * ELITE SQUAD STATUS HUD
 * ===========================================================================*/

export interface EliteSquadSlotStatus {
  slotId: number;
  alive: boolean;
  healthPct: number;
  /** Seconds until the slot's signature ability is ready again. */
  abilityCooldown?: number;
  abilityReadyLabel?: string;
  mounted?: boolean;
}

export interface SquadStatusHUDProps {
  squad?: EliteCompanionConfig[];
  statuses: EliteSquadSlotStatus[];
  directive?: string;
}

export const SquadStatusHUD: React.FC<SquadStatusHUDProps> = ({
  squad = DEFAULT_ELITE_SQUAD,
  statuses,
  directive = 'DEFEND'
}) => (
  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none select-none w-[212px]">
    <div className="font-mono text-[10px] tracking-[0.25em] text-slate-500 mb-1.5">
      SQUAD · {(directive || 'DEFEND').replace(/_/g, ' ').toUpperCase()}
    </div>

    <div className="space-y-1.5">
      {squad.map((member) => {
        const status = statuses.find((s) => s.slotId === member.slotId);
        const alive = status?.alive ?? true;
        const hp = Math.max(0, Math.min(100, status?.healthPct ?? 100));
        const cd = status?.abilityCooldown ?? 0;

        return (
          <div
            key={member.slotId}
            className={`rounded border px-2.5 py-1.5 backdrop-blur-sm ${
              alive ? 'border-slate-600/50 bg-slate-950/60' : 'border-rose-900/50 bg-rose-950/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-200 truncate">
                <span className="text-slate-500 mr-1.5">{member.slotId}</span>
                {member.callsign}
              </span>
              <span aria-hidden className="text-xs shrink-0">
                {member.icon}
              </span>
            </div>

            <div className="mt-1 h-1 rounded bg-slate-800 overflow-hidden">
              <div
                className="h-full transition-[width] duration-200"
                style={{
                  width: `${alive ? hp : 0}%`,
                  backgroundColor: hp > 50 ? '#34d399' : hp > 25 ? AMBER : '#f43f5e'
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-1 font-mono text-[9px]">
              <span className="text-slate-500">{alive ? member.roleTitle : 'Down'}</span>
              {alive && (
                <span className={cd > 0 ? 'text-slate-500 tabular-nums' : 'text-cyan-400'}>
                  {status?.mounted
                    ? 'Manning MG'
                    : cd > 0
                    ? `${Math.ceil(cd)}s`
                    : status?.abilityReadyLabel ?? 'Ready'}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
