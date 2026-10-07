import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const WEAPON_MODEL_IDS = [
  'ar',
  'shotgun',
  'sniper',
  'pistol',
  'smg',
  'lmg',
  'br',
  'laser',
  'minigun',
  'railgun',
  'rocket',
  'grenade_launcher',
] as const;
export type WeaponModelId = (typeof WEAPON_MODEL_IDS)[number];
export interface WeaponAssembly {
  root: THREE.Group;
  muzzle: THREE.Object3D;
  backblast: THREE.Object3D;
  parts: Record<string, THREE.Object3D>;
  update: (dt: number, charge?: number, spin?: number) => void;
}

/** Models face -Z; characters face +Z and cameras look down -Z.
 * Set an absolute attachment correction so re-equipping never accumulates flips.
 * Inspection models deliberately do not use this holding transform.
 */
export function orientHeldWeapon(assembly: WeaponAssembly, forward: 'positive-z' | 'negative-z') {
  assembly.root.rotation.y = forward === 'positive-z' ? Math.PI : 0;
  assembly.root.userData.holdingForward = forward;
}

/** Every model owns its materials/textures. Shared references inside a model are released once. */
export function disposeWeaponObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    o.userData.cleanupWeaponEffect?.();
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !(o instanceof THREE.Sprite))
      geometries.add(mesh.geometry);
    for (const material of mesh.material
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : []) {
      materials.add(material);
      for (const texture of material.userData.ownedTextures ?? [])
        textures.add(texture);
    }
    if (o instanceof THREE.Light) o.dispose();
  });
  textures.forEach((t) => t.dispose());
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  root.removeFromParent();
  root.clear();
}

function finishTexture(polymer: boolean) {
  const size = 64,
    bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const brushed = polymer ? hash % 53 : (y % 4) * 6 + (hash % 15);
      const i = (y * size + x) * 4,
        value = Math.min(255, (polymer ? 170 : 100) + brushed);
      bytes[i] = bytes[i + 1] = bytes[i + 2] = value;
      bytes[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Metre scale, breech at origin, muzzle along -Z. Used by studio, FPS, lobby and actors. */
export function createWeaponAssembly(id: string): WeaponAssembly {
  if (!WEAPON_MODEL_IDS.includes(id as WeaponModelId))
    throw new RangeError(`Unknown weapon model: ${id}`);
  const root = new THREE.Group();
  root.name = `Weapon_${id}`;
  root.userData.weaponId = id;
  const parts: Record<string, THREE.Object3D> = {};
  const metalTexture = finishTexture(false),
    gripTexture = finishTexture(true);
  const steel = new THREE.MeshStandardMaterial({
    color: 0x31373e,
    metalness: 0.92,
    roughness: 0.36,
    roughnessMap: metalTexture,
  });
  steel.userData.ownedTextures = [metalTexture];
  const dark = new THREE.MeshStandardMaterial({
    color: 0x151a20,
    metalness: 0.76,
    roughness: 0.44,
    roughnessMap: metalTexture,
  });
  const polymer = new THREE.MeshStandardMaterial({
    color: 0x20262c,
    metalness: 0.06,
    roughness: 0.83,
    bumpMap: gripTexture,
    bumpScale: 0.0015,
  });
  polymer.userData.ownedTextures = [gripTexture];
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x080b0e,
    roughness: 0.98,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: 0x76818a,
    metalness: 0.94,
    roughness: 0.28,
  });
  const purple = new THREE.MeshStandardMaterial({
    color: 0x293152,
    metalness: 0.8,
    roughness: 0.27,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x4ccbdc,
    emissive: 0x32d8ff,
    emissiveIntensity: 2.6,
    metalness: 0.5,
    roughness: 0.22,
  });
  const materials = [steel, dark, polymer, rubber, edge, purple, glow];
  const body = new THREE.Group();
  body.name = 'receiver';
  root.add(body);
  parts.receiver = body;
  const group = (name: string, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    body.add(g);
    parts[name] = g;
    return g;
  };
  function mesh(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = body,
  ) {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
    parent: THREE.Object3D = body,
  ) =>
    mesh(
      name,
      new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.13),
      mat,
      x,
      y,
      z,
      parent,
    );
  function tube(
    name: string,
    radius: number,
    length: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
    parent: THREE.Object3D = body,
    endRadius = radius,
  ) {
    const m = mesh(
      name,
      new THREE.CylinderGeometry(radius, endRadius, length, 16),
      mat,
      x,
      y,
      z,
      parent,
    );
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function ring(
    name: string,
    radius: number,
    thickness: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = dark,
    parent: THREE.Object3D = body,
  ) {
    return mesh(
      name,
      new THREE.TorusGeometry(radius, thickness, 6, 20),
      mat,
      x,
      y,
      z,
      parent,
    );
  }
  function silhouette(
    name: string,
    yz: number[][],
    width: number,
    mat: THREE.Material,
    parent: THREE.Object3D = body,
  ) {
    const shape = new THREE.Shape();
    yz.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.002,
      bevelThickness: 0.002,
    });
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(width / 2, 0, 0);
    return mesh(name, geometry, mat, 0, 0, 0, parent);
  }
  function rail(z: number, length: number, y = 0.07, x = 0, side = false) {
    box('Picatinny base', 0.036, 0.01, length, x, y, z, dark);
    const count = Math.floor(length / 0.018);
    for (let i = 0; i < count; i++) {
      const tooth = box(
        'Rail tooth',
        0.043,
        0.009,
        0.008,
        x,
        y + 0.008,
        z - length / 2 + i * 0.018,
        steel,
      );
      if (side) tooth.rotation.z = Math.PI / 2;
    }
  }
  function screws(z: number, count = 4) {
    for (const side of [-1, 1])
      for (let i = 0; i < count; i++) {
        const pin = tube(
          'Receiver pin',
          0.004,
          0.004,
          side * 0.035,
          0.01,
          z + i * 0.05,
          edge,
        );
        pin.rotation.set(0, 0, Math.PI / 2);
        box(
          'Edge wear',
          0.0015,
          0.0017,
          0.025,
          side * 0.036,
          0.043,
          z + i * 0.05,
          edge,
        );
      }
  }
  function grip(z = 0.09, parent: THREE.Object3D = body) {
    const g = box(
      'Stippled pistol grip',
      0.04,
      0.13,
      0.055,
      0,
      -0.1,
      z,
      polymer,
      parent,
    );
    g.rotation.x = -0.24;
    for (let i = 0; i < 6; i++)
      box(
        'Grip rib',
        0.041,
        0.005,
        0.055,
        0,
        -0.055 - i * 0.017,
        z + i * 0.003,
        rubber,
        parent,
      );
    const guard = ring(
      'Trigger guard',
      0.031,
      0.004,
      0,
      -0.071,
      z - 0.065,
      polymer,
      parent,
    );
    guard.rotation.y = Math.PI / 2;
    guard.scale.set(1, 0.8, 1.2);
    box(
      'Trigger',
      0.006,
      0.027,
      0.005,
      0,
      -0.06,
      z - 0.067,
      steel,
      parent,
    ).rotation.x = -0.35;
  }
  function stock(folding = false, sniper = false) {
    tube('Buffer tube', 0.018, 0.2, 0, 0.015, 0.22, steel);
    const s = group('stock', 0, 0, 0.32);
    silhouette(
      folding ? 'Folding stock frame' : 'Collapsible stock',
      [
        [-0.04, 0.045],
        [0.14, 0.042],
        [0.15, -0.09],
        [0.08, -0.09],
        [0.045, -0.03],
        [-0.04, -0.02],
      ],
      0.04,
      polymer,
      s,
    );
    box('Rubber buttpad', 0.045, 0.15, 0.026, 0, -0.026, 0.15, rubber, s);
    for (let i = 0; i < 8; i++)
      box(
        'Buttpad rib',
        0.048,
        0.004,
        0.026,
        0,
        -0.09 + i * 0.017,
        0.15,
        dark,
        s,
      );
    box('Stock cheek rest', 0.048, 0.025, 0.14, 0, 0.058, 0.05, polymer, s);
    if (sniper) {
      box(
        'Adjustable cheek riser',
        0.055,
        0.035,
        0.16,
        0,
        0.085,
        0.055,
        polymer,
        s,
      );
      for (const z of [0, 0.1])
        tube(
          'Riser adjustment post',
          0.005,
          0.05,
          0.03,
          0.05,
          z,
          edge,
          s,
        ).rotation.x = 0;
    }
    if (folding)
      tube('Stock hinge pin', 0.011, 0.065, 0, 0.005, 0.17, steel).rotation.x =
        0;
  }
  function magazine(curved: boolean, depth = 0.17, z = -0.055, width = 0.038) {
    const g = group('magazine', 0, -0.065, z);
    silhouette(
      'Magazine shell',
      curved
        ? [
            [-0.035, 0],
            [0.032, 0],
            [0.045, -depth * 0.6],
            [0.07, -depth],
            [0.01, -depth],
            [-0.018, -depth * 0.5],
          ]
        : [
            [-0.042, 0],
            [0.042, 0],
            [0.042, -depth],
            [-0.042, -depth],
          ],
      width,
      dark,
      g,
    );
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        box(
          'Magazine stamping',
          0.002,
          depth * 0.72,
          0.003,
          side * width * 0.52,
          -depth * 0.53,
          -0.023 + i * 0.017,
          steel,
          g,
        ).rotation.x = curved ? -0.14 : 0;
    box(
      'Magazine baseplate',
      width + 0.009,
      0.012,
      0.082,
      0,
      -depth,
      curved ? 0.038 : 0,
      polymer,
      g,
    );
    return g;
  }
  function optic(large = false) {
    const g = group('optic');
    box('Optic mount', 0.037, 0.025, 0.15, 0, 0.1, -0.03, dark, g);
    for (const z of [-0.09, 0.005]) {
      box('Scope clamp pedestal', 0.025, 0.042, 0.018, 0, 0.12, z, steel, g);
      ring('Scope clamp ring', large ? 0.028 : 0.021, 0.004, 0, 0.145, z, steel, g);
    }
    tube(
      'Scope tube',
      large ? 0.025 : 0.018,
      large ? 0.28 : 0.13,
      0,
      0.145,
      -0.045,
      dark,
      g,
    );
    const bell = large ? 0.039 : 0.025;
    for (const z of large ? [-0.195, 0.11] : [-0.12, 0.025]) {
      tube('Scope bell', bell, 0.046, 0, 0.145, z, steel, g, bell * 0.75);
      ring('Optic retaining ring', bell, 0.003, 0, 0.145, z - 0.024, dark, g);
      const lensMat = new THREE.ShaderMaterial({
        uniforms: { tint: { value: new THREE.Color(0x539aad) } },
        vertexShader:
          'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
        fragmentShader:
          'uniform vec3 tint; varying vec3 n; varying vec3 v; void main(){float f=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(tint*(.2+f*2.)+vec3(pow(max(0.,dot(normalize(n),normalize(vec3(.4,.6,1.)))),28.)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
        side: THREE.DoubleSide,
      });
      mesh(
        'Reflective optic lens',
        new THREE.CircleGeometry(bell * 0.88, 20),
        lensMat,
        0,
        0.145,
        z - 0.026,
        g,
      );
    }
    for (const [x, y] of [
      [0, 0.18],
      [0.035, 0.145],
    ]) {
      const turret = tube(
        'Scope adjustment turret',
        0.012,
        0.025,
        x,
        y,
        -0.045,
        dark,
        g,
      );
      turret.rotation.x = x ? 0 : Math.PI / 2;
    }
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0.015, -0.62);
  body.add(muzzle);
  const backblast = new THREE.Object3D();
  backblast.name = 'backblast';
  backblast.position.set(0, 0.025, 0.5);
  body.add(backblast);

  if (['ar', 'br', 'smg', 'sniper', 'lmg'].includes(id)) {
    const long = id === 'sniper',
      compact = id === 'smg';
    box(
      'Upper receiver',
      0.066,
      0.085,
      compact ? 0.24 : 0.32,
      0,
      0.017,
      0.015,
      compact ? polymer : steel,
    );
    silhouette(
      'Lower receiver',
      [
        [-0.13, -0.02],
        [0.13, -0.02],
        [0.13, -0.07],
        [0.025, -0.065],
        [-0.015, -0.095],
        [-0.12, -0.095],
      ],
      0.055,
      steel,
    );
    box('Receiver seam', 0.068, 0.002, 0.29, 0, -0.024, 0, rubber);
    box(
      'Ejection port recess',
      0.002,
      0.025,
      0.068,
      0.034,
      0.023,
      -0.015,
      rubber,
    );
    box('Bolt carrier', 0.003, 0.011, 0.051, 0.036, 0.025, -0.015, edge);
    const bolt = group('bolt', 0.039, 0.017, 0.075);
    box('Charging handle', 0.026, 0.011, 0.016, 0, 0, 0, steel, bolt);
    grip();
    screws(-0.1);
    box('Bolt catch paddle', 0.007, 0.027, 0.018, -0.039, -0.002, -0.04, dark);
    box(
      'Fire selector lever',
      0.009,
      0.008,
      0.028,
      -0.04,
      -0.012,
      0.073,
      edge,
    ).rotation.x = 0.4;
    const barrelLength = long
      ? 0.53
      : compact
        ? 0.18
        : id === 'lmg'
          ? 0.4
          : 0.33;
    const barrelZ = -0.22 - barrelLength / 2;
    tube(
      'Bored barrel',
      long ? 0.022 : 0.013,
      barrelLength,
      0,
      0.015,
      barrelZ,
      steel,
    );
    const muzzleZ = -0.22 - barrelLength;
    muzzle.position.z = muzzleZ - 0.055;
    tube('Gas piston', 0.007, barrelLength * 0.85, 0, 0.05, barrelZ, dark);
    box('Gas block', 0.037, 0.05, 0.035, 0, 0.036, muzzleZ + 0.055, steel);
    tube('Muzzle brake', 0.024, 0.065, 0, 0.015, muzzleZ - 0.025, dark);
    for (let i = 0; i < 3; i++) {
      ring(
        'Brake baffle',
        0.026,
        0.003,
        0,
        0.015,
        muzzleZ - 0.005 - i * 0.02,
        edge,
      );
      for (const side of [-1, 1])
        box(
          'Brake port',
          0.003,
          0.014,
          0.011,
          side * 0.023,
          0.015,
          muzzleZ - 0.005 - i * 0.02,
          rubber,
        );
    }
    const handguardLen = compact ? 0.17 : long ? 0.3 : 0.27;
    box(
      long ? 'Aluminum bedding chassis' : 'Handguard',
      0.064,
      0.064,
      handguardLen,
      0,
      0.002,
      -0.16 - handguardLen / 2,
      long ? steel : polymer,
    );
    box(
      'Handguard rail spine',
      0.041,
      0.035,
      handguardLen,
      0,
      0.048,
      -0.16 - handguardLen / 2,
      steel,
    );
    rail(-0.17, handguardLen + 0.25, 0.063);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++)
        box(
          'Handguard vent',
          0.002,
          0.018,
          0.015,
          side * 0.033,
          0.014,
          -0.19 - (i * handguardLen) / 10,
          rubber,
        );
      rail(-0.27, 0.13, 0.013, side * 0.037, true);
    }
    magazine(
      id === 'ar' || compact,
      id === 'br' ? 0.14 : compact ? 0.2 : 0.17,
      id === 'br' ? 0.15 : -0.058,
      id === 'br' ? 0.045 : 0.038,
    );
    stock(id === 'br', long);
    if (id === 'ar') {
      optic();
      body.userData.arOptic = 'ACOG';
    }
    if (long) {
      optic(true);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        tube(
          'Barrel flute',
          0.003,
          barrelLength * 0.8,
          Math.cos(a) * 0.021,
          0.015 + Math.sin(a) * 0.021,
          barrelZ,
          dark,
        );
      }
      for (const side of [-1, 1])
        box(
          'Bipod leg',
          0.012,
          0.22,
          0.012,
          side * 0.055,
          -0.1,
          -0.43,
          steel,
        ).rotation.z = side * 0.23;
    } else if (id === 'lmg') {
      const ammo = parts.magazine;
      ammo.position.x = -0.063;
      box(
        'Side ammunition canister',
        0.14,
        0.145,
        0.13,
        0,
        -0.07,
        0.01,
        polymer,
        ammo,
      );
      const feed = group('feedTray', 0, 0.064, 0.045);
      box('Feed tray cover', 0.076, 0.022, 0.27, 0, 0, 0, steel, feed);
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.11, -0.025, 0.01),
        new THREE.Vector3(-0.12, 0.06, 0.01),
        new THREE.Vector3(-0.05, 0.077, -0.015),
      ]);
      mesh(
        'Feed belt',
        new THREE.TubeGeometry(path, 10, 0.009, 6, false),
        rubber,
        0,
        0,
        0,
      );
      for (let i = 0; i < 8; i++)
        tube(
          'Belt link',
          0.005,
          0.045,
          -0.045 - i * 0.008,
          0.078,
          -0.015,
          edge,
        ).rotation.set(0, 0, Math.PI / 2);
      box('Carry handle mount', 0.018, 0.058, 0.13, 0.055, 0.096, -0.14, dark);
      for (let i = 0; i < 7; i++)
        box(
          'Ribbed carrying handle',
          0.025,
          0.02,
          0.011,
          0.055,
          0.12,
          -0.09 - i * 0.017,
          polymer,
        );
      for (const side of [-1, 1])
        box(
          'Bipod leg',
          0.013,
          0.23,
          0.014,
          side * 0.068,
          -0.1,
          -0.46,
          steel,
        ).rotation.z = side * 0.36;
      for (let i = 0; i < 10; i++)
        ring('Heat sink rib', 0.032, 0.003, 0, 0.015, -0.35 - i * 0.021, steel);
    } else {
      optic();
      if (compact) {
        const folding = group('foregrip', 0, -0.035, -0.23);
        box(
          'Folding foregrip',
          0.035,
          0.1,
          0.043,
          0,
          -0.05,
          0,
          polymer,
          folding,
        );
        for (const side of [-1, 1])
          tube('Wire stock strut', 0.006, 0.3, side * 0.023, 0.03, 0.3, edge);
      }
      if (id === 'br') {
        silhouette(
          'BR55 carry bridge',
          [
            [-0.33, 0.073],
            [-0.24, 0.17],
            [0.08, 0.17],
            [0.1, 0.09],
            [0.065, 0.09],
            [0.045, 0.14],
            [-0.22, 0.14],
            [-0.28, 0.073],
          ],
          0.024,
          dark,
        );
        tube('Long stroke gas piston', 0.011, 0.43, 0, 0.06, -0.32, steel);
        box(
          'Side charging lever',
          0.043,
          0.018,
          0.022,
          0.052,
          0.023,
          -0.04,
          edge,
        );
      }
    }
  } else if (id === 'shotgun') {
    box('Shotgun receiver', 0.07, 0.085, 0.26, 0, 0.006, 0.035, dark);
    grip();
    stock();
    rail(0.02, 0.25, 0.062);
    screws(-0.07);
    tube('Shotgun barrel', 0.021, 0.47, 0, 0.023, -0.31, steel);
    tube('Tubular magazine', 0.022, 0.42, 0, -0.025, -0.29, dark);
    muzzle.position.set(0, 0.023, -0.56);
    const pump = group('pump', 0, -0.025, -0.28);
    tube('Pump action handle', 0.037, 0.18, 0, 0, 0, polymer, pump);
    for (let i = 0; i < 11; i++)
      ring('Pump groove', 0.038, 0.002, 0, 0, -0.079 + i * 0.015, rubber, pump);
    tube('Heat shield', 0.027, 0.24, 0, 0.023, -0.35, dark);
    for (let i = 0; i < 12; i++)
      box(
        'Shield cooling slot',
        0.033,
        0.002,
        0.008,
        0,
        0.05,
        -0.24 - i * 0.018,
        rubber,
      );
    ring('Ghost ring rear sight', 0.012, 0.002, 0, 0.087, 0.105);
    box('Front sight', 0.012, 0.021, 0.013, 0, 0.058, -0.5, edge);
    box('Ejection port', 0.003, 0.025, 0.07, 0.036, 0.012, 0.01, rubber);
  } else if (id === 'pistol') {
    silhouette(
      'Polymer pistol frame',
      [
        [-0.1, 0.016],
        [0.09, 0.018],
        [0.075, -0.035],
        [0.05, -0.15],
        [-0.005, -0.15],
        [-0.035, -0.035],
        [-0.1, -0.022],
      ],
      0.032,
      polymer,
    );
    const slide = group('slide', 0, 0.042, -0.025);
    box('Serrated slide', 0.039, 0.039, 0.19, 0, 0, 0, steel, slide);
    for (const side of [-1, 1])
      for (let i = 0; i < 9; i++)
        box(
          'Slide serration',
          0.002,
          0.027,
          0.002,
          side * 0.02,
          0,
          0.025 + i * 0.007,
          rubber,
          slide,
        );
    box(
      'Pistol ejection port',
      0.021,
      0.003,
      0.034,
      0,
      0.022,
      0.015,
      rubber,
      slide,
    );
    tube('Pistol barrel', 0.009, 0.14, 0, 0.035, -0.055, dark);
    muzzle.position.set(0, 0.035, -0.13);
    grip(0.048);
    magazine(false, 0.12, 0.05, 0.027);
    rail(-0.07, 0.065, -0.028);
    box('Front iron sight', 0.006, 0.009, 0.008, 0, 0.026, -0.081, edge, slide);
    for (const side of [-1, 1])
      box(
        'Rear iron sight',
        0.008,
        0.009,
        0.012,
        side * 0.013,
        0.026,
        0.071,
        edge,
        slide,
      );
  } else if (id === 'laser') {
    for (const side of [-1, 1]) {
      const shell = silhouette(
        'Plasma repeater shell',
        [
          [-0.54, 0.05],
          [-0.45, 0.09],
          [-0.12, 0.075],
          [0.18, 0.01],
          [0.12, -0.07],
          [-0.02, -0.04],
          [-0.32, -0.02],
          [-0.5, -0.005],
        ],
        0.031,
        purple,
      );
      shell.position.x = side * 0.052;
      tube('Emitter prong', 0.018, 0.29, side * 0.05, 0.015, -0.39, steel);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.06, 0.01, -0.1),
        new THREE.Vector3(side * 0.07, 0.06, -0.25),
        new THREE.Vector3(side * 0.05, 0.02, -0.48),
      ]);
      mesh(
        'Energy coil conduit',
        new THREE.TubeGeometry(curve, 20, 0.006, 8, false),
        glow,
        0,
        0,
        0,
      );
      for (let i = 0; i < 8; i++)
        box(
          'Glowing heat exhaust',
          0.002,
          0.018,
          0.014,
          side * 0.07,
          0.052,
          -0.1 - i * 0.032,
          glow,
        );
    }
    grip(0.11);
    const cell = group('magazine', 0, -0.025, 0.05);
    tube('Removable plasma cell', 0.031, 0.13, 0, 0, 0, glow, cell).rotation.x =
      0;
    tube('Optic emitter head', 0.025, 0.06, 0, 0.015, -0.47, glow);
    ring('Emitter aperture', 0.03, 0.005, 0, 0.015, -0.505, dark);
    muzzle.position.z = -0.515;
  } else if (id === 'minigun') {
    tube('Electric drive motor', 0.08, 0.24, 0, 0, 0.085, dark);
    tube('Motor end cap', 0.082, 0.025, 0, 0, 0.217, steel);
    const rotor = group('rotor', 0, 0, -0.055);
    tube('Rotor axle', 0.022, 0.58, 0, 0, -0.26, steel, rotor);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      tube(
        `Rotary barrel ${i + 1}`,
        0.014,
        0.58,
        Math.cos(a) * 0.057,
        Math.sin(a) * 0.057,
        -0.27,
        steel,
        rotor,
      );
      ring(
        'Barrel bore',
        0.01,
        0.003,
        Math.cos(a) * 0.057,
        Math.sin(a) * 0.057,
        -0.565,
        rubber,
        rotor,
      );
    }
    for (const z of [-0.09, -0.32, -0.52])
      ring('Cluster clamp ring', 0.075, 0.01, 0, 0, z, dark, rotor);
    box('Spade grip crossbar', 0.22, 0.025, 0.027, 0, 0.017, 0.24, steel);
    for (const side of [-1, 1])
      box(
        'Dual spade handgrip',
        0.032,
        0.12,
        0.037,
        side * 0.095,
        -0.027,
        0.24,
        polymer,
      );
    const belt = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.065, 0, 0.07),
      new THREE.Vector3(-0.16, -0.04, 0.11),
      new THREE.Vector3(-0.18, -0.16, 0.26),
    ]);
    mesh(
      'Flexible ammunition chute',
      new THREE.TubeGeometry(belt, 14, 0.025, 8, false),
      dark,
      0,
      0,
      0,
    );
    for (let i = 0; i < 15; i++) {
      const v = belt.getPoint(i / 14);
      box('Chute articulation', 0.056, 0.009, 0.037, v.x, v.y, v.z, steel);
    }
    box('Carry bracket', 0.029, 0.065, 0.13, 0, 0.075, 0.04, steel);
    box('Top mechanical sight', 0.056, 0.03, 0.04, 0, 0.117, -0.04, dark);
    muzzle.position.set(0, 0, -0.64);
  } else if (id === 'railgun') {
    box('Capacitor receiver', 0.085, 0.11, 0.26, 0, 0, 0.09, dark);
    stock();
    grip();
    rail(-0.055, 0.34, 0.084);
    optic();
    const cell = group('magazine', 0, -0.005, 0.015);
    tube('Capacitor bank', 0.035, 0.13, 0, 0, 0, steel, cell);
    for (const y of [-0.045, 0.062]) {
      box('Parallel conductive rail', 0.035, 0.023, 0.63, 0, y, -0.4, steel);
      box(
        'Conductive rail core',
        0.016,
        0.007,
        0.64,
        0,
        y + (y > 0 ? -0.014 : 0.014),
        -0.4,
        glow,
      );
    }
    for (let i = 0; i < 6; i++) {
      box(
        'Magnetic accelerator housing',
        0.092,
        0.13,
        0.024,
        0,
        0.008,
        -0.19 - i * 0.091,
        dark,
      );
      box(
        'Coil indicator',
        0.094,
        0.012,
        0.026,
        0,
        0.008,
        -0.19 - i * 0.091,
        glow,
      );
    }
    for (const side of [-1, 1]) {
      tube(
        'Hydraulic recoil damper',
        0.013,
        0.19,
        side * 0.057,
        0.001,
        0.185,
        steel,
      );
      tube('Damper piston', 0.007, 0.08, side * 0.057, 0.001, 0.31, edge);
    }
    const arcMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, charge: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader:
        'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 vUv;uniform float time;uniform float charge;void main(){float wave=.5+.27*sin(vUv.x*39.+time*23.)+.1*sin(vUv.x*97.-time*45.);float arc=pow(max(0.,1.-abs(vUv.y-wave)*35.),3.);gl_FragColor=vec4(vec3(.12,.55,1.)*3.,arc*(.12+charge*.88));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    });
    const arc = mesh(
      'Dynamic rail arcs',
      new THREE.PlaneGeometry(0.59, 0.12),
      arcMaterial,
      0,
      0.01,
      -0.41,
    );
    arc.rotation.y = Math.PI / 2;
    parts.arc = arc;
    muzzle.position.set(0, 0.01, -0.74);
  } else if (id === 'rocket') {
    tube(
      'Composite launch tube',
      0.052,
      0.89,
      0,
      0.025,
      -0.02,
      polymer,
      body,
      0.041,
    );
    tube(
      'Tapered launch throat',
      0.044,
      0.11,
      0,
      0.025,
      -0.505,
      steel,
      body,
      0.06,
    );
    tube('Flared exhaust cone', 0.09, 0.15, 0, 0.025, 0.48, steel, body, 0.046);
    for (let i = 0; i < 11; i++)
      ring('Heat shield band', 0.055, 0.003, 0, 0.025, -0.2 + i * 0.042, dark);
    grip(0.1);
    grip(-0.22);
    box('Scope mount', 0.075, 0.025, 0.07, -0.04, 0.071, -0.05, steel);
    optic();
    for (const z of [-0.42, 0.25]) {
      box('Flip up sight stem', 0.012, 0.05, 0.018, 0, 0.092, z, steel);
      ring('Flip up iron sight', 0.014, 0.003, 0, 0.13, z, dark);
    }
    muzzle.position.set(0, 0.025, -0.57);
    backblast.position.set(0, 0.025, 0.565);
  } else {
    box('Launcher receiver', 0.076, 0.075, 0.2, 0, 0.027, 0.085, steel);
    stock();
    grip(0.12);
    const drum = group('magazine', 0, -0.01, -0.055);
    tube('Revolver cylinder', 0.076, 0.16, 0, 0, 0, dark, drum);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ring(
        `40mm chamber ${i + 1}`,
        0.022,
        0.003,
        Math.cos(a) * 0.05,
        Math.sin(a) * 0.05,
        -0.083,
        steel,
        drum,
      );
      tube(
        'Cylinder flute',
        0.007,
        0.12,
        Math.cos(a) * 0.076,
        Math.sin(a) * 0.076,
        0,
        steel,
        drum,
      );
    }
    tube('Launcher barrel', 0.032, 0.25, 0, 0.035, -0.25, steel);
    ring('Launcher muzzle', 0.033, 0.004, 0, 0.035, -0.38, dark);
    const fore = group('foregrip', 0, -0.04, -0.22);
    box('Rubber foregrip', 0.046, 0.12, 0.046, 0, -0.04, 0, rubber, fore);
    for (let i = 0; i < 6; i++)
      box(
        'Foregrip rib',
        0.05,
        0.004,
        0.047,
        0,
        -0.09 + i * 0.017,
        0,
        polymer,
        fore,
      );
    box('Leaf sight', 0.024, 0.08, 0.008, 0, 0.112, -0.14, steel);
    for (let i = 0; i < 4; i++)
      box(
        'Leaf sight notch',
        0.021,
        0.003,
        0.009,
        0,
        0.084 + i * 0.015,
        -0.145,
        rubber,
      );
    tube('Cylinder hinge', 0.012, 0.07, 0.042, 0.033, 0.012, edge).rotation.set(
      0,
      0,
      Math.PI / 2,
    );
    muzzle.position.set(0, 0.035, -0.4);
    backblast.position.set(0, -0.005, 0.18);
  }

  if (id === 'railgun') {
    const cell = group('magazine', 0, -.055, .14);
    box('Removable capacitor bank', .07, .055, .11, 0, 0, 0, dark, cell);
    box('Capacitor charge contacts', .075, .01, .07, 0, .028, 0, glow, cell);
  }
  if (id === 'laser' || id === 'railgun' || id === 'minigun') {
    const vent = group('vent', .052, .03, .02);
    box('Articulated coolant vent', .009, .037, .095, 0, 0, 0, steel, vent);
  }
  if (id === 'shotgun' || id === 'rocket') {
    const round = group('reloadRound', 0, -.07, id === 'rocket' ? -.55 : .04);
    const shell = tube(id === 'rocket' ? 'Tube-loaded rocket' : 'Inserted shotgun shell', id === 'rocket' ? .036 : .012, id === 'rocket' ? .25 : .05, 0, 0, 0, id === 'rocket' ? dark : purple, round);
    shell.rotation.x = id === 'shotgun' ? Math.PI / 2 : 0;
    round.visible = false;
  }
  // Bake static components by material within each moving assembly. Rails/fasteners
  // become a handful of draw calls, while magazine/slide/pump/rotor remain independent.
  function bake(parent: THREE.Object3D) {
    for (const child of parent.children.slice())
      if (child instanceof THREE.Group) bake(child);
    const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of parent.children)
      if (
        child instanceof THREE.Mesh &&
        !(child.material instanceof THREE.ShaderMaterial)
      ) {
        const mat = child.material as THREE.Material;
        const list = byMaterial.get(mat) ?? [];
        list.push(child);
        byMaterial.set(mat, list);
      }
    const featureNames: string[] = [];
    for (const [material, meshes] of byMaterial) {
      const transformed = meshes.map((m) => {
        featureNames.push(m.name);
        m.updateMatrix();
        let g = m.geometry.clone();
        if (g.index) {
          const old = g;
          g = g.toNonIndexed();
          old.dispose();
        }
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = mergeGeometries(transformed, false);
      transformed.forEach((g) => g.dispose());
      if (!merged) throw new Error(`Could not bake ${id} components`);
      meshes.forEach((m) => {
        m.geometry.dispose();
        parent.remove(m);
      });
      const draw = new THREE.Mesh(merged, material);
      draw.castShadow = draw.receiveShadow = true;
      parent.add(draw);
    }
    parent.userData.features = featureNames;
  }
  bake(body);
  const used = new Set<THREE.Material>();
  root.traverse((o: any) => {
    if (o.material) used.add(o.material);
  });
  materials.forEach((m) => {
    if (!used.has(m)) m.dispose();
  });
  // A texture may be referenced by another finish even when its original owner is unused.
  const owner = [...used].find(
    (m) =>
      m instanceof THREE.MeshStandardMaterial &&
      m.roughnessMap === metalTexture,
  );
  if (owner)
    owner.userData.ownedTextures = [
      ...(owner.userData.ownedTextures ?? []),
      metalTexture,
    ];
  else metalTexture.dispose();
  if (!used.has(polymer)) gripTexture.dispose();
  let time = 0;
  return {
    root,
    muzzle,
    backblast,
    parts,
    update(dt, charge = 0, spin = 0) {
      time += dt;
      if (parts.rotor) parts.rotor.rotation.z += spin;
      if (parts.arc) {
        const m = (parts.arc as THREE.Mesh).material as THREE.ShaderMaterial;
        m.uniforms.time.value = time;
        m.uniforms.charge.value = charge;
      }
      if (id === 'railgun') glow.emissiveIntensity = 0.8 + charge * 4;
      if (id === 'laser')
        glow.emissiveIntensity = 2.3 + Math.sin(time * 5) * 0.3;
    },
  };
}
