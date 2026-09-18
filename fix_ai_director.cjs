const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/bot\.pos\.set\(\(Math\.random\(\) - 0\.5\) \* 16, 1\.2, spawnZ\);/g, "bot.pos.set((Math.random() - 0.5) * 3.0, 1.2, spawnZ);");

fs.writeFileSync('src/App.tsx', code);
