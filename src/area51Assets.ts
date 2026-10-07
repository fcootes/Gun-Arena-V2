import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Lit procedural desert camouflage; object-space cells remain stable on merged vehicles. */
function desertMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc5b184,
    roughness: 0.82,
    metalness: 0.22,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCamo;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvCamo = position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vCamo;\nfloat camoHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nfloat c=camoHash(floor(vCamo*4.0));\nvec3 tint=c<.22?vec3(.49,.43,.30):c<.49?vec3(.70,.61,.43):vec3(.91,.81,.60);\ndiffuseColor.rgb*=tint;",
      );
  };
  mat.customProgramCacheKey = () => "area51-desert-camo-v1";
  return mat;
}

/** Merge by material after baking every component transform: 3–5 draw calls per vehicle. */
export function buildArea51Vehicle(kind: "abrams" | "humvee"): THREE.Group {
  const group = new THREE.Group();
  group.name = kind === "abrams" ? "M1_Abrams" : "Desert_Humvee";
  const camo = desertMaterial(),
    rubber = new THREE.MeshStandardMaterial({
      color: 0x191d1b,
      roughness: 0.95,
    });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x3c433a,
    roughness: 0.6,
    metalness: 0.7,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x203236,
    roughness: 0.22,
    metalness: 0.65,
  });
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  function add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(matrix);
    const list = batches.get(material) ?? [];
    list.push(geometry);
    batches.set(material, list);
  }
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m = camo,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  const cylinder = (
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m = metal,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => add(new THREE.CylinderGeometry(r, r, h, 12), m, x, y, z, rx, ry, rz);
  if (kind === "abrams") {
    box(3.7, 0.8, 6.7, 0, 1.0, 0);
    box(3.4, 0.5, 5.4, 0, 1.6, 0.35);
    box(3.5, 0.4, 1.45, 0, 1.3, -3.0, camo, 0.25);
    box(2.75, 0.85, 3.3, 0, 2.05, 0.05);
    box(2.9, 0.55, 1.1, 0, 2, -1.7, camo, 0.28);
    cylinder(0.75, 0.3, 0, 1.8, 0, camo);
    cylinder(0.13, 4.8, 0, 2.14, -4.1, metal, Math.PI / 2);
    cylinder(0.22, 0.7, 0, 2.14, -2.1, camo, Math.PI / 2);
    for (const side of [-1, 1]) {
      box(0.64, 1.05, 6.5, side * 1.9, 0.65, 0, rubber);
      box(0.35, 0.35, 6.9, side * 2.03, 1.4, 0);
      for (let i = 0; i < 7; i++)
        cylinder(
          0.43,
          0.7,
          side * 1.95,
          0.64,
          -2.5 + i * 0.83,
          metal,
          0,
          0,
          Math.PI / 2,
        );
      for (let i = 0; i < 22; i++) {
        box(0.74, 0.09, 0.23, side * 1.95, 0.15, -3.12 + i * 0.29, metal);
        box(0.74, 0.09, 0.23, side * 1.95, 1.16, -3.12 + i * 0.29, metal);
      }
      box(0.4, 0.55, 1.4, side * 1.45, 2.02, 1.2, metal);
    }
    cylinder(0.4, 0.13, 0.68, 2.54, 0.15, camo);
    cylinder(0.28, 0.13, -0.58, 2.54, 0.4, camo);
    box(2.4, 0.14, 1.1, 0, 1.95, 2.52, metal);
    for (let i = 0; i < 12; i++)
      box(0.06, 0.08, 1.0, -1.08 + i * 0.2, 2.05, 2.5, rubber);
    cylinder(0.05, 1.3, 0.85, 3.05, 0.8);
    box(0.12, 0.17, 1.1, 0.8, 2.8, -0.28, metal);
    cylinder(0.018, 1.7, -1.1, 3.12, 1.2);
  } else {
    box(2.55, 0.45, 4.8, 0, 0.8, 0);
    box(2.45, 0.9, 2.8, 0, 1.43, 0.4);
    box(2.35, 0.22, 1.35, 0, 1.42, -1.78, camo, -0.12);
    box(2.45, 0.18, 2.9, 0, 2.12, 0.35);
    box(2.12, 0.59, 0.08, 0, 1.83, -1.08, glass, 0.15);
    for (const side of [-1, 1]) {
      for (const z of [-1.55, 1.48]) {
        cylinder(0.61, 0.44, side * 1.3, 0.61, z, rubber, 0, 0, Math.PI / 2);
        cylinder(0.3, 0.46, side * 1.31, 0.61, z, metal, 0, 0, Math.PI / 2);
      }
      for (const z of [-0.6, 0.68]) {
        box(0.07, 0.53, 0.88, side * 1.24, 1.83, z, glass);
        box(0.09, 0.58, 0.1, side * 1.27, 1.82, z + 0.47);
        box(0.09, 0.09, 0.2, side * 1.3, 1.36, z + 0.26, metal);
      }
      box(0.12, 0.14, 2.7, side * 1.36, 0.89, 0.2, metal);
      box(0.36, 0.12, 0.3, side * 0.82, 1.14, -2.45, glass);
    }
    box(2.7, 0.18, 0.24, 0, 0.63, -2.56, metal);
    box(2.7, 0.18, 0.24, 0, 0.63, 2.48, metal);
    for (let i = 0; i < 8; i++)
      box(0.08, 0.38, 0.07, -0.65 + i * 0.18, 1.06, -2.43, rubber);
    cylinder(0.51, 0.17, 0, 2.23, 0.3, metal);
    box(1.35, 0.75, 0.12, 0, 2.63, -0.2);
    box(0.13, 0.16, 1.5, 0, 2.57, -0.82, metal);
    cylinder(0.018, 1.65, 1.13, 2.8, 1.65);
    // Static casualty with a bent torso and arms draped over the turret shield.
    const cloth = new THREE.MeshStandardMaterial({
      color: 0x5f6448,
      roughness: 0.95,
    });
    box(0.48, 0.7, 0.28, 0.36, 2.65, 0.28, cloth, 0.95);
    cylinder(0.17, 0.26, 0.36, 2.83, -0.05, cloth);
    for (const side of [-1, 1]) {
      box(0.12, 0.55, 0.13, 0.36 + side * 0.3, 2.52, -0.08, cloth, 0.35);
      box(0.16, 0.56, 0.17, 0.36 + side * 0.16, 2.17, 0.55, cloth, -0.45);
    }
  }
  batches.forEach((geometries, material) => {
    // Convert indexed primitives consistently, avoiding incompatible attribute index layouts.
    const plain = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(plain, false);
    if (!merged) throw new Error(`Unable to merge ${kind} geometry`);
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    plain.forEach((g) => g.dispose());
    geometries.forEach((g) => {
      if (!plain.includes(g)) g.dispose();
    });
  });
  for (const mat of [camo, rubber, metal, glass])
    if (!batches.has(mat)) mat.dispose();
  group.updateMatrixWorld(true);
  return group;
}
