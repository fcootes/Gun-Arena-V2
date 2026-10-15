import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve(process.env.VIEWMODEL_OUTPUT ?? 'performance-results/viewmodel');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'results.json'), { force: true });
const port = Number(process.env.VIEWMODEL_PORT ?? 3098);
const origin = `http://127.0.0.1:${port}`;
const startedAt = new Date().toISOString();
const baseline = process.env.VIEWMODEL_BASELINE === '1';
const server = await createServer({ root: process.env.VIEWMODEL_ROOT, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{
  name: 'viewmodel-fixture', configureServer(server) {
    server.middlewares.use('/__viewmodel', (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html><head><style>body{margin:0;background:#111a22}canvas{display:block}</style></head><body></body></html>');
    });
  },
  resolveId(id) { if (id === 'viewmodel-fixture' || id === '\0viewmodel-fixture') return '\0viewmodel-fixture'; },
  load(id) {
    if (id === '\0viewmodel-fixture') return `export * as THREE from 'three'; export {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';`;
  },
  enforce: 'pre', transform(code, id) {
    if (!id.endsWith('/src/App.tsx')) return;
    const needle = '    // Main Game Loop'; assert.equal(code.split(needle).length, 2);
    return code.replace(needle, `
      window.__handsGame = {
        get state() { return gameStateRef.current; }, get manager() { return vmManager; },
        get renderer() { return renderer; }, get camera() { return camera; }, get player() { return player; },
        get thirdPerson() { return thirdPerson; }, get weapon() { return currentSlot(); }, get weaponState() { return currentSlotState(); },
        equip(id) {
          const w = WEAPONS.find(w => w.id === id);
          playerLoadout[0] = w; playerWeaponState[0] = { ammo: w.mag, reserve: w.reserve, heat: 60 };
          switchSlot(0); player.aiming = false;
        },
        settlePose(aiming = false, sprinting = false) {
          // Software WebGL advances very few live frames during wall-clock waits.
          // Settle presentation only; ammo, reload, input and world state are untouched.
          for (let i = 0; i < 90; i++) vmManager.update(1 / 60, currentSlot(), currentSlotState(), aiming, sprinting, player.onGround, sprinting, false, false, 0, true, true);
          camera.fov = aiming ? currentSlot().adsFov : HIP_FOV; camera.updateProjectionMatrix();
        },
        kill() { applyDamageToPlayer(999999, true, true, null); }
      };
      // Main Game Loop`);
  },
}] });
let browser;
const deadline = setTimeout(() => { console.error('FAIL: viewmodel browser exceeded 480 seconds'); void browser?.close(); void server.close(); process.exitCode = 1; }, 480000);
const errors = [], results = [], gameplay = [];
try {
  await server.listen();
  browser = await chromium.launch({ headless: true,
    ...(process.env.BENCHMARK_BROWSER ? { executablePath: process.env.BENCHMARK_BROWSER } : {}),
    args: process.env.BENCHMARK_SINGLE_PROCESS === '1' ? ['--no-sandbox', '--single-process', '--no-zygote', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/__viewmodel`);
  await page.evaluate(async () => {
    const { THREE, RoomEnvironment } = await import('/@id/__x00__viewmodel-fixture');
    const { createViewmodelManager, WEAPONS } = await import('/src/weapons.ts');
    const { beginWeaponReload, advanceWeaponReload } = await import('/src/weaponReload.ts');
    const { disposeBotVisuals } = await import('/src/botBuilder.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1280, 720); renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x18232d);
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; scene.environmentIntensity = .45;
    room.dispose(); pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(74, 1280 / 720, .05, 100); scene.add(camera);
    scene.add(new THREE.HemisphereLight(0xddeaff, 0x3f4140, 2.2));
    const key = new THREE.DirectionalLight(0xffe6ce, 3); key.position.set(-2, 3, 2); scene.add(key);
    const fill = new THREE.DirectionalLight(0x89bde0, 1.2); fill.position.set(2, 1, -2); scene.add(fill);
    const manager = createViewmodelManager(); manager.prepare(WEAPONS.filter(w => w.type === 'weapon').map(w => w.id)); camera.add(manager.root);
    const state = { id: 'ar', ws: { ammo: 20, reserve: 100 }, aiming: false, sprinting: false, moving: false };
    const frame = (dt = 1 / 60, draw = true) => {
      const weapon = WEAPONS.find(w => w.id === state.id);
      manager.update(dt, weapon, state.ws, state.aiming, state.sprinting, true, state.moving, false, false, 0, true, true);
      camera.fov = state.aiming ? weapon.adsFov : 74; camera.updateProjectionMatrix();
      if (draw) renderer.render(scene, camera);
    };
    const point = new THREE.Vector3(), instance = new THREE.Matrix4(), transform = new THREE.Matrix4();
    const ray = new THREE.Raycaster();
    const validateHands = () => {
      const hands = manager.root.getObjectByName('FirstPersonHands');
      if (!hands?.visible) return { visible: false };
      scene.updateMatrixWorld(true); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      let nearestZ = -Infinity;
      const meshes = [];
      hands.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        meshes.push(object);
        const positions = object.geometry.attributes.position;
        if (object.isInstancedMesh) object.computeBoundingSphere();
        for (let i = 0; i < (object.isInstancedMesh ? object.count : 1); i++) {
          if (object.isInstancedMesh) { object.getMatrixAt(i, instance); transform.multiplyMatrices(object.matrixWorld, instance); }
          else transform.copy(object.matrixWorld);
          transform.premultiply(camera.matrixWorldInverse);
          for (let vertex = 0; vertex < positions.count; vertex++) nearestZ = Math.max(nearestZ, point.fromBufferAttribute(positions, vertex).applyMatrix4(transform).z);
        }
      });
      if (nearestZ >= -camera.near) throw new Error(`Hands cross the near plane: z=${nearestZ}, near=${camera.near}`);
      ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      const centralHits = ray.intersectObjects(meshes, false).length;
      if (state.aiming && centralHits) throw new Error('A hand obscures the centre sight ray');
      return { visible: true, nearestZ, centralHits };
    };
    window.fixture = { THREE, renderer, scene, camera, manager, state, frame, WEAPONS, beginWeaponReload, advanceWeaponReload, validateHands,
      snapshot() { const info = renderer.info; return { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, programs: info.programs.length }; },
      dispose() { disposeBotVisuals(manager.root); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
    };
  });
  const modelIds = baseline ? ['ar', 'pistol'] : ['ar', 'pistol', 'sniper', 'br', 'minigun', 'shotgun', 'smg', 'lmg', 'laser', 'railgun', 'rocket', 'grenade_launcher'];
  for (const id of modelIds) {
    const result = await page.evaluate(id => {
      const f = window.fixture; f.state.id = id; f.state.aiming = f.state.sprinting = false;
      for (let i = 0; i < 40; i++) f.frame(1 / 60, false);
      f.renderer.render(f.scene, f.camera);
      return { id, ...f.snapshot(), hands: f.validateHands() };
    }, id);
    await page.screenshot({ path: resolve(output, `${id}-hip.png`) });
    results.push(result);
    console.log('CHECK: held configuration', id);
  }
  const checks = [];
  if (!baseline) {
    for (const faction of ['usmc', 'apex']) for (const id of ['ar', 'pistol']) {
      await page.evaluate(({ faction, id }) => {
        const f = window.fixture; f.manager.setFaction(faction); f.state.id = id;
        f.state.aiming = f.state.sprinting = false; f.state.ws = { ammo: 0, reserve: 100 };
        f.manager.resetEffects(); for (let i = 0; i < 40; i++) f.frame(1 / 60, false);
        f.renderer.render(f.scene, f.camera);
      }, { faction, id });
      await page.screenshot({ path: resolve(output, `${faction}-${id}-hip.png`) });
      await page.evaluate(() => window.fixture.validateHands());
      await page.evaluate(() => { const f = window.fixture; f.state.aiming = true; for (let i = 0; i < 60; i++) f.frame(1 / 60, false); f.renderer.render(f.scene, f.camera); });
      await page.screenshot({ path: resolve(output, `${faction}-${id}-ads.png`) });
      await page.evaluate(() => window.fixture.validateHands());
      await page.evaluate(() => {
        const f = window.fixture; f.state.aiming = false;
        const w = f.WEAPONS.find(w => w.id === f.state.id);
        if (!f.beginWeaponReload(w, f.state.ws)) throw new Error('Reload fixture did not start');
        for (let i = 0; i < 60; i++) { f.advanceWeaponReload(w, f.state.ws, 1 / 60); f.frame(1 / 60, false); }
        f.renderer.render(f.scene, f.camera);
      });
      await page.screenshot({ path: resolve(output, `${faction}-${id}-reload.png`) });
      await page.evaluate(() => window.fixture.validateHands());
      await page.evaluate(() => { const f = window.fixture; f.state.ws = {}; f.state.sprinting = true; for (let i = 0; i < 60; i++) f.frame(1 / 60, false); f.renderer.render(f.scene, f.camera); });
      await page.screenshot({ path: resolve(output, `${faction}-${id}-sprint.png`) });
      await page.evaluate(() => window.fixture.validateHands());
      console.log('CHECK: faction pose captures', faction, id);
    }
    // A held close-up is a test-only camera, not a change to the armory.
    await page.evaluate(() => {
      const f = window.fixture; f.state.id = 'ar'; f.state.sprinting = f.state.aiming = false; f.manager.setFaction('usmc');
      for (let i = 0; i < 60; i++) f.frame(1 / 60, false);
      f.scene.attach(f.manager.root); f.camera.position.set(.52, -.20, -.74); f.camera.lookAt(.17, -.23, -.39);
      f.camera.fov = 44; f.camera.updateProjectionMatrix(); f.renderer.render(f.scene, f.camera);
    });
    await page.screenshot({ path: resolve(output, 'ar-grip-closeup.png') });
    await page.evaluate(() => { const f = window.fixture; f.camera.position.set(0, 0, 0); f.camera.quaternion.identity(); f.camera.add(f.manager.root); });
    for (const [width, height] of [[960, 720], [1680, 720]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(({ width, height }) => { const f = window.fixture; f.renderer.setSize(width, height); f.camera.aspect = width / height; f.frame(); }, { width, height });
      await page.screenshot({ path: resolve(output, `ar-${width}x${height}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    checks.push('12 held configurations; both faction palettes; AR/pistol hip, ADS, reload and sprint; close-up; 4:3 and 21:9');
  }
  const timing = await page.evaluate(() => {
    const f = window.fixture; f.state.id = 'ar'; f.state.ws = {}; f.state.aiming = f.state.sprinting = false;
    const samples = [];
    for (let i = 0; i < 240; i++) {
      const start = performance.now();
      f.manager.update(1 / 60, f.WEAPONS[0], f.state.ws, false, false, true, true, false, false, 0, true, true);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return { medianUpdateMs: samples[120], p95UpdateMs: samples[228], maxUpdateMs: samples[239], note: 'CPU pose update only; no GPU/FPS claim' };
  });
  if (!baseline && process.env.VIEWMODEL_SKIP_GAME !== '1') {
    await page.evaluate(() => window.fixture.dispose());
    await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('sandbox fixture')); });
    for (const faction of ['usmc', 'apex']) {
      await page.goto(origin);
      await page.getByRole('button', { name: 'BATTALION', exact: true }).click();
      await page.getByRole('slider', { name: 'Battalion size' }).press('Home');
      await page.getByRole('button', { name: '[ GAME MODE ]', exact: true }).click();
      await page.getByRole('button', { name: faction === 'usmc' ? 'USMC' : 'APEX MERCENARIES', exact: true }).click();
      await page.getByRole('button', { name: 'Select TEAM DEATHMATCH', exact: true }).click();
      await page.getByRole('button', { name: /OUTDOOR ARENA TRAINING FIELD/ }).click();
      await page.locator('input[type="range"][min="1"][max="20"]').press('Home');
      await page.getByRole('button', { name: 'DEPLOY SELECTED SCENARIO', exact: true }).click();
      await page.waitForFunction(() => window.__handsGame?.state === 'playing', null, { timeout: 60000 });
      await page.waitForTimeout(400);
      const knownPrograms = await page.evaluate(() => window.__handsGame.renderer.info.programs.map(p => p.cacheKey));
      await page.screenshot({ path: resolve(output, `game-${faction}-ar.png`) });
      await page.mouse.move(600, 340); await page.mouse.down({ button: 'right' });
      await page.waitForFunction(() => window.__handsGame.player.aiming);
      await page.mouse.down(); await page.mouse.up(); await page.mouse.up({ button: 'right' });
      await page.keyboard.press('r'); await page.waitForFunction(() => window.__handsGame.weaponState.reloading);
      await page.waitForTimeout(500);
      await page.screenshot({ path: resolve(output, `game-${faction}-reload.png`) });
      await page.keyboard.press('p');
      const paused = await page.evaluate(() => window.__handsGame.manager.root.getObjectByName('leftHand').position.toArray());
      await page.waitForTimeout(120);
      assert.deepEqual(await page.evaluate(() => window.__handsGame.manager.root.getObjectByName('leftHand').position.toArray()), paused);
      await page.locator('#btn-resume').click();
      await page.waitForFunction(() => !window.__handsGame.weaponState.reloading);
      await page.keyboard.press('2');
      await page.waitForFunction(() => window.__handsGame.weapon.id === 'pistol'); await page.waitForTimeout(300);
      await page.screenshot({ path: resolve(output, `game-${faction}-pistol.png`) });
      assert.deepEqual(await page.evaluate(known => window.__handsGame.renderer.info.programs.filter(p => !known.includes(p.cacheKey)).map(p => p.cacheKey), knownPrograms), [], 'Prepared first-person fire/reload/switch must not add shader programs');
      await page.keyboard.press('v'); assert.equal(await page.evaluate(() => window.__handsGame.thirdPerson), true);
      await page.keyboard.press('v'); assert.equal(await page.evaluate(() => window.__handsGame.thirdPerson), false);
      // The same field-armory replacement path as gameplay, injected only in this test server.
      for (const id of modelIds) {
        await page.evaluate(id => window.__handsGame.equip(id), id);
        await page.waitForTimeout(450);
        await page.evaluate(() => { window.__handsGame.settlePose(); });
        await page.screenshot({ path: resolve(output, `game-${faction}-${id}-idle.png`) });
        gameplay.push(await page.evaluate(({faction, id}) => {
          const g = window.__handsGame, i = g.renderer.info;
          return {faction, id, pose:'idle', fov:g.camera.fov, calls:i.render.calls, triangles:i.render.triangles, geometries:i.memory.geometries};
        }, {faction,id}));
        await page.mouse.down({ button: 'right' });
        await page.waitForFunction(() => window.__handsGame.player.aiming);
        await page.waitForTimeout(450);
        await page.evaluate(() => { window.__handsGame.settlePose(true); });
        await page.screenshot({ path: resolve(output, `game-${faction}-${id}-aim.png`) });
        await page.mouse.up({ button: 'right' });
        if (id === 'shotgun') {
          const ammo = await page.evaluate(() => window.__handsGame.weaponState.ammo);
          await page.mouse.click(600, 340);
          await page.waitForFunction(ammo => window.__handsGame.weaponState.ammo === ammo - 1, ammo);
        }
        await page.keyboard.down('w'); await page.keyboard.down('Shift');
        await page.waitForTimeout(400);
        await page.evaluate(() => window.__handsGame.settlePose(false, true));
        if (['ar', 'shotgun', 'minigun'].includes(id)) await page.screenshot({ path: resolve(output, `game-${faction}-${id}-sprint.png`) });
        await page.keyboard.up('Shift'); await page.keyboard.up('w');
        if (['ar', 'shotgun', 'lmg', 'minigun'].includes(id)) {
          await page.evaluate(() => { const s = window.__handsGame.weaponState; s.ammo = 0; s.heat = 80; });
          await page.keyboard.press('r');
          await page.waitForFunction(() => window.__handsGame.weaponState.reloading);
          await page.waitForTimeout(650);
          await page.screenshot({ path: resolve(output, `game-${faction}-${id}-reload-pose.png`) });
          await page.keyboard.press('p'); await page.locator('#btn-resume').click();
        }
      }
      checks.push(`${faction}: actual field-armory all twelve idle/ADS captures and four reload poses`);
      await page.evaluate(() => window.__handsGame.kill());
      await page.getByRole('button', { name: '[ PLAY AGAIN ]', exact: true }).click();
      await page.waitForFunction(() => window.__handsGame.state === 'playing', null, { timeout: 60000 });
      assert.equal(await page.evaluate(() => { let count = 0; window.__handsGame.manager.root.traverse(o => { if (o.name === 'FirstPersonHands') count++; }); return count; }), 1);
      await page.keyboard.press('p'); await page.locator('#btn-to-lobby-pause').click();
      await page.getByRole('button', { name: 'DEPLOY OPERATION', exact: true }).waitFor();
      checks.push(`${faction}: actual Training preparation/fire/ADS/reload/pause/pistol/perspective/death/replay/lobby; one rig; no first-use program additions`);
      console.log('PASS: actual viewmodel lifecycle', faction);
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ startedAt, browser: browser.version(), viewport: '1280x720', results, gameplay, timing, checks, errors }, null, 2) + '\n');
  await page.evaluate(() => window.fixture?.dispose());
  console.log('PASS: held viewmodel browser captures', results);
} finally { clearTimeout(deadline); await browser?.close(); await server.close(); }
