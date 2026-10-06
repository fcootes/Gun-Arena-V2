import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildWeaponMesh } from './lobbyAvatar';
import { disposeBotVisuals } from './botBuilder';
import {
  createWeaponMuzzleEffect,
  type WeaponMuzzleEffect,
} from './weaponEffects';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function WeaponStudio({ weaponId }: { weaponId: string }) {
  const firePreviewRef = useRef<() => void>(() => {});
  const setWeaponRef = useRef<(id: string) => void>(() => {});
  const weaponIdRef = useRef(weaponId);
  weaponIdRef.current = weaponId;
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      host.textContent =
        'WebGL is unavailable. Weapon selection and stats remain available below.';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080e14);
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    const environment = generator.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.35;
    room.dispose();
    generator.dispose();
    const bayMaterial = new THREE.MeshStandardMaterial({
      color: 0x101820,
      metalness: 0.65,
      roughness: 0.48,
    });
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(5, 3, 0.06),
      bayMaterial,
    );
    backing.position.set(0, 0, -1.25);
    scene.add(backing);
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.04, 4),
      bayMaterial,
    );
    floor.position.set(0, -0.31, 0);
    scene.add(floor);
    const stripMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd6de,
      emissive: 0xcbd6de,
      emissiveIntensity: 2,
    });
    for (const x of [-1.6, 1.6]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 2.5, 0.045),
        stripMaterial,
      );
      post.position.set(x, 0.2, -1.2);
      scene.add(post);
    }
    const grid = new THREE.GridHelper(4, 24, 0x385267, 0x1c2c3a);
    grid.position.y = -0.285;
    scene.add(grid);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 30);
    camera.position.set(0.15, 0.1, 1);
    const weapon = new THREE.Group();
    buildWeaponMesh(weapon, weaponIdRef.current);
    let effects: WeaponMuzzleEffect = createWeaponMuzzleEffect(
      weapon.userData.weaponAssembly,
    );
    let fireTime = 0;
    firePreviewRef.current = () => {
      effects.trigger();
      fireTime = 0.4;
    };
    weapon.rotation.y = Math.PI / 2;
    const modelBounds = new THREE.Box3(),
      modelSize = new THREE.Vector3(),
      modelCenter = new THREE.Vector3();
    function centerModel() {
      weapon.position.set(0, 0, 0);
      weapon.updateMatrixWorld(true);
      modelBounds.setFromObject(weapon.userData.weaponAssembly.parts.receiver);
      modelBounds.getCenter(modelCenter);
      weapon.position.sub(modelCenter);
      modelBounds.getSize(modelSize);
    }
    function fitCamera() {
      const distance = Math.max(
        0.4,
        (Math.max(modelSize.y, modelSize.x / camera.aspect) /
          (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)))) *
          1.3,
      );
      camera.position.set(0.12, 0.08, 1).normalize().multiplyScalar(distance);
    }
    centerModel();
    scene.add(weapon);
    let currentWeaponId = weaponIdRef.current;
    setWeaponRef.current = (id) => {
      if (id === currentWeaponId) return;
      currentWeaponId = id;
      weapon.position.set(0, 0, 0);
      buildWeaponMesh(weapon, id);
      effects = createWeaponMuzzleEffect(weapon.userData.weaponAssembly);
      fireTime = 0;
      centerModel();
      fitCamera();
    };
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 0.4;
    controls.maxDistance = 5;
    const key = new THREE.SpotLight(0xeaf5ff, 22, 12, Math.PI / 3, 0.5);
    key.position.set(1.3, 2.4, 1.3);
    const rim = new THREE.DirectionalLight(0xdde8f0, 4);
    rim.position.set(-2, 0.6, -2);
    const fill = new THREE.DirectionalLight(0xbdccdb, 1.5);
    fill.position.set(-1.5, 0.4, 1.1);
    scene.add(key, rim, fill);
    const resize = () => {
      const w = Math.max(1, host.clientWidth),
        h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitCamera();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    let disposed = false;
    let previous = performance.now();
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const now = performance.now(),
        dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      fireTime = Math.max(0, fireTime - dt);
      effects.update(dt);
      weapon.userData.weaponAssembly.update(
        dt,
        currentWeaponId === 'railgun' ? (fireTime > 0 ? 1 : 0.15) : 0,
        currentWeaponId === 'minigun' && fireTime > 0 ? dt * 40 : 0,
      );
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      setWeaponRef.current = () => {};
      firePreviewRef.current = () => {};
      disposeBotVisuals(scene);
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    setWeaponRef.current(weaponId);
  }, [weaponId]);
  return (
    <div
      className="relative w-full h-72 lg:h-96 shrink-0 border border-white/15 overflow-hidden bg-[#10191c]"
      aria-label="3D weapon spotlight viewport"
    >
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute left-4 bottom-3 pointer-events-none text-[9px] tracking-[.2em] text-cyan-200">
        OPTICAL TESTING VAULT / {weaponId.toUpperCase()} — DRAG TO INSPECT
      </div>
      <button
        type="button"
        onClick={() => firePreviewRef.current()}
        className="absolute top-3 right-3 px-3 py-2 text-[9px] tracking-widest text-slate-100 border border-white/25 bg-black/60"
      >
        TEST MUZZLE EFFECT
      </button>
    </div>
  );
}
