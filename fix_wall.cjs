const fs = require('fs');
let code = fs.readFileSync('src/world.ts', 'utf-8');

const oldStr = `addWall(0, -47.5, 13.2, 5); // Back Wall (closes off south)`;
const newStr = `addWall(0, -49.5, 13.2, 5); // Back Wall (closes off south) moved back to prevent spawn overlap`;
code = code.replace(oldStr, newStr);

fs.writeFileSync('src/world.ts', code);
