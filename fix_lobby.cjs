const fs = require('fs');
let code = fs.readFileSync('src/LobbyTerminal.tsx', 'utf-8');

const matchModeUseEffect = `  useEffect(() => {
    if (matchMode === 'zombie' && selectedMapState !== 'hangar') {
      setSelectedMapState('hangar');
    }
  }, [matchMode, selectedMapState, setSelectedMapState]);`;
const newMatchModeUseEffect = `  useEffect(() => {
    if ((matchMode === 'zombie' || matchMode === 'extraction') && selectedMapState !== 'hangar') {
      setSelectedMapState('hangar');
    }
  }, [matchMode, selectedMapState, setSelectedMapState]);`;
code = code.replace(matchModeUseEffect, newMatchModeUseEffect);

// In src/LobbyTerminal.tsx around line 1343:
const cardsBlock = `            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">`;
const newCardsBlock = `            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {/* CARD 1: TEAM DEATHMATCH */}
              <div
                onClick={() => setMatchMode('team')}
                className={\`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between h-72 \${
                  matchMode === 'team'
                    ? 'border-[#57d1c9] bg-[#57d1c9]/10 shadow-[0_0_16px_rgba(87,209,201,0.35)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30'
                }\`}
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
                className={\`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between h-72 \${
                  matchMode === 'ffa'
                    ? 'border-[#f5a623] bg-[#f5a623]/10 shadow-[0_0_16px_rgba(245,166,35,0.35)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30'
                }\`}
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
`;

code = code.replace(cardsBlock, newCardsBlock);

// Disable outdoor map for extraction
const dis1 = `disabled={matchMode === 'zombie'}`;
const ndis1 = `disabled={matchMode === 'zombie' || matchMode === 'extraction'}`;
code = code.replaceAll(dis1, ndis1);

const if1 = `if (matchMode !== 'zombie') {`;
const nif1 = `if (matchMode !== 'zombie' && matchMode !== 'extraction') {`;
code = code.replaceAll(if1, nif1);

const mcZ1 = `matchMode === 'zombie'
                        ? 'border-white/5 opacity-35 cursor-not-allowed bg-black/40 grayscale'`;
const nmcZ1 = `(matchMode === 'zombie' || matchMode === 'extraction')
                        ? 'border-white/5 opacity-35 cursor-not-allowed bg-black/40 grayscale'`;
code = code.replaceAll(mcZ1, nmcZ1);

const rest1 = `{matchMode === 'zombie' ? 'RESTRICTED // HORDE LOCK' : 'OUTDOOR ARENA'}`;
const nrest1 = `{(matchMode === 'zombie' || matchMode === 'extraction') ? 'RESTRICTED // HORDE/EXT LOCK' : 'OUTDOOR ARENA'}`;
code = code.replaceAll(rest1, nrest1);

const mCZand = `{matchMode === 'zombie' && (
                      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-[9px] font-extrabold tracking-wider text-[#ff4444] border border-[#ff4444]/30 pointer-events-none">
                        <span>LOCKED FOR HORDE</span>`;
const nmCZand = `{(matchMode === 'zombie' || matchMode === 'extraction') && (
                      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-[9px] font-extrabold tracking-wider text-[#ff4444] border border-[#ff4444]/30 pointer-events-none">
                        <span>LOCKED FOR HORDE/EXTRACTION</span>`;
code = code.replaceAll(mCZand, nmCZand);

const zomband2 = `{matchMode === 'zombie' && (
                      <div className="absolute top-2 left-2 text-[8px] font-black text-[#ff4444] bg-[#ff4444]/25 px-1.5 py-0.5 rounded-xs border border-[#ff4444]/40">
                        MANDATORY HORDE MAP
                      </div>`;
const nzomband2 = `{(matchMode === 'zombie' || matchMode === 'extraction') && (
                      <div className="absolute top-2 left-2 text-[8px] font-black text-[#ff4444] bg-[#ff4444]/25 px-1.5 py-0.5 rounded-xs border border-[#ff4444]/40">
                        MANDATORY HORDE/EXT MAP
                      </div>`;
code = code.replaceAll(zomband2, nzomband2);

fs.writeFileSync('src/LobbyTerminal.tsx', code);
