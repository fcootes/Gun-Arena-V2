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
      { minX: -10, maxX: 10, minZ: -88, maxZ: -72 },   // Sector 3: Reactor & Armory (Z ~ -80)
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
      if (object.parent) {
        object.parent.remove(object);
      }

      const bColor = object.userData.blockColor || 0x6a6458;
      const count = Math.floor(Math.random() * 5) + 8;
      const origin = hitPoint ? hitPoint.clone() : new THREE.Vector3();
      if (!hitPoint) object.getWorldPosition(origin);

      for (let i = 0; i < count; i++) {
        const s = 0.14 + Math.random() * 0.18;
        const dMesh = new THREE.Mesh(
          new THREE.BoxGeometry(s, s, s),
          new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.9 })
        );
        dMesh.position.copy(origin).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.45,
          (Math.random() - 0.5) * 0.45,
          (Math.random() - 0.5) * 0.45
        ));
        dMesh.castShadow = true;
        worldGroup.add(dMesh);
        activeDebris.push({
          mesh: dMesh,
          vel: new THREE.Vector3((Math.random() - 0.5) * 5.0, Math.random() * 3.5 + 1.2, (Math.random() - 0.5) * 5.0),
          rotVel: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
          life: 2.2 + Math.random() * 0.8
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
      d.vel.y -= 16.0 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      d.mesh.rotation.z += d.rotVel.z * dt;
      const floorY = terrainHeight(d.mesh.position.x, d.mesh.position.z);
      if (d.mesh.position.y <= floorY + 0.08) {
        d.mesh.position.y = floorY + 0.08;
        d.vel.y = -d.vel.y * 0.35;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
      }
    }
  }

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

  let terrainMesh: THREE.Mesh;

  if (mapId === 'training') {
    // =========================================================================
    // OUTDOOR TRAINING CAMP GROUND TERRAIN
    // =========================================================================
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

    function makeTree(x: number, z: number): void {
      const g = new THREE.Group();
      const trunkH = 2.4 + Math.random() * 1.2;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, trunkH, 7),
        new THREE.MeshStandardMaterial({ color: 0x5b3d24, roughness: 1 })
      );
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 + Math.random() * 0.6, 3.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x2e5c30, roughness: 1 })
      );
      canopy.position.y = trunkH + 1.4;
      canopy.castShadow = true;
      g.add(trunk, canopy);
      g.position.set(x, terrainHeight(x, z), z);
      worldGroup.add(g);
      trunk.userData = { type: 'tree' };
      registerHittable(trunk);

      worldColliders.push({
        minX: x - 0.32,
        maxX: x + 0.32,
        minY: terrainHeight(x, z),
        maxY: terrainHeight(x, z) + trunkH,
        minZ: z - 0.32,
        maxZ: z + 0.32,
        active: true
      });
    }

    function makeRock(x: number, z: number): void {
      const s = 1.0 + Math.random() * 1.3;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(s, 0),
        new THREE.MeshStandardMaterial({ color: 0x777c80, roughness: 1, flatShading: true })
      );
      rock.position.set(x, terrainHeight(x, z) + s * 0.4, z);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      rock.castShadow = true;
      rock.receiveShadow = true;
      worldGroup.add(rock);
      rock.userData = { type: 'rock' };
      registerHittable(rock);

      worldColliders.push({
        minX: x - s * 0.7,
        maxX: x + s * 0.7,
        minY: terrainHeight(x, z),
        maxY: terrainHeight(x, z) + s * 1.3,
        minZ: z - s * 0.7,
        maxZ: z + s * 0.7,
        active: true
      });
    }

    for (let i = 0; i < 28; i++) {
      const p = randomMapPoint(0);
      makeTree(p.x, p.z);
    }
    for (let i = 0; i < 16; i++) {
      const p = randomMapPoint(0);
      makeRock(p.x, p.z);
    }

    function addWorldBuilding(x: number, z: number, w: number, d: number, h: number, hasRoofSteps = false): void {
      const y = terrainHeight(x, z);
      const g = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8d8272, roughness: 0.9 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x5e4537, roughness: 0.9 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x44484d, roughness: 0.85 });

      const wt = 0.4;
      const dw = 1.6;
      const dh = 2.4;

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, wt), bodyMat);
      backWall.position.set(0, h / 2, -d / 2 + wt / 2);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      g.add(backWall);
      registerHittable(backWall);
      const backWallCol: WorldCollider = { minX: x - w / 2, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z - d / 2 + wt, active: true };
      worldColliders.push(backWallCol);
      makeDestructible(backWall, backWallCol, 0x8d8272);

      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wt, h, d), bodyMat);
      leftWall.position.set(-w / 2 + wt / 2, h / 2, 0);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      g.add(leftWall);
      registerHittable(leftWall);
      const leftWallCol: WorldCollider = { minX: x - w / 2, maxX: x - w / 2 + wt, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z + d / 2, active: true };
      worldColliders.push(leftWallCol);
      makeDestructible(leftWall, leftWallCol, 0x8d8272);

      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wt, h, d), bodyMat);
      rightWall.position.set(w / 2 - wt / 2, h / 2, 0);
      rightWall.castShadow = true;
      rightWall.receiveShadow = true;
      g.add(rightWall);
      registerHittable(rightWall);
      const rightWallCol: WorldCollider = { minX: x + w / 2 - wt, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z + d / 2, active: true };
      worldColliders.push(rightWallCol);
      makeDestructible(rightWall, rightWallCol, 0x8d8272);

      const frontLeftW = (w - dw) / 2;
      const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontLeftW, h, wt), bodyMat);
      frontLeft.position.set(-w / 2 + frontLeftW / 2, h / 2, d / 2 - wt / 2);
      frontLeft.castShadow = true;
      frontLeft.receiveShadow = true;
      g.add(frontLeft);
      registerHittable(frontLeft);
      const frontLeftCol: WorldCollider = { minX: x - w / 2, maxX: x - dw / 2, minY: y, maxY: y + h, minZ: z + d / 2 - wt, maxZ: z + d / 2, active: true };
      worldColliders.push(frontLeftCol);
      makeDestructible(frontLeft, frontLeftCol, 0x8d8272);

      const frontRightW = (w - dw) / 2;
      const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontRightW, h, wt), bodyMat);
      frontRight.position.set(dw / 2 + frontRightW / 2, h / 2, d / 2 - wt / 2);
      frontRight.castShadow = true;
      frontRight.receiveShadow = true;
      g.add(frontRight);
      registerHittable(frontRight);
      const frontRightCol: WorldCollider = { minX: x + dw / 2, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z + d / 2 - wt, maxZ: z + d / 2, active: true };
      worldColliders.push(frontRightCol);
      makeDestructible(frontRight, frontRightCol, 0x8d8272);

      const lintelH = h - dh;
      if (lintelH > 0.1) {
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(dw, lintelH, wt), bodyMat);
        lintel.position.set(0, dh + lintelH / 2, d / 2 - wt / 2);
        lintel.castShadow = true;
        lintel.receiveShadow = true;
        g.add(lintel);
        registerHittable(lintel);
        const lintelCol: WorldCollider = { minX: x - dw / 2, maxX: x + dw / 2, minY: y + dh, maxY: y + h, minZ: z + d / 2 - wt, maxZ: z + d / 2, active: true };
        worldColliders.push(lintelCol);
        makeDestructible(lintel, lintelCol, 0x8d8272);
      }

      const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(w - wt, 0.2, d - wt), floorMat);
      floorMesh.position.set(0, 0.1, 0);
      floorMesh.receiveShadow = true;
      g.add(floorMesh);
      registerHittable(floorMesh);
      worldColliders.push({ minX: x - w / 2 + wt / 2, maxX: x + w / 2 - wt / 2, minY: y, maxY: y + 0.2, minZ: z - d / 2 + wt / 2, maxZ: z + d / 2 - wt / 2, active: true });

      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.4, d + 0.6), roofMat);
      roof.position.set(0, h + 0.2, 0);
      roof.castShadow = true;
      roof.receiveShadow = true;
      g.add(roof);
      registerHittable(roof);
      const roofCol: WorldCollider = { minX: x - (w + 0.6) / 2, maxX: x + (w + 0.6) / 2, minY: y + h, maxY: y + h + 0.4, minZ: z - (d + 0.6) / 2, maxZ: z + (d + 0.6) / 2, active: true };
      worldColliders.push(roofCol);
      makeDestructible(roof, roofCol, 0x5e4537);

      if (hasRoofSteps) {
        const stepCount = 3;
        for (let s = 1; s <= stepCount; s++) {
          const stepH = (h * s) / stepCount;
          const stepBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, stepH, 1.4), new THREE.MeshStandardMaterial({ color: 0x4a443a, roughness: 0.85 }));
          stepBox.position.set(w / 2 + 0.9, stepH / 2, -d / 2 + s * 1.4);
          stepBox.castShadow = true;
          stepBox.receiveShadow = true;
          g.add(stepBox);
          registerHittable(stepBox);
          const stepCol: WorldCollider = {
            minX: x + w / 2 + 0.1,
            maxX: x + w / 2 + 1.7,
            minY: y,
            maxY: y + stepH,
            minZ: z - d / 2 + s * 1.4 - 0.7,
            maxZ: z - d / 2 + s * 1.4 + 0.7,
            active: true,
            isStair: true
          };
          worldColliders.push(stepCol);
          makeDestructible(stepBox, stepCol, 0x4a443a);
        }
      }

      createDoor(x, y, z + d / 2 - wt / 2, dw, dh, 0.12, g, 'x');
      g.position.set(x, y, z);
      worldGroup.add(g);
      structures.push({ center: new THREE.Vector3(x, y + 0.5, z) });
    }

    function addTacticalObstacleCluster(x: number, z: number): void {
      const y = terrainHeight(x, z);
      const g = new THREE.Group();
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x3e5265, metalness: 0.3, roughness: 0.7 });
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0x6b6e70, roughness: 0.9 });

      const b1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), crateMat);
      b1.position.set(0, 0.8, 0);
      b1.castShadow = true;
      b1.receiveShadow = true;

      const b2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 2.2), crateMat);
      b2.position.set(0.4, 2.3, 0.2);
      b2.castShadow = true;
      b2.receiveShadow = true;

      const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 0.4), barrierMat);
      barrier.position.set(-1.6, 0.6, 1.8);
      barrier.castShadow = true;
      barrier.receiveShadow = true;

      g.add(b1, b2, barrier);
      g.position.set(x, y, z);
      worldGroup.add(g);

      registerHittable(b1);
      registerHittable(b2);
      registerHittable(barrier);

      const b1Col: WorldCollider = { minX: x - 1.2, maxX: x + 1.2, minY: y, maxY: y + 1.6, minZ: z - 1.2, maxZ: z + 1.2, active: true };
      const b2Col: WorldCollider = { minX: x + 0.4 - 1.1, maxX: x + 0.4 + 1.1, minY: y + 1.5, maxY: y + 3.05, minZ: z + 0.2 - 1.1, maxZ: z + 0.2 + 1.1, active: true };
      const barrierCol: WorldCollider = { minX: x - 1.6 - 1.8, maxX: x - 1.6 + 1.8, minY: y, maxY: y + 1.2, minZ: z + 1.8 - 0.2, maxZ: z + 1.8 + 0.2, active: true };

      worldColliders.push(b1Col, b2Col, barrierCol);
      makeDestructible(b1, b1Col, 0x3e5265);
      makeDestructible(b2, b2Col, 0x3e5265);
      makeDestructible(barrier, barrierCol, 0x6b6e70);
    }

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
    // =========================================================================
    // SUBTERRANEAN EXTRACTION: 5-SECTOR LINEAR GAUNTLET
    // Sector 1: Ingress Airlock (Z = 0)
    // Sector 2: Virology Labs (Z = -40)
    // Sector 3: Bio-Reactor Core, Bio-Cylinder & Security Armory (Z = -80)
    // Sector 4: Cryo Mainframe Terminal & Dual Circuit Breakers (Z = -120)
    // Sector 5: Evac Vault, Volatile Receptacle, Boss Arena & Evac Pad (Z = -160)
    // =========================================================================

    const defaultCeilH = 2.8;

    // Continuous Subterranean Floor with Wet Specular Sheen (Z = +15 down to -185)
    const floorGeo = new THREE.PlaneGeometry(60, 210, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x15181e,
      roughness: 0.18,
      metalness: 0.82
    });
    terrainMesh = new THREE.Mesh(floorGeo, floorMat);
    terrainMesh.position.set(0, 0, -85);
    terrainMesh.receiveShadow = true;
    terrainMesh.userData = { type: 'terrain' };
    worldGroup.add(terrainMesh);
    registerHittable(terrainMesh);

    // Floor Runway Safety Decal Lane
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x242e38, transparent: true, opacity: 0.35 });
    const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 200), gridMat);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.set(0, 0.02, -85);
    worldGroup.add(gridMesh);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222730, roughness: 0.85, metalness: 0.25 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.4, metalness: 0.8 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.95 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, emissive: 0x3d2000, roughness: 0.5 });
    const barrelYellowMat = new THREE.MeshStandardMaterial({ color: 0xdfa012, roughness: 0.6, metalness: 0.4 });
    const barrelGreenMat = new THREE.MeshStandardMaterial({ color: 0x31462a, roughness: 0.7, metalness: 0.3 });
    const bioPuddleMat = new THREE.MeshStandardMaterial({
      color: 0x11ff44,
      emissive: 0x00cc33,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.1
    });

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

    // =========================================================================
    // PROCEDURAL ENVIRONMENTAL DRESSING BUILDERS
    // =========================================================================
    const addGurney = (gx: number, gz: number, rotY: number, isOverturned: boolean) => {
      const gGroup = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x8892a0, metalness: 0.8, roughness: 0.3 });
      const padMat = new THREE.MeshStandardMaterial({ color: 0x2b3846, roughness: 0.9 });

      const pad = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 0.8), padMat);
      pad.position.y = 0.85;
      gGroup.add(pad);

      for (const lx of [-0.85, 0.85]) {
        for (const lz of [-0.32, 0.32]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), frameMat);
          leg.position.set(lx, 0.4, lz);
          gGroup.add(leg);

          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8), frameMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(lx, 0.08, lz);
          gGroup.add(wheel);
        }
      }

      const ivPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), frameMat);
      ivPole.position.set(-0.95, 1.4, 0.35);
      gGroup.add(ivPole);

      if (isOverturned) {
        gGroup.rotation.z = Math.PI / 3.2;
        gGroup.position.set(gx, -0.15, gz);
      } else {
        gGroup.position.set(gx, 0, gz);
      }
      gGroup.rotation.y = rotY;

      worldGroup.add(gGroup);
      registerHittable(pad);
      worldColliders.push({
        minX: gx - 0.9,
        maxX: gx + 0.9,
        minY: 0,
        maxY: 1.1,
        minZ: gz - 0.6,
        maxZ: gz + 0.6,
        active: true
      });
    };

    const addBioSpecimenTank = (tx: number, tz: number) => {
      const tankGroup = new THREE.Group();
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x161a22, metalness: 0.85, roughness: 0.25 });

      const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.78, 0.45, 16), rimMat);
      baseCollar.position.y = 0.225;
      tankGroup.add(baseCollar);

      const fluidMat = new THREE.MeshStandardMaterial({
        color: 0x00ff77,
        emissive: 0x00e666,
        emissiveIntensity: 1.7,
        transparent: true,
        opacity: 0.85,
        roughness: 0.1
      });
      const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.1, 16), fluidMat);
      fluid.position.y = 1.45;
      tankGroup.add(fluid);

      const specMat = new THREE.MeshBasicMaterial({ color: 0x0a1a0f });
      const specMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 8), specMat);
      specMesh.position.y = 1.4;
      tankGroup.add(specMesh);

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x44ffaa,
        transparent: true,
        opacity: 0.35,
        metalness: 0.9,
        roughness: 0.05,
        depthWrite: false
      });
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 2.2, 16), glassMat);
      glass.position.y = 1.45;
      tankGroup.add(glass);

      const topCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.68, 0.4, 16), rimMat);
      topCollar.position.y = 2.65;
      tankGroup.add(topCollar);

      tankGroup.position.set(tx, 0, tz);
      worldGroup.add(tankGroup);
      registerHittable(baseCollar);
      worldColliders.push({
        minX: tx - 0.7,
        maxX: tx + 0.7,
        minY: 0,
        maxY: 2.8,
        minZ: tz - 0.7,
        maxZ: tz + 0.7,
        active: true
      });
    };

    const addHazardBarrelCluster = (bx: number, bz: number, hasPuddle = true) => {
      const bGroup = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12), barrelYellowMat);
      b1.position.set(-0.35, 0.575, -0.2);
      bGroup.add(b1);

      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12), barrelGreenMat);
      b2.position.set(0.4, 0.575, 0.25);
      bGroup.add(b2);

      const b3 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12), barrelYellowMat);
      b3.rotation.x = Math.PI / 2;
      b3.rotation.z = Math.PI / 4;
      b3.position.set(0.1, 0.42, -0.65);
      bGroup.add(b3);

      if (hasPuddle) {
        const puddle = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), bioPuddleMat);
        puddle.rotation.x = -Math.PI / 2;
        puddle.position.set(0.3, 0.02, -0.7);
        bGroup.add(puddle);
      }

      bGroup.position.set(bx, 0, bz);
      worldGroup.add(bGroup);
      registerHittable(b1);
      worldColliders.push({
        minX: bx - 0.9,
        maxX: bx + 0.9,
        minY: 0,
        maxY: 1.25,
        minZ: bz - 0.9,
        maxZ: bz + 0.9,
        active: true
      });
    };

    const addWallTerminal = (wx: number, wy: number, wz: number, rotY: number) => {
      const termGroup = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.1, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x1b2029, metalness: 0.7, roughness: 0.4 })
      );
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x0a1c22, emissive: 0x2de2e6, emissiveIntensity: 0.85 })
      );
      screen.position.set(0, 0.18, 0.16);
      termGroup.add(box, screen);
      termGroup.position.set(wx, wy, wz);
      termGroup.rotation.y = rotY;
      worldGroup.add(termGroup);
    };

    const addExitSign = (sx: number, sy: number, sz: number, rotY: number) => {
      const signGroup = new THREE.Group();
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.35, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x22262d })
      );
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00dd33, emissiveIntensity: 1.3 })
      );
      face.position.z = 0.08;
      signGroup.add(housing, face);
      signGroup.position.set(sx, sy, sz);
      signGroup.rotation.y = rotY;
      worldGroup.add(signGroup);
    };

    const addCableTray = (x1: number, z1: number, x2: number, z2: number, cy = 2.6) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const angle = Math.atan2(x2 - x1, z2 - z1);
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.1, len),
        new THREE.MeshStandardMaterial({ color: 0x181c24, metalness: 0.75, roughness: 0.4 })
      );
      tray.position.set((x1 + x2) / 2, cy, (z1 + z2) / 2);
      tray.rotation.y = angle;
      worldGroup.add(tray);
    };

    const addFluorescentBar = (fx: number, fz: number, fy = 2.65, rotY = 0) => {
      const fixtureGroup = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.12, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.6 })
      );
      const tube1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8),
        new THREE.MeshStandardMaterial({ color: 0xdff5ff, emissive: 0xcbeeff, emissiveIntensity: 1.2 })
      );
      tube1.rotation.z = Math.PI / 2;
      tube1.position.set(0, -0.06, -0.09);
      const tube2 = tube1.clone();
      tube2.position.z = 0.09;
      fixtureGroup.add(body, tube1, tube2);
      fixtureGroup.position.set(fx, fy, fz);
      fixtureGroup.rotation.y = rotY;
      worldGroup.add(fixtureGroup);
    };

    const ambient = new THREE.AmbientLight(0x202832, 1.6);
    worldGroup.add(ambient);

    // =========================================================================
    // 1. SECTOR 1: INGRESS AIRLOCK (Z ~ 0, X in [-7, 7], Z in [-10, 10])
    // =========================================================================
    structures.push({ center: sectorCenters[1] });
    addCeiling(0, 0, 14, 20, defaultCeilH);
    addWall(0, 10, 14, 1.2, defaultCeilH, true);
    addWall(-7, 0, 1.2, 20, defaultCeilH);
    addWall(7, 0, 1.2, 20, defaultCeilH);
    addWall(-4.3, -10, 5.4, 1.2, defaultCeilH);
    addWall(4.3, -10, 5.4, 1.2, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, 0, 0xffaa44, 3.5, 16);

    addGurney(3.2, 2.0, 0.2, true);
    addHazardBarrelCluster(-4.5, -4.0, true);
    addExitSign(0, defaultCeilH - 0.4, -9.8, 0);

    // Corridor 1 -> 2 (Z: -10 to -30, Width 3.2m: X in [-1.6, 1.6])
    addWall(-2.2, -20, 1.2, 20, defaultCeilH);
    addWall(2.2, -20, 1.2, 20, defaultCeilH);
    addCeiling(0, -20, 3.2, 20, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -20, 0xff7722, 2.8, 12);
    addCableTray(0, -10, 0, -30, defaultCeilH - 0.15);
    addFluorescentBar(0, -20, defaultCeilH - 0.12, 0);
    createDoor(0, 0, -20, 3.2, defaultCeilH, 0.25, worldGroup, 'x');

    // =========================================================================
    // 2. SECTOR 2: VIROLOGY LABS (Z ~ -40, X in [-10, 10], Z in [-50, -30])
    // =========================================================================
    structures.push({ center: sectorCenters[2] });
    addCeiling(0, -40, 20, 20, defaultCeilH);
    addWall(-5.8, -30, 8.4, 1.2, defaultCeilH);
    addWall(5.8, -30, 8.4, 1.2, defaultCeilH);
    addWall(-10, -40, 1.2, 20, defaultCeilH);
    addWall(10, -40, 1.2, 20, defaultCeilH);
    addWall(-5.8, -50, 8.4, 1.2, defaultCeilH);
    addWall(5.8, -50, 8.4, 1.2, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -40, 0x44ddff, 4.5, 22);
    addLight(-6, defaultCeilH - 0.2, -40, 0x22aacc, 2.5, 14);
    addLight(6, defaultCeilH - 0.2, -40, 0x22aacc, 2.5, 14);

    const labBenchMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.6 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(4, 1.0, 1.5), labBenchMat);
    b1.position.set(-5, 0.5, -38);
    worldGroup.add(b1);
    worldColliders.push({ minX: -7, maxX: -3, minY: 0, maxY: 1.0, minZ: -38.75, maxZ: -37.25, active: true });

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(4, 1.0, 1.5), labBenchMat);
    b2.position.set(5, 0.5, -42);
    worldGroup.add(b2);
    worldColliders.push({ minX: 3, maxX: 7, minY: 0, maxY: 1.0, minZ: -42.75, maxZ: -41.25, active: true });

    addBioSpecimenTank(-8.4, -36);
    addBioSpecimenTank(-8.4, -44);
    addBioSpecimenTank(8.4, -36);
    addGurney(-2.4, -46, 0.8, false);
    addWallTerminal(-9.3, 1.3, -40, Math.PI / 2);

    // Corridor 2 -> 3 (Z: -50 to -70, Width 3.2m)
    addWall(-2.2, -60, 1.2, 20, defaultCeilH);
    addWall(2.2, -60, 1.2, 20, defaultCeilH);
    addCeiling(0, -60, 3.2, 20, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -60, 0x22ff88, 2.5, 12);
    addCableTray(0, -50, 0, -70, defaultCeilH - 0.15);
    addFluorescentBar(0, -60, defaultCeilH - 0.12, 0);
    createDoor(0, 0, -60, 3.2, defaultCeilH, 0.25, worldGroup, 'x');

    // =========================================================================
    // 3. SECTOR 3: BIO-REACTOR, BIO-CYLINDER & ARMORY (Z ~ -80, X in [-12, 12])
    // =========================================================================
    const reactorCeilH = 3.4;
    structures.push({ center: sectorCenters[3] });
    addCeiling(0, -80, 24, 20, reactorCeilH);
    addWall(-6.8, -70, 10.4, 1.2, reactorCeilH);
    addWall(6.8, -70, 10.4, 1.2, reactorCeilH);
    addWall(-12, -80, 1.2, 20, reactorCeilH);
    addWall(12, -74.25, 1.2, 8.5, reactorCeilH);
    addWall(12, -85.75, 1.2, 8.5, reactorCeilH);
    addWall(-6.8, -90, 10.4, 1.2, reactorCeilH);
    addWall(6.8, -90, 10.4, 1.2, reactorCeilH);
    addLight(0, reactorCeilH - 0.2, -80, 0x00ff66, 5.5, 26);

    // LOCKED ARMORY (X in [12, 18], Z in [-83, -77])
    addCeiling(15, -80, 6, 6, reactorCeilH);
    const armoryFloorGeo = new THREE.PlaneGeometry(6, 6);
    armoryFloorGeo.rotateX(-Math.PI / 2);
    const armoryFloorMesh = new THREE.Mesh(
      armoryFloorGeo,
      new THREE.MeshStandardMaterial({ color: 0x161d26, roughness: 0.7, metalness: 0.4 })
    );
    armoryFloorMesh.position.set(15, 0.01, -80);
    worldGroup.add(armoryFloorMesh);

    addWall(15, -77, 6, 1.2, reactorCeilH);
    addWall(15, -83, 6, 1.2, reactorCeilH);
    addWall(18, -80, 1.2, 6, reactorCeilH);
    addWall(12, -77.75, 1.2, 1.5, reactorCeilH);
    addWall(12, -82.25, 1.2, 1.5, reactorCeilH);
    addLight(15, reactorCeilH - 0.2, -80, 0xff9900, 4.2, 15);
    addLight(13, 1.8, -80, 0xff6600, 2.8, 8);

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

    armoryDoor = createDoor(12, 0, -80, 3.0, reactorCeilH, 0.25, worldGroup, 'z', true);

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

    // Central Reactor Pedestal
    const pedGeo = new THREE.CylinderGeometry(1.4, 1.7, 0.8, 16);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1b2028, metalness: 0.8, roughness: 0.3 });
    const pedMesh = new THREE.Mesh(pedGeo, pedMat);
    pedMesh.position.set(0, 0.4, -80);
    worldGroup.add(pedMesh);
    worldColliders.push({ minX: -1.5, maxX: 1.5, minY: 0, maxY: 0.8, minZ: -81.5, maxZ: -78.5, active: true });

    // Prototype Bio-Cylinder Asset
    const cylinderG = new THREE.Group();
    cylinderG.position.set(0, 1.2, -80);
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
    const capGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16);
    const capMat2 = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const topCap = new THREE.Mesh(capGeo, capMat2);
    topCap.position.y = 0.33;
    const botCap = new THREE.Mesh(capGeo, capMat2);
    botCap.position.y = -0.33;
    cylinderG.add(topCap, botCap);
    const cylLight = new THREE.PointLight(0x00ff66, 3.0, 6, 1.5);
    cylinderG.add(cylLight);
    worldGroup.add(cylinderG);
    bioCylinderGroup = cylinderG;

    addHazardBarrelCluster(-9.5, -74, true);
    addHazardBarrelCluster(-9.5, -86, false);
    addWallTerminal(-11.4, 1.4, -80, Math.PI / 2);

    // Corridor 3 -> 4 (Z: -90 to -110, Width 3.2m)
    addWall(-2.2, -100, 1.2, 20, defaultCeilH);
    addWall(2.2, -100, 1.2, 20, defaultCeilH);
    addCeiling(0, -100, 3.2, 20, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -100, 0x33bbff, 2.5, 12);
    addCableTray(0, -90, 0, -110, defaultCeilH - 0.15);
    addFluorescentBar(0, -100, defaultCeilH - 0.12, 0);
    createDoor(0, 0, -100, 3.2, defaultCeilH, 0.25, worldGroup, 'x');

    // =========================================================================
    // 4. SECTOR 4: CRYO MAINFRAME (Z ~ -120, X in [-12, 12])
    // =========================================================================
    structures.push({ center: sectorCenters[4] });
    addCeiling(0, -120, 24, 20, defaultCeilH);
    addWall(-6.8, -110, 10.4, 1.2, defaultCeilH);
    addWall(6.8, -110, 10.4, 1.2, defaultCeilH);
    addWall(-12, -120, 1.2, 20, defaultCeilH);
    addWall(12, -120, 1.2, 20, defaultCeilH);
    addWall(-6.8, -130, 10.4, 1.2, defaultCeilH);
    addWall(6.8, -130, 10.4, 1.2, defaultCeilH);
    addLight(0, defaultCeilH - 0.2, -120, 0x0099ff, 4.8, 24);

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

    const consoleG = new THREE.Group();
    consoleG.position.set(0, 0, -120);
    const sBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.6, metalness: 0.8 })
    );
    sBase.position.y = 0.8;
    consoleG.add(sBase);
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
    const termLight = new THREE.PointLight(0x2de2e6, 3.2, 8, 1.4);
    termLight.position.set(0, 2.0, 0.4);
    consoleG.add(termLight);
    worldGroup.add(consoleG);
    worldColliders.push({ minX: -1.3, maxX: 1.3, minY: 0, maxY: 2.2, minZ: -121, maxZ: -119, active: true });
    mainframeConsoleGroup = consoleG;

    // Circuit Breaker Alpha on West Wall
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

    // Circuit Breaker Beta on East Wall
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
    addLight(0, defaultCeilH - 0.2, -140, 0xff3333, 3.0, 14);
    addCableTray(0, -130, 0, -150, defaultCeilH - 0.15);
    createDoor(0, 0, -140, 3.2, defaultCeilH, 0.25, worldGroup, 'x');

    // =========================================================================
    // 5. SECTOR 5: EVAC VAULT & BOSS ARENA (Z ~ -160, X in [-15, 15])
    // =========================================================================
    const arenaCeilH = 3.6;
    structures.push({ center: sectorCenters[5] });
    addCeiling(0, -162.5, 30, 25, arenaCeilH);
    addWall(-8.3, -150, 13.4, 1.2, arenaCeilH);
    addWall(8.3, -150, 13.4, 1.2, arenaCeilH);
    addWall(-15, -162.5, 1.2, 25, arenaCeilH);
    addWall(15, -162.5, 1.2, 25, arenaCeilH);
    addWall(0, -175, 30, 1.2, arenaCeilH, true);
    addLight(0, arenaCeilH - 0.3, -160, 0xff2222, 5.0, 30);
    addLight(-10, arenaCeilH - 0.3, -160, 0xff5533, 3.5, 20);
    addLight(10, arenaCeilH - 0.3, -160, 0xff5533, 3.5, 20);

    // Decontamination Receptacle Vault
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

    // Evac Landing Pad
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

    const padBorderGeo = new THREE.BoxGeometry(5.4, 0.12, 5.4);
    const padBorderMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.5 });
    const padBorder = new THREE.Mesh(padBorderGeo, padBorderMat);
    padBorder.position.set(0, 0.04, -170);
    worldGroup.add(padBorder);

    const evacLight = new THREE.PointLight(0x00ff66, 6.0, 15, 1.2);
    evacLight.position.set(0, arenaCeilH - 0.2, -170);
    worldGroup.add(evacLight);
    evacPadMesh = evacPad;

    addHazardBarrelCluster(-12, -156, true);
    addHazardBarrelCluster(12, -156, true);
    addHazardBarrelCluster(-12, -172, true);
    addGurney(-6.0, -164, 0.4, true);
    addGurney(6.0, -164, -0.4, false);
  }

  // =========================================================================
  // GROUND PICKUPS ENGINE
  // =========================================================================
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

    let ringColor = 0xf5a623;
    if (weaponTypeIndex === 9) ringColor = 0x3f8fe0;
    else if (weaponTypeIndex === 8) ringColor = 0x55cc44;
    else if (weaponTypeIndex === 7) ringColor = 0xb5179e;
    else if (weaponTypeIndex === 6) ringColor = 0x4cc9f0;
    else if (weaponTypeIndex === 5) ringColor = 0xf72585;
    else if (weaponTypeIndex === 4) ringColor = 0xf77f00;
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

  if (mapId === 'hangar') {
    createGroundPickup(-3, 2, 0, 60);   // Sector 1: AR ammo
    createGroundPickup(3, -2, 9, 2);    // Sector 1: Shields
    createGroundPickup(-5, -35, 1, 16);  // Sector 2: Shotgun ammo
    createGroundPickup(5, -45, 8, 3);    // Sector 2: Grenades
    createGroundPickup(-6, -75, 5, 100); // Sector 3: LMG ammo
    createGroundPickup(6, -85, 9, 2);    // Sector 3: Shield
    createGroundPickup(-6, -115, 6, 40); // Sector 4: Battle Rifle ammo
    createGroundPickup(6, -125, 9, 2);   // Sector 4: Shield
    createGroundPickup(-8, -155, 7, 60); // Sector 5: Rail/Plasma
    createGroundPickup(8, -155, 8, 4);   // Sector 5: Grenades
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
    const desiredDx = vel.x * dt;
    const desiredDz = vel.z * dt;

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
        // Low-slope stair and ramp traversal: bypass horizontal collision block if stepping onto stair/ramp or low step
        if (c.isStair || c.isRamp || c.maxY <= footY + 0.45) continue;
        if (headY <= c.minY || footY >= c.maxY - 0.1) continue;

        if (
          nextX + radius > c.minX &&
          nextX - radius < c.maxX &&
          nextZ + radius > c.minZ &&
          nextZ - radius < c.maxZ
        ) {
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
