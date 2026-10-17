# Heavy LMG fidelity — HMG-100

Starting main: `a00bdc6cb91d407285e0a05eae102cf7699a9981` (merged SMG PR #22). Branch: `feat/lmg-weapon-fidelity`, directly from fetched `origin/main`. One draft PR against main; no merge or production promotion. PR #21 is not a prerequisite.

This checkpoint implements the isolated HMG-100 model, front-hinged feed cover, side ammunition box, attached feed belt, authoritative player reload profile, articulated cover/box contact, downward palm-driven cover closure, empty-only receiver charging and LMG-only raised-arm support. Capture/acceptance results are recorded after validation.

## Timing and contact

| Phase | Seconds at class multiplier 1 |
| --- | ---: |
| Lift/reach | .36 |
| Open cover | .44 |
| Release/remove box | .56 |
| Acquire replacement | .36 |
| Seat box | .70 |
| Prepare feed | .40 |
| Raise palm, slap/lock cover | .48 |
| Empty-only charging/recovery | 1.00 |
| Return to ready | .45 |
| **Tactical / empty** | **3.75 / 4.75** |

The existing `beginWeaponReload` / `advanceWeaponReload` clock owns phases, class duration modifiers, ammo transfers, chamber readiness and mechanical events. Player-only LMG timing leaves bot cadence intact. Ammo transfers at insertion end (2.42 s); an empty chamber remains blocked until 4.30 s, and reload recovery blocks firing until 4.75 s. Switching after insertion preserves ammo/need-to-charge and resumes a 1.45 s chamber-only action. The existing HUD identifies feed locking, chambering and an interrupted uncharged weapon.

The front cover pivot is `(0,.058,-.18)` m, with its geometry extending rearward from that hinge. It opens 1.15 radians, and its origin remains fixed. The cover stays open until slap progress .43; the palm contacts its modeled top pad and follows its rapid closing arc until lock at .72 (global time **3.1656 s**). A separate 5 mm receiver settle follows locking. Finger curl flattens for cover contact and tightens for the box/charging control. Contact uses the actual part-to-weapon matrices and the glove's palm surface, not an approximate wrist point.

The left sleeve uses an LMG-only 32 cm upper arm and 28 cm forearm during reload, with two-bone reach and a small shoulder lean. This keeps the raised arm connected without stretching the forearm or exposing a chopped elbow. It reuses the faction sleeve material and owns one cached mesh. The accepted pistol free-arm gait and other weapons' hand/sprint code paths remain unchanged.

The old/fresh side boxes share baked geometry/materials; their removal/seating paths stay outside the receiver. The entire feed path disappears before a box detaches and returns only after seating and the feed-preparation gesture. No floating belt, independent belt physics, runtime mesh allocation or duplicate box remains at reset. The charging control travels 50 mm on the near side of the receiver (`z=.025` to `.075`), ahead of the stock. Hands, box, lid, control and visible recovery derive from normalized authoritative phase time and reset from cached origins.

## Audio diagnosis and treatment

[Measured source audit](audio-audit.json). `playContinuous()` already retains one voice; repeated shot events did not restart it. The old five-report loop was .575 s; the .080 s opening recording left a **.035 s gap** before the next .115 s shot event. Five report windows span **1.545 dB** in RMS level and their early peaks are uneven. The file's endpoint discontinuity is zero: no audible seam-click claim is made.

`scripts/prepare-lmg-audio.py` reproducibly derives assets from the existing user-supplied batch2 LMG recordings, with no download or unrelated substitute. A .115 s lead fills the opening interval; a **3.565 s / 31-report** sustain uses deterministic reordering, aligned early energy, restrained level normalization/variation and 1 ms-per-side joint blends. Sample rate and pitch stay unchanged. Report RMS range falls to **.437 dB**. Existing single→one-loop→last-report playback and all stop/pause/switch/death hooks remain; the last round uses a complete lead report. Trigger release stops the existing loop immediately; a separately recorded natural long release tail is not available. Native listening must assess the remaining timbre/texture and release feel; waveform analysis is not subjective audio acceptance.

Box release (.215 s), seating (.330 s) and charging (.330 s) are cropped from the documented LMG composite cuts. Exactly one discrete event plays each at the authoritative action time and class speed, with late-frame cursor handling. No full composite also plays, and tactical reloads have no charging cue. [Derived-asset provenance, hashes and missing-asset specification](../../src/assets/audio/weapons/lmg-fidelity/clip_manifest.json).

**Missing recording: `lmg_feed_cover_close.wav`.** The existing tactical composite has only the two manifest box cuts; the empty recording adds the charging cut. The remaining regions are silent, so no distinct cover impact was established. The slap event exists and is synchronized, but deliberately has no borrowed magazine/AR/shot sound. Supply an original/licensed **.18–.35 s** dry metallic feed-cover slam, strong contact transient at time zero and short latch decay, 48 kHz PCM, without speech, gunshot, box or charging layers. It belongs at slap progress .72 / **3.1656 s** at baseline class. No isolated cover-opening cue is established either; request one only if the final listening review needs it. Final audio acceptance remains incomplete until the cover impact is supplied and reviewed.

## Preservation and validation

The clean working tree and existing branches were inspected; fetched main contains accepted SMG, pistol, AR, shotgun, sniper, upright Battle Rifle, hands, sprint and APEX changes. No world generation, AI, maps/modes, movement, projectile/hit logic, fire rate/damage/spread/capacity/reserve, input binding, ADS sensitivity or global sprint overhaul is included.

[Eleven other-weapon fingerprints](preserved-weapons.json) compare exact baseline/current first-person and actor geometry/materials, hip/ADS/sprint transforms, hand palettes, tactical/empty state and animation. They match exactly.

Focused tests cover phases, the fixed hinge, palm/cover and box contact, raised palm, belt visibility, lock-before-charge, authoritative ammo/conservation, duplicate R, cancellation/chamber-only continuation, repeated reloads, pause/switch/death/reset, frame-rate agreement at 30/60/144 Hz, and zero recurring geometry/material/object allocations. Shared tests additionally verify the connected LMG elbow/upper-sleeve joint and all visible near-plane bounds. Audio checks cover isolated events, class speed, late skips, no duplicate/faked cover cue, full-interval lead, one continuous sustain and stop/pause/reset.

Native-laptop review is required for weight, posture/clipping, dark-material readability, return to ADS, sustained-fire texture and the missing cover-impact integration. Railgun and global sprint work are untouched.
