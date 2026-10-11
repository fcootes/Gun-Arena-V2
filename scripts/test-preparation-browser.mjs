import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

// A small real-WebGL fixture, not a full map benchmark. Fail the entire run
// after 45 seconds; never inherit the multi-minute profiling harness timeout.
const output = resolve(process.env.PREPARATION_OUTPUT ?? 'performance-results/preparation-browser.json');
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 3096, strictPort: true }, plugins: [{
  name: 'preparation-test-page', configureServer(server) {
    server.middlewares.use('/__preparation-test', (_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html><body>Focused preparation regression</body></html>');
    });
  },
}] });
let browser;
const deadline = setTimeout(() => {
  console.error('FAIL: preparation browser regression exceeded 45 seconds');
  void browser?.close(); void server.close(); process.exitCode = 1;
}, 45000);
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, timeout: 10000,
    ...(process.env.BENCHMARK_BROWSER ? { executablePath: process.env.BENCHMARK_BROWSER } : {}),
    args: process.env.BENCHMARK_SINGLE_PROCESS === '1' ? ['--no-sandbox', '--single-process', '--no-zygote', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 160, height: 100 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3096/__preparation-test');
  const results = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { createSceneEffects } = await import('/src/sceneEffects.ts');
    const { DeploymentPipeline } = await import('/src/deployment.ts');
    const { waitForGpu } = await import('/src/renderPreparation.ts');
    const { createWeaponAssembly } = await import('/src/weaponModels.ts');
    const { createWeaponMuzzleEffect } = await import('/src/weaponEffects.ts');
    const { disposeBotVisuals } = await import('/src/botBuilder.ts');
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(160, 100); document.body.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0xffffff, .003);
    const camera = new THREE.PerspectiveCamera(70, 1.6, .05, 500); camera.position.set(0, 0, 4); camera.updateMatrixWorld();
    const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(2, 3, 4); light.castShadow = true;
    light.shadow.mapSize.set(32, 32); scene.add(light, new THREE.AmbientLight(0xffffff, .5));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshStandardMaterial({ color: 0x306080 }));
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    // A white geometry backdrop over black clear color catches a restored
    // 1-pixel viewport; a white background alone would clear all pixels anyway.
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    backdrop.position.z = -5; scene.add(backdrop);
    const assembly = createWeaponAssembly('ar'); scene.add(assembly.root);
    const muzzle = createWeaponMuzzleEffect(assembly);
    const effects = createSceneEffects(renderer, scene, camera);
    const initialCamera = camera.matrixWorld.toArray(), initialProjection = camera.projectionMatrix.toArray();
    const initialChildren = scene.children.length;
    let activeStage = '', resized = false, batchSizes = [], batchSize = 0, totalDraws = 0;
    const render = renderer.render.bind(renderer);
    renderer.render = (s, c) => { if (activeStage === 'Combat lighting draws') { batchSize++; totalDraws++; } render(s, c); };
    const progress = (name, resizeStage) => {
      if (activeStage === 'Combat lighting draws') batchSizes.push(batchSize);
      activeStage = name; batchSize = 0;
      if (!resized && name === resizeStage) {
        resized = true; renderer.setSize(192, 120); effects.resize(192, 120);
      }
    };
    const restored = () => {
      check(scene.children.length === initialChildren, 'Temporary representatives/lights remain');
      check(renderer.getRenderTarget() === null && !renderer.getScissorTest(), 'Render target/scissor not restored');
      check(renderer.shadowMap.autoUpdate, 'Shadow update not restored');
      check(JSON.stringify(camera.matrixWorld.toArray()) === JSON.stringify(initialCamera), 'Camera transform not restored');
      check(JSON.stringify(camera.projectionMatrix.toArray()) === JSON.stringify(initialProjection), 'Camera projection not restored');
    };
    const fullViewport = async () => {
      renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setClearColor(0x000000); renderer.clear();
      activeStage = ''; effects.render(0, 'area51'); await waitForGpu(renderer, new AbortController().signal);
      const pixels = [];
      for (const [x, y] of [[2, 2], [189, 2], [2, 117], [189, 117]]) {
        const pixel = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); pixels.push([...pixel]);
        check(pixel[0] > 200 && pixel[1] > 200 && pixel[2] > 200, 'Final frame did not cover the resized viewport');
      }
      return pixels;
    };
    const start = performance.now();
    try {
      // Exercise APEX's 21 future armed encounters as light-count variants with
      // actual standard + DoubleSide muzzle + Points formats, on a tiny scene.
      await effects.prepare(new DeploymentPipeline(name => progress(name, 'Geometry, textures and shadows')), 'area51', 21);
      restored(); const cornersAfterUploadResize = await fullViewport();
      check(batchSizes.every(size => size >= 1 && size <= 8), 'A preparation batch exceeded its draw limit');
      check(batchSizes.length < totalDraws, 'Preparation did not amortize any paint/fence boundary');
      // A newly constructed actor has fresh materials. Test first use at every
      // light count, including unlit custom shaders, rather than reuse only.
      const programCount = renderer.info.programs.length;
      const extraLights = [];
      for (let count = 0; count <= 21; count++) {
        if (count > 1) { const extra = new THREE.PointLight(0xffffff, 0); scene.add(extra); extraLights.push(extra); }
        const fresh = createWeaponAssembly('ar'), freshMuzzle = createWeaponMuzzleEffect(fresh);
        scene.add(fresh.root);
        if (count > 0) { freshMuzzle.trigger(); freshMuzzle.update(.01); }
        let visibleMuzzleLights = 0;
        scene.traverseVisible(object => { if (object instanceof THREE.PointLight) visibleMuzzleLights++; });
        check(visibleMuzzleLights === count, 'Fixture light count changed unexpectedly');
        renderer.setRenderTarget(null);
        // Gameplay scene resources are rendered through the linear composer.
        effects.render(0, 'area51'); await waitForGpu(renderer, new AbortController().signal);
        check(renderer.info.programs.length === programCount, `New first-use program at extra light count ${count}`);
        disposeBotVisuals(fresh.root);
      }
      extraLights.forEach(extra => { extra.removeFromParent(); extra.dispose(); });
      // Resize later, while the 1-pixel combat viewport is active.
      renderer.setSize(160, 100); effects.resize(160, 100); resized = false;
      await effects.prepare(new DeploymentPipeline(name => progress(name, 'Combat lighting draws')), 'area51', 2);
      restored(); const cornersAfterCombatResize = await fullViewport();
      renderer.setSize(160, 100); effects.resize(160, 100); resized = false;
      let combatStages = 0;
      const cancel = new DeploymentPipeline(name => {
        progress(name, 'Combat lighting draws');
        if (name === 'Combat lighting draws' && ++combatStages === 2) cancel.cancel();
      });
      let canceled = false;
      try { await effects.prepare(cancel, 'area51', 2); } catch (error) { canceled = error.name === 'AbortError'; }
      check(canceled, 'Preparation did not cancel'); restored(); const cornersAfterCancelResize = await fullViewport();
      check(gl.getError() === gl.NO_ERROR, 'WebGL error during preparation');
      return { glRenderer, fixtureMs: performance.now() - start, lightVariants: 22, totalDraws,
        batchCount: batchSizes.length, maxBatchDraws: Math.max(...batchSizes), programCount,
        cornersAfterUploadResize, cornersAfterCombatResize, cornersAfterCancelResize,
        passed: ['fresh muzzle/particle first-use keys at every light count', 'upload resize', 'combat resize', 'resize then cancellation', 'state restoration', 'full-frame pixels', 'bounded batches'] };
    } finally {
      muzzle.reset(); effects.dispose(); disposeBotVisuals(assembly.root);
      backdrop.geometry.dispose(); backdrop.material.dispose();
      mesh.geometry.dispose(); mesh.material.dispose(); light.dispose(); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    }
  });
  assert.deepEqual(errors, []);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ browser: browser.version(), fixture: 'tiny synthetic scene; not full-map or native-device timing', results, errors }, null, 2) + '\n');
  console.log('PASS:', JSON.stringify(results));
} finally { clearTimeout(deadline); await browser?.close(); await server.close(); }
