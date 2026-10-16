# Shotgun before/after evidence

Baseline: PR #15 at `3778c568db1162d40822676d5d31ffc385b0681a`. After: runtime code `76678dee48ec333c90fb22535e55f1110fe05c27`.

These are deterministic presentation samples rendered in the actual Training scene with the game camera and HUD. They advance the real reload/action state at 144 Hz before rendering a single frame; they do **not** prove real-time pacing. Shot samples use equal elapsed times; reload comparisons use the same action fraction. World placement is procedural. Standard frames are 1280×720; wide frames are 1680×720. All rendering uses SwiftShader.

[Phase timings, state semantics and limitations](../shotgun-fidelity-batch1.md).

| Action | Before | After |
| --- | --- | --- |
| Hip carry | ![Before Hip carry](before/hip.png) | ![After Hip carry](after/hip.png) |
| ADS | ![Before ADS](before/ads.png) | ![After ADS](after/ads.png) |
| Shot frame | ![Before Shot frame](before/shot-instant.png) | ![After Shot frame](after/shot-instant.png) |
| Peak recoil | ![Before Peak recoil](before/peak-recoil.png) | ![After Peak recoil](after/peak-recoil.png) |
| Recovery | ![Before Recovery](before/recovery.png) | ![After Recovery](after/recovery.png) |
| Pump rearward | ![Before Pump rearward](before/pump-rear.png) | ![After Pump rearward](after/pump-rear.png) |
| Pump forward | ![Before Pump forward](before/pump-forward.png) | ![After Pump forward](after/pump-forward.png) |
| Pump lock | ![Before Pump lock](before/pump-lock.png) | ![After Pump lock](after/pump-lock.png) |
| Ready | ![Before Ready](before/ready.png) | ![After Ready](after/ready.png) |
| Shell pickup | ![Before Shell pickup](before/tactical-pickup.png) | ![After Shell pickup](after/tactical-pickup.png) |
| Shell approach | ![Before Shell approach](before/tactical-approach.png) | ![After Shell approach](after/tactical-approach.png) |
| Shell press | ![Before Shell press](before/tactical-press.png) | ![After Shell press](after/tactical-press.png) |
| Shell seated | ![Before Shell seated](before/tactical-seated.png) | ![After Shell seated](after/tactical-seated.png) |
| Empty first shell | ![Before Empty first shell](before/empty-first.png) | ![After Empty first shell](after/empty-first.png) |
| Empty middle shell | ![Before Empty middle shell](before/empty-middle.png) | ![After Empty middle shell](after/empty-middle.png) |
| Empty last shell | ![Before Empty last shell](before/empty-last.png) | ![After Empty last shell](after/empty-last.png) |
| Empty chamber | ![Before Empty chamber](before/empty-chamber.png) | ![After Empty chamber](after/empty-chamber.png) |
| Wide hip | ![Before Wide hip](before/wide-hip.png) | ![After Wide hip](after/wide-hip.png) |
| Wide ADS | ![Before Wide ADS](before/wide-ads.png) | ![After Wide ADS](after/wide-ads.png) |
| Wide press | ![Before Wide press](before/wide-shell.png) | ![After Wide press](after/wide-shell.png) |

## Continuous actual gameplay

[Play/download the 97.4-second continuous shotgun recording](shotgun-continuous.webm).
This interval contains two shots, a partial reload, six shots to empty, an empty
reload interrupted by held fire after two seated shells, the chamber action and
resumed shot, then the final reload. It is the original browser recording clock,
with no retiming or cuts within the sequence. It contains no captured audio.

**Pacing limitation:** SwiftShader sampled about 3.52 game frames/s during this
recording. The game's existing 50 ms delta cap slows simulation at that rate;
this footage shows continuity and contact but does not establish normal laptop
pacing. The deterministic 30/60/144 Hz tests verify simulation timings. Rendering
uses a 1280×720 viewport with test-only 0.65 backing pixel ratio. Stills above use
full backing resolution. Native rendering and the sound blend need playtesting.

The live event log has nine reports, ten pumps (including the interrupted empty
chamber) and nine real seating cues, finishing with `6 / 27` ammunition. Held
fire before the first shell, pump switching/chamber-only recovery, pause/resume,
repeated R, death/replay and lobby return passed separately in the same run.

[Structured validation, phase samples, live frame/audio event log and checks](validation.json).

## Live switch/cancellation samples

A separate actual-input run captures the pump and shell-loading switch paths.
It snapshots ammunition on the real `Digit2` event so a shell already seated
before switching is preserved exactly. It verifies cancellation of queued fire,
required chamber-only recovery after a pump switch, no transfers after reload
cancellation and a valid shot after returning. The shell-switch case seeds a
partial magazine as initial test setup; transitions use normal R/1/2/mouse input.

| State | Actual rendered image |
| --- | --- |
| switch-pump-before | ![switch-pump-before](switch-pump-before.png) |
| switch-pump-away | ![switch-pump-away](switch-pump-away.png) |
| switch-pump-return | ![switch-pump-return](switch-pump-return.png) |
| switch-reload-before | ![switch-reload-before](switch-reload-before.png) |
| switch-reload-away | ![switch-reload-away](switch-reload-away.png) |
| switch-reload-return | ![switch-reload-return](switch-reload-return.png) |
| switch-return-fire | ![switch-return-fire](switch-return-fire.png) |
