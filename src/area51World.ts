import * as THREE from "three";
import { buildHelicopterMesh } from "./world";
import type {
  WorldManager,
  SpawnPoint,
  ObjectivePropInstance,
  ExtractionZones,
} from "./world";
import type { WorldCollider, GroundPickup, GameMode, Bot } from "./types";
import { WorldResources } from "./worldResources";
import { buildArea51Vehicle } from "./area51Assets";
import { createWeaponAssembly } from "./weaponModels";
import { WEAPONS } from "./weapons";
import { audioManager } from "./campaignAudio";
import { traversalBlocked } from "./tacticalNavigation";

export const AREA51_LAYOUT = Object.freeze({
  objective: new THREE.Vector3(15, 1.2, -115),
  liftBottom: new THREE.Vector3(-12, 0, -136),
  liftTop: new THREE.Vector3(-12, 15, -141),
  console: new THREE.Vector3(-8, 16, -146),
  boss: new THREE.Vector3(0, 15, -170),
  helipad: new THREE.Vector3(0, 15, -219),
});
export type FacilityPhase =
  | "INFILTRATE"
  | "ARRIVAL"
  | "INTRO"
  | "BOSS"
  | "BOARD"
  | "DEPARTING"
  | "COMPLETE";
export interface FacilityInteraction {
  id: string;
  position: THREE.Vector3;
  weaponIndex?: number;
  kind: "weapon" | "ammo";
}
export interface Area51Facility {
  phase: FacilityPhase;
  faction: "usmc" | "apex";
  objectiveComplete: boolean;
  introElapsed: number;
  departureElapsed: number;
  helicopter: ReturnType<typeof buildHelicopterMesh>;
  interactions: readonly FacilityInteraction[];
  objectivePosition: THREE.Vector3;
  liftBottom: THREE.Vector3;
  liftTop: THREE.Vector3;
  consolePosition: THREE.Vector3;
  bossPosition: THREE.Vector3;
  setFaction(faction: "usmc" | "apex"): void;
  activateEvac(): boolean;
  openBlastDoors(): void;
  tryBoard(position: THREE.Vector3): boolean;
  transferLift(
    position: THREE.Vector3,
    destinationFloor: number,
    eyeOffset?: number,
    animate?: boolean,
  ): boolean;
  isNearLift(position: THREE.Vector3): boolean;
  readonly liftMoving: boolean;
  readonly bulkheadOpen: boolean;
  readonly bulkheadMoving: boolean;
  isNearBulkhead(position: THREE.Vector3): boolean;
  openBulkhead(): boolean;
  getZone(position: THREE.Vector3): 1 | 2 | 3 | 4;
  updateCamera(
    camera: THREE.Camera,
    player: { pos: THREE.Vector3; yaw: number; pitch?: number },
  ): void;
  readonly controlsLocked: boolean;
}
const spawn = (x: number, y: number, z: number, yaw = 0): SpawnPoint => ({
  position: new THREE.Vector3(x, y, z),
  rotation: new THREE.Euler(0, yaw, 0),
});
export const AREA51_SPAWNS: readonly SpawnPoint[] = [
  spawn(-8, 0, -7),
  spawn(8, 0, -10),
  spawn(-6, 0, -27),
  spawn(11, 0, -30),
  spawn(27.5, 0, -48),
  spawn(27.5, 0, -64),
  spawn(27.5, 0, -83),
  spawn(7, 0, -107),
  spawn(23, 0, -109),
  spawn(22, 0, -122),
  spawn(7, 0, -123),
  spawn(-12, 15, -148),
  spawn(12, 15, -149),
  spawn(-12, 15, -170),
  spawn(12, 15, -176),
  spawn(0, 15, -192),
];
export function getArea51SpawnPoints(mode: GameMode): SpawnPoint[] {
      const points =
        mode === "extraction"
          ? AREA51_SPAWNS.slice(0, 4)
          : mode === "team"
            ? [...AREA51_SPAWNS.slice(0, 4), ...AREA51_SPAWNS.slice(11, 15)]
            : AREA51_SPAWNS;
      return points.map((p) => ({
        position: p.position.clone(),
        rotation: p.rotation.clone(),
      }));
}

export function area51TerrainHeight(_x: number, z: number): number {
  return z <= -140 ? 15 : 0;
}

/** Entire facility is world-owned; runtime props and shared resources have counted ownership. */
export function createArea51World(scene: THREE.Scene): WorldManager {
  const root = new THREE.Group();
  root.name = "Area51_Facility";
  scene.add(root);
  const resources = new WorldResources(),
    worldColliders: WorldCollider[] = [],
    hittableObjects: THREE.Object3D[] = [],
    groundPickups: GroundPickup[] = [];
  let disposed = false;
  const previousFog = scene.fog,
    previousBackground = scene.background;
  const fog = new THREE.FogExp2(0x090f15, 0.008),
    background = new THREE.Color(0x050a10);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x252e31,
    roughness: 0.48,
    metalness: 0.27,
  });
  floorMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vEpoxy;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvEpoxy=(modelMatrix*vec4(position,1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vEpoxy;")
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nvec2 tile=fract(vEpoxy.xz*.5);float seam=step(.018,min(min(tile.x,tile.y),min(1.0-tile.x,1.0-tile.y)));float grain=fract(sin(dot(floor(vEpoxy.xz*35.0),vec2(127.1,311.7)))*43758.5453);diffuseColor.rgb*=mix(.43,.92+grain*.14,seam);",
      );
  };
  floorMat.customProgramCacheKey = () => "area51-epoxy-v1";
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x444b4b,
    roughness: 0.9,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x263139,
    roughness: 0.55,
    metalness: 0.75,
  });
  const sterile = new THREE.MeshStandardMaterial({
    color: 0xa5b0ac,
    roughness: 0.55,
    metalness: 0.16,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x4b5740,
    roughness: 0.86,
  });
  const amber = new THREE.MeshBasicMaterial({ color: 0xc89c3d }),
    black = new THREE.MeshStandardMaterial({ color: 0x101719, roughness: 0.8 });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x47d1de }),
    red = new THREE.MeshBasicMaterial({ color: 0xba3028 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x537a82,
    transparent: true,
    opacity: 0.25,
    roughness: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const surfaces: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    y: number;
    contains?: (x: number, z: number) => boolean;
  }[] = [];
  const staticBoxes = new Map<
    THREE.Material,
    { matrix: THREE.Matrix4; hit: boolean }[]
  >();
  function collider(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ): WorldCollider {
    const c = {
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      active: true,
    };
    worldColliders.push(c);
    return c;
  }
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
    solid = false,
    parent: THREE.Group = root,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    if (solid) mesh.userData.collider = collider(w, h, d, x, y, z);
    return mesh;
  }
  function batch(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
    solid = false,
    ry = 0,
  ) {
    const list = staticBoxes.get(mat) ?? [];
    list.push({
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
        new THREE.Vector3(w, h, d),
      ),
      hit: true,
    });
    staticBoxes.set(mat, list);
    if (solid) collider(w, h, d, x, y, z);
  }
  function floor(
    w: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat = floorMat,
  ) {
    const mesh = box(w, 0.4, d, x, y - 0.2, z, mat);
    surfaces.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      y,
    });
    return mesh;
  }
  function lamp(
    x: number,
    y: number,
    z: number,
    color: number,
    power: number,
    range: number,
  ) {
    batch(2, 0.12, 0.35, x, y, z, black);
    batch(
      1.8,
      0.04,
      0.22,
      x,
      y - 0.09,
      z,
      new THREE.MeshBasicMaterial({ color }),
    );
    const light = new THREE.PointLight(color, power, range, 2);
    light.position.set(x, y - 0.25, z);
    root.add(light);
    return light;
  }
  function sign(
    text: string,
    x: number,
    y: number,
    z: number,
    w = 4,
    h = 0.8,
    rotation = 0,
    color = "#b8d1cc",
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#111d22";
      ctx.fillRect(0, 0, 768, 128);
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.font = "bold 40px monospace";
      ctx.fillText(text, 384, 77);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    root.add(mesh);
    return mesh;
  }
  function cylinder(
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
    parent: THREE.Group = root,
  ) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function crate(x: number, y: number, z: number, w = 2, h = 1.5, d = 2) {
    batch(w, h, d, x, y + h / 2, z, crateMat, true);
    for (const side of [-1, 1])
      batch(w + 0.03, 0.12, d + 0.03, x, y + h / 2 + side * h * 0.35, z, black);
    batch(0.12, h + 0.03, d + 0.03, x - w * 0.35, y + h / 2, z, steel);
    batch(0.12, h + 0.03, d + 0.03, x + w * 0.35, y + h / 2, z, steel);
  }
  function walls(
    w: number,
    d: number,
    x: number,
    y: number,
    z: number,
    h: number,
    mat: THREE.Material,
    open: {
      north?: [number, number];
      south?: [number, number];
      east?: [number, number];
      west?: [number, number];
    } = {},
  ) {
    function segment(
      axis: "x" | "z",
      fixed: number,
      min: number,
      max: number,
      gap?: [number, number],
    ) {
      const ranges = gap
        ? [
            [min, Math.min(max, Math.max(min, gap[0]))],
            [Math.min(max, Math.max(min, gap[1])), max],
          ]
        : [[min, max]];
      for (const [a, b] of ranges)
        if (b > a) {
          const length = b - a;
          batch(
            axis === "x" ? length : 0.6,
            h,
            axis === "z" ? length : 0.6,
            axis === "x" ? (a + b) / 2 : fixed,
            y + h / 2,
            axis === "z" ? (a + b) / 2 : fixed,
            mat,
            true,
          );
        }
    }
    segment("x", z - d / 2, x - w / 2, x + w / 2, open.north);
    segment("x", z + d / 2, x - w / 2, x + w / 2, open.south);
    segment("z", x - w / 2, z - d / 2, z + d / 2, open.west);
    segment("z", x + w / 2, z - d / 2, z + d / 2, open.east);
    batch(w, 0.35, d, x, y + h + 0.18, z, black, true);
  }
  // ZONE 1 — vehicle staging, parking bays and persistent supplies.
  const terrainMesh = floor(40, 40, 0, 0, -20);
  walls(40, 40, 0, 0, -20, 8, concrete, { east: [-39, -33] });
  sign("AREA 51 // STAGING 01", 0, 5, -39.65, 8, 1);
  for (let z = -4; z > -38; z -= 3)
    for (const x of [-19.65, 19.65]) batch(0.12, 7, 0.12, x, 3.5, z, steel);
  for (let z = -6; z > -36; z -= 2.4)
    for (const x of [-11, 11])
      batch(0.18, 0.025, 1.15, x, 0.014, z, amber, false, -0.5);
  for (const [x, z] of [
    [-10, -14],
    [8, -28],
  ] as const)
    for (const offset of [-5, 5])
      batch(0.18, 0.025, 10, x + offset, 0.015, z, amber);
  const tank = buildArea51Vehicle("abrams");
  tank.position.set(-13, 0, -29);
  tank.rotation.y = 0.25;
  root.add(tank);
  collider(6, 3, 10, -13, 1.5, -29);
  const humvee = buildArea51Vehicle("humvee");
  humvee.position.set(1, 0, -20);
  humvee.rotation.y = -0.25;
  root.add(humvee);
  collider(4, 3.3, 6, 1, 1.65, -20);
  for (const [x, z] of [
    [-15, -9],
    [-13, -11],
    [9, -34],
    [12, -34],
    [9, -4],
  ] as const)
    crate(x, 0, z);
  const interactions: FacilityInteraction[] = [];
  for (let rack = 0; rack < 2; rack++) {
    const z = -10 - rack * 9;
    batch(0.3, 3.3, 5.5, 19.2, 1.65, z, black, true);
    for (let i = 0; i < 3; i++) {
      const id = ["ar", "shotgun", "smg"][i],
        assembly = createWeaponAssembly(id);
      assembly.root.position.set(18.8, 1.55, z - 1.8 + i * 1.8);
      assembly.root.rotation.set(0, Math.PI / 2, 0.15);
      root.add(assembly.root);
      const index = WEAPONS.findIndex((w) => w.id === id);
      interactions.push({
        id: `rack-${rack}-${id}`,
        kind: "weapon",
        position: new THREE.Vector3(17.7, 1.4, z - 1.8 + i * 1.8),
        weaponIndex: index,
      });
    }
    sign("E // FIELD ARMORY", 18.99, 3.65, z, 5, 0.65, -Math.PI / 2, "#deb24f");
  }
  for (const z of [-25, -29]) {
    crate(18, 0, z, 2, 1, 2);
    interactions.push({
      id: `ammo-${z}`,
      kind: "ammo",
      position: new THREE.Vector3(17, 1, z),
    });
  }
  lamp(-8, 7.5, -10, 0xffd19c, 260, 28);
  lamp(7, 7.5, -31, 0xffd19c, 300, 27);
  // Centered right-turn pressure bulkhead, with a latch-first hinge sequence.
  floor(10, 6, 22, 0, -36);
  walls(10, 6, 22, 0, -36, 6, steel, { west: [-39, -33], east: [-39, -33] });
  for (const z of [-32.8, -39.2]) batch(0.45, 6, 0.5, 20, 3, z, steel, true);
  batch(0.5, 0.5, 6.4, 20, 5.8, -36, steel);
  const vaultFrame = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.2, 8, 32), steel);
  vaultFrame.rotation.y = Math.PI / 2;
  vaultFrame.position.set(20, 3, -36);
  root.add(vaultFrame);
  // The rectangular surround seals the corners outside the circular aperture.
  for (const side of [-1, 1]) {
    batch(0.5, 6, 0.3, 20, 3, -36 + side * 2.9, steel, true);
    batch(0.5, 0.3, 6, 20, 3 + side * 2.85, -36, steel, side === 1);
  }
  const vaultHinge = new THREE.Group();
  vaultHinge.name = "Area51_DeconBulkheadHinge";
  vaultHinge.position.set(20, 0, -33.2);
  root.add(vaultHinge);
  const vaultPlate = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.36, 32), steel);
  vaultPlate.name = "Area51_DeconBulkheadPlate";
  vaultPlate.rotation.z = Math.PI / 2;
  vaultPlate.position.set(0, 3, -2.8);
  vaultHinge.add(vaultPlate);
  for (const y of [1.1, 4.9]) box(0.6, 0.45, 0.6, 0, y, 0, black, false, vaultHinge);
  const vaultWheel = new THREE.Group();
  vaultWheel.name = "Area51_DeconLatchWheel";
  vaultWheel.position.set(-0.37, 3, -2.8);
  vaultHinge.add(vaultWheel);
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.07, 6, 20), amber);
  wheelRing.rotation.y = Math.PI / 2;
  vaultWheel.add(wheelRing);
  for (let i = 0; i < 4; i++) {
    const spoke = box(0.08, 1.2, 0.08, 0, 0, 0, steel, false, vaultWheel);
    spoke.rotation.x = i * Math.PI / 4;
  }
  const vaultCollider = collider(0.55, 5.6, 5.8, 20, 2.8, -36);
  // Build the navigation graph through the aperture before enabling its runtime gate.
  vaultCollider.active = false;
  let vaultElapsed = -1;
  let vaultOpened = false;
  sign("E // UNSEAL DECONTAMINATION", 19.55, 5.3, -36, 5.6, 0.45, -Math.PI / 2);
  lamp(18, 4.8, -36, 0xffcd83, 35, 9);
  // ZONE 2 — six-metre decon spine and lit observation rooms.
  floor(6, 64, 27.5, 0, -68);
  walls(6, 64, 27.5, 0, -68, 6, sterile, {
    north: [24.5, 30.5],
    west: [-39, -36],
  });
  const flickerLights: THREE.PointLight[] = [];
  for (const z of [-48, -65, -83])
    flickerLights.push(lamp(27.5, 5.6, z, 0xc5e5df, 65, 19));
  for (const z of [-50, -68, -86]) {
    // Inset viewing panes use a genuine opening in the east wall, rather than opaque wall backing.
    const wall = worldColliders.find(
      (c) => c.minX > 30 && c.maxX < 31 && c.minZ < -99,
    );
    if (wall) wall.active = false;
    const pane = box(0.09, 2.4, 5.5, 30.22, 2.6, z, glass);
    pane.renderOrder = 2;
    for (const y of [1.35, 3.85]) batch(0.25, 0.13, 6, 30.2, y, z, steel);
    for (const dz of [-3, 3]) batch(0.25, 2.6, 0.13, 30.2, 2.6, z + dz, steel);
    floor(5.5, 8, 33.3, 0, z);
    walls(5.5, 8, 33.3, 0, z, 5, sterile, { west: [z - 3, z + 3] });
    collider(0.2, 5, 6, 30.3, 2.5, z); // impassable double-paned glass
    batch(3, 0.2, 1.2, 33.3, 0.9, z, steel);
    batch(0.08, 0.55, 1.2, 33.3, 1.3, z, cyan);
    lamp(33.3, 4.7, z, 0x67c8c4, 25, 10);
    sign(
      "DENIED",
      24.85,
      2,
      -(Math.abs(z) + 2),
      1.4,
      0.45,
      Math.PI / 2,
      "#e45440",
    );
    for (let x = 25; x < 30; x += 1)
      batch(0.4, 0.025, 1.3, x, 0.02, z + 3, black);
  }
  // Replace the continuous east wall with panels between the observation openings.
  staticBoxes.forEach((list, mat) => {
    staticBoxes.set(
      mat,
      list.filter((entry) => {
        const p = new THREE.Vector3().setFromMatrixPosition(entry.matrix);
        const scale = new THREE.Vector3().setFromMatrixScale(entry.matrix);
        return !(Math.abs(p.x - 30.5) < 0.01 && scale.z > 60);
      }),
    );
  });
  for (const [a, b] of [
    [-100, -89],
    [-83, -71],
    [-65, -53],
    [-47, -36],
  ])
    batch(0.6, 6, b - a, 30.5, 3, (a + b) / 2, sterile, true);
  for (const z of [-50, -68, -86]) {
    batch(0.6, 1.3, 6, 30.5, 0.65, z, sterile, true);
    batch(0.6, 2.1, 6, 30.5, 4.95, z, sterile, true);
  }
  for (let z = -41; z > -98; z -= 3) {
    batch(5.7, 0.13, 0.12, 27.5, 5.3, z, steel);
    batch(0.16, 5.4, 0.16, 24.9, 2.7, z, steel);
  }
  for (const x of [25.1, 29.9]) {
    const pipe = cylinder(0.15, 62, x, 5, -68, steel);
    pipe.rotation.x = Math.PI / 2;
  }
  const blood = new THREE.MeshStandardMaterial({
    color: 0x411916,
    roughness: 0.84,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  for (const z of [-53, -77, -95]) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.0, 15), blood);
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(1, 0.55, 1);
    pool.position.set(26, 0.025, z);
    root.add(pool);
  }
  const gurney = new THREE.Group();
  gurney.position.set(25.5, 0.1, -74);
  gurney.rotation.set(0.65, 0.25, 0.9);
  root.add(gurney);
  box(1.8, 0.15, 0.7, 0, 0.9, 0, sterile, false, gurney);
  for (const x of [-0.7, 0.7])
    for (const z of [-0.25, 0.25])
      box(0.06, 0.8, 0.06, x, 0.45, z, steel, false, gurney);
  collider(1.5, 1.1, 2, 25.3, 0.55, -74);
  // ZONE 3 — authored octagon with actual cut corners, central objective and perimeter systems.
  const octagon = [
    [-9, -15],
    [9, -15],
    [15, -9],
    [15, 9],
    [9, 15],
    [-9, 15],
    [-15, 9],
    [-15, -9],
  ];
  const shape = new THREE.Shape();
  octagon.forEach(([x, z], i) =>
    i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
  );
  shape.closePath();
  const labFloor = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat);
  labFloor.rotation.x = -Math.PI / 2;
  labFloor.position.set(15, 0.005, -115);
  labFloor.receiveShadow = true;
  root.add(labFloor);
  surfaces.push({
    minX: 0,
    maxX: 30,
    minZ: -130,
    maxZ: -100,
    y: 0,
    contains: (x, z) => Math.abs(x - 15) + Math.abs(z + 115) <= 24.05,
  });
  // Octagonal wall sections, split at corridor and western lift passage.
  function wallBetween(ax: number, az: number, bx: number, bz: number) {
    const dx = bx - ax,
      dz = bz - az,
      length = Math.hypot(dx, dz);
    const mesh = box(
      length,
      7,
      0.5,
      (ax + bx) / 2,
      3.5,
      (az + bz) / 2,
      sterile,
    );
    mesh.rotation.y = -Math.atan2(dz, dx);
    const steps = Math.ceil(length);
    for (let i = 0; i < steps; i++)
      collider(
        Math.abs(dx) / steps + 0.5,
        7,
        Math.abs(dz) / steps + 0.5,
        ax + (dx * (i + 0.5)) / steps,
        3.5,
        az + (dz * (i + 0.5)) / steps,
      );
  }
  for (let i = 0; i < octagon.length; i++) {
    const a = octagon[i],
      b = octagon[(i + 1) % 8],
      ax = a[0] + 15,
      az = a[1] - 115,
      bx = b[0] + 15,
      bz = b[1] - 115;
    if (i === 3) {
      wallBetween(ax, az, 30, -106);
      wallBetween(24, -100, bx, bz);
    } // entrance diagonal opening
    else if (i === 6) {
      wallBetween(ax, az, 0, -117);
      wallBetween(0, -123, bx, bz);
    } else wallBetween(ax, az, bx, bz);
  }
  batch(31, 0.35, 31, 15, 7.2, -115, black, true);
  // Connector from the decon spine into the octagonal entry.
  floor(6, 10, 27.5, 0, -101); // sealed elbow into the diagonal lab aperture
  batch(0.6, 6, 6.6, 30.5, 3, -103, sterile, true);
  batch(0.6, 6, 0.8, 24.5, 3, -100.05, sterile, true);
  batch(6.6, 0.3, 10, 27.5, 6.15, -101, black, true);
  cylinder(2.2, 0.45, 15, 0.225, -115, steel);
  collider(3.5, 0.45, 3.5, 15, 0.225, -115);
  const objectiveGroup = new THREE.Group();
  objectiveGroup.position.copy(AREA51_LAYOUT.objective);
  root.add(objectiveGroup);
  const vialGroup = new THREE.Group();
  objectiveGroup.add(vialGroup);
  cylinder(0.23, 0.8, 0, 0.2, 0, glass, vialGroup);
  cylinder(0.16, 0.55, 0, 0.2, 0, cyan, vialGroup);
  cylinder(0.25, 0.12, 0, 0.65, 0, steel, vialGroup);
  const serverGroup = new THREE.Group();
  objectiveGroup.add(serverGroup);
  box(0.8, 1.6, 0.8, 0, 0.2, 0, steel, false, serverGroup);
  for (let i = 0; i < 8; i++) {
    box(0.7, 0.03, 0.04, 0, -0.4 + i * 0.16, 0.42, cyan, false, serverGroup);
  }
  const objectiveLight = new THREE.PointLight(0x42bcea, 30, 10);
  objectiveGroup.add(objectiveLight);
  for (const [x, z] of [
    [5, -111],
    [5, -117],
    [24, -115],
    [23, -121],
  ] as const) {
    batch(1.8, 4, 1.2, x, 2, z, black, true);
    for (let i = 0; i < 9; i++) {
      batch(1.5, 0.14, 0.12, x, 0.4 + i * 0.37, z + 0.65, steel);
      batch(
        0.08,
        0.045,
        0.025,
        x + 0.5,
        0.43 + i * 0.37,
        z + 0.73,
        i % 3 ? cyan : red,
      );
    }
  }
  for (const x of [8, 20]) {
    batch(4, 0.2, 1.4, x, 0.9, -125, steel, true);
    batch(1.1, 0.7, 0.15, x, 1.4, -125.3, black);
    batch(0.95, 0.55, 0.02, x, 1.4, -125.2, cyan);
  }
  for (const [x, z] of [
    [9, -105],
    [20, -105],
  ] as const) {
    cylinder(0.9, 0.3, x, 0.15, z);
    cylinder(0.8, 3.6, x, 2, z, glass);
    cylinder(
      0.67,
      3,
      x,
      1.9,
      z,
      new THREE.MeshStandardMaterial({
        color: 0x425c40,
        transparent: true,
        opacity: 0.66,
        depthWrite: false,
      }),
    );
    cylinder(0.85, 0.25, x, 3.9, z);
    collider(1.8, 4, 1.8, x, 2, z);
  }
  lamp(15, 6.5, -111, 0x75e3dc, 140, 22);
  lamp(8, 6.5, -124, 0xe03f31, 40, 15);
  sign("03 // CENTRAL BIO-LAB", 15, 4, -129.65, 7, 0.8);
  // Lift approach outside the octagon, then an authored two-level shaft.
  floor(14, 6, -6, 0, -120);
  walls(14, 6, -6, 0, -120, 5, steel, { east: [-123, -117], north: [-15, -9] });
  // The approach ends at the lower landing; the six-metre shaft has sealed side/back walls.
  floor(6, 14, -12, 0, -126);
  walls(6, 14, -12, 0, -126, 5, steel, { south: [-15, -9], north: [-15, -9], east: [-123, -119] });
  floor(6, 6, -12, 0, -136);
  for (const x of [-15, -9]) batch(0.6, 22, 6.6, x, 11, -136, steel, true);
  batch(6.6, 15, 0.6, -12, 7.5, -139, steel, true);
  batch(6.6, 11.5, 0.6, -12, 9.25, -133, steel, true);
  batch(6.6, 3.5, 0.6, -12, 20.25, -139, steel, true);
  batch(6.6, 7, 0.6, -12, 18.5, -133, steel, true);
  batch(6.6, 0.3, 6.6, -12, 22, -136, black, true);
  floor(6, 3.7, -12, 15, -140.55); // threshold lip overlaps the car floor by 0.1 m
  for (const x of [-15, -9]) batch(0.6, 5, 3.4, x, 17.5, -140.7, steel, true);
  for (const z of [-120, -127, -132]) lamp(-12, 4.6, z, 0xe4dbc1, 55, 12);
  lamp(-5, 4.6, -120, 0xe4dbc1, 65, 14);
  for (const y of [3, 8, 13, 18]) {
    batch(0.07, 1.7, 0.1, -14.64, y, -136, cyan);
    const guideLight = new THREE.PointLight(0x90bbc9, 8, 8, 1);
    guideLight.position.set(-14.5, y, -136);
    root.add(guideLight);
  }
  for (const x of [-14.7, -9.3]) batch(0.12, 22, 0.12, x, 11, -136, steel);
  const liftCabin = new THREE.Group();
  liftCabin.name = "Area51_ElevatorCabin";
  liftCabin.position.copy(AREA51_LAYOUT.liftBottom);
  root.add(liftCabin);
  box(5.4, 0.12, 5.6, 0, -0.06, 0, steel, false, liftCabin);
  box(5.4, 0.18, 5.6, 0, 3.4, 0, sterile, false, liftCabin);
  for (const x of [-2.6, 2.6])
    box(0.12, 3.3, 5.6, x, 1.65, 0, sterile, false, liftCabin);
  box(2.4, 0.05, 0.8, 0, 3.28, 0, amber, false, liftCabin);
  const liftLight = new THREE.PointLight(0xffedc9, 2.0, 5.5, 0);
  liftLight.name = "Area51_ElevatorInteriorLight";
  liftLight.position.set(0, 3.1, 0);
  liftCabin.add(liftLight);
  const cabinDoors: THREE.Mesh[][] = [];
  for (const z of [-2.82, 2.82]) {
    const pair = [-1, 1].map(side => {
      const panel = box(2.6, 3.2, 0.12, side * 3.9, 1.6, z, steel, false, liftCabin);
      panel.userData.side = side;
      return panel;
    });
    cabinDoors.push(pair);
  }
  const cabinSurface = { minX: -14.6, maxX: -9.4, minZ: -138.8, maxZ: -133.2, y: 0 };
  surfaces.push(cabinSurface);
  const liftDoors: THREE.Mesh[][] = [];
  const landingColliders: WorldCollider[] = [];
  for (const [y, z, rotation] of [[0, -133, 0], [15, -139, Math.PI]]) {
    const landing = new THREE.Group();
    landing.name = y === 0 ? "Area51_LowerLiftDoors" : "Area51_UpperLiftDoors";
    landing.position.set(-12, y, z);
    root.add(landing);
    const panels = [-1, 1].map(side => {
      const panel = box(2.7, 3.2, 0.16, side * 4.05, 1.6, 0, steel, false, landing);
      panel.userData.side = side;
      return panel;
    });
    liftDoors.push(panels);
    const gate = collider(5.4, 3.2, 0.2, -12, y + 1.6, z);
    gate.active = false;
    landingColliders.push(gate);
    const console = new THREE.Group();
    console.name = y === 0 ? "Area51_LiftCallConsole" : "Area51_LiftReturnConsole";
    console.position.set(-9.35, y + 1.35, z + (y === 0 ? 0.2 : -0.2));
    console.rotation.y = rotation;
    root.add(console);
    box(0.55, 0.8, 0.18, 0, 0, 0, black, false, console);
    box(0.44, 0.3, 0.02, 0, 0.17, 0.1, cyan, false, console);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++)
      box(0.08, 0.06, 0.025, (col - 1) * 0.12, -0.08 - row * 0.1, 0.11, amber, false, console);
    const callLight = new THREE.PointLight(0x47d1de, 2, 3, 0);
    callLight.position.set(0, 0.2, 0.3);
    console.add(callLight);
    sign(y === 0 ? "E // LEVEL 4 WAREHOUSE" : "E // BIO-LAB", -12, y + 3.65, z, 4, 0.55, rotation);
  }
  let liftRide: { position: THREE.Vector3; eye: number; from: number; to: number; elapsed: number } | null = null;
  // ZONE 4 — low safety illumination, then brighter emergency light at evac.
  floor(40, 60, 0, 15, -170);
  walls(40, 60, 0, 15, -170, 12, concrete, {
    south: [-15, -9],
    north: [-6, 6],
  });
  sign("04 // EXTRACTION CONTROL", -8, 18, -140.35, 6, 0.6, Math.PI);
  const emergency: THREE.PointLight[] = [];
  for (const [x, z] of [[-11, -151], [11, -172], [-11, -193]]) {
    const safety = lamp(x, 24, z, 0xb2bec9, 45, 24);
    safety.name = "Area51_WarehouseSafetyLight";
  }
  for (const x of [-19.4, 19.4]) {
    batch(0.15, 0.15, 56, x, 19.8, -170, steel);
    for (const z of [-151, -175, -193]) batch(0.15, 4.5, 0.15, x, 17.25, z, steel);
  }
  for (const x of [-17, 17]) {
    batch(1.3, 3.2, 1.2, x, 16.6, -150, black, true);
    for (let i = 0; i < 6; i++) batch(0.08, 0.07, 0.03, x + 0.4, 15.35 + i * 0.4, -149.38, cyan);
  }
  for (const z of [-150, -174, -193])
    { const light = lamp(0, 25.5, z, 0xff8c3b, 0, 27); light.name = "Area51_EmergencyHighBay"; emergency.push(light); }
  for (const x of [-10, 10])
    for (const z of [-158, -181]) batch(0.8, 12, 0.8, x, 21, z, steel, true);
  for (const [x, z] of [
    [-14, -157],
    [13, -164],
    [-7, -187],
    [13, -187],
  ]) {
    batch(7, 3, 3, x, 16.5, z, steel, true);
    for (let i = 0; i < 14; i++)
      batch(0.09, 2.9, 3.06, x - 3.3 + i * 0.5, 16.5, z, black);
  }
  for (const [x, z] of [
    [-2, -156],
    [5, -178],
    [-15, -175],
    [9, -195],
  ])
    crate(x, 15, z, 2.5, 1.6, 2.5);
  const breachDoors: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const side = i % 2 ? -1 : 1,
      hinge = new THREE.Group();
    hinge.name = `USMC_Spartan_BreachDoor_${i}`;
    hinge.position.set(side * 19.55, 15, -190 + i * 6 - 1.6);
    root.add(hinge);
    box(0.14, 4, 3.2, 0, 2, 1.6, steel, false, hinge);
    box(0.17, 0.12, 3, 0, 3.8, 1.6, red, false, hinge);
    sign(
      "USMC // RESTRICTED",
      side * 19.4,
      19.5,
      -190 + i * 6,
      3,
      0.45,
      (-side * Math.PI) / 2,
      "#ba6251",
    );
    breachDoors.push(hinge);
  }
  const spartanRim = new THREE.PointLight(0xa4bac8, 0, 16, 2);
  spartanRim.name = "Area51_BossEntryRimLight";
  spartanRim.position.set(15.5, 20, -187);
  root.add(spartanRim);
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(-8, 15, -146);
  root.add(consoleGroup);
  box(1.25, 1.1, 0.65, 0, 0.55, 0, steel, false, consoleGroup);
  box(0.85, 0.08, 0.4, 0, 1.15, 0, red, false, consoleGroup);
  const consoleLight = new THREE.PointLight(0xed3327, 7, 5);
  consoleLight.position.copy(AREA51_LAYOUT.console);
  root.add(consoleLight);
  sign("E // DISPATCH EVAC", -8, 16.7, -146.35, 2.7, 0.4);
  const blastDoorGroups = [new THREE.Group(), new THREE.Group()];
  const blastColliders: WorldCollider[] = [];
  blastDoorGroups.forEach((g, i) => {
    g.position.set(i ? -3 : 3, 15, -200);
    root.add(g);
    box(6, 7, 0.7, 0, 3.5, 0, steel, false, g);
    for (let j = 0; j < 4; j++)
      box(5.8, 0.12, 0.1, 0, 1 + j * 1.5, 0.4, black, false, g);
    blastColliders.push(collider(6, 7, 0.8, i ? -3 : 3, 18.5, -200));
  });
  // Outdoor landing apron, rain, helipad and a cabin with finite positive transforms.
  floor(40, 36, 0, 15, -218);
  for (const x of [-19.7, 19.7])
    batch(0.3, 1.6, 36, x, 15.8, -218, steel, true);
  batch(40, 1.6, 0.3, 0, 15.8, -235.7, steel, true);
  const padLights: THREE.PointLight[] = [];
  for (const x of [-11, 11]) {
    batch(0.2, 6, 0.2, x, 18, -215, steel, true);
    const flood = lamp(x, 21, -215, 0xc5d9e6, 0, 34);
    flood.name = "Area51_HelipadFloodlight";
    padLights.push(flood);
  }
  const padRing = new THREE.Mesh(new THREE.RingGeometry(8.5, 8.8, 48), amber);
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.set(0, 15.015, -219);
  root.add(padRing);
  for (const x of [-2, 2]) batch(0.45, 0.025, 5, x, 15.02, -219, amber);
  batch(4, 0.025, 0.45, 0, 15.02, -219, amber);
  const helicopter = buildHelicopterMesh();
  helicopter.group.name = "Area51_UH60_Extraction";
  helicopter.group.position.set(0, 15, -219);
  helicopter.group.visible = false;
  root.add(helicopter.group);
  helicopter.group.updateMatrixWorld(true);
  // Cabin floor is explicitly part of the walkable surfaces while boarding.
  const rainPositions = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 40;
    rainPositions[i * 3 + 1] = 16 + Math.random() * 24;
    rainPositions[i * 3 + 2] = -201 - Math.random() * 34;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({
      color: 0x8ba3b4,
      size: 0.065,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  rain.frustumCulled = false;
  root.add(rain);
  // Steam is one fixed-size particle buffer; no per-frame object creation.
  const steamPositions = new Float32Array(90 * 3),
    steamAge = new Float32Array(90);
  for (let i = 0; i < 90; i++) {
    steamAge[i] = Math.random() * 4;
    steamPositions[i * 3] = 25 + (i % 2) * 5;
    steamPositions[i * 3 + 1] = steamAge[i] * 0.65;
    steamPositions[i * 3 + 2] = -48 - Math.floor(i / 30) * 18;
  }
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(steamPositions, 3),
  );
  const steam = new THREE.Points(
    steamGeo,
    new THREE.PointsMaterial({
      color: 0xb3c7c6,
      size: 0.38,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  root.add(steam);
  // One instanced draw per static material (matrix bounds and normals baked by Three.js).
  for (const [mat, list] of staticBoxes) {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      mat,
      list.length,
    );
    list.forEach((item, i) => mesh.setMatrixAt(i, item.matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  staticBoxes.clear();
  function authoredSurfaceHeight(x: number, z: number, foot: number): number {
    let y = -20;
    for (const surface of surfaces)
      if (
        x >= surface.minX &&
        x <= surface.maxX &&
        z >= surface.minZ &&
        z <= surface.maxZ &&
        surface.y <= foot + 0.75 &&
        (!surface.contains || surface.contains(x, z))
      )
        y = Math.max(y, surface.y);
    return y;
  }
  function getHighestSurface(x: number, z: number, foot: number): number {
    let y = authoredSurfaceHeight(x, z, foot);
    if (
      facility.phase === "BOARD" &&
      Math.abs(x) < 2.1 &&
      Math.abs(z + 219) < 2 &&
      foot > 14.5
    )
      y = Math.max(y, 15.81);
    for (const c of worldColliders)
      if (
        c.active !== false &&
        c.maxY <= foot + 0.45 &&
        x >= c.minX &&
        x <= c.maxX &&
        z >= c.minZ &&
        z <= c.maxZ
      )
        y = Math.max(y, c.maxY);
    return y;
  }
  function moveEntityWithCollision(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    r: number,
    foot: number,
    head: number,
    delta: number,
    team?: string,
  ) {
    r = Math.max(r, 0.42);
    const dt = Math.min(0.1, Math.max(0, delta)),
      steps = Math.max(
        1,
        Math.ceil((Math.hypot(vel.x, vel.z) * dt) / Math.max(0.1, r * 0.5)),
      );
    for (let i = 0; i < steps; i++)
      for (const axis of ["x", "z"] as const) {
        const x = pos.x + (axis === "x" ? (vel.x * dt) / steps : 0),
          z = pos.z + (axis === "z" ? (vel.z * dt) / steps : 0);
        // Every authored floor transition is level or lift-driven. Reject unsupported steps.
        const currentSurface = authoredSurfaceHeight(pos.x, pos.z, foot);
        const nextSurface = authoredSurfaceHeight(x, z, foot);
        const blocked = (currentSurface > -19 && nextSurface < currentSurface - 0.75) || worldColliders.some(
          (c) =>
            c.active !== false &&
            (!team || c.passThroughTeam !== team) &&
            c.maxY > foot + 0.45 &&
            head > c.minY &&
            foot < c.maxY - 0.04 &&
            x + r > c.minX &&
            x - r < c.maxX &&
            z + r > c.minZ &&
            z - r < c.maxZ,
        );
        if (blocked) vel[axis] = 0;
        else pos[axis] = axis === "x" ? x : z;
      }
  }
  const facility: Area51Facility = {
    phase: "INFILTRATE",
    faction: "usmc",
    objectiveComplete: false,
    introElapsed: 0,
    departureElapsed: 0,
    helicopter,
    interactions,
    objectivePosition: AREA51_LAYOUT.objective.clone(),
    liftBottom: AREA51_LAYOUT.liftBottom.clone(),
    liftTop: AREA51_LAYOUT.liftTop.clone(),
    consolePosition: AREA51_LAYOUT.console.clone(),
    bossPosition: AREA51_LAYOUT.boss.clone(),
    setFaction(faction) {
      facility.faction = faction;
      spartanRim.position.set(faction === "apex" ? 15.5 : -4, faction === "apex" ? 20 : 21, faction === "apex" ? -187 : -168);
      spartanRim.color.setHex(faction === "apex" ? 0xa4bac8 : 0xe9c0a0);
      vialGroup.visible = faction === "usmc";
      serverGroup.visible = faction === "apex";
    },
    activateEvac() {
      if (
        disposed ||
        !facility.objectiveComplete ||
        facility.phase !== "ARRIVAL"
      )
        return false;
      facility.phase = "INTRO";
      facility.introElapsed = 0;
      helicopter.group.visible = true;
      helicopter.state = "HOVERING_EXFIL";
      return true;
    },
    openBlastDoors() {
      if (disposed || facility.phase !== "BOSS") return;
      facility.phase = "BOARD";
    },
    tryBoard(position) {
      if (
        facility.phase !== "BOARD" ||
        doorOpen < 0.95 ||
        helicopter.doors.some((d) => d.position.z < 2.8) ||
        Math.abs(position.x) > 2 ||
        Math.abs(position.z + 219) > 1.85 ||
        position.y < 15.5 ||
        position.y > 18.5
      )
        return false;
      facility.phase = "DEPARTING";
      facility.departureElapsed = 0;
      helicopter.state = "OUTBOUND_DEPART";
      return true;
    },
    isNearLift(position) {
      const floor = position.y > 10 ? 15 : 0;
      const entranceZ = floor === 0 ? -133 : -139;
      return Math.abs(position.x + 12) < 3.4 &&
        Math.abs(position.z - entranceZ) < 4.5 &&
        Math.abs(position.y - floor) < 3;
    },
    get liftMoving() { return liftRide !== null; },
    get bulkheadOpen() { return vaultOpened; },
    get bulkheadMoving() { return vaultElapsed >= 0 && !vaultOpened; },
    isNearBulkhead(position) {
      return !vaultOpened && Math.abs(position.x - 20) < 3.7 && Math.abs(position.z + 36) < 2.4 && position.y < 4;
    },
    openBulkhead() {
      if (disposed || vaultOpened || vaultElapsed >= 0) return false;
      vaultElapsed = 0;
      audioManager.play("bulkhead_unseal");
      return true;
    },
    transferLift(position, destinationFloor, eyeOffset = 0, animate = true) {
      if (disposed || liftRide || facility.controlsLocked ||
          (destinationFloor !== 0 && destinationFloor !== 15) ||
          !facility.isNearLift(position) ||
          Math.abs(position.y - eyeOffset - (destinationFloor === 15 ? 0 : 15)) > 1.5)
        return false;
      // AI retains its authored floor portal; only the player's ride locks input/camera.
      if (!animate) {
        position.y = destinationFloor + eyeOffset;
        position.z = destinationFloor === 15 ? -143 : -131;
        return true;
      }
      liftRide = { position, eye: eyeOffset, from: destinationFloor === 15 ? 0 : 15, to: destinationFloor, elapsed: 0 };
      position.set(-12, liftRide.from + eyeOffset, -136);
      liftCabin.position.y = liftRide.from;
      cabinSurface.y = liftRide.from;
      audioManager.play("elevator_hum");
      return true;
    },
    getZone(p) {
      if (p.y > 10) return 4;
      return p.z > -40 ? 1 : p.z > -100 ? 2 : 3;
    },
    get controlsLocked() {
      return (
        liftRide !== null ||
        facility.phase === "INTRO" ||
        facility.phase === "DEPARTING" ||
        facility.phase === "COMPLETE"
      );
    },
    updateCamera(camera, player) {
      if (liftRide) {
        camera.position.copy(player.pos);
        camera.rotation.set(player.pitch ?? 0, player.yaw, 0, "YXZ");
      } else if (facility.phase === "INTRO") {
        const t = THREE.MathUtils.smoothstep(facility.introElapsed / 3, 0, 1);
        if (facility.faction === "apex") camera.position.set(7 + 4 * t, 17.3, -166 - 8 * t);
        else camera.position.set(-12 + 8 * t, 16.65 + 0.65 * t, -146 - 11 * t);
        camera.lookAt(facility.faction === "apex" ? 17.8 : 0, facility.faction === "apex" ? 17 : 18, facility.faction === "apex" ? -184 : -170);
      } else if (
        facility.phase === "DEPARTING" ||
        facility.phase === "COMPLETE"
      ) {
        helicopter.group.updateWorldMatrix(true, true);
        camera.position.copy(cabinSeat);
        helicopter.group.localToWorld(camera.position);
        camera.lookAt(
          camera.position.x + 8,
          camera.position.y - 1,
          camera.position.z - 3,
        );
        player.pos.copy(camera.position);
      }
    },
  };
  facility.setFaction("usmc");
  let doorOpen = 0;
  const cabinSeat = new THREE.Vector3(0.8, 1.65, 0);
  const zones: ExtractionZones = {
    signalBeacon: trigger("evac_console", facility.consolePosition, 3),
    holdout: trigger("boss_arena", facility.bossPosition, 20),
    exfil: trigger("helicopter_cabin", new THREE.Vector3(0, 16.6, -219), 2),
  };
  function trigger(id: string, p: THREE.Vector3, r: number) {
    return {
      id,
      center: p.clone(),
      radius: r,
      bounds: new THREE.Box3().setFromCenterAndSize(
        p,
        new THREE.Vector3(r * 2, 4, r * 2),
      ),
    };
  }
  // Grid is limited to authored surfaces; disconnected voids never become navigable nodes.
  const navPoints: THREE.Vector3[] = [],
    cells = new Map<string, number>();
  for (const y of [0, 15])
    for (let x = -18; x <= 34; x += 2)
      for (let z = -234; z <= -2; z += 2) {
        if (getHighestSurface(x, z, y) !== y) continue;
        const p = new THREE.Vector3(x, y, z);
        if (
          worldColliders.some(
            (c) =>
              c.active !== false &&
              c.maxY > y + 0.6 &&
              c.minY < y + 1.8 &&
              x > c.minX - 0.42 &&
              x < c.maxX + 0.42 &&
              z > c.minZ - 0.42 &&
              z < c.maxZ + 0.42,
          )
        )
          continue;
        cells.set(`${x},${y},${z}`, navPoints.length);
        navPoints.push(p);
      }
  const links = navPoints.map((p) => {
    const result: number[] = [];
    for (const dx of [-2, 0, 2])
      for (const dz of [-2, 0, 2]) {
        if (!dx && !dz) continue;
        const next = cells.get(`${p.x + dx},${p.y},${p.z + dz}`);
        if (
          next !== undefined &&
          !traversalBlocked(p, navPoints[next], worldColliders)
        )
          result.push(next);
      }
    return result;
  });
  const g = new Float64Array(navPoints.length),
    prev = new Int32Array(navPoints.length),
    open = new Set<number>(),
    scratch = new THREE.Vector3();
  const nearest = (p: THREE.Vector3, team?: string) => {
    let best = -1,
      d = Infinity;
    for (let i = 0; i < navPoints.length; i++) {
      const n = navPoints[i];
      if (Math.abs(n.y - p.y) > 3) continue;
      const distance = n.distanceToSquared(p);
      if (distance < d && !traversalBlocked(p, n, worldColliders, team)) {
        d = distance;
        best = i;
      }
    }
    return best;
  };
  function getNavigationTarget(
    from: THREE.Vector3,
    target: THREE.Vector3,
    team?: string,
  ): THREE.Vector3 {
    const differentFloor = Math.abs(from.y - target.y) > 8;
    const dest = differentFloor
      ? from.y < 10
        ? facility.liftBottom
        : facility.liftTop
      : target;
    if (differentFloor && facility.transferLift(from, from.y < 10 ? 15 : 0, 0, false))
      return target;
    if (
      !traversalBlocked(from, dest, worldColliders, team) &&
      Math.abs(from.y - dest.y) < 3
    )
      return dest;
    const start = nearest(from, team),
      goal = nearest(dest, team);
    if (start < 0 || goal < 0) return from;
    g.fill(Infinity);
    prev.fill(-1);
    open.clear();
    open.add(start);
    g[start] = 0;
    while (open.size) {
      let best = -1,
        score = Infinity;
      for (const i of open) {
        const s = g[i] + navPoints[i].distanceTo(navPoints[goal]);
        if (s < score) {
          best = i;
          score = s;
        }
      }
      if (best === goal) break;
      open.delete(best);
      for (const next of links[best]) {
        if (
          traversalBlocked(
            navPoints[best],
            navPoints[next],
            worldColliders,
            team,
          )
        )
          continue;
        const cost = g[best] + navPoints[best].distanceTo(navPoints[next]);
        if (cost < g[next]) {
          g[next] = cost;
          prev[next] = best;
          open.add(next);
        }
      }
    }
    if (!Number.isFinite(g[goal])) return from;
    let next = goal;
    while (prev[next] >= 0 && prev[next] !== start) next = prev[next];
    return scratch.copy(navPoints[next]);
  }
  vaultCollider.active = true;
  function registerHittable(node: THREE.Object3D) {
    if (!hittableObjects.includes(node)) hittableObjects.push(node);
  }
  function unregisterHittable(node: THREE.Object3D) {
    const i = hittableObjects.indexOf(node);
    if (i >= 0) hittableObjects.splice(i, 1);
  }
  function createGroundPickup(
    x: number,
    z: number,
    typeIndex: number,
    ammo: number,
  ): GroundPickup {
    if (disposed) throw new Error("Area 51 world disposed");
    const group = new THREE.Group();
    group.position.set(x, area51TerrainHeight(x, z) + 0.55, z);
    root.add(group);
    box(0.5, 0.2, 0.3, 0, 0, 0, crateMat, false, group);
    resources.track(group);
    const item = {
      group,
      typeIndex,
      ammo,
      label: `${WEAPONS[typeIndex]?.name ?? "FIELD"} SUPPLY`,
    };
    groundPickups.push(item);
    return item;
  }
  function removeGroundPickup(item: GroundPickup) {
    item.group.removeFromParent();
    resources.release(item.group);
    const i = groundPickups.indexOf(item);
    if (i >= 0) groundPickups.splice(i, 1);
  }
  function collectPickup(
    item: GroundPickup,
    announce: (m: string) => void,
    states: { reserve?: number; count?: number }[],
  ) {
    const state = states[item.typeIndex];
    if (!state) return;
    if (WEAPONS[item.typeIndex]?.type === "weapon")
      state.reserve = (state.reserve ?? 0) + item.ammo;
    else state.count = (state.count ?? 0) + item.ammo;
    announce(item.label);
    removeGroundPickup(item);
  }
  const covers: { group: THREE.Group; collider: WorldCollider }[] = [];
  function removeCover(item: { group: THREE.Group; collider: WorldCollider }) {
    item.collider.active = false;
    item.group.traverse(unregisterHittable);
    item.group.removeFromParent();
    resources.release(item.group);
    const i = worldColliders.indexOf(item.collider);
    if (i >= 0) worldColliders.splice(i, 1);
  }
  function clearDeployableCover() {
    covers.forEach(removeCover);
    covers.length = 0;
  }
  function spawnDeployableCover(p: THREE.Vector3, yaw: number, team = "blue") {
    if (covers.length >= 12) removeCover(covers.shift()!);
    const group = new THREE.Group();
    group.position.copy(p);
    group.rotation.y = yaw;
    root.add(group);
    const mesh = box(2.4, 1.2, 0.3, 0, 0.6, 0, steel, false, group);
    const w = Math.abs(Math.cos(yaw)) * 2.4 + Math.abs(Math.sin(yaw)) * 0.3,
      d = Math.abs(Math.sin(yaw)) * 2.4 + Math.abs(Math.cos(yaw)) * 0.3,
      c = collider(w, 1.2, d, p.x, p.y + 0.6, p.z);
    c.passThroughTeam = team;
    covers.push({ group, collider: c });
    registerHittable(mesh);
    resources.track(group);
    return group;
  }
  function spawnObjectiveProp(
    faction: "usmc" | "apex",
    p?: THREE.Vector3,
  ): ObjectivePropInstance {
    const group = new THREE.Group();
    group.position.copy(p ?? facility.objectivePosition);
    root.add(group);
    const mesh = box(0.4, 0.7, 0.4, 0, 0, 0, cyan, false, group);
    resources.track(group);
    registerHittable(mesh);
    return {
      group,
      interactNode: group.position.clone(),
      type: faction === "usmc" ? "bio_cylinder" : "mainframe",
      boundingMesh: mesh,
      dispose() {
        unregisterHittable(mesh);
        group.removeFromParent();
        resources.release(group);
      },
    };
  }
  function updateWorld(delta: number, time: number, mode: GameMode) {
    if (disposed) return;
    scene.fog = fog;
    scene.background = background;
    const dt = Math.min(0.1, Math.max(0, delta));
    if (vaultElapsed >= 0 && !vaultOpened) {
      vaultElapsed = Math.min(2.7, vaultElapsed + dt);
      vaultWheel.rotation.x = Math.PI * 2 * THREE.MathUtils.smoothstep(vaultElapsed / 0.9, 0, 1);
      vaultHinge.rotation.y = -Math.PI / 2 * THREE.MathUtils.smoothstep((vaultElapsed - 0.9) / 1.8, 0, 1);
      if (vaultElapsed >= 2.7) { vaultOpened = true; vaultCollider.active = false; }
    }
    if (mode !== "extraction" && vaultElapsed < 0) facility.openBulkhead();
    if (liftRide) {
      const ride = liftRide;
      ride.elapsed = Math.min(4.2, ride.elapsed + dt);
      const travel = THREE.MathUtils.smoothstep((ride.elapsed - 0.6) / 3, 0, 1);
      const y = THREE.MathUtils.lerp(ride.from, ride.to, travel);
      ride.position.set(-12, y + ride.eye, -136);
      liftCabin.position.y = y;
      cabinSurface.y = y;
      const openness = ride.elapsed < 0.6 ? 1 - ride.elapsed / 0.6 :
        ride.elapsed > 3.6 ? (ride.elapsed - 3.6) / 0.6 : 0;
      for (let i = 0; i < liftDoors.length; i++) {
        const landingY = i * 15;
        const atLanding = Math.abs(y - landingY) < 0.01;
        const open = atLanding ? openness : 0;
        for (const panel of liftDoors[i]) panel.position.x = panel.userData.side * (1.35 + 2.7 * open);
        landingColliders[i].active = open < 0.95;
      }
      for (const panels of cabinDoors) for (const panel of panels)
        panel.position.x = panel.userData.side * (1.3 + 2.6 * openness);
      if (ride.elapsed >= 4.2) {
        ride.position.set(-12, ride.to + ride.eye, -136);
        if (mode === "extraction" && ride.to === 15 && facility.phase === "INFILTRATE")
          facility.phase = "ARRIVAL";
        liftRide = null;
      }
    } else {
      for (let i = 0; i < liftDoors.length; i++) {
        const atLanding = Math.abs(liftCabin.position.y - i * 15) < 0.01;
        for (const panel of liftDoors[i]) panel.position.x = panel.userData.side * (atLanding ? 4.05 : 1.35);
        landingColliders[i].active = !atLanding;
      }
    }

    flickerLights.forEach((l, i) => {
      l.intensity = Math.sin(time * 11 + i * 7) > 0.92 ? 5 : 65;
    });
    if (facility.phase === "INTRO") {
      facility.introElapsed = Math.min(3, facility.introElapsed + dt);
      if (facility.introElapsed >= 3) facility.phase = "BOSS";
    }
    if (facility.faction === "apex")
      for (let i = 0; i < breachDoors.length; i++) {
        const open =
          facility.phase === "INTRO"
            ? THREE.MathUtils.smoothstep(facility.introElapsed / 1.2, 0, 1)
            : ["BOSS", "BOARD", "DEPARTING", "COMPLETE"].includes(
                  facility.phase,
                )
              ? 1
              : 0;
        breachDoors[i].rotation.y = (i % 2 ? 1 : -1) * open * Math.PI * 0.58;
      }
    spartanRim.intensity = ["INTRO", "BOSS"].includes(facility.phase) ? 80 : 0;
    const lit =
      mode !== "extraction" ||
      !["INFILTRATE", "ARRIVAL"].includes(facility.phase);
    emergency.forEach(
      (l, i) =>
        (l.intensity = lit ? (Math.sin(time * 4 + i) > 0.3 ? 180 : 55) : 0),
    );
    const target =
      facility.phase === "BOARD" ||
      facility.phase === "DEPARTING" ||
      facility.phase === "COMPLETE" ||
      mode !== "extraction"
        ? 1
        : 0;
    padLights.forEach(l => l.intensity = target ? 300 : 0);
    doorOpen = THREE.MathUtils.damp(doorOpen, target, 2.5, dt);
    blastDoorGroups.forEach(
      (door, i) => (door.position.x = (i ? -1 : 1) * (3 + 6 * doorOpen)),
    );
    blastColliders.forEach((c) => (c.active = doorOpen < 0.95));
    if (facility.phase === "DEPARTING") {
      facility.departureElapsed += dt;
      const t = facility.departureElapsed;
      helicopter.group.position.set(
        t > 3 ? (t - 3) ** 2 * 0.85 : 0,
        15 + t * t * 0.65,
        -219 - (t > 3 ? (t - 3) ** 2 * 2 : 0),
      );
      if (t >= 8) facility.phase = "COMPLETE";
    }
    helicopter.update(dt, time);
    helicopter.group.updateWorldMatrix(true, true);
    for (let i = 0; i < 600; i++) {
      rainPositions[i * 3] += 0.4 * dt;
      rainPositions[i * 3 + 1] -= 23 * dt;
      if (rainPositions[i * 3 + 1] < 15) {
        rainPositions[i * 3 + 1] = 40;
        rainPositions[i * 3] = (Math.random() - 0.5) * 40;
      }
    }
    rainGeo.getAttribute("position").needsUpdate = true;
    for (let i = 0; i < 90; i++) {
      steamAge[i] = (steamAge[i] + dt) % 4;
      steamPositions[i * 3 + 1] = steamAge[i] * 0.65;
      steamPositions[i * 3] = 25 + (i % 2) * 5 + Math.sin(time + i) * 0.2;
    }
    steamGeo.getAttribute("position").needsUpdate = true;
    vialGroup.rotation.y = time * 0.65;
    objectiveLight.intensity = 25 + Math.sin(time * 2) * 5;
  }
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      let p: THREE.Object3D | null = node;
      while (p) {
        if (p === helicopter.group) return;
        p = p.parent;
      }
      registerHittable(node);
    }
  });
  // Helicopter owns its resources separately; prevent shared ownership double disposal.
  helicopter.group.removeFromParent();
  resources.track(root);
  root.add(helicopter.group);
  function dispose() {
    if (disposed) return;
    disposed = true;
    liftRide = null;
    helicopter.dispose();
    resources.dispose();
    root.removeFromParent();
    root.clear();
    worldColliders.length =
      hittableObjects.length =
      groundPickups.length =
      covers.length =
        0;
    if (scene.fog === fog) scene.fog = previousFog;
    if (scene.background === background) scene.background = previousBackground;
  }
  return {
    mapId: "area51",
    facility,
    terrainMesh,
    worldColliders,
    doors: [],
    hittableObjects,
    groundPickups,
    structures: AREA51_SPAWNS.map((p) => ({ center: p.position.clone() })),
    sectorCenters: {
      1: new THREE.Vector3(0, 0, -20),
      2: new THREE.Vector3(27.5, 0, -68),
      3: new THREE.Vector3(15, 0, -115),
      4: new THREE.Vector3(0, 15, -170),
    },
    facilityCorridorNodes: {
      center: new THREE.Vector3(0, 0, -20),
      mainframe: facility.objectivePosition,
      cryo: new THREE.Vector3(27.5, 0, -68),
      evac: facility.consolePosition,
    },
    bioCylinderGroup: vialGroup,
    mainframeConsoleGroup: serverGroup,
    getExtractionZones: () => zones,
    getSpawnPoints: getArea51SpawnPoints,
    updateWorld,
    updateDoors: () => {},
    moveEntityWithCollision,
    getHighestSurface,
    getNavigationTarget,
    navigationPoints: navPoints,
    registerHittable,
    unregisterHittable,
    createGroundPickup,
    removeGroundPickup,
    collectPickup,
    spawnObjectiveProp,
    spawnDeployableCover,
    clearDeployableCover,
    damageEnvironmentalBlock: () => false,
    updateDebris: () => {},
    dispose,
  };
}
