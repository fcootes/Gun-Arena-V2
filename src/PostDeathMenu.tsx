import React, { useEffect, useRef } from 'react';

export function PostDeathMenu({ title, subtitle, kills, onPlayAgain, onLobby }: {
  title: string; subtitle: string; kills: number; onPlayAgain: () => void; onLobby: () => void;
}) {
  const firstButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { firstButton.current?.focus(); }, []);
  return <div className="absolute inset-0 z-50 flex items-center justify-center p-5 bg-black/65 backdrop-blur-md" data-post-death="true">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="post-death-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = dialog.current?.querySelectorAll('button');
      if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length-1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length-1]) { event.preventDefault(); buttons[0].focus(); }
    }} className="w-full max-w-lg rounded-lg border border-white/20 bg-slate-950/75 p-8 shadow-2xl text-center font-mono text-white">
      <p className="text-[10px] tracking-[.3em] text-red-300 mb-4">OPERATION CONCLUDED</p>
      <h2 id="post-death-title" className="text-3xl font-black tracking-wider">{title}</h2>
      <p className="mt-3 text-sm text-slate-300">{subtitle}</p>
      <p className="mt-5 text-xs text-slate-400">{kills} ELIMINATIONS • CURRENT MATCH</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <button ref={firstButton} type="button" onClick={onPlayAgain} className="rounded border border-cyan-300/60 bg-cyan-400/15 px-4 py-3 text-xs font-bold text-cyan-100 hover:bg-cyan-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">[ PLAY AGAIN ]</button>
        <button type="button" onClick={onLobby} className="rounded border border-white/30 bg-white/5 px-4 py-3 text-xs font-bold hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">[ RETURN TO LOBBY ]</button>
      </div>
    </div>
  </div>;
}
