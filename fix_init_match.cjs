const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `      clearMatchEntities();
      
      // Guardrail`;
      
const newStr = `      clearMatchEntities();
      
      // Reset AI Director
      window.aiDirectorState = {
        currentSector: 1,
        spawnTimer: 0,
        waveCount: 0
      };
      
      // Guardrail`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/App.tsx', code);
