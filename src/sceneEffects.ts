import { GRAPHICS } from './graphicsConfig';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { WorldMapId } from './types';

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
    render(delta: number, map: WorldMapId) { if (!disposed) { bloom.strength = GRAPHICS.bloomStrength[map]; renderer.info.reset(); composer.render(delta); } },
    dispose() { if (disposed) return; disposed = true; bloom.dispose(); output.dispose(); renderPass.dispose(); composer.dispose(); }
  };
}
