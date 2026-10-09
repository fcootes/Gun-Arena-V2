# Engine Reforged: audit of a5f5f81 (2026-10-09)

Scope: current content only; no weapon stats, collision dimensions, faction identity,
progression IDs, saved data, enemy counts or visual quality changes. Delivery branch:
`perf/engine-reforged-loading`. Measurements below are observations, not Surface Pro predictions.

## Baseline

All eleven requested npm checks pass on latest main: lint, build, runtime, scenes,
tactical, weapons, area51, bosses, audio, batch1 and batch2. Build: 1,351.60 kB
main JS / 387.73 kB gzip, 84.27 kB CSS; Vite warns about the large chunk.
No lockfile was tracked. Actual scripts use npm; package.json declares React ^19.0.1 and direct Three.js
^0.185.1 (not the historical React 18 / R3F description). Preserve this actual stack.

Node construction timings with a no-op Canvas shim (three sequential constructions):
Training 180.44 / 74.75 / 40.99 ms; Area 51 864.84 / 818.14 / 600.50 ms;
Shattered Wall 152.06 / 78.97 / 145.88 ms. These exclude Canvas rasterization,
GPU uploads, shaders and rendering; they cannot explain the user's entire freeze.
Area 51: 1,429 navigation nodes, 214 colliders. Offshore: 22 nodes, 174 colliders.
Training has randomized terrain placement, so node counts vary.

## Prioritized findings (original source locations)

| Priority / evidence | Location | Problem / impact | Correction | Gameplay risk / validation |
| --- | --- | --- | --- | --- |
| P1 proven | App.tsx initMatch 1944–2160; deploy/restart 2838–2901 | Whole teardown, map and actor construction plus first render run in one task; UI cannot paint progress | Yield between independently valid stages; prohibit simulation until complete; cancel safely; precompile asynchronously | Medium lifecycle risk: double clicks, cancellation, restart, camera and pointer-lock browser tests |
| P1 proven | world.ts industrialTexture 1112 / helipadTexture 1136 | 12,000 marks per industrial texture and 26,000 pad marks repainted every deployment | Bounded CPU image cache; new world-owned Texture wrappers; prepare images in paintable stages | Low: retain exact paint code/resolution/UVs; image equality and disposal tests |
| P1 proven | area51World.ts 1207–1321 | Grid, links and every A* expansion linearly scan 214 colliders; Node construction already >600 ms | Conservative spatial candidate index with unchanged exact tests and live door/team flags | Medium routing risk: compare indexed/full scans, dynamic covers, both campaigns, lift and gates |
| P1 proven | audio.ts constructor/detectSources 14–88 | Every module-level track allocates a full pool, probes alternatives and preloads all confirmed pool voices | Known bundled URLs need no alternate probing; allocate voices on demand; keep metadata needed for synchronized reloads | Medium audio risk: all 40 recordings, rates, phase cues, loops and pause/cancel tests |
| P1 proven | HelmetHUD.tsx radar effect 126–270 | New playerPos prop at 20 Hz restarts RAF; closure omits visor dependency | Stable loop with latest data ref; retain continuous sweep and fresh themes | Low: render/radar theme browser check |
| P1 proven | App.tsx 3933–4049 | Queries and identical text/HTML writes every frame | Connection-aware HUD lookup cache and compare before writing; preserve reactive elements and recoil latency | Low: HUD/input tests, mount replacement and actual DOM mutation counts |
| P1 proven | App.tsx getCombatContext/getMutantAIContext, 3636 / 3730 | New context, player snapshots and callback closures per bot; health bars allocate vectors | Reuse contexts with live player getters; shared projection scratch; keep every decision at same frequency | Medium: tactical/boss regression; no stale health/death between bots |
| P2 proven | sceneEffects.ts resize | setPixelRatio already resizes composer; setSize immediately repeats it | Guard unchanged dimensions/DPR; one allocation per actual resize | Low: count resize calls; preserve full effects and DPR caps |
| P2 suspected | area51World.ts staticBoxes 965; world.ts box 1424 | Facility-wide batches defeat room culling; offshore uses many separate boxes | Profile before sector subdivision/instancing; preserve animated and hittable geometry | Medium: actual image/shadow/raycast comparisons required before structural changes |
| P2 suspected | App.tsx renderer 386–408; world.ts ocean/rain | DPR 2, PCF soft shadows, bloom, ocean 180×180 and 6,000 rain particles cost GPU time | Centralize existing fidelity settings, gather render calls and CPU submission timings; no automatic quality cuts | Hardware-dependent; no FPS claim without comparable GPU captures |
| P2 candidate | App.tsx four `if (false)` branches; 46 root patch scripts | Historical patch workflow / unreachable branches, not active bundle cost | Archive only scripts with verified obsolete source anchors; retain readable history and documentation | Low maintenance risk; inventory references before moves |
| P2 proven | package.json / tsconfig / index.html / vite.config | Unused runtime dependency declarations and no reproducible dependency resolution; preview HMR intercept is intentional | Remove only graph-unreferenced dependencies; npm lock; retain preview behavior | Low: npm clean install, build, all tests |
| P2 candidate | WorldResources; botBuilder; weaponModels; previews | Existing disposal foundations mostly correct; cross-owner sharing must not outlive owner | Preserve ownership; add repeat spawn/replace/world tests; inspect rendered resource stabilization | Medium: no shared geometry cache until ownership verified |

## Module boundaries / data authority

- `WEAPONS` in weapons.ts: active gameplay damage, cadence, ammo, reload and slots.
- `ARSENAL` in types.ts: economy/unlock/persistence definitions; UI.tsx consumes it.
- `VAULT_WEAPONS` in LoadoutDMZ.tsx: descriptive normalized armory presentation;
  `getWeaponPerformance` already reads active WEAPONS. Do not collapse scores into stats.
- `WEAPON_MODEL_IDS` / weaponModels: supported mesh IDs and assemblies.
- FactionContext / careerLedger: current cosmetic state and separate career ledger;
  legacy types.ts economy persistence is live through UI.tsx. Do not migrate saved keys.
- world.ts: public world lifecycle + Training/Offshore; area51World.ts: facility,
  interaction/lift/collision ownership; tacticalNavigation: exact traversal checks.
- gameLoop / area51Campaign / area51Bosses: shared combat and authored faction campaigns.
- WorldResources owns world geometry/material/texture references; helicopter has its
  own owner in Area 51. botBuilder's weave/scratch cache belongs to the engine session;
  individual bots must not dispose it. weaponModels owns its per-assembly textures.
- sceneEffects owns composer targets/passes; WeaponStudio owns its renderer and PMREM.
- campaignAudio owns generated mission cues; audio/weaponAudio own the supplied WAVs.

## Inventory and cleanup decisions

`inventory.json` inventories every tracked text source, configuration, test, document,
manifest and maintenance script, including imports and exported symbols. A recursive
relative-import graph from main.tsx reaches every runtime source and stylesheet: no
orphaned source deletions are justified. Dynamic/audio URL references were checked
against all 40 WAVs and three manifests; audio tests validate RIFF PCM and durations.
All nine existing test files were inspected and executed. Some runtime tests extract
actual App handlers into a VM; asynchronous handler fixtures must change alongside
legitimate scheduling changes rather than disabling coverage.

The root patch scripts are unreferenced by runtime imports and package scripts.
They perform one-off string mutations against older source layouts; retain history
unless individual anchors demonstrate obsolescence. index.html intercepts preview
HMR sockets and throttles reloads, aligned with DISABLE_HMR in Vite: retain it.
CSS, SVG scene descriptions, career/unlock data and all audio bytes remain untouched.

## Follow-up evidence requirements

Browser software rendering is useful for startup, stage accounting, screenshots and
resource stabilization, but is not a Surface Pro integrated-GPU benchmark. Capture
repeatable on-device FPS/1% lows, room/shadow cost and thermal state before changing
shadow coverage, geometry batching, weather, postprocessing or AI decision cadence.
