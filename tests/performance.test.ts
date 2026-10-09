import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ColliderIndex } from '../src/colliderIndex';
import { traversalBlocked } from '../src/tacticalNavigation';
import { createWorld, createWorldAsync, clearOffshoreTextureImages } from '../src/world';
import { buildBotVisuals, disposeBotVisuals, disposeBotTextureCache, setActorWeaponModel } from '../src/botBuilder';
import { FrameSamples, initialization } from '../src/performance';
import { DeploymentPipeline } from '../src/deployment';
import type { WorldCollider } from '../src/types';

// Seeded reference comparisons cover negative cells, padded edge contact and live gates.
let seed = 12345;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const colliders: WorldCollider[] = Array.from({ length: 160 }, (_, i) => {
  const x = random() * 120 - 60, z = random() * 120 - 60;
  return { minX: x, maxX: x + random() * 12, minZ: z, maxZ: z + random() * 12,
    minY: i % 3 ? 0 : 15, maxY: i % 3 ? 3 : 18, active: i % 11 !== 0,
    ...(i % 7 === 0 ? { passThroughTeam: 'blue' } : {}) };
});
const index = new ColliderIndex(); colliders.forEach(c => index.add(c));
for (let n = 0; n < 1200; n++) {
  const from = new THREE.Vector3(random() * 120 - 60, n % 2 ? 0 : 15, random() * 120 - 60);
  const to = from.clone().add(new THREE.Vector3(random() * 24 - 12, 0, random() * 24 - 12));
  const team = n % 2 ? 'blue' : 'red';
  const candidates = index.query(Math.min(from.x, to.x) - .4, Math.max(from.x, to.x) + .4, Math.min(from.z, to.z) - .4, Math.max(from.z, to.z) + .4);
  assert.equal(traversalBlocked(from, to, candidates, team), traversalBlocked(from, to, colliders, team));
  if (n % 17 === 0) colliders[n % colliders.length].active = !colliders[n % colliders.length].active;
}
const cover: WorldCollider = { minX: -.1, maxX: .1, minZ: -.2, maxZ: .2, minY: 0, maxY: 3, active: true, passThroughTeam: 'blue' };
index.add(cover); assert.ok(index.query(-1, 1, -1, 1).includes(cover));
index.remove(cover); assert.ok(!index.query(-1, 1, -1, 1).includes(cover));
index.clear(); assert.equal(index.query(-100, 100, -100, 100).length, 0);
console.log('PASS: 1,200 exact indexed/full traversal comparisons, live active/team flags and cover removal');

let paints = 0;
const ctx = new Proxy({}, { get: (_, key) => String(key).includes('Gradient') ? () => ({ addColorStop() {} }) : () => { paints++; } });
(globalThis as any).document = { hidden: true, createElement: () => ({ width: 256, height: 256, getContext: () => ctx }) };
clearOffshoreTextureImages();
let padImage: unknown, padWrapper: unknown, firstPaints = 0;
for (let cycle = 0; cycle < 4; cycle++) {
  const scene = new THREE.Scene(), world = createWorld(scene, 'shattered_wall');
  scene.updateMatrixWorld(true);
  let crates = 0;
  scene.traverse(node => {
    if (!node.userData.destructible) return;
    crates++;
    const lid = node.children[0];
    assert.equal(lid.getWorldPosition(new THREE.Vector3()).y, 15.54, 'Child attachment retains original unscaled height');
    const bounds = new THREE.Box3().setFromObject(lid), size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x - 2.4) < 1e-6 && Math.abs(size.z - 1.9) < 1e-6, 'Lid dimensions remain unchanged under parent');
  });
  assert.equal(crates, 6);
  const padTexture = (world.terrainMesh.material as THREE.MeshStandardMaterial).map!;
  if (!cycle) { padImage = padTexture.image; padWrapper = padTexture; firstPaints = paints; }
  else { assert.equal(padTexture.image, padImage); assert.notEqual(padTexture, padWrapper); }
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  scene.traverse((node: any) => {
    if (node.geometry) geometries.add(node.geometry);
    for (const m of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
      materials.add(m); Object.values(m).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
    }
  });
  let geometryDisposals = 0, materialDisposals = 0, textureDisposals = 0;
  geometries.forEach(g => g.addEventListener('dispose', () => geometryDisposals++));
  materials.forEach(m => m.addEventListener('dispose', () => materialDisposals++));
  textures.forEach(t => t.addEventListener('dispose', () => textureDisposals++));
  world.dispose(); world.dispose();
  assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size); assert.equal(textureDisposals, textures.size);
  assert.equal(scene.children.length, 0);
}
assert.ok(firstPaints > 50_000, 'Original texture detail still painted');
assert.ok(paints < firstPaints + 300, 'Only small uncached radial images repaint across restarts');
clearOffshoreTextureImages();
for (let cycle = 0; cycle < 3; cycle++) {
  const actor = buildBotVisuals({ botId: cycle, team: 'blue', isZombie: false, zType: 'walker', isVIP: false, weaponTypeIndex: 0, weaponType: 'ar', factionAlignment: cycle % 2 ? 'apex' : 'usmc' });
  for (const id of ['pistol', 'lmg', 'railgun', 'ar']) setActorWeaponModel(actor, id);
  disposeBotVisuals(actor.rootGroup);
  assert.equal(actor.rootGroup.children.length, 0);
}
disposeBotTextureCache();
console.log('PASS: pixel-cache reuse, unique texture ownership, four full world disposals and repeated actor weapon replacement');

const samples = new FrameSamples(100);
for (let i = 0; i < 100; i++) samples.add(i === 99 ? 100 : 10, 3, 2, 1);
const summary = samples.summary();
assert.equal(summary.worstMs, 100); assert.equal(summary.lowFps, 10);
assert.ok(Math.abs(summary.averageFps - 100000 / 1090) < 1e-8);
assert.equal(summary.simulationMs, 3); assert.equal(summary.submissionMs, 2);
assert.equal(summary.aiMs, 1); samples.add(10, 3, 2, 1); assert.equal(samples.summary().frameTimes.length, 100);
console.log('PASS: bounded rolling samples, frame-time weighted average and slowest-one-percent mean');

initialization.begin('test');
let work = 0;
const pipeline = new DeploymentPipeline(() => {});
const pending = pipeline.stage('Canceled', () => { work++; });
pipeline.cancel(); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(work, 0);
const ordered: string[] = [];
const next = new DeploymentPipeline(stage => ordered.push(stage));
await next.stage('one', () => { ordered.push('work-one'); });
await next.stage('two', () => { ordered.push('work-two'); });
assert.deepEqual(ordered, ['one', 'work-one', 'two', 'work-two']);
const inflight = new DeploymentPipeline(() => {});
await assert.rejects(inflight.stage('async cancel', async () => { inflight.cancel(); }), { name: 'AbortError' });
initialization.finish(); assert.ok(!initialization.active);
console.log('PASS: cancellation before work and during async stage; ordered initialization timing');

for (const map of ['area51', 'shattered_wall'] as const) {
  for (const stopAt of [1, 3, 5, 7]) {
    const scene = new THREE.Scene();
    const originalFog = new THREE.FogExp2(0xaaaaaa), originalBackground = new THREE.Color(0x111111);
    scene.fog = originalFog; scene.background = originalBackground;
    let stages = 0;
    const pipeline = new DeploymentPipeline(() => { if (++stages === stopAt) pipeline.cancel(); });
    await assert.rejects(createWorldAsync(scene, map, pipeline, new THREE.PerspectiveCamera()), { name: 'AbortError' });
    assert.equal(scene.children.length, 0, `${map} cancellation at stage ${stopAt} detaches partial world`);
    assert.equal(scene.fog, originalFog); assert.equal(scene.background, originalBackground);
  }
  const scene = new THREE.Scene();
  const world = await createWorldAsync(scene, map, new DeploymentPipeline(() => {}), new THREE.PerspectiveCamera());
  assert.ok(world.navigationPoints!.length > 0); assert.ok(world.worldColliders.length > 0);
  world.dispose(); assert.equal(scene.children.length, 0);
}
clearOffshoreTextureImages();
console.log('PASS: real staged constructors complete both maps; cancellation at eight partial-world stages restores scene and ownership');
