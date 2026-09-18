const fs = require('fs');
let code = fs.readFileSync('src/world.ts', 'utf-8');

// 1. Terrain block
code = code.replace(/\/\/ Terrain[\s\S]*?worldGroup\.add\(terrainMesh\);\s+registerHittable\(terrainMesh\);/g, `
  // Terrain & Map Generation
  let terrainMesh: THREE.Mesh;

  if (mapId === 'training') {
    const terrainGeo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 110, 110);
    {
      const pos = terrainGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const ly = pos.getY(i);
        pos.setZ(i, terrainHeight(lx, -ly));
      }
      terrainGeo.computeVertexNormals();
      terrainGeo.rotateX(-Math.PI / 2);
    }
    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x537740, roughness: 0.95, metalness: 0 });
    terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.userData = { type: 'terrain' };
    worldGroup.add(terrainMesh);
    registerHittable(terrainMesh);
`);

// 2. The loop that creates trees/rocks
code = code.replace(/for \(let i = 0; i < 28; i\+\+\) \{[\s\S]*?makeRock\(p\.x, p\.z\);\s*\}/g, `
    for (let i = 0; i < 28; i++) {
      const p = randomMapPoint(0);
      makeTree(p.x, p.z);
    }
    for (let i = 0; i < 16; i++) {
      const p = randomMapPoint(0);
      makeRock(p.x, p.z);
    }
`);

// 3. The loop that creates buildings/obstacles
code = code.replace(/const buildingConfigs = \[[\s\S]*?obstacleSpawns\.forEach\(o => addTacticalObstacleCluster\(o\.x, o\.z\)\);/g, `
    const buildingConfigs = [
      { x: 0, z: -14, w: 10, d: 8, h: 4.5, steps: true },
      { x: -18, z: 8, w: 8, d: 12, h: 5.0, steps: true },
      { x: 22, z: 12, w: 12, d: 8, h: 4.0, steps: false },
      { x: -32, z: -24, w: 9, d: 9, h: 6.2, steps: true },
      { x: 30, z: -28, w: 11, d: 7, h: 4.8, steps: false },
      { x: 8, z: 32, w: 10, d: 10, h: 5.5, steps: true }
    ];
    buildingConfigs.forEach(cfg => addWorldBuilding(cfg.x, cfg.z, cfg.w, cfg.d, cfg.h, cfg.steps));

    const obstacleSpawns = [
      { x: -8, z: 4 },
      { x: 10, z: -4 },
      { x: -16, z: -18 },
      { x: 14, z: 20 },
      { x: -24, z: 18 }
    ];
    obstacleSpawns.forEach(o => addTacticalObstacleCluster(o.x, o.z));
  } else {
    // Hangar Map
    const floorGeo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.8, metalness: 0.2 });
    terrainMesh = new THREE.Mesh(floorGeo, floorMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.userData = { type: 'terrain' };
    worldGroup.add(terrainMesh);
    registerHittable(terrainMesh);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.9 });
    const h = 20;
    const w = MAP_HALF * 2;
    const t = 2;
    const walls = [
      { x: 0, z: -MAP_HALF - t/2, w: w, d: t },
      { x: 0, z: MAP_HALF + t/2, w: w, d: t },
      { x: -MAP_HALF - t/2, z: 0, w: t, d: w },
      { x: MAP_HALF + t/2, z: 0, w: t, d: w },
    ];
    walls.forEach(cfg => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, h, cfg.d), wallMat);
      wall.position.set(cfg.x, h/2, cfg.z);
      wall.receiveShadow = true;
      worldGroup.add(wall);
      worldColliders.push({ minX: cfg.x - cfg.w/2, maxX: cfg.x + cfg.w/2, minY: 0, maxY: h, minZ: cfg.z - cfg.d/2, maxZ: cfg.z + cfg.d/2, active: true });
    });

    for (let i = 0; i < 20; i++) {
      const p = randomMapPoint(10);
      addTacticalObstacleCluster(p.x, p.z);
    }
  }
`);

fs.writeFileSync('src/world.ts', code);
