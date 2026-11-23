import * as THREE from 'three';

// One bounded, scene-owned draw for all launcher smoke and ejecta. The projectile
// still owns its trajectory and reports the already-resolved impact position.
const CAPACITY = 480;
type RocketParticles = ReturnType<typeof createParticles>;
const pools = new WeakMap<THREE.Scene, RocketParticles>();

function createParticles(scene: THREE.Scene) {
  const positions = new Float32Array(CAPACITY * 3);
  const velocities = new Float32Array(CAPACITY * 3);
  const ages = new Float32Array(CAPACITY);
  const durations = new Float32Array(CAPACITY);
  const sizes = new Float32Array(CAPACITY);
  const alphas = new Float32Array(CAPACITY);
  const embers = new Float32Array(CAPACITY);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('ember', new THREE.BufferAttribute(embers, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `
      attribute float size; attribute float alpha; attribute float ember;
      varying float opacity; varying float hot;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * p;
        gl_PointSize = clamp(size * 500. / max(.1, -p.z), 1., 112.);
        opacity = alpha; hot = ember;
      }
    `,
    fragmentShader: `
      varying float opacity; varying float hot;
      void main() {
        if (opacity <= 0.) discard;
        vec2 p = gl_PointCoord * 2. - 1.;
        float shape = dot(p, p);
        float edge = pow(max(0., 1. - shape), 1.8);
        vec3 c = mix(vec3(.34,.32,.29), vec3(4.,1.18,.24), hot);
        gl_FragColor = vec4(c, opacity * edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.name = 'Rocket exhaust and impact particles';
  cloud.frustumCulled = false;
  cloud.visible = false;
  scene.add(cloud);
  let cursor = 0;
  function emit(point: THREE.Vector3, vx: number, vy: number, vz: number, life: number, ember: boolean) {
    const i = cursor++ % CAPACITY, k = i * 3;
    positions[k] = point.x; positions[k+1] = point.y; positions[k+2] = point.z;
    velocities[k] = vx; velocities[k+1] = vy; velocities[k+2] = vz;
    ages[i] = 0; durations[i] = life; embers[i] = Number(ember);
  }
  return {
    trail(point: THREE.Vector3, flight: THREE.Vector3) {
      const angle = cursor * 2.39996;
      emit(point, Math.cos(angle) * .51 - flight.x * .021, .40 - flight.y * .021, Math.sin(angle) * .51 - flight.z * .021, .43, false);
      emit(point, -flight.x * .065, -flight.y * .065, -flight.z * .065, .11, true);
    },
    impact(point: THREE.Vector3, flight: THREE.Vector3) {
      for (let i = 0; i < 28; i++) {
        const angle = i * 2.39996, ember = i < 16;
        const speed = ember ? 5.2 + (i % 4) : 2.1;
        emit(point, Math.cos(angle) * speed - flight.x * .068, .65 + i % 4 - flight.y * .068,
          Math.sin(angle) * speed - flight.z * .068, ember ? .28 + (i % 5) * .035 : .66, ember);
      }
    },
    update(dt: number) {
      let visible = false;
      for (let i = 0; i < CAPACITY; i++) {
        if (!durations[i]) continue;
        const t = (ages[i] += dt) / durations[i], k = i * 3;
        if (t >= 1) { durations[i] = alphas[i] = 0; continue; }
        visible = true;
        positions[k] += velocities[k] * dt;
        positions[k+1] += velocities[k+1] * dt;
        positions[k+2] += velocities[k+2] * dt;
        velocities[k+1] += (embers[i] ? -6.5 : .55) * dt;
        sizes[i] = embers[i] ? .14 * (1 - .7 * t) : .19 + .78 * t;
        alphas[i] = (embers[i] ? .92 : .49) * (1 - t);
      }
      cloud.visible = visible;
      if (visible) for (const name of ['position', 'size', 'alpha', 'ember']) geometry.attributes[name].needsUpdate = true;
    },
    dispose() { cloud.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}

export function rocketParticles(scene: THREE.Scene) {
  let particles = pools.get(scene);
  if (!particles) {
    particles = createParticles(scene);
    pools.set(scene, particles);
  }
  return particles;
}

export function updateRocketParticles(scene: THREE.Scene, dt: number) {
  pools.get(scene)?.update(dt);
}

export function clearRocketParticles(scene: THREE.Scene) {
  pools.get(scene)?.dispose();
  pools.delete(scene);
}
