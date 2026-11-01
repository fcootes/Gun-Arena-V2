# W04 — Minigun first-person carry fidelity

Base: latest inspected main `11dc4c0e86b1d73912f5b58a44030983b2e21b40`, including accepted W03. No existing W04 branch/PR was found; this work uses `feat/w04-minigun-carry-fidelity`. The Engineer's separate [tripod-gun issue #28](https://github.com/fcootes/Gun-Arena-V2/issues/28) remains deferred.

## Scoped correction

The six-barrel model already had a fixed underslung `supportCradle`. Its hand configuration instead used a crossbar pose without a physical-part attachment. The firing glove also intersected the motor volume. The correction reuses the existing first-person control kit and cradle:

- Left wrist follows **`supportCradle` + (−.023, −.052, +.015) m**, with an underhand palm/finger orientation. Its palm contacts the actual 27 mm-radius stationary cylinder within 1 mm. Direct tracking avoids grip lag during recoil, movement and spin.
- Existing first-person control grip moves **45 mm down**; the firing wrist is calibrated to **(.038, −.150, .075)**. No barrel, motor, chute or inspection/actor geometry is rebuilt.
- Hip carry moves **55 mm lower / 50 mm forward**; ADS moves **40 mm lower / 50 mm forward**; sprint moves **20 mm lower / 30 mm forward**. Existing sprint angles remain unchanged.
- The existing thermal-hand reach is redirected outside the motor/chute envelope. This corrects geometric interference during the original reach/return phases; thermal state, phase durations, vent geometry, reload transactions and audio remain unchanged.

Both gloves and forearms remain on the same assembly as the grips. Full actual palm, instanced-finger and sleeve vertex sweeps cover firing, movement, direction reversal, ADS, sprint and cooling. Minimum sampled normal-carry clearances are approximately **6.9 mm to motor**, **11.2 mm to barrels** and **99 mm to the ammunition chute**. Forearms remain bounded at the existing .30 m length, with their ends below the camera viewport in the all-weapon suite.

## Heavy movement without input delay

`minigunCarry.ts` adds one preallocated critically damped presentation controller per viewmodel manager. The App passes existing horizontal velocity projected onto camera-local right/forward axes, only for the Minigun. Player velocity, movement physics, input, camera and firing ownership are unchanged.

| Tuning | Value |
|---|---:|
| Critical spring frequency | 18 rad/s |
| Cosmetic hip/ADS/sprint pose response | 10/s (rifle baseline remains 14/s) |
| Existing gait amplitude scale | .45 |
| Lateral / forward travel per m/s | .0018 / .0013 m |
| Downward compression per m/s | .00035 m |
| Presentation input bound | 8.6 m/s; no movement-speed limit is added |
| ADS inertia amplitude | .35 |
| Maximum carry travel | approximately 16 mm |
| Carry rotation | approximately 1° or less per axis |

The exact critical-damping solution gives matching 30/60/144 Hz results for acceleration, reversal and settling. Movement changes tilt/translate the supported assembly a small amount; stopping returns to rest. Handling/cooling fades the added inertia toward zero. Pause freezes it; switch, death and effect reset clear it. No geometry, materials, scene objects or temporary vectors are allocated by its per-frame update. No camera shake, aim-input delay or extra firing recoil is added.

## Preserved systems

[Other-weapon comparison](preserved-poses.json) proves identical geometry/materials, hip/ADS/sprint poses, articulated hand buffers and full reload states for the other eleven weapons. [Minigun geometry comparison](preserved-geometry.json) proves identical barrel/rotor geometry, fixed cradle geometry and complete bare actor/inspection model. The two existing barrel/spade model variants remain available to development tools.

[Preservation hashes](preserved-systems.json) cover the Engineer model/logic, world, input, class movement, reload/audio sources and original Minigun WAVs, plus the actual App firing and spin/heat/cooling blocks. Damage 16, .045 s nominal fire interval, six barrels, 999/999 belt supply, .50 s warmup, 28 rad/s full spin, original spin-down, four-second heat buildup and existing two-second emergency vent timer are unchanged. The existing generic thermal reload/action remains **2.20 s at multiplier 1**, also unchanged; no thermal-clock redesign is included.

## Actual first-person gameplay evidence

Images use the **actual App renderer**, existing maps/lighting and real keyboard/mouse/RAF gameplay. Rendering is suspended between explicit screenshots to make software WebGL automation practical; the actual movement, firing, audio and thermal code continues to run. These are gameplay screenshots, not a native GPU performance or audible-quality acceptance claim. No lights, materials or map objects are added by the fixture.

| State | Screenshot |
|---|---|
| Idle, Area 51 | [Idle](area51-idle.png) |
| ADS, Area 51 | [ADS](area51-ads.png) |
| Moving forward, Training Field | [Movement](moving-forward.png) |
| Direction change | [Reversal](direction-change.png) |
| Firing after real motor warmup | [Firing](firing.png) |
| Sprint entry / held carry / recovery | [Entry](sprint-enter.png) · [Sprint](sprint.png) · [Recovered](sprint-recovered.png) |
| Forced overheat / cooled ready | [Overheat](overheat.png) · [Cooled](cooled.png) |
| Matched Training Field idle comparison | [Before](before-idle.png) · [After](idle.png) |

[Gameplay states, source roots and capture provenance](gameplay-validation.json) and [observed native audio events](audio-events.json) accompany the images. Baseline images use an isolated copy of the inspected main. The Area 51 supplement uses the new feature code with the same pose-only test path.

## Verification and delivery

Reproduce the focused checks with `npm run test:minigun`. The live capture helper is `CHROMIUM_PATH=/usr/bin/chromium node scripts/test-minigun-carry-browser.mjs`; `MINIGUN_MAP=area51` selects existing Area 51 lighting. `MINIGUN_BASELINE=1` selects the pose-only path, and `MINIGUN_ROOT` selects an isolated baseline checkout. The eleven-weapon comparison is `EXCLUDE_MINIGUN=1 COMPARE_SPRINT=1 node --import tsx scripts/compare-viewmodel-preserved.mjs <baseline-root>`; its default all-weapon behavior is retained.

TypeScript, production build and **11 relevant test commands pass**: Minigun carry, weapons, viewmodel, audio, tactical/reload, controls, runtime, performance, Plasma tactile, Railgun and pistol sprint. The existing Vite bundle-size advisory remains. See [results](checks/results.json) and [full transcript](checks/transcript.txt).

Actual App checks pass warmup-before-fire, steady full-speed rotor, sustained firing, automatic overheating/cooling with unchanged 999/999 supply, observed original motor/fire/spin-down/hiss assets, pause freeze, switching/re-equip, ADS and sprint transitions. No page/shader errors occur. The complete other-weapon pose/reload comparison and actor/rotor/cradle comparison pass. Existing disposal tests pass, and cached carry updates create no GPU/scene objects.

[Exact changed files](changed-files.txt). Deliver as a dedicated **draft PR**, unmerged, with feature preview only. Native first-person feel and sound remain for developer review. No Engineer deployable changes, production deployment or later roadmap work.
