# Recovered preparation review — 2026-10-10

Continuation: `perf/first-use-preparation-review-20261010`, based on checkpoint
`e331aaad26873157338da06e2a501bb68f1bea45`. Main remains
`3aae545867138b41f54867cd12613927eff17fe0`. Implementation commit:
`e03a337c0af8e61683e76c1c8e602a0b6c51f668`. The recovered source and original
evidence remain intact; only the preparation submission orchestration changes.
This is a draft for native testing, not performance acceptance.

## Repairs already present

The checkpoint moves composer shaders, actual buffer/texture uploads, shadows,
fog, selected viewmodels, encounter archetypes and combat light-count first use
before readiness. It polls shader and GPU completion with cancellation cleanup.
Immutable actor geometry is shared without sharing mutable damage materials;
mission audio is prepared silently. HUD queries and redundant resize work are
reduced. The final viewport fix preserves composer rectangles when loading resizes.

Historical first gameplay CPU submission fell from 2388.9 to 12.1 ms for Area 51
USMC cold, 1911.0 to 8.8 ms warm, and 1578.4 to 29.0 ms offshore. These are CPU
submission samples from Chromium 134/SwiftShader, not native GPU time or FPS.
The final old browser evidence predates the viewport fix; the new focused browser
check below exercises that fix. Historical validation revision labels remain unchanged.

All 26 files listed in `checkpoint.md` exactly match the checkpoint's diff against
main. The recovery bundle verifies and its required base is present. No recovered
implementation file or JSON evidence is missing. Source, tests, scripts and package.json
also match the recovered bundle HEAD byte-for-byte. The GitHub checkpoint is a tree
snapshot; its original implementation history remains in the committed bundle.

## Loading diagnosis

The saved JSON stage timings identify combat draws as the dominant cost:

| Saved run | Button-to-playing | Combat draw stages | Share of observed loading |
| --- | ---: | ---: | ---: |
| Area 51 USMC cold | 47.38 s | 36.22 s | 76.4% |
| Area 51 USMC warm | 63.22 s | 50.35 s | 79.6% |
| Area 51 USMC replay | 51.38 s | 40.48 s | 78.8% |
| Pacific Rim USMC cold | 29.53 s | 19.76 s | 66.9% |
| Area 51 APEX cold | 175.03 s | 153.43 s | 87.7% |

Source: `first-use-repair.json`, tested implementation `4670bf0`. Stage timers
include their GPU polling but exclude the paint wait preceding each stage.
Nested stage totals are inclusive and must not all be added together.

Yes: the recovered implementation deliberately moves first-use rendering burden
into loading. It also adds work by preparing future states beyond the first scene.
The evidence establishes smoother initial CPU submission, not reduced overall
burden. The baseline's short loading measurement did not cover subsequent first-use
stalls. Comparing only loading or only the first CPU render would be misleading.

The old loop performs one aimed render, one fence/flush/poll sequence and one
separate paint/progress stage per representative, for every light count. Counts
participate in Three 0.185 program keys even for fresh unlit ShaderMaterials.
World geometry/material state representatives are crossed with all these counts.
This creates genuine shader/driver work plus repeated synchronization, scene
traversal and scheduling. Saved APEX combat compilation was only 0.578 s while
draw stages took 153.43 s; that distinction implicates the actual-draw/wait path,
not just the initial compile call. It does not separate driver specialization
from fence polling precisely enough to assign every millisecond.

APEX prepares 21 future armed encounter lights (18 regular enemies plus three
Spartans), in addition to existing actors, player/transport and grenade allowances.
This is later-mission coverage rather than an immediate-deployment requirement.
The eight preparation actors cover security pistol/SMG and specialized/ordinary
body paths, plus marine and Spartan body paths. The real builder uses bot ID
modulo three for specialization and modulo two for security weapons. These samples
are not simply eight duplicate actors. Their saved construction cost was 0.385 s;
campaign audio cost was 0.048 s. Removing those construction stages alone would
not solve a 175 s load.

Later marine/Spartan states and the high light counts are not immediately needed,
but removing them from preparation without an independently verified later
preparation window would restore encounter first-use stalls. This continuation
retains them. It does not claim the conservative range is a measured distribution
of real simultaneous firing. Reducing that cross-product or introducing staged
encounter preparation remains a separate measured follow-up if native loads remain
unacceptable; no gameplay light, enemy, quality or mission timing has been changed.

## Narrow change

Keep every aimed representative draw and every light-count variant. Submit up to
eight individual draws before one GPU fence, stopping the batch after 4 ms of CPU
submission time. The fence covers all earlier commands. Each batch still goes
through a paint/progress/cancellation boundary; the final full-resolution composer
render still fences completion before readiness. A single blocking driver call
can exceed 4 ms; the budget prevents adding further calls to that batch, rather
than promising to preempt a call. Upload batches and rendering quality are unchanged.

This removes redundant synchronization/scheduling; it does not remove shader
variants, reduce retained resources, or prove acceptable full-map loading times.
It preserves the achieved preparation coverage and the existing viewport fix.

## Focused validation

- `test:preparation`, `test:runtime`, `test:performance`, TypeScript lint and
  production build passed, each with a 30 s command timeout. The existing Vite
  large-bundle advisory remains. No full browser benchmark matrix was run.
- Preparation regression checks exercise 17 independent formats at three light
  counts, preserving every draw while reducing stages/fences, capping submissions,
  and restoring state on cancellation during a combat submission. Existing shader
  completion, visibility, instance-camera, resource and audio tests still pass.
- A real Chromium 134 WebGL fixture completed in 15.18 s under a 45 s whole-run
  deadline (55 s outer command limit). It uses a tiny scene with a standard shadowed
  mesh, actual AR assembly, DoubleSide muzzle shaders and particle Points, not a
  full Area 51 scene. Fresh muzzle/particle materials introduce no programs at
  any of 22 prepared light-count states. Renderer state and camera restore correctly.
- Resizing during uploads, resizing during combat preparation, and resizing then
  canceling pass. A geometry backdrop over a black clear color verifies all four
  framebuffer corners are rendered, avoiding a false positive from background
  clearing despite a 1-pixel viewport. Max batch submissions were eight; 233
  combat renderer submissions used 115 stages across all fixture phases. The
  counts demonstrate amortization, not full-map speedup.
- See `preparation-review-browser.json` and `preparation-review-validation.json`.
  The browser was ANGLE/SwiftShader. No new native, full-map before/after loading,
  GPU-time, long-session memory or manual campaign acceptance claim is made.

Remaining focused integration checks are actual game-window resize with a changed
aspect ratio/DPR, scope/HUD alignment after readiness, and cancel/redeploy through
the React engine teardown on the final branch. The fixture tests composer state
directly; it does not substitute for these App event and lifecycle checks. Native
first-frame and encounter measurements are still required after the batching change.

Repeat the focused fixture with `npm run test:preparation:browser` after installing
Playwright Chromium. Set `BENCHMARK_SINGLE_PROCESS=1` only when the container
requires software rendering; leave it unset on the Surface. The existing
`BENCHMARK_BROWSER` override is supported. The fixture does not start the game UI.

## Short Surface Pro acceptance check

1. Compare main and this continuation using the same Surface, browser, resolution,
   display scale, graphics settings and plugged-in power mode. Confirm a native
   GPU renderer; record model/GPU/browser. Use a fresh browser process per cold run.
2. Record a DevTools Performance trace beginning before Deploy. Test Area 51 USMC,
   Area 51 APEX and Pacific Rim separately. Record button-to-first-controllable-frame
   time AND button-to-stable-play time, with the loader's responsiveness. Keep F3
   enabled consistently for both versions; CPU submission is not GPU timing.
3. For 30 seconds immediately after readiness, move, turn, fire, switch weapons
   and ADS. Record worst frame interval, visible input stalls and shader counts.
   Repeat one lobby redeploy and one Play Again cycle; record both total times.
4. In APEX, encounter security, marines and Spartans; offshore, trigger the signal,
   first wave and helicopter arrival. Check for delayed first-use stalls. Resize
   during loading and once after readiness; cancel one loading attempt and redeploy.
5. Keep the PR in draft until both total loading and in-game responsiveness are
   acceptable on the Surface. If loading is excessive, capture stage timings and
   a trace for a separate targeted review. Do not accept a longer loading screen
   solely because the first CPU submission is shorter. Full manual visual/campaign
   acceptance and long-session resource stability remain outstanding.
