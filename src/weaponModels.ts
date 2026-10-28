import {buildPlasmaModel} from './plasmaModel';
import {createPlasmaAnimator} from './plasmaAnimation';
import {createRailgunAnimator} from './railgunMechanics';
import type {WeaponSlotState} from './types';
import {buildRailgunModel} from './railgunModel';
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
  update: (dt: number, charge?: number, spin?: number, state?:WeaponSlotState) => void;
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
export function createWeaponAssembly(id: string, options: { firstPerson?: boolean } = {}): WeaponAssembly {
  if (!WEAPON_MODEL_IDS.includes(id as WeaponModelId))
    throw new RangeError(`Unknown weapon model: ${id}`);
  const root = new THREE.Group();
  root.name = `Weapon_${id}`;
  root.userData.weaponId = id;
  const parts: Record<string, THREE.Object3D> = {};
  let plasmaVisual: ReturnType<typeof buildPlasmaModel>|undefined;
  let railgunUpdate: ((charge:number,time:number)=>void)|undefined;
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
  if (id === 'br') {
    // Owned per assembly: graphite alloy, matte composite and restrained steel
    // remain readable under the existing low-light/inspection environments.
    steel.color.setHex(0x454d54); steel.metalness = .65; steel.roughness = .50;
    dark.color.setHex(0x252c33); dark.metalness = .45; dark.roughness = .60;
    polymer.color.setHex(0x30383d); polymer.roughness = .87;
    rubber.color.setHex(0x14191c);
    edge.color.setHex(0x707a82); edge.metalness = .75; edge.roughness = .44;
  }
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
      new THREE.CylinderGeometry(radius, endRadius, length, 16, 1, !!options.firstPerson && (name === 'Scope tube' || name === 'Scope bell')),
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
    const g = id === 'br' ? silhouette('Contoured firing grip',
      [[-.032,.067],[.030,.062],[.032,-.050],[.012,-.076],[-.027,-.066],[-.036,-.039]], .048, polymer, parent) : box(
      'Stippled pistol grip',
      id === 'br' ? .048 : 0.04,
      id === 'br' ? .145 : 0.13,
      id === 'br' ? .066 : 0.055,
      0,
      -0.1,
      z,
      polymer,
      parent,
    );
    if (id === 'br') {
      g.position.set(0,-.1,z);
      box('Grip shoulder collar', .057, .025, .070, 0, -.043, z, dark, parent);
    }
    g.rotation.x = -0.24;
    if (id === 'br') {
      for (const side of [-1,1]) for (let i=0;i<5;i++)
        box('Grip texture channel', .0015, .004, .033, side*.024, -.075-i*.015, z+i*.002, rubber, parent);
    } else for (let i = 0; i < 6; i++)
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
    const s = group('stock', 0, 0, 0.32);
    tube('Buffer tube', 0.018, 0.2, 0, 0.015, options.firstPerson ? -.10 : .22, steel, options.firstPerson ? s : body);
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
    box('Optic mount', id === 'br' ? .045 : 0.037, 0.025, 0.15, 0, 0.1, -0.03, dark, g);
    for (const z of [-0.09, 0.005]) {
      box('Scope clamp pedestal', id === 'br' ? .031 : 0.025, 0.042, 0.018, 0, 0.12, z, steel, g);
      ring('Scope clamp ring', large ? 0.028 : 0.021, 0.004, 0, 0.145, z, steel, g);
    }
    tube(
      'Scope tube',
      large ? 0.025 : id === 'br' ? .019 : 0.018,
      large ? 0.28 : id === 'br' ? .15 : 0.13,
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
      if (!options.firstPerson) {
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
      if (id === 'br') {
        if (x) {
          turret.rotation.set(0,0,Math.PI/2);
          box('Optic side adjustment collar', .018, .022, .024, .022, .145, -.045, dark, g);
        } else {
          turret.rotation.x=0;
          box('Optic elevation collar', .022, .016, .028, 0, .166, -.045, dark, g);
        }
      } else turret.rotation.x = x ? 0 : Math.PI / 2;
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

  if (id === 'br') {
    // BR-only chassis: longitudinal octagonal sections form real width/height
    // tapers. Shared rifle construction below is intentionally not instantiated.
    // Each section is [Z, half-width, bottom, top, chamfer]. No frame allocations.
    type Section = [number, number, number, number, number];
    function hull(name: string, sections: Section[], material: THREE.Material,
      parent: THREE.Object3D = body) {
      const channel = name === 'Continuous upper receiver chassis' ||
        name === 'Extended integrated shoulder stock';
      const rings = sections.map(([z,w,b,t,c]) => channel ? [
        [-w+c,t,z],[w-c,t,z],[w,t-c,z],
        [w,.022,z],[w-.002,.019,z],[w-.002,.009,z],[w,.006,z],
        [w,b+c,z],[w-c,b,z],[-w+c,b,z],[-w,b+c,z],
        [-w,.006,z],[-w+.002,.009,z],[-w+.002,.019,z],[-w,.022,z],[-w,t-c,z],
      ] : [
        [-w+c,t,z],[w-c,t,z],[w,t-c,z],[w,b+c,z],
        [w-c,b,z],[-w+c,b,z],[-w,b+c,z],[-w,t-c,z],
      ]);
      const positions: number[] = [];
      const triangle = (a: number[], b: number[], c: number[]) => positions.push(...a,...b,...c);
      const quad = (a: number[], b: number[], c: number[], d: number[]) => {
        triangle(a,c,b);triangle(a,d,c);
      };
      // Clockwise section outlines; the longitudinal faces and end caps have
      // explicit outward winding. The shallow panel channels are actual hull
      // sections, so highlights follow their recessed shoulders in all views.
      const count=rings[0].length;
      for(let j=0;j<rings.length-1;j++) for(let i=0;i<count;i++) {
        const k=(i+1)%count,a=rings[j][i],b=rings[j][k],c=rings[j+1][k],d=rings[j+1][i];
        if(name !== 'Tapered monocoque handguard' || j !== 2 || (i !== 2 && i !== 6)) {
          quad(a,b,c,d);continue;
        }
        // Four machined cooling recesses per side are cut into the surface,
        // not black rectangles glued over it. Surrounding quads meet each rim.
        const us=[0,.10,.22,.33,.45,.56,.68,.79,.91,1];
        const vs=i===2?[0,.22,.40,1]:[0,.60,.78,1];
        const point=(u:number,v:number,depth=0)=>a.map((x,n)=>
          (1-u)*((1-v)*x+v*b[n])+u*((1-v)*d[n]+v*c[n])+
          (n===0?-Math.sign(a[0])*depth:0));
        for(let u=0;u<us.length-1;u++)for(let v=0;v<vs.length-1;v++) {
          const corners=[[us[u],vs[v]],[us[u],vs[v+1]],
            [us[u+1],vs[v+1]],[us[u+1],vs[v]]];
          const rim=corners.map(([u,v])=>point(u,v));
          if(u%2===0||v!==1){quad(rim[0],rim[1],rim[2],rim[3]);continue;}
          const inset=corners.map(([u,v])=>point(u,v,.003));
          quad(inset[0],inset[1],inset[2],inset[3]);
          for(let n=0;n<4;n++) {
            const next=(n+1)%4;
            quad(rim[n],rim[next],inset[next],inset[n]);
          }
        }
      }
      for(const [j,front] of [[0,true],[rings.length-1,false]] as const) {
        const r=rings[j],center=[0,(sections[j][2]+sections[j][3])/2,sections[j][0]];
        for(let i=0;i<count;i++) {
          const a=r[i],b=r[(i+1)%count];
          if(front)triangle(center,a,b);else triangle(center,b,a);
        }
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      // The existing bake combines the same material family; provide UVs for it.
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap((_,i)=>i%3===0?[positions[i+2]*3,positions[i+1]*3]:[]),2));
      geometry.computeVertexNormals();
      return mesh(name,geometry,material,0,0,0,parent);
    }
    // One continuous fore-end, with a shallow underside palm contact. The rear
    // section exactly meets the receiver section, not a plate over a solid box.
    hull('Tapered monocoque handguard',[
      [-.460,.022,-.021,.036,.007],[-.430,.030,-.047,.043,.009],
      [-.365,.034,-.064,.047,.010],[-.185,.036,-.064,.049,.010],
      [-.130,.036,-.047,.052,.009],
    ],polymer);
    hull('Continuous upper receiver chassis',[
      [-.130,.036,-.047,.052,.009],[-.090,.037,-.045,.055,.009],
      [.115,.039,-.046,.056,.009],[.160,.042,-.050,.057,.010],
      [.270,.042,-.050,.057,.010],
    ],steel);
    // The magwell sides are structural walls. Nothing spans the protected
    // withdrawal opening below Y -.063 between Z .165 and .255.
    for(const side of [-1,1]) {
      const wall=hull('Rear magazine socket wall',[
        [.153,.005,-.054,-.034,.002],[.168,.005,-.061,-.034,.002],
        [.252,.005,-.061,-.034,.002],[.268,.005,-.050,-.034,.002],
      ],polymer);wall.position.x=side*.034;
    }
    // Lower central web ends ahead of the rear magazine. Trigger and firing
    // grip keep their accepted physical contact/attachment positions.
    hull('Lower receiver grip web',[
      [-.130,.029,-.047,-.024,.005],[-.065,.029,-.053,-.024,.005],
      [.065,.030,-.054,-.024,.005],[.145,.033,-.050,-.024,.005],
    ],polymer);
    grip();
    magazine(false,.14,.21,.045);
    const rear=group('stock',0,0,.25);
    hull('Extended integrated shoulder stock',[
      [.020,.042,-.050,.057,.010],[.075,.042,-.052,.062,.011],
      [.145,.040,-.066,.065,.012],[.230,.037,-.071,.057,.012],
      [.247,.036,-.069,.052,.011],
    ],polymer,rear);
    hull('Shoulder rubber buttpad',[
      [.247,.036,-.069,.052,.010],[.254,.038,-.073,.054,.010],
      [.264,.037,-.072,.053,.010],
    ],rubber,rear);
    // Cheek surface belongs to the stock and follows its taper; its underside
    // matches the hull top, rather than covering a disconnected side plate.
    hull('Integrated cheek contact',[
      [.030,.029,.058,.062,.002],[.100,.030,.063,.069,.002],
      [.175,.028,.061,.067,.002],[.230,.025,.057,.061,.002],
    ],dark,rear);
    box('Chassis lower support pad',.058,.010,.205,0,-.068,-.280,rubber);
    const bolt=group('bolt',-.045,.048,-.025);
    box('Side charging lever',.043,.018,.022,0,0,0,edge,bolt);
    box('Charging guide',.006,.006,.108,-.039,.046,-.006,dark);
    tube('Bored barrel',.013,.15,0,.015,-.505,steel);
    tube('Long stroke gas piston',.006,.075,0,.043,-.455,dark);
    tube('Machined muzzle brake',.020,.050,0,.015,-.580,dark);
    ring('Muzzle crown',.017,.002,0,.015,-.605,steel);
    muzzle.position.set(0,.015,-.22-.33-.055);
    // Slim integrated bridge. Its lower edge and tapered supports form one
    // structural outline; the existing scope axis and mount stay fixed.
    silhouette('Carry bridge',[
      [-.300,.049],[-.281,.101],[-.250,.152],[-.232,.1575],
      [.082,.1575],[.108,.130],[.140,.056],[.107,.056],
      [.079,.137],[-.230,.137],[-.257,.098],[-.271,.051],
    ],.036,polymer);
    optic();parts.optic.position.y=.07;
    box('Optic saddle seat',.046,.006,.160,0,.155,-.030,steel);
  } else if (id === 'smg') {
    // Original SC-32 blowback chassis: tapered short upper, straight narrow
    // magazine and twin-rail brace, with no rifle gas tube/buffer silhouette.
    steel.color.setHex(0x495159); steel.metalness=.62; steel.roughness=.48;
    polymer.color.setHex(0x2b3238); dark.color.setHex(0x242b31);
    silhouette('SC-32 monolithic upper',[
      [-.285,.012],[-.267,.052],[-.10,.065],[.128,.055],
      [.15,.025],[.14,-.025],[-.26,-.025],
    ],.064,steel);
    silhouette('SC-32 lower chassis',[
      [-.115,-.023],[.135,-.023],[.13,-.057],[.075,-.067],
      [.015,-.056],[-.012,-.088],[-.094,-.088],
    ],.052,polymer);
    box('Upper manufacturing seam',.065,.002,.26,0,-.025,.005,dark);
    grip(.125);
    const well=group('magwell',0,-.065,-.055);
    box('Flared magazine housing',.047,.045,.071,0,0,0,polymer,well);
    const mag=group('magazine',0,-.075,-.055);
    silhouette('Straight double stack magazine',[
      [-.027,0],[.027,0],[.030,-.155],[-.027,-.155],
    ],.029,dark,mag);
    box('Magazine floorplate',.037,.012,.063,0,-.157,.001,polymer,mag);
    for(const side of [-1,1]) {
      for(const z of [-.013,.012])box('Magazine pressed groove',.002,.112,.003,side*.015,-.078,z,rubber,mag);
      for(let n=0;n<5;n++)box('Handguard cooling slot',.002,.012,.016,side*.033,.015,-.15-n*.025,rubber);
    }
    box('Contoured handguard underside',.061,.032,.16,0,-.032,-.21,polymer);
    box('Front hand stop',.058,.025,.012,0,-.057,-.286,polymer);
    for(let n=0;n<5;n++)box('Underside traction rib',.058,.003,.008,0,-.049,-.157-n*.024,rubber);
    // Near-side slide nested in a fixed receiver guide. Its 34 mm action never
    // reaches the rear cap (z=.14), even at full mechanical extension.
    box('Charging slot recess',.003,.013,.105,-.033,.040,-.062,rubber);
    box('Charging slot upper lip',.006,.004,.112,-.033,.049,-.062,dark);
    const bolt=group('bolt',-.043,.040,-.095);
    box('Captive charging stem',.026,.010,.016,0,0,0,steel,bolt);
    box('Serrated charging paddle',.014,.021,.027,-.016,0,0,edge,bolt);
    for(let n=0;n<3;n++)box('Charging paddle knurl',.002,.018,.002,-.024,0,-.008+n*.008,dark,bolt);
    box('Ejection port recess',.002,.022,.070,.033,.025,-.022,rubber);
    const carrier=group('carrier',.034,.025,-.022);
    box('Internal blowback carrier',.003,.015,.050,0,0,0,edge,carrier);
    box('Magazine release paddle',.008,.016,.017,-.029,-.045,-.092,dark);
    box('Ambidextrous selector',.009,.009,.022,-.031,-.022,.098,edge);
    rail(-.065,.32,.068);
    const sights=group('sights');
    for(const z of [.087,-.259]) {
      box('Sight pedestal',.035,.014,.024,0,.082,z,dark,sights);
      for(const side of [-1,1])box('Sight protective ear',.006,.022,.013,side*.013,.098,z,steel,sights);
    }
    box('Front sight post',.003,.016,.005,0,.097,-.259,edge,sights);
    box('Rear notch base',.021,.005,.006,0,.090,.087,steel,sights);
    tube('Recessed barrel',.012,.055,0,.012,-.308,steel);
    tube('Compact ported muzzle housing',.021,.041,0,.012,-.341,dark);
    ring('Muzzle crown',.010,.003,0,.012,-.363,edge);
    muzzle.position.set(0,.012,-.365);
    box('Rear receiver cap',.062,.061,.014,0,.013,.145,dark);
    const brace=group('stock',0,0,.15);
    for(const side of [-1,1])box('Telescoping brace rail',.009,.012,.18,side*.024,.025,.09,steel,brace);
    box('Compact brace butt',.045,.104,.022,0,-.016,.18,polymer,brace);
    box('Brace shoulder pad',.043,.095,.009,0,-.016,.194,rubber,brace);
    screws(-.10,4);
  } else if (id === 'lmg') {
    // HMG-100: open feed bed between substantial receiver walls. The front
    // hinge is the actual origin of the lid, never its geometric centre.
    steel.color.setHex(0x424d55);steel.metalness=.68;steel.roughness=.52;
    polymer.color.setHex(0x2d373c);dark.color.setHex(0x20292f);
    silhouette('HMG lower chassis',[
      [-.21,-.006],[.16,-.006],[.17,-.055],[.075,-.074],
      [.012,-.054],[-.03,-.080],[-.18,-.073],
    ],.076,polymer);
    for(const side of [-1,1])box('Feed receiver side wall',.014,.065,.34,side*.036,.015,-.015,steel);
    box('Feed bed floor',.062,.012,.28,0,-.012,-.04,dark);
    box('Integrated rear receiver block',.083,.083,.070,0,.013,.145,steel);
    box('Feed roller saddle',.068,.024,.055,0,.024,-.065,dark);
    for(let n=0;n<4;n++)box('Exposed feed guide tooth',.009,.018,.016,-.024+n*.016,.045,-.067,edge);
    const cover=group('feedTray',0,.058,-.18);
    box('Hinged feed cover shell',.092,.025,.29,0,.0125,.145,steel,cover);
    box('Cover composite contact pad',.070,.005,.180,0,.028,.200,polymer,cover);
    box('Cover rear latch',.029,.020,.020,0,.009,.294,dark,cover);
    for(const side of [-1,1])box('Cover hinge ear',.014,.032,.029,side*.047,.058,-.18,dark);
    tube('Captive cover hinge pin',.007,.110,0,.058,-.18,edge).rotation.set(0,0,Math.PI/2);
    for(let n=0;n<5;n++)box('Cover stiffening rib',.084,.004,.006,0,.028,.050+n*.044,dark,cover);
    box('Ammunition box mounting saddle',.024,.055,.13,-.052,-.015,-.025,steel);
    const ammo=group('magazine',-.132,-.045,-.025);
    box('Side ammunition box shell',.126,.158,.145,0,-.055,0,polymer,ammo);
    box('Box reinforced rim',.132,.014,.152,0,.027,0,steel,ammo);
    box('Box base protector',.130,.014,.15,0,-.133,0,dark,ammo);
    for(const z of [-.045,0,.045])box('Box pressed reinforcing groove',.003,.118,.007,-.064,-.052,z,dark,ammo);
    box('Box mounting tongue',.020,.040,.060,.064,.014,0,steel,ammo);
    const belt=group('feedBelt');
    const beltPath=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.13,-.008,-.026),new THREE.Vector3(-.116,.079,-.026),
      new THREE.Vector3(-.062,.069,-.026),new THREE.Vector3(-.005,.049,-.026),
    ]);
    mesh('Connected feed belt web',new THREE.TubeGeometry(beltPath,12,.006,5,false),dark,0,0,0,belt);
    const linkPoint=new THREE.Vector3();
    for(let n=0;n<9;n++) {
      beltPath.getPoint(n/8,linkPoint);
      tube('Feed belt cartridge',.004,.040,linkPoint.x,linkPoint.y,linkPoint.z,edge,belt);
      box('Feed belt link',.010,.007,.012,linkPoint.x,linkPoint.y,linkPoint.z+.009,dark,belt);
    }
    if(options.firstPerson) {
      const arm=group('supportUpperArm');arm.name='leftUpperArm';root.add(arm);arm.visible=false;
      mesh('LMG upper sleeve',new THREE.CapsuleGeometry(.061,.32,6,12).scale(1,1/.32,1),polymer,0,0,0,arm);
    }
    grip();screws(-.12,5);
    const bolt=group('bolt',-.054,.022,.025);
    box('Receiver-side charging stem',.028,.012,.020,0,0,0,steel,bolt);
    box('Charging control knob',.017,.024,.025,-.017,0,0,edge,bolt);
    box('Bounded charging guide',.006,.008,.105,-.043,.022,.042,dark);
    box('Ejection recess',.003,.029,.092,.044,.010,.004,rubber);
    silhouette('Integrated heavy handguard',[
      [-.49,.022],[-.46,.050],[-.21,.050],[-.19,.018],[-.22,-.063],[-.46,-.063],
    ],.080,polymer);
    for(const side of [-1,1])for(let n=0;n<8;n++)box('Handguard cooling slot',.003,.025,.014,side*.041,.008,-.235-n*.030,rubber);
    for(let n=0;n<6;n++)box('Underhand grip rib',.076,.004,.009,0,-.065,-.25-n*.030,dark);
    tube('Heavy barrel jacket',.026,.29,0,.009,-.465,steel);
    for(let n=0;n<6;n++)ring('Barrel heat sink rib',.030,.003,0,.009,-.49-n*.020,dark);
    tube('HMG muzzle brake',.028,.064,0,.009,-.639,dark);
    ring('Bored muzzle crown',.014,.003,0,.009,-.673,edge);muzzle.position.set(0,.009,-.678);
    rail(-.31,.24,.071);
    const sights=group('sights');
    for(const z of [.135,-.46]) {
      box('Heavy iron sight base',.036,.012,.022,0,.075,z,dark,sights);
      for(const side of [-1,1])box('Sight protection wing',.006,.024,.012,side*.013,.092,z,steel,sights);
    }
    box('Front sight post',.003,.017,.005,0,.090,-.46,edge,sights);
    const butt=group('stock',0,0,.18);
    silhouette('Integrated heavy stock',[[0,.045],[.20,.038],[.21,-.085],[.15,-.085],[.09,-.023],[0,-.023]],.060,polymer,butt);
    box('Heavy rubber buttpad',.067,.133,.022,0,-.022,.205,rubber,butt);
    for(const side of [-1,1])box('Folded bipod leg',.012,.016,.19,side*.050,-.051,-.48,steel);
  } else if (['ar', 'sniper'].includes(id)) {
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
    // The first-person AR exposes its receiver charging latch on the eye-near
    // side. Other weapons and actor/studio assemblies retain their original part.
    const heldAr = id === 'ar' && options.firstPerson;
    const heldSniper = id === 'sniper' && options.firstPerson;
    const bolt = group('bolt', heldSniper ? 0 : heldAr ? -.045 : .039,
      heldSniper ? .025 : heldAr ? .048 : .017, heldSniper ? -.015 : heldAr ? .025 : .075);
    if (heldSniper) {
      // Slide along the bore; rotate this local pivot to lift the near-side handle.
      box('Bolt cylinder', .028, .028, .09, 0, 0, -.025, edge, bolt);
      box('Bolt handle shank', .052, .012, .014, -.049, -.012, .008, steel, bolt);
      const knob = group('boltKnob', -.075, -.012, .008); bolt.add(knob);
      mesh('Bolt knob', new THREE.SphereGeometry(.016, 12, 8), dark, 0, 0, 0, knob);
      box('Receiver bolt guide', .008, .014, .12, -.037, .025, .005, edge);
    } else box('Charging handle', 0.026, 0.011, 0.016, 0, 0, 0, steel, bolt);
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
    magazine(id === 'ar' || compact, compact ? .2 : .17, -.058, .038);
    stock(false, long);
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
          tube('Wire stock strut', 0.006, 0.3, side * 0.023, 0.03, options.firstPerson ? -.02 : .3, edge, options.firstPerson ? parts.stock : body);
      }
    }
  } else if (id === 'shotgun') {
    if (options.firstPerson) {
      // An actual underside aperture: no solid box under the insertion path.
      box('Shotgun receiver crown', .07, .048, .26, 0, .0245, .035, dark);
      for (const x of [-.026, .026]) box('Loading port side wall', .018, .037, .26, x, -.018, .035, dark);
      box('Loading port rear wall', .034, .037, .075, 0, -.018, .1275, dark);
      box('Loading port front wall', .034, .037, .005, 0, -.018, -.0925, dark);
      group('loadingPort', 0, -.0365, -.025);
      for (const x of [-.018, .018]) box('Loading port lip', .003, .004, .14, x, -.037, -.005, edge);
    } else box('Shotgun receiver', 0.07, 0.085, 0.26, 0, 0.006, 0.035, dark);
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
    // CP-9: chamfered steel slide over a hollow, contoured polymer grip.
    // Dimensions remain a service sidearm: 250 mm slide, 44 mm maximum width.
    steel.color.setHex(0x535e66); steel.metalness = .78; steel.roughness = .43;
    dark.color.setHex(0x303a42); dark.metalness = .65; dark.roughness = .52;
    polymer.color.setHex(0x39423f); polymer.roughness = .88;
    edge.color.setHex(0x7c898c); edge.roughness = .48;
    silhouette('CP9 lower frame', [[-.15,.015],[.096,.015],[.109,-.020],[.074,-.045],[-.036,-.037],[-.15,-.022]], .037, polymer);
    const slide = group('slide', 0, .043, 0);
    function slideSection(name: string, z: number, depth: number, open = false) {
      const section = new THREE.Shape();
      const profile = open ? [[-.020,-.016],[.020,-.016],[.020,-.007],[-.012,-.007],[-.012,.020],[-.020,.011]]
        : [[-.018,-.016],[.018,-.016],[.021,-.009],[.021,.010],[.013,.021],[-.013,.021],[-.021,.010],[-.021,-.009]];
      profile.forEach(([x,y],i)=>i?section.lineTo(x,y):section.moveTo(x,y)); section.closePath();
      if (!open) { const bore = new THREE.Path(); bore.absarc(0,-.004,.0105,0,Math.PI*2,true); section.holes.push(bore); }
      const geometry = new THREE.ExtrudeGeometry(section,{depth,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:.0015,bevelThickness:.0015,curveSegments:16});
      mesh(name,geometry,steel,0,0,z,slide);
    }
    slideSection('Chamfered slide nose',-.154,.128);
    slideSection('Open ejection window',-.023,.044,true);
    slideSection('Rear slide block',.024,.070);
    box('Extractor claw',.004,.010,.030,.022,.001,.001,dark,slide);
    box('Rear striker plate',.028,.026,.003,0,-.001,.097,dark,slide);
    for (const side of [-1,1]) {
      for (let i=0;i<7;i++) box('Slide serration rear',.0025,.022,.0025,side*.0213,-.001,.034+i*.007,dark,slide).rotation.x = -.18;
      for (let i=0;i<3;i++) box('Slide serration front',.0025,.018,.0025,side*.0213,-.002,-.126+i*.008,dark,slide).rotation.x = -.18;
      box('Frame slide guide',.003,.007,.107,side*.020,.016,-.070,dark);
    }
    // An annular barrel has a real bore, rather than a black disc on a cylinder.
    const boreProfile = [[.006,-.076],[.0095,-.076],[.010,-.074],[.010,.070],[.006,.070],[.006,-.076]].map(([r,y])=>new THREE.Vector2(r,y));
    const barrel = mesh('Rifled muzzle bore',new THREE.LatheGeometry(boreProfile,24),dark,0,.039,-.080);
    barrel.rotation.x = Math.PI/2;
    box('Exposed chamber hood',.024,.016,.037,0,.048,-.001,edge);
    tube('Recoil guide rod',.004,.137,0,.020,-.080,edge);
    muzzle.position.set(0,.039,-.160);
    // Open magwell: two side shells, curved frontstrap and backstrap. The mag
    // can travel on its own axis without passing through a solid grip block.
    const contour = [[.037,-.028],[.095,-.026],[.116,-.156],[.103,-.172],[.058,-.169],[.048,-.137],[.037,-.065]];
    for (const side of [-1,1]) {
      const shell = silhouette('Contoured grip side shell',contour,.009,polymer); shell.position.x=side*.017;
      const panel = silhouette('Recessed grip traction panel',[[.049,-.061],[.086,-.050],[.104,-.151],[.064,-.151],[.055,-.122]],.0015,rubber); panel.position.x=side*.023;
      for(let i=0;i<7;i++) box('Grip traction groove',.0018,.002,.031,side*.0245,-.070-i*.011,.070+i*.0018,polymer).rotation.x=-.16;
    }
    silhouette('Backstrap palm swell',[[.089,-.026],[.105,-.033],[.121,-.139],[.116,-.161],[.106,-.163],[.086,-.054]],.028,polymer);
    silhouette('Frontstrap finger contour',[[.035,-.042],[.046,-.046],[.062,-.159],[.055,-.162],[.040,-.119],[.032,-.064]],.029,polymer);
    box('Beavertail',.039,.013,.039,0,-.024,.095,dark);
    // Bevelled loop with an actual open trigger aperture.
    const guardShape = new THREE.Shape();
    [[-.064,-.028],[.041,-.033],[.045,-.087],[-.043,-.087],[-.062,-.067]].forEach(([z,y],i)=>i?guardShape.lineTo(z,y):guardShape.moveTo(z,y));guardShape.closePath();
    const opening = new THREE.Path();[[-.049,-.040],[-.047,-.065],[-.036,-.076],[.031,-.076],[.029,-.043]].forEach(([z,y],i)=>i?opening.lineTo(z,y):opening.moveTo(z,y));opening.closePath();guardShape.holes.push(opening);
    const guardGeometry = new THREE.ExtrudeGeometry(guardShape,{depth:.022,bevelEnabled:true,bevelSegments:2,bevelSize:.002,bevelThickness:.002,steps:1});guardGeometry.rotateY(-Math.PI/2);guardGeometry.translate(.011,0,0);
    mesh('Trigger guard bevelled loop',guardGeometry,polymer,0,0,0);
    silhouette('Curved trigger shoe',[[.017,-.036],[.023,-.039],[.010,-.061],[.015,-.069],[.009,-.072],[.002,-.061]],.006,dark);
    const mag = group('magazine',0,-.115,.079); mag.rotation.x=-.16;
    box('CP9 magazine steel body',.027,.094,.038,0,0,0,dark,mag);
    box('Magazine baseplate',.049,.012,.050,0,-.064,.002,polymer,mag);
    box('Magazine heel pad',.036,.003,.038,0,-.072,.003,rubber,mag);
    for(const x of [-.014,.014]) box('Magazine witness channel',.001,.058,.004,x,-.002,.010,edge,mag);
    // Matte ceramic sight inserts stay legible without emissive lighting.
    const sightPaint = new THREE.MeshStandardMaterial({color:0xc1cabe,roughness:.78,metalness:0}); materials.push(sightPaint);
    // Compact dust-cover rail, with three functional cross slots.
    box('Accessory rail bed',.031,.009,.071,0,-.028,-.111,dark);
    for(let i=0;i<3;i++)box('Accessory rail lug',.037,.006,.009,0,-.035,-.135+i*.021,steel);
    const release = group('slideRelease',-.026,-.004,.030);
    box('Slide release paddle',.007,.009,.030,0,0,0,steel,release);
    for(let i=0;i<3;i++)box('Release paddle traction',.0015,.008,.002,-.004,0,-.008+i*.007,edge,release);
    const catchPart = group('magazineRelease',-.026,-.040,.041);
    box('Magazine release button',.005,.012,.013,0,0,0,dark,catchPart);
    const pin=tube('Takedown axis',.0035,.047,0,-.006,-.020,dark);pin.rotation.set(0,0,Math.PI/2);
    box('Front iron sight',.005,.009,.009,0,.026,-.136,dark,slide);
    box('Front sight white inset',.002,.003,.001,0,.029,-.130,sightPaint,slide);
    for(const side of [-1,1]) {
      box('Rear iron sight notch shoulder',.007,.009,.013,side*.009,.026,.080,dark,slide);
      box('Rear sight white inset',.002,.002,.001,side*.009,.029,.087,sightPaint,slide);
    }
  } else if (id === 'laser') {
    const ceramic=new THREE.MeshStandardMaterial({color:0xe6e3d3,roughness:.63,metalness:.08});materials.push(ceramic);
    plasmaVisual=buildPlasmaModel(body,parts,{steel,dark,polymer,rubber,edge,glow,ceramic});muzzle.position.fromArray(plasmaVisual.muzzle);
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
    if (options.firstPerson) {
      // Limited handheld control kit; actor/studio spades retain their original geometry.
      grip(.04);
      const cradle = group('supportCradle', -.08, -.085, -.14);
      tube('Stationary underslung support grip', .027, .14, 0, 0, 0, polymer, cradle).rotation.y = Math.PI / 2;
      box('Cradle mounting bridge', .16, .018, .045, .02, .06, 0, steel, cradle);
      for (const side of [-1, 1])
        box('Cradle motor bracket', .018, .065, .045, side * .065, .027, 0, steel, cradle);
    } else {
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
    }
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
    const model=buildRailgunModel(body,parts,{steel,dark,polymer,rubber,edge,glow},!!options.firstPerson);
    muzzle.position.fromArray(model.muzzle);railgunUpdate=model.update;
  } else if (id === 'rocket') {
    tube(
      'Composite launch tube',
      0.052,
      options.firstPerson ? .65 : .89,
      0,
      0.025,
      options.firstPerson ? -.14 : -.02,
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
    if (!options.firstPerson) tube('Flared exhaust cone', 0.09, 0.15, 0, 0.025, 0.48, steel, body, 0.046);
    for (let i = 0; i < 11; i++)
      ring('Heat shield band', 0.055, 0.003, 0, 0.025, -0.2 + i * 0.042, dark);
    grip(0.1);
    grip(-0.22);
    box('Scope mount', 0.075, 0.025, 0.07, -0.04, 0.071, -0.05, steel);
    optic();
    for (const z of options.firstPerson ? [] : [-0.42, 0.25]) {
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

  if (id === 'minigun') {
    const vent = group('vent', .052, .03, .02);
    box('Articulated coolant vent', .009, .037, .095, 0, 0, 0, steel, vent);
  }
  if (id === 'shotgun') {
    const round = group('reloadRound', 0, -.13, -.045);
    // Cylinder helper already points along the bore (-Z). The old second X
    // rotation stood the shell vertically, sideways across the receiver.
    const hull = new THREE.MeshStandardMaterial({ color: 0x96392c, roughness: .65 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xb28b45, metalness: .85, roughness: .32 });
    materials.push(hull, brass);
    tube('Shotgun shell hull', .0115, .049, 0, 0, -.003, hull, round);
    tube('Shell brass base', .012, .009, 0, 0, .024, brass, round);
    ring('Shell rim', .012, .0013, 0, 0, .029, brass, round);
    round.visible = false;
  } else if (id === 'rocket') {
    const round = group('reloadRound', 0, -.07, -.55);
    tube('Tube-loaded rocket', .036, .25, 0, 0, 0, dark, round).rotation.x = 0;
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
  if(id==='railgun'){
    const fresh=parts.freshSlug.children[0] as THREE.Mesh,seated=parts.chamberedSlug.children[0] as THREE.Mesh;
    seated.geometry.dispose();seated.geometry=fresh.geometry;
  }
  if ((id === 'br' || id === 'pistol' || id === 'smg' || id === 'lmg') && options.firstPerson) {
    const fresh = parts.magazine.clone(true); fresh.name = 'freshMagazine'; fresh.visible = false;
    body.add(fresh); parts.freshMagazine = fresh;
  }
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
  const assembly:WeaponAssembly={
    root,
    muzzle,
    backblast,
    parts,
    update(dt, charge = 0, spin = 0, state) {
      time += dt;
      if (parts.rotor) parts.rotor.rotation.z += spin;
      if (parts.arc) {
        const m = (parts.arc as THREE.Mesh).material as THREE.ShaderMaterial;
        m.uniforms.time.value = time;
        m.uniforms.charge.value = charge;
      }
      railgunUpdate?.(charge,time);
      if(state)railgunParts?.(state);
      if(plasmaParts)plasmaParts(state);
      if(plasmaVisual){const q=state?.reloadSequence,stage=q?.phases[q.index],thermal=q?.kind==='plasmaVent',p=stage?q!.elapsed/stage.duration:0;const pulse=stage?.phase==='vent'?Math.sin(Math.PI*p):thermal&&stage?.phase==='open'?p:0;plasmaVisual.update(state?.heat??0,time,thermal,pulse);}
    },
  };
  const plasmaParts=id==='laser'?createPlasmaAnimator(assembly,false):undefined;
  const railgunParts=id==='railgun'?createRailgunAnimator(assembly,false):undefined;
  return assembly;
}
