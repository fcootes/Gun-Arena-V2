const fs = require('fs');
let code = fs.readFileSync('src/world.ts', 'utf-8');

const doorFuncStart = code.indexOf('  // Doors\n  function createDoor');
const doorFuncEnd = code.indexOf('    return door;\n  }\n', doorFuncStart) + '    return door;\n  }\n'.length;

const doorFuncCode = code.substring(doorFuncStart, doorFuncEnd);
code = code.substring(0, doorFuncStart) + code.substring(doorFuncEnd);

const insertIndex = code.indexOf('  // Terrain & Map Generation');
code = code.substring(0, insertIndex) + doorFuncCode + '\n' + code.substring(insertIndex);

fs.writeFileSync('src/world.ts', code);
