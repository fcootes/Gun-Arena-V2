# PR-100 final polish (draft PR #26)

Continues the approved internal-chamber design from verified head `43e87369dadc2f2bf3c5394628178fe71a17dd82` on `feat/plasma-repeater-fidelity`. This pass changes only bolt rendering, material-aware impacts/scorches, cartridge proportions and spent-cylinder impulse. The integrated ceramic emitter, hollow receiver, split doors, hands, ammunition/heat rules and 2.20 s reload remain approved. PR #26 stays draft for native-laptop acceptance.

See [current screenshots, normal-speed export, validation and limitations](polish-evidence/README.md).

## Exterior and chamber

The forward receiver is a continuous tapered octagonal shell spanning local Z −0.385 to −0.574 m. Its compact nose is 82 mm wide, compared with the former 147 mm ceramic blocks. Off-white ceramic occupies flush upper/lower material regions of that same shell; graphite side webs and a dark annular aperture frame remain structural. The recessed cyan core is concentric at X 0 / Y .023. The authoritative muzzle is **unchanged at `(0, .023, −.574)`**, preserving FPS/actor origins, cover checks, convergence, muzzle effects and Armory alignment.

The central receiver is constructed from separate roof, floor, right wall, fore/aft bulkheads and lower power housing. It contains an actual empty cavity. There is no solid receiver mesh intersecting the cartridge, no sliding guide/tray/cradle allocation and no externally visible cylinder when closed.

Hierarchy, all in weapon-local metres:

- `receiver`: fixed chassis, internal seat surfaces, pressure contacts and ejector pad.
- `cartridgeSeat`: fixed semantic attachment at **(−.008, .024, −.066)**; its static meshes join receiver batches.
- `gasCylinder`: installed longitudinal cartridge, parented directly to receiver at **(−.008, .024, −.066)**. Maximum visual radius .028 m. Rounded graphite vessel radius .025 m (19% wider than .021 m), body length .156 m; capped pressure body .178 m instead of .206 m. Reinforced metallic caps/collars and a narrow cyan inspection strip replace the broad glowing glass appearance. Keyed end couplings retain the original .206 m seat span.
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

- Let `p = 1 − exp(−t/.025)` and `u = max(t−.065, 0)`.
- X = −.008 − .22 × p² − .45 × t
- Y = .024 + .14 × u − 4.6 × u²
- Z = −.066 + .035 × u
- Rotation XYZ = (4.5u, −2.8u, 7u) radians.

The first .065 s is strictly transverse. The spring-like pop travels over .12 m in the first 33 ms and over .30 m by .20 s; tumble and gravity begin only after door/receiver clearance. Actual cylinder vertices clear both doors and the actual articulated support glove at 240 Hz. It hides at **.66 baseline seconds of age**, below the first-person frame. Age comes from the authoritative scaled action clock and freezes on pause. Cancellation hides the cosmetic immediately; teardown disposes shared buffers/materials once. It never enters the projectile pool or pickup system.

The fresh cylinder starts at **(−.240, −.220, −.066)**. It aligns at **(−.160, .024, −.066)** during the first 72% of insertion, then approaches **(−.080, .024, −.066)**. The slap pushes it to **(−.008, .024, −.066)**. At 1.58 s the fresh object is replaced by the installed object at exactly the same transform. The palm remains at a calibrated cartridge-relative contact, with fingers flattening during seating.

Cancellation before .58 s preserves the original charges; after .58 and before 1.58 it leaves zero installed charges; after 1.58 it preserves the new cartridge and consumed spare. Recovery closes the receiver and engages retention only when a cartridge is installed. Switching/death stop audio and close the mechanism; respawn recreates valid slot state. Repeated advancement cannot repeat the transaction.

## Independent ammunition and heat feedback

Six small recessed cyan segments sit beside the cartridge bay, using one shader/draw. Segment `i` intensity is `clamp(ammo / 10 − i, 0, 1)`. Thus 60 shows six, 50 five, 35 three plus one half-intensity segment, and zero all dark. Only the actual ammo counter drives these segments, so they extinguish at ejection and refill at seating. Heat never colours them red.

A separate narrow status line on the **outside face of the upper cooling rail**, at `(−.052, .096, −.100)`, uses the actual heat value. It remains subdued through 30%, warms continuously toward amber through 60%, becomes orange through 85%, and reaches red at 100%. Cooling reverses the same progression. There is no visual heat reset ahead of the authoritative value.

Thermal venting remains **1.25 s**: present .15, switch .15, shutters open .20, vent .50, shutters close .15, recover .10. Cartridge doors stay closed, the cartridge stays installed, and ammo/reserve remain unchanged. Passive cooling and automatic overheat recovery are preserved.

R precedence remains: active action → ignore; overheated → thermal recovery; empty with spare → replacement; heat ≥65 → vent; partial cartridge with spare → replacement; full cartridge with heat ≥10 → vent; otherwise no action.

## Preserved gameplay and performance

Eight physical bolts/second, .125 s cadence, 200 units/s velocity, 130-unit range, swept moving/static collisions, cover obstruction and damage attribution are unchanged. The 60/180 sealed-cartridge supply, damage 12, headshot 1.7×, 2.5 heat/shot, 16 heat/s passive cooling and .15 s cooling grace remain intact. The existing 192-slot projectile pool and collision/damage winner selection remain authoritative; visual feedback observes the resolved hit. Only props already marked destructible call the existing environmental-damage interface, capped at one base shot (12).

The bare model uses **21 meshes**, below the existing 24-mesh budget. Three cartridges share one baked vertex-coloured buffer and material. No reload creates meshes, geometry or materials. Disposal assertions release every owned resource once; six rendered Armory replacement cycles stabilize at **24 geometries / 4 textures** for the complete inspection scene. There are no new dynamic lights or changes to map/APEX preparation.

Armory's real TEST CARTRIDGE / TEST THERMAL VENT / TEST MUZZLE EFFECT controls are exercised in the browser. INSPECT CHAMBER, PAUSE/RESUME and a 0–2.20 s pose slider allow intermediate review without changing any gameplay slot. Orbit/zoom supports either side, front and rear.

## Bolt and impact rendering

Three reused instanced draws render each velocity-aligned packet: a dense cyan-white shaped core, a constrained 32 mm-radius envelope and a tapered 32 cm wake. The full packet is under .45 m long versus 25 m spacing at 8 Hz/200 m/s. Small seeded shader variations animate intensity and tail distortion. No beam, per-shot mesh/material/texture, projectile light or fullscreen postprocess is added.

A separate three-draw feedback pool holds **32 contact flashes** (.16 s), **192 spark/dust flecks** (≤.22 s), and **80 scorch marks**. A mark persists fully for 12 s, fades through 16 s, and is recycled oldest-first at capacity. Material metadata takes precedence, with conservative names/finish inference for existing concrete, metal, painted metal and stone. Metal/armour contacts produce a few warm sparks; mineral contacts produce restrained dust; shield contacts use a brief cyan arc. Actors receive transient feedback only.

World marks use the actual intersected face point and inverse-transpose world normal, including instanced/nonuniform transforms. A 2 mm offset and polygon offset prevent z-fighting. Four footprint rays reject unsupported corners/curved surfaces. Invisible/collision-only/transparent geometry and generic unknown surfaces get no mark. Removed, destroyed, hidden or moved supports invalidate their static mark immediately; reset/map teardown releases all references. An AABB-only contact cannot create a floating decal. All buffers/materials/instance resources are preallocated and disposed once.

## Audio, validation and evidence

Existing WAVs are unchanged. Cylinder seating now plays at **1.58 s**. The thermal hiss stays bounded to its independent vent window; cartridge reload has no thermal hiss or old sliding/composite sound. [The typed silent contact contract](audio-follow-up.md) lists missing W07 Foley.

- [Final polish validation and evidence](polish-evidence/README.md)
- [Prior refinement validation and limitations](verification.txt)
- [Actual screenshots, videos and frame/state provenance](refinement-evidence/README.md)
- [Exact changed-file manifest](refinement-evidence/changed-files.txt)

The previous [evidence directory](evidence/README.md) and [audit](audit.md) are historical baseline records of the superseded tray mechanism. The earlier `refinement-evidence` documents the approved design before this polish; use `polish-evidence` for the latest visuals.
