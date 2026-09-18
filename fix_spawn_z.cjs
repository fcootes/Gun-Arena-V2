const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(/player\.pos\.set\(0, terrainHeight\(0, -43\) \+ PLAYER_EYE, -43\);/g, "player.pos.set(0, 1.2, -45);");
fs.writeFileSync('src/App.tsx', code);
