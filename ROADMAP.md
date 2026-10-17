# Gun-Arena V2 — Development Roadmap

> **Status:** Planning proposal, 17 October 2026. This document is an additive project-level roadmap. The ordered, authoritative weapon-specific acceptance backlog remains [Issue #16](https://github.com/fcootes/Gun-Arena-V2/issues/16). **Do not silently reorder, erase or declare acceptance of items in Issue #16.** Merged PR = integrated source, not proof of the user's final laptop/gameplay approval.

## Vision and scope

Evolve **Gun-Arena V2** into a responsive, performant, visually coherent WebGL tactical FPS with meaningful encounters, clear objectives, believable weapon handling and distinctive extraction missions.

**Preserve all three playable theaters:** Area 51 Facility (replacement for retired Bunker Hangar only), Operation Shattered Wall / Pacific Rim, and Training Grounds. Preserve **Extraction and Survival**, USMC and APEX faction behavior, squad controls, existing objective flow and weapon functionality. Do not silently add multiplayer commitments, replace the existing engine or initiate major map rebuilds as a side-effect of polish.

**Release discipline:** Small feature branches and PRs; no direct pushes/merges to `main`, no production promotion without explicit user approval. Every gameplay or visual change needs relevant automated checks plus native-GPU, in-game acceptance. Respect actual installed React/Three.js versions and cross-module TypeScript contracts. Retain explicit resource ownership, disposal, bounded initialization and performance work.

## Where we are (GitHub-verified on 17 October 2026)

| Workstream | PR | Repository state | Follow-up |
| --- | --- | --- | --- |
| Tactical input and grounded sprint | [#13](https://github.com/fcootes/Gun-Arena-V2/pull/13) | **Merged** | Preserve input/ADS/fire restrictions |
| APEX Extraction combat-light preparation | [#14](https://github.com/fcootes/Gun-Arena-V2/pull/14) | **Merged** | Confirm cold/warm load and gameplay on user's laptop across both maps; don't assume every deployment issue is gone |
| Articulated viewmodel hands and grips | [#15](https://github.com/fcootes/Gun-Arena-V2/pull/15) | **Merged** | Retain correct grip and support-hand attachment |
| Shotgun fidelity | [#17](https://github.com/fcootes/Gun-Arena-V2/pull/17) | **Merged** | Regress pump, shell loop, sound timing and interruption |
| Heavy Sniper fidelity | [#18](https://github.com/fcootes/Gun-Arena-V2/pull/18) | **Merged** | Regress manual R bolt-cycle, ADS and reload |
| Battle Rifle fidelity | [#19](https://github.com/fcootes/Gun-Arena-V2/pull/19) | **Merged** | Regress bullpup identity, stock/grips and upright rear-mag reload |
| Combat Pistol fidelity | [#20](https://github.com/fcootes/Gun-Arena-V2/pull/20) | **OPEN, DRAFT** | User's latest sprint-gait feedback remains an acceptance item; do not merge prematurely |

Other earlier gameplay, UI, world and performance PRs are history, not a substitute for final visual/playtest acceptance. See the existing PR descriptions and documentation.

## PHASE A — Complete the established Weapon Fidelity Roadmap (committed order)

**Source of truth: [Issue #16](https://github.com/fcootes/Gun-Arena-V2/issues/16).** Do not allow the new sprint or encounter ideas to silently displace these weapons.

### A1 — Combat Pistol: finish draft PR #20

**Next immediate task.** Tune the existing shoulder/elbow-driven one-handed sprint, not a new bob system:

- Slow both arms together (the current `2.05` complete stride pairs/s is visibly too quick; evaluate approximately `1.7–1.8` without treating a trial number as final).
- Broaden the right arm's *real shoulder-driven* forward/backward and vertical excursion: the pistol must pump rather than float/bob in place.
- Left arm: moderately more useful upward range; reduce excessive forward reach; at forward apex the fist should be **above the elbow** with an approximately upright forearm.
- Preserve fixed bone lengths, hand-to-gun grip, opposing cadence, continuous curved paths, third-person phase consistency, responsive transitions, FPS camera comfort and all shooting/reload mechanics.
- Validate across 30/60/144 FPS, capture a **real-time 6–10 second gameplay clip** and both opposing apexes, then obtain explicit laptop visual approval.

**Definition of done:** User accepts speed, two-arm motion, pose and weapon attachment; targeted mechanics tests, lint/build and no visual regression. Keep PR #20 in draft until approved.

### A2 — Assault Rifle: complete the other half of Issue #16 step 4

- Lower/closer first-person framing without misaligning ADS or arms.
- Move receiver charging hand/action to plausible reachable location rather than the rear stock.
- Distinguish tactical vs empty reload visuals/audio; preserve existing good magazine action.
- Dedicated PR and user footage/acceptance.

### A3 — SMG and LMG (Issue #16 step 5)

- **SMG:** closer/lower viewmodel, precise primary/support hand grips, believable magazine/action timing and correct audio.
- **LMG:** connected top feed cover, open/close/slap interaction, coherent belt/magazine handling with discrete mechanical sound; make weight and support stance readable.
- Use manageable PR scopes and record per-weapon visual/audio acceptance.

### A4 — Railgun and Plasma Rifle (Issue #16 step 6)

- **Railgun:** properly modeled rear breech/cartridge interaction (preferred concept **not final user sign-off**), lock/close action and charge/sound synchronization.
- **Plasma:** rebuild/fix inconsistent model/viewmodel, coherent manual interaction with chamber/vent/insert, retain heat/overheat rules and accurate audio.
- Audit and gain approval for the breech concept before treating it as settled.

### A5 — Minigun, launchers and integrated fidelity pass (Issue #16 step 7)

- **Minigun:** user-reference *handheld under-cradled* carry, **not** rear spade-grip controls; correctly attached support hands and spin-up/down/heat effects.
- **Rocket and grenade launchers:** framing and grip; investigate currently missing/inaudible firing and reload audio before gathering new clips. Preserve projectile behavior.
- Final cross-arsenal viewmodel, reload, audio, ADS, perspective-switch and disposal review.

### A6 — Audio acceptance audit (cross-cutting; must not be skipped)

The supplied batch1/2/3 WAV libraries and manifests are already integrated in varying degrees. Audit actual event-to-animation alignment, composite duplicate actions, clip quality and whether specialty mechanical clips are absent. **Do not download or synthesize replacement clips before proving a specific gap.** Add original/licensed recordings only after a concrete, approved asset list.

**Gate to Phase B:** Every Issue #16 item has a linked implementation/review or a clearly recorded outstanding acceptance exception; all twelve weapons function during actual gameplay and have appropriate hand/weapon interactions and sound.

## PHASE B — Tactical Movement and Sprint Fidelity (new proposal; *after* the existing weapon sequence)

### B1 — Two-handed weapon sprint motion framework

The current low/side-carry transformations make many rifles seem rigidly pinned in place. Create one **shared, configurable procedural two-hand locomotion framework** with weapon-specific profiles, rather than twelve unrelated trigonometric bobs:

- Coordinated shoulder/elbow and body-weight transfer; both grips remain constrained to the weapon.
- Natural forward/backward weapon path with restrained roll, settle/reversal and direction-aware reaction; no floating or intersecting hands.
- Profiles for carbine/AR, SMG, Battle Rifle, shotgun, sniper, LMG, plasma, railgun, heavy minigun and launchers.
- Separate sprint, stop, ADS, reload, switch, air/ground and local third-person state behavior.
- Keep hit detection, fire restrictions, responsiveness, movement speed and weapon balance unchanged in this presentation-only stage.
- Optimize scratch allocations/disposal and validate native-GPU footage at useful real-time playback rates.

### B2 — Grounded locomotion feel (requires user approval)

Explore *small*, testable changes to sprint acceleration/deceleration, turn-response, carry/recovery and directional movement. No arbitrary camera shake, overly restrictive stamina or general speed nerf without playtest consent.

**Gate:** Sprinting looks and feels physical without hurting precise shooter controls.

## PHASE C — Encounter Integrity and Tactical Pacing (new proposal)

**Player-reported problem (17 Oct):** in Area 51 Extraction, players can run past too many engagements. This is a **design problem**, not automatically an animation bug. Diagnose first: log encounter activations, bot awareness, pursuit, objective gating and run-through times on both factions. Establish a reproducible baseline.

Candidate changes, sequenced conservatively:

1. Make encounter activation, enemy pursuit, target memory and positioning robust; prevent bots from simply forgetting fast-moving players.
2. Design readable combat spaces, flanking pressure, suppression and squad coordination where appropriate; preserve fairness and performance.
3. Tie meaningful objective interactions to controlled zones when fiction and mission demand it; avoid locking every door behind mandatory elimination or invisible walls.
4. Tune equipment/mobility trade-offs only if enemy/objective fixes do not solve bypassing; avoid blanket stamina meters or hard speed reductions by default.
5. Measure multiple viable approaches: stealth/bypass where deliberately intended, fighting through and tactical repositioning; both APEX and USMC must remain playable.

**Gate:** A skilled player can maneuver and disengage, but cannot casually bypass the whole mission with no tactical consequences. No broken objective progression or enemy performance regression.

## PHASE D — Area 51 Extraction vertical slice (new proposal)

Polish one complete **start-to-extraction** experience before broad expansion:

- Verify staging → decontamination → Bio-Lab → warehouse/boss → helicopter extraction, including elevator, bulkhead and mission objective states.
- Improve navigation readability, mission cues, combat encounter pacing, checkpoints/failure recovery and squad participation.
- Validate faction-specific flows (APEX guards/marines/Spartans vs USMC infected/boss) and cold/warm deployment.
- Optional **independent prototype** for the desired cinematic Area 51 helicopter insertion: desert approach, facility reveal, onboard briefing, landing and transition into first person. Prototype separately, with approved voice/audio sourcing, before integration.
- Preserve the existing flight/extraction sequence and map geometry until a replacement is accepted.

**Gate:** One polished, replayable, reliably complete vertical slice on the actual target laptop.

## PHASE E — Graphics, audio atmosphere and content polish (future candidate backlog)

**Proposals, not previously approved commitments:**

- Lighting and visual identity: distinct Area 51 sterile/industrial atmosphere vs stormy Shattered Wall, with measured GPU cost and no hidden fidelity downgrade.
- Operator and squad animation consistency (first-/third-person, sprint, aiming, cover, reload), audio spatialization and ambient sound storytelling.
- Level art readability, signage, clutter, effects, impact feedback and HUD legibility/scale.
- Expand Shattered Wall and Training Grounds only after map-specific playtesting identifies actual gaps; never replace or delete them.
- Further mode, progression and onboarding refinements only once the core Extraction loop is demonstrably engaging.

**Gate:** Art, presentation and controls elevate the experience without causing old startup stalls, memory leaks, unbounded shaders or degraded playability.

## Phase sequencing and operating rules

`A1 Pistol → A2 AR → A3 SMG/LMG → A4 Railgun/Plasma → A5 Minigun/Launchers → A6 audio/fidelity acceptance → B two-hand movement → C encounter pacing → D Area 51 vertical slice → E optional presentation/content`.

The phases are a **recommended dependency order**, not a deadline or permission to implement everything. Cross-cutting regression and performance checks accompany every phase. Small *audit-only* or prototype tasks may be done in parallel but must not displace the authoritative Issue #16 sequence.

### Required acceptance checklist for every implementation PR

- [ ] Source inspection of actual current modules and cross-file type/export signatures.
- [ ] Preserve physics, controls, hit detection, weapons, squads, maps, Extraction and Survival.
- [ ] Strict Three.js resource ownership/disposal; no allocations in hot loops without cause.
- [ ] Lint/build and targeted tests (plus applicable integration, browser and audio tests).
- [ ] Reproducible, real-time first-person footage/screenshots; third-person where relevant.
- [ ] Target-laptop playtest: movement, reload, enemy engagement and startup performance.
- [ ] PR/branch review with explicit unresolved defects; no auto-merge or production promotion.

## Open direction questions (not yet approved)

1. After weapon fidelity, should we prioritize **all-weapon movement realism** or **Area 51 combat/AI engagement** first?
2. Should sprint pacing retain unlimited sprint with tactical consequences, add light acceleration/weapon-ready delays, or investigate a stamina mechanic?
3. Should enemies contest objectives primarily through **responsive AI**, selective **room security/objective states**, or a balanced combination?
4. Should the Area 51 helicopter insertion cinematic be prioritized immediately after weapon work, or after a stronger combat loop?
5. Should we target **one polished Area 51 Extraction vertical slice** before broad improvements on all maps/modes?

These are explicitly **pending user decisions**. Don't treat proposed order or new mechanics as confirmed scope without approval.

---
**Authority:** Weapon detail/sequencing: [Issue #16](https://github.com/fcootes/Gun-Arena-V2/issues/16). Technical progress: linked PRs, actual main, tests and laptop review. Planning updates should preserve this distinction.
