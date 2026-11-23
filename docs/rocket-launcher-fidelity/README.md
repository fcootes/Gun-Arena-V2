# W05 Rocket Launcher Fidelity

The launcher uses an original graphite receiver, reinforced front shroud, recessed optic, connected support yoke and rear control, and a hinged left-side cassette bay. The inspection and bot assemblies retain the long exhaust housing. First person uses a compact rear housing and lower, slightly closer hip carry. Both gloves track named grip groups, with a dedicated path for the support hand to open the hatch, transfer the cassette, seat it, lock the cover and recover. The Armory's **Test reload** runs the same mechanism and hands using an isolated weapon slot.

The reload uses the existing `tube` state and its original phase durations. At baseline speed it opens over 0.7128 s, inserts over 2.4552 s and closes over 0.792 s, for 3.96 s total. The existing insert boundary credits one round and deducts one reserve round. Cancelling before that boundary leaves both counts unchanged.

A successful launch drives a short front discharge and rear impulse, a 65 mm viewmodel recoil impulse and a 0.026 rad camera pitch impulse. The authoritative rocket carries its warm exhaust and short pooled trail. The swept impact supplies the centre for the existing blast and light, with a pressure ring and fading smoke and ejecta. The added particles share one draw and a 480-slot scene-owned buffer. The capture shows the player launch and the existing camera-origin projectile path. Bot spawning, propulsion, collision, splash, attribution and ammunition retain their existing rules.

## Audio handoff for W07

No dedicated Rocket Launcher recordings were supplied or found. W05 retains the shipped shotgun-report fallback and the legacy generic reload path, and calls the existing distance-attenuated generic explosion track from the authoritative rocket detonation. The legacy reload and explosion candidates resolve when their source is available. [Existing fire fallback manifest](../../src/assets/audio/weapons/batch1/clip_manifest.json)

The hatch lock reuses the installed `lmg_feed_cover_close.wav` edit of **Metal_Hatch_Small_Close_02** by **Rudmer_Rotteveel** under **CC0 1.0**. It triggers once when the actual reload clock crosses 65% of close. The existing weapon audio owner handles pause, cancellation, switching and disposal. The original clip remains shared with the LMG. [Source](https://freesound.org/people/Rudmer_Rotteveel/sounds/718441/) · [Installed cut and provenance](../../src/assets/audio/weapons/lmg-fidelity/clip_manifest.json)

| Missing recording | Authoritative event or visual contact |
| --- | --- |
| Launch report and short propulsion layer | Successful projectile spawn. Use one report and one optional distinct propulsion layer per launch. |
| Access housing ratchet | Hatch begins moving at 52% of open, around 0.37 s into a baseline reload. |
| Cassette handling | Pickup at 22% of insert. The cassette glides inward from 64% of insert, around 2.28 s. |
| Firm cassette seat | Cassette reaches the stop at 91% of insert, around 2.95 s. The cover latch already has a shared cue at 65% of close, around 3.68 s. |
| Housing closure | Hatch travels closed between 34% and 65% of close. |
| Flight layer | Optional spatial layer follows the existing rocket and ends on impact, expiry or match teardown. |
| Impact, explosion, indoor and outdoor tails | Fire once at authoritative detonation. Choose the tail for the environment. |

When approving source files, record the filename, source URL or recording session, creator, commercial-use licence and mapped event. Reload cues should cross the listed thresholds on the existing class-scaled reload clock and use the existing weapon audio lifecycle.

## Evidence

[Normal-speed Area 51 first-person recording](evidence/area51.mp4) · [Browser observations](evidence/validation.json)

The 24 fps recording uses Chromium software WebGL and the game's production scene and post-processing. The harness records one frame per 1/24 second of game simulation using actual input and 120 Hz game updates. The two bundled clips were mixed at the captured launch and lock timestamps. The recording measures in-game choreography. It does not measure real-time frame rate on a GPU.

| Gameplay | Reload |
| --- | --- |
| [Idle carry](evidence/idle.jpg) · [Walk](evidence/walk.jpg) · [Sprint](evidence/sprint.jpg) · [ADS](evidence/ads.jpg) | [Hatch access](evidence/access.jpg) · [Cassette transfer](evidence/transfer.jpg) |
| [Muzzle discharge](evidence/discharge.jpg) · [Flight trail](evidence/flight.jpg) · [Environmental impact](evidence/impact.jpg) | [Final seating](evidence/seating.jpg) · [Closure](evidence/closure.jpg) · [Return to ready](evidence/ready.jpg) |

[Armory model](evidence/armory.jpg) · [Armory reload](evidence/armory-reload.jpg)

## Verification

- `npm run test:rocket` covers named grip contacts, continuous cassette transfer, the same Studio pose, the original reload clock and ammo timing, cancellation and camera clearance under recoil.
- `npm run test:weapons` covers player and bot launcher paths, reload blocking, the original rocket speed, single impact and damage, attribution and effect cleanup.
- `npm run test:viewmodel`, `npm run test:runtime`, `npm run test:audio`, `npm run test:performance`, `npm run test:minigun`, `npm run lint`, `npm run build`, and `git diff --check` passed.
- The [browser harness](../../scripts/test-rocket-browser.mjs) verifies launcher input, one fired round, flight, impact, hatch motion, transfer and closure, inventory after reload, pause and switch cancellation, and the Armory reload control. Run with `CHROMIUM_PATH=/usr/bin/chromium node scripts/test-rocket-browser.mjs` on machines that use system Chromium.

## Files changed

- Model, carry and reload in [weaponModels.ts](../../src/weaponModels.ts), [rocketAnimation.ts](../../src/rocketAnimation.ts), [weapons.ts](../../src/weapons.ts), [viewmodelGrips.ts](../../src/viewmodelGrips.ts), [viewmodelHands.ts](../../src/viewmodelHands.ts) and [WeaponStudio.tsx](../../src/WeaponStudio.tsx).
- Discharge, projectile and impact presentation in [weaponEffects.ts](../../src/weaponEffects.ts), [rocketEffects.ts](../../src/rocketEffects.ts), [gameLoop.ts](../../src/gameLoop.ts) and [App.tsx](../../src/App.tsx). Audio timing uses [weaponAudio.ts](../../src/weaponAudio.ts) and is verified in [weaponAudio.test.ts](../../tests/weaponAudio.test.ts).
- Verification in [package.json](../../package.json), [rocket.test.ts](../../tests/rocket.test.ts), [weapons.test.ts](../../tests/weapons.test.ts) and [test-rocket-browser.mjs](../../scripts/test-rocket-browser.mjs).
- This report and the [evidence directory](evidence/).

W05 is stacked on draft PR #29 at `5c28425` so its review diff contains Rocket Launcher work. PR #29 must land before W05 targets main. [W04 draft](https://github.com/fcootes/Gun-Arena-V2/pull/29)
