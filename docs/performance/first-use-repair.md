# First-use rendering repair

This branch prepares the existing game before revealing gameplay. It does not
change maps, balance, rendering quality, weapon timing or the Engine Reforged
architecture. The implementation and automated verification are complete;
acceptance of the reported Surface Pro freezes still requires testing on that
device. Software-renderer measurements cannot establish Surface FPS or GPU time.

## Confirmed boundaries

| Boundary | Evidence | Repair |
| --- | --- | --- |
| Deployment → first draw | Baseline compiled the scene against the default framebuffer, then first used the linear composer, bloom/output programs, textures, buffers and shadows after readiness. | Prepare the actual composer target and postprocessing programs; submit real uploads/draws and fence their completion before readiness. |
| Area 51 atmosphere | Gameplay assigned facility fog on its first update, after loading compilation. Training had the same first-update fog boundary. | Assign the existing gameplay fog at construction, with the existing disposal restoration. |
| Offshore signal → holdout | The signal reveals the perimeter; the first infected wave follows six seconds later; the helicopter appears in the final twelve seconds. These are different first-use boundaries. | Upload hidden mission resources and prepare the existing infected archetypes, transport glass/render states and rotor buffer while loading. The trigger and mission timing remain unchanged. |
| Camera, ADS and combat | Baseline shader counts grew during turning, firing, weapon switching and scope tests. Compilation alone still left driver specialization on first actual draws. | Prepare selected viewmodels and compile/draw representative materials for possible combat point-light counts. Include transparent side and blending/depth states, rather than shader identity alone. Unlit custom shaders also need each first-use light-count key. |
| Delayed actor construction | Deterministic body primitives were recreated for every encounter; damage materials must remain actor-local. | Cache immutable geometry by exact constructor dimensions. Keep random fabric actor-owned, materials independent and shared buffers engine-owned. |
| Scope HUD and resizing | Scope/crosshair queried the DOM each frame; App resize called renderer resizing without checking dimensions. | Use the existing connected HUD cache, write changed display values, and skip unchanged renderer sizes. Preparation scales restored target rectangles if a real resize occurs during uploads. Scope behavior and resolution are preserved. |

`sceneEffects.prepare` owns temporary lights, representative clones, callbacks,
camera/visibility/layer changes, scissor/viewport changes and pass geometry.
`finally` restores state on success, cancellation and failure. Completion waits
poll KHR shader completion and WebGL2 fences through paint boundaries, without
`gl.finish`, a fixed delay or detached `compileAsync` polling after context loss.
When KHR is unavailable, driver compilation may still block within a stage.

Visual-only encounter samples never enter bot, collision, raycast, navigation or
mission arrays. They remain hidden after preparation, retain shader resources for
the match and are released on replay/lobby teardown. The body cache is released
after actors at engine teardown. Preparing/removing an Abomination cannot dispose
claw buffers used by another infected. Mission audio preparation is silent; the
same existing synthesized cue formulas and all forty recorded weapon clips remain.

## Measured before and after

Baseline is `3aae545` (merged Engine Reforged PR #11). Both versions used the same
installed dependencies, Chromium 134, a 640 × 360 viewport, ANGLE/SwiftShader,
F3 instrumentation and the complete bloom/shadow pipeline. The profiling server
adds debug accessors only through a Vite transform; production has no probe.
The scoped comparison equips the existing sniper in the secondary slot, invokes
the real mouse/fire and slot handlers, and asserts the scope overlay during ADS.
Area 51 warm means returning to the lobby and redeploying. Replay uses the real
damage/death path and Play Again button. These are short samples, not an FPS study.

| Observation | Baseline | Repair |
| --- | ---: | ---: |
| Area 51 cold first gameplay CPU submission | 2388.9 ms | 12.1 ms |
| Area 51 warm first gameplay CPU submission | 1911.0 ms | 8.8 ms |
| Area 51 cold turning/ADS/fire peak CPU submission | 2613.9 ms | 25.6 ms |
| Area 51 warm turning/ADS/fire peak CPU submission | 838.9 ms | 30.5 ms |
| Offshore cold first gameplay CPU submission | 1578.4 ms | 29.0 ms |
| Offshore turning/ADS/fire peak CPU submission | 1022.4 ms | 22.8 ms |
| Offshore signal/first-wave peak CPU submission | 1025.7 ms | 16.7 ms |
| Offshore helicopter-arrival peak CPU submission | 197.2 ms | 14.3 ms |
| Offshore first-wave construction | 9.1 ms | 3.7 ms |

Signal activation itself was inexpensive: 0.2 ms in the initial baseline and
0.1–0.3 ms in repair samples. The evidence implicates rendering/first-use work
around the event, rather than an expensive timer function. No new shader programs
appeared during the final scoped USMC samples: Area 51 stayed at 268 and offshore at 239. Baseline counts grew from 45 to 72 and
47 to 75 respectively. Program count
is larger at readiness by design: potential states have already been prepared.

### Loading cost and remaining stalls

Observed button-to-playing wall time was 4.0/3.0 seconds for baseline Area 51
cold/warm, versus 47.4/63.2 seconds for repair; repair replay took 51.4 seconds.
Offshore changed from 3.0 to 29.5 seconds in the scoped run. The old measurement
includes early gameplay work before the harness could observe playing; it does
not mean the baseline loading screen covered all preparation. New readiness waits
for actual driver/resource work. There is no deliberate time-based delay.

This is **not evidence of faster total loading**. Driver specialization dominates
the software-renderer loading path, and warm results vary considerably. Surface
loading time, warm-cache behavior and time to stable interactive play remain open.

Long tasks after deployment initiation fell from a maximum of 2663 ms to 337 ms
in Area 51 cold, and 1745 ms to 287 ms offshore. Those maxima include loading.
Software rendering still produces large gameplay frame intervals: the repair
samples reached 706 ms in Area 51 cold, 1492 ms warm and 632 ms offshore. Therefore
low CPU submission does not prove low GPU/compositor cost or consistently smooth
frames. Actual GPU timing, long-session GC/memory and the user's reported
thirty-second Surface freeze have not been verified on native hardware.

Potential trade-off: preparation retains more hidden resources and programs, and
per-light-count draws add genuine startup work. If Surface profiling shows an
excessive cost, optimize the measured preparation batches/driver variants next;
do not silently reduce shadows, enemy counts, bloom, weather or resolution.

## Preservation and lifecycle validation

- All six map/faction browser smoke flows pass deployment, weapon switching,
  pause/resume and lobby return, with no page errors.
- All eleven regression suites, TypeScript lint and production build pass.
  Vite still reports the existing large-bundle advisory; it does not fail the build.
- New preparation tests cover visibility/layers, hidden-light exclusion, a real
  instance triangle covering the preparation pixel, real unlit particle variant
  orchestration/restoration/cancellation, target viewport preservation when resizing
  during uploads, both transparent-side shader
  completions, fence cancellation/context failure, actor cache lifetime, independent
  flash materials, idempotent viewmodel preparation and silent audio-buffer reuse.
- The actual replay cleanup test releases preparation-only actors, alongside
  existing transient combat effects, exactly once.
- Browser cancellation after lighting compilation, upload draws, combat draws and
  first complete render returns to a fresh lobby. In each case the retired scene
  is empty, preparation actors are gone, its context is lost and no stale playing
  frame ran. GPU bytes are not exposed by this check.
- A baseline comparison of 31 actor variants matches exact geometry attribute/index
  buffers, transforms, material appearance settings and hit/head-part membership.
  It covers both factions, all six ordinary class choices, security/marine/Spartan
  variations and all seven existing infected variants. Random visual choices were
  seeded separately from UUID generation. Random fabric remains individually owned.
- Area 51 USMC cold/lobby redeploy counts were 646 geometries and 56
  textures at first gameplay for cold and lobby redeploy; the actor-first-use
  samples ended at 667 geometries and 56 textures in both runs. Replay began
  at 598 and ended at 609 geometries, with 56 textures. Final offshore first/end
  counts were 831/833 geometries and 35 textures. An
  earlier offshore replay check ended at 822 geometries/35 textures in both runs;
  the final unlit-key change adds preparation programs rather than live meshes.
  Random equipment and transient effects affect geometry counts. These small
  samples and teardown tests do not establish long-session memory stability.

The APEX follow-up found a separate issue: Three includes light counts in initial
non-Raw program keys even for unlit custom shaders. The earlier lit-only pass
left 415–661 ms spikes on new security/Spartan muzzle and particle resources.
The final pass includes every captured format at zero and additional light counts.
APEX then stayed at 793 programs, with peaks of 23.9 ms during turning/ADS/fire and
43.1 ms during real campaign actor first draws; its first submission was 16.0 ms.
This broader preparation took 175.0 seconds on SwiftShader. Armed actor construction
still took approximately 59–82 ms in that test; it has not been eliminated.

Raw samples, cancellation results, actor signatures and final smoke results are
stored beside this report. Traces can be regenerated with `PROFILE_TRACE=1`;
large Chromium trace streams are not committed to the repository.

## Repeatable profiling

Install with `npm ci` and `npx playwright install chromium`. The default browser
launch uses normal settings. This container required an explicit headless-shell
path and `BENCHMARK_SINGLE_PROCESS=1`, which requests SwiftShader; leave that
flag unset when measuring a normal native browser.
Use `BENCHMARK_HEADED=1` for a visible browser and inspect `glRenderer` in the JSON
to confirm native GPU rendering; a software fallback is still a software test.

```bash
PROFILE_MAP=area51 PROFILE_SCOPE=1 PROFILE_WARM=1 PROFILE_REPLAY=1 PROFILE_ENCOUNTERS=1 PROFILE_ASSERT_STABLE=1 PROFILE_TRACE=1 npm run profile:first-use
PROFILE_MAP=shattered_wall PROFILE_SCOPE=1 PROFILE_ASSERT_STABLE=1 PROFILE_TRACE=1 npm run profile:first-use
PROFILE_MAP=area51 PROFILE_FACTION=apex PROFILE_SCOPE=1 PROFILE_ENCOUNTERS=1 PROFILE_ASSERT_STABLE=1 npm run profile:first-use
PROFILE_MAP=shattered_wall PROFILE_CANCEL=1 PROFILE_REPLAY=1 npm run profile:first-use
node scripts/smoke-browser.mjs
```

On the Surface's PowerShell terminal, set environment variables separately:

```powershell
$env:BENCHMARK_HEADED = "1"
$env:PROFILE_MAP = "area51"
$env:PROFILE_SCOPE = "1"
$env:PROFILE_WARM = "1"
$env:PROFILE_REPLAY = "1"
$env:PROFILE_TRACE = "1"
$env:PROFILE_ASSERT_STABLE = "1"
npm run profile:first-use
```

For a separate cold offshore run, set `PROFILE_MAP` to `shattered_wall` and remove
the warm/replay flags with `Remove-Item Env:PROFILE_WARM, Env:PROFILE_REPLAY`.

Run each cold map in a separate process/browser. Cancellation runs intentionally
perform earlier deployments and should not be used as fresh cold-start samples.
An optional first positional argument selects another checked-out repository;
the second selects the JSON output path. The same Vite instrumentation can compare
the merged baseline checkout using this branch's harness and dependency tree.
`PROFILE_ENCOUNTERS=1` invokes the real Area 51 encounter builder for visual/resource
first-use testing; it is not a manual full-campaign progression test.

## Surface Pro acceptance procedure

1. Use the same browser, viewport, display scale, power setting and graphics options
   for baseline and this branch. Record the Surface model, GPU, browser version and
   whether plugged in. Close other heavy apps; use separate fresh browser sessions.
2. Start `npm run dev`, enable F3, and record a DevTools Performance trace from before
   deployment through at least 30 seconds of movement. Test Area 51 cold, then
   return to the lobby and redeploy. Record loading duration, first submission,
   worst frame interval, simulation/AI and program/resource counts.
3. In a fresh session deploy offshore. Turn through the map, fire, switch to a scoped
   weapon and repeat ADS. Activate the signal, remain in the perimeter through the
   first wave, and record helicopter arrival during the final twelve seconds.
   Check every phase for a visible freeze and new programs.
4. Repeat with both factions, complete both Area 51 campaigns/boss encounters,
   board/depart by helicopter, and verify objective/cinematic timing and visuals.
5. Cancel during visual preparation; redeploy; die and use Play Again. Repeat at
   least five cycles and compare resource counts at the same settled mission point.
   Confirm no gradual growth, stuck loading, broken controls or altered scope/recoil.
6. Compare the whole trace, including loader responsiveness and total time to stable
   play. Accept this repair only after the reported freezes are absent and any
   loading/memory increase is acceptable on the actual device.
