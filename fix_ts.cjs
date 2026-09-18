const fs = require('fs');

// Fix world.ts
let worldCode = fs.readFileSync('src/world.ts', 'utf-8');
worldCode = worldCode.replace(
    "const door: Door = { hinge: hingeGroup, isOpen: false, targetAngle: 0, currentAngle: 0, collider: col, pos: new THREE.Vector3(x, y, z) };",
    "const door: Door = { hingeGroup: hingeGroup, mesh: doorMesh, isOpen: false, targetAngle: 0, currentAngle: 0, collider: col, pos: new THREE.Vector3(x, y, z) };"
);
fs.writeFileSync('src/world.ts', worldCode);

// Fix App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');
appCode = appCode.replace(
    "                let zType = 'walker';",
    "                let zType: 'walker' | 'runner' | 'tank' | 'brute' | 'banshee' | 'bloater' | 'megaboss' = 'walker';"
);
fs.writeFileSync('src/App.tsx', appCode);

