import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildWeaponMesh } from './lobbyAvatar';
import { disposeBotVisuals } from './botBuilder';

export function WeaponStudio({ weaponId }: { weaponId: string }) {
  const setWeaponRef = useRef<(id: string) => void>(() => {});
  const weaponIdRef = useRef(weaponId); weaponIdRef.current = weaponId;
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { host.textContent = 'WebGL is unavailable. Weapon selection and stats remain available below.'; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10191c);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 30);
    camera.position.set(1.6, 0.6, -0.55);
    const weapon = new THREE.Group();
    buildWeaponMesh(weapon, weaponIdRef.current);
    weapon.rotation.y = Math.PI / 2;
    const bounds = new THREE.Box3().setFromObject(weapon);
    const center = bounds.getCenter(new THREE.Vector3());
    weapon.position.sub(center);
    scene.add(weapon);
    const extent = bounds.getSize(new THREE.Vector3()).length();
    camera.position.multiplyScalar(Math.max(0.55, extent / 1.2));
    let currentWeaponId = weaponIdRef.current;
    setWeaponRef.current = (id) => {
      if (id === currentWeaponId) return;
      currentWeaponId = id; weapon.position.set(0, 0, 0); buildWeaponMesh(weapon, id);
      const box = new THREE.Box3().setFromObject(weapon); weapon.position.sub(box.getCenter(new THREE.Vector3()));
      camera.position.normalize().multiplyScalar(Math.max(0.9, box.getSize(new THREE.Vector3()).length() * 1.55));
    };
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.enableDamping = true;
    controls.minDistance = 0.4; controls.maxDistance = 5;
    const key = new THREE.SpotLight(0xeaf5ff, 35, 12, Math.PI / 3, 0.5); key.position.set(1.3, 2.4, 1.3);
    const rim = new THREE.DirectionalLight(0x65bac7, 4); rim.position.set(-2, 0.6, -2);
    const fill = new THREE.HemisphereLight(0xbfd6df, 0x152123, 2);
    scene.add(key, rim, fill);
    const resize = () => { const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let frame = 0; let disposed = false;
    const animate = () => { if (disposed) return; frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); setWeaponRef.current = () => {}; disposeBotVisuals(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, []);
  useEffect(() => { setWeaponRef.current(weaponId); }, [weaponId]);
  return <div className="relative w-full h-64 lg:h-80 shrink-0 border border-white/15 overflow-hidden bg-[#10191c]" aria-label="3D weapon spotlight viewport"><div ref={hostRef} className="absolute inset-0" /><div className="absolute left-4 bottom-3 pointer-events-none text-[9px] tracking-[.2em] text-cyan-200">STUDIO / {weaponId.toUpperCase()} — DRAG TO INSPECT</div></div>;
}
