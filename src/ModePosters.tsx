import React from 'react';
import { GameMode, WorldMapId } from './types';
const MODES = [
  { id: 'zombie', title: 'HORDE SURVIVAL', tag: 'ENDLESS / CONTAINMENT', color: '#bd483f', detail: 'Hold the perimeter against escalating mutant waves.', badge: 'M8 6h16l5 9-6 8v7H9v-7l-6-8 5-9Zm2 7v5h5v-5h-5Zm9 0v5h5v-5h-5Z' },
  { id: 'ffa', title: 'FREE FOR ALL', tag: 'SOLO / NO ALLIES', color: '#b39255', detail: 'Every operator is a target. Reach the elimination limit.', badge: 'M16 2 30 28H2L16 2Zm0 8-8 14h16l-8-14Z' },
  { id: 'extraction', title: 'EXTRACTION', tag: 'OBJECTIVE / EXFIL', color: '#64a6ac', detail: 'Secure the mission, survive the holdout and board the transport.', badge: 'M2 13h28v6H2v-6Zm11-11h6v28h-6V2ZM6 25l10 7 10-7' },
  { id: 'team', title: 'TEAM DEATHMATCH', tag: 'FIRETEAM / COALITION', color: '#789582', detail: 'Coordinate your squad and eliminate the opposing force.', badge: 'M2 8 10 2l6 6 6-6 8 6v14l-14 10L2 22V8Zm6 4v8l8 6 8-6v-8l-8 6-8-6Z' }
] as const;
export function ModePosters({ mode, map, onSelect }: { mode: GameMode; map: WorldMapId; onSelect: (mode: GameMode) => void }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Game mode poster deck">{MODES.map((item, index) => <button type="button" key={item.id} onClick={() => onSelect(item.id)} aria-pressed={mode === item.id} className="group relative text-left overflow-hidden min-h-[360px] border bg-[#121719] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ borderColor: mode === item.id ? item.color : '#ffffff30' }}>
    <svg viewBox="0 0 240 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs><linearGradient id={`mode-wash-${item.id}`} x2="0" y2="1"><stop stopColor={item.color} stopOpacity=".5"/><stop offset="1" stopColor="#070b0e"/></linearGradient></defs>
      <rect width="240" height="400" fill={`url(#mode-wash-${item.id})`} />
      <path d="M0 90h40v50h25V70h55v70h40V50h45v90h35v220H0V90Z" fill="#172229" opacity=".8" />
      <path d="M0 260 240 195v205H0Z" fill="#0c151a" />
      {[0, 1, 2].map(i => <g key={i} transform={`translate(${25 + i * 73},${210 - i * 22}) scale(${1 - i * .1})`} fill={index === 0 ? '#183028' : '#243439'} stroke="#8ca098" strokeWidth="1"><ellipse cx="22" cy="-22" rx="13" ry="15"/><path d="M8-8h29l9 57-10 6 1 67H25l-4-56-8 56H0l6-69-8-12L8-8Z"/><path d="m7 1-19 27 10 7L17 9m19-8 25 18-3 12-31-16"/><path d="m-8 24 64-8 28 5-1 7-89 4Z" fill="#0a1115" /></g>)}
      <path d="M0 315h240v85H0Z" fill="#070b0e" opacity=".75" />
      <g stroke={item.color} opacity=".3">{Array.from({ length: 15 }, (_, i) => <path key={i} d={`M0 ${i * 29}h240`} />)}</g>
    </svg>
    <div className="relative z-10 flex flex-col min-h-[360px] justify-between p-4"><div><div className="text-[8px] tracking-[.2em] text-white/60">OPERATION / 0{index + 1}</div><h3 className="text-xl leading-none mt-2 font-black tracking-tight text-white">{item.title}</h3><p className="text-[8px] tracking-widest mt-2" style={{ color: item.color }}>{item.tag}</p></div><div><svg viewBox="0 0 34 36" className="w-20 h-20 mb-3 text-white drop-shadow-lg" fill="currentColor" aria-hidden="true"><path d={item.badge} fillRule="evenodd" /></svg><p className="text-[10px] text-slate-300 leading-relaxed">{item.id === 'extraction' && map === 'shattered_wall' ? 'Signal the beacon. Defend the offshore helipad. Extract under fire.' : item.detail}</p><div className="text-[8px] mt-3 tracking-widest font-bold" style={{ color: item.color }}>{mode === item.id ? 'SELECTED / READY TO DEPLOY' : 'SELECT OPERATION →'}</div></div></div>
  </button>)}</div>;
}
