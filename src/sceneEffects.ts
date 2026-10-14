import { GRAPHICS } from './graphicsConfig';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { WorldMapId } from './types';
import type { DeploymentPipeline } from './deployment';
import { PreparationVisibility, waitForGpu, waitForPrograms, aimPreparationCamera, createCombatPreparationScene, withPreparationPrimitive } from './renderPreparation';

/** Adjacent transient-light counts share one shader state by adding at most
 * three zero-intensity, non-shadowing lights. All real lights remain intact. */
export function combatPointLightCounts(base: number, extra: number, step = 4): number[] {
  const first = Math.ceil(base / step) * step, last = Math.ceil((base + extra) / step) * step;
  return Array.from({ length: (last - first) / step + 1 }, (_, index) => first + index * step);
}

export function createSceneEffects(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 1.1);
  const output = new OutputPass();
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output);
  let disposed = false;
  const initialSize = renderer.getSize(new THREE.Vector2());
  let lastWidth = initialSize.x, lastHeight = initialSize.y, lastRatio = renderer.getPixelRatio();
  renderer.info.autoReset = false;
  let lightStep = 1;
  const padding = new THREE.Group(); padding.name = 'CombatLightPadding';
  padding.visible = false;
  for (let i = 0; i < 3; i++) {
    const light = new THREE.PointLight(0xffffff, 0); light.position.set(10000, 10000, 10000);
    padding.add(light);
  }
  scene.add(padding);
  const pointLightCount = () => {
    let count = 0;
    scene.traverseVisible(object => {
      if (object instanceof THREE.PointLight && object.parent !== padding && object.layers.test(camera.layers)) count++;
    });
    return count;
  };
  const updateLightPadding = () => {
    const count = pointLightCount(), padded = Math.ceil(count / lightStep) * lightStep;
    padding.visible = lightStep > 1;
    padding.children.forEach((light, index) => { light.visible = index < padded - count; light.layers.mask = camera.layers.mask; });
    return count;
  };
  const render = (delta: number, map: WorldMapId) => {
    if (disposed) return;
    if (lightStep > 1) updateLightPadding();
    bloom.strength = GRAPHICS.bloomStrength[map]; renderer.info.reset(); composer.render(delta);
  };
  return {
    resize(width: number, height: number) {
      if (disposed) return;
      const ratio = Math.min(renderer.getPixelRatio(), GRAPHICS.composerPixelRatio);
      if (width === lastWidth && height === lastHeight && ratio === lastRatio) return;
      // setPixelRatio internally resizes: change its value before our single setSize.
      // Composer's private pixel ratio is not accessed. A DPR change legitimately needs both.
      if (ratio !== lastRatio) composer.setPixelRatio(ratio);
      if (width !== lastWidth || height !== lastHeight) composer.setSize(width, height);
      lastWidth = width; lastHeight = height; lastRatio = ratio;
    },
    render,
    async prepare(pipeline: DeploymentPipeline, map: WorldMapId, extraPointLights: number, excluded: readonly THREE.Object3D[] = []) {
      lightStep = map === 'training' ? 1 : 4;
      const basePointLights = updateLightPadding();
      const lightCounts = combatPointLightCounts(basePointLights, extraPointLights, lightStep);
      const visibility = new PreparationVisibility(scene, camera, excluded);
      const originalTarget = renderer.getRenderTarget();
      const originalScissor = renderer.getScissor(new THREE.Vector4());
      const originalScissorTest = renderer.getScissorTest();
      const lights: THREE.PointLight[] = [];
      const target = composer.readBuffer;
      const targetScissor = target.scissor.clone(), targetScissorTest = target.scissorTest;
      const targetViewport = target.viewport.clone();
      const targetWidth = target.width, targetHeight = target.height;
      const restoreTargetRectangle = (rectangle: THREE.Vector4, original: THREE.Vector4) => {
        rectangle.set(original.x * target.width / targetWidth, original.y * target.height / targetHeight,
          original.z * target.width / targetWidth, original.w * target.height / targetHeight);
      };
      const cameraPosition = camera.position.clone(), cameraQuaternion = camera.quaternion.clone();
      const projectionCamera = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
      const cameraNear = projectionCamera.near, cameraFar = projectionCamera.far;
      const cameraFov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 0;
      const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
      const litPrograms = new THREE.Group();
      let combatScene: THREE.Scene | undefined;
      type Representative = { object: THREE.Object3D; material: THREE.Material; start: number };
      const representatives = new Map<WebGLProgram, Map<string, Representative>>();
      const primitiveStarts = new Map<THREE.Object3D, number>();
      const callbacks = new Map<THREE.Object3D, THREE.Object3D['onAfterRender']>();
      const gl = renderer.getContext();
      const submitBatch = (objects: readonly THREE.Object3D[], drawScene = scene) => {
        const hide = drawScene === scene ? visibility.showBatch(objects) : () => objects.forEach(object => { object.visible = false; });
        if (drawScene !== scene) objects.forEach(object => { object.visible = true; });
        try {
          target.scissor.set(0, 0, 1, 1); target.scissorTest = true;
          renderer.setRenderTarget(target);
          renderer.render(drawScene, camera);
        } finally {
          hide();
          if (!gl.isContextLost()) renderer.setRenderTarget(originalTarget);
        }
      };
      const drawBatch = async (objects: readonly THREE.Object3D[]) => {
        submitBatch(objects);
        await waitForGpu(renderer, pipeline.signal);
      };
      const passScene = new THREE.Scene();
      const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const passGeometry = new THREE.PlaneGeometry(2, 2);
      try {
        // RenderPass uses this linear target, not the default framebuffer used by
        // compileAsync(scene, camera). Compilation also needs the live gameplay fog.
        // Own the KHR polling so cancellation never leaves Three's timer polling a
        // destroyed program/context, and wait every program (including back sides).
        scene.updateMatrixWorld(true);
        await pipeline.stage('Lighting programs', async () => {
          renderer.setRenderTarget(target);
          try { renderer.compile(scene, camera); await waitForPrograms(renderer, pipeline.signal); }
          finally { if (!gl.isContextLost()) renderer.setRenderTarget(originalTarget); }
        });

        // OutputPass configures its defines on first render. Prepare that same
        // public material configuration before the real composer submission.
        output.material.defines = THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer ? { SRGB_TRANSFER: '' } : {};
        const toneModes: Record<number, string> = {
          [THREE.LinearToneMapping]: 'LINEAR_TONE_MAPPING', [THREE.ReinhardToneMapping]: 'REINHARD_TONE_MAPPING',
          [THREE.CineonToneMapping]: 'CINEON_TONE_MAPPING', [THREE.ACESFilmicToneMapping]: 'ACES_FILMIC_TONE_MAPPING',
          [THREE.AgXToneMapping]: 'AGX_TONE_MAPPING', [THREE.NeutralToneMapping]: 'NEUTRAL_TONE_MAPPING',
          [THREE.CustomToneMapping]: 'CUSTOM_TONE_MAPPING',
        };
        if (toneModes[renderer.toneMapping]) output.material.defines[toneModes[renderer.toneMapping]] = '';
        output.material.needsUpdate = true;
        const materials = [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, output.material];
        for (const material of materials) {
          await pipeline.stage('Postprocessing programs', async () => {
            const mesh = new THREE.Mesh(passGeometry, material); passScene.add(mesh);
            renderer.setRenderTarget(material === output.material ? null : composer.readBuffer);
            try { renderer.compile(passScene, passCamera); await waitForPrograms(renderer, pipeline.signal); }
            finally { passScene.remove(mesh); if (!renderer.getContext().isContextLost()) renderer.setRenderTarget(originalTarget); }
          });
        }

        // One draw per immutable buffer and per material/object format uploads
        // the entire world without repeatedly drawing every copy of a primitive.
        // Each InstancedMesh retains its own instance buffer.
        const buffers = new Set<string>(), formats = new Set<string>();
        const uploads = visibility.drawables.filter(object => {
          const mesh = object as THREE.Mesh;
          const buffer = object instanceof THREE.InstancedMesh ? object.uuid : mesh.geometry.uuid;
          const format = `${object.type}:${Object.entries(mesh.geometry.attributes).map(([name, attribute]) => `${name}/${attribute.itemSize}`).join(',')}:${Object.keys(mesh.geometry.morphAttributes).join(',')}`;
          let needed = !buffers.has(buffer); buffers.add(buffer);
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const key = `${material.uuid}:${format}:${object.castShadow}`;
            if (!formats.has(key)) needed = true;
            formats.add(key);
          }
          return needed;
        });
        // Use the public GL program identity after a real draw, rather than
        // duplicating Three's shader-key logic or inspecting private renderer state.
        for (const object of uploads) {
          const previous = object.onAfterRender; callbacks.set(object, previous);
          object.onAfterRender = function (...args) {
            previous.apply(this, args);
            const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
            if (program) {
              const material = args[4];
              const state = [object.type, material.transparent, material.side, material.blending, material.blendSrc, material.blendDst,
                material.blendEquation, material.blendSrcAlpha, material.blendDstAlpha, material.blendEquationAlpha,
                material.depthTest, material.depthWrite, material.depthFunc, material.colorWrite, material.premultipliedAlpha,
                material.polygonOffset, material.alphaToCoverage].join('/');
              let states = representatives.get(program);
              if (!states) { states = new Map(); representatives.set(program, states); }
              const group = args[5] as unknown as THREE.GeometryGroup | null;
              if (!states.has(state)) states.set(state, { object, material, start: group?.start ?? (object as THREE.Mesh).geometry.drawRange.start });
            }
          };
        }
        for (let offset = 0; offset < uploads.length; offset += 16)
          await pipeline.stage('Geometry, textures and shadows', () => drawBatch(uploads.slice(offset, offset + 16)));
        callbacks.forEach((callback, object) => { object.onAfterRender = callback; }); callbacks.clear();

        // Some drivers defer specialization until a program is actually drawn.
        // Compile AND draw representative resources for each possible combat
        // light count; compileAsync alone still left measured first-fire stalls.
        // Three includes light counts in non-Raw program cache keys even for
        // unlit ShaderMaterial. Existing unlit materials reuse their program on
        // light changes, but a newly spawned actor gets a new key on first use.
        // Prepare every captured format, including muzzle/particle shaders.
        const draws = [...representatives.values()].flatMap(states => [...states.values()]);
        for (const { object, material, start } of draws) {
          const clone = object.clone(false) as THREE.Mesh;
          clone.material = material;
          primitiveStarts.set(clone, start);
          clone.matrix.copy(object.matrixWorld); clone.matrixAutoUpdate = false;
          clone.visible = false; clone.frustumCulled = false; clone.castShadow = false;
          if (clone instanceof THREE.InstancedMesh) clone.count = 1;
          litPrograms.add(clone);
        }
        renderer.shadowMap.autoUpdate = false;
        combatScene = createCombatPreparationScene(scene, camera);
        combatScene.add(litPrograms);
        for (let variant = 0; variant < lightCounts.length; variant++) {
          await pipeline.stage(`Lighting programs ${variant}/${lightCounts.length - 1}`, async () => {
            if (variant > 0) for (let i = 0; i < lightStep; i++) {
              const light = new THREE.PointLight(0xffffff, 0); combatScene!.add(light); lights.push(light);
            }
            renderer.setRenderTarget(target);
            try { renderer.compile(litPrograms, camera, combatScene); await waitForPrograms(renderer, pipeline.signal); }
            finally { if (!gl.isContextLost()) renderer.setRenderTarget(originalTarget); }
          });
          // Each representative still gets its own aimed, real draw. A fence
          // covers all preceding submissions, so waiting after every object only
          // adds driver round trips and paint boundaries. Keep batches small and
          // stop after a slow submission so cancellation/progress can paint.
          let offset = 0;
          while (offset < litPrograms.children.length) await pipeline.stage('Combat lighting draws', async () => {
            const deadline = performance.now() + 4;
            let submitted = 0;
            do {
              pipeline.signal.throwIfAborted();
              const object = litPrograms.children[offset++];
              withPreparationPrimitive(object as THREE.Mesh, primitiveStarts.get(object)!, () => {
                aimPreparationCamera(projectionCamera, object as THREE.Mesh);
                target.viewport.set(0, 0, 1, 1);
                submitBatch([object], combatScene);
              });
              submitted++;
            } while (offset < litPrograms.children.length && submitted < 8 && performance.now() < deadline);
            await waitForGpu(renderer, pipeline.signal);
          }, `${Math.floor(100 * (variant * litPrograms.children.length + offset) / (lightCounts.length * litPrograms.children.length))}% complete`);
        }
        litPrograms.removeFromParent();
        camera.position.copy(cameraPosition); camera.quaternion.copy(cameraQuaternion);
        projectionCamera.near = cameraNear; projectionCamera.far = cameraFar;
        if (camera instanceof THREE.PerspectiveCamera) camera.fov = cameraFov;
        projectionCamera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        restoreTargetRectangle(target.viewport, targetViewport);
        renderer.shadowMap.autoUpdate = shadowAutoUpdate;
        lights.forEach(light => { light.removeFromParent(); light.dispose(); }); lights.length = 0;
        await pipeline.stage('Restore deployment lighting', async () => {
          renderer.setRenderTarget(target);
          try { renderer.compile(scene, camera); await waitForPrograms(renderer, pipeline.signal); }
          finally { if (!gl.isContextLost()) renderer.setRenderTarget(originalTarget); }
        });
      } finally {
        callbacks.forEach((callback, object) => { object.onAfterRender = callback; });
        visibility.restore();
        litPrograms.removeFromParent();
        for (const object of litPrograms.children) if (object instanceof THREE.InstancedMesh) object.dispose();
        litPrograms.clear();
        // Cloned lights borrow shadows; clearing drops CPU references only.
        combatScene?.clear();
        restoreTargetRectangle(target.scissor, targetScissor); target.scissorTest = targetScissorTest;
        restoreTargetRectangle(target.viewport, targetViewport);
        camera.position.copy(cameraPosition); camera.quaternion.copy(cameraQuaternion);
        projectionCamera.near = cameraNear; projectionCamera.far = cameraFar;
        if (camera instanceof THREE.PerspectiveCamera) camera.fov = cameraFov;
        projectionCamera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        renderer.shadowMap.autoUpdate = shadowAutoUpdate;
        if (!gl.isContextLost()) {
          renderer.setRenderTarget(originalTarget); renderer.setScissor(originalScissor); renderer.setScissorTest(originalScissorTest);
        }
        lights.forEach(light => { light.removeFromParent(); light.dispose(); });
        passGeometry.dispose();
      }
      // This is the real full-resolution bloom/output/transmission/shadow path,
      // behind the loading overlay, with original visibility and light states.
      await pipeline.stage('First complete render', async () => {
        render(0, map);
        await waitForGpu(renderer, pipeline.signal);
      });
    },
    dispose() {
      if (disposed) return; disposed = true;
      padding.removeFromParent(); padding.children.forEach(light => (light as THREE.PointLight).dispose()); padding.clear();
      bloom.dispose(); output.dispose(); renderPass.dispose(); composer.dispose();
    }
  };
}
