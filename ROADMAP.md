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
| Combat Pistol fidelity | [#20](https://github.com/fcootes/Gun-Arena-V2/pull/20) | **Merged** | User confirmed the tuned one-handed sprint looks good; retain reload and gait regression checks |

Other earlier gameplay, UI, world and performance PRs are history, not a substitute for final visual/playtest acceptance. See the existing PR descriptions and documentation.

## PHASE A — Complete the established Weapon Fidelity Roadmap (committed order)

**Source of truth: [Issue #16](https://github.com/fcootes/Gun-Arena-V2/issues/16).** Do not allow the new sprint or encounter ideas to silently displace these weapons.

### A1 — Combat Pistol: merged and visually accepted (PR #20)

The user's latest laptop playtest approved the revised one-handed pistol gait; GitHub confirms [PR #20](https://github.com/fcootes/Gun-Arena-V2/pull/20) is merged. The accepted implementation includes:

- A tuned cadence of **1.75 complete stride pairs/s** at the game's reference sprint speed (formerly 2.05).
- Broader *shoulder-driven* right-arm forward/back and vertical travel; preserve the existing grip constraint.
- Independent left arm with a higher, more upright forward apex and limited reach, then an offscreen rear/downward phase.
- Preserve fixed bone lengths, hand-to-gun grip, opposing cadence, continuous curved paths, third-person phase consistency, responsive transitions, FPS camera comfort and all shooting/reload mechanics.
- Validate across 30/60/144 FPS, capture a **real-time 6–10 second gameplay clip** and both opposing apexes, then obtain explicit laptop visual approval.

**Acceptance:** laptop visual approval received and PR merged; preserve this model, reload, audio and sprint handling in all future shared movement work. Do not reopen pistol work without a specific defect.

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

## Confirmed direction — user decisions, 17 October 2026

1. **Movement realism AND encounter integrity together.** Work on a shared two-handed weapon sprint framework and measure/fix the Area 51 encounter run-through problem as coordinated but separate PRs. Do not make a single huge movement-plus-AI rewrite.
2. **Grounded momentum plus stamina investigation.** User wants acceleration, deceleration, weapon-ready recovery **and to explore stamina**. Start with low-risk responsive handling and a tunable stamina prototype/side-by-side playtest, **not a compulsory stamina limit or blanket nerf without approval**.
3. **Smarter enemies PLUS meaningful objective security.** Combine detection/pursuit/cover/squad tactics with selective contested objectives; avoid arbitrary doors blocking all shortcuts.
4. **Helicopter insertion/cutscenes LATER.** The user explicitly wants cinematic production **after graphics overhauls**. No near-term cinematic prototype is on the critical path.
5. **Primary development strategy: combat looks/feels excellent → enemies play/look excellent → expanded story campaign maps and cutscenes.** Quality before quantity. Do not schedule a full eight-map build while the core fighting/AI is unfinished.

**Nuance:** the combat and AI work are connected, so build/test them together in a small existing environment. This does *not* mean delaying every AI fix until every weapon is perfect, or polishing weapon animations in isolation from opponents. Detailed enemy visual/behavior overhaul follows the combat foundation. Continue to preserve both factions, Shattered Wall and Training Grounds.

## Further user decisions — 17 October 2026

- **Movement first within the combat-fidelity phase.** After the remaining weapon backlog (or with a small early testbed in parallel), prioritize realistic weapon-class sprint, acceleration, stopping and readiness before a major impacts/recoil/audio polish pass. This is about sequencing work, not postponing critical bugs.
- **Movement choice still open:** Current unrestricted fast sprint makes it too easy to bypass hostiles. User is interested in a three-state **walk → sustainable run → faster limited tactical sprint** with a generous stamina budget, or a Halo-like burst with recovery. **Recommendation:** prototype the three-state hybrid first; compare it against a cooldown-based tactical sprint and existing baseline. No final stamina commitment or hard numbers without native playtest.
- **Character art pipeline:** User objects to polishing throwaway blocky bot models. Favor an early **single properly rigged character prototype** (optimized GLB/glTF, shared skeleton/rig and modular armor) rather than repeatedly detailing the current procedural meshes. Keep existing bots running as fallbacks until proven replacement meets performance, animation and AI needs; fix only urgent visibility/weapon-contact bugs in the interim. Asset style targets Halo: Reach-inspired *grounded* military science fiction; do not assume Blender installation is required.
- **Training Grounds:** Turn the *existing, preserved* Training Grounds map into a meaningful interactive **shooting range and tactical training facility**. Use it to validate weapons, reloads, sprint, hit reactions, cover and AI before rolling changes into Area 51. Do not delete or replace the map and do not break its existing modes. Build progressively, starting with a lightweight range/test harness before broad environmental art.
- **Sequencing:** Finish approved weapon backlog → small Training Grounds instrumented range/testbed + shared sprint/movement → initial encounter checks → combat feedback and deep enemy rigs/AI → presentation/graphics → campaign maps/cutscenes. The range/testbed may be built earlier as a narrowly scoped utility if it accelerates weapon QA.

### Sprint design prototype — *proposal, not approved balance settings*

A. **Hybrid walk/run/tactical sprint (recommended first test):** walking retains precision and accessibility; sustainable run is useful but not a free pass through encounters; pressing Sprint gives a faster, shorter tactical burst with visibly limited stamina, smooth acceleration/deceleration and a short post-sprint weapon-ready recovery. Recovery is gradual and easy to read, not a punitive extended freeze. Tune generously initially and judge by actual Area 51 run-through tests.

B. **Halo-inspired sprint with recovery:** stronger short burst and clear cooldown/recovery but less of an always-visible stamina bar. Compare whether it is less intrusive and still preserves emergency retreat.

C. **Existing unrestricted sprint baseline:** retain as the control case so changes are justified by measurable improved encounter decisions and retained shooter responsiveness.

Measure sprint distance, encounter bypass rate, combat re-engagement, weapon-ready latency, input response and perceived fun. Do not overfit by making enemies omniscient, hard-locking every room or arbitrarily crippling speed.

### Training Grounds — staged interactive range concept

**Near-term range/test harness:** clearly marked pistol/rifle/heavy bays; near/mid/far targets with hit-location and damage feedback; reload/ADS/shot grouping drills; sprint lane with distance/cadence and start-stop markers; simple reset/deploy controls. Include a small repeatable AI test zone with selectable threat/cover settings behind deliberate opt-in controls. Make developer instrumentation optional so ordinary gameplay remains clean.

**Later training facility:** class/loadout testing, moving/reactive targets, material-specific footstep/audio test surfaces, squad command course, encounter scenario presets (USMC/APEX/infected as appropriate), frame-time/draw-call diagnostics and standardized visual evidence captures. Reuse production weapon, movement, projectile, bot and lighting paths rather than inventing separate simplified mechanics.

**Acceptance:** browser and native laptop QA remains quick and reproducible, safe boundaries prevent stray enemies/projectiles affecting another test area, startup and disposal costs stay bounded, Training Grounds remains playable, and Area 51/Shattered Wall are unchanged.

## PHASE B — Combat feel and movement quality (next quality milestone; coupled with initial encounter fixes)

### B1 — Finish the original weapon fidelity acceptance backlog

Complete **Phase A**'s prescribed Issue #16 ordering and audio/visual acceptance. Pistol PR #20 is merged/accepted. Verify the already successful AR handling against the remaining checklist without redoing good work; then SMG/LMG, railgun/plasma and minigun/launchers. Keep separate weapon PRs.

### B2 — Shared two-handed weapon sprint framework

Existing low/side-carry poses often look rigid. Implement reusable **shoulder/elbow, grip-constrained, authored procedural gait** with weight-specific profiles:

- Both hands remain attached to suitable rifle/shotgun/LMG/launcher grips; plausible shoulder movement drives a curved weapon path, not only synchronized sinusoidal bobbing.
- Profiles for AR/carbine, SMG, bullpup BR, shotgun, sniper, heavy LMG, plasma/railgun, minigun and launchers.
- Distinct start/stop/ADS/reload/switch/landing recovery, first-/third-person coherence, stable sprint-to-combat aim.
- Physically expressive motion but precise controls, modest camera motion, no transform accumulation or per-frame GPU allocation.
- Compare actual native-speed footage, not isolated static screenshots; targeted tests across frame rates.

### B3 — Weapon impacts, recoil, audio and combat readability (after initial movement improvements)

Polish shot/recoil feel, mechanical feedback, muzzle flashes, grenade throw/interaction, surface impacts, damage reaction feedback, directional threat indicators, HUD legibility and sound timing with **small weapon/system-specific PRs**. Avoid excessive camera shake, bright particle spam and UI clutter. Check all supplied audio assets before acquiring new ones. Perform a measured WebGL/React performance pass only on demonstrated bottlenecks.

### B4 — Grounded movement and sprint gameplay prototype

Evaluate **two complementary designs** in bounded experiments:

- **Momentum version:** responsive sprint acceleration/deceleration, turning feel, short weapon-ready recovery, and clear state transition; no blanket movement speed nerf.
- **Hybrid run + tactical sprint (recommended test):** walking, sustainable running and a stronger limited sprint; a generous, tuneable stamina/recovery budget combined with clear weapon-ready windows. A Halo-like burst/cooldown approach is a second comparison. Preserve tactical retreat, controls and accessibility; don't require punishing waits or implement a mandatory stamina meter without user approval.

Measure whether either approach improves encounters and still feels responsive. **No mandatory stamina feature is approved yet**; user selects after a playtest. Movement and combat controls must not regress.

### B5 — Small-scale AI/encounter co-development, in parallel with B2–B4

**Player report:** in Area 51 Extraction players can simply sprint past too many threats. Diagnose actual encounter spawn and awareness, detection persistence, chase/navigation, objective gating, enemy accuracy/reaction, squad AI and mission timing for **both USMC and APEX**.

Prototype improvements independently of movement changes, then test the interaction:

- Enemies should notice and remember nearby sprinting players appropriately and pressure an escape route without teleporting or gaining unfair omniscience.
- Tactical flanks, suppression/cover, pursuit and sensible reinforcement timing where supported.
- Clear objective affordances and **selective** control/hold zones only where fiction and level flow make sense.
- Preserve deliberate stealth, bypass or maneuver routes where intended; the answer should not be invisible walls or mandatory elimination of every bot.

**Phase B gate:** the existing game reliably demonstrates satisfying firing/reload/grenade handling, physically credible movement across weapon classes, responsive controls, and *observable* consequences for sprinting past a contested position—without major performance regressions.

## PHASE C — Enemy quality: how they move, fight, react and look

Once the fundamental combat feel and first anti-bypass fixes are accepted, deliberately invest in the enemies as a coherent system:

- AI behavior: readable detection/communication, threat priorities, human operator cover/firing discipline, coordination, pathfinding and squad interactions.
- Different factions/enemy archetypes: USMC and APEX/Ghost/Cordon concepts remain **lore-dependent**; infected, military hostiles, elites, bosses should not all move/think identically.
- Character animation: believable stances, weapon grips, recoil, sprint, hit reactions, cover, reload, traversal, neutral-to-alert, and non-graphic death states; lighter hits should not always break bodies into pieces.
- Visual overhaul: **avoid extended polishing of soon-to-be-replaced procedural bots**. First build and test one properly authored, optimized, skinned GLB/glTF humanoid with a coherent skeleton, believable weapon grip, locomotion/reload/hit animations and interchangeable faction armor/helmets. Establish rig retargeting, LOD and disposal/performance budgets before scaling to multiple enemies. Keep procedural fallback until the rigged replacement genuinely works, and fix legacy bots only where bugs block current gameplay. Browser-compatible modelling/animation workflow is acceptable; no forced Blender prerequisite.
- Tactical AI in both Area 51 and Shattered Wall; preserve extraction/survival progression, squad posture, difficulty scaling (easy/medium/hard) and predictable test scenarios.
- Enemy audio, footfalls on relevant surface materials, warning lines and spatial cues, with an explicit asset/license audit.

**Gate:** encounters are fair, readable, varied and replayable; bots look and handle weapons believably and their animations match behavior. Native-GPU testing includes larger squad/AI scenes.

## PHASE D — Graphics, atmosphere and presentation overhaul (BEFORE campaign cinematics)

The target is **coherent Halo: Reach-inspired grounded science-fiction presentation with tactical-shooter clarity**, not a promise of photorealism or literal AAA engine fidelity.

- Improve lighting/tonemapping/shadow budget, material response, prop geometry, environmental variety and levels' visual contrast while protecting cold deployment and runtime frame rates.
- Refine Area 51's scientific-industrial horror atmosphere and Shattered Wall's stormy offshore identity; keep Training Grounds intact.
- Upgrade effects and feedback, environmental/footstep sound by surface, spatial audio, interface typography/layout/readability, AI/model rendering, transitions and cinematic-quality scene staging.
- Establish a repeatable asset pipeline: optimized authored 3D GLB/glTF rigs where helpful, procedural geometry where efficient, texture budgets, LOD/instancing/occlusion as justified. No forced Three.js-to-another-engine migration.
- Before building major cinematics, verify consistent visual language, lighting, animation, loading and native performance in gameplay.

**Gate:** base visuals and character presentation meet a cohesive quality bar at supported laptop/browser settings; major scenes can be filmed using real game assets without revealing glaringly placeholder geometry.

## PHASE E — Full campaign content, maps, narrative and cutscenes (after quality foundations)

**User's stated intent:** a concise, replayable military-science-fiction action/horror campaign exploring **both USMC and APEX**, with some exclusive faction missions and selected overlapping locations. The detailed storyline and canon are **not locked**.

- Establish story/canon and mission design before writing the four planned narrative/production Markdown documents. Do not present brainstorms as canon.
- Preserve existing **Area 51, Operation Shattered Wall / Pacific Rim, and Training Grounds**. Do not restore Bunker Hangar; Area 51 replaces it only.
- Candidate expansion settings: freight yard/railway with convoy, city operation and further connected places. Eight roughly 20-minute missions is a **provisional aspiration** requiring pacing/content proof, not a fixed commitment.
- Make a **small, playable combat/encounter evaluation slice** continuously in Phases B/C. **Later**, polish one complete beginning-to-extraction mission (initially Area 51 is convenient) to establish encounter, checkpoint, mission scripting and performance standards.
- Only then scale the campaign missions and locations, faction-specific story beats, voice/radio storytelling and cinematics.
- Helicopter insertion sequence (desert flight, facility reveal, cabin briefing, landing and first-person transition) belongs **after Phase D's graphics overhaul**, not immediately after weapon work. Prototype and obtain review before production integration.
- Keep the established military action/horror balance adaptable by map, not an open-world commitment. Storytelling can span mission cinematics, dialogue and environmental clues; major plot decisions require user sign-off.

**Gate:** an end-to-end playable and narratively coherent campaign experience with representative mission depth, reliable checkpoints/retries, and cinematics that fit the real game assets and performance.

## Project order, parallel work, and scope discipline

`Phase A (finish original weapon backlog) → Phase B (combat feel + two-hand movement; early encounter AI in parallel) → Phase C (deep enemy behavior/animation/visual overhaul) → Phase D (graphics/audio/UI presentation) → Phase E (campaign maps, lore integration and cutscenes)`.

**Important:** This is the **user-approved broad priority direction**, not automatic implementation permission. The Phase A weapon order is still authoritative. Fix important crashes, AI pathing blockers or serious performance regressions whenever encountered. Develop small representative battle scenes as tests throughout; save large new maps and cinematic production for Phase E.

### Required acceptance checklist for every implementation PR

- [ ] Source inspection of actual current modules and cross-file type/export signatures.
- [ ] Preserve physics, controls, hit detection, weapons, squads, maps, Extraction and Survival.
- [ ] Strict Three.js resource ownership/disposal; no allocations in hot loops without cause.
- [ ] Lint/build and targeted tests (plus applicable integration, browser and audio tests).
- [ ] Reproducible, real-time first-person footage/screenshots; third-person where relevant.
- [ ] Target-laptop playtest: movement, reload, enemy engagement and startup performance.
- [ ] PR/branch review with explicit unresolved defects; no auto-merge or production promotion.

## Decisions still requiring design confirmation

The high-level priorities above were answered by the user on 17 Oct 2026. Remaining *implementation* choices:

1. **Sprinting balance:** compare generous walk/run/tactical-sprint stamina against a Halo-style recovery sprint and unrestricted baseline; tune speed, readiness and recovery through playtesting.
2. **Combat feel acceptance:** choose first focus among recoil/hit reactions/throwable animations, weapon-ready handling, or audio/surface response.
3. **Enemy asset pipeline:** select tooling and specifications for one optimized rigged GLB humanoid with interchangeable armor. Do not spend significant effort redesigning temporary blocky bots.
4. **Training Grounds implementation details:** choose which firing lanes, movement test course, AI scenario controls and instrumentation should be in the first small release. Use one Area 51 encounter as the subsequent real-world acceptance test.
5. **Campaign scope:** proposed 8 missions × ~20 minutes and the railway/city settings remain tentative until story and pacing are agreed.

Do not call these questions blockers for the small immediate pistol gait or remaining established weapon work.

---
**Authority:** Weapon detail/sequencing: [Issue #16](https://github.com/fcootes/Gun-Arena-V2/issues/16). Technical progress: linked PRs, actual main, tests and laptop review. Planning updates should preserve this distinction.
