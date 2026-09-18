const fs = require('fs');
let code = fs.readFileSync('src/world.ts', 'utf-8');

const oldStr = `    // Sector 1 Props
    const boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const boxMat = new THREE.MeshStandardMaterial({color: 0x333333});
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(-1, 0.6, -44);
    worldGroup.add(box);
    worldColliders.push({minX:-1.6, maxX:-0.4, minY:0, maxY:1.2, minZ:-44.6, maxZ:-43.4, active:true});`;

const newStr = `    // Sector 1 Props (Removed box blocking the entrance)`;
code = code.replace(oldStr, newStr);

fs.writeFileSync('src/world.ts', code);
