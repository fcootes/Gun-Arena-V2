# Engine Reforged I: results and review boundaries

This first optimization PR delivers the audited loading/resource/CPU work. It is
not a claim that the complete integrated-GPU overhaul or all acceptance criteria
are finished. Shadow, sector-culling, ocean, postprocessing and character batching
changes remain a separate measured phase. Main is unchanged and no merge is requested.

## Changes that eliminate existing work

- Offshore metal/concrete 512 × 512 and helipad 2048 × 2048 pixel images are cached
  within an engine session. The original paint code and all detail remain; replays
  reuse pixels with new world-owned Texture wrappers. Lobby transitions clear the
  CPU cache. Cold deployments still paint the images.
- Identically sized boxes share world-owned immutable geometry. Mesh transforms,
  children, hit references, materials and shadow flags retain their original form.
  Geometry is dimension-keyed; scaling parent meshes was rejected after a bounds
  comparison caught changed attachment points.
- Facility navigation uses a conservative collider index with unchanged exact
  traversal tests. Door active/team flags remain live, and cover add/remove updates
  the index. Movement collision code and AI decision cadence are unchanged.
- Combat/mutant contexts, projection scratch and AI difficulty records are reused.
  Live player getters preserve same-frame damage/death changes. HUD lookups cache
  connected nodes and misses, invalidating misses on actual element mounts; text
  and HTML are written only on change. Radar has one continuous RAF reading current
  pose, pings and theme.
- SoundTrack construction allocates no Audio voices. Known bundled URLs do not
  probe alternate extensions. Selected weapon families prepare one metadata voice;
  overlap voices allocate on use. Release removes sources, probe listeners and
  pending resume state. All supplied recordings and existing timing are retained.
- Unchanged composer sizes/DPR no longer reallocate targets. Existing visual
  defaults are centralized. No shadows, bloom, rain, steam, fog, ocean, bots or
  weapons were removed or reduced.

## Loading and diagnostics

World builders share one implementation between synchronous compatibility APIs and
staged deployment. Paint boundaries separate textures, authored map regions,
navigation and individual operators. No simulation or partial-world render runs
while loading. Cancellation tears down the generator, separate helicopter owner,
attached resources and retained construction materials/geometries; late completions
cannot update a disposed engine. Loading keeps a free cursor for cancellation.
Mouse capture is attempted when ready and the existing canvas click retries if
browser user activation has expired.

F3 is developer-only and samples only while visible. It reports bounded rolling
FPS, an approximate slowest-one-percent mean, frame graph, worst frame, simulation,
AI and CPU render submission, complete composer-frame draw counters, resources,
active/downed bot count, available JS heap and initialization stages. GPU elapsed
queries are not implemented; CPU submission is explicitly not GPU time. First
presentation is approximated by the following RAF, not display scanout.

## Comparable browser construction observations

Baseline: a5f5f81. Chromium 134.0.6998.35, one cold plus six warm constructions per
map, seeded Math.random, separate empty pages, real Canvas, no WebGL renderer or
lobby running. Both versions use the same dependency tree: React 19.3.0, Three.js
0.185.1, Vite 6.4.4 and Playwright 1.51.1. Raw samples are in construction.json.

| Map | Cold ms baseline / current | Warm median ms baseline / current | Geometries baseline / current | Meshes baseline / current |
| --- | --- | --- | --- | --- |
| Training Field | 135.3 / 206.5 | 84.8 / 65.9 | 173 / 173 | 173 / 173 |
| Area 51 | 1278.1 / 1199.2 | 967.3 / 709.6 | 371 / 310 | 368 / 368 |
| Shattered Wall | 149.0 / 167.1 | 386.1 / 55.2 | 853 / 567 | 850 / 850 |

Cold observations do not show a consistent improvement. Warm timing has substantial
run-to-run variability, including earlier observed offshore medians of 149.6 / 84.5
ms and Area 51 medians of 829.4 / 1380.3 ms in a run overlapping a regression test.
That overlapping run is not comparative evidence. The final sequential run above
had no concurrent test or app workload, but these small samples still do not establish
stable hardware-wide percentage gains. Training has no construction optimization;
its timing difference is measurement variation. The strongest verified savings are
avoided repeated paint commands and fewer allocated geometries. Neither result
implies fewer draw calls or an FPS improvement.

## Preservation evidence

All three maps have identical authored-mesh world-bounds hashes, zero maximum
mesh-bound deltas, identical navigation-coordinate/collider hashes and identical
Canvas pixel hashes against the baseline. Mesh, triangle, material, texture,
navigation and collider counts match; only geometry allocation counts change.
Particle/line resources are counted separately and stochastic particle bounds are
excluded from the authored-mesh comparison. Weather counts and update code remain
unchanged. Full rendered pixel equivalence, shadow-cost comparisons and sustained
Surface FPS remain unverified.

Actual UI smoke checks passed for USMC and APEX on Training/TDM, Area 51/extraction
and Offshore/extraction: loading cancellation, deploy, slots 2/1, pause/resume and
return to lobby. Zero page errors. Screenshots were inspected for working map views,
operators, weapons, HUD and radar. These are startup/lifecycle checks, not complete
campaign playthroughs. Authored campaign, lift, gate, boss and helicopter progression
is covered by the existing behavioral tests. Raw diagnostic text is in browser-smoke.json.

At 960 × 540 / DPR 1, SwiftShader observed first gameplay CPU submission of roughly
1.5–2.1 s (Training), 9.5–12.1 s (Area 51), and 9.2–11.0 s (Offshore). Inclusive
first-frame wall time was about 5.2–9.5 s, 16.1–19.5 s, and 19.4–24.0 s respectively.
These are current-version observations, not comparable baseline gains. Scene
compileAsync accounted for much less than the first draw. Texture/geometry uploads,
shadow initialization, postprocessing and software GPU work remain important
first-draw investigations. A responsive staged overlay does not eliminate that cost.

## Resource and regression validation

A clean `npm ci --ignore-scripts` succeeded. All twelve checks passed: lint, build,
runtime, scenes, tactical, weapons, area51, bosses, audio, batch1, batch2 and the new
performance tests. New tests verify 1,200 indexed/full exact traversal comparisons,
live flags, cover removal, original crate-lid coordinates, unique Texture wrappers,
cache reuse, exactly-once geometry/material/texture disposal across four offshore
cycles, actor weapon replacement, bounded telemetry and eight canceled partial worlds.
Existing checks retain all twelve weapon models and all forty real PCM recordings.

Owned allocation/disposal behavior is verified, including repeated construction
and cleanup. This does not measure physical GPU bytes or prove long-session Surface
memory stabilization. The existing lobby engine/context-recreation lifecycle remains;
on-device repeated-replay profiling is still required before claiming that criterion.

Production JS is 1,363.45 kB / 392.05 kB gzip versus 1,351.60 / 387.73 kB baseline;
the loading and diagnostic functionality increases code size. The existing large
chunk warning remains. Unreferenced dependency declarations were removed, not
claimed as a runtime bundle reduction. An npm lockfile pins the same resolution
used for the baseline. Three obsolete source-rewrite scripts were archived without
changing their bytes; the remaining forty-three await individual review.

The project engineering directive is docs/threejs-fps-engineer.md. It follows the
actual direct-renderer React 19 stack, preserves exact cross-file types and ownership,
and requires complete implementations. It is supplied as system instructions,
not installed as a personal skill.

## Next reviewable phase

Use benchmark.md on the Surface to establish comparable sustained FPS, low-percentile
frames, first-draw cost and replay memory. Profile static sector batches and visible
shadow casters before changing grouping/coverage; inspect ocean and composer passes
with real GPU tools. Profile vehicle/character construction separately before adding
archetype caches. Preserve exact collision/visual boundaries and existing AI response
quality. Do not change presets or promise GPU gains from the software-renderer data.
