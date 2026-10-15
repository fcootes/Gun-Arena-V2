# PR #15 visual acceptance repair

> Historical repair checkpoint at `4e3bab4`. The later
> [final grip/sprint/AR acceptance repair](final-viewmodel-acceptance.md) supersedes
> its underhand basis, sprint profiles and generic AR chamber reach.

Continues `feat/procedural-first-person-hands-20261015` from `2bbc982` (the original
PR #15 checkpoint). Main remains `794fdfd`; controls #13 and preparation #14 are
preserved. Original commits, screenshots and validation remain in the repository.
This report supersedes the original report's holding positions and spade-grip notes.

## Causes and repair

The old sleeve was a unit cylinder scaled to the entire wrist-to-fixed-elbow
vector. A forward pump grip could make that vector roughly half a metre long;
weapon tilts changed its direction while its narrow wrist radius stayed constant.
The original profiles also put most receivers only 13–14 cm below the eye but
47–54 cm forward. Large rear stocks were hidden, while buffer tubes and the SMG
wire stock remained baked into the visible receiver. Moving the receiver alone
could not fix that composition.

Profiles now lower and bring each class toward the eye, with separate ADS and
sprint clearances. Both sleeves retain a cuff overlap, a fuller taper, and a
30 cm maximum cuff-to-elbow span (31.2 cm including cuff overlap). Camera-space torso targets determine bend direction;
local cuff position limits lateral reach and makes the elbow bend down and back.
The solver converts that target into weapon space after recoil/reload transforms.
It never scales a sleeve to an arbitrarily remote body anchor. The rocket loading
reach now addresses the rear portion of the loading round instead of overreaching
past the tube. Its reload timing and state machine are unchanged.

`createWeaponAssembly(id, { firstPerson: true })` is used only by the viewmodel
manager. Its default call retains exactly the previous actor/armory geometry,
material assignment, draw count and muzzle position, verified against an archive
of `2bbc982` for all twelve models. First-person-only differences are:

- Buffer tubes and SMG wire struts belong to the hidden shouldered stock.
- Decorative optics use open tubes without opaque decorative lens discs. Their
  ADS profiles align the eye with the optic axis; the existing HUD crosshair,
  zoom FOVs and sniper/BR scope overlay remain unchanged.
- The RPG rear tube is shortened behind the eye, its exhaust cone and raised
  backup sights omitted. Its muzzle, backblast marker and projectile mechanics
  are unchanged.
- The minigun replaces rear spades with a trigger grip under the motor and a
  stationary underslung grip/bracket offset to the left, clear of the rotating
  barrels and ammunition chute. This is a limited first-person handling kit;
  actor/armory spades and all rotary/barrel mechanics remain intact.

The same shared pair, two instanced finger palettes and eight hand meshes remain.
There are no new runtime dependencies, per-frame geometries/materials/scene
objects, or changes to preparation orchestration. The optional assembly argument
is backwards compatible; botBuilder and WeaponStudio callers still use the
default form. App, gameLoop, world, weaponReload, weaponAudio and gameplay weapon
definitions are unchanged by this repair.

## Per-weapon corrections

Camera-local hip position in metres, +Y up and forward −Z. Attachment coordinates
remain weapon local. `src/viewmodelGrips.ts` is the source of all holding profiles.

| Weapon | Hip before → after | Attachment / ADS correction |
| --- | --- | --- |
| AR | (.16, −.135, −.47) → (.145, −.205, −.36) | Handguard support retained; buffer hidden; ADS through open optic at y −.145 |
| Pistol | (.13, −.10, −.42) → (.13, −.125, −.39) | Existing two-hand grip retained; small framing adjustment and ADS lowered to iron-sight height |
| Shotgun | (.16, −.135, −.47) → (.15, −.225, −.36) | Pump offset tightened to (−.055, −.035, .025); live pump tracking retained; 1.75° ADS pitch aligns rear ring and front post at y −.08375 |
| Sniper | (.15, −.14, −.50) → (.155, −.22, −.39) | Support moved back from z −.34 to −.28; scoped overlay remains clear |
| SMG | (.16, −.135, −.47) → (.135, −.205, −.34) | Vertical foregrip retained; wire stock hidden; open optic ADS |
| LMG | (.15, −.14, −.51) → (.17, −.245, −.40) | Support moved back 2 cm beneath handguard; heavy, lower framing |
| BR | (.16, −.135, −.47) → (.145, −.215, −.38) | Support moved back 3 cm; bullpup structure/reload deferred |
| Plasma | (.16, −.135, −.47) → (.16, −.22, −.38) | Existing cell/handguard contacts retained; firing unchanged |
| Railgun | (.15, −.14, −.52) → (.17, −.235, −.44) | Support moved back 2 cm; open optic ADS; deeper sprint clearance for vent bounds |
| Minigun | (.12, −.18, −.61) → (.16, −.20, −.48) | Trigger grip and left underslung cradle replace spade pose |
| Rocket | (.18, −.14, −.54) → (.18, −.235, −.43) | Large-weapon clearance, open optic, corrected loading reach |
| Grenade launcher | (.16, −.135, −.49) → (.16, −.225, −.39) | Vertical support retained; lowered receiver and closer handling |

## Reload diagnosis for the next PR

No reload rules, audio, damage, ammunition, fire rates or squad controls are
changed here. These are findings from the current source, not completed repairs.

**Shotgun.** `App.fireWeapon` triggers the shot, pump sound and
`triggerShotgunPump()` in the same synchronous branch. `weapons.update` immediately
uses a 0.42-second sine stroke. There is no authored post-shot recoil/settle delay.
`weaponReload.beginWeaponReload` assigns insertion 24% of the scaled 2.1-second
base: approximately 0.393 s per tactical shell or 0.554 s per empty shell. Open,
insert, optional chamber and close share the generic root tilt/reach. The audio
adapter fits insertion recordings to these short phases. Next: author a bounded
post-shot settle → pump-back → pump-forward presentation timeline with sound cues
on mechanical events; then author grab/insert/settle shell phases, distinct empty
chambering and deliberate tactical closure. Keep interruption, shell conservation,
pause/cancel cleanup and firing eligibility covered by tests. Tune duration and
sound cues together in that separate PR.

**Sniper.** A shot sets `boltCycleT = .85` and plays shot and bolt clips together.
`weapons.update` automatically translates/rolls the bolt from that timer, while
the firing hand remains on the grip; independent bolt-hand choreography only
exists generically during reload. The model's bolt is at +X (.039), the far side
from the offset first-person eye in the present pose. The next batch needs a
visible-side authored manipulation pose and delayed bolt cues, with a deliberate
choice of control placement rather than an unexplained mirrored weapon.

**BR.** The magazine anchor is rearward at z +.15, but its receiver is still the
shared rifle layout. Removal/insertion uses the common downward magazine path
and generic support reach, without a rear undercarriage or bullpup-specific grasp.
The 1.2-second base produces about .749 s tactical and 1.32 s empty sequences.
Receiver/magwell geometry, undercarriage grip and timing/choreography belong in
the scheduled bullpup/reload batch.

**LMG.** The feed tray hinges in the existing open/close phases, but the support
hand generally targets the magazine; closure has no dedicated cover-contact pose.
`weaponAudio` fits a composite reload track to the sequence without a separate
cover-latch event. Next: author cover grasp/closure/latch interaction and a distinct
mechanical cue synchronized with the existing reload completion boundary.

## Validation and acceptance

The baseline is the original PR commit `2bbc982`, not main. Browser captures use
Chromium/ANGLE SwiftShader, 1280×720, DPR 1, hip FOV 74 and each weapon's unchanged
ADS FOV. The fixture has identical lighting/camera in both runs. The gallery hook advances
only presentation by 90 CPU updates before capturing settled live-game poses;
it does not advance gameplay, reload state, ammunition or world simulation. This
avoids capturing incomplete ADS transitions when software WebGL produces very
few live frames during a short wall-clock wait. Actual Training
captures use the App's live renderer and valid lobby deployment, then a test-only
field-armory loadout replacement for the twelve-weapon gallery. No test hook is
included in the production bundle. World generation and live movement can change
backgrounds; compare weapon/sleeve composition at the matching FOV, not scenery.

The Node suite verifies all visible weapon and instanced-hand vertices beyond
the 5 cm near plane across hip/ADS/sprint and complete reload sequences, open
optic centre rays, bounded sleeves and hidden sleeve ends, pump tracking, one
reused rig, pause/death/replay behavior, immutable gameplay state, no per-frame
geometry/material/scene-object allocation, and exactly-once resource cleanup.

The original idle shotgun support sleeve measured 45.2 cm including overlap;
the sniper measured 55.1 cm and AR 49.2 cm. All now stay at or below 31.2 cm,
with different bend directions and visible portions rather than a stretched tube.
The right sleeve was already shorter in some original idle poses; its solver now
also bounds distance during reload/sprint, gives a fuller taper and keeps the
wrist connected. Native laptop GPU timing and subjective laptop acceptance
remain untested.

## Screenshot review

The comparison columns use the original PR and repaired code with the same
fixture FOV, viewport and lighting. Open each image at full size to assess the
wrist/cuff seam, support contact, silhouette and rear-body clearance.

| Weapon | Original PR #15 | Repair |
| --- | --- | --- |
| AR | ![AR before](viewmodel-repair-images/ar-before.png) | ![AR after](viewmodel-repair-images/ar-after.png) |
| Pistol | ![Pistol before](viewmodel-repair-images/pistol-before.png) | ![Pistol after](viewmodel-repair-images/pistol-after.png) |
| Shotgun | ![Shotgun before](viewmodel-repair-images/shotgun-before.png) | ![Shotgun after](viewmodel-repair-images/shotgun-after.png) |
| Sniper | ![Sniper before](viewmodel-repair-images/sniper-before.png) | ![Sniper after](viewmodel-repair-images/sniper-after.png) |
| SMG | ![SMG before](viewmodel-repair-images/smg-before.png) | ![SMG after](viewmodel-repair-images/smg-after.png) |
| LMG | ![LMG before](viewmodel-repair-images/lmg-before.png) | ![LMG after](viewmodel-repair-images/lmg-after.png) |
| BR | ![BR before](viewmodel-repair-images/br-before.png) | ![BR after](viewmodel-repair-images/br-after.png) |
| Plasma | ![Plasma before](viewmodel-repair-images/laser-before.png) | ![Plasma after](viewmodel-repair-images/laser-after.png) |
| Railgun | ![Railgun before](viewmodel-repair-images/railgun-before.png) | ![Railgun after](viewmodel-repair-images/railgun-after.png) |
| Minigun | ![Minigun before](viewmodel-repair-images/minigun-before.png) | ![Minigun after](viewmodel-repair-images/minigun-after.png) |
| Rocket | ![Rocket before](viewmodel-repair-images/rocket-before.png) | ![Rocket after](viewmodel-repair-images/rocket-after.png) |
| Grenade launcher | ![Grenade launcher before](viewmodel-repair-images/grenade_launcher-before.png) | ![Grenade launcher after](viewmodel-repair-images/grenade_launcher-after.png) |

Actual Training gameplay comparisons (same viewport and hip/weapon ADS FOV):

| Pose | Original PR #15 | Repair |
| --- | --- | --- |
| AR idle | ![AR before](viewmodel-repair-images/game-ar-idle-before.png) | ![AR after](viewmodel-repair-images/game-ar-idle-after.png) |
| AR ADS | ![AR ADS before](viewmodel-repair-images/game-ar-aim-before.png) | ![AR ADS after](viewmodel-repair-images/game-ar-aim-after.png) |
| Shotgun idle | ![Shotgun before](viewmodel-repair-images/game-shotgun-idle-before.png) | ![Shotgun after](viewmodel-repair-images/game-shotgun-idle-after.png) |
| Shotgun ADS | ![Shotgun ADS before](viewmodel-repair-images/game-shotgun-aim-before.png) | ![Shotgun ADS after](viewmodel-repair-images/game-shotgun-aim-after.png) |

More actual gameplay: [APEX pistol](viewmodel-repair-images/game-apex-pistol-idle.png),
[sniper grip](viewmodel-repair-images/game-usmc-sniper-idle.png),
[sniper scope](viewmodel-repair-images/game-usmc-sniper-aim.png),
[BR](viewmodel-repair-images/game-usmc-br-idle.png),
[LMG](viewmodel-repair-images/game-usmc-lmg-idle.png),
[APEX minigun support](viewmodel-repair-images/game-apex-minigun-idle.png),
[APEX LMG reload](viewmodel-repair-images/game-apex-lmg-reload-pose.png),
[shotgun reload](viewmodel-repair-images/game-usmc-shotgun-reload-pose.png),
[APEX AR reload](viewmodel-repair-images/game-apex-ar-reload-pose.png),
[shotgun sprint](viewmodel-repair-images/game-usmc-shotgun-sprint.png).
The [lit grip detail](viewmodel-repair-images/ar-grip-detail.png) supplements the
live game's darker directional lighting. Full raw captures remain under ignored
`performance-results/viewmodel-acceptance-{before,after}`.

## Remaining acceptance

Browser screenshots support review of the repaired framing, sleeve proportions,
attachments and sights. They do not establish native laptop GPU acceptance.
Large weapons naturally obscure parts of the firing hand; the minigun cradle is
visible to the left of the motor, with some ammunition-chute overlap. The
first-person minigun kit differs from actor/armory spades deliberately. Full
weapon-specific reload choreography is still visibly basic and remains the next
batch, including the diagnosed shotgun/sniper/BR/LMG issues above.

Before merge, compare this preview on the user's laptop at the usual display
scale/FOV. Check shotgun pump contact, AR/pistol ADS, minigun support, both palettes,
walk/sprint/reload transitions, first/third person and death/replay. Record native
frame times during sustained firing. PR #15 stays draft for this manual review.
No merge or production deployment is part of this repair.

## Final check results and performance

TypeScript, production build, viewmodel, weapons, tactical, runtime, preparation
and controls suites passed. The build retains its existing bundle-size advisory.
Both baseline and repaired browser runs completed the twelve-weapon gallery,
both faction palettes, normal-loadout fire/ADS/reload/pause/switch/perspective/
death/replay/lobby lifecycle, and shotgun shot/ammo confirmation with no page errors.
Normal-loadout fire/reload/switch added no shader programs after readiness.
The held fixture additionally checks 4:3/16:9/21:9 views and hand near-plane/sight rays.

Baseline capture started `2026-10-15T06:13:35.349Z`; repaired capture started
`2026-10-15T06:12:44.747Z`. Both use Chromium `154.0.8037.57`.

| Held weapon | Before calls / triangles | After calls / triangles |
| --- | ---: | ---: |
| ar | 26 / 24,544 | 19 / 22,252 |
| pistol | 19 / 13,340 | 19 / 13,340 |
| sniper | 22 / 23,820 | 17 / 21,664 |
| br | 21 / 23,096 | 15 / 20,140 |
| minigun | 16 / 13,388 | 19 / 14,556 |
| shotgun | 16 / 16,972 | 14 / 15,060 |
| smg | 23 / 22,596 | 18 / 20,312 |
| lmg | 19 / 25,560 | 17 / 23,648 |
| laser | 17 / 12,420 | 14 / 9,924 |
| railgun | 24 / 15,506 | 18 / 12,682 |
| rocket | 17 / 15,648 | 13 / 12,904 |
| grenade_launcher | 18 / 12,988 | 16 / 11,076 |

CPU pose-update p95 was 0.10 ms before and 0.10 ms after
at the browser's coarse timer resolution. Max samples were 1.50 /
0.30 ms; these short CPU samples do not establish GPU/frame-rate parity.
The minigun increases from 16 to 19 calls and 13,388 to 14,556 triangles for its
physical handheld control kit. Other held totals stay equal or fall with hidden
rear geometry and open optics. Renderer-uploaded geometry buffers after the full
held sequence fall from 148 to 129; these cumulative renderer counts are
not a count of all CPU-owned buffers. The shared pair remains eight meshes, six
geometries, three materials and two 30-instance palettes (3,840 dynamic bytes).

The focused WebGL preparation run covered all 22 light variants, 98 draws,
46 batches (maximum 8 draws), 92 programs, resize/cancellation/state
restoration and zero padding-pixel difference. Its 13.05 s duration is a
software fixture measurement, not a native loading-time benchmark. Preparation
orchestration and APEX lighting code are unchanged.

Structured evidence, per-weapon sleeve lengths, assembly parity hashes and raw
counts: [validation JSON](first-person-visual-repair-validation.json).

## Exact repair file manifest

52 files changed from the original PR checkpoint (`2bbc982`):

- `docs/first-person-hands.md`
- `docs/first-person-visual-repair-validation.json`
- `docs/first-person-visual-repair.md`
- `docs/viewmodel-repair-images/ar-after.png`
- `docs/viewmodel-repair-images/ar-before.png`
- `docs/viewmodel-repair-images/ar-grip-detail.png`
- `docs/viewmodel-repair-images/br-after.png`
- `docs/viewmodel-repair-images/br-before.png`
- `docs/viewmodel-repair-images/game-apex-ar-reload-pose.png`
- `docs/viewmodel-repair-images/game-apex-lmg-reload-pose.png`
- `docs/viewmodel-repair-images/game-apex-minigun-idle.png`
- `docs/viewmodel-repair-images/game-apex-pistol-idle.png`
- `docs/viewmodel-repair-images/game-ar-aim-after.png`
- `docs/viewmodel-repair-images/game-ar-aim-before.png`
- `docs/viewmodel-repair-images/game-ar-idle-after.png`
- `docs/viewmodel-repair-images/game-ar-idle-before.png`
- `docs/viewmodel-repair-images/game-shotgun-aim-after.png`
- `docs/viewmodel-repair-images/game-shotgun-aim-before.png`
- `docs/viewmodel-repair-images/game-shotgun-idle-after.png`
- `docs/viewmodel-repair-images/game-shotgun-idle-before.png`
- `docs/viewmodel-repair-images/game-usmc-br-idle.png`
- `docs/viewmodel-repair-images/game-usmc-lmg-idle.png`
- `docs/viewmodel-repair-images/game-usmc-shotgun-reload-pose.png`
- `docs/viewmodel-repair-images/game-usmc-shotgun-sprint.png`
- `docs/viewmodel-repair-images/game-usmc-sniper-aim.png`
- `docs/viewmodel-repair-images/game-usmc-sniper-idle.png`
- `docs/viewmodel-repair-images/grenade_launcher-after.png`
- `docs/viewmodel-repair-images/grenade_launcher-before.png`
- `docs/viewmodel-repair-images/laser-after.png`
- `docs/viewmodel-repair-images/laser-before.png`
- `docs/viewmodel-repair-images/lmg-after.png`
- `docs/viewmodel-repair-images/lmg-before.png`
- `docs/viewmodel-repair-images/minigun-after.png`
- `docs/viewmodel-repair-images/minigun-before.png`
- `docs/viewmodel-repair-images/pistol-after.png`
- `docs/viewmodel-repair-images/pistol-before.png`
- `docs/viewmodel-repair-images/railgun-after.png`
- `docs/viewmodel-repair-images/railgun-before.png`
- `docs/viewmodel-repair-images/rocket-after.png`
- `docs/viewmodel-repair-images/rocket-before.png`
- `docs/viewmodel-repair-images/shotgun-after.png`
- `docs/viewmodel-repair-images/shotgun-before.png`
- `docs/viewmodel-repair-images/smg-after.png`
- `docs/viewmodel-repair-images/smg-before.png`
- `docs/viewmodel-repair-images/sniper-after.png`
- `docs/viewmodel-repair-images/sniper-before.png`
- `scripts/test-viewmodel-browser.mjs`
- `src/viewmodelGrips.ts`
- `src/viewmodelHands.ts`
- `src/weaponModels.ts`
- `src/weapons.ts`
- `tests/viewmodel.test.ts`
