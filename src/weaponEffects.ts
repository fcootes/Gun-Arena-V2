import * as THREE from 'three';
import type { WeaponModelId, WeaponAssembly } from './weaponModels';

export interface MuzzleProfile {
  life: number;
  width: number;
  length: number;
  light: number;
  radius: number;
  smoke: number;
  sparks: number;
  star: number;
  energy: boolean;
  rear: boolean;
}
export const MUZZLE_PROFILES: Record<WeaponModelId, MuzzleProfile> = {
  ar: {
    life: 0.075,
    width: 0.17,
    length: 0.24,
    light: 4,
    radius: 4,
    smoke: 3,
    sparks: 2,
    star: 4,
    energy: false,
    rear: false,
  },
  br: {
    life: 0.095,
    width: 0.2,
    length: 0.31,
    light: 5,
    radius: 5,
    smoke: 4,
    sparks: 3,
    star: 4,
    energy: false,
    rear: false,
  },
  shotgun: {
    life: 0.14,
    width: 0.42,
    length: 0.36,
    light: 9,
    radius: 9,
    smoke: 16,
    sparks: 9,
    star: 7,
    energy: false,
    rear: false,
  },
  sniper: {
    life: 0.16,
    width: 0.24,
    length: 0.95,
    light: 15,
    radius: 14,
    smoke: 11,
    sparks: 5,
    star: 4,
    energy: false,
    rear: false,
  },
  pistol: {
    life: 0.045,
    width: 0.1,
    length: 0.12,
    light: 1.3,
    radius: 2,
    smoke: 1,
    sparks: 1,
    star: 4,
    energy: false,
    rear: false,
  },
  smg: {
    life: 0.035,
    width: 0.13,
    length: 0.17,
    light: 2,
    radius: 3,
    smoke: 2,
    sparks: 2,
    star: 4,
    energy: false,
    rear: false,
  },
  lmg: {
    life: 0.12,
    width: 0.24,
    length: 0.34,
    light: 6,
    radius: 7,
    smoke: 7,
    sparks: 5,
    star: 5,
    energy: false,
    rear: false,
  },
  laser: {
    life: 0.1,
    width: 0.28,
    length: 0.18,
    light: 5,
    radius: 5,
    smoke: 0,
    sparks: 14,
    star: 8,
    energy: true,
    rear: false,
  },
  minigun: {
    life: 0.045,
    width: 0.2,
    length: 0.42,
    light: 7,
    radius: 7,
    smoke: 4,
    sparks: 9,
    star: 6,
    energy: false,
    rear: false,
  },
  railgun: {
    life: 0.2,
    width: 0.28,
    length: 1.25,
    light: 14,
    radius: 12,
    smoke: 2,
    sparks: 22,
    star: 9,
    energy: true,
    rear: false,
  },
  rocket: {
    life: 0.22,
    width: 0.5,
    length: 0.48,
    light: 12,
    radius: 10,
    smoke: 24,
    sparks: 10,
    star: 5,
    energy: false,
    rear: true,
  },
  grenade_launcher: {
    life: 0.17,
    width: 0.34,
    length: 0.35,
    light: 8,
    radius: 8,
    smoke: 14,
    sparks: 7,
    star: 5,
    energy: false,
    rear: true,
  },
};
export interface WeaponMuzzleEffect {
  root: THREE.Group;
  trigger: () => void;
  update: (delta: number) => void;
  reset: () => void;
}

/** Bounded buffers are reused across sustained fire. No geometry allocation per shot. */
export function createWeaponMuzzleEffect(
  assembly: WeaponAssembly,
): WeaponMuzzleEffect {
  const id = assembly.root.userData.weaponId as WeaponModelId,
    p = MUZZLE_PROFILES[id];
  const root = new THREE.Group();
  root.name = `MuzzleFX_${id}`;
  assembly.root.add(root);
  const muzzle = new THREE.Vector3(),
    rear = new THREE.Vector3();
  assembly.root.updateMatrixWorld(true);
  assembly.muzzle.getWorldPosition(muzzle);
  assembly.root.worldToLocal(muzzle);
  assembly.backblast.getWorldPosition(rear);
  assembly.root.worldToLocal(rear);
  const pivot = new THREE.Group();
  pivot.position.copy(muzzle);
  root.add(pivot);
  const flashMaterial = new THREE.ShaderMaterial({
    uniforms: {
      age: { value: 1 },
      star: { value: p.star },
      energy: { value: p.energy ? 1 : 0 },
      seed: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: true,
    vertexShader:
      'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec2 vUv;uniform float age;uniform float star;uniform float energy;uniform float seed;void main(){vec2 q=(vUv-.5)*2.;float r=length(q);float a=atan(q.y,q.x);float ray=pow(abs(cos(a*star*.5+seed)),12.);float s=exp(-r*r*7.)+ray*pow(max(0.,1.-r),1.8);float flicker=.8+.2*sin(seed*91.+r*23.);vec3 c=mix(vec3(3.,1.4,.3),vec3(.3,1.7,3.),energy);gl_FragColor=vec4(c,s*max(0.,1.-age)*flicker);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const flare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flashMaterial);
  pivot.add(flare);
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: p.energy ? 0x54bfff : 0xffb34b,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 10, 1, true),
    coneMaterial,
  );
  cone.rotation.x = -Math.PI / 2;
  pivot.add(cone);
  const light = new THREE.PointLight(
    p.energy ? 0x55baff : 0xffb064,
    0,
    p.radius,
    2,
  );
  pivot.add(light);
  const shockMaterial = new THREE.ShaderMaterial({
    uniforms: { age: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader:
      'varying vec2 vUv;uniform float age;void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.x*65.+age*30.)*.035;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader:
      'varying vec2 vUv;uniform float age;void main(){gl_FragColor=vec4(.2,.65,1.,(1.-age)*.5);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const shock = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.007, 5, 36),
    shockMaterial,
  );
  pivot.add(shock);
  shock.visible = false;
  const capacity = 192,
    positions = new Float32Array(capacity * 3),
    colors = new Float32Array(capacity * 3),
    sizes = new Float32Array(capacity),
    alphas = new Float32Array(capacity);
  const velocities = new Float32Array(capacity * 3),
    lifetimes = new Float32Array(capacity),
    remaining = new Float32Array(capacity),
    smoke = new Uint8Array(capacity);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute(
    'size',
    new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute(
    'alpha',
    new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage),
  );
  const particlesMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    vertexShader:
      'attribute float size;attribute float alpha;varying vec3 c;varying float a;void main(){c=color;a=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*280./max(.1,-p.z),1.,96.);gl_Position=projectionMatrix*p;}',
    fragmentShader:
      'varying vec3 c;varying float a;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(c,a*pow(max(0.,1.-r*r),2.));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const points = new THREE.Points(geometry, particlesMaterial);
  points.frustumCulled = false;
  root.add(points);
  let cursor = 0,
    age = p.life,
    live = 0,
    disabled = false;
  function emit(isSmoke: boolean, back: boolean = false) {
    const i = cursor++ % capacity,
      k = i * 3;
    if (remaining[i] <= 0) live++;
    const origin = back ? rear : muzzle;
    positions[k] = origin.x;
    positions[k + 1] = origin.y;
    positions[k + 2] = origin.z;
    const angle = Math.random() * Math.PI * 2,
      wide = id === 'shotgun' ? 0.9 : 0.35;
    velocities[k] =
      Math.cos(angle) *
      (isSmoke ? 0.16 + Math.random() * 0.2 : wide + Math.random() * 0.9);
    velocities[k + 1] =
      Math.sin(angle) * (isSmoke ? 0.2 : wide) + (isSmoke ? 0.16 : 0);
    velocities[k + 2] = back
      ? 3 + Math.random() * 2
      : -(isSmoke ? 0.18 : 1 + Math.random() * 3);
    if (id === 'railgun' && !isSmoke) {
      velocities[k] *= 0.12;
      velocities[k + 1] *= 0.12;
      velocities[k + 2] *= 4;
    }
    if (id === 'sniper' && isSmoke) {
      positions[k] += 0.07 * Math.cos(angle);
      positions[k + 1] += 0.07 * Math.sin(angle);
    }
    smoke[i] = isSmoke ? 1 : 0;
    lifetimes[i] = remaining[i] = isSmoke
      ? back
        ? 1.4
        : 1
      : 0.15 + Math.random() * 0.25;
    sizes[i] = isSmoke ? (back ? 0.25 : 0.07) : 0.018;
    alphas[i] = isSmoke ? 0.3 : 0.95;
    const red = isSmoke ? 0.35 : p.energy ? (i % 2 ? 2 : 0.15) : 2;
    const green = isSmoke ? 0.39 : p.energy ? (i % 2 ? 0.2 : 1.5) : 1;
    const blue = isSmoke ? 0.42 : p.energy ? (i % 2 ? 2.5 : 3) : 0.25;
    colors[k] = red;
    colors[k + 1] = green;
    colors[k + 2] = blue;
  }
  function reset() {
    age = p.life;
    live = 0;
    remaining.fill(0);
    alphas.fill(0);
    geometry.attributes.alpha.needsUpdate = true;
    pivot.visible = false;
    light.intensity = 0;
  }
  reset();
  root.userData.cleanupWeaponEffect = () => {
    disabled = true;
    reset();
  };
  return {
    root,
    reset,
    trigger() {
      if (disabled) return;
      age = 0;
      flashMaterial.uniforms.seed.value = Math.random() * 6.28;
      pivot.visible = true;
      for (let i = 0; i < p.smoke; i++) emit(true, p.rear && i % 2 === 0);
      for (let i = 0; i < p.sparks; i++) emit(false);
      geometry.attributes.color.needsUpdate = true;
    },
    update(delta) {
      if (disabled) return;
      const dt = Math.min(0.05, Math.max(0, delta));
      age += dt;
      const f = Math.min(1, age / p.life),
        k = 1 - f;
      flashMaterial.uniforms.age.value = f;
      flare.scale.setScalar(p.width * (0.8 + k * 0.2));
      cone.scale.set(p.width * 0.2 * k, p.length, p.width * 0.2 * k);
      cone.position.z = -p.length * 0.5;
      coneMaterial.opacity = k * 0.65;
      light.intensity = p.light * k;
      pivot.visible = k > 0;
      shock.visible = (id === 'railgun' || id === 'sniper') && k > 0;
      shock.scale.setScalar(1 + (1 - k) * 8);
      shockMaterial.uniforms.age.value = f;
      if (live === 0) return;
      for (let i = 0; i < capacity; i++) {
        if (remaining[i] <= 0) continue;
        remaining[i] -= dt;
        const q = i * 3;
        if (remaining[i] <= 0) {
          remaining[i] = 0;
          alphas[i] = 0;
          live--;
          continue;
        }
        positions[q] += velocities[q] * dt;
        positions[q + 1] += velocities[q + 1] * dt;
        positions[q + 2] += velocities[q + 2] * dt;
        if (smoke[i]) {
          velocities[q + 1] += dt * 0.25;
          sizes[i] += dt * (p.rear ? 0.5 : 0.12);
        }
        alphas[i] = (remaining[i] / lifetimes[i]) * (smoke[i] ? 0.3 : 0.95);
      }
      for (const name of ['position', 'size', 'alpha'])
        geometry.attributes[name].needsUpdate = true;
    },
  };
}
