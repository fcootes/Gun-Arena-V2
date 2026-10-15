# PR #15 final viewmodel acceptance repair

Baseline: `4e3bab4fad18209f00d1f55a909e2be63c2a801b` on the existing
`feat/procedural-first-person-hands-20261015` branch. Main is still `794fdfd`.
This continues PR #15 and Issue #16's foundation work; the separate reload and
weapon redesign batches remain deferred. Original evidence is preserved in
[first-person-visual-repair.md](first-person-visual-repair.md).

The two supplied screenshots were inspected as normal carry (first) and sprint
(second). They show the sideways support wrist and raised sprint muzzle in the
current preview. The soldier reference and six-second recording mentioned in
the brief were not attached to this message; no claim is made to have viewed
them. New browser recordings and intermediate frame sequences accompany this repair.

## What caused the remaining defects

The old underhand palm normal pointed up, but its longitudinal/finger axis pointed
straight across +X. The sleeve approached the wrist from below and toward the eye,
creating a sharp bend even though its cylinder length was bounded. Thus the old
palm-normal and maximum-length tests could pass while the screenshot was wrong.

The shared sprint Euler had positive X pitch (+.22 radians), which raises the
muzzle of a −Z weapon. It also used the ordinary upward-only walk bob. Lowering
the receiver alone did not produce a lowered carry.

The AR chamber phase targeted the origin of the generic far-side bolt at
(+.039,+.017,+.075), then added a weapon-space reach offset (−.04,−.045,+.065).
That put the wrist near the receiver centre and rear, while the actual tiny
control was on the far side. The support hand used exponential lag and a generic
chamber orientation; no explicit approach/contact/release interval existed.
World-to-weapon conversion itself was correct. Replacing only a target pivot
would still leave the fingers hovering, so the new tests check control-surface
contact as well as matching the moving attachment.

## Holding and proportions

Underhand profiles now use an orthonormal basis measured against the handguard:
fingers approximately (.600,.250,−.760), palm normal (0,.950,.312). The palm sits
under the lower handguard plane (y −.030 on the rifles), with individual finger
curl angles (.85,1.05,.60) and a separate thumb curl. Palm width/thickness increase
slightly without adding vertices or meshes. This changes the palm, finger/thumbnail
arrangement and forearm continuation together, rather than rotating a flat fist
from one camera angle.

AR wrist position is (−.036,−.0605,−.24), with its palm contact inside the actual
64 mm handguard width. Hip placement is slightly lower/closer at
(.15,−.225,−.35). The left wrist/forearm axes meet within 45° in idle, and its cuff
begins in the lower part of the screen. AR cuff-to-elbow span is capped at .235 m
(.247 m including overlap). Shotgun, sniper and BR use .25 m spans. Other classes
retain their established bounds and appropriately directed torso targets.

The same corrected underhand basis is used on rifle/chassis/handguard supports
where appropriate. The shotgun attachment is calibrated to its pump's actual
radius: local pump offset (−.036,−.065,+.055), putting the palm under the pump
instead of inside it; live pump tracking remains. Pistol two-hand and SMG/launcher
vertical grips retain their orientation. The minigun's transverse cradle keeps
its distinct crossbar orientation. Firing-hand anchors remain unchanged.

## Sprint

Default rifle carry moves to (.22,−.28,−.42), with Euler
(−.25,−.85,+.10): the muzzle points down and laterally right, while both hands stay
on their weapon-local attachments. The receiver leaves the firing-ready position
and most sleeve length drops out of the frame. Pistol, minigun and launchers use
more restrained class-specific carry angles; the railgun retains its additional
rear clearance.

Sprint sway is limited to 4.5 mm lateral, 3 mm alternating vertical and .004 rad
roll, driven by the existing movement clock. A separate exponential run blend
fades sway in/out and removes ordinary upward walk bob while running. Existing
position/quaternion interpolation handles sprint entry, stop and immediate ADS.
Movement, grounding, sprint speed, keys, camera and all gameplay flags are unchanged.
Tests compare 30/144 Hz carry and sway, verify the muzzle direction, and check
readiness/ADS restoration without transform accumulation.

## AR empty reload

Only first-person AR construction moves `parts.bolt` to an eye-near receiver
charging latch at (−.045,+.048,+.025). Its existing mesh and material are retained.
Every other family, and default AR actor/lobby/studio assemblies, keep the
original handle geometry/transform. Default assemblies are compared against the
baseline for all twelve weapons, including world-space geometry/material/draw
count and muzzle position.

Within the existing empty-reload chamber phase:

| Fraction | Presentation |
| --- | --- |
| 0–.22 | Smooth approach from the magazine pose to the latch |
| .22–.48 | Hand contacts the current part and pulls it back 45 mm |
| .48–.60 | Brief operating hold |
| .60–.82 | Control returns while the fingers remain attached |
| .82–1 | Release and return toward the support grip |

The tracked part-local wrist offset is (−.038,−.020,+.078). It includes the glove's
actual finger reach: index/middle capsules touch the latch's measured box bounds.
Position is exact during contact instead of lagging behind the control. Reach
and release positions/orientations blend separately. The wrist stays ahead of
z +.15 and the glove remains ahead of the stock; it does not reach behind the gun.
The firing hand remains anchored throughout.

Tactical reloads have no chamber phase and no latch stroke. Empty magazine
insertion, ammunition transfer, chamber completion and reload finish all retain
the existing state machine and durations. AR empty audio's chamber boundary remains
2.2165 seconds into the 3.41-second sequence. Sound assets and audio dispatch are
unchanged; native audiovisual acceptance remains a manual check.

## Validation method and limits

The matching browser fixture uses Chromium/SwiftShader, FOV 74, 1280×720/DPR 1,
identical lighting and per-weapon ADS FOVs. Additional 1920×960 captures match the
approximately 2:1 framing of the supplied screenshots. Frame sequences advance
the actual reload state machine and presentation at 60 Hz and render selected
intermediate instants; they are labelled fixture samples, not native gameplay.
Two detail cameras inspect the support hand from below and from the side.

The live App checks use real lobby deployment and real fire/reload controls.
The recorded AR scenario begins with one round, fires it, then performs an empty
reload without pausing, advancing state from the fixture, or forcing presentation
poses during the cycle. Live screenshots sample actual phase clocks. Each request
can incur render latency, so precise contact fractions should be assessed in the
deterministic fixture frames alongside the uninterrupted live recording.

Playwright records browser video without audio. The exported clip preserves a
continuous interval on the browser recorder's original clock around the last shot and full reload; it is not
retimed to imply native frame rates. Software rendering is visibly slow and does
not establish laptop GPU performance. Optional recording requires Playwright's
FFmpeg executable; this workspace uses the installed system FFmpeg through a
workspace-local Playwright cache alias. No dependency or lockfile changes were needed.

The full gallery retains all twelve weapons, both palettes, hip/ADS, relevant
sprint/reload poses, scoped visibility, slot/perspective switching, pause/resume,
death/replay/lobby checks and one shared rig. Tests cover actual handguard/control
contact, wrist alignment, screen-space cuff placement, full-weapon near-plane
bounds, all reload families, allocation invariants and exactly-once disposal.
The production bundle must not contain test-only hooks.

Native laptop acceptance, long-session frame times, and fine glove/contact polish
under arbitrary FOV/display scaling remain manual. A low lateral carry naturally
occludes more of the firing hand and moves part of the gun outside the lower-right
frame at narrower aspect ratios. All weapon-specific reload overhauls in Issue #16
remain separate. No HUD, world, campaign, sound asset, faction actor, gameplay
balance, movement or APEX preparation orchestration changes are included.

## Before / after

Both columns are browser WebGL fixture captures from the indicated commits with
identical camera, viewport and lighting. Wide images use 1920×960; others 1280×720.

| Case | Before (`4e3bab4`) | After |
| --- | --- | --- |
| Wide normal carry | ![Before normal](final-viewmodel-images/before-wide-idle.png) | ![After normal](final-viewmodel-images/accept-wide-idle.png) |
| Wide sprint | ![Before sprint](final-viewmodel-images/before-wide-sprint.png) | ![After sprint](final-viewmodel-images/accept-wide-sprint.png) |
| Underhand detail | ![Before palm](final-viewmodel-images/before-support-detail.png) | ![After palm](final-viewmodel-images/accept-support-detail.png) |
| Sprint stop → ADS | ![Before ADS](final-viewmodel-images/before-stop-ads.png) | ![After ADS](final-viewmodel-images/accept-stop-ads.png) |
| Empty charging pull | ![Before chamber](final-viewmodel-images/before-empty-255.png) | ![After chamber](final-viewmodel-images/accept-empty-255.png) |
| Empty release | ![Before release](final-viewmodel-images/before-empty-285.png) | ![After release](final-viewmodel-images/accept-empty-285.png) |

Sprint entry/return frame sequence (fixture time, no state changes):

| Enter .10 s | Enter .25 s | Carry 1 s |
| --- | --- | --- |
| ![Enter](final-viewmodel-images/accept-sprint-enter-10.png) | ![Enter](final-viewmodel-images/accept-sprint-enter-25.png) | ![Carry](final-viewmodel-images/accept-sprint-carry.png) |

| Stop .10 s | Stop .25 s | Ready 1 s |
| --- | --- | --- |
| ![Stop](final-viewmodel-images/accept-sprint-stop-10.png) | ![Stop](final-viewmodel-images/accept-sprint-stop-25.png) | ![Ready](final-viewmodel-images/accept-sprint-ready.png) |

AR empty-reload samples are seconds after reload begins:

| Magazine insertion (1.90 s) | Approach (2.24 s) | Pull/contact (2.55 s) |
| --- | --- | --- |
| ![Insert](final-viewmodel-images/accept-empty-190.png) | ![Reach](final-viewmodel-images/accept-empty-224.png) | ![Pull](final-viewmodel-images/accept-empty-255.png) |

| Return/control (2.72 s) | Release (2.85 s) | Ready (3.42 s) |
| --- | --- | --- |
| ![Return](final-viewmodel-images/accept-empty-272.png) | ![Release](final-viewmodel-images/accept-empty-285.png) | ![Ready](final-viewmodel-images/accept-empty-342.png) |

Tactical sequence: [eject .20 s](final-viewmodel-images/accept-tactical-20.png),
[insert .90 s](final-viewmodel-images/accept-tactical-90.png),
[close 1.70 s](final-viewmodel-images/accept-tactical-170.png),
[ready 1.94 s](final-viewmodel-images/accept-tactical-194.png).
There is no charging stroke in this sequence.

[Continuous live last-shot → empty reload recording](final-viewmodel-images/live-ar-fire-empty-reload.webm)
(software WebGL, muted, original recording clock). Clip boundaries are matched
to the actual last-shot/ready screenshots; a short lead-in retains the shot.
The raw full recording remains in ignored performance results. The exported
clip was visually inspected at its start, middle and end.

Actual App frames: [USMC charging contact](final-viewmodel-images/live-usmc-chamber-0.35.png),
[USMC release](final-viewmodel-images/live-usmc-chamber-0.62.png),
[APEX charging contact](final-viewmodel-images/live-apex-chamber-0.35.png),
[APEX release](final-viewmodel-images/live-apex-chamber-0.62.png),
[shotgun](final-viewmodel-images/game-usmc-shotgun-idle.png),
[BR](final-viewmodel-images/game-usmc-br-idle.png),
[sniper](final-viewmodel-images/game-usmc-sniper-idle.png),
[sniper scope](final-viewmodel-images/game-usmc-sniper-aim.png),
[minigun](final-viewmodel-images/game-usmc-minigun-idle.png),
[minigun carry](final-viewmodel-images/game-usmc-minigun-sprint.png),
[APEX AR palette](final-viewmodel-images/game-apex-ar-idle.png).
Pistol carry is shown in the [APEX fixture](final-viewmodel-images/apex-pistol-sprint.png).

A separate actual-input probe uses no forced settle or clock advancement:
[straight W/Shift](final-viewmodel-images/input-straight-sprint.png),
[W → D direction change](final-viewmodel-images/input-direction-change-sprint.png),
[release → immediate RMB ADS](final-viewmodel-images/input-stop-immediate-ads.png).
It verifies attached support grip, unchanged ammo/reload flags, and pause/resume
before returning to the lobby.

## Final results and performance

TypeScript and production build passed (existing large-bundle advisory only).
All six required viewmodel/weapons/tactical/controls/runtime/preparation suites
passed. The full repaired browser run passed all twelve weapons and both factions,
27 deterministic intermediate-pose samples, two actual live AR empty cycles,
normal-loadout shader stability and the full pause/switch/perspective/death/replay/
lobby lifecycle. The separate real-input sprint probe passed without forced poses.
No page errors occurred. Production assets contain no test-only hooks.

AR wrist/forearm angle improves from 74.7° to
30.8°. At the matching 1280×720/FOV 74 camera, projected cuff-centre
distance to the bottom edge falls from 165.9 px to
103.8 px. This is a centreline screen-space measure, not a complete
segmented sleeve-pixel count; it supplements the visual comparisons.

| Held weapon | Before calls / triangles | After calls / triangles |
| --- | ---: | ---: |
| ar | 19 / 22,252 | 19 / 22,252 |
| pistol | 19 / 13,340 | 19 / 13,340 |
| sniper | 17 / 21,664 | 17 / 21,664 |
| br | 15 / 20,140 | 15 / 20,140 |
| minigun | 19 / 14,556 | 19 / 14,556 |
| shotgun | 14 / 15,060 | 14 / 15,060 |
| smg | 18 / 20,312 | 18 / 20,312 |
| lmg | 17 / 23,648 | 17 / 23,648 |
| laser | 14 / 9,924 | 14 / 9,924 |
| railgun | 18 / 12,682 | 18 / 12,682 |
| rocket | 13 / 12,904 | 13 / 12,904 |
| grenade_launcher | 16 / 11,076 | 16 / 11,076 |

CPU pose-update p95 is approximately 0.10 ms before and
0.10 ms after, at coarse timer resolution. Maximum samples were
2.20/4.30 ms. Recording was active in the after run; these short
CPU observations do not establish zero overhead or native GPU/frame-time parity.
The shared pair remains eight meshes, six owned geometries, three materials and
two 30-instance palettes. No per-frame geometry/material/scene-object construction
occurs after preparation; cleanup tests release every owned resource once.

WebGL preparation passed all 22 light-count variants with 98 draws,
48 bounded batches, 92 programs, resize/cancellation restoration and
zero pixel difference. Its 13.06 s runtime is a software fixture observation.
The APEX lighting/deployment pipeline is unchanged.

[Structured evidence and exact file manifest](final-viewmodel-validation.json).

## Exact changes from `4e3bab4`

72 changed files, including 59 PNGs and one WebM:

- `docs/final-viewmodel-acceptance.md`
- `docs/final-viewmodel-images/accept-ar-idle.png`
- `docs/final-viewmodel-images/accept-empty-120.png`
- `docs/final-viewmodel-images/accept-empty-190.png`
- `docs/final-viewmodel-images/accept-empty-224.png`
- `docs/final-viewmodel-images/accept-empty-237.png`
- `docs/final-viewmodel-images/accept-empty-25.png`
- `docs/final-viewmodel-images/accept-empty-255.png`
- `docs/final-viewmodel-images/accept-empty-272.png`
- `docs/final-viewmodel-images/accept-empty-285.png`
- `docs/final-viewmodel-images/accept-empty-300.png`
- `docs/final-viewmodel-images/accept-empty-342.png`
- `docs/final-viewmodel-images/accept-empty-65.png`
- `docs/final-viewmodel-images/accept-sprint-carry.png`
- `docs/final-viewmodel-images/accept-sprint-enter-10.png`
- `docs/final-viewmodel-images/accept-sprint-enter-25.png`
- `docs/final-viewmodel-images/accept-sprint-ready.png`
- `docs/final-viewmodel-images/accept-sprint-stop-10.png`
- `docs/final-viewmodel-images/accept-sprint-stop-25.png`
- `docs/final-viewmodel-images/accept-stop-ads.png`
- `docs/final-viewmodel-images/accept-support-detail.png`
- `docs/final-viewmodel-images/accept-support-side.png`
- `docs/final-viewmodel-images/accept-tactical-130.png`
- `docs/final-viewmodel-images/accept-tactical-170.png`
- `docs/final-viewmodel-images/accept-tactical-194.png`
- `docs/final-viewmodel-images/accept-tactical-20.png`
- `docs/final-viewmodel-images/accept-tactical-50.png`
- `docs/final-viewmodel-images/accept-tactical-90.png`
- `docs/final-viewmodel-images/accept-wide-idle.png`
- `docs/final-viewmodel-images/accept-wide-sprint.png`
- `docs/final-viewmodel-images/apex-pistol-sprint.png`
- `docs/final-viewmodel-images/before-ar-idle.png`
- `docs/final-viewmodel-images/before-empty-255.png`
- `docs/final-viewmodel-images/before-empty-285.png`
- `docs/final-viewmodel-images/before-sprint-carry.png`
- `docs/final-viewmodel-images/before-stop-ads.png`
- `docs/final-viewmodel-images/before-support-detail.png`
- `docs/final-viewmodel-images/before-wide-idle.png`
- `docs/final-viewmodel-images/before-wide-sprint.png`
- `docs/final-viewmodel-images/game-apex-ar-idle.png`
- `docs/final-viewmodel-images/game-usmc-br-idle.png`
- `docs/final-viewmodel-images/game-usmc-minigun-idle.png`
- `docs/final-viewmodel-images/game-usmc-minigun-sprint.png`
- `docs/final-viewmodel-images/game-usmc-shotgun-idle.png`
- `docs/final-viewmodel-images/game-usmc-sniper-aim.png`
- `docs/final-viewmodel-images/game-usmc-sniper-idle.png`
- `docs/final-viewmodel-images/input-direction-change-sprint.png`
- `docs/final-viewmodel-images/input-ready.png`
- `docs/final-viewmodel-images/input-stop-immediate-ads.png`
- `docs/final-viewmodel-images/input-straight-sprint.png`
- `docs/final-viewmodel-images/live-apex-chamber-0.35.png`
- `docs/final-viewmodel-images/live-apex-chamber-0.62.png`
- `docs/final-viewmodel-images/live-apex-ready.png`
- `docs/final-viewmodel-images/live-ar-fire-empty-reload.webm`
- `docs/final-viewmodel-images/live-usmc-chamber-0.35.png`
- `docs/final-viewmodel-images/live-usmc-chamber-0.62.png`
- `docs/final-viewmodel-images/live-usmc-close-0.35.png`
- `docs/final-viewmodel-images/live-usmc-eject-0.3.png`
- `docs/final-viewmodel-images/live-usmc-insert-0.45.png`
- `docs/final-viewmodel-images/live-usmc-last-shot.png`
- `docs/final-viewmodel-images/live-usmc-ready.png`
- `docs/final-viewmodel-validation.json`
- `docs/first-person-visual-repair.md`
- `scripts/test-viewmodel-browser.mjs`
- `scripts/test-viewmodel-sprint-browser.mjs`
- `scripts/viewmodel-acceptance-sequence.mjs`
- `scripts/viewmodel-video-clip.mjs`
- `src/viewmodelGrips.ts`
- `src/viewmodelHands.ts`
- `src/weaponModels.ts`
- `src/weapons.ts`
- `tests/viewmodel.test.ts`
