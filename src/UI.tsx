import React from 'react';
import { ExtractionState, ExtractionFaction } from './gameLoop';

export interface ExtractionHUDProps {
  state: ExtractionState;
  timeStr: string;
  kills: number;
}

export const ExtractionObjectiveHUD: React.FC<ExtractionHUDProps> = ({ state, timeStr, kills }) => {
  const sectors = [
    { num: 1, name: 'INGRESS', z: 'Z=0' },
    { num: 2, name: 'VIROLOGY', z: 'Z=-40' },
    { num: 3, name: 'REACTOR', z: 'Z=-80' },
    { num: 4, name: 'MAINFRAME', z: 'Z=-120' },
    { num: 5, name: 'EVAC VAULT', z: 'Z=-160' },
  ];

  const isUSMC = state.faction === 'usmc';

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-2 font-mono w-full max-w-2xl px-4">
      {/* 1. Sector Linear Gauntlet Breadcrumb */}
      <div className="flex items-center justify-between w-full bg-black/85 border border-white/15 px-3 py-1.5 backdrop-blur-md rounded-xs shadow-[0_0_15px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xs tracking-wider ${
            isUSMC ? 'bg-[#3f8fe0]/20 text-[#60a5fa] border border-[#3f8fe0]/40' : 'bg-[#e0473f]/20 text-[#f87171] border border-[#e0473f]/40'
          }`}>
            {isUSMC ? 'USMC 1ST RECON' : 'ROGUE MERCENARIES'}
          </span>
          <span className="text-[10px] text-gray-400">OPERATION: SUBTERRANEAN</span>
        </div>

        <div className="flex items-center gap-1">
          {sectors.map((sec, idx) => {
            const isActive = state.currentSector === sec.num;
            const isPassed = state.currentSector > sec.num;
            return (
              <React.Fragment key={sec.num}>
                {idx > 0 && <span className="text-white/20 text-[9px]">──</span>}
                <div
                  className={`px-2 py-0.5 text-[9px] font-bold tracking-wider rounded-xs flex items-center gap-1 transition-all ${
                    isActive
                      ? 'bg-[#2de2e6]/25 text-[#2de2e6] border border-[#2de2e6] shadow-[0_0_8px_rgba(45,226,230,0.5)]'
                      : isPassed
                      ? 'text-emerald-400/80 bg-emerald-950/30'
                      : 'text-gray-500 bg-black/40'
                  }`}
                >
                  <span>SEC 0{sec.num}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#2de2e6] animate-ping" />}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="text-[11px] font-bold text-gray-300">
          ⏱ {timeStr}
        </div>
      </div>

      {/* 2. Primary Tactical Objective Card */}
      <div className="w-full bg-gradient-to-b from-black/90 to-black/75 border border-[#2de2e6]/50 px-4 py-2 backdrop-blur-md rounded-xs shadow-[0_0_20px_rgba(45,226,230,0.2)] flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2de2e6] animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-[#2de2e6] uppercase">
              {state.objectiveTitle}
            </span>
          </div>

          {/* Objective Asset Status Badges */}
          <div className="flex items-center gap-2">
            {isUSMC ? (
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-xs tracking-wider border ${
                  state.hasBioCylinder
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                }`}
              >
                {state.hasBioCylinder ? '✔ BIO-CYLINDER SECURED' : '⚠ BIO-CYLINDER IN SECTOR 3'}
              </span>
            ) : (
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-xs tracking-wider border ${
                  state.mainframeHacked
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                }`}
              >
                {state.mainframeHacked ? '✔ MAINFRAME PURGED' : '⚠ MAINFRAME IN SECTOR 4'}
              </span>
            )}

            {state.bossSpawned && (
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-xs tracking-wider border ${
                  state.bossDefeated
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                    : 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                }`}
              >
                {state.bossDefeated ? '✔ SPECIMEN ZERO DEAD' : '☠ SPECIMEN ZERO ACTIVE'}
              </span>
            )}
          </div>
        </div>

        <div className="text-[10px] text-gray-300 font-sans tracking-wide">
          {state.objectiveDetail}
        </div>

        {/* Dynamic Hacking Progress Bar */}
        {state.isHacking && (
          <div className="w-full flex flex-col gap-1 mt-1">
            <div className="flex justify-between text-[9px] font-mono text-cyan-300">
              <span>UPLOADING VIRAL PURGE PAYLOAD...</span>
              <span>{Math.floor(state.hackProgress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-xs overflow-hidden border border-cyan-500/40">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-[#2de2e6] transition-all duration-100"
                style={{ width: `${state.hackProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Controls & Action Guidance Ribbon */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400 bg-black/60 px-3 py-1 rounded-xs border border-white/5">
        <span><kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded-xs">F</kbd> Quick Melee</span>
        <span className="text-white/20">|</span>
        <span><kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded-xs">E</kbd> Objective / Doors</span>
        <span className="text-white/20">|</span>
        <span><kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded-xs">Z</kbd> Squad Posture</span>
        <span className="text-white/20">|</span>
        <span className="text-[#2de2e6]">MUTANTS KILLED: {kills}</span>
      </div>
    </div>
  );
};

export interface ExtractionEndScreenProps {
  isVictory: boolean;
  state: ExtractionState;
  kills: number;
  accuracyPct: number;
  headshotPct: number;
  timeStr: string;
  onRedeploy: () => void;
  onLobby: () => void;
}

export const ExtractionEndScreen: React.FC<ExtractionEndScreenProps> = ({
  isVictory,
  state,
  kills,
  accuracyPct,
  headshotPct,
  timeStr,
  onRedeploy,
  onLobby,
}) => {
  const isUSMC = state.faction === 'usmc';

  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none">
      <div className="w-full max-w-lg bg-[#0e1217] border-2 border-[#2de2e6]/60 rounded-xs p-6 shadow-[0_0_40px_rgba(45,226,230,0.25)] flex flex-col gap-5">
        {/* Header Title */}
        <div className="flex flex-col items-center text-center gap-1 border-b border-white/10 pb-4">
          <span className="text-[10px] font-bold tracking-[0.3em] text-gray-400 uppercase">
            OPERATION: SUBTERRANEAN EXTRACTION // DEBRIEF
          </span>
          <h1
            className={`text-3xl font-black tracking-widest uppercase ${
              isVictory ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]' : 'text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]'
            }`}
          >
            {isVictory ? 'MISSION ACCOMPLISHED' : 'M.I.A. // EXTRACTION FAILED'}
          </h1>
          <p className="text-xs text-gray-300">
            {isVictory
              ? isUSMC
                ? 'Prototype Bio-Cylinder extracted to surface. Antidote synthesis underway.'
                : 'Central research mainframe wiped. Black-site corporate records destroyed.'
              : 'Operative lost in deep bio-containment facility. Extraction aborted.'}
          </p>
        </div>

        {/* Mission Dossier Details */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-black/50 p-2.5 rounded-xs border border-white/5 flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 uppercase">Affiliated Faction</span>
            <span className={`font-bold ${isUSMC ? 'text-blue-400' : 'text-red-400'}`}>
              {isUSMC ? 'USMC 1st Recon' : 'Rogue Mercenaries'}
            </span>
          </div>

          <div className="bg-black/50 p-2.5 rounded-xs border border-white/5 flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 uppercase">Deepest Sector</span>
            <span className="font-bold text-[#2de2e6]">
              Sector 0{state.currentSector} of 05
            </span>
          </div>

          <div className="bg-black/50 p-2.5 rounded-xs border border-white/5 flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 uppercase">Primary Asset Objective</span>
            <span className="font-bold text-white">
              {isUSMC
                ? state.hasBioCylinder ? '✔ Bio-Cylinder Secured' : '✖ Bio-Cylinder Lost'
                : state.mainframeHacked ? '✔ Mainframe Purged' : '✖ Mainframe Intact'}
            </span>
          </div>

          <div className="bg-black/50 p-2.5 rounded-xs border border-white/5 flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 uppercase">Evac Status</span>
            <span className="font-bold text-white">
              {isVictory ? '✔ Sector 5 Airlift Extracted' : '✖ Evac Pad Not Reached'}
            </span>
          </div>
        </div>

        {/* Combat Performance Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-black/40 p-2 rounded-xs border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase">Mutants Killed</div>
            <div className="text-xl font-bold text-red-400">{kills}</div>
          </div>
          <div className="bg-black/40 p-2 rounded-xs border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase">Accuracy</div>
            <div className="text-xl font-bold text-blue-400">{accuracyPct}%</div>
          </div>
          <div className="bg-black/40 p-2 rounded-xs border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase">Time In Sector</div>
            <div className="text-xl font-bold text-amber-400">{timeStr}</div>
          </div>
        </div>

        {/* Rewards Earned */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xs flex items-center justify-between text-xs">
          <div className="flex flex-col">
            <span className="text-emerald-400 font-bold uppercase tracking-wider">Combat Rewards</span>
            <span className="text-[10px] text-gray-400">Hazard pay & specimen extraction bounty</span>
          </div>
          <div className="text-right font-bold text-emerald-300">
            <div>+{kills * 150 + (isVictory ? 2500 : 500)} CREDITS</div>
            <div className="text-[10px] text-emerald-500/80">+{kills * 80 + (isVictory ? 1200 : 200)} XP</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onRedeploy}
            className="flex-1 py-2.5 bg-[#2de2e6] hover:bg-[#2de2e6]/80 text-black font-bold text-xs tracking-wider uppercase rounded-xs transition-colors cursor-pointer shadow-[0_0_15px_rgba(45,226,230,0.4)]"
          >
            🔄 Redeploy Operation
          </button>
          <button
            onClick={onLobby}
            className="px-4 py-2.5 bg-black/60 hover:bg-white/10 text-gray-300 border border-white/20 font-bold text-xs tracking-wider uppercase rounded-xs transition-colors cursor-pointer"
          >
            Lobby
          </button>
        </div>
      </div>
    </div>
  );
};
