# PR-100 final tactile fidelity pass

Base: `8aaf082121df8f9da95bdfb90c8b0bcdfcc26153`. Existing branch `feat/plasma-repeater-fidelity`, existing draft PR #26. The approved emitter/receiver/cartridge/indicator geometry is retained.

## Real implementation evidence

- [Continuous 2.70 s reload, with .5 s ready footage before and after](reload-2p70s.mp4)
- [Sustained firing → automatic overheat → 2.25 s vent → heat reaction → recovery](forced-overheat.mp4)
- [Discrete firing, controlled recoil and real concrete/metal impacts](fire-recoil-impacts.mp4)
- [Combined footage](tactile-reload-overheat-fire.mp4)
- [Before/after firing from the same scripted camera](before-after-firing.mp4)
- [Per-frame gameplay/transform/resource provenance](video-provenance.json)
- [Static pose provenance](pose-provenance.json)
- [Real input checks and unretimed reload](live/live-validation.json)
- [Full changed-file manifest](changed-files.txt) and [test output](checks/).

The MP4s are actual production App/Three.js rendering exported as **offline 30 FPS, normal-speed simulation playback**. Production state, hands, recoil, shot dispatch, projectile collision and material feedback execute at 120 Hz. Area 51 lighting and the same two diagnostic concrete/metal panels as the preceding polish clip are used; these panels do not enter shipped maps. World simulation is held stationary for visual comparison. The final firing demonstration moves diagnostic panels farther away to make real 200-units/s packet travel visible at 30 FPS; the before/after comparison keeps their original positions. The export is silent and is **not native-laptop/GPU performance evidence**. Separate demonstrations reset their starting inventory between cuts; resources within each action remain authoritative. The separate live RAF recording is unretimed software WebGL at 640×360 (42.5786 wall seconds for the 2.70 s reload). Before footage is the existing `8aaf082` polish clip; neither side of the comparison is time-stretched.

## Authoritative cartridge reload

| Phase | Baseline time | Mechanism / contact |
|---|---|---|
| Present / press | 0.00–0.42 s | Original outside-first thumb reach; real release contact |
| Open | .42–.64 s | Retention releases; original opposite doors clear before cylinder motion |
| Eject | .64–.86 s | Old charges discarded once at .64; strong outward spring-like pop |
| Insert | .86–1.54 s | Align at 1.3496; reach exactly 75% of insertion travel at 1.54 |
| Heavy slap | 1.54–2.01 s | Hold against resistance, rebrace palm; rapid last-quarter push and lock at 2.01 |
| Close | 2.01–2.36 s | Hand withdraws before closing; damped receiver response follows contact |
| Recover | 2.36–2.70 s | Support hand returns; firing becomes available only after recovery |

A new cartridge aligns at `(-.160, .024, -.066)`, reaches `(-.046, .024, -.066)` at 75%, and ends in the unchanged seat `(-.008, .024, -.066)`. During the first 72% of the slap phase it stays at 75% insertion while the palm rebraces outward by at most 18 mm. The final 28% drives the remaining 38 mm in .1316 s. The same seating curve drives cartridge position and retention. At **2.01 s**, and never at the partial-insertion contact, reserve decreases by 60 and installed ammo becomes 60 exactly once. Early/late cancellation retains the actual resource result. The ammo indicator remains dark until this event.

Hand contact is calibrated against the approved larger cartridge, with a flatter supporting/pushing pose rather than fingers penetrating the pressure vessel. Actual palm and instanced phalange vertices are checked through both actions at 240 Hz. The firing hand remains on its grip; cant/settling and recoil move the supported weapon rather than the camera.

### Ejection

The installed/spent objects exchange at the same transform, after both doors are fully clear at .64 s. The existing impulse trajectory is strengthened, retaining its .66 s baseline cosmetic lifetime and clear-before-tumble ordering:

- Pop distance .235 m; exponential time constant .018 s; outward drift .50 m/s.
- Travel exceeds .11 m within the first 20 ms, concentrating travel just after release.
- Fall/spin begin only after .055 s lateral clearance, using the existing gravity 9.2 and .14 upward speed.
- Angular rates XYZ become `(4.8, -3.4, 7.7)` radians/s after clearance.
- Existing geometry/material reuse and no pickup/projectile/ammo duplication are preserved.

## Authoritative thermal action

| Phase | Baseline time | Behaviour |
|---|---|---|
| Present | 0.00–.24 s | Compact vent pose |
| Control press | .24–.44 s | Thumb contacts the separate thermal control |
| Open shutters | .44–.72 s | Upper shutters open; side cartridge doors remain closed |
| Pressure release | .72–1.50 s | Brief pressure burst, bounded vapour and gradual heat reduction |
| Heat reaction | 1.50–1.87 s | Support glove withdraws and briefly shakes |
| Close shutters | 1.87–2.05 s | Cooling assembly closes |
| Recover | 2.05–2.25 s | Regrip and settle; then firing readiness returns |

The entire action blocks firing. Forced overheating records its cause on the existing sequence, producing full reaction amplitude; a preventative vent uses a smaller heat-scaled amplitude. The reaction adds at most 12 mm lateral / 14 mm vertical oscillation, with restrained wrist rotation, on a short downward/outward withdrawal. It causes no health damage or injury effect.

Heat decreases through the pressure/reaction stages; it is never reset ahead of cooling. Cartridge doors, installed cartridge and ammunition remain unchanged. Vapour uses **48 preallocated points** from three actual upper thermal-port positions, with an initial pressure-density burst and bounded residual fade. The action clock drives the particles' phase, so pause freezes them. No new lights or per-frame React updates are added.

## Per-shot physical response

`plasmaRecoil.ts` owns one analytical underdamped spring per laser assembly. Each successful muzzle trigger adds an impulse; rejected projectile-pool acquisition never triggers it. It is presentation only: camera recoil remains `.009/.006` and projectile direction, spread, damage, speed and range are unchanged.

| Tuning | Value |
|---|---:|
| Natural angular frequency | 42 rad/s |
| Damping ratio | .72 |
| Rearward velocity impulse | 2.35 m/s |
| Pitch velocity impulse | 4.2 rad/s |
| Alternating lateral velocity | ±.16 m/s |
| Alternating roll velocity | ±.54 rad/s |
| ADS presentation scale | .62 |
| Measured single-shot peak at 240 Hz | 25.21 mm rearward, 2.58° muzzle rise |
| Approximate peak time | .025 s |

An exact exponential/sinusoidal solution avoids frame-dependent Euler integration. Tests integrate identical shot times at 30/60/144 Hz and compare the result numerically, then verify the real viewmodel trigger. Position and rotation are applied about the firing-grip anchor; both actual hands/forearms inherit the supported motion. Actor/Armory bodies use a reduced .65 presentation scale. Pause freezes the action, and switch, death, reset and disposal clear the response. No geometry/material/object is created per shot.

## Plasma VFX refinement

The preceding three-draw instanced packet system and material-aware impact/scorch system are reused. Core maximum radius increases from .021 to .0235 m; wake length decreases from .32 to .235 m and becomes denser. Seeded internal variation remains restrained and rapid. Each muzzle event uses two cached meshes (a short directional cyan-white discharge and a small expanding pressure ring), with the existing single local light reused. The effect follows the real moving muzzle, remains brief, and cannot become a continuous beam.

Actual impact callbacks still drive the same bounded pools and support validation. Contact core/rim gain and a slightly broader flash improve transfer, including shield response; short residual energy extends from .25 to .32 s. Material sparks/dust, 80-slot scorch recycling, 12/16 s mark fade/expiry and character injury-mark exclusion are preserved. **Damage is unchanged.**

## Validation and acceptance

TypeScript, production build and 24 repository test commands pass, including the new tactile suite and existing Plasma polish damage/collision/scorch tests. See [verification](../verification.txt), [preserved-system hashes](preserved-systems.json), [live checks](live/live-validation.json) and [Armory controls/resource counts](armory-controls-memory.json).

Native laptop appearance, physical feel and rendering performance remain for developer acceptance. Dedicated ejection/door/glove/slap Foley gaps remain in [W07](../audio-follow-up.md); approved firing, seating and hiss recordings are unchanged. Third-person body-arm animation remains the existing rig. PR #26 stays draft, with no merge, production promotion or W04 work.
