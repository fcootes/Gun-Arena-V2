# APEX deployment repair — 2026-10-14 checkpoint

Branch: `fix/apex-combat-preparation-20261014`. Base:
`1c2419a37764dc5b973e0a42df0ea6dcebe5054d` (main, including merged controls PR #13).
No changes were made to main or to the control mappings.

## Recovery

The attached checkout was clean at `55523e9`, with no staged changes or stashes
and only its initial checkout in the reflog. The earlier preparation implementation,
recovery bundle, benchmark JSON, tests and checkpoint documents were already
committed. The recovery bundle verifies against its available prerequisite base.
Remote branch discovery found the original checkpoint and preparation-review
branches, but no newer APEX repair branch. The earlier isolated Work filesystem
is not accessible here; no new unfinished repair was recovered or invented.

## Evidence and implementation checkpoint

A fresh Chromium 154/ANGLE SwiftShader run of the latest main reproduced the
excessive **Area 51 APEX** delay: 186.45 s click-to-playing, 172.65 s in combat
draw preparation, 0.85 s in combat shader compilation. It eventually completed,
with no page errors or first-use program events. This reproduces an apparent
stall under software rendering, not an infinite loop or the user's native GPU.

The source crosses representative draw states with every supported combat light
count. APEX Area 51 adds 21 future armed encounter lights. Each of those draws
previously re-entered the entire world scene, including matrix updates, traversal,
and geometry beneath live-light ancestors. The first repair keeps all the
representatives/light states, but draws them in a compact scene containing the
same effective world lights, transforms, borrowed shadow maps, fog and environment.
Actual world uploads, composer preparation and the full-resolution readiness
render remain in place. Gameplay and future encounters are unchanged.

Shader and GPU completion waits now have 30 s deadlines, preserve cancellation,
and release fences on timeout. The loader reports combat preparation percentage
at existing paint boundaries. Driver calls themselves cannot be preempted by JS.

Focused unit checks and TypeScript pass. The real WebGL fixture passed all 22
light states, new muzzle/particle first-use keys, resize/cancellation restoration,
and full-frame pixel checks (20.60 s; 233 draws; maximum eight draws per batch).
These focused results do **not** yet establish full-map speedup or native acceptance.

## Validated second implementation checkpoint

The full-map comparison showed that compact traversal alone was insufficient:
180.27 s loading, 157.90 s GPU waits, 806 combat submissions over 31 light states.
The dominant cost is genuine driver specialization for the count cross-product,
not a reproduced unresolved promise. One-primitive draws and timer-based completion
polling alone likewise did not materially reduce total loading (183.56 s).

The durable reduction normalizes adjacent transient point-light counts to multiples
of four during Extraction rendering/preparation. At most three zero-intensity,
non-shadowing point lights fill unused slots; every real light remains unchanged.
All actual count combinations still render with prepared programs, including fresh
unlit muzzle/particle materials and future armed encounters. Training retains its
original count policy. The added per-frame work is one visible-scene light count
and at most three dark slots; native frame-time impact must be accepted separately.

Area 51 APEX now loads in **55.31 s** on Chromium 154/SwiftShader, versus **186.45 s**
on main (70.3% reduction). Combat submissions fell from 806 to 208 and light states
from 31 to eight. The first gameplay CPU render was 11.4 ms; main was 15.6 ms.
Actual movement/fire, fresh security/marine/Spartan models and a 21-armed-enemy
renderer fixture produced no new gameplay programs or page errors. This is not
a full campaign playthrough or a guarantee of stutter-free native gameplay.

The focused WebGL regression now verifies all 22 actual transient light counts,
normalized states, cancellation/resize restoration and lit pixel equivalence:
maximum pixel difference with three dark slots was **zero**. Unit coverage checks
every base count 0–50 with every extra-light allowance 0–32, exact geometry-range
restoration including thrown submissions, multi-material groups, missing RAF
delivery, timeout fence cleanup and existing preparation ownership.

## Full-game validation

| Cold deployment | Click to playing | First gameplay CPU render |
| --- | ---: | ---: |
| Area 51 / USMC | 17.68 s | 10.3 ms |
| Area 51 / APEX | 55.31 s | 11.4 ms |
| Shattered Wall / USMC | 11.58 s | 16.3 ms |
| Shattered Wall / APEX | 12.43 s | 14.2 ms |

All four combinations passed actual movement/fire and rapid camera turning,
return to lobby, and zero new gameplay shader programs/page errors. Both offshore
runs exercised signal activation, first holdout wave and helicopter arrival. Area
51 exercised fresh campaign archetypes; APEX additionally exercised 21 armed
enemies. These are bounded renderer/gameplay fixtures, not full campaign playthroughs.
The timing table uses the default loadout. Scoped cold/warm/replay checks are
recorded separately, including actual RMB ADS and a cancel/redeploy sequence.

`npm run lint`, `npm run build`, and all 12 non-browser `test:*` suites passed on
the final implementation. `test:controls:browser` passed DOM input and actual Training
deployment/replay/lobby with the existing reduced-count controls fixture.
`test:preparation:browser` passed the real WebGL checks described above.
The existing large-bundle build advisory remains.

Completion has a per-wait 30 s timeout and a bounded whole-run profiling deadline.
Loading progress still paints between batches and cancellation retains its
abort/context teardown checks. Individual driver calls cannot be preempted: this
software renderer recorded loading long tasks up to 1.59 s and an APEX progress
gap up to 3.91 s. Maximum CPU submission in the forced 21-enemy first-use fixture
was 119.8 ms, despite zero new shader programs. Native responsiveness, frame times,
GPU timing, visual campaign acceptance and long-session memory remain unverified.

The corrected scoped Area 51 APEX lifecycle run passed RMB ADS, firing/movement,
scope visibility, actual archetype/max-light rendering and zero new shader
programs/page errors after cancellation, cold, warm and replay. Loading times:
54.20 / 77.78 / 65.58 s; first gameplay CPU submissions: 9.8 / 8.2 / 7.3 ms.
Cancellation during combat preparation left zero prepared actors, an empty retired
scene, a lost retired WebGL context and no stale playing frames. The forced
maximum-enemy replay fixture had a **1.81 s CPU render submission outlier** even
without new shader programs. This software-renderer stress result does not prove
later native encounters are stutter-free; acceptance and a native trace remain
required before merge. A previous scope assertion failure was isolated to the
old profiling harness setting ADS directly; it now invokes the real RMB handler
introduced by PR #13 and the scoped checks pass.

Scoped Shattered Wall APEX cold/warm/replay also passed: 11.36 / 14.20 / 9.26 s,
with real RMB ADS/scope, movement/fire, signal/wave/helicopter fixtures, lobby
return, cancellation cleanup and zero new shader programs/page errors.

## Publication / resume

Both implementation checkpoints were pushed to the dedicated feature branch.
Draft PR: <https://github.com/fcootes/Gun-Arena-V2/pull/14>.
GitHub API access recovered after the saved network-domain change propagated;
API evidence confirms PR #13 is merged. The linked Vercel project is
`fcootes/gun-arena-v2`; each feature-branch push creates a Preview deployment.
The preview endpoint redirects anonymous requests to Vercel Login, so deployment
success does not establish anonymous application access or remote gameplay checks.
Do not disable protection or deploy production as part of this repair.

Before merging, accept the repair on the user's laptop: test both APEX maps and
USMC controls, loading cancellation/redeploy, actual first fire/ADS/movement,
warm replay and later security/marine/Spartan or offshore helicopter encounters.
Record native GPU/browser, loading times and a Performance trace; confirm the
small dark-light padding overhead preserves the previously smooth gameplay.

Raw browser output is currently under ignored `performance-results/`.
Run from `/workspace/Gun-Arena-V2`, using system Chromium here:

```sh
BENCHMARK_BROWSER=/usr/bin/chromium BENCHMARK_SINGLE_PROCESS=1 DISABLE_HMR=true \
PROFILE_FACTION=apex PROFILE_MAP=area51 PROFILE_ENCOUNTERS=1 PROFILE_ASSERT_STABLE=1 \
node scripts/profile-first-use.mjs . performance-results/apex-repair-area51.json
```

Use a fresh browser process per cold combination. SwiftShader timings are not
laptop GPU timing/FPS; native Surface/laptop acceptance remains necessary.
