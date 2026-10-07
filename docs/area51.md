# Area 51 Facility

The facility now uses the explicit `area51` map key and is the default operational map. The retired bunker key is no longer registered. Its previous five-sector geometry is removed; the map selector now displays **AREA 51 FACILITY**. Training Field and Shattered Wall retain their own world implementations.

| Zone | Layout | Gameplay |
| --- | --- | --- |
| 1 — Staging | 40 × 40 ground-level bay, Abrams, turret-mounted Humvee casualty, crates, hazard lanes | E at each rack position selects AR/shotgun/SMG; E at either ammo crate restores both weapon slots |
| 2 — Decontamination | 6 m corridor at X=27.5, observation rooms, glazing, gantry pipes, steam, gurney and blood decals | Right-turn connection from staging; faction-specific encounters |
| 3 — Bio-Lab | 30 × 30 octagon centred at (15, -115), containment cylinders, terminals and servers | USMC secures a blue vial; APEX starts an 8-second server purge. Leaving interaction range pauses the purge |
| 4 — Warehouse | Y=15 arena, pillars and containers, lift landing, evac console, rear blast doors | Extraction arrival is dark. E at the console starts the 3-second camera introduction and boss entry |

Use E in the lift shaft to change floors. Extraction requires the Bio-Lab objective before ascending; TDM, FFA and Horde permit both directions without that objective. AI uses the same two-level authored surface graph and lift portal. Multiplayer modes enable warehouse lighting and helipad access immediately. Facility arena modes do not use the outdoor shrinking storm circle.

USMC progresses through infected encounters to a 1,600-health Abomination. APEX spawns no zombies: MP guards carry pistol/SMG, tactical Marines carry rifles, and three armored Spartan operators flank in the final encounter. Every boss must die before the rear doors open. Corpses retain their encounter references after visual cleanup, so the boss gate does not depend on the active bot-array lifetime.

Walk into the open helicopter cabin after the doors finish sliding. All living squad members board; six are represented in the modeled seats and larger battalions are stowed. Rotor audio starts, the transport departs for eight seconds, and victory is dispatched once. The corrected end-screen contract reports the outcome, mission duration, kills, payout and working redeploy/lobby actions.

## Rendering and ownership

`area51World.ts` owns facility construction, collision, navigation and presentation. `area51Assets.ts` merges the Abrams/Humvee components by material (at most five meshes per vehicle), using lit procedural desert camouflage. Static architectural boxes are instanced by material. Rain and steam use fixed buffers. Epoxy flooring has procedural tile seams and grain.

`WorldResources` counts geometry/material/texture ownership and releases instanced GPU buffers and lights. The helicopter owns a separate resource set. MP badge textures belong to their actor cleanup. Deployable cover is capped at twelve, with immediate collider and GPU-resource removal on replacement. Existing weapon, viewmodel, hit detection and movement systems remain in use.

`campaignAudio.ts` provides generated rotor, door and filtered voiced radio cues. The dispatch phrase uses the browser's speech synthesis voices; the same message is presented in mission text. No new external sound-file downloads are required. Existing weapon sound mappings remain unchanged.

## Validation

Run `npm run test:runtime` for map registration, actual damage/transition handlers and transient resource teardown. Run `npm run lint`, `npm run build`, and each `test:*` script in `package.json`. `test:area51` verifies finite vehicle transforms, all-mode spawn clearance, the actual collision/navigation route, floor transitions, darkness and alarms, one-time disposal, entity identities, MP texture teardown, both faction objectives, the all-boss gate, squad boarding and one-time helicopter victory. The earlier batch-2 reflection test now applies to Training Field; Area 51 has its own scene lifecycle tests.

## Inspector and match lifecycle

Enable **[ DEV / INSPECTOR MODE ]** in the terminal before deploying. This setting is independent of asset unlocks. It gives 99,999 HP, ignores incoming damage, spawns zero allies under either deployment doctrine and applies 99,999 damage through the central player-hit dispatcher (including body shots, melee and projectiles). Normal enemies, faction objectives, lift gates and boss introductions remain active. Turning it off and redeploying restores normal class stats and squad settings. A fall outside Area 51 returns the inspector to Zone 1.

**Play Again** clears input, combat entities/effects, all match counters and the old world, then creates a fresh mission at the authored spawn. **Return to Lobby** unmounts the engine effect: it cancels RAF, removes event listeners and health overlays, disposes world/actor/particle resources and postprocessing targets, destroys the WebGL context and removes its canvas. The new lobby-only engine allocates no operational map until deployment. Shattered Wall/Pacific Rim and Training Grounds remain available.
