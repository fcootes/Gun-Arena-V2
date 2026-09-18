const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(/('start' \| 'playing' \| 'paused' \| )'ended'/g, "$1'DEATH_SCREEN'");
code = code.replace(/setGameState\('ended'\);/g, "setGameState('DEATH_SCREEN');");
code = code.replace(/gameState === 'ended'/g, "gameState === 'DEATH_SCREEN'");
fs.writeFileSync('src/App.tsx', code);
