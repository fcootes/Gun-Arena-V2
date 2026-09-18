const fs = require('fs');
let code = fs.readFileSync('src/world.ts', 'utf-8');

const startIdx = code.indexOf('  } else {');
const endIdx = code.indexOf('  return {');

if (startIdx !== -1 && endIdx !== -1) {
  const newMap = `  } else {
    // 5-SECTOR SUBTERRANEAN FACILITY (LINEAR PROGRESSION)
    const h = 2.8; // EXACTLY 2.8m ceiling
    const floorGeo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x22262d, 
      roughness: 0.65, 
      metalness: 0.35 
    });
    terrainMesh = new THREE.Mesh(floorGeo, floorMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.userData = { type: 'terrain' };
    worldGroup.add(terrainMesh);
    registerHittable(terrainMesh);

    const roofGeo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 1, 1);
    roofGeo.rotateX(Math.PI / 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.95 });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.y = h;
    roofMesh.castShadow = false;
    roofMesh.receiveShadow = false;
    worldGroup.add(roofMesh);

    const slabMat = new THREE.MeshStandardMaterial({ color: 0x272c35, roughness: 0.85, metalness: 0.2 });
    
    // Add Wall with precise boundaries and no gaps
    const addWall = (x, z, w, d, mat = slabMat) => {
      const group = new THREE.Group();
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      wallMesh.position.y = h / 2; // EXACTLY 1.4m to span 0 to 2.8m
      wallMesh.receiveShadow = true;
      wallMesh.castShadow = true;
      group.add(wallMesh);
      group.position.set(x, 0, z);
      worldGroup.add(group);
      registerHittable(wallMesh);
      worldColliders.push({
        minX: x - w / 2, maxX: x + w / 2,
        minY: 0, maxY: h,
        minZ: z - d / 2, maxZ: z + d / 2,
        active: true
      });
      return group;
    };

    const addLight = (x, y, z, color, intensity, distance) => {
      const pl = new THREE.PointLight(color, intensity, distance, 1.2);
      pl.position.set(x, y, z);
      pl.castShadow = false;
      worldGroup.add(pl);
      const fix = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 0.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x161a20, emissive: color, emissiveIntensity: 0.7 })
      );
      fix.position.copy(pl.position);
      fix.position.y = h - 0.05;
      worldGroup.add(fix);
    };

    // Linear Map Layout 
    // Sector 1: South Ingress Airlock (z = -45 to -35)
    addWall(-4.1, -40, 5, 12); // Left Wall (corridor 3.2m wide, so walls at x = ±(1.6 + 2.5) = ±4.1)
    addWall(4.1, -40, 5, 12);  // Right Wall
    addWall(0, -47.5, 13.2, 5); // Back Wall (closes off south)
    addLight(0, h - 0.2, -40, 0xff8800, 3.5, 15); // Amber Strobe
    
    // Sector 1 Props
    const boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const boxMat = new THREE.MeshStandardMaterial({color: 0x333333});
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(-1, 0.6, -44);
    worldGroup.add(box);
    worldColliders.push({minX:-1.6, maxX:-0.4, minY:0, maxY:1.2, minZ:-44.6, maxZ:-43.4, active:true});

    // Sector 2: Virology Lab (z = -35 to -15) (Serpentine)
    addWall(-6.1, -25, 9, 20); 
    addWall(6.1, -25, 9, 20); 
    // Glass Partition
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3, roughness: 0.1 });
    addWall(-1.6, -25, 0.2, 6, glassMat); 
    addLight(0, h - 0.2, -25, 0x44ddff, 4.0, 15); // Sterile Cyan

    // Sector 3: Reactor / Cylinder Retrieval (z = -15 to 5)
    addWall(-4.1, -5, 5, 20);
    addWall(4.1, -5, 5, 20);
    // Cylinder Props
    const cylGeo = new THREE.CylinderGeometry(0.6, 0.6, 2.0, 16);
    const cylMat = new THREE.MeshStandardMaterial({color: 0x222222, emissive: 0x00ff00, emissiveIntensity: 0.2});
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.set(1.0, 1.0, -5);
    worldGroup.add(cyl);
    worldColliders.push({minX:0.4, maxX:1.6, minY:0, maxY:2.0, minZ:-5.6, maxZ:-4.4, active:true});
    addLight(0, h - 0.2, -5, 0x44ee99, 4.0, 15); // Toxic Green

    // Sector 4: Cryo Mainframe (z = 5 to 25)
    addWall(-8.1, 15, 13, 20);
    addWall(8.1, 15, 13, 20);
    addLight(0, h - 0.2, 15, 0x55ccff, 4.5, 20); // Cold Cyan
    
    // Cryo Pods
    for(let i=0; i<4; i++) {
      const pod = new THREE.Mesh(cylGeo, cylMat);
      pod.position.set(-4, 1.0, 10 + i*3);
      worldGroup.add(pod);
      worldColliders.push({minX:-4.6, maxX:-3.4, minY:0, maxY:2.0, minZ: 9.4 + i*3, maxZ: 10.6 + i*3, active:true});
    }

    // Sector 5: Evac Vault (z = 25 to 45)
    addWall(-10.1, 35, 17, 20);
    addWall(10.1, 35, 17, 20);
    addWall(0, 46.5, 20.2, 3); // North cap
    addLight(0, h - 0.2, 35, 0xffb355, 5.0, 25); // Daylight / Amber

    // Boss Pit
    const pitGeo = new THREE.BoxGeometry(6, 0.2, 6);
    const pitMat = new THREE.MeshStandardMaterial({color: 0x550000});
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.position.set(0, 0.1, 35);
    worldGroup.add(pit);

    // Outer bounding walls for safety
    addWall(-15, 0, 10, 100);
    addWall(15, 0, 10, 100);

    const labAmbient = new THREE.AmbientLight(0x283442, 1.3);
    worldGroup.add(labAmbient);
  }
`;

  code = code.substring(0, startIdx) + newMap + code.substring(endIdx);
  fs.writeFileSync('src/world.ts', code);
  console.log('Map replaced successfully.');
} else {
  console.log('Could not find start or end indices.');
}
