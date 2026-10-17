# Future development recommendations — audit only

These are separate future tasks. No AI, encounter, movement or two-handed weapon changes are included in the pistol tuning.

## A. Shared sprint presentation for two-handed weapons

`src/viewmodelGrips.ts` defines fixed `sprint` and `sprintRotation` carry targets. AR, shotgun, sniper, SMG, Battle Rifle and laser rifle inherit the shared lowered lateral carry; LMG, railgun, rocket launcher, grenade launcher and minigun provide static variants. In `src/weapons.ts`, non-pistol weapons blend toward those targets, adding small generic bob/sway with the legacy bob clock. `src/viewmodelHands.ts` keeps their hands on their normal weapon attachments outside existing interaction/reload paths. They have no shared authored shoulder/elbow sprint cycle equivalent to the pistol's.

Recommend a future shared presentation controller with a common stride phase, fixed grip and limb constraints, critically damped transitions, and explicit weapon profiles for mass, carry orientation, shoulder travel, two-hand contact, inertia, stride response and settle time. Start with AR/SMG/Battle Rifle, then validate shotgun/sniper sight clearance, then heavy LMG/railgun/launchers/minigun. Heavy profiles should use smaller travel and more controlled lag; lighter profiles can show stronger shoulder drive. Share phase with local third-person legs and any future footstep events. Reload/ADS/action ownership must override sprint posing. Preserve all gameplay movement values and each weapon's accepted reload system. Require full-cycle near-plane/contact and interruption validation before extending the framework.

## B. Sprinting past Area 51 Extraction encounters

Observed mechanisms, rather than a claim that all threats can be bypassed:

- `src/area51Campaign.ts`, `Area51ExtractionGameLoop.update`: zone entry marks an encounter visited immediately and replaces the single `pending` wave object. Regular enemies appear one at a time, separated by 2.5 seconds, with an 18-live-enemy cap. Crossing to the next zone rapidly can overwrite an unfinished wave; returning does not retrigger a visited zone. This deserves a dedicated regression test in a future encounter fix.
- The USMC vial is secured with one E press within 3.5 metres. The APEX purge requires eight seconds of proximity, but neither objective checks that local regular enemies are neutralized or that the objective area is controlled. The lift checks objective completion, not regular encounter completion. This rewards reaching the interaction quickly.
- The warehouse boss phase already gates blast-door opening on all retained boss references being dead. Keep that working constraint; it is not the regular-encounter bypass described above.
- `src/App.tsx` has base sprint speed 8.6 m/s with class modifiers. `src/gameLoop.ts`'s mutant combat uses 1.8 m/s walkers and 5.2 m/s runners, so pursuit alone cannot reliably stop a sprinting player. Mutants can choose nearby blue allies instead of the player. The tactical engine also selects a nearest hostile in range, uses line-of-sight/last-known positions, and triggers coordinated flanks primarily after the player stays slow/stationary. Fast traversal can avoid that stationary trigger; friendly squad engagement can occupy hostiles. Collision/navigation and facility height/visibility constraints affect whether enemies can intercept.

Recommended future investigations:

1. **AI awareness:** profile acquisition/LOS and navigation along actual sprint routes for both factions; add consistent sprint-noise alerts, shared last-known positions and bounded doorway interception where needed. Avoid universal wall vision or teleporting pursuit. Existing mutant acquisition is already broad, so awareness alone will not fix enemy speed or late spawning.
2. **Objective engagement:** queue zone waves independently instead of overwriting pending work; design explicit encounter completion or control-area requirements for selected transitions. Consider interruptible, clearly communicated interaction commitment for the vial/purge. Preserve the finite enemy cap and existing boss gate.
3. **Encounter design:** place early visible threats, alternate routes, interception positions and objective cover so players make tactical choices before reaching the interaction. Measure completion time, damage taken, enemies encountered and missed waves with sprint-only route tests; allow intentionally optional encounters rather than forcing every kill.
4. **Movement commitment:** evaluate short interaction commitments or sprint recovery costs as a separate gameplay change only after encounter/AI fixes. Any stamina, acceleration or weapon-ready changes need explicit balancing and accessibility review; do not use an animation change to alter player speed or collision.

These findings are source-code observations. A dedicated future playtest should reproduce the actual bypass routes and distinguish intentional evasion from encounter scheduling defects before changing difficulty.
