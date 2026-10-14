# Tactical Fidelity Batch 1 — FPS controls

Base: `55523e929977b493efe999c9ab7ca1dadfc50594` (merged performance PR #12).
Validated implementation: `7b17ef813add595bb6b29847595c933577051a06`.
The merge landed during this task. The controls branch was rebased onto it; the
viewmodel/mission/audio preparation, bounded draw batches, resource ownership,
resize handling and rendering cleanup remain intact.

## Controls

| Action | Before | After |
| --- | --- | --- |
| Move | WASD | WASD |
| Fire / selected item | Left mouse | Left mouse |
| ADS | Left Shift | Hold right mouse |
| Sprint | Existing speed/state, no input activation | Hold Left Shift while moving on the ground |
| Crouch | Hold Left Ctrl | Hold Left Ctrl |
| Jump | Space; repeats could retrigger | Space, once per press while grounded |
| Knife melee | F **and V** | F only |
| Interact | E | E, separate physical press and consumable campaign latch |
| Reload | R | R, once per press |
| Grenade | G | G, once per press |
| Squad follow / hold | Z | Z, once per press |
| Squad push objective | C | C, once per press |
| Squad focus target | X, then left click | X, then left click |
| First / third person | V **also caused melee** | V only |
| Four tactical loadout slots | 1–4 | 1–4 |
| Cycle loadout | Mouse wheel | Mouse wheel on gameplay canvas |
| Pause / resume | Escape / P; repeats could toggle | Escape / P, once per press; pause button uses the same handler |

Right mouse takes priority over Shift regardless of press order. Releasing right
mouse restores sprint only if Shift remains held and the player is eligible.
Sprinting requires alive, playing, nonzero movement intent, grounded, uncrouched,
nonascending state, and no active reload, melee or field-kit use. Opposing movement
keys cancel. ADS also waits for reload/melee/kit use to finish and requires a weapon
slot. Holding right mouse during a reload continues to suppress sprint.

## Implementation and preservation

`src/gameplayInput.ts` contains the lightweight mappings, controls guide, reusable
physical key set and mouse-button mask. The campaign still receives the original
`Record<string, boolean>` shape. Consuming E cannot rearm it through keyboard repeat;
a fresh release/press is required. Existing campaign/objective logic is unchanged.

App applies held state directly to the existing imperative player object. It uses
unchanged 5.2 walking, 8.6 sprinting and 2.6 crouching speeds, class/faction modifiers,
heavy-weapon penalties, gravity, collision calls and geometry. No frame React updates,
new dependencies or rendering resources are introduced. Existing first/third-person
camera, sensitivity, weapon cadence, reload states, inventory clicks and squad target
selection retain their paths.

Input cleanup clears physical presses, every mouse button, firing, ADS, sprint,
crouch, railgun charge and minigun warmup on pause, death/end screen, restart,
redeployment, lobby return, blur, hidden document and actual pointer-lock loss.
Reload progress/audio cursors survive pause. Focus loss releases firing without
pausing the mission. Pointer-lock rejection retains either-button drag-to-look and
does not force a pause. Gameplay suppresses the canvas context menu and wheel scroll;
lobby/menu controls keep normal behavior. Listener teardown removes every added
handler. Editable fields ignore combat keys; Escape/P still operate the pause menu.

## Regression coverage

- `test:controls` executes the committed App handlers and movement block with mocked
  world/render/audio boundaries. It covers F/V separation, press-repeat guards, both
  ADS/sprint press orders, release recovery, opposite keys, crouch/jump, grounded
  speed, class/heavy penalties, collision arguments, reload recovery, multi-button
  firing, grenade, consumed E, squad follow/hold/push/focus acquisition, slots/wheel,
  pause/death/restart/lobby/focus/visibility and pointer-lock transitions.
- `test:area51` now feeds physical E presses from GameplayInput through both actual
  faction campaigns, preserving locked lift, vial/server objective, elevator and
  evacuation-console assertions. Existing campaign and extraction tests remain.
- `test:controls:browser` has a 120-second whole-run deadline and 45-second readiness
  bounds. A real DOM fixture exercises handlers through keyboard/mouse events. One
  actual Training scenario (standard protocol, zero allies, one enemy using valid
  lobby settings) checks deployment, sprint speed, ADS, F/V, slots, firing/reload,
  pause/resume through controls and UI, the guide, death, replay and fresh lobby.
  Its Vite-only observation hook never appears in production.

Run `npm run test:controls`, `npm run test:controls:browser`, `npm run lint` and
`npm run build`. Browser checks use Playwright's installed Chromium, or set
`BENCHMARK_BROWSER` and optionally `BENCHMARK_SINGLE_PROCESS=1` for a constrained
software-renderer environment. Evidence is recorded in the adjacent validation and
browser JSON files.

Native Windows/Surface GPU and physical pointer-lock behavior have not been accepted
on the user's device. The browser run deliberately rejects pointer lock to check the
embedded fallback; Node tests exercise acquisition/loss state transitions. These are
control regressions, not FPS/loading benchmarks or full-map visual acceptance.
The existing Vite large-chunk advisory remains outside this controls batch.

All eleven existing suites plus the focused controls suite passed on the merged
base. Final lint, production build, controls, audio and runtime checks passed after
the pause-cursor correction. The bounded Chromium 153 browser flow passed on that
final implementation with no page errors. See `tactical-controls-validation.json`
and `tactical-controls-browser.json` for actual outputs, code hashes and limits.
