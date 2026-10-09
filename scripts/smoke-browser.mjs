import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve(process.env.SMOKE_OUTPUT ?? 'performance-results/smoke');
mkdirSync(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 3090 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true,
  ...(process.env.BENCHMARK_BROWSER ? { executablePath: process.env.BENCHMARK_BROWSER } : {}),
  args: process.env.BENCHMARK_SINGLE_PROCESS === '1' ? ['--no-sandbox', '--single-process', '--no-zygote', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
page.setDefaultTimeout(120000);
const errors = [], results = [];
page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
try {
  await page.goto('http://127.0.0.1:3090');
  await page.getByRole('button', { name: 'DEPLOY OPERATION', exact: true }).waitFor();
  // Cancel an actual deployment before any gameplay can run.
  await page.getByRole('button', { name: 'DEPLOY OPERATION', exact: true }).click();
  await page.getByRole('status').waitFor();
  await page.getByRole('button', { name: 'RETURN TO LOBBY', exact: true }).click();
  await page.getByRole('button', { name: 'DEPLOY OPERATION', exact: true }).waitFor();
  assert.equal(await page.getByRole('status').count(), 0);
  console.log('PASS: loading cancellation returns to a fresh lobby');
  for (const map of ['training', 'area51', 'shattered_wall']) for (const faction of ['usmc', 'apex']) {
    await page.getByRole('button', { name: '[ GAME MODE ]', exact: true }).click();
    await page.getByRole('button', { name: faction === 'usmc' ? 'USMC' : 'APEX MERCENARIES', exact: true }).click();
    await page.getByRole('button', { name: map === 'training' ? 'Select TEAM DEATHMATCH' : 'Select EXTRACTION', exact: true }).click();
    const mapButton = map === 'training' ? /OUTDOOR ARENA TRAINING FIELD/ : map === 'area51' ? /SUBTERRANEAN AREA 51 SUBTERRANEAN FACILITY/ : /PACIFIC RIM.*SHATTERED WALL/;
    await page.getByRole('button', { name: mapButton }).click();
    await page.keyboard.press('F3');
    const start = Date.now();
    await page.getByRole('button', { name: 'DEPLOY SELECTED SCENARIO', exact: true }).click();
    await page.getByRole('status').waitFor();
    await page.getByRole('button', { name: /PAUSE/ }).first().waitFor();
    await page.waitForTimeout(1200);
    const diagnostic = await page.locator('[data-engine-profiler]').innerText();
    assert.ok(diagnostic.includes(`DEPLOY ${map}`));
    assert.ok(!await page.getByRole('alert').count());
    await page.screenshot({ path: resolve(output, `${map}-${faction}.png`) });
    await page.keyboard.press('2'); await page.keyboard.press('1');
    await page.keyboard.press('p');
    await page.locator('#btn-resume').click();
    await page.keyboard.press('p');
    await page.locator('#btn-to-lobby-pause').click();
    await page.getByRole('button', { name: 'DEPLOY OPERATION', exact: true }).waitFor();
    results.push({ map, faction, smokeFlowMs: Date.now() - start, diagnostic });
    console.log(`PASS: ${map}/${faction} deploy, weapon switch, pause/resume, lobby`);
    writeFileSync(resolve(output, 'results.json'), JSON.stringify({ browser: browser.version(), viewport: { width: 960, height: 540 }, errors, results }, null, 2) + '\n');
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); await server.close(); }
