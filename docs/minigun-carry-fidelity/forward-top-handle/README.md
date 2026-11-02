# W04 — physical forward TOP handle / separate REAR control

Continues `feat/w04-minigun-carry-fidelity` and draft PR #29 from verified head **f02fe031ce9c74ef2851f03042cad4ce3fa27a6f**. The previous rearward casing attachment did not meet the required grip hierarchy. This revision changes the actual first-person handle geometry, both hand attachments and the arm solve together.

## Acceptance gallery

| Required view | Actual capture |
|---|---|
| Normal first-person idle | [Idle](idle.png) |
| Both physical grips, side-biased inspection | [Both grips](inspection-both-grips.png) |
| Structural inspection, hands hidden only for this diagnostic | [Physical handles / no lower support bar](inspection-physical-handles-no-hands.png) |
| Reference-like angle along the forward-reaching left arm | [Reference angle](inspection-reference-angle.png) |
| Left glove wrapping the real forward top handle | [Left contact close-up](contact-left-top-handle.png) |
| Right glove on the separate rear control | [Right contact close-up](contact-right-rear-control.png) |
| Sustained firing, both hands attached | [Firing](sustained-firing.png) |
| Heat unhook / withdrawal | [Unhook](unhook.png) · [Withdrawal](withdrawal.png) |
| Clear view of withdrawal, smoke hidden only for this diagnostic | [Withdrawal side view](diagnostic-withdrawal-side-smoke-hidden.png) |
| Return to the same forward top handle | [Approach](return-approach.png) · [Returned](returned-top-grip.png) · [Returned side view](returned-top-grip-side.png) |
| Movement / sprint transitions | [Walk](walking.png) · [Sprint entry](sprint-entry.png) · [Held sprint](sprint-held.png) · [Recovered](movement-recovered.png) |
| ADS / re-equipping | [ADS](ads.png) · [Re-equipped](re-equipped.png) |

[Contact sheet](contact-sheet.jpg). [Gameplay/inspection provenance](validation.json). [Independent native browser input results](live-validation.json). [Original audio events](audio-events.json).

The captures use the **complete actual App, original Area 51 scene/lighting, real weapon meshes, hand rig, input handlers and production simulation**. Gameplay stills step the App at 120 Hz with a test clock and explicitly render the selected frame; routine software-WebGL rendering is gated between captures. Side/reference/contact inspections use a separate **test-only inspection camera** to view that unchanged first-person assembly from the requested angle; the weapon and hand transforms are not repositioned for those views. The structural diagnostic hides hands/clothing only. The two named smoke-hidden diagnostics suppress the existing plume only for that render and restore it immediately. Normal gameplay images preserve the plume.

A separate native RAF/input run removes the test clock and passes actual LMB warmup, firing, spin-down, automatic overheat/recovery, supply retention and pause. No page/shader errors occur. These are actual rendered gameplay/inspection screenshots, not generated illustrations, and establish no laptop GPU-performance or audible-quality claim. No inspection control or test hook ships in the product.

## Real handle geometry

**Removed from first person:** `supportCradle`, `Stationary underslung support grip`, `Cradle mounting bridge` and both obsolete lower motor brackets. The old small `Carry bracket` casing feature is removed only from the first-person variant; actor/studio geometry is preserved.

**Added:** a fixed reinforced top carry assembly with a real polymer crossbar, end collars, two uprights, two chassis rails, fasteners and a receiver mounting bridge. It is parented to the **fixed receiver**, not the rotor. The bridge physically intersects the top of the motor housing; rails connect it to the forward uprights; the crossbar connects their upper ends. The support attachment is the crossbar's actual geometric center, not an empty locator on the casing.

The rear control group moves **140 mm rearward** and gains a connected mounting yoke. Both right-hand position and orientation are calibrated against that physical grip. The right hand now tracks its part transform just as the left hand tracks the top assembly. There is **no support grip beneath the barrel/receiver**. The original flexible ammunition chute remains; it is not a handle.

All values are weapon-local metres; **negative Z points toward the muzzle**.

| Item | Position / dimensions |
|---|---|
| Forward top crossbar center (`upperSupportGrip`) | (0, .145, −.240) |
| Graspable crossbar | 190 mm along X, 21 mm radius |
| End collars | X = ±.084, radius 25 mm, 14 mm long |
| Uprights | centers (±.103, .1085, −.240), .022 × .090 × .045 m |
| Fixed chassis rails | centers (±.103, .060, −.100), .022 × .024 × .320 m |
| Receiver mounting bridge | (0, .077, .035), .230 × .026 × .065 m |
| Rear control group | (0, −.045, .140) |
| Main physical rear grip center | (0, −.145, .180), original angled grip shape |
| Right wrist / control-relative offset | (.037507, −.148633, .252813) / (.037507, −.103633, .112813) |
| Left wrist / crossbar-relative offset | (.001289, .193419, −.193096) / (.001289, .048419, .046904) |
| Normal wrist front-to-rear separation | **445.909 mm**, left farther along −Z |
| Physical top / rear grip center separation in Z | **420 mm** |

Actual rendered-vertex checks measure palm/finger clearance from the top cylinder and rear angled grip, not merely distance to a marker. Top contact is within 2 mm; rear contact within 1 mm. The left hand remains more than **400 mm forward in sampled camera-space poses**, including heat withdrawal, ADS, recoil, walking and sprint. This separation comes from the model and attachment positions, rather than disguising a compact hold with a large yaw.

## Arms, framing and heat return

The left arm reaches forward to the top crossbar; the right arm reaches the lower rear control. Fixed **36 cm upper / 32 cm lower** bones and a wide, camera-local two-bone solve keep the elbows connected. The left elbow pole routes its sleeve above/outboard of the fixed chassis and away from the ammunition chute. Upper sleeves share one owned geometry and the existing cloth material. Viewmodel cleanup owns and disposes the handle, yoke and clothing resources; legacy and explicit teardown release shared resources exactly once. No per-frame geometry/material/Object3D creation or React animation state is added.

Hip carry is (.230, −.190, −.710), Euler XYZ (−.035, .220, −.025); ADS is (.150, −.180, −.730), Euler (−.025, .120, −.025). Sprint keeps the same two physical attachments and uses (−.025, −.290, −.660) with the existing sprint rotation. Camera, aiming input, accuracy, recoil and the existing heavy carry controller are unchanged.

The heat hand opens its fingers, lifts clear, withdraws 105 mm outboard with a restrained 3 mm / .055 rad reaction, and returns to the **same forward top bar**. A small 6 mm forward clearance arc prevents the last lowering stroke from cutting through the bar. The thumb remains coherently opposed while the fingers release. The right hand stays attached throughout. The weapon braces slightly down/back into the control arm.

There is no new action/heat clock: the hand reads the existing normalized reload sequence, preserving the **2.20-second baseline action**, .55/1.65-second phases, independent **2.00-second emergency timer**, class multipliers and cancellation/availability ownership. Pause freezes the existing clock. Terminal left-hand contact exactly matches the normal forward-top attachment.

## Tests and preserved systems

TypeScript, production build and **16 test commands** pass: Minigun, viewmodel, weapons, audio, runtime, controls, scenes, tactical, Area 51, bosses, both batches, performance, Plasma tactile, Railgun and pistol sprint. [Results](checks/results.json), [individual transcripts](checks/). The existing Vite bundle-size advisory remains.

The focused tests cover actual palm/finger/forearm/upper-sleeve vertices through movement, ADS, sprint, firing and the full thermal action at 240 Hz. They assert physical top/rear contact, no lower assembly, a nonempty stationary top-handle mesh, clear uprights/rails/motor/barrels/chute, connected fixed-length elbows, local and camera-space forward separation, continuous heat return, original resources/timing, class factors, pause/switch/reset, unchanged carry-rate response and no per-frame GPU/scene allocation.

[Minigun core comparison](preserved-minigun-core.json) proves the **entire bare actor/studio model**, actual first-person rotor geometry/muzzle locations and shared motor/barrel/feed construction remain unchanged. First-person handle/mount geometry is intentionally revised by this brief. [Other-weapon comparison](preserved-other-weapons.json) proves identical geometry/materials, articulated hands, hip/ADS/sprint transforms and full reloads for all eleven other weapons. [Hashes](preserved-systems.json) prove **117 existing source/assets byte-identical**, including weapons, App, types, botBuilder, world, area51World, gameLoop, weaponReload, minigunCarry, audio and WAV files.

Six barrels, .50-second spin-up, spin-down, firing cadence, damage, 999/999 ammunition, heat buildup, overheat, cooling, audio hooks, player controls/physics, recoil, muzzle functionality and maps are preserved. **Engineer tripod Issue #28 remains untouched.**

## Reproduce / delivery

`npm run test:minigun`; `npm run test:viewmodel`; `MINIGUN_HANDLE_REVISION=1 node --import tsx scripts/compare-minigun-geometry.mjs <previous-checkout>`; `EXCLUDE_MINIGUN=1 COMPARE_SPRINT=1 node --import tsx scripts/compare-viewmodel-preserved.mjs <previous-checkout>`.

Capture with `MINIGUN_ACCEPTANCE=1 MINIGUN_MAP=area51 MINIGUN_OUTPUT=work/minigun-top node scripts/test-minigun-hold-browser.mjs`; set `CHROMIUM_PATH` if required. The helper also retains the prior continuous-video and native-input-only paths.

[Exact changed files](changed-files.txt). Keep PR #29 open and draft. No merge or production deployment/promotion. Future refinement outside this correction: the original large yellow cooling plume still obscures some first-person detail. Native laptop feel and sound remain for developer review.
