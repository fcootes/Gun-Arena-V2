import * as THREE from 'three';
import { WorldCollider, Door, GroundPickup } from './types';
import { WEAPONS } from './weapons';

export const MAP_HALF = 100;
export let currentWorldMapId: 'training' | 'hangar' = 'training';

export function terrainHeight(x: number, z: number): number {
  if (currentWorldMapId === 'hangar') return 0;
  return (
    Math.sin(x * 0.024) * 3.8 +
    Math.cos(z * 0.026) * 3.4 +
    Math.sin((x + z) * 0.016) * 2.2 +
    Math.cos(x * 0.045 - z * 0.035) * 1.1
  );
}

export function randomMapPoint(minDistFromCenter = 0): { x: number; z: number } {
  if (currentWorldMapId === 'hangar') {
    // 5 Sequential Linear Sectors along -Z
    const sectors = [
      { minX: -5, maxX: 5, minZ: -8, maxZ: 8 },         // Sector 1: Ingress (Z ~ 0)
      { minX: -8, maxX: 8, minZ: -48, maxZ: -32 },     // Sector 2: Virology (Z ~ -40)
      { minX: -10, maxX: 10, minZ: -88, maxZ: -72 },   // Sector 3: Reactor (Z ~ -80)
      { minX: -10, maxX: 10, minZ: -128, maxZ: -112 }, // Sector 4: Mainframe (Z ~ -120)
      { minX: -12, maxX: 12, minZ: -168, maxZ: -152 }, // Sector 5: Evac Vault (Z ~ -160)
      { minX: -1.2, maxX: 1.2, minZ: -28, maxZ: -12 }, // Corridor 1-2
      { minX: -1.2, maxX: 1.2, minZ: -68, maxZ: -52 }, // Corridor 2-3
      { minX: -1.2, maxX: 1.2, minZ: -108, maxZ: -92 }, // Corridor 3-4
      { minX: -1.2, maxX: 1.2, minZ: -148, maxZ: -132 }, // Corridor 4-5
    ];
    const s = sectors[Math.floor(Math.random() * sectors.length)];
    const x = s.minX + Math.random() * (s.maxX - s.minX);
    const z = s.minZ + Math.random() * (s.maxZ - s.minZ);
    return { x, z };
  }
  let x: number, z: number, d: number;
  do {
    x = (Math.random() * 2 - 1) * MAP_HALF * 0.88;
    z = (Math.random() * 2 - 1) * MAP_HALF * 0.88;
    d = Math.hypot(x, z);
  } while (minDistFromCenter > 0 && d < minDistFromCenter);
  return { x, z };
}

export interface ObjectivePropInstance {
  group: THREE.Group;
  interactNode: THREE.Vector3;
  type: 'mainframe' | 'cryo_pod' | 'bio_cylinder' | 'evac_pad';
  boundingMesh?: THREE.Mesh;
  canisterGroup?: THREE.Group;
  update?: (dt: number, time: number) => void;
  dispose: () => void;
}

export interface WorldManager {
  terrainMesh: THREE.Mesh;
  worldColliders: WorldCollider[];
  doors: Door[];
  hittableObjects: THREE.Object3D[];
  groundPickups: GroundPickup[];
  structures: { center: THREE.Vector3 }[];
  bioCylinderGroup?: THREE.Group;
  mainframeConsoleGroup?: THREE.Group;
  evacPadMesh?: THREE.Mesh;
  armoryDoor?: Door;
  armoryCrateGroup?: THREE.Group;
  armoryKeypadMesh?: THREE.Mesh;
  breakerAlphaGroup?: THREE.Group;
  breakerBetaGroup?: THREE.Group;
  breakerAlphaLight?: THREE.PointLight;
  breakerBetaLight?: THREE.PointLight;
  volatileReceptacleGroup?: THREE.Group;
  volatileReceptacleLight?: THREE.PointLight;
  sectorCenters: Record<number, THREE.Vector3>;
  registerHittable: (mesh: THREE.Object3D) => void;
  unregisterHittable: (mesh: THREE.Object3D) => void;
  damageEnvironmentalBlock: (object: THREE.Object3D, degradationAmount: number, hitPoint?: THREE.Vector3) => boolean;
  updateDebris: (dt: number) => void;
  createGroundPickup: (x: number, z: number, weaponTypeIndex: number, ammoAmount: number) => GroundPickup;
  collectPickup: (item: GroundPickup, onAcquire: (msg: string) => void, weaponStates: { count?: number; reserve?: number }[]) => void;
  updateDoors: (dt: number) => void;
  moveEntityWithCollision: (pos: THREE.Vector3, vel: THREE.Vector3, radius: number, footY: number, headY: number, dt: number) => void;
  getHighestSurface: (x: number, z: number, footY: number) => number;
  spawnObjectiveProp: (faction: 'usmc' | 'apex', customPos?: THREE.Vector3) => ObjectivePropInstance;
  spawnDeployableCover: (pos: THREE.Vector3, rotY: number) => THREE.Group;
  hangarCorridorNodes: { mainframe: THREE.Vector3; cryo: THREE.Vector3; evac: THREE.Vector3; center: THREE.Vector3 };
  dispose: () => void;
}

export function createWorld(scene: THREE.Scene, mapId: 'training' | 'hangar' = 'training'): WorldManager {
  currentWorldMapId = mapId;
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const worldColliders: WorldCollider[] = [];
  const doors: Door[] = [];
  const hittableObjects: THREE.Object3D[] = [];
  const groundPickups: GroundPickup[] = [];
  const structures: { center: THREE.Vector3 }[] = [];
  const activeDebris: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    rotVel: THREE.Vector3;
    life: number;
  }> = [];

  let bioCylinderGroup: THREE.Group | undefined;
  let mainframeConsoleGroup: THREE.Group | undefined;
  let evacPadMesh: THREE.Mesh | undefined;
  let armoryDoor: Door | undefined;
  let armoryCrateGroup: THREE.Group | undefined;
  let armoryKeypadMesh: THREE.Mesh | undefined;
  let breakerAlphaGroup: THREE.Group | undefined;
  let breakerBetaGroup: THREE.Group | undefined;
  let breakerAlphaLight: THREE.PointLight | undefined;
  let breakerBetaLight: THREE.PointLight | undefined;
  let volatileReceptacleGroup: THREE.Group | undefined;
  let volatileReceptacleLight: THREE.PointLight | undefined;

  const sectorCenters: Record<number, THREE.Vector3> = {
    1: new THREE.Vector3(0, 1.2, 0),
    2: new THREE.Vector3(0, 1.2, -40),
    3: new THREE.Vector3(0, 1.2, -80),
    4: new THREE.Vector3(0, 1.2, -120),
    5: new THREE.Vector3(0, 1.2, -160),
  };

  function createDoor(
    x: number,
    y: number,
    z: number,
    dw: number,
    dh: number,
    dt: number,
    buildingGroup: THREE.Group,
    axis: 'x' | 'z' = 'x',
    isArmory = false
  ): Door {
    const hingeGroup = new THREE.Group();
    if (axis === 'x') {
      hingeGroup.position.set(x - dw / 2, y, z);
    } else {
      hingeGroup.position.set(x, y, z - dw / 2);
    }
    const doorMat = new THREE.MeshStandardMaterial({
      color: isArmory ? 0x242d38 : 0x3a4450,
      metalness: 0.85,
      roughness: 0.25
    });
    const doorGeo = axis === 'x' ? new THREE.BoxGeometry(dw, dh, dt) : new THREE.BoxGeometry(dt, dh, dw);
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    if (axis === 'x') {
      doorMesh.position.set(dw / 2, dh / 2, 0);
    } else {
      doorMesh.position.set(0, dh / 2, dw / 2);
    }
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    hingeGroup.add(doorMesh);

    // Hazard Stripes on Door
    const stripeGeo = axis === 'x'
      ? new THREE.BoxGeometry(dw * 0.8, 0.35, dt + 0.02)
      : new THREE.BoxGeometry(dt + 0.02, 0.35, dw * 0.8);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: isArmory ? 0xffbb00 : 0xf5a623,
      emissive: isArmory ? 0x553800 : 0x3d2000,
      roughness: 0.5
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    if (axis === 'x') {
      stripe.position.set(dw / 2, dh / 2, 0);
    } else {
      stripe.position.set(0, dh / 2, dw / 2);
    }
    hingeGroup.add(stripe);

    const handleMat = new THREE.MeshStandardMaterial({
      color: isArmory ? 0xff9900 : 0x2de2e6,
      emissive: isArmory ? 0x663300 : 0x005577,
      metalness: 0.9,
      roughness: 0.2
    });
    const handle = new THREE.Mesh(
      axis === 'x'
        ? new THREE.BoxGeometry(0.12, 0.4, dt * 1.5)
        : new THREE.BoxGeometry(dt * 1.5, 0.4, 0.12),
      handleMat
    );
    if (axis === 'x') {
      handle.position.set(dw - 0.25, dh / 2, 0);
    } else {
      handle.position.set(0, dh / 2, dw - 0.25);
    }
    doorMesh.add(handle);

    buildingGroup.add(hingeGroup);

    const col: WorldCollider = {
      minX: axis === 'x' ? x - dw / 2 : x - dt / 2,
      maxX: axis === 'x' ? x + dw / 2 : x + dt / 2,
      minY: y,
      maxY: y + dh,
      minZ: axis === 'x' ? z - dt / 2 : z - dw / 2,
      maxZ: axis === 'x' ? z + dt / 2 : z + dw / 2,
      active: true,
      isDoor: true
    };
    worldColliders.push(col);

    const door: Door = {
      hingeGroup,
      mesh: doorMesh,
      isOpen: false,
      targetAngle: 0,
      currentAngle: 0,
      collider: col,
      pos: new THREE.Vector3(x, y, z),
      isArmory
    };
    doors.push(door);
    return door;
  }

  function makeDestructible(mesh: THREE.Mesh, collider: WorldCollider, colorHex: number): void {
    mesh.userData = {
      type: 'building',
      destructible: true,
      degradation: 0,
      collider,
      blockColor: colorHex
    };
  }

  function damageEnvironmentalBlock(object: THREE.Object3D, degradationAmount: number, hitPoint?: THREE.Vector3): boolean {
    if (!object || !object.userData || !object.userData.destructible || object.userData.destroyed) {
      return false;
    }
    object.userData.degradation = (object.userData.degradation || 0) + degradationAmount;
    if (object instanceof THREE.Mesh && object.material) {
      const mat = object.material as THREE.MeshStandardMaterial;
      if (mat && mat.color) {
        mat.color.multiplyScalar(0.95);
      }
    }
    if (object.userData.degradation >= 100) {
      object.userData.destroyed = true;
      if (object.userData.collider) {
        object.userData.collider.active = false;
      }
      unregisterHittable(object);
      object.visible = false;
      const bColor = object.userData.blockColor || 0x6a6458;
      const origin = hitPoint ? hitPoint.clone() : object.position.clone();
      for (let i = 0; i < 7; i++) {
        const s = 0.15 + Math.random() * 0.25;
        const dMesh = new THREE.Mesh(
          new THREE.BoxGeometry(s, s, s),
          new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.9 })
        );
        dMesh.position.copy(origin).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8
        ));
        worldGroup.add(dMesh);
        activeDebris.push({
          mesh: dMesh,
          vel: new THREE.Vector3((Math.random() - 0.5) * 4.5, Math.random() * 3.5 + 1.0, (Math.random() - 0.5) * 4.5),
          rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
          life: 1.8 + Math.random() * 0.8
        });
      }
      return true;
    }
    return false;
  }

  function updateDebris(dt: number): void {
    for (let i = activeDebris.length - 1; i >= 0; i--) {
      const d = activeDebris[i];
      d.life -= dt;
      if (d.life <= 0) {
        worldGroup.remove(d.mesh);
        d.mesh.geometry.dispose();
        (d.mesh.material as THREE.Material).dispose();
        activeDebris.splice(i, 1);
        continue;
      }
      d.vel.y -= 14.0 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      const floorY = terrainHeight(d.mesh.position.x, d.mesh.position.z);
      if (d.mesh.position.y <= floorY + 0.1) {
        d.mesh.position.y = floorY + 0.1;
        d.vel.y = -d.vel.y * 0.35;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
      }
    }
  }

  function registerHittable(mesh: THREE.Object3D): void {
    if (hittableObjects.indexOf(mesh) === -1) {
      hittableObjects.push(mesh);
    }
  }

  function unregisterHittable(mesh: THREE.Object3D): void {
    const idx = hittableObjects.indexOf(mesh);
    if (idx !== -1) {
      hittableObjects.splice(idx, 1);
    }
  }

  let terrainMesh: THREE.Mesh;

  if (mapId === 'training') {
    // Standard outdoor training map
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

    // Simple decorative building in training
    const bGeo = new THREE.BoxGeometry(10, 4.5, 8);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x6e685e, roughness: 0.85 });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.position.set(0, 2.25, -14);
    worldGroup.add(bMesh);
    worldColliders.push({ minX: -5, maxX: 5, minY: 0, maxY: 4.5, minZ: -18, maxZ: -10, active: true });
    structures.push({ center: new THREE.Vector3(0, 0, -14) });

  } else {
    // =========================================================================
    // SUBTERRANEAN EXTRACTION: STRICT LINEAR SEQUENTIAL GAUNTLET
    // Sector 1: Ingress Airlock (Z = 0)
    // Sector 2: Virology Labs (Z = -40)
    // Sector 3: Bio-Reactor Core & Bio-Cylinder (Z = -80)
    // Sector 4: Cryo Mainframe Terminal (Z = -120)
    // Sector 5: Evac Vault & Mega-Boss Arena (Z = -160)
    // Corridors: Exactly 3.2m wide (-1.6 <= X <= 1.6)
    // Ceilings: 2.8m (Reactor & Boss Vault: 3.4m)
    // =========================================================================

    const defaultCeilH = 2.8;

    // Continuous Subterranean Floor (from Z = +15 down to Z = -185)
    const floorGeo = new THREE.PlaneGeometry(60, 210, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x181c22,
      roughness: 0.75,
      metalness: 0.3
    });
    terrainMesh = new THREE.Mesh(floorGeo, floorMat);
    terrainMesh.position.set(0, 0, -85);
    terrainMesh.receiveShadow = true;
    terrainMesh.userData = { type: 'terrain' };
    worldGroup.add(terrainMesh);
    registerHittable(terrainMesh);

    // Grid / Hazard Striping Decals on Floor
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x242e38, transparent: true, opacity: 0.35 });
    const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 200), gridMat);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.set(0, 0.02, -85);
    worldGroup.add(gridMesh);

    // Wall Materials
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222730, roughness: 0.85, metalness: 0.25 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.4, metalness: 0.8 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.95 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, emissive: 0x3d2000, roughness: 0.5 });

    const addWall = (x: number, z: number, w: number, d: number, h: number = defaultCeilH, stripe = false) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.y = h / 2;
      m.receiveShadow = true;
      m.castShadow = true;
      g.add(m);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.15, d + 0.05), capMat);
      cap.position.y = h + 0.075;
      g.add(cap);

      if (stripe) {
        const sw = w >= d ? Math.min(w * 0.8, 6.0) : 0.4;
        const sd = w >= d ? 0.4 : Math.min(d * 0.8, 6.0);
        const sm = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.3, sd), hazardMat);
        sm.position.y = 1.1;
        g.add(sm);
      }

      g.position.set(x, 0, z);
      worldGroup.add(g);
      registerHittable(m);

      worldColliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: 0,
        maxY: h,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        active: true
      });
    };

    const addCeiling = (x: number, z: number, w: number, d: number, h: number = defaultCeilH) => {
      const cMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilingMat);
      cMesh.rotation.x = Math.PI / 2;
      cMesh.position.set(x, h, z);
      worldGroup.add(cMesh);
    };

    const addLight = (x: number, y: number, z: number, color: number, intensity: number, distance: number) => {
      const pl = new THREE.PointLight(color, intensity, distance, 1.4);
      pl.position.set(x, y, z);
      worldGroup.add(pl);

      const fixture = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 0.15, 8),
        new THREE.MeshStandardMaterial({ color: 0x11151b, emissive: color, emissiveIntensity: 0.6 })
      );
      fixture.position.set(x, y + 0.05, z);
      worldGroup.add(fixture);
    };

    // Ambient Underground Tone
    const ambient = new THREE.AmbientLight(0x202832, 1.6);
    worldGroup.add(ambient);

    // =========================================================================
    // 1. SECTOR 1: INGRESS AIRLOCK (Center: Z = 0, X in [-7, 7], Z in [-10, 10])
    // =========================================================================
    structures.push({ center: sectorCenters[1] });
    addCeiling(0, 0, 14, 20, defaultCeilH);
    // South Blast Wall (Z = +10, Solid Entry Gate)
    addWall(0, 10, 14, 1.2, defaultCeilH, true);
    // East and West Boundaries
    addWall(-7, 0, 1.2, 20, defaultCeilH);
    addWall(7, 0, 1.2, 20, defaultCeilH);
    // North Wall with 3.2m opening (X: -1.6 to 1.6)
    addWall(-4.3, -10, 5.4, 1.2, defaultCeilH);
    addWall(4.3, -10, 5.4, 1.2, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, 0, 0xffaa44, 3.5, 16); // Amber Warning

    // Corridor 1 -> 2 (Z: -10 to -30, Width 3.2m: X in [-1.6, 1.6])
    addWall(-2.2, -20, 1.2, 20, defaultCeilH);
    addWall(2.2, -20, 1.2, 20, defaultCeilH);
    addCeiling(0, -20, 3.2, 20, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -20, 0xff7722, 2.8, 12);
    // Door 1: Airlock Portal at Z = -20
    createDoor(0, 0, -20, 3.2, defaultCeilH, 0.25, worldGroup);

    // =========================================================================
    // 2. SECTOR 2: VIROLOGY LABS (Center: Z = -40, X in [-10, 10], Z in [-50, -30])
    // =========================================================================
    structures.push({ center: sectorCenters[2] });
    addCeiling(0, -40, 20, 20, defaultCeilH);
    // South Wall with 3.2m entrance
    addWall(-5.8, -30, 8.4, 1.2, defaultCeilH);
    addWall(5.8, -30, 8.4, 1.2, defaultCeilH);
    // East and West Boundaries
    addWall(-10, -40, 1.2, 20, defaultCeilH);
    addWall(10, -40, 1.2, 20, defaultCeilH);
    // North Wall with 3.2m exit
    addWall(-5.8, -50, 8.4, 1.2, defaultCeilH);
    addWall(5.8, -50, 8.4, 1.2, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -40, 0x44ddff, 4.5, 22); // Cold Sterile Cyan
    addLight(-6, defaultCeilH - 0.2, -40, 0x22aacc, 2.5, 14);
    addLight(6, defaultCeilH - 0.2, -40, 0x22aacc, 2.5, 14);

    // Lab benches / centrifuge tables in Sector 2
    const labBenchMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.6 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(4, 1.0, 1.5), labBenchMat);
    b1.position.set(-5, 0.5, -38);
    worldGroup.add(b1);
    worldColliders.push({ minX: -7, maxX: -3, minY: 0, maxY: 1.0, minZ: -38.75, maxZ: -37.25, active: true });

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(4, 1.0, 1.5), labBenchMat);
    b2.position.set(5, 0.5, -42);
    worldGroup.add(b2);
    worldColliders.push({ minX: 3, maxX: 7, minY: 0, maxY: 1.0, minZ: -42.75, maxZ: -41.25, active: true });

    // Corridor 2 -> 3 (Z: -50 to -70, Width 3.2m)
    addWall(-2.2, -60, 1.2, 20, defaultCeilH);
    addWall(2.2, -60, 1.2, 20, defaultCeilH);
    addCeiling(0, -60, 3.2, 20, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -60, 0x22ff88, 2.5, 12);
    // Door 2: Airlock Portal at Z = -60
    createDoor(0, 0, -60, 3.2, defaultCeilH, 0.25, worldGroup);

    // =========================================================================
    // 3. SECTOR 3: BIO-REACTOR & BIO-CYLINDER (Center: Z = -80, X in [-12, 12], Z in [-90, -70])
    // =========================================================================
    const reactorCeilH = 3.4;
    structures.push({ center: sectorCenters[3] });
    addCeiling(0, -80, 24, 20, reactorCeilH);
    // South Wall with 3.2m entrance
    addWall(-6.8, -70, 10.4, 1.2, reactorCeilH);
    addWall(6.8, -70, 10.4, 1.2, reactorCeilH);
    // East and West Boundaries
    addWall(-12, -80, 1.2, 20, reactorCeilH);
    // East Wall with 3.0m security armory doorway opening (Z: -78.5 to -81.5)
    addWall(12, -74.25, 1.2, 8.5, reactorCeilH);
    addWall(12, -85.75, 1.2, 8.5, reactorCeilH);
    // North Wall with 3.2m exit
    addWall(-6.8, -90, 10.4, 1.2, reactorCeilH);
    addWall(6.8, -90, 10.4, 1.2, reactorCeilH);
    addLight(0, reactorCeilH - 0.2, -80, 0x00ff66, 5.5, 26); // Intense Bio-Hazard Toxic Green

    // OPTIONAL LOCKED SECURITY ARMORY SIDE-ROOM (6x6m: X in [12, 18], Z in [-83, -77])
    addCeiling(15, -80, 6, 6, reactorCeilH);
    const armoryFloorGeo = new THREE.PlaneGeometry(6, 6);
    armoryFloorGeo.rotateX(-Math.PI / 2);
    const armoryFloorMesh = new THREE.Mesh(
      armoryFloorGeo,
      new THREE.MeshStandardMaterial({ color: 0x161d26, roughness: 0.7, metalness: 0.4 })
    );
    armoryFloorMesh.position.set(15, 0.01, -80);
    worldGroup.add(armoryFloorMesh);

    // Armory Outer Perimeter Walls
    addWall(15, -77, 6, 1.2, reactorCeilH); // North Wall
    addWall(15, -83, 6, 1.2, reactorCeilH); // South Wall
    addWall(18, -80, 1.2, 6, reactorCeilH); // East Rear Blast Wall
    // Entrance corner return stubs connecting to Sector 3 boundary
    addWall(12, -77.75, 1.2, 1.5, reactorCeilH);
    addWall(12, -82.25, 1.2, 1.5, reactorCeilH);

    // Warm Amber Security Strobe
    addLight(15, reactorCeilH - 0.2, -80, 0xff9900, 4.2, 15);
    addLight(13, 1.8, -80, 0xff6600, 2.8, 8);

    // Armory Keycard Access Panel next to the door (X = 11.85, Y = 1.3, Z = -78.3)
    const keypadG = new THREE.Group();
    keypadG.position.set(11.85, 1.3, -78.3);
    const keypadBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.35, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x0f141c, metalness: 0.8, roughness: 0.3 })
    );
    keypadG.add(keypadBox);
    const keypadScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.14, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1111, emissiveIntensity: 1.4 })
    );
    keypadScreen.position.y = 0.05;
    keypadG.add(keypadScreen);
    worldGroup.add(keypadG);
    armoryKeypadMesh = keypadScreen;

    // Locked Armory Door (spans along Z axis at X = 12, Z = -80)
    armoryDoor = createDoor(12, 0, -80, 3.0, reactorCeilH, 0.25, worldGroup, 'z', true);

    // High-Tier Armory Supply Munitions Crate at (16.2, 0, -80)
    const crateG = new THREE.Group();
    crateG.position.set(16.2, 0, -80);
    const crateBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.8, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x1f3022, roughness: 0.5, metalness: 0.6 })
    );
    crateBody.position.y = 0.4;
    crateG.add(crateBody);
    const crateLid = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.15, 1.05),
      new THREE.MeshStandardMaterial({ color: 0x2d4632, roughness: 0.4, metalness: 0.7 })
    );
    crateLid.position.y = 0.85;
    crateG.add(crateLid);
    const crateLockGlow = new THREE.PointLight(0x00e5ff, 2.5, 6, 1.5);
    crateLockGlow.position.set(0, 0.9, 0);
    crateG.add(crateLockGlow);
    worldGroup.add(crateG);
    worldColliders.push({ minX: 15.3, maxX: 17.1, minY: 0, maxY: 1.2, minZ: -80.6, maxZ: -79.4, active: true });
    armoryCrateGroup = crateG;

    // Reactor Core Pedestal at (0, 0, -80)
    const pedGeo = new THREE.CylinderGeometry(1.4, 1.7, 0.8, 16);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1b2028, metalness: 0.8, roughness: 0.3 });
    const pedMesh = new THREE.Mesh(pedGeo, pedMat);
    pedMesh.position.set(0, 0.4, -80);
    worldGroup.add(pedMesh);
    worldColliders.push({ minX: -1.5, maxX: 1.5, minY: 0, maxY: 0.8, minZ: -81.5, maxZ: -78.5, active: true });

    // THE PROTOTYPE BIO-CYLINDER (USMC Primary Objective Asset)
    const cylinderG = new THREE.Group();
    cylinderG.position.set(0, 1.2, -80);
    // Outer glass canister
    const glassGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.65, 16);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.2
    });
    const canister = new THREE.Mesh(glassGeo, glassMat);
    cylinderG.add(canister);
    // Top & bottom steel caps
    const capGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16);
    const capMat2 = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const topCap = new THREE.Mesh(capGeo, capMat2);
    topCap.position.y = 0.33;
    const botCap = new THREE.Mesh(capGeo, capMat2);
    botCap.position.y = -0.33;
    cylinderG.add(topCap, botCap);
    // Pulsing Point Light attached to Cylinder
    const cylLight = new THREE.PointLight(0x00ff66, 3.0, 6, 1.5);
    cylinderG.add(cylLight);
    worldGroup.add(cylinderG);
    bioCylinderGroup = cylinderG;

    // Corridor 3 -> 4 (Z: -90 to -110, Width 3.2m)
    addWall(-2.2, -100, 1.2, 20, defaultCeilH);
    addWall(2.2, -100, 1.2, 20, defaultCeilH);
    addCeiling(0, -100, 3.2, 20, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -100, 0x33bbff, 2.5, 12);
    // Door 3: Airlock Portal at Z = -100
    createDoor(0, 0, -100, 3.2, defaultCeilH, 0.25, worldGroup);

    // =========================================================================
    // 4. SECTOR 4: CRYO MAINFRAME (Center: Z = -120, X in [-12, 12], Z in [-130, -110])
    // =========================================================================
    structures.push({ center: sectorCenters[4] });
    addCeiling(0, -120, 24, 20, defaultCeilH);
    // South Wall with 3.2m entrance
    addWall(-6.8, -110, 10.4, 1.2, defaultCeilH);
    addWall(6.8, -110, 10.4, 1.2, defaultCeilH);
    // East and West Boundaries
    addWall(-12, -120, 1.2, 20, defaultCeilH);
    addWall(12, -120, 1.2, 20, defaultCeilH);
    // North Wall with 3.2m exit
    addWall(-6.8, -130, 10.4, 1.2, defaultCeilH);
    addWall(6.8, -130, 10.4, 1.2, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -120, 0x0099ff, 4.8, 24); // Cold Ice Blue Data Center

    // Cryo Pods along walls
    const podGeo = new THREE.BoxGeometry(1.2, 2.2, 1.0);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0x0088cc, emissiveIntensity: 0.35 });
    for (let zOffset = -126; zOffset <= -114; zOffset += 4) {
      const pLeft = new THREE.Mesh(podGeo, podMat);
      pLeft.position.set(-10.5, 1.1, zOffset);
      worldGroup.add(pLeft);
      worldColliders.push({ minX: -11.2, maxX: -9.8, minY: 0, maxY: 2.2, minZ: zOffset - 0.6, maxZ: zOffset + 0.6, active: true });

      const pRight = new THREE.Mesh(podGeo, podMat);
      pRight.position.set(10.5, 1.1, zOffset);
      worldGroup.add(pRight);
      worldColliders.push({ minX: 9.8, maxX: 11.2, minY: 0, maxY: 2.2, minZ: zOffset - 0.6, maxZ: zOffset + 0.6, active: true });
    }

    // THE CENTRAL MAINFRAME TERMINAL CONSOLE (Rogue Mercenaries Objective Entity)
    const consoleG = new THREE.Group();
    consoleG.position.set(0, 0, -120);
    // Heavy Server Base
    const sBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.6, metalness: 0.8 })
    );
    sBase.position.y = 0.8;
    consoleG.add(sBase);
    // Holographic Display Screens
    const screenMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.9, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0x0a141e,
        emissive: 0x2de2e6,
        emissiveIntensity: 0.9,
        roughness: 0.1
      })
    );
    screenMesh.position.set(0, 1.7, 0.5);
    screenMesh.rotation.x = -0.2;
    consoleG.add(screenMesh);
    // Pulsing Amber / Cyan Status Light
    const termLight = new THREE.PointLight(0x2de2e6, 3.2, 8, 1.4);
    termLight.position.set(0, 2.0, 0.4);
    consoleG.add(termLight);
    worldGroup.add(consoleG);
    worldColliders.push({ minX: -1.3, maxX: 1.3, minY: 0, maxY: 2.2, minZ: -121, maxZ: -119, active: true });
    mainframeConsoleGroup = consoleG;

    // DYNAMIC OBJECTIVE PROPS (REACTOR OVERRIDE - CIRCUIT BREAKERS)
    // Circuit Breaker Alpha on West Wall (X = -11.35, Y = 1.3, Z = -115)
    const bAlphaG = new THREE.Group();
    bAlphaG.position.set(-11.35, 1.3, -115);
    const bPanelA = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x181e26, metalness: 0.8, roughness: 0.3 })
    );
    bAlphaG.add(bPanelA);
    const bLightA = new THREE.PointLight(0xff2222, 2.5, 5, 1.5);
    bLightA.position.set(0.18, 0.22, 0);
    bAlphaG.add(bLightA);
    worldGroup.add(bAlphaG);
    breakerAlphaGroup = bAlphaG;
    breakerAlphaLight = bLightA;

    // Circuit Breaker Beta on East Wall (X = 11.35, Y = 1.3, Z = -125)
    const bBetaG = new THREE.Group();
    bBetaG.position.set(11.35, 1.3, -125);
    const bPanelB = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x181e26, metalness: 0.8, roughness: 0.3 })
    );
    bBetaG.add(bPanelB);
    const bLightB = new THREE.PointLight(0xff2222, 2.5, 5, 1.5);
    bLightB.position.set(-0.18, 0.22, 0);
    bBetaG.add(bLightB);
    worldGroup.add(bBetaG);
    breakerBetaGroup = bBetaG;
    breakerBetaLight = bLightB;

    // Corridor 4 -> 5 (Z: -130 to -150, Width 3.2m)
    addWall(-2.2, -140, 1.2, 20, defaultCeilH);
    addWall(2.2, -140, 1.2, 20, defaultCeilH);
    addCeiling(0, -140, 3.2, 20, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -140, 0xff3333, 3.0, 14); // Red Alarm Strobe
    // Door 4: Airlock Portal at Z = -140
    createDoor(0, 0, -140, 3.2, defaultCeilH, 0.25, worldGroup);

    // =========================================================================
    // 5. SECTOR 5: EVAC VAULT & BOSS ARENA (Center: Z = -160, X in [-15, 15], Z in [-175, -150])
    // =========================================================================
    const arenaCeilH = 3.6;
    structures.push({ center: sectorCenters[5] });
    addCeiling(0, -162.5, 30, 25, arenaCeilH);
    // South Wall with 3.2m entrance
    addWall(-8.3, -150, 13.4, 1.2, arenaCeilH);
    addWall(8.3, -150, 13.4, 1.2, arenaCeilH);
    // East and West Arena Walls
    addWall(-15, -162.5, 1.2, 25, arenaCeilH);
    addWall(15, -162.5, 1.2, 25, arenaCeilH);
    // North Solid Vault Back Wall (Z = -175)
    addWall(0, -175, 30, 1.2, arenaCeilH, true);
    // Red Alert Pulsing Flashes in Arena
    addLight(0, arenaCeilH - 0.3, -160, 0xff2222, 5.0, 30);
    addLight(-10, arenaCeilH - 0.3, -160, 0xff5533, 3.5, 20);
    addLight(10, arenaCeilH - 0.3, -160, 0xff5533, 3.5, 20);

    // DECONTAMINATION RECEPTACLE VAULT (Sector 5 at (0, 0, -155))
    const recepG = new THREE.Group();
    recepG.position.set(0, 0, -155);
    const recepBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.0, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x1f2e24, metalness: 0.85, roughness: 0.25 })
    );
    recepBase.position.y = 0.45;
    recepG.add(recepBase);
    const recepGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x004422, transparent: true, opacity: 0.75, roughness: 0.1 })
    );
    recepGlass.position.y = 1.3;
    recepG.add(recepGlass);
    const recepLight = new THREE.PointLight(0xffbb00, 3.0, 7, 1.4);
    recepLight.position.set(0, 1.4, 0);
    recepG.add(recepLight);
    worldGroup.add(recepG);
    worldColliders.push({ minX: -0.9, maxX: 0.9, minY: 0, maxY: 1.8, minZ: -155.9, maxZ: -154.1, active: true });
    volatileReceptacleGroup = recepG;
    volatileReceptacleLight = recepLight;

    // EVAC ELEVATOR PAD (Extraction Landing Zone at Z = -170)
    const padGeo = new THREE.BoxGeometry(5.0, 0.1, 5.0);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x052e16,
      emissive: 0x00ff66,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.8
    });
    const evacPad = new THREE.Mesh(padGeo, padMat);
    evacPad.position.set(0, 0.05, -170);
    worldGroup.add(evacPad);

    // Hazard Stripes framing the Evac Pad
    const padBorderGeo = new THREE.BoxGeometry(5.4, 0.12, 5.4);
    const padBorderMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.5 });
    const padBorder = new THREE.Mesh(padBorderGeo, padBorderMat);
    padBorder.position.set(0, 0.04, -170);
    worldGroup.add(padBorder);

    // Overhead Extraction Spotlight
    const evacLight = new THREE.PointLight(0x00ff66, 6.0, 15, 1.2);
    evacLight.position.set(0, arenaCeilH - 0.2, -170);
    worldGroup.add(evacLight);
    evacPadMesh = evacPad;
  }

  // Ground Pickups Function
  function createGroundPickup(x: number, z: number, weaponTypeIndex: number, ammoAmount: number): GroundPickup {
    const g = new THREE.Group();
    const y = terrainHeight(x, z) + 0.55;
    let geo: THREE.BufferGeometry;
    let mat: THREE.MeshStandardMaterial;

    if (weaponTypeIndex === 0) {
      geo = new THREE.BoxGeometry(0.12, 0.15, 0.7);
      mat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.6, roughness: 0.4 });
    } else if (weaponTypeIndex === 1) {
      geo = new THREE.BoxGeometry(0.12, 0.18, 0.85);
      mat = new THREE.MeshStandardMaterial({ color: 0x553322, metalness: 0.4, roughness: 0.6 });
    } else if (weaponTypeIndex === 2) {
      geo = new THREE.BoxGeometry(0.1, 0.14, 1.1);
      mat = new THREE.MeshStandardMaterial({ color: 0x223322, metalness: 0.7, roughness: 0.3 });
    } else if (weaponTypeIndex === 3) {
      geo = new THREE.BoxGeometry(0.09, 0.22, 0.36);
      mat = new THREE.MeshStandardMaterial({ color: 0x2e3238, metalness: 0.75, roughness: 0.4 });
    } else if (weaponTypeIndex === 4) {
      geo = new THREE.BoxGeometry(0.09, 0.24, 0.45);
      mat = new THREE.MeshStandardMaterial({ color: 0xd66820, metalness: 0.5, roughness: 0.4 });
    } else if (weaponTypeIndex === 5) {
      geo = new THREE.BoxGeometry(0.14, 0.25, 0.95);
      mat = new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.8, roughness: 0.4 });
    } else if (weaponTypeIndex === 6) {
      geo = new THREE.BoxGeometry(0.11, 0.22, 0.78);
      mat = new THREE.MeshStandardMaterial({ color: 0x2a3644, metalness: 0.7, roughness: 0.35 });
    } else if (weaponTypeIndex === 7) {
      geo = new THREE.BoxGeometry(0.12, 0.20, 0.68);
      mat = new THREE.MeshStandardMaterial({ color: 0x7b2cbf, emissive: 0x240046, metalness: 0.85, roughness: 0.25 });
    } else if (weaponTypeIndex === 8) {
      geo = new THREE.SphereGeometry(0.14, 10, 8);
      mat = new THREE.MeshStandardMaterial({ color: 0x2f3d2a, roughness: 0.6 });
    } else {
      geo = new THREE.CylinderGeometry(0.12, 0.14, 0.35, 8);
      mat = new THREE.MeshStandardMaterial({ color: 0x3f8fe0, emissive: 0x1b4b7a, roughness: 0.2 });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.position.y = 0.1;
    g.add(mesh);

    let ringColor = 0xffffff;
    if (weaponTypeIndex === 8) ringColor = 0x55cc55;
    else if (weaponTypeIndex === 9) ringColor = 0x3f8fe0;
    else if (weaponTypeIndex === 0) ringColor = 0xf5a623;
    else if (weaponTypeIndex === 3) ringColor = 0x57d1c9;

    const glow = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.45, 16),
      new THREE.MeshBasicMaterial({
        color: ringColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.4;
    g.add(glow);

    g.position.set(x, y, z);
    worldGroup.add(g);

    let labelText = '';
    const targetW = WEAPONS[weaponTypeIndex];
    if (targetW?.type === 'consumable') {
      labelText = 'MINI SHIELD (+1)';
    } else if (targetW?.type === 'grenade') {
      labelText = 'GRENADES (+2)';
    } else if (targetW) {
      labelText = `${targetW.name} (+${ammoAmount} AMMO)`;
    } else {
      labelText = `AMMO (+${ammoAmount})`;
    }

    const pickup: GroundPickup = {
      group: g,
      typeIndex: weaponTypeIndex,
      ammo: ammoAmount,
      label: labelText
    };
    groundPickups.push(pickup);
    return pickup;
  }

  function collectPickup(
    item: GroundPickup,
    onAcquire: (msg: string) => void,
    weaponStates: { count?: number; reserve?: number }[]
  ): void {
    const idx = item.typeIndex;
    const w = WEAPONS[idx];
    if (!w || !weaponStates[idx]) return;
    if (w.type === 'consumable') {
      weaponStates[idx].count = Math.min(6, (weaponStates[idx].count ?? 0) + 1);
      onAcquire('+1 MINI SHIELD ACQUIRED');
    } else if (w.type === 'grenade') {
      weaponStates[idx].count = Math.min(6, (weaponStates[idx].count ?? 0) + item.ammo);
      onAcquire(`+${item.ammo} TACTICAL GRENADES`);
    } else {
      weaponStates[idx].reserve = (weaponStates[idx].reserve ?? 0) + item.ammo;
      onAcquire(`+${item.ammo} ${w.name} AMMO`);
    }
    worldGroup.remove(item.group);
    const indexInArr = groundPickups.indexOf(item);
    if (indexInArr >= 0) groundPickups.splice(indexInArr, 1);
  }

  // Seed default ground pickups along the gauntlet
  if (mapId === 'hangar') {
    createGroundPickup(-3, 2, 0, 60);  // Sector 1: AR ammo
    createGroundPickup(3, -2, 9, 2);   // Sector 1: Shields
    createGroundPickup(-5, -35, 1, 16); // Sector 2: Shotgun ammo
    createGroundPickup(5, -45, 8, 3);   // Sector 2: Grenades
    createGroundPickup(-6, -75, 5, 100);// Sector 3: LMG ammo
    createGroundPickup(6, -85, 9, 2);   // Sector 3: Shield
    createGroundPickup(-6, -115, 6, 40);// Sector 4: Battle Rifle ammo
    createGroundPickup(6, -125, 9, 2);  // Sector 4: Shield
    createGroundPickup(-8, -155, 7, 60);// Sector 5: Plasma Laser
    createGroundPickup(8, -155, 8, 4);  // Sector 5: Grenades
  } else {
    structures.forEach((st, idx) => {
      if (st.center && idx % 2 === 0) {
        const wType = idx % WEAPONS.length;
        const targetW = WEAPONS[wType];
        const ammo = targetW.mag ? targetW.mag * 2 : 2;
        createGroundPickup(st.center.x + (Math.random() * 2 - 1), st.center.z + (Math.random() * 2 - 1), wType, ammo);
      }
    });
  }

  function updateDoors(dt: number): void {
    doors.forEach(d => {
      const diff = d.targetAngle - d.currentAngle;
      if (Math.abs(diff) > 0.01) {
        d.currentAngle += Math.sign(diff) * Math.min(Math.abs(diff), dt * 4.5);
        d.hingeGroup.rotation.y = d.currentAngle;
      }
    });
  }

  function moveEntityWithCollision(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    radius: number,
    footY: number,
    headY: number,
    dt: number
  ): void {
    let desiredDx = vel.x * dt;
    let desiredDz = vel.z * dt;

    for (let axis = 0; axis < 2; axis++) {
      const checkX = axis === 0;
      const dx = checkX ? desiredDx : 0;
      const dz = checkX ? 0 : desiredDz;

      if (dx === 0 && dz === 0) continue;

      const nextX = pos.x + dx;
      const nextZ = pos.z + dz;

      let blocked = false;
      for (let j = 0; j < worldColliders.length; j++) {
        const c = worldColliders[j];
        if (c.active === false) continue;
        if (headY <= c.minY || footY >= c.maxY) continue;

        if (nextX + radius > c.minX && nextX - radius < c.maxX &&
            nextZ + radius > c.minZ && nextZ - radius < c.maxZ) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        pos.x = nextX;
        pos.z = nextZ;
      } else {
        if (checkX) vel.x = 0;
        else vel.z = 0;
      }
    }
  }

  function getHighestSurface(x: number, z: number, footY: number): number {
    let topY = terrainHeight(x, z);
    for (const c of worldColliders) {
      if (c.active === false) continue;
      if (x >= c.minX - 0.05 && x <= c.maxX + 0.05 && z >= c.minZ - 0.05 && z <= c.maxZ + 0.05) {
        const stepThreshold = (c.isStair || c.isRamp) ? 0.95 : 0.65;
        if (c.maxY <= footY + stepThreshold && c.maxY > topY) {
          topY = c.maxY;
        }
      }
    }
    return topY;
  }

  const hangarCorridorNodes = {
    mainframe: new THREE.Vector3(0, 0, -120),
    cryo: new THREE.Vector3(0, 0, -80),
    evac: new THREE.Vector3(0, 0, -170),
    center: new THREE.Vector3(0, 0, -40)
  };

  function spawnObjectiveProp(faction: 'usmc' | 'apex', customPos?: THREE.Vector3): ObjectivePropInstance {
    const defaultPos = faction === 'apex' ? hangarCorridorNodes.mainframe : hangarCorridorNodes.cryo;
    const spawnPos = customPos ? customPos.clone() : defaultPos.clone();
    const propGroup = new THREE.Group();
    propGroup.position.copy(spawnPos);

    if (faction === 'apex') {
      const rackGeo = new THREE.BoxGeometry(1.6, 2.7, 1.1);
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.65, metalness: 0.6 });
      const rackMesh = new THREE.Mesh(rackGeo, rackMat);
      rackMesh.position.y = 1.35;
      propGroup.add(rackMesh);
      registerHittable(rackMesh);

      worldGroup.add(propGroup);
      return {
        group: propGroup,
        interactNode: spawnPos.clone().add(new THREE.Vector3(0, 0, 1.2)),
        type: 'mainframe',
        boundingMesh: rackMesh,
        dispose: () => {
          worldGroup.remove(propGroup);
        }
      };
    } else {
      const cureGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.7, 16);
      const cureMat = new THREE.MeshStandardMaterial({
        color: 0x00ff66,
        emissive: 0x00ff66,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.85
      });
      const canisterMesh = new THREE.Mesh(cureGeo, cureMat);
      canisterMesh.position.y = 1.2;
      propGroup.add(canisterMesh);

      worldGroup.add(propGroup);
      return {
        group: propGroup,
        interactNode: spawnPos.clone(),
        type: 'bio_cylinder',
        boundingMesh: canisterMesh,
        dispose: () => {
          worldGroup.remove(propGroup);
        }
      };
    }
  }

  function spawnDeployableCover(pos: THREE.Vector3, rotY: number): THREE.Group {
    const coverGroup = new THREE.Group();
    coverGroup.position.copy(pos);
    coverGroup.rotation.y = rotY;

    const wallGeo = new THREE.BoxGeometry(2.8, 1.25, 0.35);
    const wallMatCover = new THREE.MeshStandardMaterial({
      color: 0x2b333c,
      metalness: 0.75,
      roughness: 0.35
    });
    const wallMesh = new THREE.Mesh(wallGeo, wallMatCover);
    wallMesh.position.y = 0.625;
    coverGroup.add(wallMesh);
    registerHittable(wallMesh);

    worldGroup.add(coverGroup);

    const cosR = Math.abs(Math.cos(rotY));
    const sinR = Math.abs(Math.sin(rotY));
    const effW = 2.8 * cosR + 0.6 * sinR;
    const effD = 2.8 * sinR + 0.6 * cosR;

    worldColliders.push({
      minX: pos.x - effW / 2,
      maxX: pos.x + effW / 2,
      minY: pos.y,
      maxY: pos.y + 1.25,
      minZ: pos.z - effD / 2,
      maxZ: pos.z + effD / 2,
      active: true
    });
    return coverGroup;
  }

  function dispose(): void {
    groundPickups.forEach(p => worldGroup.remove(p.group));
    groundPickups.length = 0;
    activeDebris.forEach(d => {
      worldGroup.remove(d.mesh);
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
    });
    activeDebris.length = 0;
    worldGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach(mat => mat.dispose());
        } else if (m.material) {
          m.material.dispose();
        }
      }
      if ((obj as THREE.Light).isLight) {
        const l = obj as THREE.Light;
        if (l.dispose) l.dispose();
      }
    });
    scene.remove(worldGroup);
    worldGroup.clear();
  }

  return {
    terrainMesh,
    worldColliders,
    doors,
    hittableObjects,
    groundPickups,
    structures,
    bioCylinderGroup,
    mainframeConsoleGroup,
    evacPadMesh,
    armoryDoor,
    armoryCrateGroup,
    armoryKeypadMesh,
    breakerAlphaGroup,
    breakerBetaGroup,
    breakerAlphaLight,
    breakerBetaLight,
    volatileReceptacleGroup,
    volatileReceptacleLight,
    sectorCenters,
    registerHittable,
    unregisterHittable,
    damageEnvironmentalBlock,
    updateDebris,
    createGroundPickup,
    collectPickup,
    updateDoors,
    moveEntityWithCollision,
    getHighestSurface,
    spawnObjectiveProp,
    spawnDeployableCover,
    hangarCorridorNodes,
    dispose
  };
}
