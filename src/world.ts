import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { WorldCollider, Door, GroundPickup, GameMode, WorldMapId, Bot } from './types';
export type { WorldMapId } from './types';
import { WEAPONS } from './weapons';

export const MAP_HALF = 100;
export let currentWorldMapId: WorldMapId = 'training';

export function terrainHeight(x: number, z: number): number {
  if (currentWorldMapId === 'shattered_wall') return offshoreTerrainHeight(x, z);
  if (currentWorldMapId === 'hangar') return 0;
  return (
    Math.sin(x * 0.024) * 3.8 +
    Math.cos(z * 0.026) * 3.4 +
    Math.sin((x + z) * 0.016) * 2.2 +
    Math.cos(x * 0.045 - z * 0.035) * 1.1
  );
}

export function randomMapPoint(minDistFromCenter = 0): { x: number; z: number } {
  if (currentWorldMapId === 'shattered_wall') {
    const nodes = SHATTERED_WALL_SPAWNS.zombie;
    const point = nodes[Math.floor(Math.random() * nodes.length)].position;
    return { x: point.x, z: point.z };
  }
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
  } while (Math.min(Math.max(0, minDistFromCenter), MAP_HALF * 0.8) > d);
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

export interface HeliDefenseHit { bot: Bot; damage: number; }

export interface WorldManager {
  updateHeliDefenses?: (delta: number, zombies: readonly Bot[]) => readonly HeliDefenseHit[];
  mapId: WorldMapId;
  updateWorld: (delta: number, time: number, currentMode: GameMode) => void;
  getSpawnPoints: (mode: GameMode) => SpawnPoint[];
  getExtractionZones: () => ExtractionZones | null;
  removeGroundPickup: (item: GroundPickup) => void;
  getNavigationTarget?: (from: THREE.Vector3, target: THREE.Vector3) => THREE.Vector3;
  offshore?: OffshoreState;
  lobbyGroup?: THREE.Group;
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

function createLegacyWorld(scene: THREE.Scene, mapId: 'training' | 'hangar'): WorldManager {
  currentWorldMapId = mapId;
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);
  const resources = new WorldResources();

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
      const origin = hitPoint ? hitPoint.clone() : object.getWorldPosition(new THREE.Vector3());
      object.userData.destroyed = true;
      if (object.userData.collider) {
        object.userData.collider.active = false;
      }
      object.traverse(unregisterHittable);
      resources.release(object);
      object.visible = false;
      if (object.parent) {
        object.parent.remove(object);
      }

      const bColor = object.userData.blockColor || 0x6a6458;
      const count = Math.floor(Math.random() * 5) + 8;

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
        resources.track(dMesh);
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
        resources.release(d.mesh);
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
    registerHittable(doorMesh);
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

      const buildingDoor = createDoor(x, y, z + d / 2 - wt / 2, dw, dh, 0.12, g, 'x');
      buildingDoor.hingeGroup.position.sub(new THREE.Vector3(x, y, z));
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
    resources.track(g);
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
    removeGroundPickup(item);
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

  function removeGroundPickup(item: GroundPickup): void {
    item.group.removeFromParent();
    resources.release(item.group);
    const index = groundPickups.indexOf(item);
    if (index >= 0) groundPickups.splice(index, 1);
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
      resources.track(propGroup);
      return {
        group: propGroup,
        interactNode: spawnPos.clone().add(new THREE.Vector3(0, 0, 1.2)),
        type: 'mainframe',
        boundingMesh: rackMesh,
        dispose: () => {
          propGroup.traverse(unregisterHittable);
          propGroup.removeFromParent();
          resources.release(propGroup);
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
      resources.track(propGroup);
      return {
        group: propGroup,
        interactNode: spawnPos.clone(),
        type: 'bio_cylinder',
        boundingMesh: canisterMesh,
        dispose: () => {
          propGroup.traverse(unregisterHittable);
          propGroup.removeFromParent();
          resources.release(propGroup);
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
    resources.track(coverGroup);

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

  let disposed = false;
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    resources.dispose();
    worldGroup.removeFromParent();
    worldGroup.clear();
    groundPickups.length = 0;
    activeDebris.length = 0;
    worldColliders.length = 0;
    hittableObjects.length = 0;
    doors.length = 0;
    structures.length = 0;
  }
  resources.track(worldGroup);

  return {
    mapId,
    updateWorld: (delta) => { if (!disposed) { updateDoors(delta); updateDebris(delta); } },
    getSpawnPoints: () => structures.map(({ center }) => ({ position: new THREE.Vector3(center.x, terrainHeight(center.x, center.z), center.z), rotation: new THREE.Euler() })),
    getExtractionZones: () => null,
    removeGroundPickup,
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

/** Offshore lifecycle types are kept alongside the owning scene implementation. */
export interface SpawnPoint {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

export type HelicopterState = 'IDLE_INBOUND' | 'HOVERING_EXFIL' | 'OUTBOUND_DEPART';
export type OffshorePhase = 'SIGNAL_BEACON' | 'HELIPAD_HOLDOUT' | 'BOARD_HELICOPTER' | 'DEPARTING' | 'COMPLETE';

export interface WorldTrigger {
  id: string;
  bounds: THREE.Box3;
  center: THREE.Vector3;
  radius: number;
}

export interface ExtractionZones {
  signalBeacon: WorldTrigger;
  holdout: WorldTrigger;
  exfil: WorldTrigger;
}

export interface HelicopterMesh {
  group: THREE.Group;
  mainRotor: THREE.Group;
  tailRotor: THREE.Group;
  rotorDisk: THREE.Mesh;
  tailDisk: THREE.Mesh;
  doors: readonly [THREE.Group, THREE.Group];
  defenseMount: THREE.Group;
  defenseBarrels: THREE.Group;
  defenseMuzzle: THREE.Object3D;
  defenseFlash: THREE.Mesh;
  defenseTracer: THREE.Line;
  navigationLight: THREE.PointLight;
  state: HelicopterState;
  rotorSpeed: number;
  update: (delta: number, time: number) => void;
  dispose: () => void;
}

export interface OffshoreState {
  phase: OffshorePhase;
  signalActivated: boolean;
  holdoutRemaining: number;
  holdoutDuration: number;
  inboundElapsed: number;
  departureElapsed: number;
  waveElapsed: number;
  helicopter: HelicopterMesh;
  zones: ExtractionZones;
  signalTerminal: THREE.Group;
  ocean: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  rain: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  lightningLight: THREE.DirectionalLight;
  hazardLights: readonly THREE.PointLight[];
  floodLights: readonly THREE.SpotLight[];
  activateSignal: () => boolean;
  tryBoard: (position: THREE.Vector3) => boolean;
}

/** Counts shared ownership, including textures; detached runtime objects remain owned. */
class WorldResources {
  private nodes = new Set<THREE.Object3D>();
  private geometries = new Map<THREE.BufferGeometry, number>();
  private materials = new Map<THREE.Material, number>();
  private textures = new Map<THREE.Texture, number>();
  private materialTextures = new Map<THREE.Material, Set<THREE.Texture>>();
  private lights = new Set<THREE.Light>();

  track(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (this.nodes.has(node)) return;
      this.nodes.add(node);
      const drawable = node as THREE.Mesh;
      if (drawable.geometry) this.geometries.set(drawable.geometry, (this.geometries.get(drawable.geometry) ?? 0) + 1);
      if (drawable.material) {
        for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) {
          if (!this.materials.has(material)) {
            const textures = new Set<THREE.Texture>();
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
            if (material instanceof THREE.ShaderMaterial) {
              for (const uniform of Object.values(material.uniforms)) {
                const values: unknown[] = Array.isArray(uniform.value) ? uniform.value : [uniform.value];
                for (const value of values) if (value instanceof THREE.Texture) textures.add(value);
              }
            }
            this.materialTextures.set(material, textures);
            textures.forEach((texture) => this.textures.set(texture, (this.textures.get(texture) ?? 0) + 1));
          }
          this.materials.set(material, (this.materials.get(material) ?? 0) + 1);
        }
      }
      if (node instanceof THREE.Light) this.lights.add(node);
    });
  }

  release(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (!this.nodes.delete(node)) return;
      const drawable = node as THREE.Mesh;
      if (drawable.geometry) {
        const count = (this.geometries.get(drawable.geometry) ?? 1) - 1;
        if (count > 0) this.geometries.set(drawable.geometry, count);
        else { drawable.geometry.dispose(); this.geometries.delete(drawable.geometry); }
      }
      if (drawable.material) {
        for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) {
          const count = (this.materials.get(material) ?? 1) - 1;
          if (count > 0) { this.materials.set(material, count); continue; }
          this.materialTextures.get(material)?.forEach((texture) => {
            const textureCount = (this.textures.get(texture) ?? 1) - 1;
            if (textureCount > 0) this.textures.set(texture, textureCount);
            else { texture.dispose(); this.textures.delete(texture); }
          });
          material.dispose();
          this.materials.delete(material);
          this.materialTextures.delete(material);
        }
      }
      if (node instanceof THREE.Light && this.lights.delete(node)) node.dispose();
    });
  }

  dispose(): void {
    this.geometries.forEach((_, geometry) => geometry.dispose());
    this.materials.forEach((_, material) => material.dispose());
    this.textures.forEach((_, texture) => texture.dispose());
    this.lights.forEach((light) => light.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.materialTextures.clear();
    this.lights.clear();
    this.nodes.clear();
  }
}

export const SHATTERED_WALL_LAYOUT = Object.freeze({
  seaY: 0,
  helipadY: 14,
  lowerDeckY: 8,
  controlY: 11,
  oceanGrateY: 2,
  helipadApothem: 22,
  catwalkCenter: 34,
  lobbyOrigin: new THREE.Vector3(0, 1000, 0),
});

const spawn = (x: number, y: number, z: number, yaw = 0): SpawnPoint => ({
  position: new THREE.Vector3(x, y, z), rotation: new THREE.Euler(0, yaw, 0, 'YXZ'),
});

export const SHATTERED_WALL_SPAWNS: Readonly<Record<GameMode, readonly SpawnPoint[]>> = {
  ffa: [spawn(-13, 14, -9, -2), spawn(13, 14, 9, 1), spawn(34, 11, 16, Math.PI), spawn(-34, 8, -12, -Math.PI / 2), spawn(12, 8, 34), spawn(34, 8, -12, Math.PI / 2), spawn(-12, 8, -34, Math.PI), spawn(-13, 14, 9, -1)],
  team: [spawn(-13, 14, -9, -Math.PI / 2), spawn(-13, 14, 9, -Math.PI / 2), spawn(-34, 8, -12, -Math.PI / 2), spawn(-34, 8, 12, -Math.PI / 2), spawn(13, 14, 9, Math.PI / 2), spawn(13, 14, -9, Math.PI / 2), spawn(34, 8, -12, Math.PI / 2), spawn(34, 11, 16, Math.PI)],
  zombie: [spawn(0, 8, -34, Math.PI), spawn(-34, 8, 0, -Math.PI / 2), spawn(34, 8, 0, Math.PI / 2), spawn(0, 2, 48), spawn(0, 8, 34)],
  extraction: [spawn(0, 8, 34, -Math.PI / 2), spawn(4, 8, 34), spawn(-4, 8, 34), spawn(-8, 8, 34)],
};

function insideHelipad(x: number, z: number, inset = 0): boolean {
  const half = 22 - inset;
  return Math.abs(x) <= half && Math.abs(z) <= half && Math.abs(x) + Math.abs(z) <= half * Math.SQRT2;
}

function offshoreTerrainHeight(x: number, z: number): number {
  if (insideHelipad(x, z)) return 14;
  if (x >= 28 && x <= 40 && z >= 10 && z <= 22) return 11;
  if (Math.abs(x) <= 2 && Math.abs(z) >= 22 && Math.abs(z) <= 34) return 8 + (34 - Math.abs(z)) * 6 / 16;
  if (Math.abs(z) <= 2 && Math.abs(x) >= 22 && Math.abs(x) <= 34) return 8 + (34 - Math.abs(x)) * 6 / 16;
  if (x >= 32 && x <= 36 && z >= 4 && z <= 10) return 8 + (z - 4) * 3 / 8;
  if (Math.abs(x) <= 2 && z >= 34 && z <= 46) return 8 - (z - 34) / 2;
  if (Math.abs(x) <= 5 && z >= 46 && z <= 51) return 2;
  if (Math.abs(x) <= 36 && Math.abs(z) <= 36 && (Math.abs(x) >= 32 || Math.abs(z) >= 32)) return 8;
  return -12;
}

function canvasTexture(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void, color = true): THREE.Texture {
  if (typeof document === 'undefined') {
    const fallback = new THREE.DataTexture(new Uint8Array([160, 160, 160, 255]), 1, 1);
    fallback.needsUpdate = true;
    return fallback;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Operation Shattered Wall requires a Canvas 2D context.');
  paint(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function industrialTexture(concrete = false): THREE.Texture {
  const texture = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = concrete ? '#565a58' : '#394444'; ctx.fillRect(0, 0, 512, 512);
    let seed = 7927;
    for (let i = 0; i < 12000; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = seed % 512; const y = (seed >>> 9) % 512;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(15,20,20,.12)' : 'rgba(200,200,180,.07)';
      ctx.fillRect(x, y, concrete ? 3 : 1, concrete ? 2 : 5);
    }
    if (!concrete) {
      ctx.strokeStyle = 'rgba(160,180,170,.2)'; ctx.lineWidth = 2;
      for (let y = 0; y < 512; y += 32) for (let x = 0; x < 512; x += 32) {
        ctx.beginPath(); ctx.moveTo(x + 5, y + 10); ctx.lineTo(x + 16, y + 21); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 20, y + 10); ctx.lineTo(x + 9, y + 21); ctx.stroke();
      }
      ctx.fillStyle = '#151b1b'; ctx.fillRect(0, 0, 512, 3); ctx.fillRect(0, 0, 3, 512);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(concrete ? 4 : 8, concrete ? 4 : 8);
  return texture;
}

function helipadTexture(): THREE.Texture {
  return canvasTexture(2048, 2048, (ctx) => {
    ctx.fillStyle = '#303c3c'; ctx.fillRect(0, 0, 2048, 2048);
    ctx.strokeStyle = '#202a2a'; ctx.lineWidth = 4;
    for (let i = 0; i <= 2048; i += 128) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 2048); ctx.moveTo(0, i); ctx.lineTo(2048, i); ctx.stroke(); }
    let seed = 7331;
    for (let i = 0; i < 26000; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      ctx.fillStyle = i % 2 ? 'rgba(190,205,190,.05)' : 'rgba(6,12,12,.07)';
      ctx.fillRect(seed % 2048, (seed >>> 11) % 2048, 6, 2);
    }
    ctx.strokeStyle = '#f5c344'; ctx.lineWidth = 28; ctx.beginPath(); ctx.arc(1024, 1024, 735, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#dce5d7'; ctx.lineWidth = 17; ctx.beginPath(); ctx.arc(1024, 1024, 640, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e8eee0'; ctx.fillRect(774, 664, 100, 720); ctx.fillRect(1174, 664, 100, 720); ctx.fillRect(854, 974, 340, 100);
    ctx.font = 'bold 46px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#e2b735';
    ctx.fillText('PACIFIC RIM // EXFIL 07', 1024, 1700);
    ctx.font = 'bold 36px monospace'; ctx.fillText('MAX LOAD 12 T', 1024, 420);
    ctx.fillStyle = '#d8dccc';
    for (let y = 64; y < 2048; y += 128) for (let x = 64; x < 2048; x += 128) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
  });
}

function radialTexture(rotor = false): THREE.Texture {
  return canvasTexture(128, 128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, rotor ? 20 : 0, 64, 64, 63);
    gradient.addColorStop(0, rotor ? 'rgba(135,145,142,0)' : 'rgba(255,250,200,1)');
    gradient.addColorStop(rotor ? 0.35 : 0.18, rotor ? 'rgba(165,178,174,.07)' : 'rgba(255,236,174,.45)');
    gradient.addColorStop(0.82, rotor ? 'rgba(175,180,175,.24)' : 'rgba(255,214,120,.04)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  });
}

function beamBetween(parent: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true; parent.add(mesh); return mesh;
}

/** Standalone procedural transport; callers own dispose(), with no external assets. */
export function buildHelicopterMesh(): HelicopterMesh {
  const resources = new WorldResources();
  const group = new THREE.Group(); group.name = 'ShatteredWall_ExtractionTransport';
  const hull = new THREE.MeshStandardMaterial({ color: 0x313d35, metalness: 0.65, roughness: 0.48 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x111b1c, metalness: 0.8, roughness: 0.33 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x141c1b, metalness: 0.45, roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x17343b, metalness: 0.2, roughness: 0.14, transparent: true, opacity: 0.72, clearcoat: 1, side: THREE.DoubleSide });
  const stencil = new THREE.MeshStandardMaterial({ color: 0xbdc9b1, roughness: 0.8 });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent = group) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  box(3.3, 0.38, 7.8, 0, 0.62, 0, hull);
  box(3.5, 0.45, 7.4, 0, 3.12, 0, hull);
  box(3.2, 2.35, 1.25, 0, 1.86, 3.15, hull);
  box(3.2, 1.0, 2.25, 0, 1.08, -3.1, hull).rotation.x = -0.13;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.12, 2.5, 4), hull);
  nose.rotation.set(Math.PI / 2, Math.PI / 4, 0); nose.scale.set(1, 1, 0.6); nose.position.set(0, 1.35, -4.2); nose.castShadow = true; group.add(nose);
  for (const side of [-1, 1]) {
    box(0.18, 2.1, 1.8, side * 1.65, 1.9, 2.8, hull);
    box(0.18, 2.1, 1.45, side * 1.65, 1.9, -2.4, hull);
    box(0.11, 0.3, 4.1, side * 1.7, 2.95, 0, trim);
    const canopy = box(0.08, 1.4, 2.5, side * 1.27, 2.22, -3.45, glass); canopy.rotation.y = side * 0.18;
    box(0.07, 0.2, 2.45, side * 1.33, 1.55, -3.4, trim);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 2.35, 12), hull);
    exhaust.rotation.x = Math.PI / 2; exhaust.position.set(side * 1.1, 3.4, 1.35); group.add(exhaust);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12, 1, true), trim);
    nozzle.rotation.x = Math.PI / 2; nozzle.position.set(side * 1.1, 3.4, 2.62); group.add(nozzle);
    beamBetween(group, new THREE.Vector3(side * 2.25, 0, -3.3), new THREE.Vector3(side * 2.25, 0, 3.6), 0.13, trim);
    beamBetween(group, new THREE.Vector3(side * 2.25, 0, -3.3), new THREE.Vector3(side * 2.25, 0.35, -4), 0.13, trim);
    for (const z of [-2.2, 2.3]) beamBetween(group, new THREE.Vector3(side * 1.3, 0.65, z), new THREE.Vector3(side * 2.25, 0.1, z), 0.1, trim);
    for (let i = 0; i < 3; i++) {
      box(0.65, 0.15, 0.8, side * 0.98, 1.07, -0.8 + i * 1.1, trim);
      box(0.12, 0.65, 0.8, side * 1.33, 1.48, -0.8 + i * 1.1, trim);
    }
    box(0.035, 0.1, 1.3, side * 1.75, 2.75, 2.65, stencil);
  }
  const windshield = box(2.42, 1.5, 0.06, 0, 2.2, -4.6, glass); windshield.rotation.x = -0.28;
  box(0.085, 1.6, 0.08, 0, 2.2, -4.64, trim).rotation.x = -0.28;
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.72, 7.7, 6), hull);
  tail.rotation.x = Math.PI / 2; tail.position.set(0, 2.25, 7.1); tail.castShadow = true; group.add(tail);
  box(0.22, 2.6, 1.65, 0, 3.3, 10.4, hull).rotation.x = 0.2;
  box(3.0, 0.13, 0.9, 0, 2.2, 8.7, hull);
  const navMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), navMat); beacon.position.set(0, 4.62, 10.3); group.add(beacon);
  const navigationLight = new THREE.PointLight(0xff2525, 0, 9, 2); navigationLight.position.copy(beacon.position); group.add(navigationLight);
  for (const side of [-1, 1]) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff3434 : 0x44ff99 }));
    marker.position.set(side * 1.85, 2.8, 2.8); group.add(marker);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.1, 12), trim); mast.position.y = 3.75; group.add(mast);
  const mainRotor = new THREE.Group(); mainRotor.position.y = 4.26; group.add(mainRotor);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.3, 12), trim); mainRotor.add(hub);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group(); blade.rotation.y = i * Math.PI / 2;
    box(0.55, 0.075, 7.0, 0, 0.06, 3.85, bladeMat, blade);
    box(0.55, 0.08, 0.45, 0, 0.06, 7.1, stencil, blade); mainRotor.add(blade);
  }
  const rotorAlpha = radialTexture(true);
  const blurMaterial = new THREE.MeshBasicMaterial({ map: rotorAlpha, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const rotorDisk = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), blurMaterial); rotorDisk.rotation.x = -Math.PI / 2; rotorDisk.position.y = 4.32; group.add(rotorDisk);
  const tailRotor = new THREE.Group(); tailRotor.position.set(0.35, 3.05, 10.5); tailRotor.rotation.z = Math.PI / 2; group.add(tailRotor);
  for (let i = 0; i < 4; i++) {
    const blade = box(0.16, 0.045, 1.1, 0, 0, 0.64, bladeMat, new THREE.Group());
    const pivot = blade.parent as THREE.Group; pivot.rotation.y = i * Math.PI / 2; tailRotor.add(pivot);
  }
  const tailDisk = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), blurMaterial.clone()); tailDisk.rotation.y = Math.PI / 2; tailDisk.position.set(0.42, 3.05, 10.5); group.add(tailDisk);
  const doorGroups: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  doorGroups.forEach((door, i) => {
    const side = i === 0 ? -1 : 1; door.position.set(side * 1.72, 1.86, 0);
    box(0.12, 2.1, 3.7, 0, 0, 0, hull, door); box(0.14, 0.75, 1.1, 0, 0.35, -0.45, glass, door);
    box(0.2, 0.08, 0.35, side * 0.09, -0.1, 1.2, trim, door); group.add(door);
  });
  const defenseMount = new THREE.Group(); defenseMount.position.set(1.9, 1.75, 0); group.add(defenseMount);
  box(.28, .28, .45, 0, 0, 0, trim, defenseMount);
  const defenseBarrels = new THREE.Group(); defenseMount.add(defenseBarrels);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .85, 8), trim);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(Math.cos(angle) * .075, Math.sin(angle) * .075, .55); defenseBarrels.add(barrel);
  }
  const defenseMuzzle = new THREE.Object3D(); defenseMuzzle.position.z = 1.03; defenseMount.add(defenseMuzzle);
  const defenseFlash = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd078, transparent: true, opacity: .9, depthWrite: false }));
  defenseFlash.position.z = 1.03; defenseFlash.visible = false; defenseMount.add(defenseFlash);
  const tracerGeometry = new THREE.BufferGeometry(); tracerGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const defenseTracer = new THREE.Line(tracerGeometry, new THREE.LineBasicMaterial({ color: 0xffca79, transparent: true, opacity: .8, depthWrite: false }));
  defenseTracer.frustumCulled = false; defenseTracer.visible = false; group.add(defenseTracer);
  resources.track(group);
  let disposed = false; let doorOpening = 0;
  const result: HelicopterMesh = {
    group, mainRotor, tailRotor, rotorDisk, tailDisk, doors: doorGroups, defenseMount, defenseBarrels, defenseMuzzle, defenseFlash, defenseTracer, navigationLight,
    state: 'IDLE_INBOUND', rotorSpeed: 0,
    update(delta, time) {
      if (disposed) return;
      const dt = Math.min(Math.max(delta, 0), 0.1);
      const targetSpeed = result.state === 'IDLE_INBOUND' && !group.visible ? 0 : result.state === 'HOVERING_EXFIL' ? 29 : 36;
      result.rotorSpeed = THREE.MathUtils.damp(result.rotorSpeed, targetSpeed, 1.7, dt);
      mainRotor.rotation.y = (mainRotor.rotation.y + result.rotorSpeed * dt) % (Math.PI * 2);
      tailRotor.rotation.y = (tailRotor.rotation.y + result.rotorSpeed * dt * 2.7) % (Math.PI * 2);
      const blur = THREE.MathUtils.smoothstep(result.rotorSpeed, 9, 25);
      (rotorDisk.material as THREE.MeshBasicMaterial).opacity = blur * 0.5;
      (tailDisk.material as THREE.MeshBasicMaterial).opacity = blur * 0.45;
      mainRotor.children.forEach((child) => { if (child instanceof THREE.Group) child.visible = blur < 0.85; });
      tailRotor.visible = blur < 0.85;
      doorOpening = THREE.MathUtils.damp(doorOpening, result.state === 'HOVERING_EXFIL' ? 1 : 0, 3.8, dt);
      doorGroups.forEach((door) => { door.position.z = doorOpening * 3.45; });
      navigationLight.intensity = Math.sin(time * 5.8) > 0.7 ? 3.2 : 0;
    },
    dispose() { if (disposed) return; disposed = true; group.removeFromParent(); resources.dispose(); group.clear(); },
  };
  return result;
}

const oceanVertexShader = `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormalOcean;
void main() {
  vec3 p = position;
  float a = p.x * 0.045 + uTime * 0.75;
  float b = p.z * 0.061 - uTime * 0.93;
  float c = (p.x + p.z) * 0.093 + uTime * 1.31;
  p.y += sin(a) * 1.05 + sin(b) * 0.68 + sin(c) * 0.24;
  float dx = cos(a) * 0.04725 + cos(c) * 0.02232;
  float dz = cos(b) * 0.04148 + cos(c) * 0.02232;
  vNormalOcean = normalize(mat3(modelMatrix) * vec3(-dx, 1.0, -dz));
  vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const oceanFragmentShader = `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uLightning;
varying vec3 vWorld;
varying vec3 vNormalOcean;
void main() {
  vec3 normal = normalize(vNormalOcean);
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 3.0);
  vec3 lightDirection = normalize(vec3(-0.5, 0.8, -0.2));
  float sparkle = pow(max(dot(reflect(-lightDirection, normal), view), 0.0), 96.0);
  float crest = smoothstep(0.8, 1.45, vWorld.y) * 0.2;
  float textureNoise = sin(vWorld.x * 2.7 + sin(vWorld.z * 3.2 + uTime)) * sin(vWorld.z * 4.1 - uTime) * 0.012;
  vec3 color = mix(vec3(0.012,0.033,0.039), vec3(0.11,0.19,0.21), fresnel);
  color += vec3(0.4,0.5,0.48) * (sparkle * 0.7 + crest + textureNoise);
  color += uLightning * vec3(0.15,0.2,0.24) * (0.2 + fresnel);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const rainVertexShader = `
#include <common>
#include <fog_pars_vertex>
uniform float uPixelRatio;
attribute vec3 velocity;
varying float vRainAlpha;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(170.0 / max(8.0, -mvPosition.z), 2.0, 14.0) * uPixelRatio;
  vRainAlpha = clamp(-velocity.y / 55.0, 0.35, 0.9);
  #include <fog_vertex>
}`;

const rainFragmentShader = `
#include <common>
#include <fog_pars_fragment>
varying float vRainAlpha;
void main() {
  float width = 1.0 - smoothstep(0.04,0.17,abs(gl_PointCoord.x - 0.5 + (gl_PointCoord.y - 0.5) * 0.18));
  float lengthFade = sin(gl_PointCoord.y * 3.14159265);
  float alpha = width * lengthFade * vRainAlpha * 0.55;
  if (alpha < 0.025) discard;
  gl_FragColor = vec4(0.55,0.67,0.7,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function createOffshoreWorld(scene: THREE.Scene, camera?: THREE.Camera): WorldManager {
  currentWorldMapId = 'shattered_wall';
  const root = new THREE.Group(); root.name = 'Operation_Shattered_Wall'; scene.add(root);
  const resources = new WorldResources();
  const worldColliders: WorldCollider[] = [];
  const doors: Door[] = [];
  const hittableObjects: THREE.Object3D[] = [];
  const groundPickups: GroundPickup[] = [];
  const structures: { center: THREE.Vector3 }[] = [];
  const surfaces: { bounds: THREE.Box3; height: (x: number, z: number) => number; contains?: (x: number, z: number) => boolean }[] = [];
  const debris: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const stormBackground = new THREE.Color(0x101c26);
  const stormFog = new THREE.FogExp2(0x14232c, 0.012);
  scene.background = stormBackground; scene.fog = stormFog;
  let disposed = false;
  const metalTexture = industrialTexture(); const concreteTexture = industrialTexture(true);
  const steel = new THREE.MeshStandardMaterial({ color: 0x68767a, metalness: 0.83, roughness: 0.56, map: metalTexture });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263237, metalness: 0.72, roughness: 0.64 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x794d32, metalness: 0.5, roughness: 0.9 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe0b638, metalness: 0.4, roughness: 0.55 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a9e98, roughness: 0.95, map: concreteTexture });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc65d });
  const registerHittable = (mesh: THREE.Object3D) => { if (!hittableObjects.includes(mesh)) hittableObjects.push(mesh); };
  const unregisterHittable = (mesh: THREE.Object3D) => { const i = hittableObjects.indexOf(mesh); if (i >= 0) hittableObjects.splice(i, 1); };
  const addCollider = (bounds: THREE.Box3, flags: Partial<WorldCollider> = {}): WorldCollider => {
    const collider: WorldCollider = { minX: bounds.min.x, maxX: bounds.max.x, minY: bounds.min.y, maxY: bounds.max.y, minZ: bounds.min.z, maxZ: bounds.max.z, active: true, ...flags };
    worldColliders.push(collider); return collider;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, solid = false, parent = root): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    if (parent === root) {
      registerHittable(mesh);
      if (solid) addCollider(new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)));
    }
    return mesh;
  };
  const addSurface = (minX: number, maxX: number, minZ: number, maxZ: number, height: number | ((x: number, z: number) => number), contains?: (x: number, z: number) => boolean) => {
    surfaces.push({ bounds: new THREE.Box3(new THREE.Vector3(minX, -20, minZ), new THREE.Vector3(maxX, 30, maxZ)), height: typeof height === 'number' ? () => height : height, contains });
  };
  const deckShape = new THREE.Shape();
  const radius = 22 / Math.cos(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 8 + i * Math.PI / 4; const x = Math.cos(angle) * radius; const z = Math.sin(angle) * radius;
    if (i === 0) deckShape.moveTo(x, -z); else deckShape.lineTo(x, -z);
  }
  deckShape.closePath();
  const plateGeometry = new THREE.ExtrudeGeometry(deckShape, { depth: 0.9, bevelEnabled: false }); plateGeometry.rotateX(-Math.PI / 2);
  const plate = new THREE.Mesh(plateGeometry, dark); plate.position.y = 13.1; plate.castShadow = true; plate.receiveShadow = true; root.add(plate); registerHittable(plate);
  const topGeometry = new THREE.ShapeGeometry(deckShape); topGeometry.rotateX(-Math.PI / 2);
  const positions = topGeometry.getAttribute('position'); const uv = topGeometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i) + 22) / 44, 1 - (positions.getZ(i) + 22) / 44);
  const padMaterial = new THREE.MeshStandardMaterial({ map: helipadTexture(), color: 0xbbc3b4, roughness: 0.38, metalness: 0.55 });
  const terrainMesh = new THREE.Mesh(topGeometry, padMaterial); terrainMesh.position.y = 14.015; terrainMesh.receiveShadow = true; terrainMesh.name = 'Helipad_ReinforcedDeck'; terrainMesh.userData.type = 'terrain'; root.add(terrainMesh); registerHittable(terrainMesh);
  addSurface(-22, 22, -22, 22, 14, insideHelipad);
  addCollider(new THREE.Box3(new THREE.Vector3(-22, 13.1, -22), new THREE.Vector3(22, 14, 22)), { isRamp: true });
  const blinkers: { mesh: THREE.Mesh; light?: THREE.PointLight; offset: number }[] = [];
  const rail = (ax: number, az: number, bx: number, bz: number, floor: number, safety = false) => {
    const start = new THREE.Vector3(ax, floor + 1.12, az); const end = new THREE.Vector3(bx, floor + 1.12, bz);
    const length = start.distanceTo(end); const count = Math.ceil(length / 3.3);
    beamBetween(root, start, end, 0.06, safety ? yellow : steel);
    beamBetween(root, start.clone().add(new THREE.Vector3(0, -0.5, 0)), end.clone().add(new THREE.Vector3(0, -0.5, 0)), 0.045, steel);
    for (let i = 0; i <= count; i++) {
      const point = start.clone().lerp(end, i / count); beamBetween(root, point.clone().add(new THREE.Vector3(0, -1.12, 0)), point, 0.06, steel);
    }
    const collisionSegments = Math.abs(ax - bx) > 0.01 && Math.abs(az - bz) > 0.01 ? Math.ceil(length / 0.6) : 1;
    for (let i = 0; i < collisionSegments; i++) {
      const a = start.clone().lerp(end, i / collisionSegments); const b = start.clone().lerp(end, (i + 1) / collisionSegments);
      const bounds = new THREE.Box3().setFromPoints([new THREE.Vector3(a.x, floor, a.z), new THREE.Vector3(b.x, floor + 1.15, b.z)]).expandByScalar(0.08);
      addCollider(bounds);
    }
  };
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + i * Math.PI / 4; const b = a + Math.PI / 4;
    const start = new THREE.Vector3(Math.cos(a) * radius, 14, Math.sin(a) * radius);
    const end = new THREE.Vector3(Math.cos(b) * radius, 14, Math.sin(b) * radius);
    beamBetween(root, start.clone().add(new THREE.Vector3(0, -0.05, 0)), end.clone().add(new THREE.Vector3(0, -0.05, 0)), 0.12, yellow);
    const mid = start.clone().lerp(end, 0.5); const axisAligned = Math.abs(start.x - end.x) < 0.01 || Math.abs(start.z - end.z) < 0.01;
    if (axisAligned) {
      const direction = end.clone().sub(start).normalize();
      const left = mid.clone().addScaledVector(direction, -2.5); const right = mid.clone().addScaledVector(direction, 2.5);
      rail(start.x, start.z, left.x, left.z, 14, true); rail(right.x, right.z, end.x, end.z, 14, true);
    } else rail(start.x, start.z, end.x, end.z, 14, true);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), glow.clone()); lens.position.copy(start).add(new THREE.Vector3(0, 0.28, 0)); root.add(lens);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 8), dark); housing.position.copy(start).add(new THREE.Vector3(0, 0.13, 0)); root.add(housing);
    let light: THREE.PointLight | undefined;
    if (i % 2 === 0) { light = new THREE.PointLight(0xffc24f, 2, 7, 2); light.position.copy(lens.position); root.add(light); }
    blinkers.push({ mesh: lens, light, offset: i * 0.7 });
  }
  for (const x of [-16, 16]) for (const z of [-16, 16]) {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 26, 12), concrete); pier.position.set(x, 1, z); pier.castShadow = true; root.add(pier); registerHittable(pier);
    box(4.2, 0.6, 4.2, x, 12.9, z, rust);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 0.6, 12), yellow); collar.position.set(x, 6, z); root.add(collar);
  }
  for (const side of [-1, 1]) {
    beamBetween(root, new THREE.Vector3(-16, 11.9, side * 16), new THREE.Vector3(16, 11.9, side * 16), 0.3, rust);
    beamBetween(root, new THREE.Vector3(side * 16, 11.9, -16), new THREE.Vector3(side * 16, 11.9, 16), 0.3, rust);
    beamBetween(root, new THREE.Vector3(-16, 1, side * 16), new THREE.Vector3(16, 11.9, side * 16), 0.18, rust);
    beamBetween(root, new THREE.Vector3(16, 1, side * 16), new THREE.Vector3(-16, 11.9, side * 16), 0.18, rust);
    beamBetween(root, new THREE.Vector3(side * 16, 1, -16), new THREE.Vector3(side * 16, 11.9, 16), 0.18, rust);
    beamBetween(root, new THREE.Vector3(side * 16, 1, 16), new THREE.Vector3(side * 16, 11.9, -16), 0.18, rust);
  }
  for (const z of [-34, 34]) {
    box(72, 0.4, 4, 0, 7.8, z, steel); addSurface(-36, 36, z - 2, z + 2, 8);
    if (z > 0) { rail(-36, 36, -2.5, 36, 8, true); rail(2.5, 36, 36, 36, 8, true); }
    else rail(-36, -36, 36, -36, 8, true);
    for (const side of [-1, 1]) rail(side * 2.5, z - Math.sign(z) * 2, side * 32, z - Math.sign(z) * 2, 8);
  }
  for (const x of [-34, 34]) {
    box(4, 0.4, 64, x, 7.8, 0, steel); addSurface(x - 2, x + 2, -32, 32, 8);
    if (x < 0) rail(x - 2, -32, x - 2, 32, 8, true);
    else { rail(36, -32, 36, 4, 8, true); rail(36, 22, 36, 32, 8, true); }
    for (const side of [-1, 1]) rail(x - Math.sign(x) * 2, side * 2.5, x - Math.sign(x) * 2, side * 32, 8);
  }
  const stairs = (bottom: THREE.Vector3, top: THREE.Vector3, width = 4) => {
    const direction = top.clone().sub(bottom); const run = Math.hypot(direction.x, direction.z); const count = Math.ceil(direction.y / 0.3);
    const along = new THREE.Vector3(direction.x, 0, direction.z).normalize(); const cross = new THREE.Vector3(-along.z, 0, along.x);
    for (let i = 0; i < count; i++) {
      const middle = bottom.clone().addScaledVector(direction, (i + 0.5) / count);
      const tread = box(width, 0.16, run / count + 0.05, middle.x, middle.y, middle.z, steel); tread.rotation.y = Math.atan2(along.x, along.z);
      const lip = box(width, 0.045, 0.06, middle.x + along.x * run / count / 2, middle.y + 0.1, middle.z + along.z * run / count / 2, yellow); lip.rotation.y = tread.rotation.y;
    }
    const bounds = new THREE.Box3().setFromPoints([bottom, top]); bounds.min.x -= Math.abs(cross.x) * width / 2; bounds.max.x += Math.abs(cross.x) * width / 2; bounds.min.z -= Math.abs(cross.z) * width / 2; bounds.max.z += Math.abs(cross.z) * width / 2;
    addSurface(bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z, (x, z) => bottom.y + THREE.MathUtils.clamp(((x - bottom.x) * along.x + (z - bottom.z) * along.z) / run, 0, 1) * direction.y);
    addCollider(bounds, { isStair: true });
    for (const side of [-1, 1]) {
      const a = bottom.clone().addScaledVector(cross, side * (width / 2 + 0.1)); const b = top.clone().addScaledVector(cross, side * (width / 2 + 0.1));
      beamBetween(root, a.clone().add(new THREE.Vector3(0, 1.1, 0)), b.clone().add(new THREE.Vector3(0, 1.1, 0)), 0.06, yellow);
      for (let i = 0; i <= 4; i++) { const p = a.clone().lerp(b, i / 4); beamBetween(root, p, p.clone().add(new THREE.Vector3(0, 1.1, 0)), 0.055, steel); }
    }
  };
  stairs(new THREE.Vector3(0, 8, -34), new THREE.Vector3(0, 14, -22));
  stairs(new THREE.Vector3(0, 8, 34), new THREE.Vector3(0, 14, 22));
  stairs(new THREE.Vector3(-34, 8, 0), new THREE.Vector3(-22, 14, 0));
  stairs(new THREE.Vector3(34, 8, 0), new THREE.Vector3(22, 14, 0));
  stairs(new THREE.Vector3(34, 8, 4), new THREE.Vector3(34, 11, 10));
  stairs(new THREE.Vector3(0, 2, 46), new THREE.Vector3(0, 8, 34));
  box(10, 0.35, 5, 0, 1.825, 48.5, steel); addSurface(-5, 5, 46, 51, 2);
  rail(-5, 46, -5, 51, 2); rail(5, 46, 5, 51, 2); rail(-5, 51, 5, 51, 2, true);
  box(12, 0.5, 12, 34, 10.75, 16, steel); addSurface(28, 40, 10, 22, 11);
  box(12, 0.4, 12, 34, 15.2, 16, dark, true);
  box(0.3, 4, 12, 28, 13, 16, dark, true); box(0.3, 4, 12, 40, 13, 16, dark, true);
  box(12, 4, 0.3, 34, 13, 22, dark, true);
  box(3.5, 4, 0.3, 29.75, 13, 10, dark, true); box(3.5, 4, 0.3, 38.25, 13, 10, dark, true); box(5, 0.65, 0.3, 34, 14.68, 10, dark, true);
  const windowMat = new THREE.MeshPhysicalMaterial({ color: 0x264a58, transparent: true, opacity: 0.62, metalness: 0.25, roughness: 0.15, clearcoat: 1 });
  box(0.035, 1.1, 6.8, 27.82, 13.2, 16, windowMat);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x18383e, emissive: 0x4ba2ae, emissiveIntensity: 0.6, roughness: 0.5 });
  for (let i = 0; i < 3; i++) { box(2.2, 1, 1.3, 30.5 + i * 2.5, 11.5, 20.4, dark, true); box(1.8, 0.9, 0.08, 30.5 + i * 2.5, 12.35, 20.2, screenMat); }
  const moduleLight = new THREE.PointLight(0x7fcedd, 14, 15, 2); moduleLight.position.set(34, 14.4, 16); root.add(moduleLight);
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? -15 : 15; const row = Math.floor(i / 2); const z = row === 1 ? 7 : -14 + row * 14;
    const crate = box(2.3, 1.5, 1.8, x, 14.75, z, new THREE.MeshStandardMaterial({ color: i % 2 ? 0x4f5e47 : 0x655d48, roughness: 0.86, metalness: 0.25 }), true);
    const collider = worldColliders[worldColliders.length - 1]; crate.userData = { type: 'building', destructible: true, degradation: 0, collider, blockColor: 0x4f5e47 };
    const lid = box(2.4, 0.12, 1.9, x, 15.54, z, dark);
    crate.add(lid); lid.position.set(0, 0.79, 0);
  }
  const dishGroup = new THREE.Group(); dishGroup.position.set(-15, 14, -15); root.add(dishGroup);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5.8, 10), steel); mast.position.y = 2.9; dishGroup.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2.15, 20, 12, 0, Math.PI * 2, 0, 0.65), new THREE.MeshStandardMaterial({ color: 0xa4aeb0, metalness: 0.62, roughness: 0.48, side: THREE.DoubleSide })); dish.position.y = 5.2; dish.rotation.z = -0.8; dishGroup.add(dish);
  beamBetween(dishGroup, new THREE.Vector3(0, 5.1, 0), new THREE.Vector3(1.9, 6.2, 0), 0.07, yellow);
  addCollider(new THREE.Box3(new THREE.Vector3(-15.5, 14, -15.5), new THREE.Vector3(-14.5, 19, -14.5)));
  const flareTexture = radialTexture();
  const floodLights: THREE.SpotLight[] = [];
  for (const x of [-25, 25]) for (const z of [-25, 25]) {
    beamBetween(root, new THREE.Vector3(x, 8, z), new THREE.Vector3(x, 22, z), 0.14, steel);
    for (const direction of [-1, 1]) {
      const lamp = box(1.1, 0.65, 0.4, x + direction * 0.65, 22, z, dark); lamp.rotation.x = -0.4;
      box(0.9, 0.5, 0.08, x + direction * 0.65, 21.96, z - Math.sign(z) * 0.25, glow);
      const flood = new THREE.SpotLight(0xffe5b7, 200, 85, Math.PI / 5, 0.45, 2); flood.position.set(x, 22, z); flood.target.position.set(direction * 7, 14, 0); root.add(flood, flood.target);
      floodLights.push(flood);
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture, color: 0xffe0a0, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending })); flare.position.copy(flood.position); flare.scale.set(1.8, 1.8, 1); root.add(flare);
      const lensSphere = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), glow); lensSphere.position.copy(flood.position); root.add(lensSphere);
    }
  }
  const fill = new THREE.HemisphereLight(0xa5c6db, 0x151914, 1.1); root.add(fill);
  const moon = new THREE.DirectionalLight(0xc6dbe2, 1.3); moon.position.set(-60, 95, -45); root.add(moon);
  moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.left = -50; moon.shadow.camera.right = 50; moon.shadow.camera.top = 50; moon.shadow.camera.bottom = -50; moon.shadow.camera.near = 1; moon.shadow.camera.far = 200; moon.shadow.bias = -0.001;
  const stormLight = new THREE.DirectionalLight(0xa9c7ff, 0); stormLight.position.set(100, 90, -160); root.add(stormLight);
  const oceanGeometry = new THREE.PlaneGeometry(1200, 1200, 180, 180); oceanGeometry.rotateX(-Math.PI / 2);
  const oceanMaterial = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLightning: { value: 0 } }]), vertexShader: oceanVertexShader, fragmentShader: oceanFragmentShader, fog: true });
  const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial); ocean.name = 'StormOcean'; ocean.frustumCulled = false; root.add(ocean);
  const rainCount = 6000; const rainPositions = new Float32Array(rainCount * 3); const rainVelocities = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 220; rainPositions[i * 3 + 1] = Math.random() * 90; rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
    rainVelocities[i * 3] = -5 - Math.random() * 3; rainVelocities[i * 3 + 1] = -32 - Math.random() * 20; rainVelocities[i * 3 + 2] = 1.5;
  }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3).setUsage(THREE.DynamicDrawUsage)); rainGeometry.setAttribute('velocity', new THREE.BufferAttribute(rainVelocities, 3));
  const rainMaterial = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uPixelRatio: { value: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, 2) } }]), vertexShader: rainVertexShader, fragmentShader: rainFragmentShader, transparent: true, depthWrite: false, fog: true });
  const rain = new THREE.Points(rainGeometry, rainMaterial); rain.name = 'HeavyRain_6000'; rain.frustumCulled = false; root.add(rain);
  const signalTerminal = new THREE.Group(); signalTerminal.name = 'SignalBeacon'; signalTerminal.position.set(8, 8, 34); root.add(signalTerminal);
  box(1.1, 1.3, 0.7, 0, 0.65, 0, dark, false, signalTerminal);
  const signalScreenMaterial = new THREE.MeshStandardMaterial({ color: 0x063644, emissive: 0x25b7d9, emissiveIntensity: 0.9, roughness: 0.25 });
  box(0.92, 0.55, 0.04, 0, 1.06, 0.37, signalScreenMaterial, false, signalTerminal);
  beamBetween(signalTerminal, new THREE.Vector3(0.35, 1.25, 0), new THREE.Vector3(0.35, 3.2, 0), 0.025, steel);
  const signalLight = new THREE.PointLight(0x29cbdf, 3, 8, 2); signalLight.position.set(0, 1.6, 0); signalTerminal.add(signalLight);
  addCollider(new THREE.Box3(new THREE.Vector3(7.45, 8, 33.65), new THREE.Vector3(8.55, 9.3, 34.35)));
  const trigger = (id: string, center: THREE.Vector3, size: THREE.Vector3, radius: number): WorldTrigger => ({ id, center, radius, bounds: new THREE.Box3().setFromCenterAndSize(center, size) });
  const zones: ExtractionZones = {
    signalBeacon: trigger('signal_beacon', new THREE.Vector3(8, 9, 34), new THREE.Vector3(6, 5, 6), 3),
    holdout: trigger('helipad_holdout', new THREE.Vector3(0, 16, 0), new THREE.Vector3(30, 5, 30), 15),
    exfil: trigger('helicopter_exfil', new THREE.Vector3(0, 16, 0), new THREE.Vector3(5, 3.5, 3.6), 2.5),
  };
  const holdoutMaterial = new THREE.MeshBasicMaterial({ color: 0x55d8ca, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false });
  const holdoutRing = new THREE.Mesh(new THREE.RingGeometry(14.8, 15, 96), holdoutMaterial); holdoutRing.rotation.x = -Math.PI / 2; holdoutRing.position.y = 14.035; holdoutRing.visible = false; root.add(holdoutRing);
  const helicopter = buildHelicopterMesh(); helicopter.group.position.set(95, 55, 100); helicopter.group.rotation.y = Math.PI / 7; helicopter.group.visible = false; scene.add(helicopter.group);
  const boardingStep = box(4.8, 0.32, 3.7, 0, 14.18, 0, yellow); boardingStep.visible = false; unregisterHittable(boardingStep);
  const boardingSurface = { bounds: new THREE.Box3(new THREE.Vector3(-2.4, 14, -1.85), new THREE.Vector3(2.4, 15, 1.85)), height: () => 14.34 };
  const lobbyGroup = new THREE.Group(); lobbyGroup.name = 'OffshoreArmoryLobby'; lobbyGroup.position.copy(SHATTERED_WALL_LAYOUT.lobbyOrigin); lobbyGroup.visible = false; root.add(lobbyGroup);
  box(16, 0.4, 18, 0, -0.2, -4, concrete, false, lobbyGroup); box(16, 5, 0.4, 0, 2.5, -12, concrete, false, lobbyGroup); box(0.4, 5, 18, -8, 2.5, -4, concrete, false, lobbyGroup); box(0.4, 5, 18, 8, 2.5, -4, concrete, false, lobbyGroup); box(16, 0.25, 18, 0, 5, -4, dark, false, lobbyGroup);
  for (const x of [-5, 5]) {
    box(2.8, 3.2, 0.3, x, 1.6, -7, steel, false, lobbyGroup);
    for (let i = 0; i < 5; i++) {
      const gx = x - 1.0 + i * 0.5;
      box(0.1, 1.45, 0.19, gx, 1.65, -6.74, dark, false, lobbyGroup); box(0.11, 0.5, 0.15, gx, 2.55, -6.74, steel, false, lobbyGroup); box(0.14, 0.45, 0.28, gx + 0.06, 1.25, -6.74, rust, false, lobbyGroup);
    }
    box(3.3, 0.12, 1.1, x, 0.8, -6, dark, false, lobbyGroup);
  }
  const wallSignTexture = canvasTexture(1024, 256, (ctx) => { ctx.fillStyle = '#101b23'; ctx.fillRect(0, 0, 1024, 256); ctx.fillStyle = '#edc155'; ctx.font = 'bold 70px monospace'; ctx.textAlign = 'center'; ctx.fillText('SHATTERED WALL', 512, 112); ctx.font = '30px monospace'; ctx.fillStyle = '#8ab3bb'; ctx.fillText('PACIFIC RIM // OFFSHORE ARMORY', 512, 178); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: wallSignTexture })); sign.position.set(0, 3.2, -11.75); lobbyGroup.add(sign);
  const stagingSpot = new THREE.SpotLight(0xdceafa, 100, 15, Math.PI / 7, 0.6, 2); stagingSpot.position.set(0, 4.7, 2); stagingSpot.target.position.set(0, 1.1, 0); lobbyGroup.add(stagingSpot, stagingSpot.target);
  const stagingFill = new THREE.PointLight(0x458fa5, 9, 14, 2); stagingFill.position.set(-4, 3.3, -3); lobbyGroup.add(stagingFill);
  lobbyGroup.add(new THREE.AmbientLight(0x607e88, 0.6));
  structures.push({ center: new THREE.Vector3(0, 14, 0) }, { center: new THREE.Vector3(34, 11, 16) }, { center: new THREE.Vector3(8, 8, 34) });
  const offshore: OffshoreState = {
    phase: 'SIGNAL_BEACON', signalActivated: false, holdoutRemaining: 60, holdoutDuration: 60, inboundElapsed: 0, departureElapsed: 0, waveElapsed: 0,
    helicopter, zones, signalTerminal, ocean, rain, lightningLight: stormLight,
    hazardLights: blinkers.flatMap(({ light }) => light ? [light] : []), floodLights,
    activateSignal() {
      if (disposed || offshore.phase !== 'SIGNAL_BEACON') return false;
      offshore.signalActivated = true; offshore.phase = 'HELIPAD_HOLDOUT'; holdoutRing.visible = true;
      signalScreenMaterial.emissive.setHex(0x45ff9c); signalLight.color.setHex(0x45ff9c); return true;
    },
    tryBoard(position) {
      if (disposed || offshore.phase !== 'BOARD_HELICOPTER' || helicopter.doors.some((door) => door.position.z < 2.8) || !zones.exfil.bounds.containsPoint(position)) return false;
      offshore.phase = 'DEPARTING'; offshore.departureElapsed = 0; helicopter.state = 'OUTBOUND_DEPART'; return true;
    },
  };
  function getHighestSurface(x: number, z: number, footY: number): number {
    let height = -12;
    for (const surface of surfaces) {
      if (x < surface.bounds.min.x - 0.04 || x > surface.bounds.max.x + 0.04 || z < surface.bounds.min.z - 0.04 || z > surface.bounds.max.z + 0.04 || (surface.contains && !surface.contains(x, z))) continue;
      const y = surface.height(x, z);
      if (y <= footY + 0.7 && y > height) height = y;
    }
    if (offshore.phase === 'BOARD_HELICOPTER' && Math.abs(x) <= 2.4 && Math.abs(z) <= 1.85 && footY >= 13.7) height = Math.max(height, boardingSurface.height());
    for (const collider of worldColliders) {
      if (!collider.active || collider.isRamp || collider.isStair) continue;
      if (x >= collider.minX && x <= collider.maxX && z >= collider.minZ && z <= collider.maxZ && collider.maxY <= footY + 0.45) height = Math.max(height, collider.maxY);
    }
    return height;
  }
  function moveEntityWithCollision(pos: THREE.Vector3, velocity: THREE.Vector3, radius: number, footY: number, headY: number, delta: number): void {
    const dt = Math.max(0, Math.min(delta, 0.1)); const subdivisions = Math.max(1, Math.ceil(Math.hypot(velocity.x, velocity.z) * dt / Math.max(0.1, radius * 0.5)));
    for (let step = 0; step < subdivisions; step++) for (const axis of ['x', 'z'] as const) {
      const x = pos.x + (axis === 'x' ? velocity.x * dt / subdivisions : 0); const z = pos.z + (axis === 'z' ? velocity.z * dt / subdivisions : 0);
      let blocked = false;
      for (const collider of worldColliders) {
        if (!collider.active || collider.isRamp || collider.isStair || collider.maxY <= footY + 0.45 || headY <= collider.minY || footY >= collider.maxY - 0.04) continue;
        if (x + radius > collider.minX && x - radius < collider.maxX && z + radius > collider.minZ && z - radius < collider.maxZ) { blocked = true; break; }
      }
      if (blocked) velocity[axis] = 0; else pos[axis] = axis === 'x' ? x : z;
    }
  }
  function removeGroundPickup(item: GroundPickup): void {
    item.group.removeFromParent(); resources.release(item.group); const index = groundPickups.indexOf(item); if (index >= 0) groundPickups.splice(index, 1);
  }
  function createGroundPickup(x: number, z: number, weaponTypeIndex: number, ammoAmount: number): GroundPickup {
    if (disposed) throw new Error('Cannot create a pickup in a disposed world.');
    const group = new THREE.Group(); group.position.set(x, offshoreTerrainHeight(x, z) + 0.55, z);
    const weapon = WEAPONS[weaponTypeIndex]; const material = new THREE.MeshStandardMaterial({ color: 0x6fb2b5, emissive: 0x12363b, metalness: 0.5, roughness: 0.55 });
    box(0.55, 0.22, 0.32, 0, 0, 0, material, false, group);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 20), new THREE.MeshBasicMaterial({ color: 0x65e8d2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = -0.22; group.add(halo);
    root.add(group); resources.track(group);
    const pickup: GroundPickup = { group, typeIndex: weaponTypeIndex, ammo: ammoAmount, label: weapon ? `${weapon.name.toUpperCase()} SUPPLY` : 'FIELD SUPPLY' }; groundPickups.push(pickup); return pickup;
  }
  function collectPickup(item: GroundPickup, onAcquire: (message: string) => void, states: { count?: number; reserve?: number }[]): void {
    const state = states[item.typeIndex]; const weapon = WEAPONS[item.typeIndex]; if (!state || !weapon) return;
    if (weapon.type === 'grenade' || weapon.type === 'consumable') state.count = Math.min(6, (state.count ?? 0) + item.ammo);
    else state.reserve = (state.reserve ?? 0) + item.ammo;
    onAcquire(`+${item.ammo} ${weapon.name.toUpperCase()}`); removeGroundPickup(item);
  }
  function damageEnvironmentalBlock(object: THREE.Object3D, amount: number, hitPoint?: THREE.Vector3): boolean {
    if (disposed || !(object instanceof THREE.Mesh) || !object.userData.destructible || object.userData.destroyed) return false;
    object.userData.degradation = (object.userData.degradation ?? 0) + Math.max(0, amount);
    if (object.userData.degradation < 100) return false;
    const origin = hitPoint ? hitPoint.clone() : object.getWorldPosition(new THREE.Vector3());
    object.userData.destroyed = true; const collider = object.userData.collider as WorldCollider | undefined; if (collider) collider.active = false;
    object.traverse(unregisterHittable); object.removeFromParent(); resources.release(object);
    for (let i = 0; i < 9; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0x5e6458, roughness: 0.9 })); mesh.position.copy(origin); root.add(mesh); resources.track(mesh);
      debris.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 7, 3 + Math.random() * 4, (Math.random() - 0.5) * 7), life: 2.5 });
    }
    return true;
  }
  function updateDebris(delta: number): void {
    for (let i = debris.length - 1; i >= 0; i--) {
      const piece = debris[i]; piece.life -= delta;
      if (piece.life <= 0) { piece.mesh.removeFromParent(); resources.release(piece.mesh); debris.splice(i, 1); continue; }
      piece.velocity.y -= 18 * delta; piece.mesh.position.addScaledVector(piece.velocity, delta); piece.mesh.rotation.x += delta * 4; piece.mesh.rotation.z += delta * 3;
      const floor = getHighestSurface(piece.mesh.position.x, piece.mesh.position.z, piece.mesh.position.y);
      if (piece.mesh.position.y <= floor + 0.08) { piece.mesh.position.y = floor + 0.08; piece.velocity.y = Math.abs(piece.velocity.y) * 0.25; piece.velocity.x *= 0.8; piece.velocity.z *= 0.8; }
    }
  }
  function spawnObjectiveProp(faction: 'usmc' | 'apex', customPos?: THREE.Vector3): ObjectivePropInstance {
    const group = new THREE.Group(); group.position.copy(customPos ?? new THREE.Vector3(8, 8, 34));
    const mesh = box(0.5, 0.8, 0.5, 0, 0.4, 0, new THREE.MeshStandardMaterial({ color: 0x37baa7, emissive: 0x134b43 }), false, group); root.add(group); resources.track(group); registerHittable(mesh);
    return { group, interactNode: group.position.clone(), type: faction === 'usmc' ? 'bio_cylinder' : 'mainframe', boundingMesh: mesh, dispose() { unregisterHittable(mesh); group.removeFromParent(); resources.release(group); } };
  }
  function spawnDeployableCover(position: THREE.Vector3, yaw: number): THREE.Group {
    const group = new THREE.Group(); group.position.copy(position); group.rotation.y = yaw;
    box(2.8, 1.25, 0.35, 0, 0.625, 0, new THREE.MeshStandardMaterial({ color: 0x38454a, metalness: 0.7, roughness: 0.6 }), false, group); root.add(group); group.updateWorldMatrix(true, true); group.traverse((node) => { if (node instanceof THREE.Mesh) registerHittable(node); });
    addCollider(new THREE.Box3().setFromObject(group)); resources.track(group); return group;
  }
  const navigationScratch = new THREE.Vector3();
  const navigationNodes = [
    new THREE.Vector3(0, 14, 0),
    new THREE.Vector3(0, 14, 18), new THREE.Vector3(-18, 14, 0), new THREE.Vector3(0, 14, -18), new THREE.Vector3(18, 14, 0),
    new THREE.Vector3(0, 8, 34), new THREE.Vector3(-34, 8, 0), new THREE.Vector3(0, 8, -34), new THREE.Vector3(34, 8, 0),
    new THREE.Vector3(-34, 8, 34), new THREE.Vector3(-34, 8, -34), new THREE.Vector3(34, 8, -34), new THREE.Vector3(34, 8, 34),
    new THREE.Vector3(34, 8, 4), new THREE.Vector3(34, 11, 12), new THREE.Vector3(34, 11, 16),
    new THREE.Vector3(0, 2, 46), new THREE.Vector3(0, 2, 48),
    new THREE.Vector3(6, 8, 34), new THREE.Vector3(6, 8, 32.7), new THREE.Vector3(10, 8, 32.7), new THREE.Vector3(10, 8, 34),
  ];
  const navigationEdges: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 6], [3, 7], [4, 8],
    [5, 9], [9, 6], [6, 10], [10, 7], [7, 11], [11, 8], [8, 13], [13, 12], [12, 21], [21, 20], [20, 19], [19, 18], [18, 5],
    [13, 14], [14, 15], [5, 16], [16, 17],
  ];
  const navigationLinks = navigationNodes.map(() => [] as { node: number; distance: number }[]);
  for (const [a, b] of navigationEdges) {
    const distance = navigationNodes[a].distanceTo(navigationNodes[b]);
    navigationLinks[a].push({ node: b, distance }); navigationLinks[b].push({ node: a, distance });
  }
  const navigationSource = { a: 0, b: 1, point: new THREE.Vector3() };
  const navigationDestination = { a: 0, b: 1, point: new THREE.Vector3() };
  const navigationDistances = navigationNodes.map(() => Infinity);
  const navigationPrevious = navigationNodes.map(() => -1);
  const navigationVisited = navigationNodes.map(() => false);
  const navigationPath: number[] = [];
  function nearestNavigationEdge(position: THREE.Vector3, floorY: number, result: typeof navigationSource): typeof navigationSource {
    let bestDistance = Infinity; let bestA = 0; let bestB = 1;
    const bestPoint = result.point;
    for (const [a, b] of navigationEdges) {
      const first = navigationNodes[a]; const last = navigationNodes[b];
      const dx = last.x - first.x; const dy = last.y - first.y; const dz = last.z - first.z;
      const t = THREE.MathUtils.clamp(((position.x - first.x) * dx + (floorY - first.y) * dy + (position.z - first.z) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
      const x = first.x + dx * t; const y = first.y + dy * t; const z = first.z + dz * t;
      const distance = (position.x - x) ** 2 + (floorY - y) ** 2 + (position.z - z) ** 2;
      if (distance < bestDistance) { bestDistance = distance; bestA = a; bestB = b; bestPoint.set(x, y, z); }
    }
    result.a = bestA; result.b = bestB; return result;
  }
  function getNavigationTarget(from: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
    const fromFloor = getHighestSurface(from.x, from.z, from.y);
    const targetFloor = getHighestSurface(target.x, target.z, target.y);
    if (fromFloor >= 13.7 && targetFloor >= 13.7 && insideHelipad(from.x, from.z) && insideHelipad(target.x, target.z)) return target;
    const source = nearestNavigationEdge(from, fromFloor, navigationSource); const destination = nearestNavigationEdge(target, targetFloor, navigationDestination);
    const sourceOffset = Math.hypot(source.point.x - from.x, source.point.z - from.z);
    if (sourceOffset > 0.7) return navigationScratch.copy(source.point);
    if (source.a === destination.a && source.b === destination.b) {
      return Math.hypot(destination.point.x - from.x, destination.point.z - from.z) > 0.7 ? navigationScratch.copy(destination.point) : target;
    }
    const distances = navigationDistances; const previous = navigationPrevious; const visited = navigationVisited;
    distances.fill(Infinity); previous.fill(-1); visited.fill(false);
    distances[source.a] = source.point.distanceTo(navigationNodes[source.a]); distances[source.b] = source.point.distanceTo(navigationNodes[source.b]);
    for (let step = 0; step < navigationNodes.length; step++) {
      let next = -1;
      for (let i = 0; i < distances.length; i++) if (!visited[i] && (next < 0 || distances[i] < distances[next])) next = i;
      if (next < 0 || !Number.isFinite(distances[next])) break;
      visited[next] = true;
      for (const link of navigationLinks[next]) if (distances[next] + link.distance < distances[link.node]) {
        distances[link.node] = distances[next] + link.distance; previous[link.node] = next;
      }
    }
    const goal = distances[destination.a] + destination.point.distanceTo(navigationNodes[destination.a]) <= distances[destination.b] + destination.point.distanceTo(navigationNodes[destination.b]) ? destination.a : destination.b;
    const path = navigationPath; path.length = 0;
    for (let next = goal; next >= 0; next = previous[next]) path.push(next);
    path.reverse();
    for (const node of path) if (Math.hypot(navigationNodes[node].x - from.x, navigationNodes[node].z - from.z) > 0.7) return navigationScratch.copy(navigationNodes[node]);
    return Math.hypot(destination.point.x - from.x, destination.point.z - from.z) > 0.7 ? navigationScratch.copy(destination.point) : target;
  }
  const exfilSize = new THREE.Vector3(5, 3.5, 3.6);
  let lightningCountdown = 7 + Math.random() * 10; let lightningEnvelope = 0;
  function updateWorld(delta: number, time: number, _mode: GameMode): void {
    if (disposed) return;
    // The lobby temporarily overrides these; reclaim the offshore atmosphere
    // when App resumes this world's gameplay update, reusing the same objects.
    if (scene.fog !== stormFog) scene.fog = stormFog;
    if (scene.background !== stormBackground) scene.background = stormBackground;
    const dt = Math.min(Math.max(Number.isFinite(delta) ? delta : 0, 0), 0.1); const clockTime = Number.isFinite(time) ? time : 0;
    oceanMaterial.uniforms.uTime.value = clockTime;
    for (let i = 0; i < rainCount; i++) {
      const j = i * 3; rainPositions[j] += rainVelocities[j] * dt; rainPositions[j + 1] += rainVelocities[j + 1] * dt; rainPositions[j + 2] += rainVelocities[j + 2] * dt;
      if (rainPositions[j + 1] <= 0) { rainPositions[j] = (Math.random() - 0.5) * 220; rainPositions[j + 1] = 85 + Math.random() * 5; rainPositions[j + 2] = (Math.random() - 0.5) * 220; }
      if (rainPositions[j] < -110) rainPositions[j] += 220; if (rainPositions[j + 2] > 110) rainPositions[j + 2] -= 220;
    }
    rainGeometry.getAttribute('position').needsUpdate = true;
    lightningCountdown -= dt;
    if (lightningCountdown <= 0) { lightningEnvelope = 1; lightningCountdown = 8 + Math.random() * 15; }
    lightningEnvelope = Math.max(0, lightningEnvelope - dt * 3.8);
    const lightning = lightningEnvelope * (Math.sin(lightningEnvelope * 45) > -0.25 ? 1 : 0.15); stormLight.intensity = lightning * 5; oceanMaterial.uniforms.uLightning.value = lightning;
    blinkers.forEach(({ mesh, light, offset }) => { const on = Math.sin(clockTime * 3 + offset) > 0; (mesh.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xffc24f : 0x6b481d); if (light) light.intensity = on ? 3 : 0.25; });
    dishGroup.rotation.y = Math.sin(clockTime * 0.15) * 0.45;
    holdoutMaterial.opacity = 0.1 + (Math.sin(clockTime * 2.2) + 1) * 0.065;
    if (offshore.phase === 'BOARD_HELICOPTER') {
      helicopter.group.position.set(0, 14.5 + Math.sin(clockTime * 1.8) * 0.06, 0); helicopter.group.rotation.y = 0;
      zones.exfil.center.copy(helicopter.group.position); zones.exfil.center.y += 1.5; zones.exfil.bounds.setFromCenterAndSize(zones.exfil.center, exfilSize);
    }
    if (offshore.phase === 'HELIPAD_HOLDOUT' && offshore.holdoutRemaining <= 12) {
      offshore.inboundElapsed += dt; helicopter.group.visible = true;
      const t = THREE.MathUtils.smoothstep(offshore.inboundElapsed / 12, 0, 1);
      helicopter.group.position.set(95 * (1 - t), 14.5 + 40.5 * (1 - t) + Math.sin(t * Math.PI) * 7, 100 * (1 - t)); helicopter.group.rotation.y = (1 - t) * Math.PI / 7;
    }
    if (offshore.phase === 'DEPARTING') {
      offshore.departureElapsed += dt; const t = offshore.departureElapsed;
      helicopter.group.position.set(t > 3 ? (t - 3) * (t - 3) * 1.5 : 0, 14.5 + t * t * 0.7, t > 3 ? -(t - 3) * (t - 3) * 2.1 : 0);
      if (t >= 8) offshore.phase = 'COMPLETE';
    }
    boardingStep.visible = offshore.phase === 'BOARD_HELICOPTER';
    helicopter.update(dt, clockTime); updateDebris(dt);
    if (camera) { rainMaterial.uniforms.uPixelRatio.value = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, 2); }
  }
  const updateDoors = (delta: number) => { for (const door of doors) { door.currentAngle = THREE.MathUtils.damp(door.currentAngle, door.targetAngle, 6, delta); door.hingeGroup.rotation.y = door.currentAngle; } };
  signalTerminal.traverse((node) => { if (node instanceof THREE.Mesh) registerHittable(node); });
  dishGroup.traverse((node) => { if (node instanceof THREE.Mesh) registerHittable(node); });
  for (const p of [[-11, -6], [11, 6], [-12, 34], [34, -14]] as const) createGroundPickup(p[0], p[1], 0, 60);
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || node === ocean || node === holdoutRing || node === boardingStep) return;
    let parent: THREE.Object3D | null = node;
    while (parent) { if (parent === lobbyGroup || groundPickups.some((pickup) => parent === pickup.group)) return; parent = parent.parent; }
    registerHittable(node);
  });
  resources.track(root);
  const defenseHits: HeliDefenseHit[] = [];
  let defenseCooldown = 0;
  const defenseOrigin = new THREE.Vector3(), defenseTarget = new THREE.Vector3(), defenseDirection = new THREE.Vector3();
  const defenseLocalOrigin = new THREE.Vector3(), defenseLocalTarget = new THREE.Vector3();
  const defenseRay = new THREE.Raycaster();
  const defenseObstacles: THREE.Object3D[] = [], defenseIntersections: THREE.Intersection[] = [];
  function updateHeliDefenses(delta: number, zombies: readonly Bot[]): readonly HeliDefenseHit[] {
    defenseHits.length = 0;
    helicopter.defenseFlash.visible = false; helicopter.defenseTracer.visible = false;
    if (disposed || !Number.isFinite(delta) || delta <= 0 || !helicopter.group.visible || (offshore.phase !== 'HELIPAD_HOLDOUT' && offshore.phase !== 'BOARD_HELICOPTER')) return defenseHits;
    const dt = Math.min(delta, .1);
    defenseCooldown = Math.max(0, defenseCooldown - dt);
    helicopter.defenseBarrels.rotation.z += dt * 35;
    if (defenseCooldown > 0) return defenseHits;
    helicopter.group.updateWorldMatrix(true, true);
    helicopter.defenseMuzzle.getWorldPosition(defenseOrigin);
    defenseObstacles.length = 0;
    for (const object of hittableObjects) if (object.userData.type !== 'botpart' && object.visible && object.userData.type !== 'pickup') defenseObstacles.push(object);
    let target: Bot | null = null, nearest = 75 * 75;
    for (const zombie of zombies) {
      if (!zombie.alive || !zombie.isZombie || zombie.team === 'blue') continue;
      defenseTarget.copy(zombie.pos); defenseTarget.y += 1.2;
      const distanceSq = defenseOrigin.distanceToSquared(defenseTarget);
      if (distanceSq >= nearest || distanceSq < .01) continue;
      defenseDirection.copy(defenseTarget).sub(defenseOrigin).normalize();
      defenseRay.set(defenseOrigin, defenseDirection); defenseRay.far = Math.sqrt(distanceSq) - .1;
      defenseIntersections.length = 0; defenseRay.intersectObjects(defenseObstacles, false, defenseIntersections);
      if (defenseIntersections.length) continue;
      target = zombie; nearest = distanceSq;
    }
    if (!target) return defenseHits;
    defenseTarget.copy(target.pos); defenseTarget.y += 1.2;
    helicopter.defenseMount.lookAt(defenseTarget); helicopter.group.updateWorldMatrix(true, true);
    helicopter.defenseMuzzle.getWorldPosition(defenseOrigin);
    defenseLocalOrigin.copy(defenseOrigin); helicopter.group.worldToLocal(defenseLocalOrigin);
    defenseLocalTarget.copy(defenseTarget); helicopter.group.worldToLocal(defenseLocalTarget);
    const positions = helicopter.defenseTracer.geometry.getAttribute('position') as THREE.BufferAttribute;
    positions.setXYZ(0, defenseLocalOrigin.x, defenseLocalOrigin.y, defenseLocalOrigin.z); positions.setXYZ(1, defenseLocalTarget.x, defenseLocalTarget.y, defenseLocalTarget.z); positions.needsUpdate = true;
    helicopter.defenseTracer.visible = true; helicopter.defenseFlash.visible = true;
    defenseCooldown = .1; defenseHits.push({ bot: target, damage: 16 });
    return defenseHits;
  }
  function dispose(): void {
    if (disposed) return; disposed = true;
    helicopter.dispose(); resources.dispose(); root.removeFromParent(); root.clear();
    worldColliders.length = doors.length = groundPickups.length = hittableObjects.length = structures.length = debris.length = surfaces.length = 0;
    if (scene.background === stormBackground) scene.background = previousBackground;
    if (scene.fog === stormFog) scene.fog = previousFog;
  }
  return {
    mapId: 'shattered_wall', updateHeliDefenses, terrainMesh, worldColliders, doors, hittableObjects, groundPickups, structures, offshore, lobbyGroup,
    sectorCenters: { 1: new THREE.Vector3(8, 8, 34), 2: new THREE.Vector3(0, 14, 0), 3: new THREE.Vector3(34, 11, 16), 4: new THREE.Vector3(0, 14, 0), 5: new THREE.Vector3(0, 14.5, 0) },
    hangarCorridorNodes: { mainframe: new THREE.Vector3(8, 8, 34), cryo: new THREE.Vector3(34, 11, 16), evac: new THREE.Vector3(0, 14, 0), center: new THREE.Vector3(0, 14, 0) },
    getSpawnPoints: (mode) => SHATTERED_WALL_SPAWNS[mode].map(({ position, rotation }) => ({ position: position.clone(), rotation: rotation.clone() })),
    getExtractionZones: () => zones, updateWorld, updateDoors, registerHittable, unregisterHittable, removeGroundPickup, createGroundPickup, collectPickup,
    getHighestSurface, moveEntityWithCollision, damageEnvironmentalBlock, updateDebris, spawnObjectiveProp, spawnDeployableCover, getNavigationTarget, dispose,
  };
}

export function tuneLegacyAtmosphere(scene: THREE.Scene, manager: WorldManager): void {
  const previousFog = scene.fog;
  const fog = new THREE.FogExp2(manager.mapId === 'hangar' ? 0x141c22 : 0x9eb8bd, manager.mapId === 'hangar' ? .014 : .0038);
  const floor = manager.terrainMesh.material;
  if (floor instanceof THREE.MeshStandardMaterial) { floor.roughness = manager.mapId === 'hangar' ? .28 : .68; floor.metalness = manager.mapId === 'hangar' ? .72 : .16; }
  const geometry = new THREE.PlaneGeometry(manager.mapId === 'hangar' ? 58 : 5, manager.mapId === 'hangar' ? 208 : 5);
  const reflection = new Reflector(geometry, { textureWidth: 512, textureHeight: 512, clipBias: .003, color: manager.mapId === 'hangar' ? 0x697c87 : 0x869ba1, multisample: 0 });
  reflection.name = 'Legacy_WetFloorReflection';
  reflection.rotation.x = -Math.PI / 2;
  reflection.position.set(0, manager.mapId === 'hangar' ? .012 : terrainHeight(0, 0) + .015, manager.mapId === 'hangar' ? -85 : 0);
  const material = reflection.material as THREE.ShaderMaterial;
  material.uniforms.reflectionOpacity = { value: manager.mapId === 'hangar' ? .23 : .12 };
  material.fragmentShader = material.fragmentShader.replace('uniform vec3 color;', 'uniform vec3 color;\nuniform float reflectionOpacity;').replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4( blendOverlay( base.rgb, color ), reflectionOpacity )');
  material.transparent = true; material.depthWrite = false;
  reflection.renderOrder = 1; reflection.visible = false; scene.add(reflection);
  const update = manager.updateWorld, dispose = manager.dispose;
  let disposed = false;
  manager.updateWorld = (delta, time, mode) => { if (disposed) return; scene.fog = fog; reflection.visible = true; update(delta, time, mode); };
  manager.dispose = () => { if (disposed) return; disposed = true; reflection.removeFromParent(); reflection.dispose(); geometry.dispose(); if (scene.fog === fog) scene.fog = previousFog; dispose(); };
}

let activeWorld: WorldManager | null = null;
let activeScene: THREE.Scene | null = null;

/** Compatibility factory used by the existing App.tsx engine. */
export function createWorld(scene: THREE.Scene, mapId: WorldMapId = 'training'): WorldManager {
  const manager = mapId === 'shattered_wall' ? createOffshoreWorld(scene) : createLegacyWorld(scene, mapId);
  if (mapId !== 'shattered_wall') tuneLegacyAtmosphere(scene, manager);
  activeWorld = manager; activeScene = scene;
  const disposeManager = manager.dispose;
  manager.dispose = () => { disposeManager(); if (activeWorld === manager) { activeWorld = null; activeScene = null; } };
  return manager;
}

/** New imperative lifecycle API; repeat initialization safely tears down the previous world. */
export function initWorld(scene: THREE.Scene, camera: THREE.Camera): WorldManager {
  if (activeWorld) cleanupWorld(activeScene ?? scene);
  const manager = createOffshoreWorld(scene, camera);
  activeWorld = manager; activeScene = scene;
  const disposeManager = manager.dispose;
  manager.dispose = () => { disposeManager(); if (activeWorld === manager) { activeWorld = null; activeScene = null; } };
  return manager;
}

export function updateWorld(delta: number, time: number, currentMode: GameMode): void {
  activeWorld?.updateWorld(delta, time, currentMode);
}

export function getSpawnPoints(mode: GameMode): SpawnPoint[] {
  return activeWorld ? activeWorld.getSpawnPoints(mode) : SHATTERED_WALL_SPAWNS[mode].map(({ position, rotation }) => ({ position: position.clone(), rotation: rotation.clone() }));
}

export function getExtractionZones(): ExtractionZones | null {
  return activeWorld?.getExtractionZones() ?? null;
}

export function cleanupWorld(scene: THREE.Scene): void {
  if (activeScene && activeScene !== scene) return;
  activeWorld?.dispose(); activeWorld = null; activeScene = null;
}

const EMPTY_HELI_HITS: readonly HeliDefenseHit[] = Object.freeze([]);
/** App applies returned hits through its existing damage and kill pipeline. */
export function updateHeliDefenses(delta: number, zombies: readonly Bot[]): readonly HeliDefenseHit[] {
  return activeWorld?.updateHeliDefenses?.(delta, zombies) ?? EMPTY_HELI_HITS;
}
