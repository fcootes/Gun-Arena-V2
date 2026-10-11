import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

// Instrument only the development server. No debug accessors enter the build.
const root = resolve(process.argv[2] ?? '.');
const output = resolve(process.argv[3] ?? 'performance-results/first-use.json');
mkdirSync(dirname(output), { recursive: true });
function replaceOnce(code, needle, replacement) {
  assert.equal(code.split(needle).length, 2, `Profiling insertion must match once: ${needle}`);
  return code.replace(needle, replacement);
}
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 3094, strictPort: true }, plugins: [{
  name: 'first-use-profile', enforce: 'pre', transform(code, id) {
    if (!id.endsWith('/src/App.tsx')) return;
    if (process.env.PROFILE_SCOPE === '1') code = replaceOnce(code,
      "const [selectedSecondary, setSelectedSecondary] = useState<string>('pistol');",
      "const [selectedSecondary, setSelectedSecondary] = useState<string>('sniper');");
    code = replaceOnce(code, 'async function runDeployment() {', `
      window.__probe = {
        get state() { return gameStateRef.current; }, get scene() { return scene; },
        get renderer() { return renderer; }, get player() { return player; },
        get world() { return world; }, get director() { return extractionDirector; },
        get bots() { return bots; }, keys, frames: [], operations: [], programEvents: [], knownPrograms: new Set(), phase: 'first frames', turn: false,
        failMission() { applyDamageToPlayer(999999, true, true, null); },
        get preparedCount() { return preparedMissionVisuals.length; },
      };
      async function runDeployment() {`);
    code = replaceOnce(code, 'const visuals = buildBotVisuals({\n        campaignEntity,',
      'const visualStart = performance.now(); const visuals = buildBotVisuals({\n        campaignEntity,');
    code = replaceOnce(code, 'const rootGroup = visuals.rootGroup;', `window.__probe?.operations.push({ name: 'bot construction', duration: performance.now() - visualStart, type: zType }); const rootGroup = visuals.rootGroup;`);
    code = replaceOnce(code, 'const renderStart = profiler.enabled', `if (window.__probe?.turn && gameStateRef.current === 'playing') { player.yaw += .8; player.aiming = !player.aiming; }
      if (window.__probe && gameStateRef.current === 'playing' && window.__probe.knownPrograms.size === 0)
        renderer.info.programs?.forEach(program => window.__probe.knownPrograms.add(program.cacheKey));
      const renderStart = profiler.enabled`);
    return replaceOnce(code, 'if (profiler.enabled) {\n        let activeBots', `window.__probe?.frames.push({ state: gameStateRef.current, phase: window.__probe.phase,
      time: frameStart, render: performance.now() - renderStart, simulation: renderStart - frameStart,
      programs: renderer.info.programs?.length, geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures, bots: bots.length });
      if (window.__probe && gameStateRef.current === 'playing') for (const program of renderer.info.programs ?? []) {
        if (!window.__probe.knownPrograms.has(program.cacheKey)) {
          window.__probe.programEvents.push({ phase: window.__probe.phase, cacheKey: program.cacheKey });
          window.__probe.knownPrograms.add(program.cacheKey);
        }
      }
      if (profiler.enabled) {\n        let activeBots`);
  },
}] });
let browser;
const results = [], cancellations = [], errors = [];
const save = () => writeFileSync(output, JSON.stringify({ browser: browser.version(), viewport: '640x360', renderer: 'see per-run GL renderer', results, cancellations, errors }, null, 2) + '\n');
try {
  await server.listen();
  browser = await chromium.launch({ headless: process.env.BENCHMARK_HEADED !== '1',
    ...(process.env.BENCHMARK_BROWSER ? { executablePath: process.env.BENCHMARK_BROWSER } : {}),
    args: process.env.BENCHMARK_SINGLE_PROCESS === '1' ? ['--no-sandbox', '--single-process', '--no-zygote', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver(list => window.__long.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ entryTypes: ['longtask'] });
  });
  await page.goto('http://127.0.0.1:3094');
  await page.getByRole('button', { name: 'DEPLOY OPERATION', exact: true }).waitFor();
  const select = async (map, faction) => {
    await page.getByRole('button', { name: '[ GAME MODE ]', exact: true }).click();
    await page.getByRole('button', { name: faction === 'usmc' ? 'USMC' : 'APEX MERCENARIES', exact: true }).click();
    await page.getByRole('button', { name: map === 'training' ? 'Select TEAM DEATHMATCH' : 'Select EXTRACTION', exact: true }).click();
    await page.getByRole('button', { name: map === 'training' ? /OUTDOOR ARENA TRAINING FIELD/ : map === 'area51' ? /SUBTERRANEAN AREA 51 SUBTERRANEAN FACILITY/ : /PACIFIC RIM.*SHATTERED WALL/ }).click();
  };
  const frames = async count => page.waitForFunction(n => window.__probe.frames.filter(f => f.state === 'playing').length >= n, count);
  const lobby = async () => {
    await page.keyboard.press('p'); await page.locator('#btn-to-lobby-pause').click();
    await page.getByRole('button', { name: 'DEPLOY OPERATION', exact: true }).waitFor();
  };
  if (process.env.PROFILE_CANCEL === '1') {
    for (const stage of ['Lighting programs', 'Geometry, textures and shadows', 'Combat lighting draws', 'First complete render']) {
      await select('shattered_wall', 'usmc');
      await page.getByRole('button', { name: 'DEPLOY SELECTED SCENARIO', exact: true }).click();
      // The completed-stage table ensures preparation actually began before cancel.
      await page.waitForFunction(async name => (await import('/src/performance.ts')).initialization.stages.some(s => s.name === name), stage);
      await page.evaluate(() => { window.__retired = window.__probe; });
      await page.getByRole('button', { name: 'RETURN TO LOBBY', exact: true }).click();
      await page.getByRole('button', { name: 'DEPLOY OPERATION', exact: true }).waitFor();
      await page.waitForFunction(() => window.__probe !== window.__retired && window.__retired.renderer.getContext().isContextLost());
      const retired = await page.evaluate(() => ({ preparedCount: window.__retired.preparedCount,
        sceneChildren: window.__retired.scene.children.length, contextLost: window.__retired.renderer.getContext().isContextLost(),
        stalePlayingFrames: window.__retired.frames.filter(f => f.state === 'playing').length,
      }));
      assert.deepEqual(retired, { preparedCount: 0, sceneChildren: 0, contextLost: true, stalePlayingFrames: 0 });
      cancellations.push({ stage, ...retired }); save(); console.log('PASS: cancellation after', stage);
    }
  }
  const maps = process.env.PROFILE_MAP ? [process.env.PROFILE_MAP] : ['area51', 'shattered_wall'];
  const factions = process.env.PROFILE_FACTION ? [process.env.PROFILE_FACTION] : ['usmc'];
  for (const map of maps) for (const faction of factions) {
    const cdp = await context.newCDPSession(page);
    if (process.env.PROFILE_TRACE === '1') await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,v8,disabled-by-default-v8.gc', transferMode: 'ReturnAsStream' });
    const runs = ['cold', ...(process.env.PROFILE_WARM === '1' ? ['warm'] : []), ...(process.env.PROFILE_REPLAY === '1' ? ['replay'] : [])];
    for (const run of runs) {
      let started;
      if (run !== 'replay') {
        await select(map, faction); await page.keyboard.press('F3');
        started = await page.evaluate(() => performance.now());
        await page.getByRole('button', { name: 'DEPLOY SELECTED SCENARIO', exact: true }).click();
      } else {
        await page.evaluate(() => { window.__probe.failMission(); window.__probe.frames.length = 0; window.__probe.operations.length = 0; window.__probe.phase = 'first frames'; });
        await page.locator('[data-post-death]').waitFor();
        started = await page.evaluate(() => performance.now());
        await page.getByRole('button', { name: '[ PLAY AGAIN ]', exact: true }).click();
      }
      await page.waitForFunction(() => window.__probe?.state === 'playing');
      const ready = await page.evaluate(() => performance.now());
      await frames(run === 'cold' ? 16 : await page.evaluate(() => window.__probe.frames.filter(f => f.state === 'playing').length + 16));
      const firstCount = await page.evaluate(() => window.__probe.frames.filter(f => f.state === 'playing').length);
      // Exercise the actual input/fire handler and ADS, rather than only compiling.
      await page.evaluate(() => { window.__probe.phase = 'turn ADS fire'; window.__probe.turn = true; });
      await page.locator('#viewport canvas').dispatchEvent('mousedown', { button: 0 });
      await frames(firstCount + 12);
      await page.dispatchEvent('body', 'mouseup', { button: 0 });
      await page.keyboard.press('2'); await frames(firstCount + 15);
      let scopeVisible = await page.locator('#scope-overlay').evaluate(el => getComputedStyle(el).display !== 'none');
      if (process.env.PROFILE_SCOPE === '1') {
        // Force an ADS frame after switching to the real scoped loadout slot.
        const scopedFrame = await page.evaluate(() => {
          window.__probe.turn = false; window.__probe.player.aiming = true;
          return window.__probe.frames.filter(f => f.state === 'playing').length;
        });
        await frames(scopedFrame + 3);
        assert.equal(await page.locator('#scope-overlay').evaluate(el => getComputedStyle(el).display !== 'none'), true);
        scopeVisible = true;
        await page.evaluate(() => { window.__probe.turn = true; });
      }
      await page.keyboard.press('1');
      if (map === 'area51' && process.env.PROFILE_ENCOUNTERS === '1') {
        await page.evaluate(() => {
          const p = window.__probe; p.phase = 'campaign actor first draws';
          // Invoke the real encounter builder without bypassing its model/stats path.
          for (const [zone, boss, index] of [[1, false, 0], [2, false, 1], [3, false, 1], [3, false, 2], [4, true, 0]]) {
            const start = performance.now(); const bot = p.director.spawnEnemy(zone, boss, index);
            bot.pos.copy(p.player.pos); bot.pos.y -= 1.7; bot.pos.z -= 5 + index;
            bot.group.position.copy(bot.pos);
            p.operations.push({ name: 'campaign actor first use', zone, boss, index, duration: performance.now() - start });
          }
        });
        await frames(firstCount + 34);
      }
      if (map === 'shattered_wall') {
        await page.evaluate(() => {
          const p = window.__probe; p.phase = 'signal and first wave';
          p.player.pos.copy(p.world.offshore.zones.signalBeacon.center); p.keys.KeyE = true;
          const start = performance.now(); p.director.update(.01, p.keys);
          p.operations.push({ name: 'signal activation', duration: performance.now() - start });
          p.player.pos.copy(p.world.offshore.zones.holdout.center);
          const wave = performance.now(); p.director.update(6, p.keys);
          p.operations.push({ name: 'first holdout wave', duration: performance.now() - wave });
        });
        await frames(firstCount + 26);
        await page.evaluate(() => {
          const p = window.__probe; p.phase = 'helicopter arrival'; p.world.offshore.holdoutRemaining = 12;
          const start = performance.now(); p.world.updateWorld(.016, 100, 'extraction');
          p.operations.push({ name: 'inbound helicopter', duration: performance.now() - start });
        });
        await frames(firstCount + 34);
      }
      await page.evaluate(() => { window.__probe.turn = false; });
      const data = await page.evaluate(async start => {
        const p = window.__probe, gl = p.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { frames: p.frames, operations: p.operations, programEvents: p.programEvents,
          programKeys: p.renderer.info.programs?.map(program => program.cacheKey), longTasks: window.__long.filter(t => t.start >= start),
          diagnostic: document.querySelector('[data-engine-profiler]')?.innerText,
          initialization: (await import('/src/performance.ts')).initialization.stages,
          glRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
      }, started);
      assert.equal(await page.getByRole('alert').count(), 0);
      if (process.env.PROFILE_ASSERT_STABLE === '1') assert.deepEqual(data.programEvents, [], 'Prepared gameplay must not create a new shader program in this scenario');
      results.push({ map, faction, run, scopedLoadout: process.env.PROFILE_SCOPE === '1', scopeVisible, started, ready, loadingMs: ready - started, ...data });
      save(); console.log(map, faction, run, 'loading ms', Math.round(ready - started), 'max CPU render ms', Math.max(...data.frames.filter(f => f.state === 'playing').map(f => f.render)));
      await page.screenshot({ path: output + `.${map}.${faction}.${run}.png` });
      if (runs[runs.indexOf(run) + 1] !== 'replay') await lobby();
    }
    if (process.env.PROFILE_TRACE === '1') {
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve)); await cdp.send('Tracing.end');
      const { stream } = await complete; let trace = '';
      for (;;) { const chunk = await cdp.send('IO.read', { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
      await cdp.send('IO.close', { handle: stream }); writeFileSync(output + `.${map}.${faction}.trace.json`, trace);
    }
    await cdp.detach();
  }
  assert.deepEqual(errors, []); save();
} finally { await browser?.close(); await server.close(); }
