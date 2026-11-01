# W03 final acceptance correction

Continues `feat/plasma-repeater-fidelity` and existing draft [PR #26](https://github.com/fcootes/Gun-Arena-V2/pull/26) from verified head `36da49e2e8f6a839b57ea290428c21fd3072623b`. The supplied **Screen Recording 2026-11-01 184930.mp4** (12.966633 s, 1916×956, 30 FPS) was reviewed for the short seating tap, rushed heat reaction and firing presentation. The approved weapon geometry and effects are retained.

## Cartridge reload: 3.20 seconds

| Baseline time | Phase | Authoritative contact / motion |
|---|---|---|
| 0.00–0.44 | Present / thumb release | Original outside-first reach and thumb contact |
| 0.44–0.69 | Split panels open | Upper up / lower down; retention clears |
| 0.69–0.94 | Eject | Discard old charges once at .69; existing cosmetic ejection |
| 0.94–1.65 | Insert to 75% | Alignment at 1.4512; cartridge reaches original partial position |
| 1.65–2.07 | Wind back | Cartridge holds at 75%; palm retracts **105 mm** along seating axis |
| 2.07–2.23 | Fast slap | Cross gap in .0992 s; drive remaining 38 mm in .0608 s |
| 2.23–2.50 | Lock / settle | Cylinder reaches stop, retention engages, ammo commits once; palm holds pressure, receiver settles |
| 2.50–2.85 | Close panels | Hand clears hinge sweep before doors move |
| 2.85–3.20 | Recover | Support hand returns to foregrip; then firing unlocks |

The added time is concentrated in deliberate hand retraction and mechanical settling. It does not stretch the original action uniformly. `ReloadSequence` remains the only action clock; class duration multipliers apply once to every phase. There is no animation-only timer.

| Class | Multiplier | Reload | Forced recovery | Manual vent |
|---|---:|---:|---:|---:|
| Assault | .75 | 2.400 s | 2.175 s | 1.6875 s |
| Medic | .90 | 2.880 s | 2.610 s | 2.0250 s |
| Engineer / Support / Recon | 1 | 3.200 s | 2.900 s | 2.2500 s |

The hand retracts from X = −.098 to −.203 m in weapon space, with its Y/Z seating alignment retained. The remaining cartridge insertion is transverse +X through the original left-side bay. The full production palm/phalanges clear the pressure vessel and doors in 240 Hz geometry sweeps. At 2.23 s the cartridge reaches X = −.008, the support wrist reaches X = −.060 and exactly one 60-charge spare is committed. Cancellation before/after that instant retains actual resources, closes the actual mechanism and resets the cosmetic ejection object. Contact audio follows `PLASMA.seatTime` with class speed and late-cue suppression.

## Thermal actions

| Phase | Preventative manual vent | Forced recovery |
|---|---|---|
| Present | 0.00–0.24 | 0.00–0.24 |
| Operate control | 0.24–0.44 | 0.24–0.44 |
| Open shutters | 0.44–0.72 | 0.44–0.72 |
| Pressure release | 0.72–1.50 | 0.72–1.50 |
| Clear hand / heat reaction | 1.50–1.87, quiet clear hold | **1.50–2.40**, .24 s withdrawal + .66 s wave/settle |
| Close shutters | 1.87–2.05 | 2.40–2.58 |
| Recover | 2.05–2.25 | 2.58–2.90 |
| **Total** | **2.25 s** | **2.90 s** |

Forced recovery loosens the glove and withdraws the support hand to (−.285, −.090, −.100), outside the hot receiver/shutter/emitter envelope, then performs two broad decaying waves. Manual venting holds the clear glove without the discomfort reaction. Heat cooling, ammo retention and firing lockout stay on the existing sequence. The existing `heat_react` event fires only at forced reaction onset (1.50 s × class multiplier); it is the documented **safely silent future vocal hook**. No voice asset, injury effect, health penalty or new sound is added. Approved hiss stops when the relevant reaction phase ends; seating and all other WAVs are unchanged.

## Backward recoil and actual aim

| Parameter | Before | After |
|---|---:|---:|
| Spring frequency | 42 rad/s | 50 rad/s |
| Damping ratio | .72 | **1, critical** |
| Rearward velocity impulse | 2.35 m/s | 4.6 m/s |
| Pitch velocity impulse | 4.2 rad/s | .65 rad/s |
| Alternating lateral velocity | ±.16 m/s | ±.045 m/s |
| Alternating roll velocity | ±.54 rad/s | ±.12 rad/s |
| ADS visual amplitude | .62 | .62 |
| Single-shot peak rearward displacement | ~25.21 mm | **~33.84 mm at .020 s** |
| Single-shot peak model muzzle rise | ~2.58° | **~.274°** |
| Plasma aim impulse | .006 rad, automatically recovers | **.0045 rad / .258° persistent player pitch** |
| ADS aim impulse | same legacy camera path | **.002925 rad / .168° persistent player pitch** |

A single analytical critically damped spring compresses the assembly along its longitudinal +Z axis and returns without crossing rest. Physical rearward travel dominates the small secondary rise. Both articulated hands inherit the same firing-grip pivot; no shot-driven vertical oscillator or camera translation is introduced.

Only `firePlasmaShot` applies the weapon-local aim impulse, after successful pool acquisition. The bolt retains its **pre-recoil** target and immutable flight direction; the camera immediately adopts the new player pitch for the next shot. The legacy decaying `recoilPitch` receives no plasma impulse. Mouse movement owns the same player pitch, so it can compensate normally. The HUD crosshair stays centred on the true camera firing direction, with the existing hip/ADS spread retained. At eight shots per second, uncompensated hip aim climbs .036 rad / **2.063° per second**; ADS climbs **1.341° per second**. Trigger release settles the model without silently undoing player aim.

## Evidence and verification

TypeScript, the production build and **25 test commands** pass. The existing Vite large-bundle warning remains. Armory action controls pass; six model replacements remain at **24 geometries / 4 textures** with no page/shader errors. See [checks](checks/results.json) and the [full transcript](checks/transcript.txt).

The three clips use the **actual App/Three.js renderer and production mechanics**, a stationary Area 51 world and fixed diagnostic concrete/metal wall panels. They are silent, uninterrupted **30 FPS normal-speed simulation playback**, exported offline from 120 Hz gameplay steps in software WebGL. They are not native laptop real-time/performance acceptance. Each clip resets its starting inventory; each recorded action preserves its authoritative state throughout. Per-frame probes cover the final A/C takes; the uninterrupted B take is supported by the production pose samples and independent contact tests.

- [A — Controlled recoil](A-controlled-recoil.mp4)
- [B — Complete 3.20 s reload](B-reload-3p20s.mp4)
- [C — Fire to forced overheat, extended reaction and ready](C-forced-overheat-2p90s.mp4)
- [Per-frame A/C states and video provenance](video-provenance.json)
- [Actual App aim / projectile / frame-rate probes](aim-validation.json)
- [Pose states](poses.json), [test outputs](checks/) and [changed-file manifest](changed-files.txt)
- Previous version: [2.70 s reload / 2.25 s thermal / older recoil evidence](../tactile-evidence/README.md)

[Live input checks](live-validation.json) pass firing, automatic forced recovery, R/repeat-R, pause, switch, ADS/sprint/third person and death cancellation, without page/shader errors. Routine input assertions suspend the expensive software render; screenshots explicitly render, and the [unretimed reload recording](live-reload-unretimed.webm) restores continuous rendering. That capture took **155.0873 wall seconds for 3.20 simulation seconds** under software rendering contention and the existing .05 s frame-delta cap. It is separate from the three normal-speed simulation exports and establishes no native rendering performance claim.

Reproduction uses `CHROMIUM_PATH=/usr/bin/chromium node scripts/test-plasma-browser.mjs` with `PLASMA_ACCEPTANCE=1` for rendering/aim probes, and `PLASMA_LIVE=1 PLASMA_LIVE_ONLY=1 PLASMA_LIVE_LOGIC_FOCUS=1 PLASMA_LIVE_WIDTH=320` for input checks/unretimed reload. `PLASMA_CLIPS_ONLY=1 PLASMA_CLIP=A` or `C` renders a selected clip without repeating passed probes. The LMG audio browser regression uses `LMG_AUDIO_FOCUS=1`; no product configuration is changed.

Unit/integration coverage includes absolute phase boundaries, all class multipliers, held 75% insertion, 105 mm retraction, contact alignment, one ammo transaction, door ordering, forced-only reaction, hot-assembly clearance, critically damped recoil, unchanged damage/collision/VFX pools, cancellation, pause/switch/reset and allocation/disposal. Actual App browser probes verify one successful-shot aim impulse, no rejected-shot impulse, pre-shot centre ray and muzzle-to-target direction, immutable launched bolts, hip/ADS scaling, mouse compensation, and eight shots / eight charges / .036 rad lasting climb at 30/60/144 Hz.

[Preserved-system hashes](preserved-systems.json) compare approved geometry, projectiles, effects, world, input/hand rig and WAVs with the verified base. No production deployment, merge, other-weapon change or W04 work is included. **PR #26 remains draft and open for developer acceptance.**
