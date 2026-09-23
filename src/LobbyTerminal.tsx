import React, { useState, useEffect, useRef } from 'react';
import { GameMode, ClassId, DeploymentProtocol, EliteCompanionConfig, DEFAULT_ELITE_SQUAD } from './types';
import { CLASSES } from './App';
import { VisorType, FactionType } from './lobbyAvatar';
import { LoadoutDMZ, VAULT_WEAPONS, WeaponSilhouette } from './LoadoutDMZ';
import { useFaction, GearTier, HeadgearOption, TorsoOption, LowerOption } from './FactionContext';
import {
  getCareerLedger,
  saveCareerLedger,
  FactionCareerLedger,
  getRankTitle,
  getXpForRank,
  isItemUnlocked,
  purchaseItemUnlock,
  UNLOCK_CATALOG
} from './careerLedger';

export type LobbyTab = 'play' | 'factions' | 'loadout' | 'locker' | 'gamemode' | 'intel';

export interface PersistentStats {
  totalKills: number;
  totalHeadshots: number;
  totalShots: number;
  totalHits: number;
  totalFunds: number;
  highestWave: number;
  matchesPlayed: number;
  matchesWon: number;
  totalXp?: number;
  rank?: number;
}

export interface LobbyTerminalProps {
  activeTab: LobbyTab;
  setActiveTab: (tab: LobbyTab) => void;
  factionAlignment: FactionType;
  setFactionAlignment: (f: FactionType) => void;
  gearTier?: GearTier;
  setGearTier?: (tier: GearTier) => void;
  visorType: VisorType;
  setVisorType: (v: VisorType) => void;
  selectedClassId: ClassId;
  setSelectedClassId: (c: ClassId) => void;
  selectedPrimary: string;
  setSelectedPrimary: (p: string) => void;
  selectedSecondary: string;
  setSelectedSecondary: (s: string) => void;
  matchMode: GameMode;
  setMatchMode: (m: GameMode) => void;
  friendlyCount: number;
  setFriendlyCount: (n: number) => void;
  enemyCount: number;
  setEnemyCount: (n: number) => void;
  targetScore: number;
  setTargetScore: (n: number) => void;
  difficultyKey: string;
  setDifficultyKey: (d: string) => void;
  selectedMapState: 'training' | 'hangar';
  setSelectedMapState: (m: 'training' | 'hangar') => void;
  isDevMode: boolean;
  setIsDevMode: (b: boolean) => void;
  deploymentProtocol?: DeploymentProtocol;
  setDeploymentProtocol?: (p: DeploymentProtocol) => void;
  eliteSquad?: EliteCompanionConfig[];
  setEliteSquad?: (squad: EliteCompanionConfig[]) => void;
  onDeploy: () => void;
  showAudioHelper: boolean;
  setShowAudioHelper: (show: boolean) => void;
}

export const ARMORY_CATEGORIES = {
  primary: [
    { id: 'ar', label: 'M4A1 Tactical Suppressed', category: 'ASSAULT RIFLES' },
    { id: 'br', label: 'FAMAS Bullpup Burst', category: 'ASSAULT RIFLES' },
    { id: 'shotgun', label: 'Pump-Action 12-Gauge', category: 'SHOTGUNS' },
    { id: 'lmg', label: 'LMG Support Box', category: 'SPECIAL HEAVIES' },
    { id: 'minigun', label: 'Heavy Minigun', category: 'SPECIAL HEAVIES' },
    { id: 'railgun', label: 'Kinetic AP Railgun', category: 'SPECIAL HEAVIES' },
    { id: 'sniper', label: 'Bolt-Action Heavy Sniper', category: 'PRECISION' },
    { id: 'laser', label: 'Covenant Plasma Rifle', category: 'ENERGY' }
  ],
  secondary: [
    { id: 'pistol', label: 'Combat 9mm Pistol', category: 'SIDEARMS' },
    { id: 'smg', label: 'Submachine Gun (SMG)', category: 'COMPACT FIREARMS' },
    { id: 'shotgun', label: 'Pump-Action 12-Gauge', category: 'SHOTGUNS' },
    { id: 'laser', label: 'Covenant Plasma Rifle', category: 'ENERGY' }
  ]
};

export const HELMET_LOCKER_OPTIONS: { id: VisorType; name: string; tint: string; desc: string }[] = [
  {
    id: 'standard',
    name: 'STANDARD USMC BATTLE-VISOR',
    tint: '#2de2e6',
    desc: 'High-contrast optical eye-port with crisp neon-blue defense matrix and target telemetry.'
  },
  {
    id: 'recon',
    name: 'RECON NIGHT-VISION MATRIX',
    tint: '#00ff66',
    desc: 'Intense glowing green-phosphor electronic scanline overlay for dark operational stealth.'
  },
  {
    id: 'apex',
    name: 'APEX MERCENARY TERMINAL',
    tint: '#ff2a2a',
    desc: 'Aggressive crimson-red combat tracking HUD scheme with high-priority threat highlighting.'
  }
];

// Technical Micro-Grid Telemetry Canvas Component
function MicroGridCanvas({ tint = '#2de2e6' }: { tint?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.04;
      const w = canvas.width;
      const h = canvas.height;

      // Dark technical background
      ctx.fillStyle = '#060a0f';
      ctx.fillRect(0, 0, w, h);

      // Grid Lines
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = `${tint}22`;
      const step = 10;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center crosshair / dashed line
      ctx.strokeStyle = `${tint}44`;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ambient frequency / wave line 1 (Primary telemetry wave with visor tint)
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = tint;
      ctx.shadowColor = tint;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const wave1 = Math.sin(nx * 12 + time * 2.5) * 10;
        const wave2 = Math.cos(nx * 24 - time * 1.8) * 4;
        const noise = Math.sin(nx * 50 + time * 6) * 2.5;
        const y = h / 2 + wave1 + wave2 + noise;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Secondary pulse line (tactical ping)
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.75)';
      ctx.beginPath();
      for (let x = 0; x < w; x += 3) {
        const nx = x / w;
        const y = h / 2 + Math.sin(nx * 6 - time * 1.2) * 14;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Plotted Data Points & Coordinate Markers
      const px = (Math.sin(time * 0.8) * 0.35 + 0.5) * w;
      const py = h / 2 + Math.sin(time * 2.5) * 12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();

      // Mini corner border
      ctx.strokeStyle = tint;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-end">
      <div className="text-[9px] text-[#f5a623] tracking-widest font-mono mb-0.5">
        NICRS-0020
      </div>
      <canvas
        ref={canvasRef}
        width={132}
        height={72}
        className="rounded-xs border border-[#2de2e6]/30 shadow-[0_0_10px_rgba(45,226,230,0.15)] bg-black/60"
      />
    </div>
  );
}

// Tactical iOS/Military Styled Smooth Toggle Switch
function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  id
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-white/20 transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${checked ? 'bg-[#2de2e6] border-[#2de2e6]' : 'bg-black/70'}`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-[2px] ${
          checked ? 'translate-x-4 bg-black' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// Horizontal Tier Slider
function HorizontalTierSlider({
  level,
  onChange
}: {
  level: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, level - 1))}
        className="w-5 h-5 flex items-center justify-center text-xs font-bold text-[#8b98a1] hover:text-white bg-black/40 border border-white/10 rounded-xs cursor-pointer select-none"
      >
        ―
      </button>
      <div className="flex-1 relative h-2 bg-black/70 rounded-full border border-white/10 flex items-center px-0.5 cursor-pointer">
        <div
          className="h-1 bg-[#2de2e6] rounded-full transition-all"
          style={{ width: `${(level / 5) * 100}%` }}
        />
        <div
          className="absolute w-3 h-3 bg-white border-2 border-[#2de2e6] rounded-full shadow-[0_0_8px_#2de2e6] -translate-x-1/2 transition-all"
          style={{ left: `${(level / 5) * 100}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(5, level + 1))}
        className="w-5 h-5 flex items-center justify-center text-xs font-bold text-[#8b98a1] hover:text-white bg-black/40 border border-white/10 rounded-xs cursor-pointer select-none"
      >
        +
      </button>
    </div>
  );
}

export const getPersistentStats = (): PersistentStats => {
  try {
    const ledger = getCareerLedger();
    return {
      totalKills: ledger.totalKills,
      totalHeadshots: ledger.totalHeadshots,
      totalShots: ledger.totalShots,
      totalHits: ledger.totalHits,
      totalFunds: ledger.combatFunds,
      highestWave: ledger.highestWave,
      matchesPlayed: ledger.matchesPlayed,
      matchesWon: ledger.matchesWon,
      totalXp: ledger.totalXp,
      rank: ledger.rank
    };
  } catch (e) {}
  return {
    totalKills: 38,
    totalHeadshots: 14,
    totalShots: 420,
    totalHits: 215,
    totalFunds: 3450,
    highestWave: 7,
    matchesPlayed: 12,
    matchesWon: 9,
    totalXp: 1800,
    rank: 4
  };
};

export const LobbyTerminal: React.FC<LobbyTerminalProps> = ({
  activeTab,
  setActiveTab,
  factionAlignment,
  setFactionAlignment,
  gearTier,
  setGearTier,
  visorType,
  setVisorType,
  selectedClassId,
  setSelectedClassId,
  selectedPrimary,
  setSelectedPrimary,
  selectedSecondary,
  setSelectedSecondary,
  matchMode,
  setMatchMode,
  friendlyCount,
  setFriendlyCount,
  enemyCount,
  setEnemyCount,
  targetScore,
  setTargetScore,
  difficultyKey,
  setDifficultyKey,
  selectedMapState,
  setSelectedMapState,
  isDevMode,
  setIsDevMode,
  deploymentProtocol = 'elite',
  setDeploymentProtocol,
  eliteSquad = DEFAULT_ELITE_SQUAD,
  setEliteSquad,
  onDeploy,
  showAudioHelper,
  setShowAudioHelper
}) => {
  const factionCtx = useFaction();
  const currentFaction = factionAlignment || factionCtx.faction;
  const currentGearTier = gearTier || factionCtx.gearTier;

  const handleFactionSelect = (f: FactionType) => {
    setFactionAlignment(f);
    factionCtx.setFaction(f);
    localStorage.setItem('gun_arena_faction', f);
    if ((window as any).__lobbyAvatar) {
      (window as any).__lobbyAvatar.setFaction(f);
    }
  };

  const handleGearTierSelect = (tier: GearTier) => {
    if (setGearTier) setGearTier(tier);
    factionCtx.setGearTier(tier);
    localStorage.setItem('gun_arena_gear_tier', tier);
    if ((window as any).__lobbyAvatar) {
      (window as any).__lobbyAvatar.setGearTier(tier);
    }
  };

  const handleVisorSelect = (v: VisorType) => {
    setVisorType(v);
    localStorage.setItem('gun_arena_visor', v);
    if ((window as any).__lobbyAvatar) {
      (window as any).__lobbyAvatar.setVisor(v);
    }
  };

  const handleHeadgearSelect = (opt: HeadgearOption) => {
    factionCtx.setHeadgear(opt);
    localStorage.setItem('gun_arena_headgear', opt);
    if ((window as any).__lobbyAvatar) {
      (window as any).__lobbyAvatar.setHeadgear(opt);
    }
  };

  const handleTorsoSelect = (opt: TorsoOption) => {
    factionCtx.setTorsoConfig(opt);
    localStorage.setItem('gun_arena_torso', opt);
    if ((window as any).__lobbyAvatar) {
      (window as any).__lobbyAvatar.setTorsoConfig(opt);
    }
  };

  const handleLowerSelect = (opt: LowerOption) => {
    factionCtx.setLowerConfig(opt);
    localStorage.setItem('gun_arena_lower', opt);
    if ((window as any).__lobbyAvatar) {
      (window as any).__lobbyAvatar.setLowerConfig(opt);
    }
  };

  const [intelStats, setIntelStats] = useState<PersistentStats>(getPersistentStats);
  const [careerLedger, setCareerLedger] = useState<FactionCareerLedger>(getCareerLedger);
  const [lockerPurchaseFeedback, setLockerPurchaseFeedback] = useState<string | null>(null);

  // Sync career ledger state when tabs change or on mount
  useEffect(() => {
    const updated = getCareerLedger();
    setCareerLedger(updated);
    setIntelStats({
      totalKills: updated.totalKills,
      totalHeadshots: updated.totalHeadshots,
      totalShots: updated.totalShots,
      totalHits: updated.totalHits,
      totalFunds: updated.combatFunds,
      highestWave: updated.highestWave,
      matchesPlayed: updated.matchesPlayed,
      matchesWon: updated.matchesWon,
      totalXp: updated.totalXp,
      rank: updated.rank
    });
  }, [activeTab]);

  // Strict Map Rules State Guardrail: Horde Mode strictly enforces Subterranean Hangar map
  useEffect(() => {
    if ((matchMode === 'zombie' || matchMode === 'extraction') && selectedMapState !== 'hangar') {
      setSelectedMapState('hangar');
    }
  }, [matchMode, selectedMapState, setSelectedMapState]);

  const handleUnlockAndEquip = (
    itemId: string,
    type: 'headgear' | 'torso' | 'lower',
    fallbackEquip: () => void
  ) => {
    if (isItemUnlocked(itemId, careerLedger)) {
      fallbackEquip();
      setLockerPurchaseFeedback(null);
      return;
    }

    const res = purchaseItemUnlock(itemId, careerLedger);
    if (res.success) {
      setCareerLedger(res.updatedLedger);
      fallbackEquip();
      setLockerPurchaseFeedback(`UNLOCKED: ${UNLOCK_CATALOG[itemId]?.name || itemId.toUpperCase()}!`);
      setTimeout(() => setLockerPurchaseFeedback(null), 3500);
    } else {
      setLockerPurchaseFeedback(res.error || 'Unlock requirements not met');
      setTimeout(() => setLockerPurchaseFeedback(null), 3500);
    }
  };

  const currentVisorConfig = HELMET_LOCKER_OPTIONS.find((v) => v.id === visorType) || HELMET_LOCKER_OPTIONS[0];
  const [currentTierLevel, setCurrentTierLevel] = useState<number>(currentGearTier === 'specialized' ? 4 : 2);
  const [activePreviewSlot, setActivePreviewSlot] = useState<'primary' | 'secondary'>('primary');

  const slot1Item = VAULT_WEAPONS[selectedPrimary] || VAULT_WEAPONS.ar;
  const slot2Item = VAULT_WEAPONS[selectedSecondary] || VAULT_WEAPONS.pistol;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between select-none font-mono overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. TOP HUD HEADER BAR: Exact Reference Layout                             */}
      {/* ========================================================================= */}
      <div className="w-full bg-[#080c10]/95 border-b border-white/10 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center justify-between pointer-events-auto z-40 shadow-2xl">
        {/* Left Section: Back Button and Title */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setActiveTab('play')}
            className="px-2 py-0.5 border border-white/20 bg-white/5 rounded-xs text-xs font-bold text-[#8b98a1] hover:text-white hover:border-white/40 transition-colors cursor-pointer"
          >
            [ &lt; ]
          </button>
          <div className="text-xs md:text-sm font-bold tracking-widest text-[#e8edf0] flex items-center gap-2">
            <span className="w-1.5 h-3.5" style={{ backgroundColor: currentVisorConfig.tint }} />
            <span>VAULTDASH / GUN LOCKER</span>
          </div>
        </div>

        {/* Center: Centered borderless high-contrast tab row */}
        <div className="flex items-center gap-1 sm:gap-2">
          {(['play', 'factions', 'loadout', 'locker', 'gamemode', 'intel'] as LobbyTab[]).map((tab) => {
            const isActive = activeTab === tab;
            const tabLabels: Record<LobbyTab, string> = {
              play: 'PLAY',
              factions: 'FACTIONS & CLASSES',
              loadout: 'WEAPONS',
              locker: 'LOCKER',
              gamemode: 'GAME MODE',
              intel: 'INTEL'
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 text-xs tracking-wider transition-all cursor-pointer rounded-xs ${
                  isActive
                    ? 'bg-[#e8edf0] text-black font-extrabold shadow-sm'
                    : 'text-[#8b98a1] hover:text-white font-semibold'
                }`}
                style={isActive ? { borderBottom: `2px solid ${currentVisorConfig.tint}` } : undefined}
              >
                [ {tabLabels[tab]} ]
              </button>
            );
          })}
        </div>

        {/* Right Corner Utilities: Audio Guide, Rank, Combat Funds & Launch Fullscreen */}
        <div className="flex items-center gap-2.5">
          {/* Faction Career Progression Quick Indicator */}
          <div className="flex items-center gap-2 bg-black/60 border border-white/15 px-2.5 py-1 rounded-xs">
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span className="text-[#8b98a1]">RANK</span>
              <span className="font-extrabold text-[#2de2e6]">{careerLedger.rank}</span>
            </div>
            <div className="w-[1px] h-3 bg-white/20" />
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span className="font-extrabold text-[#f5a623]">${careerLedger.combatFunds.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => setShowAudioHelper(!showAudioHelper)}
            className="px-2.5 py-1 rounded bg-[#f5a623]/20 border border-[#f5a623]/60 text-[#f5a623] text-[10px] font-bold cursor-pointer hover:bg-[#f5a623]/30 transition-colors"
          >
            Audio Guide
          </button>
          <a
            href="https://ais-dev-mlmvjg57dudsycsch4poan-271150104517.asia-southeast1.run.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] hover:underline flex items-center gap-1 font-bold opacity-90 hover:opacity-100"
            style={{ color: currentVisorConfig.tint }}
          >
            <span>Fullscreen Tab</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* Audio Helper Modal */}
      {showAudioHelper && (
        <div className="absolute top-14 right-6 w-96 p-3 bg-black/95 border border-[#f5a623] text-xs text-[#e8edf0] rounded shadow-2xl z-50 pointer-events-auto max-h-72 overflow-y-auto">
          <div className="font-bold text-[#f5a623] tracking-wide mb-1 flex items-center justify-between">
            <span>LOCAL AUDIO PRESERVATION MAPPING</span>
            <button onClick={() => setShowAudioHelper(false)} className="text-white hover:text-red-400 cursor-pointer">✕</button>
          </div>
          <p className="text-[10px] text-[#8b98a1] mb-2">
            Mapped to clean relative filenames for instant desktop offline play:
          </p>
          <div className="text-[9px] bg-black/50 p-2 border border-white/10 space-y-1">
            <div>• Rifle / Pistol / SMG fire: <code className="text-[#2de2e6]">pistol_fire.mp3</code> / <code className="text-[#2de2e6]">smg_fire.mp3</code></div>
            <div>• Reloading: <code className="text-[#2de2e6]">dragon-studio-gun-reload-2-511308.mp3</code></div>
            <div>• Footsteps & Jump: <code className="text-[#2de2e6]">footstep_1.mp3</code> / <code className="text-[#2de2e6]">jump_grunt.mp3</code></div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB VIEWPORTS                                                          */}
      {/* ========================================================================= */}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 1: [ PLAY ] Home Hub (Avatar Canvas Showcase)                         */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'play' && (
        <div className="relative z-10 flex justify-between p-6 pointer-events-none flex-1 w-full items-end">
          {/* LEFT TERMINAL COLUMN */}
          <div className="w-88 max-w-[42vw] flex flex-col gap-3 pointer-events-auto max-h-[calc(100vh-6.5rem)] overflow-y-auto custom-scroll pb-2">
            
            {/* Card: [OPERATOR FACTION ALLIANCE] */}
            <div className="bg-[#0c1015]/85 border border-white/15 backdrop-blur-md p-4 rounded-sm shadow-2xl flex flex-col gap-3">
              <div className="text-xs font-bold tracking-wider text-[#e8edf0] flex items-center justify-between">
                <span>[OPERATOR FACTION ALLIANCE]</span>
              </div>

              {/* Horizontal Tier Slider */}
              <HorizontalTierSlider
                level={currentTierLevel}
                onChange={(lvl) => {
                  setCurrentTierLevel(lvl);
                  handleGearTierSelect(lvl >= 3 ? 'specialized' : 'standard');
                }}
              />

              {/* 3 Toggle Switch Rows */}
              <div className="flex flex-col gap-2.5 pt-1 border-t border-white/10">
                {/* Row 1: ALLIANCE toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#cbd5e1] tracking-wide">ALLIANCE</span>
                    <span className="text-[9px] text-[#8b98a1]">
                      {currentFaction === 'usmc' ? 'USMC (COALITION)' : 'APEX PMC (CONTRACTOR)'}
                    </span>
                  </div>
                  <ToggleSwitch
                    id="toggle-alliance"
                    checked={currentFaction === 'apex'}
                    onChange={(checked) => handleFactionSelect(checked ? 'apex' : 'usmc')}
                  />
                </div>

                {/* Row 2: SECONDARY SIDEARM toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#cbd5e1] tracking-wide">SECONDARY SIDEARM</span>
                    <span className="text-[9px] text-[#8b98a1]">
                      {slot2Item.name} ({slot2Item.rounds}R)
                    </span>
                  </div>
                  <ToggleSwitch
                    id="toggle-shotgun"
                    checked={selectedSecondary === 'shotgun'}
                    onChange={(checked) => setSelectedSecondary(checked ? 'shotgun' : 'pistol')}
                  />
                </div>

                {/* Row 3: GAME MODE toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#cbd5e1] tracking-wide">GAME MODE</span>
                    <span className="text-[9px] text-[#8b98a1]">
                      {matchMode === 'zombie' ? 'ZOMBIE WAVE SURVIVAL' : 'TACTICAL DEATHMATCH'}
                    </span>
                  </div>
                  <ToggleSwitch
                    id="toggle-gamemode"
                    checked={matchMode === 'zombie'}
                    onChange={(checked) => setMatchMode(checked ? 'zombie' : 'team')}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: CHEGGE MODDEL (Grounded Gear Tier Toggle) */}
            <div className="bg-[#0c1015]/85 border border-white/15 backdrop-blur-md px-4 py-3 rounded-sm shadow-xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#e8edf0] tracking-wider">CHEGGE MODDEL</span>
                <span className="text-[9px] text-[#8b98a1]">
                  {currentGearTier === 'specialized' ? 'SPECIALIZED GEAR ACTIVE' : 'STANDARD ISSUE BASELINE'}
                </span>
              </div>
              <ToggleSwitch
                id="toggle-chegge-model"
                checked={currentGearTier === 'specialized'}
                onChange={(checked) => handleGearTierSelect(checked ? 'specialized' : 'standard')}
              />
            </div>

            {/* Dynamic Loadout Synchronization Cards (Slot 1: Primary Weapon, Slot 2: Secondary Weapon) */}
            <div className="flex flex-col gap-2.5">
              {/* Card 4: Slot 1 - Primary Weapon */}
              <button
                type="button"
                id="lobby-preview-slot1"
                onClick={() => {
                  setActivePreviewSlot('primary');
                  if ((window as any).__lobbyAvatar) {
                    (window as any).__lobbyAvatar.setWeapon(selectedPrimary);
                  }
                }}
                className={`p-3 text-left rounded-sm backdrop-blur-md transition-all cursor-pointer border flex flex-col gap-1.5 ${
                  activePreviewSlot === 'primary'
                    ? 'border-white bg-white/10 shadow-[0_0_14px_rgba(255,255,255,0.18)]'
                    : 'border-white/15 bg-[#0c1015]/85 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-[#8b98a1]">
                  <span>SLOT 01 // PRIMARY</span>
                  <span className="text-[9px] text-[#cbd5e1] font-semibold uppercase">{slot1Item.category}</span>
                </div>
                <div className="py-1 flex items-center justify-center h-12">
                  <WeaponSilhouette id={slot1Item.id} className="w-full h-11 stroke-[#cbd5e1] fill-none" />
                </div>
                <div className="text-xs font-extrabold text-white tracking-wide truncate">
                  {slot1Item.name}
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#8b98a1] pt-1">
                  <span>{slot1Item.level}</span>
                  <span className="font-bold" style={{ color: currentVisorConfig.tint }}>{slot1Item.rounds}R</span>
                </div>
                <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${slot1Item.levelProgress}%`, backgroundColor: currentVisorConfig.tint }} />
                </div>
              </button>

              {/* Card 5: Slot 2 - Secondary Weapon */}
              <button
                type="button"
                id="lobby-preview-slot2"
                onClick={() => {
                  setActivePreviewSlot('secondary');
                  if ((window as any).__lobbyAvatar) {
                    (window as any).__lobbyAvatar.setWeapon(selectedSecondary);
                  }
                }}
                className={`p-3 text-left rounded-sm backdrop-blur-md transition-all cursor-pointer border flex flex-col gap-1.5 ${
                  activePreviewSlot === 'secondary'
                    ? 'border-white bg-white/10 shadow-[0_0_14px_rgba(255,255,255,0.18)]'
                    : 'border-white/15 bg-[#0c1015]/85 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-[#8b98a1]">
                  <span>SLOT 02 // SECONDARY</span>
                  <span className="text-[9px] text-[#cbd5e1] font-semibold uppercase">{slot2Item.category}</span>
                </div>
                <div className="py-1 flex items-center justify-center h-12">
                  <WeaponSilhouette id={slot2Item.id} className="w-full h-11 stroke-[#cbd5e1] fill-none" />
                </div>
                <div className="text-xs font-extrabold text-white tracking-wide truncate">
                  {slot2Item.name}
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#8b98a1] pt-1">
                  <span>{slot2Item.level}</span>
                  <span className="font-bold" style={{ color: currentVisorConfig.tint }}>{slot2Item.rounds}R</span>
                </div>
                <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${slot2Item.levelProgress}%`, backgroundColor: currentVisorConfig.tint }} />
                </div>
              </button>
            </div>
          </div>

          {/* CENTER GAP IS OPEN FOR 3D AVATAR VIEWPORT */}

          {/* RIGHT COMMAND TERMINAL */}
          <div className="w-88 max-w-[42vw] bg-[#0c1015]/85 border border-white/15 backdrop-blur-md p-4 rounded-sm pointer-events-auto shadow-2xl flex flex-col gap-3.5 max-h-[calc(100vh-6.5rem)] overflow-y-auto custom-scroll pb-2">
            {/* Header */}
            <div className="text-xs font-bold tracking-wider text-[#e8edf0] flex items-center justify-between border-b border-white/10 pb-2">
              <span>[DEPLOYMENT PROTOCOL]</span>
              <button 
                type="button" 
                onClick={() => setActiveTab('intel')} 
                className="text-[#8b98a1] hover:text-white transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Top Split Section: Left Stacked Telemetry Labels + Right Micro-Grid Canvas */}
            <div className="flex items-start justify-between gap-2">
              {/* Left Column: Telemetry category tags */}
              <div className="flex flex-col gap-1 text-[10px] font-bold">
                <span className="tracking-wider" style={{ color: currentVisorConfig.tint }}>TELEMETRY</span>
                <span className="text-[#f5a623] tracking-wider">ACTIVE CLASS</span>
                <span className="tracking-wider" style={{ color: currentVisorConfig.tint }}>NVX</span>
                <span className="tracking-wider" style={{ color: currentVisorConfig.tint }}>METRICS</span>
                <span className="text-[#f5a623] tracking-wider">MICRO-GRID</span>
              </div>

              {/* Right Column: Micro-Grid Real-Time Canvas with dynamic Visor Tint */}
              <MicroGridCanvas tint={currentVisorConfig.tint} />
            </div>

            {/* Middle Status Bar */}
            <div className="flex flex-col gap-1 border-t border-white/10 pt-2 text-[10px]">
              <div className="flex items-center justify-between font-bold">
                <span className="text-[#8b98a1]">STATUS</span>
                <div className="flex-1 mx-3 h-1.5 bg-black/70 rounded-full overflow-hidden border border-white/10">
                  <div className="h-full w-[78%]" style={{ backgroundColor: currentVisorConfig.tint, boxShadow: `0 0 6px ${currentVisorConfig.tint}` }} />
                </div>
                <span className="text-white">670</span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-[#8b98a1]">
                <span>1.00W</span>
                <span className="font-mono">292 - 3.0 SUS050</span>
              </div>
            </div>

            {/* Telemetry Technical Data Rows */}
            <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2 text-[10px]">
              <div className="flex justify-between items-center">
                <span className="text-[#8b98a1]">ACTIVE CLASS</span>
                <span className="text-white font-bold uppercase">{CLASSES[selectedClassId]?.name || 'OPERATOR'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8b98a1]">CLASS.</span>
                <span className="text-[#cbd5e1] font-mono">26/15</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8b98a1]">SCALE T:</span>
                <span className="text-[#cbd5e1] font-mono">12/30</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8b98a1]">MISSION</span>
                <span className="text-[#cbd5e1] font-mono">1527 nrm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8b98a1]">MISSION 1</span>
                <span className="text-[#cbd5e1] font-mono">43</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8b98a1]">MISSION 2</span>
                <span className="text-[#cbd5e1] font-mono">0.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8b98a1]">MISSION 3</span>
                <span className="text-[#cbd5e1] font-mono">GEA</span>
              </div>
            </div>

            {/* DYNAMIC ACCENT DEPLOY OPERATION BUTTON */}
            <button
              id="btn-deploy"
              type="button"
              onClick={onDeploy}
              className="w-full py-3.5 text-black font-extrabold text-sm tracking-widest rounded-sm cursor-pointer transition-all duration-150 border-none flex items-center justify-center mt-1 hover:brightness-110"
              style={{
                backgroundColor: currentVisorConfig.tint,
                boxShadow: `0 0 24px ${currentVisorConfig.tint}88`
              }}
            >
              DEPLOY OPERATION
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 1.2: [ FACTIONS & CLASSES ] Tactical Doctrine & Combat Archetypes     */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'factions' && (
        <div className="flex-1 w-full p-4 sm:p-6 flex flex-col pointer-events-auto overflow-hidden">
          <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col gap-4 overflow-y-auto custom-scroll pr-1 pb-4">
            
            {/* Top Bar Header */}
            <div className="w-full bg-[#0c1015]/90 border border-white/15 backdrop-blur-md p-4 rounded-sm flex items-center justify-between shadow-xl">
              <div>
                <div className="text-xs font-bold text-[#8b98a1] tracking-widest uppercase">
                  OPERATIONAL DOCTRINE // FLEET MATRIX
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-widest flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-4" style={{ backgroundColor: currentVisorConfig.tint }} />
                  <span>COMBAT CLASSES & FACTION ALLEGIANCE</span>
                </h2>
              </div>
              <button
                onClick={onDeploy}
                className="px-4 py-2 font-black text-xs text-black tracking-wider rounded-sm cursor-pointer shadow-md hover:brightness-110 transition-all"
                style={{ backgroundColor: currentVisorConfig.tint }}
              >
                DEPLOY WITH SQUAD
              </button>
            </div>

            {/* Horizontal Class Selection: 5 Combat Classes in a panoramic horizontal card grid */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-[#8b98a1] tracking-widest px-1">
                <span>/// COMBAT CLASS ARCHETYPES [ 5 DIVISIONS ]</span>
                <span className="text-white font-mono">ACTIVE: {CLASSES[selectedClassId]?.name}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {(Object.keys(CLASSES) as ClassId[]).map((cKey) => {
                  const cls = CLASSES[cKey];
                  const isSelected = selectedClassId === cKey;
                  return (
                    <div
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`p-3.5 rounded-xl border backdrop-blur-md transition-all cursor-pointer flex flex-col justify-between gap-3 select-none ${
                        isSelected
                          ? 'bg-white/10 shadow-lg'
                          : 'bg-[#0c1015]/80 border-white/10 hover:border-white/25 hover:bg-white/5'
                      }`}
                      style={isSelected ? {
                        borderColor: cls.color,
                        boxShadow: `0 0 16px ${cls.color}33`
                      } : undefined}
                    >
                      <div className="flex flex-col gap-2">
                        {/* Class Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cls.color, boxShadow: `0 0 8px ${cls.color}` }}
                            />
                            <span className="text-xs font-black tracking-wide text-white uppercase">
                              {cls.name}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-xs" style={{ backgroundColor: `${cls.color}25`, color: cls.color }}>
                              EQUIPPED
                            </span>
                          )}
                        </div>
                        <span className="text-[9.5px] text-[#8b98a1] line-clamp-1">
                          {cls.tagline}
                        </span>

                        {/* Passive Perk Box */}
                        <div className="bg-black/50 border border-white/10 p-2 rounded-lg flex flex-col gap-0.5">
                          <span className="text-[8.5px] font-bold text-amber-400 uppercase tracking-wider">
                            PERK: {cls.perkName}
                          </span>
                          <span className="text-[8px] text-[#9ca3af] leading-relaxed line-clamp-2">
                            {cls.perkDesc}
                          </span>
                        </div>
                      </div>

                      {/* Stat Badges & Action */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                        <div className="grid grid-cols-2 gap-1.5 text-[8.5px] font-mono">
                          <div className="flex justify-between bg-black/40 px-1.5 py-0.5 rounded">
                            <span className="text-[#8b98a1]">HP</span>
                            <span className="text-white font-bold">{cls.maxHealth}</span>
                          </div>
                          <div className="flex justify-between bg-black/40 px-1.5 py-0.5 rounded">
                            <span className="text-[#8b98a1]">AP</span>
                            <span className="text-white font-bold">{cls.maxShield}</span>
                          </div>
                          <div className="flex justify-between bg-black/40 px-1.5 py-0.5 rounded">
                            <span className="text-[#8b98a1]">SPD</span>
                            <span className="text-white font-bold">{Math.round(cls.speedMultiplier * 100)}%</span>
                          </div>
                          <div className="flex justify-between bg-black/40 px-1.5 py-0.5 rounded">
                            <span className="text-[#8b98a1]">RLD</span>
                            <span className="text-white font-bold">
                              {cls.reloadMultiplier < 1 ? `+${Math.round((1 - cls.reloadMultiplier) * 100)}%` : 'STD'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`w-full py-1.5 text-[9px] font-mono font-bold tracking-wider rounded-md transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white text-black shadow-sm'
                              : 'bg-white/5 text-[#8b98a1] hover:text-white hover:bg-white/15'
                          }`}
                        >
                          {isSelected ? 'ACTIVE CLASS' : 'SELECT CLASS'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Faction Allegiance Selection Matrix */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#8b98a1] tracking-widest px-1">
                <span>/// FACTION ALLEGIANCE MATRIX</span>
                <span className="font-mono" style={{ color: currentFaction === 'usmc' ? '#2de2e6' : '#ff2a2a' }}>
                  {currentFaction === 'usmc' ? 'USMC COALITION' : 'APEX PMC'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: USMC Coalition */}
                <div
                  onClick={() => handleFactionSelect('usmc')}
                  className={`p-4 rounded-xl border backdrop-blur-md transition-all cursor-pointer flex flex-col gap-3 ${
                    currentFaction === 'usmc'
                      ? 'border-[#2de2e6] bg-[#2de2e6]/10 shadow-[0_0_20px_rgba(45,226,230,0.25)]'
                      : 'border-white/10 bg-[#0c1015]/80 hover:border-white/25 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#2de2e6] shadow-[0_0_8px_#2de2e6]" />
                      <span className="text-sm font-black text-white tracking-wider">USMC COALITION</span>
                    </div>
                    {currentFaction === 'usmc' && (
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-xs bg-[#2de2e6]/20 text-[#2de2e6]">
                        ALLEGED
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#8b98a1] leading-relaxed">
                    Global peacekeeping expeditionary force operating under standard NATO rules of engagement. Equipped with desert tan / woodland digital camo and high-contrast tactical optic displays.
                  </p>
                  <div className="bg-black/50 border border-white/10 p-2.5 rounded-lg">
                    <div className="text-[10px] font-bold text-[#2de2e6] uppercase tracking-wider mb-0.5">
                      FACTION TRAIT: FORTIFIED DEFENSE
                    </div>
                    <div className="text-[9px] text-[#cbd5e1]">
                      Specialized tier unlocks +15% body armor durability and reduced headshot multiplier.
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-[#8b98a1] flex justify-between">
                    <span>THEATER: URBAN CONFLICT</span>
                    <span className="text-white">STATUS: READY</span>
                  </div>
                </div>

                {/* Card 2: Apex PMC */}
                <div
                  onClick={() => handleFactionSelect('apex')}
                  className={`p-4 rounded-xl border backdrop-blur-md transition-all cursor-pointer flex flex-col gap-3 ${
                    currentFaction === 'apex'
                      ? 'border-[#ff2a2a] bg-[#ff2a2a]/10 shadow-[0_0_20px_rgba(255,42,42,0.25)]'
                      : 'border-white/10 bg-[#0c1015]/80 hover:border-white/25 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#ff2a2a] shadow-[0_0_8px_#ff2a2a]" />
                      <span className="text-sm font-black text-white tracking-wider">APEX PMC CONTRACTORS</span>
                    </div>
                    {currentFaction === 'apex' && (
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-xs bg-[#ff2a2a]/20 text-[#ff2a2a]">
                        ALLEGED
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#8b98a1] leading-relaxed">
                    Elite private military corporation specializing in high-threat extraction, wetwork, and black ops. Outfitted in charcoal black ballistic armor and terrifying skull visage faceplates.
                  </p>
                  <div className="bg-black/50 border border-white/10 p-2.5 rounded-lg">
                    <div className="text-[10px] font-bold text-[#ff2a2a] uppercase tracking-wider mb-0.5">
                      FACTION TRAIT: STALKER VELOCITY
                    </div>
                    <div className="text-[9px] text-[#cbd5e1]">
                      Specialized tier grants +10% sprint velocity and silent weapon draw times.
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-[#8b98a1] flex justify-between">
                    <span>THEATER: ASYMMETRICAL</span>
                    <span className="text-white">STATUS: CONTRACTED</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 1.5: [ LOCKER ] Tactical Gear & Live 3D Mesh Customization            */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'locker' && (
        <div className="relative z-10 flex justify-between p-6 pointer-events-none flex-1 w-full items-end">
          
          {/* LEFT PANEL: REAL-TIME SUB-MESH CONFIGURATIONS */}
          <div className="w-96 max-w-[44vw] bg-[#0c1015]/90 border border-white/15 backdrop-blur-md p-4 rounded-sm shadow-2xl flex flex-col gap-3 pointer-events-auto max-h-[calc(100vh-6.5rem)] overflow-y-auto custom-scroll pb-2">
            <div className="border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-3.5" style={{ backgroundColor: currentVisorConfig.tint }} />
                <h2 className="text-xs font-bold tracking-widest text-white">
                  [TACTICAL LOCKER] // SUB-MESH CUSTOMIZATION
                </h2>
              </div>
              <p className="text-[9px] text-[#8b98a1] mt-0.5 font-medium tracking-wide">
                CONFIGURE 3D OPERATOR HARDWARE • REAL-TIME MESH REFRESH
              </p>
            </div>

            {/* Headgear Configuration */}
            <div className="bg-black/40 border border-white/10 p-3 rounded-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-[#8b98a1] tracking-widest uppercase">
                  HEADGEAR CONFIGURATION
                </div>
                {lockerPurchaseFeedback && (
                  <span className="text-[9px] font-bold text-[#f5a623] animate-pulse">
                    {lockerPurchaseFeedback}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'base', label: 'BARE HEAD', desc: 'Zero helmet weight', reqRank: 1 },
                  { id: 'fast', label: 'FAST HELMET', desc: 'Ballistic high-cut', reqRank: 5 },
                  { id: 'boonie', label: 'BOONIE HAT', desc: 'Canvas field camo', reqRank: 2, price: 500 },
                  { id: 'skull', label: 'SKULL MASK', desc: 'Ballistic skull shield', reqRank: 10, price: 2500 }
                ].map((opt) => {
                  const isCurrent = factionCtx.headgear === opt.id;
                  const unlocked = isItemUnlocked(opt.id, careerLedger);
                  const canUnlockWithRank = careerLedger.rank >= opt.reqRank;
                  const canAfford = !opt.price || careerLedger.combatFunds >= opt.price;

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleUnlockAndEquip(opt.id, 'headgear', () => handleHeadgearSelect(opt.id as HeadgearOption))}
                      className={`text-left p-2 rounded-xs border transition-all cursor-pointer flex flex-col gap-0.5 relative ${
                        isCurrent
                          ? 'bg-white/10 border-white text-white shadow-sm'
                          : unlocked
                          ? 'bg-white/5 border-transparent text-[#8b98a1] hover:bg-white/10 hover:text-white'
                          : 'bg-black/60 border-red-500/20 text-[#64748b] hover:border-red-500/40'
                      }`}
                      style={isCurrent ? { borderColor: currentVisorConfig.tint } : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold flex items-center gap-1 truncate">
                          <span>{opt.label}</span>
                        </div>
                        {!unlocked && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-red-950/60 border border-red-500/40 text-red-400 font-bold">
                            LOCKED
                          </span>
                        )}
                      </div>
                      <div className="text-[8px] text-[#8b98a1] truncate">{opt.desc}</div>
                      {!unlocked && (
                        <div className="text-[7.5px] font-mono mt-0.5 flex items-center justify-between text-[#f5a623]">
                          <span>REQ: RANK {opt.reqRank}</span>
                          {opt.price ? <span>${opt.price}</span> : <span className="text-[#00ff66]">FREE</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Torso Configuration */}
            <div className="bg-black/40 border border-white/10 p-3 rounded-xs flex flex-col gap-2">
              <div className="text-[10px] font-bold text-[#8b98a1] tracking-widest uppercase">
                TORSO CONFIGURATION
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'chest_rig', label: 'LOW-PROFILE RIG', desc: 'Canvas micro-chest', reqRank: 1 },
                  { id: 'molle_vest', label: 'HEAVY MOLLE VEST', desc: 'Ceramic plate carrier', reqRank: 4, price: 1500 }
                ].map((opt) => {
                  const isCurrent = factionCtx.torsoConfig === opt.id;
                  const unlocked = isItemUnlocked(opt.id, careerLedger);

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleUnlockAndEquip(opt.id, 'torso', () => handleTorsoSelect(opt.id as TorsoOption))}
                      className={`text-left p-2 rounded-xs border transition-all cursor-pointer flex flex-col gap-0.5 ${
                        isCurrent
                          ? 'bg-white/10 border-white text-white shadow-sm'
                          : unlocked
                          ? 'bg-white/5 border-transparent text-[#8b98a1] hover:bg-white/10 hover:text-white'
                          : 'bg-black/60 border-red-500/20 text-[#64748b] hover:border-red-500/40'
                      }`}
                      style={isCurrent ? { borderColor: currentVisorConfig.tint } : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold">{opt.label}</div>
                        {!unlocked && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-red-950/60 border border-red-500/40 text-red-400 font-bold">
                            LOCKED
                          </span>
                        )}
                      </div>
                      <div className="text-[8px] text-[#8b98a1] truncate">{opt.desc}</div>
                      {!unlocked && (
                        <div className="text-[7.5px] font-mono mt-0.5 flex items-center justify-between text-[#f5a623]">
                          <span>REQ: RANK {opt.reqRank}</span>
                          {opt.price ? <span>${opt.price}</span> : <span className="text-[#00ff66]">FREE</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lower Configuration */}
            <div className="bg-black/40 border border-white/10 p-3 rounded-xs flex flex-col gap-2">
              <div className="text-[10px] font-bold text-[#8b98a1] tracking-widest uppercase">
                LOWER CONFIGURATION
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'pouches', label: 'UTILITY POUCHES', desc: 'Dual ammo pouches', reqRank: 1 },
                  { id: 'holster', label: 'THIGH HOLSTER', desc: 'Tactical sidearm drop', reqRank: 3, price: 800 }
                ].map((opt) => {
                  const isCurrent = factionCtx.lowerConfig === opt.id;
                  const unlocked = isItemUnlocked(opt.id, careerLedger);

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleUnlockAndEquip(opt.id, 'lower', () => handleLowerSelect(opt.id as LowerOption))}
                      className={`text-left p-2 rounded-xs border transition-all cursor-pointer flex flex-col gap-0.5 ${
                        isCurrent
                          ? 'bg-white/10 border-white text-white shadow-sm'
                          : unlocked
                          ? 'bg-white/5 border-transparent text-[#8b98a1] hover:bg-white/10 hover:text-white'
                          : 'bg-black/60 border-red-500/20 text-[#64748b] hover:border-red-500/40'
                      }`}
                      style={isCurrent ? { borderColor: currentVisorConfig.tint } : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold">{opt.label}</div>
                        {!unlocked && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-red-950/60 border border-red-500/40 text-red-400 font-bold">
                            LOCKED
                          </span>
                        )}
                      </div>
                      <div className="text-[8px] text-[#8b98a1] truncate">{opt.desc}</div>
                      {!unlocked && (
                        <div className="text-[7.5px] font-mono mt-0.5 flex items-center justify-between text-[#f5a623]">
                          <span>REQ: RANK {opt.reqRank}</span>
                          {opt.price ? <span>${opt.price}</span> : <span className="text-[#00ff66]">FREE</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operator Visual Camo Spec */}
            <div className="bg-black/40 border border-white/10 p-3 rounded-xs flex items-center justify-between text-[10px]">
              <div>
                <span className="text-[#8b98a1]">ACTIVE TEXTURE: </span>
                <span className="text-white font-bold uppercase">{currentFaction} CAMO</span>
              </div>
              <button
                onClick={() => handleFactionSelect(currentFaction === 'usmc' ? 'apex' : 'usmc')}
                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded-xs border border-white/20 text-[9px] cursor-pointer"
              >
                SWAP FACTION
              </button>
            </div>
          </div>

          {/* CENTER GAP IS OPEN FOR 3D AVATAR ROTATION IN BUNKER HANGAR */}

          {/* RIGHT PANEL: EQUIPPED GEAR TELEMETRY & CONFIRM */}
          <div className="w-80 max-w-[38vw] bg-[#0c1015]/90 border border-white/15 backdrop-blur-md p-4 rounded-sm shadow-2xl flex flex-col gap-3 pointer-events-auto max-h-[calc(100vh-6.5rem)] overflow-y-auto custom-scroll pb-2">
            <div className="text-xs font-bold tracking-wider text-[#e8edf0] flex items-center justify-between border-b border-white/10 pb-2">
              <span>[EQUIPPED GEAR TELEMETRY]</span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentVisorConfig.tint }} />
            </div>

            <div className="flex flex-col gap-2 text-[10px]">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[#8b98a1]">HEADGEAR:</span>
                <span className="text-white font-bold uppercase">{factionCtx.headgear}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[#8b98a1]">TORSO ARMOR:</span>
                <span className="text-white font-bold uppercase">{(factionCtx.torsoConfig || '').replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[#8b98a1]">LOWER RIG:</span>
                <span className="text-white font-bold uppercase">{factionCtx.lowerConfig}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[#8b98a1]">GEAR TIER:</span>
                <span className="text-white font-bold uppercase">{currentGearTier}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[#8b98a1]">VISOR OPTIC:</span>
                <span className="font-bold uppercase" style={{ color: currentVisorConfig.tint }}>{visorType}</span>
              </div>
            </div>

            {/* Live Synchronized Badge */}
            <div className="p-2 bg-black/60 border border-white/10 rounded-xs flex items-center gap-2 text-[9px]">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentVisorConfig.tint }} />
              <span className="text-white font-bold tracking-wider">3D VIEWPORT LIVE SYNCHRONIZED</span>
            </div>

            <button
              onClick={() => setActiveTab('play')}
              className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs tracking-wider rounded-xs border border-white/20 transition-all cursor-pointer"
            >
              RETURN TO LOBBY
            </button>

            <button
              onClick={onDeploy}
              className="w-full py-3 text-black font-extrabold text-xs tracking-widest rounded-sm cursor-pointer shadow-lg hover:brightness-110 transition-all"
              style={{
                backgroundColor: currentVisorConfig.tint,
                boxShadow: `0 0 20px ${currentVisorConfig.tint}66`
              }}
            >
              DEPLOY OPERATION
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 2: [ LOADOUT ] Modern Tactical DMZ / MWIII Weapon Vault Grid          */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'loadout' && (
        <LoadoutDMZ
          selectedPrimary={selectedPrimary}
          setSelectedPrimary={setSelectedPrimary}
          selectedSecondary={selectedSecondary}
          setSelectedSecondary={setSelectedSecondary}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          visorType={visorType}
          setVisorType={setVisorType}
          onDeploy={onDeploy}
        />
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 3: [ GAME MODE ] Visual Scenario Deck                                */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'gamemode' && (
        <div className="flex-1 w-full p-6 flex items-center justify-center pointer-events-auto">
          <div className="w-[900px] max-w-[95vw] bg-[#0c1015]/95 border border-white/15 backdrop-blur-md p-5 rounded-sm shadow-2xl flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-180px)] custom-scrollbar">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <div className="text-sm font-extrabold tracking-widest text-[#2de2e6]">
                  VISUAL SCENARIO DECK // SIMULATION MODES
                </div>
                <div className="text-[10px] text-[#8b98a1]">
                  Select an operational combat theater to engage enemy forces.
                </div>
              </div>
              <button
                onClick={onDeploy}
                className="px-4 py-1.5 bg-[#2de2e6] text-black font-bold text-xs tracking-wider rounded-xs hover:bg-[#00ff66] transition-colors cursor-pointer"
              >
                DEPLOY SELECTED SCENARIO
              </button>
            </div>

                        {/* 2 Distinct Styled Scenario Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {/* CARD 1: TEAM DEATHMATCH */}
              <div
                onClick={() => setMatchMode('team')}
                className={`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between h-72 ${
                  matchMode === 'team'
                    ? 'border-[#57d1c9] bg-[#57d1c9]/10 shadow-[0_0_16px_rgba(87,209,201,0.35)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30'
                }`}
              >
                <div>
                  <div className="w-full h-28 bg-[#1a2522] rounded-xs border border-white/10 flex items-center justify-center relative overflow-hidden mb-3">
                    <div className="text-4xl">⚔️</div>
                  </div>
                  <div className="text-xs font-extrabold text-white tracking-wider">TEAM DEATHMATCH</div>
                  <div className="text-[9px] text-[#57d1c9] font-bold mt-0.5">SQUAD VS SQUAD</div>
                  <div className="text-[9px] text-[#8b98a1] mt-1.5 leading-relaxed">
                    Classic tactical team-based combat. First team to reach the target score wins.
                  </div>
                </div>
              </div>
              
              {/* CARD 2: FREE FOR ALL */}
              <div
                onClick={() => setMatchMode('ffa')}
                className={`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between h-72 ${
                  matchMode === 'ffa'
                    ? 'border-[#f5a623] bg-[#f5a623]/10 shadow-[0_0_16px_rgba(245,166,35,0.35)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30'
                }`}
              >
                <div>
                  <div className="w-full h-28 bg-[#25201a] rounded-xs border border-white/10 flex items-center justify-center relative overflow-hidden mb-3">
                    <div className="text-4xl">🔥</div>
                  </div>
                  <div className="text-xs font-extrabold text-white tracking-wider">FREE FOR ALL</div>
                  <div className="text-[9px] text-[#f5a623] font-bold mt-0.5">LONE WOLF</div>
                  <div className="text-[9px] text-[#8b98a1] mt-1.5 leading-relaxed">
                    Every operator for themselves. Eliminate targets and dominate the battlefield.
                  </div>
                </div>
              </div>

              {/* CARD 1: EXTRACTION */}
              <div
                onClick={() => setMatchMode('extraction')}
                className={`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between h-72 ${
                  matchMode === 'extraction'
                    ? 'border-[#2de2e6] bg-[#2de2e6]/10 shadow-[0_0_16px_rgba(45,226,230,0.35)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30'
                }`}
              >
                <div>
                  <div className="w-full h-28 bg-[#15191e] rounded-xs border border-white/10 flex items-center justify-center relative overflow-hidden mb-3">
                    <svg viewBox="0 0 100 100" className="w-20 h-20 text-[#2de2e6]/80 stroke-current fill-none">
                      <circle cx="50" cy="50" r="38" strokeWidth="1.5" strokeDasharray="4 2" />
                      <line x1="50" y1="5" x2="50" y2="95" strokeWidth="1.2" />
                      <line x1="5" y1="50" x2="95" y2="50" strokeWidth="1.2" />
                      <path d="M32 60 C32 35, 68 35, 68 60 L74 65 L66 65 L64 74 L36 74 L34 65 L26 65 Z" fill="currentColor" fillOpacity="0.3" strokeWidth="1.5" />
                    </svg>
                    <div className="absolute top-2 left-2 text-[8px] text-[#2de2e6] font-bold">THEATER 01</div>
                  </div>
                  <div className="text-xs font-extrabold text-white tracking-wider">BIO-HAZARD EXTRACTION</div>
                  <div className="text-[9px] text-[#2de2e6] font-bold mt-0.5">LINEAR MISSION FLOW</div>
                  <div className="text-[9px] text-[#8b98a1] mt-1.5 leading-relaxed">
                    Progress through 5 containment sectors. Hack the mainframe, survive the Mega-Boss, and extract.
                  </div>
                </div>
              </div>

              {/* CARD 2: WAVE SURVIVAL */}
              <div
                onClick={() => {
                  setMatchMode('zombie');
                  setSelectedMapState('hangar');
                }}
                className={`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between h-72 ${
                  matchMode === 'zombie'
                    ? 'border-[#ff2a2a] bg-[#ff2a2a]/10 shadow-[0_0_16px_rgba(255,42,42,0.35)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30'
                }`}
              >
                <div>
                  <div className="w-full h-28 bg-[#1f1012] rounded-xs border border-red-900/40 flex items-center justify-center relative overflow-hidden mb-3">
                    <svg viewBox="0 0 100 100" className="w-20 h-20 text-[#ff2a2a]/80 stroke-current fill-none">
                      <path d="M30 45 C30 20, 70 20, 70 45 C70 55, 62 60, 60 70 L60 82 L40 82 L40 70 C38 60, 30 55, 30 45 Z" fill="#ff2a2a" fillOpacity="0.25" strokeWidth="1.8" />
                      <circle cx="42" cy="42" r="6" fill="#ff2a2a" />
                      <circle cx="58" cy="42" r="6" fill="#ff2a2a" />
                      <path d="M44 65 L56 65 L50 74 Z" fill="#ff2a2a" />
                    </svg>
                    <div className="absolute top-2 left-2 text-[8px] text-[#ff4444] font-bold">THEATER 02 // ENDLESS</div>
                  </div>
                  <div className="text-xs font-extrabold text-white tracking-wider">HORDE SURVIVAL</div>
                  <div className="text-[9px] text-[#ff4444] font-bold mt-0.5">ZOMBIE INFECTION WAVES</div>
                  <div className="text-[9px] text-[#8b98a1] mt-1.5 leading-relaxed">
                    High-intensity wave defense against Walkers, Runners, Brutes, and Banshees.
                  </div>
                </div>
              </div>
            </div>
            {/* Scenario Configuration: Map & Rules */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Map Selection Toggle Grid */}
              <div className="flex-1 bg-black/40 border border-white/10 p-4 rounded-xs">
                <div className="text-[10px] text-[#2de2e6] font-bold tracking-widest mb-3">
                  OPERATIONAL THEATER // MAP SELECT
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={matchMode === 'zombie' || matchMode === 'extraction'}
                    onClick={() => {
                      if (matchMode !== 'zombie' && matchMode !== 'extraction') {
                        setSelectedMapState('training');
                      }
                    }}
                    className={`h-20 flex flex-col justify-end p-2 border transition-all rounded-xs relative overflow-hidden text-left ${
                      (matchMode === 'zombie' || matchMode === 'extraction')
                        ? 'border-white/5 opacity-35 cursor-not-allowed bg-black/40 grayscale'
                        : selectedMapState === 'training'
                        ? 'border-[#2de2e6] shadow-[0_0_12px_rgba(45,226,230,0.3)] bg-gradient-to-t from-[#2de2e6]/20 to-transparent cursor-pointer'
                        : 'border-white/10 opacity-70 hover:opacity-100 bg-black/60 cursor-pointer'
                    }`}
                  >
                    <div className="absolute top-2 right-2 text-xs opacity-50">🌲</div>
                    <div className="text-[9px] font-bold text-[#8b98a1]">
                      {(matchMode === 'zombie' || matchMode === 'extraction') ? 'RESTRICTED // HORDE/EXT LOCK' : 'OUTDOOR ARENA'}
                    </div>
                    <div className="text-xs font-black text-white">TRAINING FIELD</div>
                    {(matchMode === 'zombie' || matchMode === 'extraction') && (
                      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-[9px] font-extrabold tracking-wider text-[#ff4444] border border-[#ff4444]/30 pointer-events-none">
                        <span>LOCKED FOR HORDE/EXTRACTION</span>
                        <span className="text-[7px] text-[#8b98a1] font-normal">TDM / FFA ONLY</span>
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMapState('hangar')}
                    className={`h-20 flex flex-col justify-end p-2 border cursor-pointer transition-all rounded-xs relative overflow-hidden text-left ${
                      selectedMapState === 'hangar'
                        ? 'border-[#ff4444] shadow-[0_0_12px_rgba(255,68,68,0.3)] bg-gradient-to-t from-[#ff4444]/20 to-transparent'
                        : 'border-white/10 opacity-70 hover:opacity-100 bg-black/60'
                    }`}
                  >
                    <div className="absolute top-2 right-2 text-xs opacity-50">🏢</div>
                    <div className="text-[9px] font-bold text-[#8b98a1]">SUBTERRANEAN</div>
                    <div className="text-xs font-black text-white">BUNKER HANGAR</div>
                    {(matchMode === 'zombie' || matchMode === 'extraction') && (
                      <div className="absolute top-2 left-2 text-[8px] font-black text-[#ff4444] bg-[#ff4444]/25 px-1.5 py-0.5 rounded-xs border border-[#ff4444]/40">
                        MANDATORY HORDE/EXT MAP
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Match Rule Sliders & Deployment Protocol */}
              <div className="flex-1 bg-black/40 border border-white/10 p-4 rounded-xs flex flex-col justify-between">
                <div className="text-[10px] text-[#2de2e6] font-bold tracking-widest mb-3 flex items-center justify-between">
                  <span>DEPLOYMENT PROTOCOL & RULES</span>
                  <span className="text-[9px] text-[#8b98a1]">ALLIED DOCTRINE</span>
                </div>

                {/* 2-Way Protocol Mode Selector Toggle */}
                <div className="mb-4">
                  <div className="text-[9px] font-bold text-[#8b98a1] mb-1.5 flex items-center justify-between">
                    <span>ALLIED COMMAND STRUCTURE</span>
                    <span className={deploymentProtocol === 'elite' ? 'text-[#2de2e6] font-bold' : 'text-[#f5a623] font-bold'}>
                      {deploymentProtocol === 'elite' ? 'ELITE TASK FORCE (5 SLOTS)' : `BATTALION (${friendlyCount} BOTS)`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (setDeploymentProtocol) setDeploymentProtocol('elite');
                        setFriendlyCount(4);
                      }}
                      className={`p-2.5 rounded-xs border text-left transition-all cursor-pointer relative overflow-hidden ${
                        deploymentProtocol === 'elite'
                          ? 'border-[#2de2e6] bg-gradient-to-r from-[#2de2e6]/20 to-transparent shadow-[0_0_12px_rgba(45,226,230,0.25)] text-white'
                          : 'border-white/10 bg-black/50 text-[#8b98a1] hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black tracking-wide text-white flex items-center gap-1.5">
                          <span>🎖️</span>
                          <span>ELITE SQUAD PROTOCOL</span>
                        </span>
                        {deploymentProtocol === 'elite' && (
                          <span className="text-[8px] bg-[#2de2e6]/20 border border-[#2de2e6]/40 text-[#2de2e6] px-1.5 py-0.5 rounded font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[8px] text-[#8b98a1] mt-1 leading-tight">
                        5 Specialized slots: Leader + 4 Elite bots with 2.5x stats, melee & unique perks.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (setDeploymentProtocol) setDeploymentProtocol('standard');
                      }}
                      className={`p-2.5 rounded-xs border text-left transition-all cursor-pointer relative overflow-hidden ${
                        deploymentProtocol === 'standard'
                          ? 'border-[#f5a623] bg-gradient-to-r from-[#f5a623]/20 to-transparent shadow-[0_0_12px_rgba(245,166,35,0.25)] text-white'
                          : 'border-white/10 bg-black/50 text-[#8b98a1] hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black tracking-wide text-white flex items-center gap-1.5">
                          <span>👥</span>
                          <span>STANDARD BATTALION</span>
                        </span>
                        {deploymentProtocol === 'standard' && (
                          <span className="text-[8px] bg-[#f5a623]/20 border border-[#f5a623]/40 text-[#f5a623] px-1.5 py-0.5 rounded font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[8px] text-[#8b98a1] mt-1 leading-tight">
                        Mass deployment threshold. Up to 20 low-tier grunts with standard combat routines.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Conditional Allied Squad UI: Standard Slider vs Elite Grid */}
                {deploymentProtocol === 'standard' ? (
                  <div className="mb-3 bg-black/60 border border-white/10 p-2.5 rounded-xs">
                    <div className="flex justify-between text-[9px] font-bold text-[#8b98a1] mb-1">
                      <span>MASS BATTALION ALLIED COMBATANTS</span>
                      <span className="text-white font-mono">{friendlyCount} RECRUITS</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={friendlyCount}
                      onChange={(e) => setFriendlyCount(parseInt(e.target.value))}
                      className="w-full accent-[#f5a623]"
                    />
                    <div className="text-[8px] text-[#8b98a1] mt-1 flex justify-between">
                      <span>SOLO (0 BOTS)</span>
                      <span>SQUAD (10)</span>
                      <span>FULL PLATOON (20)</span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between text-[9px] font-bold text-[#2de2e6]">
                      <span>OPERATIONAL SQUAD ROSTER (SLOTS 2 - 5)</span>
                      <span className="text-[8px] text-[#8b98a1]">CUSTOMIZE COMPANION LOADOUTS</span>
                    </div>

                    {/* 4 Distinct Allied Deployment Slots Horizontal Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {(eliteSquad || DEFAULT_ELITE_SQUAD).map((companion) => {
                        const updateCompanionWeapon = (slotKey: 'primaryWeapon' | 'secondaryWeapon', weaponId: string) => {
                          if (!setEliteSquad) return;
                          const updated = (eliteSquad || DEFAULT_ELITE_SQUAD).map(m => {
                            if (m.slotId === companion.slotId) {
                              return { ...m, [slotKey]: weaponId };
                            }
                            return m;
                          });
                          setEliteSquad(updated);
                        };

                        return (
                          <div
                            key={companion.slotId}
                            className="bg-black/70 border border-white/15 p-2.5 rounded-xs flex flex-col justify-between relative group hover:border-[#2de2e6]/50 transition-all"
                          >
                            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{companion.icon}</span>
                                <div>
                                  <div className="text-[8px] text-[#8b98a1] font-bold uppercase tracking-wider">
                                    SLOT 0{companion.slotId} // {companion.archetype.toUpperCase()}
                                  </div>
                                  <div className="text-[10px] font-black text-white">
                                    {companion.callsign}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[7px] font-mono text-[#2de2e6] border border-[#2de2e6]/30 px-1 py-0.5 rounded bg-[#2de2e6]/10">
                                2.5x STATS
                              </span>
                            </div>

                            <div className="text-[8px] text-[#8b98a1] leading-tight mb-2">
                              {companion.perkDescription}
                            </div>

                            {/* Loadout Customization Sub-nodes */}
                            <div className="space-y-1.5 pt-1 border-t border-white/10">
                              <div>
                                <label className="text-[7px] text-[#8b98a1] font-bold block mb-0.5">
                                  PRIMARY FIREARM
                                </label>
                                <select
                                  value={companion.primaryWeapon}
                                  onChange={(e) => updateCompanionWeapon('primaryWeapon', e.target.value)}
                                  className="w-full bg-[#12171d] border border-white/20 text-white text-[9px] px-1.5 py-1 rounded-xs focus:outline-none focus:border-[#2de2e6]"
                                >
                                  {ARMORY_CATEGORIES.primary.map(w => (
                                    <option key={w.id} value={w.id}>
                                      {w.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[7px] text-[#8b98a1] font-bold block mb-0.5">
                                  SECONDARY SIDEARM
                                </label>
                                <select
                                  value={companion.secondaryWeapon}
                                  onChange={(e) => updateCompanionWeapon('secondaryWeapon', e.target.value)}
                                  className="w-full bg-[#12171d] border border-white/20 text-white text-[9px] px-1.5 py-1 rounded-xs focus:outline-none focus:border-[#2de2e6]"
                                >
                                  {ARMORY_CATEGORIES.secondary.map(w => (
                                    <option key={w.id} value={w.id}>
                                      {w.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div>
                    <div className="flex justify-between text-[9px] font-bold text-[#8b98a1] mb-1">
                      <span>HOSTILE AI COUNT</span>
                      <span className="text-[#ff4444] font-mono">{enemyCount} BOTS</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={enemyCount}
                      onChange={(e) => setEnemyCount(parseInt(e.target.value))}
                      className="w-full accent-[#ff4444]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] font-bold text-[#8b98a1] mb-1">
                      <span>ELIMINATION TARGET (SCORE)</span>
                      <span className="text-[#f5a623] font-mono">{targetScore} KILLS</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={targetScore}
                      onChange={(e) => setTargetScore(parseInt(e.target.value))}
                      className="w-full accent-[#f5a623]"
                    />
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 4: [ INTEL ] Faction Career Progression Ledger & Metrics              */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'intel' && (
        <div className="flex-1 w-full p-4 sm:p-6 flex items-center justify-center pointer-events-auto overflow-y-auto custom-scroll max-h-[calc(100vh-6.5rem)]">
          <div className="w-[880px] max-w-[95vw] bg-[#0c1015]/95 border border-white/15 backdrop-blur-md p-4 sm:p-6 rounded-sm shadow-2xl flex flex-col gap-4">
            
            {/* Header: Title + Rank Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-3 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3.5" style={{ backgroundColor: currentVisorConfig.tint }} />
                  <div className="text-sm font-extrabold tracking-widest text-[#2de2e6]">
                    FACTION CAREER PROGRESSION LEDGER
                  </div>
                </div>
                <div className="text-[10px] text-[#8b98a1] mt-0.5">
                  Permanent combat record, XP rank tiers (1 to 50), tactical combat funds, and service medals.
                </div>
              </div>

              {/* Rank Badge & Tier */}
              <div className="flex items-center gap-2 bg-black/60 border border-[#2de2e6]/40 px-3 py-1.5 rounded-xs">
                <div className="text-right">
                  <div className="text-[9px] text-[#8b98a1] font-bold">OPERATIVE RANK</div>
                  <div className="text-xs font-black text-white">{getRankTitle(careerLedger.rank).title}</div>
                </div>
                <div className="w-8 h-8 rounded-xs bg-[#2de2e6]/20 border border-[#2de2e6] flex items-center justify-center text-sm font-black text-[#2de2e6] shadow-[0_0_10px_rgba(45,226,230,0.3)]">
                  {careerLedger.rank}
                </div>
              </div>
            </div>

            {/* Rank XP Progression Bar */}
            {(() => {
              const currentMinXp = getXpForRank(careerLedger.rank);
              const nextRankXp = getXpForRank(careerLedger.rank + 1);
              const isMaxRank = careerLedger.rank >= 50;
              const xpInLevel = Math.max(0, careerLedger.totalXp - currentMinXp);
              const xpNeeded = Math.max(1, nextRankXp - currentMinXp);
              const pct = isMaxRank ? 100 : Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

              return (
                <div className="bg-black/50 border border-white/10 p-3 rounded-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#8b98a1] font-bold">
                      RANK {careerLedger.rank} PROGRESSION
                    </span>
                    <span className="font-mono text-white">
                      {isMaxRank
                        ? 'MAX RANK REACHED (LEVEL 50)'
                        : `${careerLedger.totalXp.toLocaleString()} / ${nextRankXp.toLocaleString()} XP (${pct}%)`}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-[#2de2e6] to-[#00ff66] transition-all duration-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[8.5px] text-[#8b98a1]">
                    <span>TIER MIN: {currentMinXp.toLocaleString()} XP</span>
                    {!isMaxRank && (
                      <span className="text-[#2de2e6]">
                        {(nextRankXp - careerLedger.totalXp).toLocaleString()} XP TO RANK {careerLedger.rank + 1}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Matrix Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-black/50 border border-white/10 rounded-xs">
                <div className="text-[9px] text-[#8b98a1] font-bold tracking-wider">
                  TOTAL EXPERIENCE (XP)
                </div>
                <div className="text-2xl font-extrabold text-[#2de2e6] mt-1">
                  {careerLedger.totalXp.toLocaleString()}
                </div>
                <div className="text-[8px] text-[#8b98a1] mt-0.5">Global military account XP</div>
              </div>

              <div className="p-3 bg-black/50 border border-white/10 rounded-xs">
                <div className="text-[9px] text-[#8b98a1] font-bold tracking-wider">
                  COMBAT FUNDS ($)
                </div>
                <div className="text-2xl font-extrabold text-[#f5a623] mt-1">
                  ${careerLedger.combatFunds.toLocaleString()}
                </div>
                <div className="text-[8px] text-[#8b98a1] mt-0.5">Purchasable tactical currency</div>
              </div>

              <div className="p-3 bg-black/50 border border-white/10 rounded-xs">
                <div className="text-[9px] text-[#8b98a1] font-bold tracking-wider">
                  HOSTILES ELIMINATED
                </div>
                <div className="text-2xl font-extrabold text-[#ff4444] mt-1">
                  {careerLedger.totalKills.toLocaleString()}
                </div>
                <div className="text-[8px] text-[#8b98a1] mt-0.5">
                  {careerLedger.totalHeadshots} precision headshots ({careerLedger.totalKills > 0 ? Math.round((careerLedger.totalHeadshots / careerLedger.totalKills) * 100) : 0}%)
                </div>
              </div>

              <div className="p-3 bg-black/50 border border-white/10 rounded-xs">
                <div className="text-[9px] text-[#8b98a1] font-bold tracking-wider">
                  HIGHEST HORDE WAVE
                </div>
                <div className="text-2xl font-extrabold text-[#00ff66] mt-1">
                  WAVE {careerLedger.highestWave}
                </div>
                <div className="text-[8px] text-[#8b98a1] mt-0.5">Zombie survival milestone</div>
              </div>
            </div>

            {/* Service Record & Operational Ratings */}
            <div className="bg-black/40 border border-white/10 p-3 rounded-xs space-y-2">
              <div className="text-xs font-bold text-white tracking-wider flex items-center justify-between">
                <span>SERVICE RECORD & OPERATIONAL RATINGS</span>
                <span className="text-[9px] text-[#2de2e6]">
                  WIN RATIO: {careerLedger.matchesPlayed > 0 ? Math.round((careerLedger.matchesWon / careerLedger.matchesPlayed) * 100) : 0}%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-2 bg-black/50 border border-white/5 rounded">
                  <span className="text-[#8b98a1]">DEPLOYMENTS: </span>
                  <b className="text-white">{careerLedger.matchesPlayed} Operations</b>
                </div>
                <div className="p-2 bg-black/50 border border-white/5 rounded">
                  <span className="text-[#8b98a1]">VICTORIES: </span>
                  <b className="text-[#00ff66]">{careerLedger.matchesWon} Won</b>
                </div>
                <div className="p-2 bg-black/50 border border-white/5 rounded">
                  <span className="text-[#8b98a1]">FIRE ACCURACY: </span>
                  <b className="text-[#f5a623]">
                    {careerLedger.totalShots > 0 ? Math.round((careerLedger.totalHits / careerLedger.totalShots) * 100) : 0}%
                  </b>
                </div>
                <div className="p-2 bg-black/50 border border-white/5 rounded">
                  <span className="text-[#8b98a1]">UNLOCKED ITEMS: </span>
                  <b className="text-[#2de2e6]">{careerLedger.unlockedItems.length} Assets</b>
                </div>
              </div>
            </div>

            {/* Faction Career Catalog Unlock Milestones */}
            <div className="bg-black/40 border border-white/10 p-3 rounded-xs space-y-2">
              <div className="text-[11px] font-bold text-white tracking-wider flex items-center justify-between">
                <span>FACTION CAREER UNLOCK MILESTONES</span>
                <span className="text-[9px] text-[#8b98a1]">REACH RANK TIERS TO UNLOCK HARDWARE IN [LOCKER]</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { name: 'FAST HELMET', rank: 5, type: 'HEADGEAR', unlocked: careerLedger.rank >= 5, price: 'FREE AT RANK 5' },
                  { name: 'THIGH HOLSTER', rank: 3, type: 'LOWER', unlocked: isItemUnlocked('holster', careerLedger), price: '$800' },
                  { name: 'HEAVY MOLLE VEST', rank: 4, type: 'TORSO', unlocked: isItemUnlocked('molle_vest', careerLedger), price: '$1,500' },
                  { name: 'TACTICAL RAILGUN', rank: 8, type: 'WEAPON', unlocked: isItemUnlocked('railgun', careerLedger), price: '$2,000' }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded border text-[9px] flex flex-col justify-between ${
                      item.unlocked
                        ? 'bg-black/60 border-[#00ff66]/30 text-[#00ff66]'
                        : 'bg-black/40 border-white/10 text-[#8b98a1]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between font-bold">
                        <span>{item.name}</span>
                        <span>{item.unlocked ? '✓ UNLOCKED' : `RANK ${item.rank}`}</span>
                      </div>
                      <div className="text-[8px] opacity-70 mt-0.5">{item.type}</div>
                    </div>
                    <div className="text-[8px] font-mono mt-1 text-[#f5a623]">{item.price}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BOTTOM FOOTER BAR */}
      <div className="w-full bg-[#0b0e12]/90 border-t border-white/10 px-6 py-2 flex items-center justify-between pointer-events-auto text-[9px] text-[#8b98a1]">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={isDevMode}
              onChange={(e) => setIsDevMode(e.target.checked)}
              className="w-3 h-3 accent-[#f5a623]"
            />
            <b className={isDevMode ? "text-[#f5a623]" : ""}>[DEV] UNLOCK ALL ASSETS</b>
          </label>
          <div>
            DIEGETIC HELMET VISOR ACTIVE: <b style={{ color: currentVisorConfig.tint }}>{currentVisorConfig.name}</b>
          </div>
        </div>
        <div>
          GUN ARENA ENGINE V4.2 • THREE.JS 3D RIGGING • 60 FPS REACT
        </div>
      </div>
    </div>
  );
};
