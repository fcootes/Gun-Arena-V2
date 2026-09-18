const fs = require('fs');
let code = fs.readFileSync('src/botBuilder.ts', 'utf-8');

const oldFaction = `  } else if (mode === 'zombie' && team === 'blue') {
    // Constraint: In Zombie Mode, companion survivor bots are hard-locked to USMC military skins
    faction = 'usmc';
  } else if (team === 'blue') {`;

const newFaction = `  } else if (team === 'blue') {`;

code = code.replace(oldFaction, newFaction);
fs.writeFileSync('src/botBuilder.ts', code);
