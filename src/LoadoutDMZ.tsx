import React, { useState, useEffect } from 'react';
import { ClassId } from './types';
import { CLASSES } from './App';
import { VisorType } from './lobbyAvatar';
import { WeaponSilhouette } from './WeaponSilhouettes';
import {
  getCareerLedger,
  FactionCareerLedger,
  isItemUnlocked,
  purchaseItemUnlock,
  UNLOCK_CATALOG
} from './careerLedger';
export { WeaponSilhouette };

export interface WeaponVaultItem {
  id: string;
  name: string;
  category: string;
  caliber: string;
  fireMode: string;
  description: string;
  damage: number;
  fireRate: number;
  range: number;
  accuracy: number;
  recoilControl: number;
  mobility: number;
  rounds: number;
  reserve: number;
  level: string;
  levelProgress: number; // 0 - 100
  affinity: string;
  isInsuredEligible?: boolean;
}

export const VAULT_WEAPONS: Record<string, WeaponVaultItem> = {
  ar: {
    id: 'ar',
    name: 'M4A1 TACTICAL',
    category: 'ASSAULT RIFLE',
    caliber: '5.56x45mm NATO',
    fireMode: 'FULL AUTO',
    description: 'Versatile military service rifle engineered for controlled mid-range engagements. High projectile velocity combined with predictable vertical recoil and fast magazine handling.',
    damage: 68,
    fireRate: 74,
    range: 70,
    accuracy: 76,
    recoilControl: 78,
    mobility: 72,
    rounds: 30,
    reserve: 150,
    level: 'LEVEL 26/30',
    levelProgress: 86,
    affinity: 'NATO SPEC-OPS'
  },
  shotgun: {
    id: 'shotgun',
    name: 'EXPEDITE 12',
    category: 'SHOTGUN',
    caliber: '12-GAUGE 00 BUCK',
    fireMode: 'PUMP ACTION',
    description: 'Heavy-bore pump-action tactical shotgun delivering devastating kinetic pellet spread. Excels in breach corridors, doorway ambushes, and point-blank CQB encounters.',
    damage: 94,
    fireRate: 34,
    range: 30,
    accuracy: 44,
    recoilControl: 46,
    mobility: 66,
    rounds: 8,
    reserve: 48,
    level: 'LEVEL 18/25',
    levelProgress: 72,
    affinity: 'CQC BREACH'
  },
  sniper: {
    id: 'sniper',
    name: 'HEAVY AP SNIPER',
    category: 'PRECISION RIFLE',
    caliber: '.50 BMG ANTI-MATERIEL',
    fireMode: 'BOLT ACTION',
    description: 'Extreme-range anti-materiel sniper rifle with high-magnification ballistic optic. High-velocity projectile delivers guaranteed one-shot terminal trauma to target hostiles.',
    damage: 98,
    fireRate: 18,
    range: 98,
    accuracy: 96,
    recoilControl: 24,
    mobility: 40,
    rounds: 5,
    reserve: 25,
    level: 'MAX LEVEL (30/30)',
    levelProgress: 100,
    affinity: 'OVERWATCH'
  },
  pistol: {
    id: 'pistol',
    name: 'COMBAT 9MM',
    category: 'SIDEARM',
    caliber: '9x19mm PARABELLUM',
    fireMode: 'SEMI AUTO',
    description: 'Lightweight tactical sidearm featuring rapid trigger reset and crisp combat sights. Immediate draw-to-fire transition makes it an essential contingency backup.',
    damage: 48,
    fireRate: 62,
    range: 46,
    accuracy: 72,
    recoilControl: 84,
    mobility: 96,
    rounds: 15,
    reserve: 60,
    level: 'LEVEL 14/20',
    levelProgress: 70,
    affinity: 'BACKUP SERVICE'
  },
  smg: {
    id: 'smg',
    name: 'VEL-46 SUBMACHINE',
    category: 'SUBMACHINE GUN',
    caliber: '4.6x30mm AP',
    fireMode: 'FULL AUTO',
    description: 'High-cadence personal defense weapon engineered for aggressive flanking and CQB room clearance. Devastating close-range rate of fire compensates for reduced muzzle range.',
    damage: 54,
    fireRate: 94,
    range: 44,
    accuracy: 64,
    recoilControl: 58,
    mobility: 92,
    rounds: 32,
    reserve: 160,
    level: 'LEVEL 26/30',
    levelProgress: 86,
    affinity: 'INFILTRATION'
  },
  lmg: {
    id: 'lmg',
    name: 'SAKIN HEAVY LMG',
    category: 'LIGHT MACHINE GUN',
    caliber: '7.62x51mm NATO',
    fireMode: 'FULL AUTO',
    description: 'Sustained-fire squad automatic weapon equipped with a 100-round continuous drum. Unrivaled suppression capabilities to hold chokepoints against advancing hostile squads.',
    damage: 78,
    fireRate: 68,
    range: 80,
    accuracy: 66,
    recoilControl: 54,
    mobility: 44,
    rounds: 100,
    reserve: 300,
    level: 'LEVEL 21/28',
    levelProgress: 75,
    affinity: 'SQUAD SUPPRESSION'
  },
  br: {
    id: 'br',
    name: 'F2000 BATTLE RIFLE',
    category: 'BATTLE RIFLE',
    caliber: '7.62x51mm HV',
    fireMode: '3-ROUND BURST',
    description: 'Hard-hitting precision rifle operating on a synchronized 3-round burst grouping. Delivers high terminal kinetic shock at mid to long combat ranges.',
    damage: 82,
    fireRate: 58,
    range: 86,
    accuracy: 88,
    recoilControl: 68,
    mobility: 64,
    rounds: 36,
    reserve: 180,
    level: 'LEVEL 25/30',
    levelProgress: 83,
    affinity: 'MID-LONG RECON'
  },
  laser: {
    id: 'laser',
    name: 'PLASMA BEAM RIFLE',
    category: 'DIRECTED ENERGY',
    caliber: 'SUPERHEATED ION BEAM',
    fireMode: 'CONTINUOUS BEAM',
    description: 'High-energy directed plasma firearm utilizing micro-capacitor coils. Strips personal kinetic shielding and melts hostile plating through relentless concentrated energy transfer.',
    damage: 70,
    fireRate: 92,
    range: 66,
    accuracy: 92,
    recoilControl: 92,
    mobility: 74,
    rounds: 100,
    reserve: 100,
    level: 'LEVEL 18/25',
    levelProgress: 72,
    affinity: 'ENERGY TECH'
  },
  minigun: {
    id: 'minigun',
    name: 'VULCAN ROTARY CANNON',
    category: 'SPECIAL HEAVY',
    caliber: '7.62x51mm ROTARY',
    fireMode: 'MOTORIZED FULL AUTO',
    description: 'Motorized multi-barrel rotary cannon delivering overwhelming cyclic suppression. Continuous belt-fed ammunition feed destroys heavy defenses and hostile swarms.',
    damage: 74,
    fireRate: 98,
    range: 74,
    accuracy: 52,
    recoilControl: 42,
    mobility: 32,
    rounds: 999,
    reserve: 999,
    level: 'LEVEL 15/20',
    levelProgress: 75,
    affinity: 'HEAVY TITAN'
  },
  railgun: {
    id: 'railgun',
    name: 'KINETIC AP RAILGUN',
    category: 'ELECTROMAGNETIC',
    caliber: '15mm TUNGSTEN SLUG',
    fireMode: 'CHARGED SLUG',
    description: 'Electromagnetic accelerator launching solid hyper-velocity tungsten slugs. High linear kinetic transfer obliterates armor and pierces targets in direct ballistic trajectories.',
    damage: 100,
    fireRate: 16,
    range: 100,
    accuracy: 98,
    recoilControl: 20,
    mobility: 36,
    rounds: 1,
    reserve: 30,
    level: 'MAX LEVEL (20/20)',
    levelProgress: 100,
    affinity: 'ANTI-MATERIEL AP'
  }
};

// Canonical 5-column by 2-row layout order matching reference Modern Warfare armory concept art
export const ARMORY_GRID_ORDER: string[] = [
  'ar', 'shotgun', 'sniper', 'pistol', 'smg',
  'lmg', 'br', 'laser', 'minigun', 'railgun'
];

// Tactical Ordnance for Insured Slot 3
export const ORDNANCE_ITEM: WeaponVaultItem = {
  id: 'grenade',
  name: 'M67 FRAG GRENADE',
  category: 'TACTICAL ORDNANCE',
  caliber: 'HIGH-EXPLOSIVE COMP-B',
  fireMode: 'TIMED FUSE (3.2S)',
  description: 'Military fragmentation grenade with internal delay fuse. Produces high-velocity steel shrapnel over a 7.5-meter lethal radius to flush out entrenched hostile combatants.',
  damage: 96,
  fireRate: 35,
  range: 55,
  accuracy: 82,
  recoilControl: 100,
  mobility: 90,
  rounds: 3,
  reserve: 6,
  level: 'MAX LEVEL',
  levelProgress: 100,
  affinity: 'TACTICAL ORDNANCE'
};

interface LoadoutDMZProps {
  selectedPrimary: string;
  setSelectedPrimary: (id: string) => void;
  selectedSecondary: string;
  setSelectedSecondary: (id: string) => void;
  selectedClassId: ClassId;
  setSelectedClassId: (id: ClassId) => void;
  visorType: VisorType;
  setVisorType: (type: VisorType) => void;
  onDeploy: () => void;
}

export const LoadoutDMZ: React.FC<LoadoutDMZProps> = ({
  selectedPrimary,
  setSelectedPrimary,
  selectedSecondary,
  setSelectedSecondary,
  selectedClassId,
  setSelectedClassId,
  visorType,
  setVisorType,
  onDeploy
}) => {
  // Currently inspected weapon in the armory (defaults to 'br' to match reference image)
  const [previewId, setPreviewId] = useState<string>(selectedPrimary || 'br');
  // Optional category filter
  const [stashFilter, setStashFilter] = useState<'ALL' | 'RIFLE' | 'CQB' | 'HEAVY' | 'TECH'>('ALL');
  const [careerLedger, setCareerLedger] = useState<FactionCareerLedger>(getCareerLedger);
  const [purchaseFeedback, setPurchaseFeedback] = useState<string | null>(null);

  // Sync ledger
  useEffect(() => {
    setCareerLedger(getCareerLedger());
  }, []);

  // Immediately synchronize active preview weapon with 3D lobby operator in real-time
  useEffect(() => {
    if ((window as any).__lobbyAvatar && previewId) {
      (window as any).__lobbyAvatar.setWeapon(previewId);
    }
  }, [previewId]);

  const activeWeapon: WeaponVaultItem = VAULT_WEAPONS[previewId] || VAULT_WEAPONS.br;
  const primaryItem: WeaponVaultItem = VAULT_WEAPONS[selectedPrimary] || VAULT_WEAPONS.ar;
  const secondaryItem: WeaponVaultItem = VAULT_WEAPONS[selectedSecondary] || VAULT_WEAPONS.pistol;

  // Filter stash while maintaining the canonical 10-card armory layout
  const displayedWeaponIds = ARMORY_GRID_ORDER.filter((id) => {
    const item = VAULT_WEAPONS[id];
    if (!item) return false;
    if (stashFilter === 'ALL') return true;
    if (stashFilter === 'RIFLE') return ['ASSAULT RIFLE', 'BATTLE RIFLE', 'PRECISION RIFLE'].includes(item.category);
    if (stashFilter === 'CQB') return ['SHOTGUN', 'SIDEARM', 'SUBMACHINE GUN'].includes(item.category);
    if (stashFilter === 'HEAVY') return ['LIGHT MACHINE GUN', 'SPECIAL HEAVY'].includes(item.category);
    if (stashFilter === 'TECH') return ['DIRECTED ENERGY', 'ELECTROMAGNETIC'].includes(item.category);
    return true;
  });

  const isEquippedSlot1 = selectedPrimary === activeWeapon.id;
  const isEquippedSlot2 = selectedSecondary === activeWeapon.id;
  const isActiveUnlocked = isItemUnlocked(activeWeapon.id, careerLedger);

  const handleEquipSlot1 = (weaponId: string = activeWeapon.id) => {
    if (!isItemUnlocked(weaponId, careerLedger)) {
      setPreviewId(weaponId);
      return;
    }
    if (selectedSecondary === weaponId) {
      setSelectedSecondary(selectedPrimary);
    }
    setSelectedPrimary(weaponId);
    if ((window as any).__lobbyAvatar) {
      (window as any).__lobbyAvatar.setWeapon(weaponId);
    }
  };

  const handleEquipSlot2 = (weaponId: string = activeWeapon.id) => {
    if (!isItemUnlocked(weaponId, careerLedger)) {
      setPreviewId(weaponId);
      return;
    }
    if (selectedPrimary === weaponId) {
      setSelectedPrimary(selectedSecondary);
    }
    setSelectedSecondary(weaponId);
  };

  const handleUnlockActiveWeapon = () => {
    const res = purchaseItemUnlock(activeWeapon.id, careerLedger);
    if (res.success) {
      setCareerLedger(res.updatedLedger);
      setPurchaseFeedback(`UNLOCKED: ${activeWeapon.name}!`);
      setTimeout(() => setPurchaseFeedback(null), 3000);
    } else {
      setPurchaseFeedback(res.error || 'Unlock requirements not met');
      setTimeout(() => setPurchaseFeedback(null), 3500);
    }
  };

  return (
    <div className="flex-1 w-full h-[calc(100vh-80px)] p-3 sm:p-5 flex flex-col pointer-events-auto select-none font-mono overflow-y-auto">
      {/* --------------------------------------------------------------------- */}
      {/* 1. TOP HEADER STRIP: Modern Tactical Armory Status                    */}
      {/* --------------------------------------------------------------------- */}
      <div className="w-full flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-[#2c3033] gap-3 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-white" />
            <span className="text-white font-black text-xs sm:text-sm tracking-widest uppercase">
              WEAPONS ARMORY // TACTICAL ARSENAL
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-[#8b98a1]">
            <span className="font-semibold text-white">PRIMARY:</span>
            <span className="text-[#38bdf8] font-bold">{primaryItem.name}</span>
            <span className="text-[#4b5563]">&bull;</span>
            <span className="font-semibold text-white">SECONDARY:</span>
            <span className="text-[#4ade80] font-bold">{secondaryItem.name}</span>
          </div>
        </div>

        {/* Filter Chips & Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#181a1c] border border-[#2c3033] rounded-lg p-0.5">
            {(['ALL', 'RIFLE', 'CQB', 'HEAVY', 'TECH'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStashFilter(filter)}
                className={`px-2.5 py-1 text-[9px] font-bold tracking-wider rounded-md cursor-pointer transition-colors ${
                  stashFilter === filter
                    ? 'bg-white text-black'
                    : 'text-[#8b98a1] hover:text-white hover:bg-[#25282b]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#181a1c] border border-[#2c3033] rounded-lg text-[9px] text-[#8b98a1]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CLASSES[selectedClassId]?.color || '#ffffff' }} />
            <span className="text-white font-bold">{CLASSES[selectedClassId]?.name}</span>
          </div>

          <button
            onClick={onDeploy}
            className="px-4 py-1.5 bg-white text-black font-black text-xs tracking-wider rounded-lg hover:bg-[#e5e5e5] transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,255,255,0.2)] active:scale-95"
          >
            <span>▶</span>
            <span>DEPLOY MATCH</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. UNIFORM ARMORY CARD GRID LAYOUT (Exact Modern Warfare Card Style)  */}
      {/* --------------------------------------------------------------------- */}
      <div className="w-full shrink-0 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {displayedWeaponIds.map((weaponId) => {
            const weapon = VAULT_WEAPONS[weaponId];
            if (!weapon) return null;

            const isSelected = previewId === weapon.id;
            const isSlot1 = selectedPrimary === weapon.id;
            const isSlot2 = selectedSecondary === weapon.id;
            const isUnlocked = isItemUnlocked(weapon.id, careerLedger);
            const req = UNLOCK_CATALOG[weapon.id];

            return (
              <div
                key={weapon.id}
                onClick={() => {
                  setPreviewId(weapon.id);
                  if (isUnlocked) {
                    if (selectedSecondary === weapon.id) {
                      if ((window as any).__lobbyAvatar) {
                        (window as any).__lobbyAvatar.setWeapon(weapon.id);
                      }
                    } else {
                      handleEquipSlot1(weapon.id);
                    }
                  }
                }}
                className={`group relative flex flex-col justify-between rounded-xl p-3.5 sm:p-4 transition-all duration-150 cursor-pointer select-none bg-[#202325] h-48 sm:h-52 ${
                  isSelected
                    ? 'border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.22)] bg-[#25292c]'
                    : 'border border-[#383d40] hover:border-white/50 hover:bg-[#25282b]'
                } ${!isUnlocked ? 'opacity-85' : ''}`}
              >
                {/* Top Row: Category in tiny minimalist font (top-left) & Slot Badges (top-right) */}
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] sm:text-[10px] font-mono font-semibold tracking-wider text-[#8b98a1] uppercase truncate max-w-[65%]">
                    {weapon.category}
                  </span>

                  {/* Slot Indicator Pill or Locked Status */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isUnlocked && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-[#382020] text-[#f87171] border border-[#5a2828] tracking-wider flex items-center gap-1">
                        <span>🔒</span>
                        <span>{req?.minRank ? `R-${req.minRank}` : 'LOCKED'}</span>
                      </span>
                    )}
                    {isSlot2 && (
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-mono font-bold bg-[#1a2d1d] text-[#4ade80] border border-[#2e5233] tracking-wider">
                        SLOT 2
                      </span>
                    )}
                    {isSlot1 && (
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-mono font-bold bg-[#142834] text-[#38bdf8] border border-[#1e4963] tracking-wider">
                        SLOT 1
                      </span>
                    )}
                  </div>
                </div>

                {/* Weapon Silhouette Centerpiece: Centered with generous breathing room */}
                <div className="w-full flex-1 flex items-center justify-center my-1 px-1 relative">
                  <WeaponSilhouette
                    id={weapon.id}
                    className={`w-full h-full max-h-24 sm:max-h-28 text-white transition-transform duration-200 ${
                      isSelected ? 'scale-105 brightness-110' : 'group-hover:scale-105'
                    } ${!isUnlocked ? 'opacity-50 grayscale' : ''}`}
                  />
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="px-2 py-1 rounded bg-black/80 border border-white/20 text-[9px] font-bold text-white tracking-widest uppercase backdrop-blur-xs">
                        {req ? (req.reqType === 'both' ? `RANK ${req.minRank} + $${req.fundsPrice}` : req.reqType === 'rank' ? `RANK ${req.minRank}` : `$${req.fundsPrice}`) : 'LOCKED'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Name & Level (bottom-left), Ammo Capacity (bottom-right) */}
                <div className="flex items-end justify-between pt-1 border-t border-[#2a2e31]">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs sm:text-sm font-black text-white tracking-wide uppercase truncate leading-tight">
                      {weapon.name}
                    </span>
                    <span className="text-[9px] sm:text-[9.5px] font-mono text-[#8b98a1] uppercase mt-0.5 tracking-normal">
                      {isUnlocked ? weapon.level : (req?.fundsPrice ? `REQUIRES $${req.fundsPrice}` : 'CLASSIFIED')}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-mono font-bold text-[#8b98a1] shrink-0 whitespace-nowrap">
                    {weapon.rounds}R
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. TACTICAL TELEMETRY & EQUIPPING CONTROL DRAWER                      */}
      {/* --------------------------------------------------------------------- */}
      <div className="w-full bg-[#181a1c] border border-[#2c3033] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 shrink-0">
        {/* Left: Weapon Platform Summary */}
        <div className="lg:max-w-md space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-[#8b98a1] uppercase font-bold tracking-wider">{activeWeapon.category}</span>
            <span className="text-[#4b5563]">&bull;</span>
            <span className="text-[#f59e0b] font-bold">{activeWeapon.affinity}</span>
            <span className="text-[#4b5563]">&bull;</span>
            <span className="text-white font-bold">{activeWeapon.caliber}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
              {activeWeapon.name}
            </h2>
            <span className="text-[10px] font-mono text-[#8b98a1] font-semibold">
              [{activeWeapon.fireMode}]
            </span>
          </div>
          <p className="text-xs text-[#9ca3af] leading-relaxed whitespace-normal pr-2">
            {activeWeapon.description}
          </p>
        </div>

        {/* Center: Real Tactical Attributes Stat Bar Gauges */}
        <div className="flex-1 max-w-xl grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 py-2 lg:py-0 lg:border-x lg:border-[#2c3033] lg:px-6">
          {/* Damage */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-[#8b98a1]">
              <span>DAMAGE</span>
              <span className="text-white font-bold">{activeWeapon.damage}</span>
            </div>
            <div className="w-full h-1 bg-[#282c2f] rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-300" style={{ width: `${activeWeapon.damage}%` }} />
            </div>
          </div>

          {/* Fire Rate */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-[#8b98a1]">
              <span>FIRE RATE</span>
              <span className="text-white font-bold">{activeWeapon.fireRate}</span>
            </div>
            <div className="w-full h-1 bg-[#282c2f] rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-300" style={{ width: `${activeWeapon.fireRate}%` }} />
            </div>
          </div>

          {/* Range */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-[#8b98a1]">
              <span>RANGE</span>
              <span className="text-white font-bold">{activeWeapon.range}</span>
            </div>
            <div className="w-full h-1 bg-[#282c2f] rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-300" style={{ width: `${activeWeapon.range}%` }} />
            </div>
          </div>

          {/* Accuracy */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-[#8b98a1]">
              <span>ACCURACY</span>
              <span className="text-white font-bold">{activeWeapon.accuracy}</span>
            </div>
            <div className="w-full h-1 bg-[#282c2f] rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-300" style={{ width: `${activeWeapon.accuracy}%` }} />
            </div>
          </div>

          {/* Recoil Control */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-[#8b98a1]">
              <span>RECOIL CTRL</span>
              <span className="text-white font-bold">{activeWeapon.recoilControl}</span>
            </div>
            <div className="w-full h-1 bg-[#282c2f] rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-300" style={{ width: `${activeWeapon.recoilControl}%` }} />
            </div>
          </div>

          {/* Mobility */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-[#8b98a1]">
              <span>MOBILITY</span>
              <span className="text-white font-bold">{activeWeapon.mobility}</span>
            </div>
            <div className="w-full h-1 bg-[#282c2f] rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-300" style={{ width: `${activeWeapon.mobility}%` }} />
            </div>
          </div>
        </div>

        {/* Right: Quick Equip Loadout Buttons or Unlock Action */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 justify-center min-w-[210px]">
          {purchaseFeedback && (
            <div className="text-[10px] font-mono font-bold text-center px-2 py-1 rounded bg-black/80 border border-white/20 text-[#2de2e6]">
              {purchaseFeedback}
            </div>
          )}

          {!isActiveUnlocked ? (
            (() => {
              const req = UNLOCK_CATALOG[activeWeapon.id];
              const rankMet = !req?.minRank || careerLedger.rank >= req.minRank;
              const fundsMet = !req?.fundsPrice || careerLedger.combatFunds >= req.fundsPrice;
              const canUnlock = rankMet && fundsMet;

              return (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[9.5px] font-mono text-center text-[#8b98a1]">
                    {req?.reqType === 'both' ? (
                      <span>REQ: RANK {req.minRank} + ${req.fundsPrice?.toLocaleString()}</span>
                    ) : req?.reqType === 'rank' ? (
                      <span>REQ: RANK {req.minRank}</span>
                    ) : (
                      <span>REQ: ${req?.fundsPrice?.toLocaleString()}</span>
                    )}
                  </div>
                  <button
                    onClick={handleUnlockActiveWeapon}
                    disabled={!canUnlock}
                    className={`px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                      canUnlock
                        ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                        : 'bg-[#2a2020] text-[#8b98a1] border border-[#4a2828] cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span>🔓</span>
                    <span>
                      {req?.fundsPrice && req.fundsPrice > 0
                        ? `UNLOCK FOR $${req.fundsPrice.toLocaleString()}`
                        : `UNLOCK AT RANK ${req?.minRank || 1}`}
                    </span>
                  </button>
                  {!rankMet && (
                    <div className="text-[8.5px] font-mono text-[#f87171] text-center">
                      CURRENT RANK {careerLedger.rank} / {req?.minRank}
                    </div>
                  )}
                  {!fundsMet && (
                    <div className="text-[8.5px] font-mono text-[#f87171] text-center">
                      NEED ${(req?.fundsPrice! - careerLedger.combatFunds).toLocaleString()} MORE FUNDS
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <>
              <button
                onClick={() => handleEquipSlot1()}
                className={`px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  isEquippedSlot1
                    ? 'bg-[#142834] text-[#38bdf8] border border-[#1e4963]'
                    : 'bg-[#202325] text-white border border-[#383d40] hover:border-white hover:bg-[#25292c]'
                }`}
              >
                <span>{isEquippedSlot1 ? '✓ PRIMARY EQUIPPED' : 'EQUIP PRIMARY (SLOT 1)'}</span>
              </button>

              <button
                onClick={() => handleEquipSlot2()}
                className={`px-4 py-2 text-xs font-bold font-mono tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  isEquippedSlot2
                    ? 'bg-[#1a2d1d] text-[#4ade80] border border-[#2e5233]'
                    : 'bg-[#202325] text-white border border-[#383d40] hover:border-white hover:bg-[#25292c]'
                }`}
              >
                <span>{isEquippedSlot2 ? '✓ SECONDARY EQUIPPED' : 'EQUIP SECONDARY (SLOT 2)'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
