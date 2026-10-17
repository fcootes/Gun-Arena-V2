# SMG Fidelity — SC-32, charging control and magazine handling

Baseline: latest remote `main`, `fe8aa68f2db3a47d62050c055eb02511751dc3ca` (PR #20 merged 17 October 2026). Dedicated branch: `feat/smg-weapon-fidelity`, targeting `main`. Draft review only; stop for the user's laptop playtest. No merge or production deployment.

The initial shell could not reach its proxy. GitHub's connector supplied the signed merge, recursive tree and all 40 changed blobs; every imported object matched its Git SHA. A subsequent normal `git fetch origin main` with network access also confirmed the same baseline. The initial working tree was clean. Existing local/remote feature branches were inspected and retained.

## Model and hands

The SC-32 uses an original tapered compact upper, composite lower and handguard, straight narrow double-stack magazine with floorplate/grooves, a flared magwell, integrated rear cap and telescoping twin-rail brace. Short barrel/muzzle housing, protected open iron sights, restrained cooling slots and seam/pin details replace the shortened-AR silhouette. Its own finishes separate dark alloy, composite and moving controls. Static geometry stays baked by material; fresh magazines share the old magazine's baked buffers.

Only the SMG's grip profile changes: 25 mm closer and 25 mm lower at hip, a clear iron-sight aim line, short bounded sleeves and a palm against the handguard underside. The firing hand stays at its pistol-grip attachment throughout reloads and two-handed sprint. Existing tactical carry and transition logic remain in place; the pistol's free-arm sprint is not reused.

The near-side charging assembly is a child of the receiver. Its origin is `(-.043, .040, -.095)` metres; the local slide moves along +Z by **34 mm**, ending at `z=-.061`. The fixed guide is 105 mm long. It never approaches the rear cap at `z=.145`, stock or camera. Hand contact is transformed through the actual control-to-weapon matrix. Reach finishes at 30% of the chamber phase, before the embedded sound and pull at 30.6%; the control returns by 95%. The hand recovers to the handguard during close. Automatic shots retain only a separate **12 mm / 70 ms** mechanical stroke, with the support hand fixed forward.

## Authoritative reload and audio

`beginWeaponReload` / `advanceWeaponReload` still own all ammunition and readiness transitions. The SMG adds player-only phase durations inside that state machine. Bot cadence, damage/spread, 72 ms fire interval, 32/192 capacity, input, recoil, ADS sensitivity, physics, hit registration and automatic-fire sounds remain unchanged.

| Phase | Tactical seconds | Empty seconds |
| --- | ---: | ---: |
| Reach/orient | .240 | .260 |
| Extract | .2808 | .396 |
| Acquire/insert | .6318 | .790 |
| Charging action | — | .497 |
| Recover/ready | .4474 | .297 |
| **Total at class multiplier 1** | **1.600** | **2.240** |

Class duration multipliers still scale all phases. Tactical reloads never pull the control. Empty ammunition transfers only at the insertion boundary (1.446 s), remains unchambered until 1.943 s, and cannot fire until recovery ends at 2.240 s. Cancelling after insertion preserves both ammo and `needsChamber`; the subsequent chamber-only recovery lasts .794 s without another magazine exchange.

The support hand reaches the old magazine before extraction. Old/fresh magazines exchange below the viewport on a continuous stow/acquire path; the fresh magazine aligns beneath the actual well before a nonlinear seating stroke. A small 4 mm receiver response accompanies seating. Each presentation update reconstructs part transforms from cached origins; it never grants ammo or accumulates offsets.

Reused assets: `batch2/smg_reload_tactical.wav` (1.123208 s), `batch2/smg_reload_empty.wav` (1.980 s), and the existing batch3 single/automatic fire WAVs. No new/replaced recordings. The existing manifest contains separate magazine-out/in cuts and the empty charging cut. The unchanged composite starts after the initial reach and runs at **1 / class multiplier** playback speed; baseline recordings are not slowed. Tactical action onsets are .240 / .767604 s, empty onsets .426 / 1.202 / 1.598 s. Late frames seek to the correct audio cursor. Chamber-only playback begins at original clip offset 1.186 s, preserving the .152 s approach before its charging cue. There is one composite voice, with no duplicate chamber layer. Existing pause, cancellation and loop behavior remain intact. No missing sound asset was established.

## Baseline acceptance and preservation

PR #20 is merged. The read-only AR audit confirms its eye-near receiver latch, 45 mm bounded action, shared hand/control clock, tactical/empty distinction and lowered/closer grip. No new significant AR implementation gap was found; subjective visual acceptance remains with the user. No AR redesign or roadmap completion update was made.

[Preservation fingerprints](preserved-weapons.json) compare every other weapon with this exact main snapshot, including first-person and actor geometry/materials, hip/ADS/sprint transforms, instanced hand palettes, tactical/empty reload state and transforms. All eleven match exactly. Shotgun, Heavy Sniper, upright Battle Rifle, accepted pistol sprint and shared hands tests also pass. No map, game-mode, AI, movement, collision, input binding or APEX preparation implementation changed.

## Validation and real rendered evidence

Supported checks: `npm run lint`, `npm run build`, `test:smg`, `test:weapons`, `test:viewmodel`, `test:audio`, `test:pistol`, `test:pistol:sprint`, `test:br`, `test:sniper`, `test:shotgun`, `test:controls`, `test:runtime`, `test:performance`. Production build retains the existing Vite chunk-size advisory.

SMG tests sample 30/60/144 Hz, three class speeds and four ammo counts, exact old/fresh magazine and charging contact, bounded control travel, no tactical charging, no early ammo, conservation, interrupted/chamber-only recovery, repeated reload/reset, small firing-only motion, two-handed sprint/ADS, pause/switch/death/reset, frame-rate agreement and GPU resource reuse. Audio tests check one native-rate composite, delayed start, late-frame cursor, cancellation and manifest charging onset alignment.

The browser harness loads the production App scene/camera and actual WeaponStudio. Pose stills deterministically advance the authoritative clock; live keyboard/mouse checks separately exercise input/state/audio and interruption paths. See [validation](evidence/validation.json) and [audio playback](evidence/audio-playback.json). Run `npm run test:smg:browser`; `SMG_OUTPUT` selects a destination and `BENCHMARK_BROWSER` selects Chromium.

- Model: [side](evidence/model-side.png), [top](evidence/model-top.png), [three-quarter](evidence/model-three-quarter.png).
- In game: [ready](evidence/ready.png), [tactical removal](evidence/tactical-removal.png), [magazine seating](evidence/magazine-seating.png).
- Empty reload: [control contact](evidence/charging-contact.png), [full retraction](evidence/charging-retracted.png), [support recovery](evidence/support-recovery.png).
- Transitions: [ADS after reload](evidence/ads-after-reload.png), [two-handed sprint](evidence/two-hand-sprint.png).

These are actual software-rendered gameplay/armory captures, not generated artwork. They verify geometry and contact, not native-GPU timing/feel. No continuous video is claimed. Laptop approval is still needed for perceived weight/speed, hand clipping under native lighting, sound balance, framing and sprint/ADS transitions.

Vercel project: `gun-arena-v2` / `prj_DDWeVXM4KIIWXoGNSkw7HiDolhYG`, team `team_cEtZBHn6ymqZWTvyGsE6vJda`. Deployment inspection via the connected Vercel API returns team-scope HTTP 403; no CLI is installed. The draft PR records the final head and any exact-commit deployment evidence available through GitHub. No production deployment/promotion or protection change is performed.
