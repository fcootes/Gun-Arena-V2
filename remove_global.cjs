const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const extractionInit = `        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot('red');`;
code = code.replace(extractionInit, `        // AI Director will handle hostile spawns in EXTRACTION.`);

fs.writeFileSync('src/App.tsx', code);
