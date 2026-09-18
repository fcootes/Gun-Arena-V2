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

// 4. Safely duplicate createDoor function to be accessible everywhere in createWorld
const safeCreateDoor = `  function createDoor(x: number, y: number, z: number, dw: number, dh: number, dt: number, buildingGroup: THREE.Group): Door {
    const hingeGroup = new THREE.Group();
    hingeGroup.position.set(x - dw / 2, y, z);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x6e452a, roughness: 0.82, metalness: 0.1 });
    const doorGeo = new THREE.BoxGeometry(dw, dh, dt);
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(dw / 2, dh / 2, 0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    hingeGroup.add(doorMesh);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, dt * 1.5), handleMat);
    handle.position.set(dw - 0.2, dh / 2, 0);
    doorMesh.add(handle);
    buildingGroup.add(hingeGroup);
    const col: WorldCollider = { minX: x - dw / 2, maxX: x + dw / 2, minY: y, maxY: y + dh, minZ: z - dt / 2, maxZ: z + dt / 2, active: true };
    worldColliders.push(col);
    const door: Door = { hinge: hingeGroup, isOpen: false, targetAngle: 0, currentAngle: 0, collider: col, pos: new THREE.Vector3(x, y, z) };
    doors.push(door);
    return door;
  }`;

search = "function makeDestructible(mesh: THREE.Mesh, collider: WorldCollider, colorHex: number): void {";
replace = safeCreateDoor + '\n  ' + search;
code = code.replace(search, replace);

// rename the other createDoor to avoid duplicate
code = code.replace(/function createDoor\(/, 'function oldCreateDoor(');
code = code.replace(/createDoor\(x, y, z \+ d \/ 2/g, 'oldCreateDoor(x, y, z + d / 2');
code = code.replace(/createDoor\(0, 0, /g, 'createDoor(0, 0, '); // restore the ones we just added if replaced
// actually a better way is to just delete the inner one
const oldFuncStart = code.indexOf('  // Doors\n  function oldCreateDoor(');
if (oldFuncStart !== -1) {
    const oldFuncEnd = code.indexOf('    return door;\n  }\n', oldFuncStart) + '    return door;\n  }\n'.length;
    code = code.substring(0, oldFuncStart) + code.substring(oldFuncEnd);
}

fs.writeFileSync('src/world.ts', code);
