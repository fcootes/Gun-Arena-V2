> Current audio hotfix: [quieter echo, 100-round diagnosis and original WAV hatch](../lmg-audio-hotfix/README.md). Earlier audio details below are historical; current hatch audio uses the supplied original PCM WAV. Accepted animation is unchanged.

# HMG-100 final polish — native approval pending

Continues draft [PR #23](https://github.com/fcootes/Gun-Arena-V2/pull/23) on `feat/lmg-weapon-fidelity`, from verified head `8c730902d6787e28b057c6d06ba85fc75fdf43a9`. References Issue #16. No merge, production promotion or Railgun work.

The reload now keeps the support elbow in the lower-left periphery and shows less upper arm. Player firing uses the supplied authentic M60 recording with one recorded report per gameplay round, natural release tails, and eight automatic-report variations. The approved hatch recording plays at the actual feed-cover lock.

## Animation adjustments

- Corrected the two-bone solve to recompute distance after bounded shoulder movement. The former solver moved the shoulder but reused the original distance.
- Camera-local shoulder anchor `(-.26,-.43,-.22)` m, maximum 10 cm reach lean, 32 cm upper arm and unchanged 28 cm forearm. Preferred pole `(-.70,-1,-.65)` points outward/down/forward. No arm scaling, deletion or whole-reload hiding.
- Cover handling hold `(-.04,-.39,-.53)` m with Euler `(.08,.25,.06)`; box handling smoothly raises it to `(-.04,-.22,-.53)`. This moves the reaching arm away from the near-camera central silhouette while keeping box handling visible at the lower left.
- Palm overshoot reduced from 6 cm to 2.5 cm; raised glove rotation changed from `(-.15,0,-.25)` to `(-1.10,0,-.12)` for a compact palm-down action.
- Box grip moved 3.5 cm higher on its outside surface. Extraction drop reduced from 12 cm to 7 cm, with matching continuous old/fresh box pickup and insertion paths.
- Exact palm-to-cover, box and charging-control contacts remain constrained to moving parts. The right wrist remains attached. Phase durations, front hinge/cover arc, ammo transfer at 2.42 s, cover lock at 3.1656 s, empty-only charging, interruption/chamber-only recovery, .115 s cadence and all gameplay values remain unchanged.

## Approved audio and edits

All runtime outputs are **48 kHz stereo PCM16 WAV**. M60 mono is duplicated to stereo. Decoding MP3 does not recover encoded losses. Originals are preserved outside runtime assets in `assets/audio-sources/lmg/`.

| Output | Source edit, decoded 48 kHz time | Duration | Processing |
| --- | --- | ---: | --- |
| `lmg_fire_lead.wav` | M60 **6.773875–9.637520833 s** | 2.863645833 s | Gain .58; .25 ms start fade; final 150 ms cosine fade |
| `lmg_fire_sustain.wav` | Eight real late-burst report windows listed in manifest, starting 5.193–6.0045 s | .920 s | Starts spaced 5520 frames/.115 s; gain .58; .25 ms start and 5 ms end fades; short zero padding where needed |
| `lmg_feed_cover_close.wav` | Approved hatch **1.7805–2.100 s** | .3195 s | Gain 2.4; .25 ms start and 30 ms end fades |

M60 source: **Authentic M60 Firing.mp3**, **FranklinRook1984**, [Freesound 538302](https://freesound.org/people/FranklinRook1984/sounds/538302/), **CC0 1.0**. Exact task attachment, mono MP3, 44.1 kHz/320 kbps. Decoded peaks reach 1.2366; gain provides headroom without compression or pitch changes.

Transient/envelope analysis locates the last regular direct report near **6.78 s**. The later diffuse maxima belong to the acoustic decay rather than a new periodic direct report. The lead starts immediately before that attack and retains the remaining recorded decay. Residual room sound from preceding fire remains; this is an authentic crop, not perfect source separation. Native listening must approve the tail, including the broad reflected energy in the ending.

Hatch source: **Metal_Hatch_Small_Close_02**, **Rudmer_Rotteveel**, [Freesound 718441](https://freesound.org/people/Rudmer_Rotteveel/sounds/718441/), **CC0 1.0**. The original WAV download redirects to login. The integrated source is Freesound's **official HQ MP3 preview of that exact approved recording** ([CDN URL](https://cdn.freesound.org/previews/718/718441_4921277-hq.mp3)), not another sound. This codec limitation is recorded explicitly. The main closure impact near 1.784 s and short decay are retained; preceding hatch movement/light contact is excluded. The original WAV remains an optional higher-quality input if the developer supplies it.

See the [manifest](../../src/assets/audio/weapons/lmg-fidelity/clip_manifest.json) for source/output SHA-256 hashes, formats, all sample windows, gains and fades. `python3 scripts/prepare-lmg-audio.py` reproduced identical bytes on consecutive runs. Existing box/seat/charge WAVs are byte-for-byte unchanged.

## Playback and closure synchronization

`LmgFireAudio` is a narrow WebAudio player. It decodes lead/sustain once and caches eight report buffers using a 12 ms blend into the same recorded tail after .103 s. It starts one buffer **only when an actual player shot occurs**; the sustain WAV supplies varied report attacks, rather than running an uncontrolled background loop. No pitch shift or scheduled future gunshot is used. A subsequent shot fades the previous voice over 12 ms. Trigger release starts nothing. Single taps, short bursts and final rounds therefore use one cohesive source and preserve their final tail. Automatic reload leaves the final tail alone. Switch/death/reset stops and disconnects voices; pause suspends the context; release closes it and drops cached buffers. At most two voices are retained. Bots retain their bounded existing single-report pool and now use the same M60 lead.

The first browser run exposed an unbound native `fetch` invocation; that was corrected with a wrapper. The context also explicitly requests 48 kHz so automatic report partitions remain sample accurate on 44.1 kHz devices.

The existing authoritative `cover` event now selects `AUDIO.lmgCoverClose` at slap progress .72, baseline **3.1656 s**. Class speed scales playback and late-frame sample offset together. Obsolete skipped cues are not replayed. Full legacy reload composites remain silent for the player. Cancellation before closure and chamber-only recovery do not emit cover impacts. Box and charging cues remain unchanged.

## Evidence

These are production App/WeaponStudio captures with temporary test instrumentation, not substitute model renders.

| View | Before | After |
| --- | --- | --- |
| Problematic raised support arm, identical training view/time | [Original](evidence/before-hand-raised.png) | [Revised](evidence/hand-raised.png) |
| Raised feed cover | [Original](evidence/before-cover-open.png) | [Revised](evidence/cover-open.png) |

[Ready](evidence/ready.png) · [Initial reach](evidence/cover-start.png) · [Raised cover](evidence/cover-open.png) · [Box removal](evidence/box-removal.png) · [New box insertion](evidence/new-box-insertion.png) · [Feed preparation](evidence/feed-preparation.png) · [Cover closure](evidence/slap-contact.png) · [Empty charging](evidence/empty-charging.png) · [Recovered](evidence/recovered.png).

Area 51: [normal lighting](area51/hand-raised.png), [brighter diagnostic light](area51/bright-raised.png), [look rotation + 90° FOV](area51/look-wide-fov.png), [64° FOV](area51/narrow-fov.png), [after sprint](area51/after-sprint.png). Full tactical/empty poses and validation records are in both evidence directories.

- [Reload video](evidence/reloads.mp4): nine seconds at 640×360/10 FPS. Clock-stepped production viewmodel over a frozen actual-game backdrop, played at authored tactical/empty durations. Mechanical audio is an offline event-synchronized mix, including the approved hatch cue. It is **not a real-time native-GPU recording**.
- [Loudness-matched old then new firing](audio/old-then-new.wav): old 13 s, silence 1 s, new 13 s. Each section contains a tap, three-shot burst and 20-shot burst. Fire-window RMS matching and common peak-safe gain; no limiter. This is a reproducible offline audition of the playback paths, not live capture. Reproduce with `python3 scripts/render-lmg-audition.py`.
- [Actual browser firing recording](evidence/live-firing.webm): captured from the live WebAudio graph during input/lifecycle tests, including long silent test intervals. Software rendering slows actual gameplay time; do not judge native cadence from it.
- [Actual WebAudio requests](evidence/web-audio.json): **seven player rounds, seven report starts**, native playback rate, no looping. The final empty-magazine report has no premature stop. [Mechanical requests](evidence/audio-playback.json): exactly **two** cover cues for the two completed closures; interrupted reloads add none.

## Validation and limits

Passed `npm run lint` (`tsc --noEmit`), `npm run build`, and focused suites `lmg`, `audio`, `viewmodel`, `weapons`, `controls`, `runtime`, `tactical`, `smg`, `pistol`, `pistol:sprint`, `br`, `sniper`, `shotgun`. Build retains the existing Vite chunk-size advisory.

New pose checks cover shoulder/elbow bounds, sleeve joint continuity, FOV 64/74/90, exact phase boundary wrist/elbow continuity, and 30/60/144 Hz. Existing moving-part contact, ammo conservation, empty charging, interruption and repeated resource/disposal tests pass. Recorded-buffer tests cover tap/2/3/sustained reports, distinct attacks/shared tail, no release report, bounded voices, pause/switch/death/reset, preparation races and disposal. No recurring GPU allocations were introduced.

Actual browser tests passed in Training and Area 51 with **zero JavaScript page errors**. Live Training checks cover R tactical/empty reloads, seven actual fired rounds, automatic empty reload, pause/resume, switch/cancel and chamber-only recovery, sprint fire prevention, ADS, death/redeploy and real bundled audio. Area 51 covers normal/diagnostic light, look rotation, altered FOV and post-sprint poses. Browser output retains pre-existing Three.js deprecation warnings and legacy missing/fallback sound requests; aborted media preloads also occur during cleanup.

**Native-laptop approval remains required:** elbow naturalness, arm visibility, readable weapon/hand contact, reload weight/smoothness, M60 sound character, repeat/seam audibility, single-shot decay and hatch synchronization. Automated geometry and software browser checks do not establish those subjective approvals. The October 25 reference screenshot was not attached; comparison uses an actual capture of the verified prior PR head. No native GPU performance conclusion is claimed.
