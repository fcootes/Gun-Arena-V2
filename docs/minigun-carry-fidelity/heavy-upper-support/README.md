# W04 — low, wide Minigun carry with upper support

Continues `feat/w04-minigun-carry-fidelity` / draft **PR #29**, from inspected head **d0c7d68dcdb369316e2253d8bd1ef20496a0372e**. This revision supersedes the prior underslung/rifle-like hold after the developer's new screenshot and posture feedback.

## What changed

The **left hand now hooks the existing upper Carry bracket**, instead of using the lower rifle-style support point. The palm contacts its upper surface and the fingers curl over the far edge. The thumb is opposed to the grasp. The **right hand stays on the accepted rear firing/control grip**. An invisible attachment locates the original bracket; no gun mesh is added, removed, moved or reshaped.

The gun sits **100 mm lower, 70 mm farther forward and 70 mm farther outward** than the previous hip carry, with more yaw and a small downward pitch. Its ADS pose also stays low/outboard, retaining the heavy two-hand separation rather than centering the receiver into an AR shoulder pose. Camera/input response, accuracy, spread and recoil are unchanged; the greater effort to aim is presentation only. Existing heavy carry inertia, gait, spin and firing feedback remain intact.

Both arms use a camera-local two-bone solve, with **34 cm upper arms and 30 cm forearms**, an outboard elbow pole and a bounded torso lean. Two upper sleeves join the existing forearms at real elbows instead of exposing floating/capped sleeve ends. The left elbow routes forward/outboard of the ammunition chute. These are first-person clothing meshes, **not a Minigun remodel**: they share one owned geometry and existing sleeve material, cost two active Minigun draws, and are released by the existing manager/weapon teardown. There is no per-frame geometry/material/Object3D construction or React frame state.

During heat recovery, the hand first unhooks **upward**, then pulls **outboard**, makes one restrained reaction and returns from above to the **same upper bracket**. The weapon settles 12 mm down/back into the control arm rather than rising into a generic rifle reload. Return and finger closure share the existing authoritative thermal clock, including class scaling; no new gameplay timer is introduced.

## Footage and actual game verification

- [Continuous Area 51 first-person footage](first-person-hold-and-overheat.mp4): idle → walking → sustained firing → automatic overheat → withdrawal/reaction → deliberate regrip → ready.
- [Heat-hand diagnostic clip](heat-hand-diagnostic.mp4), explicitly captioned: only the existing yellow smoke is hidden at capture and immediately restored so the hand path can be inspected. This is a separate visibility diagnostic, not normal gameplay footage. [Provenance](diagnostic-provenance.json), [withdrawn](diagnostic-withdrawn.png), [return](diagnostic-return.png).
- [Idle](idle.png), [walking](walking.png), [steady firing](firing.png), [heat reaction](heat-reaction.png), [return](return-approach.png), [regripped](regripped.png), [ADS](ads.png), [sprint](sprint.png).
- Matched previous revision [idle](before-idle.png) / [ADS](before-ads.png); [contact sheet](contact-sheet.jpg).
- [Per-frame production states and provenance](video-provenance.json), [gameplay samples](validation.json), [native RAF/input verification](live-validation.json), [observed audio events](audio-events.json).

The clip uses the **actual production App and Three.js renderer**, existing Area 51 map/lighting and keyboard/mouse handlers. The complete production movement, firing/damage, rotor, heat/cooling, audio hooks and viewmodel update run at 120 Hz against a test-only deterministic clock; each four updates exports a frame at 30 FPS. It is **11.4 seconds of silent offline normal-speed simulation playback**, not an unretimed native-GPU recording. The main continuous clip uses no substitute weapon/hands/lights/map objects or hidden-smoke presentation. The separately labelled diagnostic clip hides only smoke for inspection. The existing yellow cooling plume remains and can obscure the right side of the weapon.

A separate native browser RAF/input run removes the forced clock and verifies warmup before shooting, sustained LMB firing, spin-down, automatic overheating/recovery, original supply and pause. Routine rendering is gated for software WebGL except at explicit actual screenshots. It establishes behavior, not laptop GPU performance or audible quality. Native laptop feel remains for developer review.

## Contact, framing and choreography

Coordinates are weapon-local metres, +Y up / −Z forward, except camera-local carry and shoulder targets. All rotations are Euler XYZ radians.

| Setting | New value |
|---|---|
| Left wrist | (−.045481, .130934, .065746) |
| Bracket anchor | (0, .075, .040), existing .029 × .065 × .130 m bracket |
| Anchor-relative wrist | (−.045481, .055934, .025746) |
| Left wrist rotation | (−1.5573575805, .0510741547, −1.8282085407) |
| Finger bends / thumb bends | (.350, 1.417, 1.202) / (.235, .537, .212) |
| Thumb opposition / twist | −.135 / −.250 rad |
| Hip position / rotation | (.290, −.250, −.710) / (−.045, .320, −.065) |
| ADS position / rotation | (.200, −.225, −.730) / (−.025, .160, −.040) |
| Upper / lower arm length | .340 / .300 m |
| Shoulder targets before bounded lean | left (−.300, −.460, −.240), right (.320, −.460, −.240) |
| Elbow pole | left (−1, −.20, −.70), right (1, −.45, .10) |
| Maximum presentation torso lean | .180 m, camera and physics unaffected |
| Withdrawal | 55 mm up, 105 mm outboard, 25 mm rearward |
| Heat reaction | One 3 mm rise / .055 rad roll |
| Thermal brace | +6 mm right, −12 mm down, +12 mm rearward; (−.065, .270, −.080) rad |

The existing baseline action is still **2.20 s** with .55 s `vent` / 1.65 s `close` phases. The independent emergency timer is still **2.00 s**. Heat, cooling, availability, ammo transactions and audio clocks are unchanged. The hand derives normalized progress from the sum of the actual sequence durations and its elapsed phase.

| Motion | Normalized action | Baseline time |
|---|---|---|
| Relax fingers | 0–.13 | 0–.286 s |
| Unhook upward | .04–.16 | .088–.352 s |
| Pull outboard | .14–.34 | .308–.748 s |
| Restrained heat reaction | .32–.56 | .704–1.232 s |
| Deliberate return above bracket | .62–.91 | 1.364–2.002 s |
| Lower onto bracket | .88–1 | 1.936–2.200 s |
| Wrap and settle | .91–1 | 2.002–2.200 s |

Smoothstep ramps prevent positional/orientation snaps at endpoints and across the original phase boundary. Pause freezes the same authoritative clock. Switching, utility use, death and disposal use existing visibility/reset ownership; there is no independent hand-action timer to survive cancellation.

## Validation and preservation

TypeScript, production build and the **16 selected test commands** pass. [Results](checks/results.json) and individual [transcripts](checks/) record the checks; the existing Vite bundle-size advisory remains.

The focused Minigun suite checks real palm/finger/forearm/upper-sleeve vertices across firing, movement, ADS, sprint and the full thermal action at 240 Hz. Palm and fingers contact the real bracket within 1 mm without entering its conservative box envelope. It also verifies connected elbows, constant bone lengths, wide support, motor/barrel/chute clearance, frame-independent original carry response, pause/reset, normalized class factors .65/1/1.4, exact 2.20 s baseline completion, unchanged resources and no per-frame GPU/scene allocations. General viewmodel tests retain near-plane and offscreen-shoulder checks for all twelve weapons and disposal of every resource exactly once.

[Eleven-weapon equivalence](preserved-other-weapons.json) proves identical geometry/materials, hand palettes, hip/ADS/sprint transforms and full reload states for every other weapon. [Minigun geometry comparison](preserved-minigun-geometry.json) proves all actual gun geometry/materials/textures/transforms are unchanged, both first-person and bare actor/studio; only the two upper-sleeve clothing draws are excluded. The existing underslung cradle, motor, barrel cluster, muzzle, control grip and feed chute are untouched.

[Source/asset hashes](preserved-systems.json) prove **116 existing tracked source/assets are byte-identical** to the inspected head, including `App.tsx`, `types.ts`, `botBuilder.ts`, `world.ts`, `area51World.ts`, `gameLoop.ts`, `weaponReload.ts`, `minigunCarry.ts`, audio modules and WAV files. Damage, .045 s cadence, .50 s spin-up, spin-down, six-barrel rotation, heat/cooling, 999/999 supply, original audio events, movement, aiming, controls, recoil and other weapons remain accepted. **Engineer deployable Issue #28 remains untouched.**

## Review and reproduction

`npm run test:minigun`; `npm run test:viewmodel`; `node --import tsx scripts/compare-minigun-geometry.mjs <previous-checkout>`; `EXCLUDE_MINIGUN=1 COMPARE_SPRINT=1 node --import tsx scripts/compare-viewmodel-preserved.mjs <previous-checkout>`.

`MINIGUN_MAP=area51 MINIGUN_OUTPUT=work/minigun-heavy node scripts/test-minigun-hold-browser.mjs` records the complete actual App sequence and then native input smoke. Use `CHROMIUM_PATH` for a custom installed Chromium, `MINIGUN_POSE_ONLY=1` for idle/ADS or `MINIGUN_LIVE_ONLY=1` for native RAF/input smoke alone. `MINIGUN_DIAGNOSTIC=1` makes the separately captioned smoke-hidden hand inspection clip. The test-only Vite transform never ships with the game.

[Exact changed files](changed-files.txt). Keep PR #29 **open, draft and unmerged**. No production deployment/promotion. Future refinement worth considering separately: the existing oversized yellow vent plume obscures some right-side hand/gun detail; native laptop handling and sound still require developer acceptance. Third-person body pose remains unchanged by this first-person correction.
