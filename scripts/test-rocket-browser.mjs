import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = resolve(process.env.ROCKET_OUTPUT ?? 'work/rocket-evidence');
const frames = resolve(output, 'frames');
mkdirSync(frames, { recursive: true });
const errors = [];
const fps = 24;
const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: Number(process.env.ROCKET_PORT ?? 3185), strictPort: true, hmr: false },
  plugins: [{
    name: 'rocket-browser-fixture',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/WeaponStudio.tsx')) {
        const marker = '      controls.update();';
        assert.ok(code.includes(marker));
        return code.replace(marker, `
          const studioPhase = launcherReload?.reloadSequence;
          window.__rocketStudio = {
            selected: currentWeaponId,
            phase: studioPhase?.phases[studioPhase.index].phase,
            progress: studioPhase ? studioPhase.elapsed / studioPhase.phases[studioPhase.index].duration : 0,
            cassette: assembly.parts.reloadRound?.visible,
          };
        ` + marker);
      }
      if (!id.endsWith('/src/App.tsx')) return;
      const marker = '    // Main Game Loop';
      assert.ok(code.includes(marker));
      return `import { activeProjectiles as fixtureProjectiles } from './gameLoop';\n` + code
        .replace(marker, `
          window.__rocket = {
            hold: false, stepping: false,
            get ready() { return gameStateRef.current === 'playing'; },
            equip() {
              clearGameplayInput();
              const launcher = WEAPONS.find(w => w.id === 'rocket');
              playerLoadout[0] = launcher;
              playerWeaponState[0] = { ammo: launcher.mag, reserve: launcher.reserve };
              switchSlot(0);
              player.classReloadMultiplier = 1;
              player.health = player.maxHealth = 100000;
              player.yaw = player.pitch = 0;
              vmManager.resetEffects();
              renderer.setPixelRatio(1);
              renderer.setSize(640, 360, false);
              effects.resize(640, 360);
              window.__rocketNow = performance.now();
              this.hold = true;
            },
            step() {
              window.__rocketNow += 1000 / 120;
              this.stepping = true;
              animate();
              this.stepping = false;
            },
            snapshot() {
              const slot = currentSlotState();
              const model = vmManager.root.getObjectByName('Weapon_rocket');
              const phase = slot.reloadSequence?.phases[slot.reloadSequence.index];
              return {
                ammo: slot.ammo, reserve: slot.reserve, shots: player.shotsFired, slot: player.slotIndex,
                phase: phase?.phase, phaseDuration: phase?.duration, progress: phase ? slot.reloadSequence.elapsed / phase.duration : 0,
                sprinting: player.sprinting, moving: Math.hypot(player.vel.x, player.vel.z) > 1,
                aiming: player.aiming, hatch: model.getObjectByName('rocketHatch').rotation.z,
                cassette: model.getObjectByName('reloadRound').visible,
                rocketCount: fixtureProjectiles.filter(p => p.ownerIsPlayer && p.kind === 'ROCKET').length,
                impact: !!scene.getObjectByName('Rocket impact pressure ring'),
              };
            },
            capture() {
              effects.render(0, selectedMapStateRef.current);
              return renderer.domElement.toDataURL('image/jpeg', .92).split(',')[1];
            },
          };
        ` + marker)
        .replace('      animId = requestAnimationFrame(animate);', '      if (!window.__rocket.stepping) animId = requestAnimationFrame(animate);')
        .replace('      const dt = Math.min(0.05, clock.getDelta());', `
          if (window.__rocket.hold && !window.__rocket.stepping) return;
          const dt = window.__rocket.stepping ? 1 / 120 : Math.min(.05, clock.getDelta());
        `)
        .replace('else effects.render(dt, selectedMapStateRef.current);', 'else if (!window.__rocket.hold) effects.render(dt, selectedMapStateRef.current);');
    },
  }],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.setDefaultTimeout(240000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /WebGL|Shader|GL_INVALID|THREE/.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(() => {
    const now = performance.now.bind(performance);
    performance.now = () => window.__rocketNow ?? now();
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(Error('embedded input fixture'));
    let seed = 204;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.goto(`http://127.0.0.1:${server.config.server.port}`);
  if (!process.env.ROCKET_SKIP_ARMORY) {
    await page.getByRole('button', { name: '[ WEAPONS ]', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect RPG-7', exact: true }).click();
    const studio = page.getByLabel('3D weapon spotlight viewport');
    await studio.getByRole('button', { name: 'TEST RELOAD' }).waitFor();
    await page.waitForFunction(() => window.__rocketStudio?.selected === 'rocket');
    await studio.screenshot({ path: resolve(output, 'armory.jpg'), type: 'jpeg', quality: 94 });
    await studio.getByRole('button', { name: 'TEST RELOAD' }).click();
    await page.waitForFunction(() => window.__rocketStudio?.phase === 'insert' && window.__rocketStudio.progress >= .57 && window.__rocketStudio.cassette);
    await studio.screenshot({ path: resolve(output, 'armory-reload.jpg'), type: 'jpeg', quality: 94 });
    console.log('PASS: Armory launcher model and reload control');
  }
  if (!process.env.ROCKET_ARMORY_ONLY) await recordGameplay();

  async function recordGameplay() {
    await page.getByRole('button', { name: '[ PLAY ]', exact: true }).click();
    await page.getByRole('button', { name: 'BATTALION', exact: true }).click();
    await page.getByRole('slider', { name: 'Battalion size' }).press('Home');
    await page.getByRole('button', { name: '[ GAME MODE ]', exact: true }).click();
    await page.getByRole('button', { name: 'USMC', exact: true }).click();
    await page.getByRole('button', { name: 'Select TEAM DEATHMATCH', exact: true }).click();
    await page.getByRole('button', { name: /AREA 51 SUBTERRANEAN FACILITY/ }).click();
    await page.locator('input[type="range"][min="1"][max="20"]').press('Home');
    await page.getByRole('button', { name: 'DEPLOY SELECTED SCENARIO', exact: true }).click();
    await page.waitForFunction(() => window.__rocket?.ready);
    await page.evaluate(() => { window.__rocket.equip(); for (let n = 0; n < 120; n++) window.__rocket.step(); });
    console.log('Area 51 loaded');

    let index = 0;
    const samples = {};
    async function record(seconds, label) {
      const frameCount = Math.round(seconds * fps);
      for (let frame = 0; frame < frameCount; frame++) {
        const { state, image } = await page.evaluate(() => {
          const test = window.__rocket;
          for (let n = 0; n < 5; n++) test.step();
          return { state: test.snapshot(), image: test.capture() };
        });
        const bytes = Buffer.from(image, 'base64');
        writeFileSync(resolve(frames, String(index++).padStart(4, '0') + '.jpg'), bytes);
        const name = label && frame === frameCount - 1 ? label
          : state.impact && !samples.impact ? 'impact'
          : state.rocketCount && !samples.discharge ? 'discharge'
          : state.rocketCount && index > samples.discharge?.frame + 4 && !samples.flight ? 'flight'
          : state.phase === 'open' && state.hatch < -1.5 && !samples.access ? 'access'
          : state.phase === 'insert' && state.cassette && state.progress > .43 && !samples.transfer ? 'transfer'
          : state.phase === 'insert' && state.progress > .86 && !samples.seating ? 'seating'
          : state.phase === 'close' && state.hatch > -1.5 && !samples.closure ? 'closure' : '';
        if (name) {
          samples[name] = { frame: index - 1, ...state };
          writeFileSync(resolve(output, name + '.jpg'), bytes);
          console.log('Captured ' + name);
        }
      }
    }

    await record(.38, 'idle');
    await page.keyboard.down('KeyW');
    await record(.55, 'walk');
    await page.keyboard.down('ShiftLeft');
    await record(.60, 'sprint');
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    await record(.55);
    await page.mouse.down({ button: 'right' });
    await record(.40, 'ads');
    await page.mouse.up({ button: 'right' });
    await record(.30);
    await page.mouse.click(500, 230);
    await record(.92);
    await page.keyboard.press('KeyR');
    await record(4.45, 'ready');
    assert.ok(samples.walk.moving && samples.sprint.sprinting && samples.ads.aiming);
    for (const phase of ['discharge', 'flight', 'impact', 'access', 'transfer', 'seating', 'closure']) assert.ok(samples[phase], phase);
    assert.equal(samples.discharge.shots - samples.idle.shots, 1);
    assert.equal(samples.discharge.ammo, 0);
    assert.equal(samples.ready.ammo, 1);
    assert.equal(samples.ready.reserve, 5);
    assert.equal(samples.ready.phase, undefined);
    const advance = async (frames) => page.evaluate(n => {
      for (let i = 0; i < n; i++) window.__rocket.step();
      return window.__rocket.snapshot();
    }, frames);
    await page.mouse.click(500, 230);
    assert.equal((await advance(100)).ammo, 0);
    await page.keyboard.press('KeyR');
    const opening = await advance(60);
    assert.equal(opening.phase, 'open');
    await page.keyboard.press('KeyP');
    await page.waitForFunction(() => !window.__rocket.ready);
    const paused = await advance(60);
    assert.equal(paused.phase, opening.phase);
    assert.equal(paused.progress, opening.progress);
    assert.equal(paused.hatch, opening.hatch);
    await page.keyboard.press('KeyP');
    await page.waitForFunction(() => window.__rocket.ready);
    await page.keyboard.press('Digit2');
    assert.equal((await advance(10)).slot, 1);
    await page.keyboard.press('Digit1');
    const returned = await advance(25);
    assert.equal(returned.slot, 0);
    assert.equal(returned.phase, undefined);
    assert.equal(returned.ammo, 0);
    assert.equal(returned.reserve, 5);
    assert.equal(returned.hatch, 0);
    assert.equal(returned.cassette, false);
    assert.deepEqual(errors, []);
    // Mix the two shipped clips at the captured launch and cover-lock timestamps.
    const toMs = seconds => Math.round(seconds * 1000);
    const shotMs = toMs(samples.discharge.frame / fps);
    const lockMs = toMs(samples.closure.frame / fps + (.65 - samples.closure.progress) * samples.closure.phaseDuration);
    const mix = `[1:a]volume=.8,adelay=${shotMs}:all=1[shot];[2:a]volume=.82,adelay=${lockMs}:all=1[lock];[shot][lock]amix=inputs=2:duration=longest:normalize=0,apad[audio]`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', resolve(frames, '%04d.jpg'),
      '-i', 'src/assets/audio/weapons/batch1/shotgun_fire_single.wav',
      '-i', 'src/assets/audio/weapons/lmg-fidelity/lmg_feed_cover_close.wav',
      '-filter_complex', mix, '-map', '0:v', '-map', '[audio]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', resolve(output, 'area51.mp4')]);
    writeFileSync(resolve(output, 'validation.json'), JSON.stringify({ fps, samples, pauseAndSwitchPassed: true, errors }, null, 2));
    console.log('PASS: actual Area 51 launcher input, flight, collision, full reload and recovery');
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}
