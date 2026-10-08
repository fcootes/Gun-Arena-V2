# Weapon audio: batch 2

This integration adds the 15 supplied WAVs for SMG reloads, LMG firing/reloads, battle-rifle firing/reloads and minigun operation. The uploaded cleaned AR empty reload is byte-identical to the version already installed. SMG firing, plasma, railgun and launcher clips were not included in this upload; their audio routing is unchanged.

The files live in `src/assets/audio/weapons/batch2`, with static Vite asset URLs and an editing manifest. `weaponAudio.ts` now manages both integrated batches. Reload recordings fit the actual phase total and class multiplier with pitch preservation. Chamber-only resumes skip the magazine swap.

| Weapon | Tactical reload | Empty reload | Chamber section offset |
| --- | ---: | ---: | ---: |
| SMG | 1.123208 s | 1.980 s | 1.287 s |
| LMG | 3.276 s | 5.544 s | 3.696 s |
| Battle rifle | 0.748792 s | 1.320 s | 0.858 s |

The LMG uses an isolated report for the initial or last round, then one uninterrupted loop during sustained fire. Reload, release, loss of active firing, death and switching stop the loop. Bot shots use isolated LMG reports.

The battle rifle starts the supplied three-report recording once per full burst, rather than once per bullet. Magazines with only one or two rounds use individual reports on each actual bullet. Bot callbacks also use single reports. The existing 75 ms burst timers, ammo, damage and raycasts are preserved.

The minigun replaces its synthetic motor, shot and vent calls with the supplied recordings. Warmup plays once, seeks to the existing spin progress on a quick re-press, and transitions to a single continuous firing loop at the existing 0.5 s threshold. Release plays one motor coast-down fitted to the remaining barrel speed at 20 units/s. Emergency cooling fits the separate motor recording to the 15 units/s barrel decay and plays one hiss. Manual venting resets the barrel speed immediately in the existing game logic, so it plays the hiss alone.

The existing vent timer is 2 s, while the class-adjusted reload sequence can end sooner; cooling recordings fit the earlier endpoint. Gameplay timings are unchanged. The supplied overheat composite is packaged as an alternate recording, but is not layered into gameplay: its motor ends at 1.4 s, whereas full-speed emergency barrel decay is about 1.867 s. Separate tracks keep that animation aligned and avoid doubling the hiss.

All integrated tracks pause/resume with their playback position and rate intact, and stop on death, switching, match reset, field refill and teardown. Validation covers real PCM assets, reload fitting/chamber offsets, exact burst counts, loop starts/stops, warmup/re-press, normal/emergency spin timing, cooling without duplicate composite playback, and actual reload dispatch. Production build, TypeScript and existing tactical/weapon/runtime checks pass. An in-game listening check remains pending.
