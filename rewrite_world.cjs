const fs = require('fs');
let code = fs.readFileSync('src/world.ts', 'utf-8');

// 1. Add Doors
let search = "    const labAmbient = new THREE.AmbientLight(0x283442, 1.3);";
let replace = `    // Airlock Doors
    createDoor(0, 0, -35, 3.2, 2.8, 0.2, worldGroup);
    createDoor(0, 0, -15, 3.2, 2.8, 0.2, worldGroup);
    createDoor(0, 0, 5, 3.2, 2.8, 0.2, worldGroup);
    createDoor(0, 0, 25, 3.2, 2.8, 0.2, worldGroup);

    const labAmbient = new THREE.AmbientLight(0x283442, 1.3);`;
code = code.replace(search, replace);

// 2. Add Terminal
search = `    // Sector 4: Cryo Mainframe (z = 5 to 25)
    addWall(-8.1, 15, 13, 20);
    addWall(8.1, 15, 13, 20);
    addLight(0, h - 0.2, 15, 0x55ccff, 4.5, 20); // Cold Cyan
    
    // Cryo Pods`;
replace = `    // Sector 4: Cryo Mainframe (z = 5 to 25)
    addWall(-8.1, 15, 13, 20);
    addWall(8.1, 15, 13, 20);
    addLight(0, h - 0.2, 15, 0x55ccff, 4.5, 20); // Cold Cyan
    
    // Mainframe Terminal
    const termGeo = new THREE.BoxGeometry(2, 1.5, 1);
    const termMat = new THREE.MeshStandardMaterial({color: 0x111111, emissive: 0x0088ff, emissiveIntensity: 0.5});
    const terminal = new THREE.Mesh(termGeo, termMat);
    terminal.position.set(0, 0.75, 15);
    worldGroup.add(terminal);
    worldColliders.push({minX:-1, maxX:1, minY:0, maxY:1.5, minZ:14.5, maxZ:15.5, active:true});

    // Cryo Pods`;
code = code.replace(search, replace);

// 3. Add Elevator
search = `    // Boss Pit
    const pitGeo = new THREE.BoxGeometry(6, 0.2, 6);`;
replace = `    // Evac Elevator Zone
    const evacGeo = new THREE.BoxGeometry(4, 0.1, 4);
    const evacMat = new THREE.MeshStandardMaterial({color: 0x22ff22, emissive: 0x22ff22, emissiveIntensity: 0.4});
    const evacPad = new THREE.Mesh(evacGeo, evacMat);
    evacPad.position.set(0, 0.05, 43);
    worldGroup.add(evacPad);

    // Boss Pit
    const pitGeo = new THREE.BoxGeometry(6, 0.2, 6);`;
code = code.replace(search, replace);

// 4. Move createDoor to WorldManager scope
const doorFuncStart = code.indexOf('  // Doors\n  function createDoor');
const doorFuncEnd = code.indexOf('    return door;\n  }\n', doorFuncStart) + '    return door;\n  }\n'.length;
const doorFuncCode = code.substring(doorFuncStart, doorFuncEnd);

// Remove original
code = code.substring(0, doorFuncStart) + code.substring(doorFuncEnd);

// Insert right after createWorld declaration
const insertTarget = "const activeDebris: Array<{";
const insertIndex = code.indexOf(insertTarget);
code = code.substring(0, insertIndex) + doorFuncCode + '\n  ' + code.substring(insertIndex);

fs.writeFileSync('src/world.ts', code);
