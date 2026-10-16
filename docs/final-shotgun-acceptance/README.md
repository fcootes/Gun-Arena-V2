# Final shotgun acceptance and screen-left sprint — 16 October 2026

Both existing PRs remain drafts. Main and production are untouched. User visual
approval is pending; no sniper or later weapon overhaul has begun.

| Stage | Original head | Reviewed runtime / integration |
| --- | --- | --- |
| PR #15, shared sprint | `3778c568db1162d40822676d5d31ffc385b0681a` | `c7db9ef69a4498e75d412fbaf137db7b2cefc4ab` |
| PR #17, shotgun | `02a31e9ce4ee30ec09ab5464fae96293c2cb15aa` | `d58d52193ae80c2fc929cb2d51c9625eaf09bef1` |
| Safe foundation integration into PR #17 | PR #15 feature branch | merge `5b38a0e57240cdceb8a99d466e2d3594263c1951` |

PR #15 contains the shared sprint correction and its tests/evidence. PR #17
incorporates it through a normal merge, then adds shotgun timing/hand/roll polish
and one proven shotgun HUD-label correction. The final evidence head and both
exact-head preview URLs are recorded in the PR descriptions.
[Expanded exact file manifests for each stage](changed-files.json).

[Shared sprint: nine matched actual-input before/after cases](../sprint-left-acceptance/README.md).
Camera-local +X projects right. The default sprint now moves the receiver from
+.22 m to −.05 m and changes muzzle yaw from −.85 to +.72 rad, with downward pitch.
Pistol and heavy classes retain shallower profiles. Both the actual muzzle and
receiver project screen-left for all twelve weapons. Forward/strafe/turn, release
while moving, immediate ADS, pistol/heavy switching, wide viewport, pause and
lobby passed. Speeds, controls, physics and existing alternating sway/interpolation
are unchanged.

## Pump timing

| Fired action | Before (s) | After (s) |
| --- | --- | --- |
| Report/recoil start | 0 | 0 |
| Recovery before pump | 0–.180 | 0–.320 |
| Rearward stroke | .180–.410 | .320–.520 |
| Rear stop | .410–.440 | .520–.540 |
| Forward stroke | .440–.660 | .540–.760 |
| Lock/settle | .660–.740 | .760–.840 |
| Total mechanical cycle | .740 | .840 |
| Nominal next-shot interval | .850 | .850 |

The pump starts **140 ms later** and the full action gains **100 ms**, remaining
inside the unchanged .850 s fire interval. At 30/60/144 Hz the first ready frame
is no later than the same frame that the existing fire interval permits; premature
refire remains blocked. The same timeline drives the pump, attached hand,
chamber state and audio event. Recoil recovery is asymmetric through .285 s.

The reused .420 s pump clip fits the .440 s moving interval at rate ≈.955. The
separate shot tail continues naturally. All WAV files are unchanged. Damage,
spread, magazine and reserve values are unchanged. Standard empty reload gains
.100 s (6.320 → 6.420 s for six shells); class multipliers scale its phases.
Tactical shell windows stay .850 s, with transfer/cue at .612 s into each window.
Interruptions retain chamber progress and its already-emitted pump flag.
[Simulation events and observed frame quantization](timing.json).

## Reload angle, hand and chamber prompt

Authored shotgun roll reduces from **−1.250 rad (−71.62°)** to **−.520 rad
(−29.79°)**. A modest lift/rightward adjustment keeps the underside accessible
from the actual camera at the smaller roll. Only first-person presentation changes;
armory/actor geometry and normal shotgun hip/ADS framing are unchanged.

The existing shared glove rig has separate shotgun grip and pressing attachments.
The hand releases the pump, forms an opposed grip around the brass rim, carries
the shell to the underside opening, then tucks its fingers below the receiver
while the thumb presses the base. Tests check the articulated thumb pad's contact
range during carry and final pressing, plus the shell's clearance against the
real receiver and trigger guard. Explicit intermediate wrist orientations replace
the fixed palm-up pose. Sleeves retain their bounded .25 m length. The last shell
resets toward the pump; chamber/close phases start from the preceding hand pose
rather than snapping back to pickup. Five repeated reloads restore the original
pump grip, thumb and framing without accumulation.

The reported **4 / 10** case is valid when four stored shells have been loaded
but `needsChamber` remains true. A different defect was reproduced: the old label
still said EMPTY CHAMBER in the close phase after chambering was complete. That
shotgun-only case now says FINISHING RELOAD. Real HUD-markup tests and the images
cover both states and disappearance of the badge when ready.

## Matched rendered samples

These are deterministic state-clock phase samples in the actual Training scene,
game camera and HUD, at 1280×720 or 1680×720. Reload comparisons use the same
action fraction; pump milestones use each version's actual timeline. Procedural
world backgrounds may differ. Stills establish geometry/contact; the separate
continuous recording below uses actual gameplay input without forced poses or
clock advancement.

| Case | Before | After |
| --- | --- | --- |
| rifle-hip | ![Before rifle-hip](before/rifle-hip.png) | ![After rifle-hip](after/rifle-hip.png) |
| hip | ![Before hip](before/hip.png) | ![After hip](after/hip.png) |
| ads | ![Before ads](before/ads.png) | ![After ads](after/ads.png) |
| shot-instant | ![Before shot-instant](before/shot-instant.png) | ![After shot-instant](after/shot-instant.png) |
| peak-recoil | ![Before peak-recoil](before/peak-recoil.png) | ![After peak-recoil](after/peak-recoil.png) |
| recovery | ![Before recovery](before/recovery.png) | ![After recovery](after/recovery.png) |
| pump-start | ![Before pump-start](before/pump-start.png) | ![After pump-start](after/pump-start.png) |
| pump-rear | ![Before pump-rear](before/pump-rear.png) | ![After pump-rear](after/pump-rear.png) |
| pump-forward | ![Before pump-forward](before/pump-forward.png) | ![After pump-forward](after/pump-forward.png) |
| pump-lock | ![Before pump-lock](before/pump-lock.png) | ![After pump-lock](after/pump-lock.png) |
| ready | ![Before ready](before/ready.png) | ![After ready](after/ready.png) |
| shell-grip | ![Before shell-grip](before/shell-grip.png) | ![After shell-grip](after/shell-grip.png) |
| shell-approach | ![Before shell-approach](before/shell-approach.png) | ![After shell-approach](after/shell-approach.png) |
| shell-press | ![Before shell-press](before/shell-press.png) | ![After shell-press](after/shell-press.png) |
| shell-seated | ![Before shell-seated](before/shell-seated.png) | ![After shell-seated](after/shell-seated.png) |
| shell-reset | ![Before shell-reset](before/shell-reset.png) | ![After shell-reset](after/shell-reset.png) |
| reload-max-roll | ![Before reload-max-roll](before/reload-max-roll.png) | ![After reload-max-roll](after/reload-max-roll.png) |
| return-pump | ![Before return-pump](before/return-pump.png) | ![After return-pump](after/return-pump.png) |
| loaded-unchambered-4-10 | ![Before loaded-unchambered-4-10](before/loaded-unchambered-4-10.png) | ![After loaded-unchambered-4-10](after/loaded-unchambered-4-10.png) |
| empty-chamber | ![Before empty-chamber](before/empty-chamber.png) | ![After empty-chamber](after/empty-chamber.png) |
| chamber-closed-finishing | ![Before chamber-closed-finishing](before/chamber-closed-finishing.png) | ![After chamber-closed-finishing](after/chamber-closed-finishing.png) |
| reload-to-ads | ![Before reload-to-ads](before/reload-to-ads.png) | ![After reload-to-ads](after/reload-to-ads.png) |
| wide-hip | ![Before wide-hip](before/wide-hip.png) | ![After wide-hip](after/wide-hip.png) |
| wide-ads | ![Before wide-ads](before/wide-ads.png) | ![After wide-ads](after/wide-ads.png) |
| wide-shell | ![Before wide-shell](before/wide-shell.png) | ![After wide-shell](after/wide-shell.png) |

## Continuous gameplay and limits

[Play/download the 99.7-second continuous recording](gameplay-continuous.webm).
It shows left-side sprint/ADS recovery, two shots, a partial reload, six shots to
empty, a complete empty reload/chamber action and return to aim. Eight reports,
nine pump cues and eight seating cues were recorded, ending at **6 / 28**.
No cuts inside the sequence or retiming; video is muted.

SwiftShader sampled 348 frames across 99.31 s (about
3.49 FPS), at a fixed 1280×720 viewport with test-only 0.30 backing
pixel ratio. The game's existing 50 ms delta cap slows action at that rate.
**This footage cannot establish normal laptop pacing or native GPU performance.**
Use the separate timing log and playtest the preview for feel and sound. Stills
use full backing resolution. There is no real audio-audition tool in this environment.

The live run also passed holding fire before the first seated shell, pump switching,
chamber-only return, pause/resume, repeated R, death, redeployment and lobby. A
separate event-time switch probe verified shell-reload cancellation retains exactly
the shells already seated, with no later transfer and a valid shot on return.
[Live sprint](live-sprint.png), [sprint-to-ADS](live-sprint-stop-ads.png),
[partial ready](live-partial-ready.png), [empty ready](live-empty-ready.png),
[switch during pump](switch-pump-before.png),
[switch during reload](switch-reload-before.png), [return fire](switch-return-fire.png).

## Validation and performance boundaries

TypeScript, build, shotgun, weapon, tactical, viewmodel/hand, audio, input, runtime
and preparation checks passed. Build retains its existing large-bundle advisory.
Actual sprint, shotgun, DOM input, switch and App lifecycle checks passed without
page errors. The other eleven families exactly preserve FP/actor geometry/materials,
hip/ADS/reload/sprint poses and hand buffers relative to the integrated foundation,
including the accepted AR/pistol work.

No mesh, geometry or material is allocated per animation frame. The same eight
hand meshes and two reused 30-instance palettes remain; owned resources dispose
once. No model geometry or shader-preparation code changed. The preparation fixture
retained 22 light variants, 98 draws, 43
bounded batches and 92 programs, with zero lighting-pixel difference
and successful resize/cancel/state restoration. Its 8.22 s
software runtime is not a native-device benchmark. All 25 after-pose samples
retained the same program-list size (100 programs).

[Structured validation and actual frame/audio event log](validation.json).
Reproduce with `node scripts/test-shotgun-polish-browser.mjs` (`SHOTGUN_ROOT`,
`SHOTGUN_BASELINE=1`, `SHOTGUN_OUTPUT` select baseline/output), then
`node scripts/export-shotgun-video.mjs <output>`.
`node --import tsx scripts/report-shotgun-polish-timing.ts <json>` writes timing
logs. Archived baselines are task inputs; no Git worktree was created.

Native-speed feel, sound and the subjective hand pose await user visual approval.
Both PRs remain draft; no sniper or later weapon overhaul has begun.
