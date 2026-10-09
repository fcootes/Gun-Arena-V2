import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2), argument = key => args[args.indexOf(key) + 1];
const output = args.includes('--output') ? resolve(argument('--output')) : resolve('performance-results');
const roots = args.includes('--baseline') ? [resolve(argument('--baseline')), process.cwd()] : [process.cwd()];
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.BENCHMARK_BROWSER ? { executablePath: process.env.BENCHMARK_BROWSER } : {}),
  args: process.env.BENCHMARK_SINGLE_PROCESS === '1' ? ['--no-sandbox', '--single-process', '--no-zygote', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const results = [];
try {
  for (const [version, root] of roots.entries()) {
    const server = await createServer({ root, server: { host: '127.0.0.1', port: 3080 + version }, logLevel: 'error' });
    await server.listen();
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    // An empty document eliminates unrelated lobby rendering and audio from construction timings.
    await page.route('**/benchmark.html', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#000"></body></html>' }));
    await page.goto(`http://127.0.0.1:${3080 + version}/benchmark.html`);
    const measurements = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { createWorld } = await import('/src/world.ts');
      const measurements = [];
      const originalRandom = Math.random;
      try {
        for (const map of ['training', 'area51', 'shattered_wall']) {
          for (let run = 0; run < 7; run++) {
            await new Promise(resolve => setTimeout(resolve, 0));
            let seed = 123456; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
            const scene = new THREE.Scene(), start = performance.now(), world = createWorld(scene, map);
            const constructionMs = performance.now() - start;
            const geometry = new Set(), materials = new Set(), textures = new Set();
            let meshes = 0, points = 0, lines = 0, triangles = 0;
            scene.updateMatrixWorld(true);
            const boxes = [], pixelImages = [];
            scene.traverse(object => {
              if (object.geometry) {
                geometry.add(object.geometry);
                if (object.isPoints) points++;
                if (object.isLine) lines++;
                if (object.isMesh) meshes++;
                if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) / 3 * (object.count ?? 1);
                // Compare transformed geometry, including children and authored attachment points.
                const bounds = object.isMesh ? new THREE.Box3().setFromObject(object) : null;
                if (bounds) boxes.push([object.name, ...bounds.min.toArray(), ...bounds.max.toArray()].map(v => typeof v === 'number' ? v : v));
              }
              for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
                materials.add(material);
                for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
              }
            });
            for (const texture of run === 0 ? textures : []) {
              const image = texture.image;
              if (!image?.getContext) continue;
              // Full Canvas data URLs preserve all pixels, including helipad text/detail.
              pixelImages.push({ width: image.width, height: image.height, data: image.toDataURL() });
            }
            const counts = { meshes, points, lines, triangles, geometries: geometry.size, materials: materials.size, textures: textures.size, navigationPoints: world.navigationPoints?.length, colliders: world.worldColliders.length };
            const navigationCoordinates = world.navigationPoints?.map(p => p.toArray()), colliderBounds = world.worldColliders.map(c => ({ ...c }));
            const cleanupStart = performance.now(); world.dispose();
            measurements.push({ map, run, constructionMs, cleanupMs: performance.now() - cleanupStart, ...counts,
              ...(run === 0 ? { boxes, pixelImages, navigationCoordinates, colliderBounds } : {}) });
          }
        }
      } finally { Math.random = originalRandom; }
      return measurements;
    });
    if (results.length) {
      const baseline = results[0].measurements;
      for (const row of measurements.filter(row => row.run === 0)) {
        const original = baseline.find(other => other.map === row.map && other.run === 0);
        let maxDelta = 0;
        if (original.boxes.length !== row.boxes.length) throw new Error('Mesh count changed');
        row.boxes.forEach((box, i) => box.forEach((value, j) => {
          if (typeof value === 'number') maxDelta = Math.max(maxDelta, Math.abs(value - original.boxes[i][j]));
          else if (value !== original.boxes[i][j]) throw new Error('Mesh order/name changed');
        }));
        row.maximumWorldBoundsDelta = maxDelta;
      }
    }
    // Store hashes instead of large pixel payloads; exact pixels were read above.
    for (const row of measurements) {
      if (row.navigationCoordinates) { row.navigationHash = createHash('sha256').update(JSON.stringify(row.navigationCoordinates)).digest('hex'); delete row.navigationCoordinates; }
      if (row.colliderBounds) { row.colliderHash = createHash('sha256').update(JSON.stringify(row.colliderBounds)).digest('hex'); delete row.colliderBounds; }
      if (row.boxes) { row.worldBoundsHash = createHash('sha256').update(JSON.stringify(row.boxes)).digest('hex');  }
      if (row.pixelImages) {
        row.pixelHashes = row.pixelImages.map(image => ({ width: image.width, height: image.height, sha256: createHash('sha256').update(image.data).digest('hex') }));
        delete row.pixelImages;
      }
    }
    const data = { label: roots.length === 2 && version === 0 ? 'baseline' : 'optimized', root, renderer: 'No WebGL renderer in CPU construction benchmark', browser: browser.version(), errors, measurements };
    results.push(data); console.log(`${data.label}: ${measurements.length} constructions, ${errors.length} page errors`);
    await page.close(); await server.close();
  }
  for (const result of results) for (const row of result.measurements) delete row.boxes;
  writeFileSync(resolve(output, 'construction.json'), JSON.stringify(results, null, 2) + '\n');
} finally { await browser.close(); }
