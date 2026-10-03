import React from 'react';
import { CLASSES } from './classes';
import { ClassId, DeploymentProtocol, EliteCompanionConfig, SquadDirective } from './types';
import { VAULT_WEAPONS } from './LoadoutDMZ';

export function ClassIcon({ id, className = 'w-8 h-8' }: { id: ClassId; className?: string }) {
  const paths: Record<ClassId, React.ReactNode> = {
    assault: <path d="M16 3 29 28H3L16 3Zm0 8-7 13h14L16 11Z" />,
    engineer: <><path d="m13 3 6 0 1 5 4 2 4-2 3 5-4 3 0 5 4 3-3 5-4-2-4 2-1 5h-6l-1-5-4-2-4 2-3-5 4-3v-5l-4-3 3-5 4 2 4-2 1-5Z" /><circle cx="16" cy="18" r="5" /></>,
    medic: <path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9V3Z" />,
    support: <><path d="M4 28V10l4-7 4 7v18H4Zm12 0V10l4-7 4 7v18h-8Z" /><path d="M4 23h8m4 0h8" /></>,
    recon: <><circle cx="16" cy="16" r="10" /><path d="M16 0v11m0 10v11M0 16h11m10 0h11" /></>
  };
  return <svg viewBox="0 0 34 36" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{paths[id]}</svg>;
}

interface SquadProps {
  squad: EliteCompanionConfig[];
  setSquad?: (squad: EliteCompanionConfig[]) => void;
  leader: ClassId;
  protocol: DeploymentProtocol;
  setProtocol?: (protocol: DeploymentProtocol) => void;
  preset: SquadDirective;
  setPreset: (preset: SquadDirective) => void;
  friendlyCount: number;
  setFriendlyCount: (count: number) => void;
  compact?: boolean;
}
export function TacticalSquad(props: SquadProps) {
  const { squad, setSquad, leader, compact, preset, setPreset } = props;
  function update(slotId: number, patch: Partial<EliteCompanionConfig>) {
    setSquad?.(squad.map(member => member.slotId === slotId ? { ...member, ...patch } : member));
  }
  return <section className="bg-[#0c1015]/90 border border-white/15 backdrop-blur-md p-3 space-y-3 pointer-events-auto" aria-label="Squad allocation matrix">
    <div className="flex justify-between text-[10px] font-bold tracking-widest text-white"><span>FIRETEAM // FIVE OPERATORS</span><span className="text-cyan-300">01 + 04</span></div>
    <div className="grid grid-cols-2 gap-2">
      {(['push_objective', 'hold_position'] as const).map(id => <button type="button" key={id} aria-pressed={preset === id} onClick={() => setPreset(id)} className={`p-2 text-[9px] font-bold border ${preset === id ? 'border-cyan-300 bg-cyan-300/15 text-cyan-200' : 'border-white/15 text-slate-400'}`}>{id === 'push_objective' ? 'AGGRESSIVE PUSH' : 'HOLD & DEFEND'}</button>)}
    </div>
    <div className="flex gap-2 text-[9px]">
      <button type="button" aria-pressed={props.protocol === 'elite'} onClick={() => { props.setProtocol?.('elite'); props.setFriendlyCount(4); }} className="border border-white/20 px-2 py-1">ELITE FIRETEAM</button>
      <button type="button" aria-pressed={props.protocol !== 'elite'} onClick={() => props.setProtocol?.('standard')} className="border border-white/20 px-2 py-1">BATTALION</button>
    </div>
    {props.protocol !== 'elite' && <label className="block text-[10px] text-slate-300">ALLIES: {props.friendlyCount}<input aria-label="Battalion size" className="w-full" type="range" min="0" max="20" value={props.friendlyCount} onChange={e => props.setFriendlyCount(Number(e.target.value))} /></label>}
    <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'} gap-2`}>
      <div className="border border-cyan-300/40 p-2 flex gap-2 items-center bg-cyan-950/30"><ClassIcon id={leader} /><div className="text-[10px]"><strong>01 / YOU</strong><p className="text-cyan-200">{CLASSES[leader].name}</p></div></div>
      {squad.map(member => <div key={member.slotId} className="border border-white/15 p-2 space-y-2 bg-black/35">
        <div className="flex items-center gap-2"><ClassIcon id={member.archetype} className="w-6 h-6 text-cyan-200" /><strong className="text-[10px] text-white">0{member.slotId} / {member.callsign}</strong></div>
        <label className="text-[8px] block text-slate-400">COMBAT ROLE<select aria-label={`${member.callsign} combat role`} value={member.archetype} onChange={e => { const role = e.target.value as ClassId; const cls = CLASSES[role]; update(member.slotId, { archetype: role, primaryWeapon: cls.defaultPrimary, secondaryWeapon: cls.defaultSecondary, roleTitle: cls.name, perkDescription: cls.perkDesc }); }} className="block w-full bg-slate-950 border border-white/20 p-1 text-[10px] text-white">{Object.values(CLASSES).map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></label>
        <label className="text-[8px] block text-slate-400">PRIMARY<select aria-label={`${member.callsign} primary weapon`} value={member.primaryWeapon} onChange={e => update(member.slotId, { primaryWeapon: e.target.value })} className="block w-full bg-slate-950 border border-white/20 p-1 text-[10px] text-white">{Object.values(VAULT_WEAPONS).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="text-[8px] block text-slate-400">SECONDARY<select aria-label={`${member.callsign} secondary weapon`} value={member.secondaryWeapon} onChange={e => update(member.slotId, { secondaryWeapon: e.target.value })} className="block w-full bg-slate-950 border border-white/20 p-1 text-[10px] text-white">{Object.values(VAULT_WEAPONS).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <p className="text-[8px] text-slate-400">{member.perkDescription}</p>
      </div>)}
    </div>
  </section>;
}
