# Repeatable performance measurement

Use the same lockfile, browser build, power mode, viewport, DPR, bot counts,
loadout, faction, route and background applications for both versions. Record
hardware, GPU/driver, browser version and thermal state. Plug the Surface into
power; repeat in the same power mode after cooling between runs.

## Automated CPU and Canvas construction

1. `npm ci` and `npx playwright install chromium`.
2. Create a baseline worktree: `git worktree add ../gun-arena-baseline a5f5f81`.
3. Make the baseline use the same installed dependency resolution. On POSIX,
   `ln -s "$PWD/node_modules" ../gun-arena-baseline/node_modules`.
4. Run `npm run benchmark:browser -- --baseline ../gun-arena-baseline --output performance-results`.
5. Inspect `construction.json`. Each map has one cold and six warm runs with the
   same random seed. Compare warm medians as well as individual samples; cold
   results are single observations. No lobby runs during construction measurement.

This benchmark uses real browser Canvas rasterization but no WebGL renderer.
It measures synchronous construction work, not staged deployment wall time, GPU
uploads, shader execution or gameplay FPS. The JSON also records mesh, triangle,
geometry, texture, navigation and collider counts, exact Canvas pixel hashes and
maximum transformed-bound differences. Timing excludes image serialization and
disposal. The baseline and current versions run sequentially in separate pages.

`BENCHMARK_BROWSER` can select an installed Chromium executable. In restricted
headless environments, `BENCHMARK_SINGLE_PROCESS=1` selects single-process
SwiftShader launch arguments. These results cannot substitute for Surface GPU data.

## Actual browser lifecycle smoke test

Run `node scripts/smoke-browser.mjs` after installing Chromium. It exercises loading
cancellation, both factions on all three maps, actual deployment, weapon selection,
pause/resume and return to lobby through UI controls. Default settings and enemy
counts are retained; Training uses team deathmatch and the authored operational
maps use extraction. It saves screenshots and diagnostic text at 960 × 540 / DPR 1.
`SMOKE_OUTPUT` changes the destination. This is lifecycle coverage, not a fixed-route
FPS benchmark or a complete playthrough of either campaign.

## Surface gameplay and deployment measurements

1. Start a development build with `npm run dev`, keeping the same browser and
   display settings. F3 is intentionally unavailable in the production build.
2. Select the same faction, map, mode, difficulty, operator allocation and weapons.
   Keep visual defaults: antialiasing, soft shadows, bloom, fog and weather enabled.
3. Enable F3. Deploy and record every initialization stage and the inclusive
   deployment-to-first-frame value. Nested stage times overlap and must not be summed.
4. Play the same 60-second route three times per map: spawn overview, movement
   through populated sectors, combat, reload and camera turn. Record FPS average,
   approximate 1% low, worst frame, simulation/AI time, CPU submission, draw calls,
   triangles and resource counts. Avoid pause/lobby frames in the captured window.
5. Repeat deployments and replays at least five times. Check renderer counts after
   equivalent frames; inspect browser heap snapshots and WebGL resources for growth.
6. Compare baseline and feature branch in alternating order. The baseline does not
   have F3: use identical Chrome Performance frame traces on both versions rather than comparing baseline DevTools with feature-branch F3. Do not compare the
   baseline without postprocessing against the optimized composer.

CPU render submission includes driver work but is not GPU elapsed time. No GPU
extension timer is currently sampled. Use Chrome's supported GPU profiling tools
on the real machine; do not infer GPU milliseconds from renderer submission.

The inclusive first-visible-frame measurement finishes at the next animation frame
after the first gameplay submission. It approximates browser presentation, rather
than a display scanout timestamp. Long-task recording in Chrome can identify work
inside a stage that still exceeds a frame budget, especially first texture/shadow
uploads and initial postprocessing. Async precompilation warms scene material
programs; it does not guarantee that those first-draw costs disappear.
