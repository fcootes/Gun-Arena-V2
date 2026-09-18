const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const isZombieOld = `      const isZombie = (matchConfig.mode === "zombie" && assignedTeam !== "blue");`;
const isZombieNew = `      const isZombie = ((matchConfig.mode === "zombie" || assignedTeam === "zombie") && assignedTeam !== "blue");`;

code = code.replace(isZombieOld, isZombieNew);
fs.writeFileSync('src/App.tsx', code);
