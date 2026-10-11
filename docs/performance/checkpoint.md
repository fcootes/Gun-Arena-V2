# Interrupted repair checkpoint — 2026-10-10

Work is paused at the user's request. This checkpoint preserves existing
implementation, profiling tools and evidence only. No implementation, optimization,
browser benchmark or test was performed during checkpoint recovery. This is not
acceptance of the Surface Pro repair and is not a release or merge request.

## Repository state recovered

- Repository: `fcootes/Gun-Arena-V2`.
- Working directory: `/workspace/scratch/f68a5c06741b/Gun-Arena-V2`.
- Recovered local feature branch: `perf/first-use-stall-repair`.
- GitHub snapshot branch: `checkpoint/first-use-stall-repair-20261010`.
- Base and observed remote `main`: `3aae545867138b41f54867cd12613927eff17fe0`.
- Implementation HEAD before this documentation/evidence checkpoint: `1c4d368`.
- Three implementation commits were already intact; no commits were reconstructed
  or discarded. No active test or benchmark process was found during inspection.
- Before checkpointing, the only tracked uncommitted change was the smoke-browser
  timeout increase from 120 to 300 seconds. The profiling script, report and eight
  JSON evidence files listed below were untracked. There were no staged changes.
- The remote feature branch did not exist when checked. Direct Git push lacked
  terminal credentials, so publication uses the connected GitHub app on a separate
  checkpoint branch, with no force update and no merge into `main`.
- The GitHub snapshot preserves the final local tree. Original local commit
  history through checkpoint `9858d730972513df8a92ac7327affe12c47c18fa` is also
  preserved in `docs/performance/recovered-progress.bundle`, with prerequisite
  base `3aae545867138b41f54867cd12613927eff17fe0`. Its `HEAD` can be fetched into
  a fresh recovery branch in a repository containing that base. Original local
  commits and the local feature branch remain intact.

## Completed implementation preserved

| Commit | Completed work |
| --- | --- |
| `c993e6d` | Prepare actual render resources, composer/postprocessing, uploads, mission archetypes and combat variants before readiness; GPU/shader completion and cancellation cleanup; existing fog setup, shared immutable actor geometry, silent campaign audio preparation, selected viewmodel preparation, HUD/resize work and regression coverage. |
| `4670bf0` | Include unlit custom shader light-count keys in first-use preparation, covering armed campaign actor muzzle/particle formats. |
| `1c4d368` | Preserve resized composer target viewports during preparation cleanup; add the corresponding orchestration regression coverage. |

The checkpoint additionally saves the existing portable first-use profiling
harness, six-flow browser smoke timeout adjustment, repair report and measurements.
The harness instruments the development server; it does not add production probes.

## Files changed relative to the base

Implementation/configuration:

- `package.json`
- `src/App.tsx`
- `src/area51Campaign.ts`
- `src/area51World.ts`
- `src/botBuilder.ts`
- `src/campaignAudio.ts`
- `src/deployment.ts`
- `src/performance.ts`
- `src/renderPreparation.ts`
- `src/sceneEffects.ts`
- `src/weapons.ts`
- `src/world.ts`

Tests and profiling scripts:

- `tests/preparation.test.ts`
- `tests/runtime.test.ts`
- `scripts/profile-first-use.mjs`
- `scripts/smoke-browser.mjs`

Documentation and saved evidence:

- `docs/performance/checkpoint.md`
- `docs/performance/first-use-repair.md`
- `docs/performance/actor-preservation.json`
- `docs/performance/first-use-baseline.json`
- `docs/performance/first-use-cancellation.json`
- `docs/performance/first-use-offshore-replay.json`
- `docs/performance/first-use-repair.json`
- `docs/performance/first-use-smoke.json`
- `docs/performance/first-use-validation.json`
- `docs/performance/recovered-progress.bundle`

## Validation completed before the stop request

No checks below were rerun for this checkpoint.

- At `4670bf0`: lint, build and all eleven regression suites passed:
  `test:batch1`, `test:batch2`, `test:weapons`, `test:scenes`, `test:tactical`,
  `test:area51`, `test:bosses`, `test:runtime`, `test:audio`, `test:performance`
  and `test:preparation`. Results are in `first-use-validation.json`.
- After the viewport fix in `1c4d368`, the prior session completed
  `test:preparation`, lint and build successfully. These terminal results are
  documented here; the JSON validation file remains correctly labeled `4670bf0`.
- At `4670bf0`, all six map/faction smoke flows passed deployment, switching,
  pause/resume and lobby return with no page errors. Chromium 134 and SwiftShader
  were used. These runs preceded the final viewport fix.
- Four browser cancellation checkpoints passed on the earlier `c993e6d` version:
  lighting programs, geometry/textures/shadows, combat lighting draws and first
  complete render. The retired scene was empty, preparation actor count was zero,
  the context was lost and no stale playing frames ran. Later preparation changes
  have unit-test cancellation coverage, but the earlier browser cancellation
  evidence must not be presented as a final-commit browser run.
- A seeded comparison of 31 actor variants matched geometry buffers, transforms,
  material appearance values and hit/head membership. This is not full-scene
  screenshot or native-device visual acceptance.
- Baseline and repair profiles cover Area 51 cold/warm/replay, camera/ADS/fire,
  campaign actor first use and offshore signal/wave/helicopter boundaries.
  Final profiles use `4670bf0`; the separately saved offshore replay sample
  predates the unlit-key fix. See revision labels in the report/evidence.
- Vite's existing large-bundle advisory remained; builds succeeded.

## Findings and unfinished work

Software-renderer profiles show substantially reduced first gameplay CPU render
submission: Area 51 cold 2388.9 to 12.1 ms, warm 1911.0 to 8.8 ms, and offshore
1578.4 to 29.0 ms. Final tested phases introduced no new shader programs. These
measurements do not establish native GPU performance, FPS or repair acceptance.

Outstanding issues remain explicitly unresolved:

1. Native Surface Pro testing has not occurred. The reported thirty-second freeze,
   stable gameplay, native GPU timing and total time to interactive play remain
   unverified.
2. Preparation substantially increases observed SwiftShader loading: approximately
   47–63 seconds for Area 51 USMC, 29.5 seconds offshore and 175 seconds for
   Area 51 APEX in the profiling samples. Acceptability and loader responsiveness
   require native measurement; faster total loading is not established.
3. Large software-renderer gameplay frame intervals remain despite lower CPU
   submission. GPU/compositor cost and long-session memory/resource stability
   remain unverified. Prepared shader/resource counts are larger by design.
4. APEX armed actor construction still took approximately 59–82 ms.
5. Full manual campaign progression, boss encounters, cinematics and visual
   preservation on native hardware remain outstanding.
6. The final resize fix has orchestration regression coverage but has not received
   a subsequent browser resize/cancellation run or full browser rerun.
7. Large Chromium trace streams and temporary screenshots from earlier runs are
   outside this Git checkpoint. The report documents trace regeneration; committed
   JSON measurements and summaries are the durable profiling evidence.
8. No PR has been opened for this repair and no merge/deployment is authorized by
   this checkpoint. Further implementation and testing await the user's instruction
   to resume.

The detailed repair report contains future profiling and Surface acceptance
procedures. They are instructions for a later resumed session, not work performed
or authorized during this checkpoint.
