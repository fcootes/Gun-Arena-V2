# W01 LMG audio hotfix — native listening and gap retest pending

Continues draft [PR #23](https://github.com/fcootes/Gun-Arena-V2/pull/23), branch `feat/lmg-weapon-fidelity`, from verified head `a25793d311b8c11aa8ee77e7852183854bd432bf`. The developer reports that the revised reload animation is substantially better. It is preserved byte-for-byte.

This pass lowers the recorded echo, replaces the hatch preview with the supplied original WAV's second clang, and removes avoidable LMG audio scheduling work. **The precise cause of the developer's native-laptop gap near 50 rounds is not established.** No missing audio event or bad bank wrap was found in the captured 100-round runs. The captured software-renderer hiccup also delays the actual gameplay shot; it is not evidence of an isolated audio-loop restart.

## Echo correction

The old final-report crop had reflected energy at 350–750 ms that was louder on average than its first 20 ms. The final shot and every automatic variant reused that tail, and bot shots used the same lead. This explains the loud wash on release.

- Same approved FranklinRook1984 M60 master and direct transient. **The first 55 ms of output PCM is bit-identical to `a25793d`.** No whole-recording volume reduction or pitch processing.
- Base gain remains .58. Smoothstep interpolation in dB passes through `(seconds, dB)` points `(0,0), (.055,0), (.20,-12), (.65,-16), (1.00,-24), (1.20,-60)`.
- Quiet final 40 ms cosine fade reaches zero naturally. The runtime does not gate the tail when the trigger is released.
- `lmg_fire_lead.wav` now uses decoded source **6.773875–7.973875 s**, duration **1.200 s**, 48 kHz PCM16 stereo. The original source remains untouched. M60 is MP3-derived; WAV conversion does not restore lost information.
- Measured RMS reductions relative to the prior asset: **14.01 dB** at .20–.65 s; **15.05 dB** at .35–.75 s; **18.02 dB** at .65–1.00 s. Attack loudness is unchanged.
- All eight cached automatic variants blend into the corrected shared tail, so taps, bursts, sustained-release/final rounds and bots all receive the correction. The eight automatic attack windows are byte-identical to the previous bank.

[Equal-main-shot echo audition](audio/echo-before-after.wav): old 8 s, 1 s silence, new 8 s. Both sections have a tap at .1 s and a three-shot burst at 3.4 s. Initial-report samples and overall gains are identical, so the comparison exposes the echo change directly. [Measurements](audio/audition.json). This is an offline playback-path render, not microphone capture.

## 50-round gap investigation and bounded scheduling changes

The actual production App was instrumented temporarily through Vite. Real mouse-held firing consumed **100 rounds**, with gameplay shot number, ammo, timestamp, AudioContext time/start, selected variant, buffer frames/duration, gains/fades, decode/context counts and cleanup recorded. No production instrumentation is shipped.

| Check | Finding |
| --- | --- |
| Actual gameplay rounds → WebAudio starts | **100 → 100**, both before and after |
| Shot 50 / remaining ammo 50 | Correct **variant 0**, one audio start, no decode or context restart |
| All eight direct reports | Strong attacks; no empty/weak slot. Attack RMS range before the hotfix is only about 1.05 dB |
| Every 8→1 wrap | Correct buffer selection; no additional or missing start |
| Context/decode lifecycle | One context and two decoded files per run; no suspension/reinitialisation established during the magazine |
| Baseline software run at shot 50 | Gameplay interval **513.2 ms**, audio interval **450.67 ms**; shot delivery itself is late |
| Baseline shot-call-to-audio-start code latency at round 50 | **.2 ms**, so the recorded half-second hole is upstream of this playback call |
| Audio-focused run | Also 100→100. It freezes canvas rendering while real App input/game logic continue, isolating the audio path; it is not a native rendering benchmark |

[Diagnosis and interval summaries](evidence/diagnosis.json) · [baseline full trace](evidence/before-browser-trace.json) · [updated audio-focused trace](evidence/after-browser-trace.json) · [original variant measurements](evidence/baseline-bank.json).

The two runs use different rendering conditions and must **not** be treated as a performance before/after benchmark. Main-thread delivery and audio-clock/wall-clock differences in this software environment prevent a native timing conclusion.

Two small, verified LMG-only improvements are included:

1. Running contexts no longer receive an unnecessary `resume()` command/promise for every shot. The updated actual 100-round run issues **zero per-shot resumes** while running. Suspended contexts queue the complete voice **before** requesting resume; an offline rendering test exposed how resuming first could advance the clock before source construction. A focused driver-clock test protects that ordering. This fixes a scheduling race on resume; it is not claimed as the established native 50-round root cause.
2. The unused legacy HTML LMG loop voice is no longer prepared or fetched in parallel. WebAudio still decodes the required sustain bank once. No future shot is pre-scheduled to cover a gameplay stall; ammunition and the .115 s fire gate remain unchanged. Maximum two voices remain retained.

A separate **real browser OfflineAudioContext** rendered all 100 reports at .115 s cadence using the actual `LmgFireAudio` class, native buffers/nodes and all bank wraps. Every rendered attack passed the energy check, with start quantisation within one 128-frame audio quantum. This isolates asset/wrap correctness from software-frame stalls; it does not establish native gameplay smoothness.

- [Browser-rendered 100-round native-cadence WAV](evidence/100-rounds-offline.wav) · [render trace and attack energies](evidence/offline-trace.json)
- [Actual baseline gameplay WebAudio recording](evidence/before-browser-100-rounds.webm)
- [Actual updated audio-focused gameplay recording](evidence/after-browser-100-rounds.webm)

The live recordings capture the actual WebAudio graph, with software-induced shot timing and long intervals; use the offline recording to judge the report bank at native cadence.

**Remaining gap check:** hold a full magazine on the developer's laptop and judge 60→40 ammo. If a hiccup remains, establish whether gameplay/animation/ammo delivery also pauses. The provided native browser trace mode can collect the evidence without changing game code: `LMG_AUDIO_NATIVE=1 npm run test:lmg:audio-browser` (requires Playwright's browser installed; `BENCHMARK_BROWSER` optionally selects an installed Chrome/Chromium). It uses hardware rendering by default. Do not call the native issue definitively fixed from the software tests alone.

## Original WAV second clang

Exact uploaded master preserved as [`assets/audio-sources/lmg/718441__rudmer_rotteveel__metal_hatch_small_close_02.wav`](../../assets/audio-sources/lmg/718441__rudmer_rotteveel__metal_hatch_small_close_02.wav): **44.1 kHz, stereo PCM16**, 755,780 bytes. Creator **Rudmer_Rotteveel**, [Freesound 718441](https://freesound.org/people/Rudmer_Rotteveel/sounds/718441/), **CC0 1.0**.

`lmg_feed_cover_close.wav` is regenerated from **1.7815–2.100 s**, selecting the **second, louder impact near 1.80 s** and short metallic decay. The first clang near .55 s and preceding movement are excluded. A .25 ms attack fade and 30 ms end fade avoid clicks. Existing gain **2.4 is retained**, not increased; output peak is **.6563 / −3.66 dBFS**, without limiting or clipping. Output is **.3185 s, 48 kHz PCM16 stereo**. The main attack begins within roughly 1 ms of the crop start.

The authoritative `cover` event remains slap progress .72 / **3.1656 s** at baseline. Class speed and late-frame offsets are unchanged; the fallback duration reflects the new asset. Tests verify one cue at lock, no duplicate composite, silence for pre-closure cancellation, and chamber-only recovery. Box release, seating and charging WAVs remain byte-identical.

[Current provenance manifest](../../src/assets/audio/weapons/lmg-fidelity/clip_manifest.json) records source hashes, title/creator/URL/licence, original format, crop boundaries, gain envelope/fades, runtime variants and output hashes. The old HQ MP3 preview is archived outside runtime assets and is no longer used by preparation. Consecutive preparation runs reproduced identical bytes.

## Validation and scope

Passed:

- `npm run lint` (TypeScript / `tsc --noEmit`) and production build. The existing Vite chunk-size advisory remains.
- `npm run test:lmg`, `npm run test:audio`, `npm run test:lmg:audio-assets`, `npm run test:runtime`, `npm run test:tactical`.
- New recorded-buffer tests: 100 shots at simulated **30/60/144 FPS**, exact gameplay/audio event mapping including 60→40 ammo, repeated eight-variant wraps, no empty last report or release shot, rapid retrigger, bounded voices, one required resume, pause/switch/death/reset/preparation-race disposal, and queue-before-resume ordering.
- Asset checks: bit-identical initial 55 ms, measured 14–18 dB echo reduction, smooth ending/headroom, source/output hashes, original-WAV second-clang correlation, unchanged automatic attack bank and box/charge WAVs.
- Actual App/WebAudio 100-round traces and separate native OfflineAudioContext render; no JavaScript page errors. Existing legacy fallback audio/Three.js diagnostics remain documented in the earlier pass.
- Existing real-input lifecycle browser run passes for taps, release, automatic empty reload/final tail, pause/resume, switch/chamber recovery, sprint/ADS, death/redeploy, and exactly two cues for the two completed closures. [Audio starts](evidence/lifecycle-web-audio.json), [mechanical cues](evidence/lifecycle-audio-playback.json), [validation](evidence/lifecycle-validation.json). Pose entries in that validation are reused from the accepted pass; no visual work was performed for this audio hotfix.

[Protected-file SHA-256 proof](evidence/unchanged-scope.json): `App.tsx`, types, all LMG mechanics/reload/geometry/hand pose code, weapon stats, world and bots are byte-identical to `a25793d`. No movement, control, AI, faction or rendering-system changes. No merge, production promotion or Railgun work.

Native listening remains required for the echo balance/natural decay, second-clang synchronization, and whether the reported 50-round hiccup persists. The precise native hiccup cause remains an open diagnostic limit, not a claimed confirmed fix.
