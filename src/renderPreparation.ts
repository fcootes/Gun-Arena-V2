import * as THREE from 'three';
import { yieldForPaint } from './deployment';

const COMPLETION_TIMEOUT_MS = 30_000;
function checkCompletionDeadline(start: number, kind: string, timeoutMs: number) {
  if (performance.now() - start >= timeoutMs)
    throw new Error(`Deployment ${kind} preparation timed out after ${timeoutMs} ms; WebGL completion made no progress`);
}

/** Three 0.185 compileAsync waits each material's current program. Transparent
 * DoubleSide materials have another program; wait for both via the GL extension.
 */
export async function waitForPrograms(renderer: THREE.WebGLRenderer, signal: AbortSignal, timeoutMs = COMPLETION_TIMEOUT_MS): Promise<void> {
  signal.throwIfAborted();
  const gl = renderer.getContext();
  const extension = gl.getExtension('KHR_parallel_shader_compile');
  if (!extension) return;
  const start = performance.now();
  for (;;) {
    signal.throwIfAborted();
    if (gl.isContextLost()) throw new Error('Deployment shader preparation lost its WebGL context');
    if ((renderer.info.programs ?? []).every(program => gl.getProgramParameter(program.program as WebGLProgram, extension.COMPLETION_STATUS_KHR))) return;
    checkCompletionDeadline(start, 'shader', timeoutMs);
    await yieldForPaint(signal);
  }
}

/** Wait for submitted uploads/draws without a blocking finish or a guessed delay. */
export async function waitForGpu(renderer: THREE.WebGLRenderer, signal: AbortSignal, timeoutMs = COMPLETION_TIMEOUT_MS): Promise<void> {
  signal.throwIfAborted();
  const gl = renderer.getContext();
  if (!('fenceSync' in gl)) throw new Error('Deployment preparation requires WebGL 2');
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) throw new Error('Unable to fence deployment rendering');
  const start = performance.now();
  try {
    gl.flush();
    for (;;) {
      signal.throwIfAborted();
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return;
      if (status === gl.WAIT_FAILED || gl.isContextLost()) throw new Error('Deployment rendering lost its WebGL context');
      checkCompletionDeadline(start, 'GPU fence', timeoutMs);
      await yieldForPaint(signal);
    }
  } finally { gl.deleteSync(fence); }
}

/** Combat specialization needs the gameplay lighting, not another traversal of
 * every world object for every representative/light-count pair. Borrow the live
 * shadow maps without moving lights or owning/disposal of their GPU resources.
 */
export function createCombatPreparationScene(scene: THREE.Scene, camera: THREE.Camera): THREE.Scene {
  const combat = new THREE.Scene();
  combat.name = 'CombatPreparation';
  combat.fog = scene.fog;
  combat.environment = scene.environment;
  combat.environmentIntensity = scene.environmentIntensity;
  combat.environmentRotation.copy(scene.environmentRotation);
  combat.overrideMaterial = scene.overrideMaterial;
  scene.traverseVisible(object => {
    if (!(object instanceof THREE.Light) || !object.layers.test(camera.layers)) return;
    const light = object.clone(false);
    light.matrix.copy(object.matrixWorld); light.matrixAutoUpdate = false;
    const source = object as THREE.DirectionalLight | THREE.SpotLight;
    const shadowLight = light as typeof source;
    if (source.shadow) shadowLight.shadow = source.shadow;
    if (source.target) {
      const target = new THREE.Object3D();
      target.matrix.copy(source.target.matrixWorld); target.matrixAutoUpdate = false;
      shadowLight.target = target; combat.add(target);
    }
    combat.add(light);
  });
  return combat;
}

/** Reveal draw resources without accidentally enabling hidden lobby/muzzle lights. */
export class PreparationVisibility {
  readonly drawables: THREE.Object3D[] = [];
  private states: { object: THREE.Object3D; visible: boolean; culled: boolean; layers: number }[] = [];
  constructor(scene: THREE.Scene, camera: THREE.Camera, excluded: readonly THREE.Object3D[] = []) {
    const ignored = new Set(excluded);
    const lightParents = new Set<THREE.Object3D>();
    const collect = (object: THREE.Object3D, parentVisible: boolean) => {
      if (ignored.has(object)) return;
      const effectiveVisible = parentVisible && object.visible;
      this.states.push({ object, visible: object.visible, culled: object.frustumCulled, layers: object.layers.mask });
      const drawable = object as THREE.Mesh;
      if (drawable.geometry && drawable.material) this.drawables.push(object);
      for (const child of object.children) collect(child, effectiveVisible);
      if (object instanceof THREE.Light) {
        object.visible = effectiveVisible;
        if (effectiveVisible) for (let parent = object.parent; parent; parent = parent.parent) lightParents.add(parent);
      }
      else object.visible = !drawable.geometry;
      if (drawable.geometry) { object.frustumCulled = false; object.layers.mask |= camera.layers.mask; }
    };
    collect(scene, true);
    // Lights occasionally live beneath a mesh. Hiding that ancestor would change
    // the program's light counts between preparation batches.
    lightParents.forEach(object => { object.visible = true; });
  }
  showBatch(objects: readonly THREE.Object3D[]): () => void {
    const enabled = new Set<THREE.Object3D>();
    for (const object of objects) {
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) {
        if (!parent.visible) { parent.visible = true; enabled.add(parent); }
      }
    }
    return () => enabled.forEach(object => { object.visible = false; });
  }
  restore() {
    for (const { object, visible, culled, layers } of this.states) {
      object.visible = visible; object.frustumCulled = culled; object.layers.mask = layers;
    }
  }
}

/** Aim at an actual triangle so a preparation draw executes fragment shading.
 * Scissoring a corner of the normal gameplay view can draw no fragments at all.
 */
export function aimPreparationCamera(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, mesh: THREE.Mesh): void {
  mesh.updateMatrixWorld(true);
  const geometry = mesh.geometry, positions = geometry.getAttribute('position');
  const matrix = mesh.matrixWorld.clone();
  if (mesh instanceof THREE.InstancedMesh) {
    const instance = new THREE.Matrix4(); mesh.getMatrixAt(0, instance); matrix.multiply(instance);
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), edge = new THREE.Vector3();
  const count = geometry.index?.count ?? positions.count;
  for (let i = geometry.drawRange.start; i + 2 < Math.min(count, geometry.drawRange.start + 96); i += 3) {
    a.fromBufferAttribute(positions, geometry.index?.getX(i) ?? i).applyMatrix4(matrix);
    b.fromBufferAttribute(positions, geometry.index?.getX(i + 1) ?? i + 1).applyMatrix4(matrix);
    c.fromBufferAttribute(positions, geometry.index?.getX(i + 2) ?? i + 2).applyMatrix4(matrix);
    normal.subVectors(b, a).cross(edge.subVectors(c, a));
    if (normal.lengthSq() > 1e-18) break;
  }
  const distance = Math.max(.01, a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) * 2;
  // Inactive pooled Points can have coincident vertices. Aim a valid camera at
  // their position as well so the program is submitted before particles spawn.
  if (normal.lengthSq() <= 1e-18) normal.set(0, 0, 1);
  a.add(b).add(c).multiplyScalar(1 / 3);
  camera.position.copy(a).addScaledVector(normal.normalize(), distance);
  camera.lookAt(a); camera.near = .0001; camera.far = Math.max(500, distance * 4);
  if (camera instanceof THREE.PerspectiveCamera) camera.fov = 60;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
