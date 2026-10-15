# Shotgun fidelity — Batch 1

Stacked on unmerged draft [PR #15](https://github.com/fcootes/Gun-Arena-V2/pull/15),
base `3778c568db1162d40822676d5d31ffc385b0681a`. Branch:
`feat/shotgun-fidelity-batch1-20261015`; PR target:
`feat/procedural-first-person-hands-20261015`. Neither PR is merged. This does
not mark the foundation visually accepted or authorize Batch 2.

## Diagnosis and implementation

The previous `App.fireWeapon()` started the report, pump recording and renderer
pump timer together. `weapons.update()` also had a separate sine-wave pump for
`boltCycleT`, and the support wrist interpolated behind the moving part. Shell
cues began at the start of an insertion phase; a second cylinder rotation stood
the shell across the bore, and a solid receiver box occupied the loading path.

`shotgunMechanics.ts` now provides one simulation clock for a fired or interrupted
chamber action. `advanceWeaponReload()` emits pump and committed seating events
at boundaries, including frames crossing multiple boundaries. `weapons.ts` and
the existing shared `viewmodelHands.ts` palette read this clock and the same
moving pump attachment. Presentation does not change ammo or schedule sounds.
The two obsolete presentation-only APIs (`triggerShotgunPump()` and
`playShotgunReloadPhase()`) have been migrated at every source/test caller.

The shotgun alone gets restrained receiver recoil, a rear stop and closing
settle. Camera recoil values, fire interval, damage, spread, magazine, reserves,
input and movement are unchanged. Its first-person receiver has an open bottom,
bounded side walls and visible lips. A red hull and brass base travel parallel
to the bore through that opening. Reload roll exposes the underside; normal
hip/ADS/sprint transforms remain unchanged. There is still one shared hand pair.

## Timings

All values below are seconds of simulation time, at class multiplier 1.

| Fired action | Start → end | Behavior |
| --- | --- | --- |
| Report | 0 | Immediate accepted shot; natural tail continues |
| Recoil/recovery | 0 → .180 | Sharp 35 ms receiver peak; asymmetric recovery; pump stays still |
| Rearward stroke | .180 → .410 | 75 mm; delayed pump cue starts at .180 |
| Rear stop | .410 → .440 | Full rearward endpoint, small receiver response |
| Forward stroke | .440 → .660 | Positive return to zero displacement |
| Lock/settle | .660 → .740 | Action stays locked until closed |
| Next shot eligibility | ≥ .850 | Existing fire interval remains authoritative |

The physical pump gesture lasts .560 s, after the .180 s recovery. The reused
.420 s recording fits the .480 s moving/stop interval at playback rate .875.

| Shell reload | Duration / boundary | Behavior |
| --- | --- | --- |
| Open/access | .300 | Release pump, briefly access port, reach pickup |
| Each shell | .850 | Pickup 0–.136; carry .136–.442; press .442–.612; follow-through/reset .612–.850 |
| Seating/transfer | .612 into each shell | Exactly one reserve decrement, ammo increment and cue; shell becomes hidden inside port |
| Tactical finish | .260 | Return to fore-end; no redundant pump of an already chambered action |
| Empty chamber action | .740 | .180 hand return, then the same .560 pump gesture |
| Empty close | .180 | Recover ready pose |

Shell `n` seats at `.300 + (n−1) × .850 + .612`. With six missing shells:
`.912, 1.762, 2.612, 3.462, 4.312, 5.162`; chamber action starts at 5.400,
pump cue at 5.580, ready at 6.320. A partial reload with four missing shells
takes 3.960 s; two missing shells take 2.260 s. Reload phase durations, seating
and cue fitting all scale with the existing class reload multiplier. Post-shot
cycling remains .740 s across classes.

The deliberate shell window intentionally increases reload time: the old insert
was .39312 s tactical / .55440 s empty at class speed 1. Other weapon reload
times and the shotgun firing balance constants are unchanged.

## Interrupts and lifecycle

A loaded tactical reload may interrupt immediately. An empty reload cannot fire
before its first real seating transfer. Once a shell is seated, interruption
preserves its ammo and requires a chamber cycle before consuming the held trigger.
Interrupting a chamber action carries its elapsed progress and pump-event flag
forward, rather than restarting it or replaying its cue. `pendingReloadShot`
remains a one-shot request consumed by the App only when ready and still held.

Switching, death and match exit clear queued fire and cancel the shotgun action.
An unfinished action remains `needsChamber`; returning requires the existing
chamber-only reload path. Pause freezes the simulation and preserves audio
cursors. Existing weapon-audio stop/release paths stop all active voices.

## Existing sounds and listening limits

All four supplied WAV files remain byte-for-byte unchanged. Shell cues start at
seating, fitted to .480 s × class multiplier: tactical .39312 s → rate .819;
empty .55440 s → rate 1.155. Late frames seek into a cue; wholly obsolete cues
are skipped rather than burst-played. Pump playback never stops the report tail.

The environment has no listening/audition tool. Playback events and file metadata
are verified; the suspected embedded pump in `shotgun_fire_single.wav` remains
unconfirmed. No replacement recording has been acquired, generated, overwritten
or recommended on that unverified premise. Please audition the report/pump blend
and the modest fitting on the preview during acceptance.

## Deferred foundation acceptance

These remain separate PR #15/backlog issues; no fix is included here:

- Global sprint tilt points the opposite way from the user's intended left carry.
- Sniper and SMG charging-handle reach travels too far rearward.
- Battle rifle needs a more upright, visible reload.
- LMG needs a firmer magazine slap/seating action.
- Minigun handle should face up.
- RPG needs stronger reload tilt and a recognisable rocket mesh.

The accepted AR charging latch and pistol reload are preserved. Do not begin
Heavy Sniper Fidelity (Batch 2) until the user visually approves this batch.

## Validation and rendered evidence

[Before/after gallery and continuous gameplay video](shotgun-fidelity/README.md).
[Machine-readable results and event log](shotgun-fidelity/validation.json).
Runtime code is checkpoint `76678dee48ec333c90fb22535e55f1110fe05c27`; later commits
add harness/evidence/documentation only. Draft [PR #17](https://github.com/fcootes/Gun-Arena-V2/pull/17)
is stacked against PR #15's feature branch.

TypeScript and production build passed (the existing large-bundle advisory
remains). Shotgun, weapon, tactical/reload, hand/viewmodel, audio, controls,
runtime and preparation suites passed. The shotgun tests cover 30/60/144 Hz,
three class speeds, partial/empty loads, one-shell reserves, invalid/large deltas,
seat-boundary transfer, repeated reload input, before/after-first/later/final-shell
and final-chamber interruption, exact hand/part tracking, actual shell-path
clearance against receiver/trigger-guard geometry, and no per-frame geometry,
material or scene-object allocation. Existing teardown tests release every new
owned resource once.

The eleven other weapon families match the baseline exactly for first-person
and bare actor geometry/materials, per-frame poses, hand instance buffers and
reload state. AR/pistol audio tests also pass. No world, AI decision logic,
shader preparation, global sprint profile or camera recoil gameplay value changed.
The shared shotgun reload helper gives shotgun users, including bots, the new
longer shell-loading windows; this is an intentional reload-duration change.

The live actual-input run passed all five checks with zero page errors: nine
reports, ten pumps (one interrupted empty chamber) and nine committed seat cues;
final ammo `6 / 27`. A separate browser control fixture and actual App deployment/
lifecycle also passed. WebGL preparation passed all 22 light-count variants,
98 draws in 43 bounded batches, 92 programs, full-frame resize/cancellation/state
restoration and zero lighting-pixel difference. The 20 after-pose samples all
retained 114 existing programs, with no first-action program addition in those
samples. Production assets contain no test hooks.

| Isolated cached shotgun + hands | Before mesh draws / triangles | After mesh draws / triangles |
| --- | --- | --- |
| Held | 15 / 16,908 | 15 / 17,556 |
| Visible shell | 16 / 16,972 | 17 / 17,924 |

These are visible mesh counts, not measured GPU timings. The extra shell draw
separates the brass base from the hull; the held draw count is unchanged. The
shared rig still has eight meshes and two reused 30-instance palettes.

The continuous 97.4 s muted video is unretimed real gameplay, with full UI and
actual input. Its software renderer sampled 345 frames across 97.64 s wall time
(about 3.52 FPS); the existing 50 ms delta cap slows action in that footage.
It must not be used to judge native-speed cadence or laptop performance. The
phase table is simulation time, verified independently at 30/60/144 Hz. No native
GPU measurement or real listening claim is made. Please playtest reload roll,
contact weight, interruption and the shot/pump blend before accepting Batch 1.

Reproduce the browser evidence with `PLAYWRIGHT_BROWSERS_PATH` pointing to the
installed Playwright cache and `BENCHMARK_BROWSER=/usr/bin/chromium`. Run
`npm run test:shotgun:browser`; export its continuous interval with
`node scripts/export-shotgun-video.mjs performance-results/shotgun-after` (or
supply the chosen `SHOTGUN_OUTPUT` path). Baseline comparison uses an archived
PR #15 checkout via `SHOTGUN_ROOT`, `SHOTGUN_BASELINE=1` and a separate output path;
`node --import tsx scripts/compare-shotgun-scope.mjs /path/to/archive` verifies the
other families without editing that archive. Do not create a Git worktree for
this environment unless the user requests one.

The separate `node scripts/test-shotgun-switch-browser.mjs` run also passed:
seven rendered pump/reload switching samples, event-time ammo conservation,
chamber-only recovery and a valid shot on return. Those samples and state records
are included in the gallery and validation JSON.
