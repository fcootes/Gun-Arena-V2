# Weapon audio: batch 1

The AR, shotgun, pistol and sniper use the owner-supplied edited WAV recordings in `src/assets/audio/weapons/batch1`. Vite packages the files with static asset URLs, including when the app is deployed under a subpath. The adjacent manifest records editing cuts, exact PCM sample counts and source names. The AR empty reload uses the cleaned revision with reduced background air.

Player firing uses AR single/continuous tracks, pistol single shots, shotgun blast plus pump, and separate sniper shot plus bolt. The combined sniper shot/bolt recording is used for the existing bot shot callback. Player sniper firing never plays both the combined and separate approaches.

`weaponAudio.ts` selects magazine tactical/empty tracks and fits playback speed to `totalReloadT`, with pitch preservation. Chamber-only reloads resume the chamber section of the empty track instead of replaying a magazine swap. Baseline full reload lengths are AR 3.410 s, pistol 2.090 s and sniper 2.970 s. Class reload modifiers change the audio duration along with the existing animation.

The optional phase listener in `advanceWeaponReload` reports each entered phase, including repeated shell inserts. Shotgun audio starts one shell clip per insert phase, respecting missing shells and available reserve ammo. The final pump occurs in the empty reload's chamber phase, or the partial reload's close phase. The partial-reload pump animation uses that existing close window; the clip is sped up to fit without adding reload time. Interrupting shell reload stops the insertion audio; an interrupted empty reload plays the existing pending chamber pump before firing.

Switching weapons, death, match reset, ammo refill and engine cleanup stop first-batch tracks. Pause/resume preserves the audio cursor and playback rate while the reload simulation is paused. Trigger release stops the AR loop.

The remaining weapons retain their previous audio routing. No damage, firing cadence, ammo capacities, reserve calculations, class modifiers or reload durations change in this batch.

Validation: `npm run lint`, `npm run build`, `npm run test:audio`, `npm run test:tactical`, `npm run test:weapons`, `npm run test:batch1`, `npm run test:runtime`. The audio tests check all 16 real PCM assets, loop restart behavior, reload selection and timing, shell counts through phase boundaries, interruption, chamber-only resumes, and pause/stop lifecycle. Listening in the running game remains the final subjective check.
