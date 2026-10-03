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
  return {
    resize(width: number, height: number) { if (!disposed) { composer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1.5)); composer.setSize(width, height); } },
    render(delta: number, map: WorldMapId) { if (!disposed) { bloom.strength = map === 'hangar' ? 0.35 : map === 'shattered_wall' ? 0.4 : 0.22; composer.render(delta); } },
    dispose() { if (disposed) return; disposed = true; bloom.dispose(); output.dispose(); renderPass.dispose(); composer.dispose(); }
  };
}
