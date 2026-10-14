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

## Resume / outstanding work

1. Complete measured four-combination browser validation, with warm/replay,
   first-fire/movement, later APEX actor first use and cancellation/redeployment.
2. Compare the new full-game timings against the saved main baseline; revise the
   implementation if compact traversal alone does not sufficiently reduce cost.
3. Complete required existing tests and document results for the final commit.
4. Push checkpoints and create a draft PR. Git read access works, but GitHub API
   requests currently receive a proxy CONNECT 403. Required GitHub/Vercel API
   domains have been added to the environment configuration draft; saving the
   draft does not apply network policy to this running instance.
5. Verify Vercel project/commit and obtain a real preview if access is available.
   No production deployment or merge is authorized by this repair task.

Raw browser output is currently under ignored `performance-results/`.
Run from `/workspace/Gun-Arena-V2`, using system Chromium here:

```sh
BENCHMARK_BROWSER=/usr/bin/chromium BENCHMARK_SINGLE_PROCESS=1 DISABLE_HMR=true \
PROFILE_FACTION=apex PROFILE_MAP=area51 PROFILE_ENCOUNTERS=1 PROFILE_ASSERT_STABLE=1 \
node scripts/profile-first-use.mjs . performance-results/apex-repair-area51.json
```

Use a fresh browser process per cold combination. SwiftShader timings are not
laptop GPU timing/FPS; native Surface/laptop acceptance remains necessary.
