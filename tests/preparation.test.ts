import assert from 'node:assert/strict';
import * as THREE from 'three';
import { aimPreparationCamera, PreparationVisibility, waitForGpu, waitForPrograms } from '../src/renderPreparation';
import { buildBotVisuals, disposeBotVisuals, disposeBotTextureCache } from '../src/botBuilder';
import { createViewmodelManager } from '../src/weapons';
import { audioManager } from '../src/campaignAudio';
import { createSceneEffects } from '../src/sceneEffects';
import { DeploymentPipeline } from '../src/deployment';

const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(85, 1, .05, 500);
const hidden = new THREE.Group(); hidden.visible = false; scene.add(hidden);
const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); hidden.add(mesh);
const muzzle = new THREE.PointLight(); mesh.add(muzzle);
const fixture = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); scene.add(fixture);
const activeLight = new THREE.PointLight(); fixture.add(activeLight);
const lobby = new THREE.Group(); lobby.visible = false; lobby.add(new THREE.PointLight()); scene.add(lobby);
mesh.layers.set(3);
const states: [THREE.Object3D, boolean, boolean, number][] = [];
scene.traverse(object => states.push([object, object.visible, object.frustumCulled, object.layers.mask]));
const preparation = new PreparationVisibility(scene, camera, [lobby]);
assert.equal(muzzle.visible, false, 'Revealing hidden weapons cannot enable their lights');
assert.equal(activeLight.visible, true); assert.equal(fixture.visible, true, 'Mesh ancestor of a live light stays visible');
assert.equal(lobby.visible, false); assert.ok(!preparation.drawables.includes(lobby.children[0]));
assert.equal(mesh.frustumCulled, false); assert.ok(mesh.layers.test(camera.layers));
const hide = preparation.showBatch([mesh]); assert.equal(mesh.visible, true); hide(); assert.equal(mesh.visible, false);
preparation.restore();
for (const [object, visible, culled, layers] of states) {
  assert.equal(object.visible, visible); assert.equal(object.frustumCulled, culled); assert.equal(object.layers.mask, layers);
}
console.log('PASS: hidden mission geometry, frozen light counts, excluded lobby and exact visibility/layer restoration');

const instance = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 3, 4), new THREE.MeshStandardMaterial(), 1);
instance.setMatrixAt(0, new THREE.Matrix4().makeTranslation(20, 10, -30)); scene.add(instance); scene.updateMatrixWorld(true);
aimPreparationCamera(camera, instance);
const a = new THREE.Vector3(), center = new THREE.Vector3(), matrix = new THREE.Matrix4(); instance.getMatrixAt(0, matrix);
for (let i = 0; i < 3; i++) center.add(a.fromBufferAttribute(instance.geometry.attributes.position, instance.geometry.index!.getX(i)).applyMatrix4(matrix));
center.multiplyScalar(1 / 3).project(camera);
assert.ok(Math.abs(center.x) < 1e-6 && Math.abs(center.y) < 1e-6 && center.z > -1 && center.z < 1, 'The real instance triangle covers the preparation pixel');
console.log('PASS: representative draw camera covers actual instance geometry');

(globalThis as any).document = { hidden: true, createElement: () => ({ getContext: () => new Proxy({}, { get: (_, key) => String(key).includes('Gradient') ? () => ({ addColorStop() {} }) : () => {} }) }) };
let polls = 0, deleted = 0, flushed = 0;
const gl = { SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, WAIT_FAILED: 4,
  fenceSync: () => ({}), flush: () => flushed++, clientWaitSync: (): number => ++polls < 3 ? 0 : 3, deleteSync: () => deleted++, isContextLost: () => false };
await waitForGpu({ getContext: () => gl } as any, new AbortController().signal);
assert.equal(polls, 3); assert.equal(deleted, 1); assert.equal(flushed, 1);
const cancel = new AbortController(); polls = 0;
gl.clientWaitSync = () => { cancel.abort(); return 0; };
await assert.rejects(waitForGpu({ getContext: () => gl } as any, cancel.signal), { name: 'AbortError' });
assert.equal(deleted, 2, 'Canceled GPU wait deletes its sync exactly once');
gl.clientWaitSync = () => 4;
await assert.rejects(waitForGpu({ getContext: () => gl } as any, new AbortController().signal), /lost its WebGL context/);
assert.equal(deleted, 3);
let shaderPolls = 0;
await waitForPrograms({ info: { programs: [{ program: 'front' }, { program: 'back' }] }, getContext: () => ({
  getExtension: () => ({ COMPLETION_STATUS_KHR: 1 }), isContextLost: () => false,
  getProgramParameter: (program: string) => program === 'front' || ++shaderPolls >= 2,
}) } as any, new AbortController().signal);
assert.equal(shaderPolls, 2, 'Wait includes the back-side program that compileAsync does not track');
console.log('PASS: real completion polling, cancellation/context failure cleanup and all shader-program completion');

// Exercise the real preparation orchestration: Three keys new unlit materials
// with the current light count, so they must participate in variant draws too.
const preparationScene = new THREE.Scene(), preparationCamera = new THREE.PerspectiveCamera();
const pointGeometry = new THREE.BufferGeometry(); pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
const unlit = new THREE.ShaderMaterial({ lights: false });
const particles = new THREE.Points(pointGeometry, unlit); particles.visible = false; preparationScene.add(particles);
let renderTarget: THREE.WebGLRenderTarget | null = null, scissorTest = false;
const scissor = new THREE.Vector4(0, 0, 320, 180), color = new THREE.Color();
const submissions: number[] = [];
let completeViewport: number[] = [];
const completeGl = { ...gl, clientWaitSync: () => 3, CURRENT_PROGRAM: 9, getParameter: () => unlit,
  getExtension: () => null };
const fakeRenderer = {
  shadowMap: { autoUpdate: true }, info: { autoReset: true, programs: [], reset() {} },
  getPixelRatio: () => 1, getSize: (v: THREE.Vector2) => v.set(320, 180),
  getContext: () => completeGl, getRenderTarget: () => renderTarget,
  setRenderTarget: (t: THREE.WebGLRenderTarget | null) => { renderTarget = t; },
  getScissor: (v: THREE.Vector4) => v.copy(scissor), setScissor: (v: THREE.Vector4) => scissor.copy(v),
  getScissorTest: () => scissorTest, setScissorTest: (v: boolean) => { scissorTest = v; },
  getClearColor: (v: THREE.Color) => v.copy(color), setClearColor() {}, getClearAlpha: () => 1,
  clear() {}, clearDepth() {}, compile() {}, autoClear: true,
  outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.NoToneMapping, toneMappingExposure: 1,
  render(s: THREE.Object3D, c: THREE.Camera) {
    if (s === preparationScene && !particles.visible && renderTarget) completeViewport = renderTarget.viewport.toArray();
    let lights = 0; s.traverseVisible(object => { if (object instanceof THREE.PointLight) lights++; });
    s.traverseVisible((object: any) => {
      if (!object.geometry || !object.material) return;
      if (object.material === unlit) submissions.push(lights);
      object.onAfterRender(fakeRenderer, s, c, object.geometry, object.material, null);
    });
  },
};
const originalCamera = preparationCamera.matrixWorld.clone(), originalProjection = preparationCamera.projectionMatrix.clone();
const effects = createSceneEffects(fakeRenderer as any, preparationScene, preparationCamera);
await effects.prepare(new DeploymentPipeline(() => {}), 'area51', 2);
assert.deepEqual([...new Set(submissions)].sort(), [0, 1, 2], 'Unlit mission particle shaders are really drawn at every possible light count');
assert.equal(particles.visible, false); assert.equal(particles.frustumCulled, true);
assert.deepEqual(preparationCamera.matrixWorld, originalCamera); assert.deepEqual(preparationCamera.projectionMatrix, originalProjection);
assert.equal(renderTarget, null); assert.equal(scissorTest, false); assert.deepEqual(scissor.toArray(), [0, 0, 320, 180]);
assert.equal(fakeRenderer.shadowMap.autoUpdate, true); assert.equal(preparationScene.children.length, 1);
let resized = false;
await effects.prepare(new DeploymentPipeline(name => {
  if (!resized && name === 'Geometry, textures and shadows') { resized = true; effects.resize(640, 360); }
}), 'area51', 2);
assert.deepEqual(completeViewport, [0, 0, 640, 360], 'A resize during uploads retains the new composer viewport in the final frame');
const canceledPreparation = new DeploymentPipeline(name => {
  if (name === 'Combat lighting draws' && preparationScene.children.some(object => object instanceof THREE.PointLight)) canceledPreparation.cancel();
});
await assert.rejects(effects.prepare(canceledPreparation, 'area51', 2), { name: 'AbortError' });
assert.equal(preparationScene.children.length, 1, 'Canceled preparation removes temporary lights and representative clones');
assert.equal(particles.visible, false); assert.equal(renderTarget, null); assert.equal(scissorTest, false);
assert.deepEqual(preparationCamera.matrixWorld, originalCamera); assert.deepEqual(preparationCamera.projectionMatrix, originalProjection);
assert.equal(fakeRenderer.shadowMap.autoUpdate, true);
// Multiple independent formats must retain all real draws while sharing fences.
const batchMaterials = Array.from({ length: 17 }, () => new THREE.MeshBasicMaterial());
const batchMeshes = batchMaterials.map(material => new THREE.Mesh(new THREE.BoxGeometry(), material));
preparationScene.add(...batchMeshes);
const batchSubmissions = new Map(batchMaterials.map(material => [material, new Set<number>()]));
const originalRender = fakeRenderer.render;
let currentProgram: THREE.Material = unlit, fences = 0, batches = 0, inBatch = false, drawsInBatch = 0;
const batchSizes: number[] = [];
completeGl.getParameter = () => currentProgram as typeof unlit;
completeGl.fenceSync = () => { fences++; return {}; };
fakeRenderer.render = (s, c) => {
  if (inBatch) drawsInBatch++;
  let lights = 0; s.traverseVisible(object => { if (object instanceof THREE.PointLight) lights++; });
  s.traverseVisible((object: any) => {
    if (!object.geometry || !object.material) return;
    currentProgram = object.material;
    batchSubmissions.get(object.material)?.add(lights);
    object.onAfterRender(fakeRenderer, s, c, object.geometry, object.material, null);
  });
};
await effects.prepare(new DeploymentPipeline(name => {
  if (inBatch) batchSizes.push(drawsInBatch);
  inBatch = name === 'Combat lighting draws'; drawsInBatch = 0;
  if (inBatch) batches++;
}), 'area51', 2);
for (const counts of batchSubmissions.values()) assert.deepEqual([...counts].sort(), [0, 1, 2]);
assert.ok(batchSizes.every(size => size > 0 && size <= 8), 'Each paint batch is capped at eight real submissions');
assert.ok(batches < 17 * 3 && fences < 17 * 3, 'Formats share stages and GPU fences without skipping variants');
let canceledDraws = 0;
let combatDraw = false;
const duringDraw = new DeploymentPipeline(name => { combatDraw = name === 'Combat lighting draws'; });
fakeRenderer.render = (s, c) => {
  if (combatDraw) { canceledDraws++; duringDraw.cancel(); }
  originalRender(s, c);
};
await assert.rejects(effects.prepare(duringDraw, 'area51', 2), { name: 'AbortError' });
assert.equal(canceledDraws, 1);
assert.equal(preparationScene.children.length, 18); assert.equal(renderTarget, null); assert.equal(scissorTest, false);
assert.deepEqual(preparationCamera.matrixWorld, originalCamera); assert.equal(fakeRenderer.shadowMap.autoUpdate, true);
fakeRenderer.render = originalRender;
batchMeshes.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); }); batchMaterials.forEach(material => material.dispose());
completeGl.getParameter = () => unlit;
effects.dispose(); pointGeometry.dispose(); unlit.dispose();
console.log('PASS: real preparation includes unlit particle variants and restores camera, render target, shadow, scissor and scene state');
console.log('PASS: bounded multi-format batches retain every light-count draw, reduce fences and restore state on mid-draw cancellation');

const options = { botId: 0, team: 'zombie', isZombie: true, zType: 'walker' as const, isVIP: false,
  weaponTypeIndex: 0, weaponType: 'ar', factionAlignment: 'usmc' as const };
const originalRandom = Math.random; Math.random = () => .5;
const first = buildBotVisuals(options), second = buildBotVisuals({ ...options, botId: 7 });
const geometries = new Set<THREE.BufferGeometry>(); first.rootGroup.traverse((object: any) => { if (object.geometry) geometries.add(object.geometry); });
const secondGeometry = new Set<THREE.BufferGeometry>(); second.rootGroup.traverse((object: any) => { if (object.geometry) secondGeometry.add(object.geometry); });
const shared = [...geometries].filter(geometry => secondGeometry.has(geometry));
assert.ok(shared.length >= geometries.size - 4, 'All deterministic primitives share GPU buffers; random shreds remain actor-owned');
assert.notEqual(first.flashMats[0], second.flashMats[0], 'Damage flash state stays actor-local');
assert.deepEqual(new THREE.Box3().setFromObject(first.rootGroup), new THREE.Box3().setFromObject(second.rootGroup));
let released = 0; geometries.forEach(geometry => geometry.addEventListener('dispose', () => released++));
const boss = buildBotVisuals({ ...options, zType: 'megaboss' });
assert.equal(released, 0, 'Preparing a boss cannot dispose shared legacy claw buffers used by live infected');
disposeBotVisuals(boss.rootGroup);
assert.equal(released, 0, 'Removing a boss leaves infected buffers owned by the engine');
disposeBotVisuals(first.rootGroup); assert.equal(released, geometries.size - shared.length);
assert.ok(new THREE.Box3().setFromObject(second.rootGroup).getSize(new THREE.Vector3()).length() > 0);
disposeBotVisuals(second.rootGroup); assert.equal(released, geometries.size - shared.length);
disposeBotTextureCache(); assert.equal(released, geometries.size);
disposeBotTextureCache(); assert.equal(released, geometries.size);
const third = buildBotVisuals(options); assert.ok(!geometries.has(third.hitParts[0].geometry), 'New engine never reuses disposed buffers');
disposeBotVisuals(third.rootGroup); disposeBotTextureCache(); Math.random = originalRandom;
const vm = createViewmodelManager(); vm.prepare(['ar', 'sniper']);
const children = vm.root.children.length; vm.prepare(['ar', 'sniper']); assert.equal(vm.root.children.length, children);
assert.ok(vm.root.getObjectByProperty('name', 'FirstPersonWeapons'));
disposeBotVisuals(vm.root);
console.log('PASS: immutable body-buffer reuse, independent damage materials, engine disposal and idempotent selected-viewmodel preparation');

const contexts: any[] = [];
class FakeAudioContext {
  sampleRate = 8000; state = 'running'; destination = {}; currentTime = 0;
  buffers: any[] = []; sources: any[] = [];
  constructor() { contexts.push(this); }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length), buffer = { length, getChannelData: () => data };
    this.buffers.push(buffer); return buffer;
  }
  createBufferSource() { const source = { connect() {}, disconnect() {}, stop() {}, start() {}, buffer: null, loop: false }; this.sources.push(source); return source; }
  createGain() { return { connect() {}, disconnect() {}, gain: { value: 0, setTargetAtTime() {} } }; }
  createBiquadFilter() { return { connect() {}, disconnect() {}, type: '', frequency: { value: 0 }, Q: { value: 0 } }; }
  close() { return Promise.resolve(); }
}
(globalThis as any).AudioContext = FakeAudioContext;
(globalThis as any).window = { AudioContext: FakeAudioContext };
audioManager.prepare('rotor'); audioManager.prepare('rotor');
assert.equal(contexts[0].buffers.length, 1); assert.equal(contexts[0].sources.length, 0, 'Preparation is silent');
assert.equal(contexts[0].buffers[0].length, 16000);
audioManager.play('rotor'); audioManager.play('rotor');
assert.equal(contexts[0].sources.length, 1); assert.ok(contexts[0].sources[0].loop);
audioManager.stop(); audioManager.play('rotor');
assert.equal(contexts[0].buffers.length, 1); assert.equal(contexts[0].sources.length, 2);
assert.equal(contexts[0].sources[1].buffer, contexts[0].buffers[0]);
audioManager.dispose(); audioManager.prepare('spartan_radio');
assert.equal(contexts.length, 2); assert.equal(contexts[1].buffers[0].length, 12000);
audioManager.dispose();
console.log('PASS: silent mission-audio preparation, exact cue lengths, playback/loop reuse and context disposal');
