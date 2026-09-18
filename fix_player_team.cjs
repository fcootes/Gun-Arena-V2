const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `player.team = (matchConfig.mode === 'extraction' || matchConfig.mode === 'zombie') ? 'blue' : 'player';`;
const replace = `player.team = matchConfig.mode === 'ffa' ? 'player' : 'blue';`;

code = code.replace(target, replace);
fs.writeFileSync('src/App.tsx', code);
