# W07 audio follow-up — internal split chamber

No new recordings or sound scouting. Existing discrete reports, cylinder seating and the bounded thermal hiss remain in use; all source WAVs and other weapons' audio are unchanged. The obsolete beam loop/reload composite are not used.

| Typed contact | Baseline time | Audio status |
|---|---:|---|
| `chamber_release` | .38 s | Silent: thumb-operated loaded detent click needed |
| `doors_open` | .58 s | Silent: two compact hinged armour panels reaching open stops |
| `cylinder_eject` | .58 s | Silent: retention release / short forceful canister expulsion |
| `cylinder_align` | 1.35 s | Silent: fresh cylinder first insertion/seat approach |
| `cylinder_seat` | 1.58 s | Existing `plasma_chamber_insert.wav`; firm final seating/locking contact |
| `doors_close` | 1.88 s | Silent: receiver panel closure and detent |
| `ready` | 2.20 s | Silent: subtle grip/settling Foley if needed |
| `thermal_open` + `cooling_pulse` | .50 s in the separate vent action | Existing cooling hiss; dedicated shutter Foley missing |
| `thermal_close` | 1.15 s in the separate vent action | Hiss stops; dedicated shutter closure missing |

The thermal switch remains .30 s before shutter opening, with no cartridge-door movement or resource transfer. No thermal hiss is layered over cartridge replacement.

`advancePlasmaAction` emits each typed event once from the authoritative clock. Listener arguments are event, whole-action class duration multiplier, and late simulation time after the event within a multi-boundary frame. Rendering has no sound timers. Playback cursor/rate follow this same clock and stop on pause/cancellation/death/switch. Existing automated audio coverage checks class scaling, no doubling, skipped late cues and pause/cancellation.
