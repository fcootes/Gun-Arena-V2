import React, { useEffect, useRef } from 'react';
import { WeaponDef, WeaponSlotState } from './types';
import { VisorType } from './lobbyAvatar';
import { GearTier } from './FactionContext';
import { WeaponSilhouette } from './LoadoutDMZ';

export interface RadarPing {
  x: number;
  z: number;
  timestamp: number;
  duration: number;
  type: 'gunfire' | 'zombie';
}

export interface HelmetHUDProps {
  visorType?: VisorType;
  gearTier?: GearTier;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  currentWeapon: WeaponDef;
  weaponSlotState: WeaponSlotState;
  slotIndex: number;
  playerLoadout: WeaponDef[];
  playerLoadoutStates: WeaponSlotState[];
  matchMode: 'ffa' | 'team' | 'zombie' | 'escort' | 'extraction';
  factionAlignment: 'usmc' | 'apex';
  blueScore: number;
  redScore: number;
  targetScore: number;
  currentWave: number;
  zombiesRemaining: number;
  kills: number;
  timeStr: string;
  zoneStatus: string;
  playerPos: { x: number; z: number };
  playerYaw: number;
  radarPingsRef: React.MutableRefObject<RadarPing[]>;
}

export const VISOR_THEMES: Record<VisorType, {
  accent: string;
  accentRgba: string;
  radarBg: string;
  radarRingRgba: string;
  radarCrosshairRgba: string;
  sweepRgba: string;
  sweepLineRgba: string;
  accentBorder: string;
  glowShadow: string;
}> = {
  standard: {
    accent: '#2de2e6',
    accentRgba: 'rgba(45, 226, 230, 0.85)',
    radarBg: 'rgba(8, 14, 20, 0.82)',
    radarRingRgba: 'rgba(45, 226, 230, 0.22)',
    radarCrosshairRgba: 'rgba(45, 226, 230, 0.15)',
    sweepRgba: 'rgba(45, 226, 230, 0.12)',
    sweepLineRgba: 'rgba(45, 226, 230, 0.75)',
    accentBorder: 'rgba(45, 226, 230, 0.4)',
    glowShadow: '0 0 14px rgba(45, 226, 230, 0.35)'
  },
  recon: {
    accent: '#00ff66',
    accentRgba: 'rgba(0, 255, 102, 0.85)',
    radarBg: 'rgba(6, 18, 10, 0.82)',
    radarRingRgba: 'rgba(0, 255, 102, 0.22)',
    radarCrosshairRgba: 'rgba(0, 255, 102, 0.15)',
    sweepRgba: 'rgba(0, 255, 102, 0.14)',
    sweepLineRgba: 'rgba(0, 255, 102, 0.75)',
    accentBorder: 'rgba(0, 255, 102, 0.4)',
    glowShadow: '0 0 14px rgba(0, 255, 102, 0.35)'
  },
  apex: {
    accent: '#ff2a2a',
    accentRgba: 'rgba(255, 42, 42, 0.85)',
    radarBg: 'rgba(20, 6, 8, 0.82)',
    radarRingRgba: 'rgba(255, 42, 42, 0.22)',
    radarCrosshairRgba: 'rgba(255, 42, 42, 0.15)',
    sweepRgba: 'rgba(255, 42, 42, 0.14)',
    sweepLineRgba: 'rgba(255, 42, 42, 0.75)',
    accentBorder: 'rgba(255, 42, 42, 0.4)',
    glowShadow: '0 0 14px rgba(255, 42, 42, 0.35)'
  }
};

export const HelmetHUD: React.FC<HelmetHUDProps> = ({
  visorType = 'standard',
  gearTier = 'standard',
  health,
  maxHealth,
  shield,
  maxShield,
  currentWeapon,
  weaponSlotState,
  slotIndex,
  playerLoadout,
  playerLoadoutStates,
  matchMode,
  factionAlignment,
  blueScore,
  redScore,
  targetScore,
  currentWave,
  zombiesRemaining,
  kills,
  timeStr,
  playerPos,
  playerYaw,
  radarPingsRef
}) => {
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);
  const vTheme = VISOR_THEMES[visorType] || VISOR_THEMES.standard;

  // Health critical state (<30% health)
  const hpRatio = Math.max(0, health) / (maxHealth || 100);
  const isCritical = hpRatio < 0.30;
  const isUSMC = factionAlignment === 'usmc';
  const isSpecialized = gearTier === 'specialized';

  // Radar Canvas (Raw, Transparent Tactical Radar Disc)
  useEffect(() => {
    let animationFrameId: number;

    const renderRadar = () => {
      const canvas = radarCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = w / 2 - 4;

      ctx.clearRect(0, 0, w, h);

      // Raw, transparent dark disc with visor-tinted background
      ctx.fillStyle = vTheme.radarBg;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Clean, muted distance range rings (15m, 30m, 50m) styled with visor tint
      ctx.strokeStyle = vTheme.radarRingRgba;
      ctx.lineWidth = 1;
      [0.32, 0.65, 0.96].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Axis crosshairs
      ctx.strokeStyle = vTheme.radarCrosshairRgba;
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();

      // Clean 360-degree sweep beam
      const now = performance.now();
      const sweepAngle = (now * 0.0022) % (Math.PI * 2);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, sweepAngle - 0.28, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = vTheme.sweepRgba;
      ctx.fill();
      ctx.restore();

      // Leading sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
      ctx.strokeStyle = vTheme.sweepLineRgba;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Center Player Indicator (Caret with visor accent)
      ctx.fillStyle = vTheme.accent;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx - 3, cy + 3);
      ctx.lineTo(cx, cy + 1.5);
      ctx.lineTo(cx + 3, cy + 3);
      ctx.closePath();
      ctx.fill();

      // Radar Scramble Glitch Effect (triggered by Banshee distortion pulse)
      const isRadarScrambled = ((window as any).radarScrambleTimer || 0) > 0;
      if (isRadarScrambled) {
        ctx.save();
        ctx.fillStyle = 'rgba(103, 232, 249, 0.22)';
        for (let y = 0; y < h; y += 4) {
          if (Math.random() < 0.65) {
            ctx.fillRect(0, y, w, 2);
          }
        }
        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('! TELEMETRY DISRUPTED !', cx, cy + 24);
        ctx.restore();
      }

      // Radar Pings
      const pings = radarPingsRef.current;
      const MAX_RADAR_DIST = 50.0;

      for (let i = pings.length - 1; i >= 0; i--) {
        const ping = pings[i];
        const age = (now - ping.timestamp) / 1000;
        if (age > ping.duration) {
          pings.splice(i, 1);
          continue;
        }

        let dx = ping.x - playerPos.x;
        let dz = ping.z - playerPos.z;
        if (isRadarScrambled) {
          // Add chaotic jitter to ping coordinates during Banshee pulse
          dx += (Math.random() - 0.5) * 8.0;
          dz += (Math.random() - 0.5) * 8.0;
        }
        const dist = Math.hypot(dx, dz);

        if (dist > MAX_RADAR_DIST) continue;

        const relAngle = Math.atan2(dz, dx) - playerYaw - Math.PI / 2;
        const radarDist = (dist / MAX_RADAR_DIST) * (radius - 5);
        const blipX = cx + Math.cos(relAngle) * radarDist;
        const blipY = cy + Math.sin(relAngle) * radarDist;

        const blinkAlpha = Math.max(0, 1 - age / ping.duration);
        const isZombie = ping.type === 'zombie';

        // Blip dot
        ctx.fillStyle = isZombie ? `rgba(245, 166, 35, ${blinkAlpha})` : `rgba(235, 75, 75, ${blinkAlpha})`;
        ctx.beginPath();
        ctx.arc(blipX, blipY, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(renderRadar);
    };

    renderRadar();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [playerPos, playerYaw, radarPingsRef]);

  // Ammunition formatting
  let ammoDisplay = `${weaponSlotState.ammo ?? 0}`;
  let reserveDisplay = `${weaponSlotState.reserve ?? 0}`;
  let fireModeLabel = 'AUTO';

  if (currentWeapon.id === 'laser') {
    const heat = Math.round(weaponSlotState.heat ?? 0);
    ammoDisplay = `${100 - heat}%`;
    reserveDisplay = `HEAT ${heat}%`;
    fireModeLabel = 'CONTINUOUS BEAM';
  } else if (currentWeapon.id === 'minigun') {
    const heat = Math.round(weaponSlotState.heat ?? 0);
    ammoDisplay = `${heat}%`;
    reserveDisplay = 'HEAT 100%';
    fireModeLabel = 'HYPER-AUTO';
  } else if (currentWeapon.id === 'railgun') {
    ammoDisplay = `${weaponSlotState.ammo ?? 1}`;
    reserveDisplay = `${weaponSlotState.reserve ?? 30} SLUGS`;
    fireModeLabel = 'KINETIC SLUG';
  } else if (currentWeapon.burst) {
    fireModeLabel = '3-ROUND BURST';
  } else if (!currentWeapon.auto && currentWeapon.type === 'weapon') {
    fireModeLabel = 'SEMI-AUTO';
  } else if (currentWeapon.type === 'grenade') {
    ammoDisplay = `${weaponSlotState.count ?? 0}`;
    reserveDisplay = 'GRENADES';
    fireModeLabel = 'EXPLOSIVE';
  }

  // Calculate current yaw in compass degrees [0, 360)
  const headingDeg = Math.round(((playerYaw * 180 / Math.PI) % 360 + 360) % 360);
  const cardinal = (() => {
    if (headingDeg >= 337.5 || headingDeg < 22.5) return 'N';
    if (headingDeg >= 22.5 && headingDeg < 67.5) return 'NE';
    if (headingDeg >= 67.5 && headingDeg < 112.5) return 'E';
    if (headingDeg >= 112.5 && headingDeg < 157.5) return 'SE';
    if (headingDeg >= 157.5 && headingDeg < 202.5) return 'S';
    if (headingDeg >= 202.5 && headingDeg < 247.5) return 'SW';
    if (headingDeg >= 247.5 && headingDeg < 292.5) return 'W';
    return 'NW';
  })();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20 font-mono select-none">
      {/* ========================================================================= */}
      {/* 1. TACTICAL SPECIALIZED FRAME OVERLAYS                                     */}
      {/* ========================================================================= */}

      {/* USMC 1st Recon - Ballistic Breacher Kit: Subtle matte-grey structural helmet frame */}
      {isUSMC && isSpecialized && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Top Matte-Grey Structural Frame Border */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#24282e] to-transparent opacity-90 border-b border-[#3e4550]/40" />
          {/* Left Matte-Grey Perimeter Frame */}
          <div className="absolute top-0 bottom-0 left-0 w-4 bg-gradient-to-r from-[#24282e] to-transparent opacity-90 border-r border-[#3e4550]/40" />
          {/* Right Matte-Grey Perimeter Frame */}
          <div className="absolute top-0 bottom-0 right-0 w-4 bg-gradient-to-l from-[#24282e] to-transparent opacity-90 border-l border-[#3e4550]/40" />
          {/* Bottom Matte-Grey Structural Perimeter Border */}
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#24282e] to-transparent opacity-90 border-t border-[#3e4550]/40" />

          {/* Heavy Frame Corner Brackets */}
          <div className="absolute top-2 left-2 w-12 h-12 border-t-2 border-l-2 border-[#5a6473]/70" />
          <div className="absolute top-2 right-2 w-12 h-12 border-t-2 border-r-2 border-[#5a6473]/70" />
          <div className="absolute bottom-2 left-2 w-12 h-12 border-b-2 border-l-2 border-[#5a6473]/70" />
          <div className="absolute bottom-2 right-2 w-12 h-12 border-b-2 border-r-2 border-[#5a6473]/70" />
        </div>
      )}

      {/* Apex PMC Shadow - Low-Vis Recon Rig: Crisp Un-Tinted Digital Compass Strip */}
      {!isUSMC && isSpecialized && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center">
          <div className="px-4 py-1 bg-black/85 border border-white/15 rounded-sm flex items-center gap-3 backdrop-blur-sm shadow-lg">
            <span className="text-[10px] font-bold text-[#8b98a1] tracking-wider">HEADING</span>
            <span className="text-xs font-bold text-white tracking-widest">
              {String(headingDeg).padStart(3, '0')}° {cardinal}
            </span>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1.5 text-[9px] text-[#cbd5e1]">
              <span className={cardinal === 'N' ? 'text-white font-bold' : 'opacity-40'}>N</span>
              <span className="opacity-30">•</span>
              <span className={cardinal === 'E' ? 'text-white font-bold' : 'opacity-40'}>E</span>
              <span className="opacity-30">•</span>
              <span className={cardinal === 'S' ? 'text-white font-bold' : 'opacity-40'}>S</span>
              <span className="opacity-30">•</span>
              <span className={cardinal === 'W' ? 'text-white font-bold' : 'opacity-40'}>W</span>
            </div>
          </div>
          {/* Subtle indicator reticle tick */}
          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-white/70" />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOP-LEFT MINIMALIST HEALTH & ARMOR BARS                                */}
      {/* ========================================================================= */}
      <div
        className={`absolute top-6 left-8 p-3 rounded-sm bg-black/80 border backdrop-blur-sm transition-all ${
          isCritical ? 'border-[#ff4444] animate-pulse bg-[#250d0d]/85' : 'border-white/15'
        }`}
        style={{ width: '270px' }}
      >
        <div className="flex items-center justify-between text-[10px] tracking-wider font-bold mb-1.5">
          <span className="text-[#8b98a1] uppercase">
            {isUSMC ? 'USMC 1st RECON' : 'APEX PMC SHADOW'}
          </span>
          <span className="text-white">
            ARMOR {Math.ceil(shield)} / HP {Math.ceil(health)}
          </span>
        </div>

        {/* Body Armor Bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-[8px] text-[#8b98a1] mb-0.5">
            <span>BODY ARMOR</span>
            <span className="text-white font-bold">{Math.round((shield / (maxShield || 100)) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-black/90 p-0.5 border border-white/15 rounded-xs">
            <div
              className="h-full bg-[#3b82f6] transition-all duration-150 rounded-xs"
              style={{ width: `${Math.min(100, Math.max(0, (shield / (maxShield || 100)) * 100))}%` }}
            />
          </div>
        </div>

        {/* Vital Health Bar */}
        <div>
          <div className="flex items-center justify-between text-[8px] text-[#8b98a1] mb-0.5">
            <span>VITAL SIGNS</span>
            <span className={isCritical ? 'text-[#ff4444] font-bold' : 'text-emerald-400 font-bold'}>
              {Math.round(hpRatio * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-black/90 p-0.5 border border-white/15 rounded-xs">
            <div
              className={`h-full transition-all duration-150 rounded-xs ${
                isCritical ? 'bg-[#ff3333]' : 'bg-[#e2e8f0]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, hpRatio * 100))}%` }}
            />
          </div>
        </div>

        {/* Passive Gear Status Tag */}
        <div className="mt-2 pt-1 border-t border-white/10 flex items-center justify-between text-[8px] text-[#8b98a1]">
          <span>KIT: <b className="text-white uppercase">{isSpecialized ? (isUSMC ? 'BREACHER' : 'RECON') : 'STANDARD'}</b></span>
          {isSpecialized ? (
            isUSMC ? (
              <span className="text-[#a3d977] font-bold">FORTIFIED (+15% ARMOR)</span>
            ) : (
              <span className="text-[#60a5fa] font-bold">STALKER (+10% SPRINT)</span>
            )
          ) : (
            <span className="text-[#8b98a1]">BASELINE PROTOCOL</span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TOP-CENTER MATCH SCOREBOARD (SUPPRESSED IN EXTRACTION MODE)            */}
      {/* ========================================================================= */}
      {matchMode !== 'extraction' && (
        <div className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center ${(!isUSMC && isSpecialized) ? 'top-12' : 'top-5'}`}>
          <div className="px-4 py-1.5 bg-black/85 border border-white/15 backdrop-blur-sm rounded-sm flex items-center gap-3 text-xs tracking-wider">
            {matchMode === 'zombie' ? (
              <>
                <span className="text-emerald-400 font-bold">WAVE {currentWave}</span>
                <span className="text-white/25">|</span>
                <span className="text-[#ff4444] font-bold">HOSTILES: {Math.max(0, zombiesRemaining)}</span>
              </>
            ) : matchMode === 'team' ? (
              <>
                <span className="text-[#60a5fa] font-bold">
                  {factionAlignment === 'usmc' ? 'USMC' : 'APEX'} {blueScore}
                </span>
                <span className="text-white/30 text-[10px]">VS</span>
                <span className="text-[#ff5555] font-bold">
                  {redScore} {factionAlignment === 'usmc' ? 'APEX' : 'USMC'}
                </span>
                <span className="text-white/25">|</span>
                <span className="text-[#f5a623] text-[10px]">GOAL: {targetScore}</span>
              </>
            ) : (
              <>
                <span className="text-white font-bold">KILLS: {kills}</span>
                <span className="text-white/25">|</span>
                <span className="text-[#f5a623] text-[10px]">TARGET: {targetScore}</span>
              </>
            )}
            <span className="text-white/25">|</span>
            <span className="text-white text-[11px]">{timeStr}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TOP-RIGHT TACTICAL MUNITIONS MATRIX (Ammo Readout + SVG Silhouette)    */}
      {/* ========================================================================= */}
      <div
        className="absolute top-6 right-8 p-3 rounded-sm bg-black/80 border border-white/15 backdrop-blur-sm flex flex-col items-end"
        style={{ minWidth: '240px' }}
      >
        <div className="flex items-center justify-between w-full text-[9px] tracking-wider text-[#8b98a1] mb-1">
          <span className="font-bold text-white uppercase">{currentWeapon.name}</span>
          <span className="px-1.5 py-0.5 rounded-xs bg-white/10 text-[8px] font-bold text-white tracking-wider">
            {fireModeLabel}
          </span>
        </div>

        {/* Crisp White Weapon Silhouette matching DMZ layout */}
        <div className="my-1.5 flex items-center justify-center p-2 bg-black/60 border border-white/10 rounded-xs w-full h-12">
          <WeaponSilhouette id={currentWeapon.id} className="w-24 h-8 text-white" />
        </div>

        {/* Digital Numeric Ammo Readout */}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-extrabold tracking-tight text-white">
            {ammoDisplay}
          </span>
          <span className="text-xs font-bold text-[#8b98a1]">
            / {reserveDisplay}
          </span>
        </div>

        {/* Reloading / Overheating Status Tag */}
        {weaponSlotState.reloading && (
          <div className="mt-1 px-2 py-0.5 bg-yellow-500/20 border border-yellow-400 text-yellow-300 text-[9px] font-bold animate-pulse rounded-xs">
            {weaponSlotState.isTacticalReload ? 'TACTICAL RELOAD...' : 'EMPTY CHAMBER RELOAD...'}
          </div>
        )}
        {weaponSlotState.overheated && (
          <div className="mt-1 px-2 py-0.5 bg-red-500/20 border border-red-500 text-red-400 text-[9px] font-bold animate-pulse rounded-xs">
            OVERHEATED! VENTING...
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. BOTTOM-LEFT CIRCULAR TACTICAL RADAR                                    */}
      {/* ========================================================================= */}
      <div
        className="absolute bottom-6 left-8 p-1.5 rounded-full bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center transition-all duration-300"
        style={{
          width: '144px',
          height: '144px',
          border: `1.5px solid ${vTheme.accentBorder}`,
          boxShadow: vTheme.glowShadow
        }}
      >
        <canvas
          ref={radarCanvasRef}
          width={132}
          height={132}
          className="block rounded-full"
        />
        <div
          className="absolute -bottom-2 px-2 py-0.5 rounded-xs bg-black/95 text-[8px] font-bold tracking-wider"
          style={{
            border: `1px solid ${vTheme.accentBorder}`,
            color: vTheme.accent
          }}
        >
          PROXIMITY 50M
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. BOTTOM-CENTER 3-SLOT TACTICAL LOADOUT HOTBAR                           */}
      {/* ========================================================================= */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {playerLoadout.slice(0, 3).map((weapon, idx) => {
          const isSelected = slotIndex === idx;
          const slotState = playerLoadoutStates[idx];
          return (
            <div
              key={`hotbar-${weapon.id}-${idx}`}
              className={`px-3 py-1.5 rounded-xs bg-black/85 backdrop-blur-sm flex items-center gap-2.5 transition-all ${
                isSelected ? 'scale-105 shadow-lg' : 'border border-white/10 opacity-70'
              }`}
              style={isSelected ? {
                border: `1.5px solid ${vTheme.accent}`,
                boxShadow: vTheme.glowShadow,
                backgroundColor: 'rgba(255, 255, 255, 0.08)'
              } : undefined}
            >
              <div
                className="w-4 h-4 rounded-xs flex items-center justify-center text-[9px] font-bold font-mono"
                style={isSelected ? {
                  backgroundColor: vTheme.accent,
                  color: '#000'
                } : {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#fff'
                }}
              >
                {idx === 2 ? '3/G' : idx + 1}
              </div>
              <div className="text-left">
                <div
                  className="text-[9px] font-bold tracking-wider uppercase"
                  style={{ color: isSelected ? vTheme.accent : '#fff' }}
                >
                  {weapon.name}
                </div>
                <div className="text-[8px] text-[#8b98a1]">
                  {weapon.type === 'grenade'
                    ? `x${slotState?.count ?? 0} EXPLOSIVE`
                    : `${slotState?.ammo ?? 0} / ${slotState?.reserve ?? 0}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
