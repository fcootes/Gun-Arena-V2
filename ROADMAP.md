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
| Combat Pistol fidelity | [#20](https://github.com/fcootes/Gun-Arena-V2/pull/20) | **Merged** | User accepted one-handed sprint; preserve reload and gait tests |
| SMG fidelity | [#22](https://github.com/fcootes/Gun-Arena-V2/pull/22) | **Merged** | User satisfied with SMG; preserve receiver charging and tactical/empty reload behavior |

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

### A3 — SMG merged; Heavy LMG next (Issue #16 step 5)

- **SMG:** [PR #22](https://github.com/fcootes/Gun-Arena-V2/pull/22) **merged**, with user-reported positive laptop playtest; preserve updated receiver-side charging, compact model, timing and audio. Do not reopen without demonstrated regression.
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
- **Sequencing:** Finish every remaining weapon upgrade and acceptance item → build Training Grounds shooting range + movement course + optional AI arena → shared two-handed sprint and three-state locomotion → visible hit reactions, stagger and non-graphic death response → modular rig and deep enemy AI → graphics/atmosphere → campaign maps/cutscenes. Basic AI bypass diagnostics can overlap movement, but the significant AI overhaul remains in its own PRs. **Do not start Training Grounds construction before the weapon backlog is complete**, per the user's explicit decision.

### Sprint design prototype — *proposal, not approved balance settings*

A. **Hybrid walk/run/tactical sprint (recommended first test):** walking retains precision and accessibility; sustainable run is useful but not a free pass through encounters; pressing Sprint gives a faster, shorter tactical burst with visibly limited stamina, smooth acceleration/deceleration and a short post-sprint weapon-ready recovery. Recovery is gradual and easy to read, not a punitive extended freeze. Tune generously initially and judge by actual Area 51 run-through tests.

B. **Halo-inspired sprint with recovery:** stronger short burst and clear cooldown/recovery but less of an always-visible stamina bar. Compare whether it is less intrusive and still preserves emergency retreat.

C. **Existing unrestricted sprint baseline:** retain as the control case so changes are justified by measurable improved encounter decisions and retained shooter responsiveness.

Measure sprint distance, encounter bypass rate, combat re-engagement, weapon-ready latency, input response and perceived fun. Do not overfit by making enemies omniscient, hard-locking every room or arbitrarily crippling speed.

### Training Grounds — staged interactive range concept

**First Training Grounds release (after all weapons):** include **all** of the user's selected capabilities: pistol/rifle/heavy shooting lanes with near/mid/far targets and hit-location/damage feedback; reload/ADS/shot grouping drills; a sprint and obstacle course with distance/cadence/start-stop markers; and a physically separated **optional** repeatable AI combat arena with selectable threat/cover settings, spawn/reset controls and deterministic baseline. Deliver via small serial PRs TG-01 to TG-03 so the full first release has all three components without building an unreviewable monolith. Make developer instrumentation optional so ordinary gameplay remains clean.

**Later training facility:** class/loadout testing, moving/reactive targets, material-specific footstep/audio test surfaces, squad command course, encounter scenario presets (USMC/APEX/infected as appropriate), frame-time/draw-call diagnostics and standardized visual evidence captures. Reuse production weapon, movement, projectile, bot and lighting paths rather than inventing separate simplified mechanics.

**Acceptance:** browser and native laptop QA remains quick and reproducible, safe boundaries prevent stray enemies/projectiles affecting another test area, startup and disposal costs stay bounded, Training Grounds remains playable, and Area 51/Shattered Wall are unchanged.

## Confirmed execution board — implementation PR sequence (17 Oct 2026)

**This section is the actionable source of truth for upcoming implementation sequencing.** Previous Phase A–E sections retain the broader design requirements. IDs below are **planning ticket keys, not GitHub PR numbers or claims of completed code**. Start each implementation PR from current `main`; do not work on this docs branch. Scope each PR narrowly, gather acceptance evidence, await laptop playtest approval before merging. **No work below is being implemented by the roadmap update.**

### Stage W — Close original weapon backlog first (Issue #16)

**Done on GitHub:** core hands [#15](https://github.com/fcootes/Gun-Arena-V2/pull/15), shotgun [#17](https://github.com/fcootes/Gun-Arena-V2/pull/17), heavy sniper [#18](https://github.com/fcootes/Gun-Arena-V2/pull/18), Battle Rifle [#19](https://github.com/fcootes/Gun-Arena-V2/pull/19), pistol [#20](https://github.com/fcootes/Gun-Arena-V2/pull/20) and SMG [#22](https://github.com/fcootes/Gun-Arena-V2/pull/22). Merge != blanket acceptance for unrelated issues. Verify AR's existing receiver-latch/reload success against the remaining AR checks without rebuilding it.

| Planned PR | Prerequisite | Exact implementation boundary | User-facing acceptance |
| --- | --- | --- | --- |
| **W01 LMG Fidelity** | SMG #22 merged (**verified**) | Pivoting hinged feed cover, side ammo box + belt ownership, tactical/empty box choreography and visible **palm slap** to close cover; audit LMG loop and composite audio | First-person continuous tactical + empty reload clips show real hand-cover contact, no belt floating, fire/audio and ADS work |
| **W02 Railgun Fidelity** | W01 accepted | Inspect/confirm preferred **rear-breech reload** proposal, separate open/insert/lock mechanism, correct hands and charging audio | Approved concept, convincing cartridge/breech state and intact charge/fire mechanics |
| **W03 Plasma Fidelity** | W02 accepted | Model/hand alignment, battery/vent/chamber sequence, heat/overheat/firing audio correctness | Readable vent/reload, no duplicated cues, firing/overheat and cooldown work |
| **W04 Minigun Fidelity** | W03 accepted + user's under-cradled reference | Correct **handheld under-cradled** support and orientation (not spade-grip), barrel spin/heat/audio, viewmodel framing | Matches actual reference and first-person ergonomics; smooth windup/spindown |
| **W05 Rocket Launcher Fidelity** | W04 accepted | Correct low/close carry, loading/hand/launcher states and verify projectile/audio hook | Reliable projectile hit/flight, reload and suitable firing audio or precise missing-asset report |
| **W06 Grenade Launcher Fidelity** | W05 accepted | Correct viewmodel/cylinder/ammo sequence, articulated hand contact, sound, preserve detonation | Firing and reload mechanically legible; projectile behavior unchanged |
| **W07 Arsenal Acceptance/AUDIO** | W01–W06 reviewed | Audit 12 weapons' audio manifests/triggers, composites vs duplicate mechanical cues; AR acceptance check; targeted shared viewmodel, ADS, controls and memory/disposal regression | Each weapon gets checklist with native playtest verdict and explicit unresolved exceptions; no missing clip is silently fabricated |

Keep W01–W07 as independently reviewable implementation PRs; a clearly evidenced, user-approved exception can be recorded instead of marking the entire backlog complete. No fictional PR links or dates. **Only after W07/Issue #16 sign-off proceed with Training Grounds construction.**

### Stage TG — Training Grounds first playable shooting/testing facility (AFTER all weapon upgrades)

Preserve the **existing** Training Grounds; do not delete it or swap it for Area 51. These are consecutive small PRs delivering the user's requested **initial release with all capabilities**:

| Planned PR | Prerequisite | Deliverable | Definition of done |
| --- | --- | --- | --- |
| **TG01 Target Range** | W07 accepted | Safe separated shooting lanes for pistol, rifle and heavy weapons; near/mid/far targets; target hit-location/damage feedback; ADS/shot grouping and reload timing display; reset/replenish controls | Real weapon/projectile/damage hooks, repeatable target readings; no new combat damage model; no target geometry leaks; map loads correctly |
| **TG02 Sprint/Obstacle Course** | TG01 accepted | Marked sprint distance, acceleration and stop markers; simple obstacle/cover route; cadence/speed, start/stop/recovery readouts using real player movement | Repeated baseline movement runs comparable without affecting controls/physics; accessible restart and no map collision voids |
| **TG03 Optional AI Combat Arena** | TG02 accepted | Opt-in gated/separated compact arena with selectable faction/opponent presets, deterministic spawns, reset and simple score/time/engagement stats | Default range has no unexpected enemies; player can start/reset multiple waves safely; no enemy leaks or spillover to other lanes; both USMC/APEX scenarios and Area 51 regression pass |

**Initial Training Grounds facility is accepted only when TG01 + TG02 + TG03 are working together**. Later expansion (squad-command course, new target types, advanced replay/telemetry) is separate optional scope, not a blocker.

### Stage MOV — Movement and two-handed weapon sprint FIRST (next combat-quality priority)

| Planned PR | Prerequisite | Deliverable | Definition of done |
| --- | --- | --- | --- |
| **MOV01 Shared Two-Hand Sprint Gait** | TG03 accepted | Shared shoulder/elbow/grip-constrained authored running motion with per-weapon carry profiles; no fixed side-locked rifles; pistol remains on approved independent gait | Both hands correctly attached, distinct weapon weight, smooth enter/exit/ADS/reload at 30/60/144 Hz; native first-/third-person playtest |
| **MOV02 Three-State Locomotion Prototype** | MOV01 accepted | **Walk + sustainable run + stamina-limited tactical sprint** as chosen first prototype; responsive acceleration/deceleration, weapon-ready transition, clear low-clutter stamina display and reset | Physics/input/ADS/hit detection preserved; stamina spends/restores deterministically incl. pause/death/respawn; no surprise midair sprint; player compares to baseline and approves speed/recovery |
| **MOV03 Integrated Movement Acceptance** | MOV02 accepted | Verify heavy/light class profiles, tactical retreat, aim recovery, obstacles, jump, stairs, squad/weapon changes, Area 51 run-through baseline and first low-risk AI detection telemetry | Range course + one real Area 51 route show measurable changes in traversal and combat engagement; no global speed nerf assumed; user confirms actual feel |

**Implementation choices not yet signed off:** numeric speed tiers, stamina capacity/regeneration/cooldown, whether Shift triggers tactical sprint and how sustainable run is entered (existing Shift/ADS bindings must not be broken), and presentation of stamina. Proposed values are trial parameters, NOT commitments. **Do not silently make stamina mandatory across the game before MOV02 approval.** Test on Training Grounds first and retain a comparison switch for development.

### Stage HIT — Immediate post-movement combat-feedback priority

| Planned PR | Prerequisite | Deliverable | Definition of done |
| --- | --- | --- | --- |
| **HIT01 Damage/Reaction Contract** | MOV03 accepted | Central authoritative hit event with impact direction, severity and hit-zone info where already available; distinct flinch/stagger intent separated from actual HP/damage; stable transitions | No double damage, no damage-on-animation, no hitbox misalignment; unit + scenario regression for melee, projectiles and shooting |
| **HIT02 Readable Reactions and Defeat Animations** | HIT01 accepted | Directional hit flinches, bounded stagger, recoil from impacts, readable non-graphic collapse/defeat states; preserve gameplay/AI ownership | Enemies react without rubberbanding, freezing, teleporting, breaking cover/firing state or excessive visual violence; loop through optional AI arena and Area 51; avoid throwaway bot model sculpting |

**Prioritization:** HIT01/HIT02 are FIRST after MOV work, ahead of major grenade/recoil/muzzle/footstep VFX projects. Implement presentable, inexpensive reactions for existing actors as a temporary bridge; do not deeply rework low-detail procedural models.

### Stage CHAR + AI — Modular soldier rig, then advanced opponent quality

| Planned PR | Prerequisite | Deliverable | Definition of done |
| --- | --- | --- | --- |
| **CHAR01 Modular Rig Proof of Concept** | HIT02 accepted | ONE optimized properly skinned GLB/glTF humanoid with shared skeleton and switchable **USMC/APEX armor/helmet/insignia**, appropriate licensed/original assets and idle, run, aim, reload, react, defeat states; browser-compatible pipeline | Both appearances derive from same skeleton; weapons attach correctly; no external install assumed; measured render/memory cost and resource ownership |
| **CHAR02 Safe Runtime Integration** | CHAR01 accepted | Integrate shared rig into real botBuilder/gameplay, update animation state from existing AI events, maintain authored hitboxes, keep procedural fallback behind selectable/testable path | Representative USMC/APEX squads navigate, fire, reload, react, dispose/redeploy correctly in range and both maps; fallback remains available |
| **AI01 Perception, Pursuit and Cover** | MOV03 diagnostics + CHAR02 accepted | Fix meaningful enemy alert memory, pursuit, flanking and readable cover/weapon behavior (without omniscience or gratuitous HP/accuracy boosts) | Same Area 51 run-through replay is meaningfully contested, while retreat and intended alternate paths remain possible; no APEX cold-load regression |
| **AI02 Contested Objectives & Squad Cooperation** | AI01 accepted | Selective defend/hold objectives, reasonable reinforcements and class/squad responses; no arbitrary locked doors in unrelated modes | Both factions' Extraction complete; enemies/squads react credibly and Survival stays functional; native performance measured |

A minimal **read-only AI detection/bypass audit** can occur during MOV03, but large enemy rewrites remain distinct. No disposable procedural-bot cosmetics project before CHAR01.

### Stage GFX → Campaign (future, conditional)

| Planned PR group | Prerequisite | First slice and review gate |
| --- | --- | --- |
| **GFX01 Visual baseline + budgets** | Movement/enemy acceptance | Establish representative scenes, GPU CPU draw-call/frame-time/memory baseline; accessible quality tiers |
| **GFX02 Environment/character atmosphere** | GFX01 | Focused lighting, materials, environment effects, HUD clarity, footstep/material spatial audio in reviewed map-specific batches |
| **CAMP01 Story/missions planning** | GFX presentation accepted | Approve campaign canon, USMC/APEX mission structure and one representative mission flow **before building multiple new maps** |
| **CAMP02 Playable campaign vertical slice** | CAMP01 | One full existing-map mission with clear objectives, checkpoint/retry, squad AI and complete extraction |
| **CAMP03 Maps & cinematics** | CAMP02 | Expand story missions and create helicopter insertion/cutscenes **only AFTER graphics overhaul** with existing accepted assets |

No firm mission count, duration, plot canon, cutscene delivery date, new map deletion or speculative integration is approved by this planning document.

### Universal PR contract (applies to W, TG, MOV, HIT, CHAR, AI, GFX, CAMP)

- Start from latest reviewed `main`, use a separate scoped feature branch and draft PR; **no stacked/automatic merge, no direct main push, no Vercel production promotion**.
- Read affected `src/App.tsx`, `src/types.ts`, `src/world.ts`, `src/botBuilder.ts` and connected modules; verify real cross-file signatures.
- Preserve approved gameplay input, player physics, aiming/hit detection, weapons, squad AI, USMC/APEX, both modes, Area 51, Shattered Wall and the existing Training Grounds.
- All dynamic Three.js geometries/materials/textures have correct owner and disposal. Profile loops, avoid per-frame allocation; don't resurrect the APEX preparation stall.
- Run TypeScript/build, focused weapon/viewmodel/controls/audio or runtime/area51 tests and frame-rate tests relevant to scope. Distinguish measured regressions from browser software-renderer issues.
- Provide before/after first-person *and relevant third-person* visual evidence, limited continuous native-speed gameplay capture if useful, performance/correctness summary, known exceptions, exact PR commit/head, and ask the user to review on the target laptop.
- **Only declare a step accepted when its actual user-facing criteria pass or the user explicitly grants a documented exception.** Keep the roadmap planning-only until separately authorized for implementation.

## PHASE B — Combat feel and movement quality (next quality milestone; coupled with initial encounter fixes)

### B1 — Finish the original weapon fidelity acceptance backlog

Complete **Phase A**'s prescribed Issue #16 ordering and audio/visual acceptance. Pistol [#20](https://github.com/fcootes/Gun-Arena-V2/pull/20) and SMG [#22](https://github.com/fcootes/Gun-Arena-V2/pull/22) are merged/user-reported accepted. Audit AR's approved handling rather than unnecessarily redoing it. Remaining: LMG, Railgun, Plasma, Minigun, Rocket Launcher, Grenade Launcher, then cross-arsenal audio/fidelity acceptance. Keep each weapon on a separate reviewed PR.

### B2 — Shared two-handed weapon sprint framework

Existing low/side-carry poses often look rigid. Implement reusable **shoulder/elbow, grip-constrained, authored procedural gait** with weight-specific profiles:

- Both hands remain attached to suitable rifle/shotgun/LMG/launcher grips; plausible shoulder movement drives a curved weapon path, not only synchronized sinusoidal bobbing.
- Profiles for AR/carbine, SMG, bullpup BR, shotgun, sniper, heavy LMG, plasma/railgun, minigun and launchers.
- Distinct start/stop/ADS/reload/switch/landing recovery, first-/third-person coherence, stable sprint-to-combat aim.
- Physically expressive motion but precise controls, modest camera motion, no transform accumulation or per-frame GPU allocation.
- Compare actual native-speed footage, not isolated static screenshots; targeted tests across frame rates.

### B3 — Combat feedback: hit reactions and stagger FIRST (after movement)

**The user's first post-movement combat-feedback priority is visible hit reactions, stagger and more convincing, non-graphic enemy defeat animations.** Implement hit-location and force/reaction contracts, readable stumble/stagger with bounded duration and gameplay-safe interrupts, and appropriate collapse/defeat transitions; test gameplay consequences and animation responsiveness. Do not conflate cosmetics with damage authority, add gratuitous gore or polish temporary procedural bot meshes that will be replaced. A later distinct batch handles recoil, impact decals, muzzle flash, grenades, weapon/audio texture, directional threat indicators and HUD legibility. Avoid excessive camera shake or particle spam; source-check existing clips and test measured browser GPU cost.

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

After movement and the first hit/stagger/defeat-response task are accepted, deliberately invest in enemies as a coherent system. **Build one modular USMC/APEX rig as the FIRST character-model replacement milestone**, while keeping working procedural fallback until full integration and testing:

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

## Deferred weapon-aim recoil pass — REC01 / REC02 (new request, 30 Oct 2026)

**Status:** User-requested **future roadmap addition**, not an active implementation request and not a change to the W04–W07 weapon order. The current W03 Plasma correction may prototype controlled recoil locally; do not generalise it across all weapons until a separate reviewable PR has been authorised.

**Problem observed in native gameplay:** Most weapons are currently too easy to aim in sustained fire. The present HUD largely **scales** the crosshair while firing, and the model's visual kick is not a fully tuned, coherent per-weapon **aim-direction recoil** system. The Plasma's first prototype can rock/oscillate like a ship instead of delivering distinct shot-driven muzzle climb.

### REC01 — Shared authoritative aim recoil contract (deferred)

- Inspect live camera/player pitch-yaw ownership, pointer lock, viewmodel recoil, ADS and crosshair, first-person raycast/projectile direction, existing `recoilPitch`/`recoilKick` and input updates before changes.
- Build **shot-triggered view/aim angular impulses** (not just cosmetic mesh transforms or crosshair scale) with separate, tunable per-weapon vertical climb, small lateral variation, recovery, shot cadence and sustained-fire accumulation. Preserve mouse compensation, camera comfort, aim consistency and deterministic frame-rate-independent updates.
- Ensure the actual crosshair **continues to represent projectile trajectory**; do not animate a screen reticle away from the firing ray without updating aim authority. Avoid stacking recoil impulses multiple times in one shot; do not use random walk without bounded recovery.
- Provisional tuning goals: sniper = pronounced single recoil and recovery; shotgun = heavy but short kick; AR/BR = measured impulse and burst climb; SMG = light initial shot with cumulative climb; LMG = sustained vibration and climb with heavier inertia; pistol = crisp single kick; Plasma = clean upward impulse without oscillatory ship-rock; Minigun/other heavy or energy weapons get distinct profiles. Final numeric settings **require native playtest**, not assumptions about real firearms.
- Use the existing firing event and one authoritative simulation clock, preserve damage/spread/fire rate and player control, support both ADS/hipfire and differing FPS; test 30/60/144 Hz, frame stalls, trigger release, movement and pause.

### REC02 — Weapon profiles, tuning and possible attachment modifiers (deferred)

- Profile the entire arsenal in Training Grounds with controlled target groupings and predictable patterns. Add per-weapon balance profiles, developer-friendly calibration values and acceptance tests.
- Future attachments (e.g. stock or stability upgrade) **may modify** recoil/recovery through explicit, bounded stats **only when an attachments system is separately approved**. Do not build a new attachments system during REC01.
- Keep developer instrumentation optional and the normal HUD minimal; do not sacrifice accessibility, gamepad/pointer-lock semantics or precision aim.
- Schedule this as a **separate post-weapon gameplay-feel module**, ideally tested in the Training Grounds and before full campaign combat balancing. Exact ordering versus MOV/HIT/MELEE and equipment improvements remains subject to developer sign-off.

**W03 immediate exception:** A small, weapon-local fix may remove Plasma viewmodel oscillation and establish a restrained, coherent upward **shot-synchronous** recoil for native testing; this is not the full REC01 migration.

---

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

The user has **explicitly selected**: Training Grounds after all weapons; first sprint prototype = walk/run/stamina-limited tactical sprint; first Training Grounds includes range, obstacle sprint lane, and optional AI arena; first enemy rig = **modular USMC/APEX soldier sharing one skeleton**; first post-movement combat polish = **hit reactions, stagger and realistic non-graphic defeats**. These are now the approved planning priorities, not open polling questions.

Only detailed design/tuning choices remain:

1. **Sprinting balance:** FIRST prototype is CONFIRMED walk + sustainable run + stamina-limited tactical sprint. Final speeds, stamina budget, recovery, input mapping and combat-ready delay must be approved through playtest; compare against the previous unlimited baseline.
2. **Later combat-feel batch:** hit reactions, stagger and non-graphic defeats are FIRST after movement; decide whether recoil/throwables or audio/surface response follows them.
3. **Rigged asset specifics:** modular USMC/APEX humanoid sharing one skeleton is CONFIRMED; choose acceptable art style, source/licensing and tooling, attachment/skeleton conventions, performance targets before building assets.
4. **Training Grounds:** confirmed AFTER all weapons; first release must include shooting lanes, sprint/obstacle course AND an optional AI arena. Detailed layout, target types and training UI can be tuned when implementing TG-01..03; Area 51 remains the real mission acceptance environment.
5. **Campaign scope:** proposed 8 missions × ~20 minutes and the railway/city settings remain tentative until story and pacing are agreed.

Do not treat these detailed decisions as blockers for finishing the original weapon sequence. No implementation PR exists merely because it appears in the board above.

---
**Authority:** Weapon detail/sequencing: [Issue #16](https://github.com/fcootes/Gun-Arena-V2/issues/16). Technical progress: linked PRs, actual main, tests and laptop review. Planning updates should preserve this distinction.
