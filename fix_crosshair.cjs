const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCrosshair = `<div id="crosshair">
            <div className="tick t" />
            <div className="tick b" />
            <div className="tick l" />
            <div className="tick r" />
            <div className="dot" />
          </div>`;
          
const newCrosshair = `<div id="crosshair" style={{ borderColor: targetingPhase ? '#ff4444' : 'rgba(255,255,255,0.7)' }}>
            {targetingPhase && <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', color: '#ff4444', fontSize: 12, fontWeight: 'bold', textShadow: '0 0 4px red', whiteSpace: 'nowrap' }}>[ PHASE 1: TARGETING ]</div>}
            <div className="tick t" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
            <div className="tick b" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
            <div className="tick l" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
            <div className="tick r" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
            <div className="dot" style={{ backgroundColor: targetingPhase ? '#ff4444' : undefined }} />
          </div>`;

if (code.includes(oldCrosshair)) {
  code = code.replace(oldCrosshair, newCrosshair);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Replaced crosshair");
} else {
  console.log("Could not find old crosshair");
}
