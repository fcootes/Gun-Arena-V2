# PR-100 internal chamber refinement (PR #26)

Continues `feat/plasma-repeater-fidelity` from verified head `06f6d22c88ec1b6295d1936b9e22158692e5c5a2`. The former external tray and white muzzle blocks are replaced. PR #26 remains draft for native-laptop acceptance; no merge or production deployment is authorized by this work.

## Exterior and chamber

The forward receiver is a continuous tapered octagonal shell spanning local Z −0.385 to −0.574 m. Its compact nose is 82 mm wide, compared with the former 147 mm ceramic blocks. Off-white ceramic occupies flush upper/lower material regions of that same shell; graphite side webs and a dark annular aperture frame remain structural. The recessed cyan core is concentric at X 0 / Y .023. The authoritative muzzle is **unchanged at `(0, .023, −.574)`**, preserving FPS/actor origins, cover checks, convergence, muzzle effects and Armory alignment.

The central receiver is constructed from separate roof, floor, right wall, fore/aft bulkheads and lower power housing. It contains an actual empty cavity. There is no solid receiver mesh intersecting the cartridge, no sliding guide/tray/cradle allocation and no externally visible cylinder when closed.

Hierarchy, all in weapon-local metres:

- `receiver`: fixed chassis, internal seat surfaces, pressure contacts and ejector pad.
- `cartridgeSeat`: fixed semantic attachment at **(−.008, .024, −.066)**; its static meshes join receiver batches.
- `gasCylinder`: installed longitudinal cartridge, parented directly to receiver at **(−.008, .024, −.066)**. Radius ≤.024 m, total length .206 m.
- `chamberUpperDoor`: pivot **(−.053, .080, −.066)**; rotation about longitudinal **Z = −86°** when open.
- `chamberLowerDoor`: pivot **(−.053, −.045, −.066)**; rotation about **Z = +86°** when open.
- Each 6 mm-thick panel is 61.5 mm high and 222 mm long, with its centre 31.25 mm toward the receiver centre from its hinge. Four fixed hinge barrels remain mechanically attached to the receiver.
- `chamberRelease`: thumb button at **(−.056, .041, .079)**, with a 3 mm inward press.
- `cartridgeRetention`: two internal retaining fingers withdraw 9 mm during opening and engage at the seating beat.
- `oldGasCylinder`, `freshGasCylinder`: preallocated cosmetic representations with the installed cylinder's baked geometry/material shared by reference.
- `coolingShutter0..2`, `thermalSwitch`: independent top cooling assembly.
- `ammoIndicator`, `heatIndicator`: separate diagnostics with independent authoritative inputs.

**Why 86° rather than the preliminary 55–75° suggestion:** 75° cleared the cylinder but did not clear the actual articulated glove. Full production palm/phalange geometry was sampled throughout the reload; the final hinge heights, 86° stroke and outside-first hand path clear both doors. The upper panel stays below the optic/cooling hardware; the lower panel stays forward of the firing grip. No acceptance is inferred for the user's laptop.

## Authoritative reload clock

| Baseline time | Phase | Contact / resource state |
|---|---|---|
| 0.00–0.38 s | `present` | Reach outside the closed receiver, sweep back to the real thumb release, press before opening |
| 0.38–0.58 s | `open` | Upper/lower doors rotate oppositely; support hand withdraws outside their sweep |
| 0.58–0.78 s | `eject` | At **.58**, old charges are discarded once and the old cylinder begins its continuous outward trajectory |
| 0.78–1.35 s | `insert` | Fresh cylinder comes from below, aligns and enters directly sideways |
| 1.35–1.58 s | `slap` | Firm palm push to the actual cylinder/seat; at **1.58**, exactly **60 reserve** is consumed and **60 installed** is awarded once |
| 1.58–1.88 s | `close` | Hand clears during the first .06 s; doors then close in .24 s into their exact flush transforms |
| 1.88–2.20 s | `recover` | Support hand returns beneath the fore-end and the weapon settles |

Total: **2.20 s**. Class duration multipliers apply exactly once to the whole sequence. Model and hands read its current phase/fraction; there is no independent reload animation timer. Firing remains blocked during the entire action, including recovery, and no additional cooldown is appended at completion.

The right hand remains attached to its firing grip. The rifle cants around that grip rather than lunging forward. The release contact uses forward kinematics matching the actual left thumb; insertion and palm push follow the fresh cartridge transform. Door clearance is checked against actual glove palm and instanced phalange vertices at 120 Hz, in addition to the all-weapon near-plane suite.

## Ejection and insertion

At .58 s the installed object hides and the preallocated spent object appears at the **same seated transform**. For baseline ejection age `t`, its local position is:

- X = −.008 − .12 × smoothstep(clamp(t/.20)) − .16 × max(t−.20, 0)
- Y = .024 + .34 × u − 3 × u², where u = max(t−.20, 0)
- Z = −.066 + .035 × u
- Rotation XYZ = (.45u, −.70u, 1.40u) radians.

The first .20 s is strictly transverse to clear the door envelope; the short upward/falling arc and rotation follow after clearance. It hides at **.66 baseline seconds of age**, below the first-person frame. Age comes from the authoritative scaled action clock and freezes on pause. Cancellation hides the cosmetic immediately; teardown disposes shared buffers/materials once. It never enters the projectile pool or pickup system.

The fresh cylinder starts at **(−.240, −.220, −.066)**. It aligns at **(−.160, .024, −.066)** during the first 72% of insertion, then approaches **(−.080, .024, −.066)**. The slap pushes it to **(−.008, .024, −.066)**. At 1.58 s the fresh object is replaced by the installed object at exactly the same transform. The palm remains at a calibrated cartridge-relative contact, with fingers flattening during seating.

Cancellation before .58 s preserves the original charges; after .58 and before 1.58 it leaves zero installed charges; after 1.58 it preserves the new cartridge and consumed spare. Recovery closes the receiver and engages retention only when a cartridge is installed. Switching/death stop audio and close the mechanism; respawn recreates valid slot state. Repeated advancement cannot repeat the transaction.

## Independent ammunition and heat feedback

Six small recessed cyan segments sit beside the cartridge bay, using one shader/draw. Segment `i` intensity is `clamp(ammo / 10 − i, 0, 1)`. Thus 60 shows six, 50 five, 35 three plus one half-intensity segment, and zero all dark. Only the actual ammo counter drives these segments, so they extinguish at ejection and refill at seating. Heat never colours them red.

A separate narrow status line on the **outside face of the upper cooling rail**, at `(−.052, .096, −.100)`, uses the actual heat value. It remains subdued through 30%, warms continuously toward amber through 60%, becomes orange through 85%, and reaches red at 100%. Cooling reverses the same progression. There is no visual heat reset ahead of the authoritative value.

Thermal venting remains **1.25 s**: present .15, switch .15, shutters open .20, vent .50, shutters close .15, recover .10. Cartridge doors stay closed, the cartridge stays installed, and ammo/reserve remain unchanged. Passive cooling and automatic overheat recovery are preserved.

R precedence remains: active action → ignore; overheated → thermal recovery; empty with spare → replacement; heat ≥65 → vent; partial cartridge with spare → replacement; full cartridge with heat ≥10 → vent; otherwise no action.

## Preserved gameplay and performance

Eight physical bolts/second, .125 s cadence, 200 units/s velocity, 130-unit range, swept moving/static collisions, cover obstruction and damage attribution are unchanged. The 60/180 sealed-cartridge supply, damage 12, headshot 1.7×, 2.5 heat/shot, 16 heat/s passive cooling and .15 s cooling grace remain intact. Projectile and impact pool code is unchanged.

The bare model uses **21 meshes**, below the existing 24-mesh budget. Three cartridges share one baked vertex-coloured buffer and material. No reload creates meshes, geometry or materials. Disposal assertions release every owned resource once; six rendered Armory replacement cycles stabilize at **24 geometries / 4 textures** for the complete inspection scene. There are no new dynamic lights or changes to map/APEX preparation.

Armory's real TEST CARTRIDGE / TEST THERMAL VENT / TEST MUZZLE EFFECT controls are exercised in the browser. INSPECT CHAMBER, PAUSE/RESUME and a 0–2.20 s pose slider allow intermediate review without changing any gameplay slot. Orbit/zoom supports either side, front and rear.

## Audio, validation and evidence

Existing WAVs are unchanged. Cylinder seating now plays at **1.58 s**. The thermal hiss stays bounded to its independent vent window; cartridge reload has no thermal hiss or old sliding/composite sound. [The typed silent contact contract](audio-follow-up.md) lists missing W07 Foley.

- [Validation and limitations](verification.txt)
- [Actual screenshots, videos and frame/state provenance](refinement-evidence/README.md)
- [Exact changed-file manifest](refinement-evidence/changed-files.txt)

The previous [evidence directory](evidence/README.md) and [audit](audit.md) are historical baseline records of the superseded tray mechanism. Use `refinement-evidence` to review the current implementation.
