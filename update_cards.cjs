const fs = require('fs');
let code = fs.readFileSync('src/LobbyTerminal.tsx', 'utf-8');

const startIdx = code.indexOf('{/* 3 Distinct Styled Scenario Cards */}');
const endIdx = code.indexOf('{/* Scenario Configuration: Map & Rules */}');

if (startIdx !== -1 && endIdx !== -1) {
  const newCards = `            {/* 2 Distinct Styled Scenario Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {/* CARD 1: EXTRACTION */}
              <div
                onClick={() => setMatchMode('EXTRACTION')}
                className={\`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between h-72 \${
                  matchMode === 'EXTRACTION'
                    ? 'border-[#2de2e6] bg-[#2de2e6]/10 shadow-[0_0_16px_rgba(45,226,230,0.35)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30'
                }\`}
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
                  setMatchMode('WAVE_SURVIVAL');
                  setSelectedMapState('hangar');
                }}
                className={\`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between h-72 \${
                  matchMode === 'WAVE_SURVIVAL'
                    ? 'border-[#ff2a2a] bg-[#ff2a2a]/10 shadow-[0_0_16px_rgba(255,42,42,0.35)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30'
                }\`}
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
            `;
  code = code.substring(0, startIdx) + newCards + code.substring(endIdx);
  
  // also fix some other things like disabled map selection if zombie
  code = code.replace(/disabled={matchMode === 'zombie'}/g, "disabled={matchMode === 'WAVE_SURVIVAL'}");
  code = code.replace(/if \(matchMode !== 'zombie'\)/g, "if (matchMode !== 'WAVE_SURVIVAL')");
  code = code.replace(/matchMode === 'zombie'/g, "matchMode === 'WAVE_SURVIVAL'");
  code = code.replace(/matchMode === 'team'/g, "matchMode === 'EXTRACTION'");
  code = code.replace(/matchMode === 'ffa'/g, "false");
  code = code.replace(/matchMode === 'escort'/g, "false");
  fs.writeFileSync('src/LobbyTerminal.tsx', code);
  console.log('Cards replaced successfully.');
} else {
  console.log('Could not find start or end indices.');
}
