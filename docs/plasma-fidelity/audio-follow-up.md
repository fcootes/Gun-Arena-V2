# W07 audio follow-up — final tactile contacts

No recordings were acquired or fabricated. Existing firing WAVs and every other weapon's audio remain unchanged. `plasma_chamber_insert.wav` plays once at the authoritative final seat, now **2.01 s**. Existing cooling hiss plays only within **.72–1.87 s** of the independent vent action, at .55 forced / .45 preventative volume and the existing once-scaled class playback rate. Cartridge replacement has no thermal hiss, beam loop or full-reload composite.

| Typed contact | Baseline time | Existing audio / W07 gap |
|---|---:|---|
| `chamber_release` | .42 s | Missing thumb detent click |
| `doors_open` | .64 s | Missing two hinged-panel open stops |
| `cylinder_eject` | .64 s | Missing forceful retention release / cylinder pop |
| `cylinder_align` | 1.3496 s | Missing alignment/guide contact |
| `cylinder_partial` | 1.54 s | Missing 75%-insertion resistance contact |
| `cylinder_seat` | 2.01 s | Approved `plasma_chamber_insert.wav` |
| `doors_close` | 2.36 s | Missing panel closure and detent |
| `ready` | 2.70 s | Optional grip/settling Foley missing |
| `thermal_release` | .44 s (vent) | Missing thermal-control click |
| `thermal_open` + `cooling_pulse` | .72 s (vent) | Existing bounded cooling hiss; shutter/pressure contact Foley missing |
| `heat_react` | 1.50 s (vent) | Missing restrained glove withdrawal/shake Foley |
| `thermal_close` | 2.05 s (vent) | Missing shutter closure; hiss already ends at 1.87 s |
| `ready` | 2.25 s (vent) | Optional support-grip return Foley missing |

All contacts belong to the existing `advancePlasmaAction` sequence. The alignment marker splits advancement at its actual phase boundary; stalls can cross several events without repeating one. Listener arguments are event, whole-action class duration multiplier and simulation time after the contact inside a late frame. Audio polling follows the same authoritative clock, with cursor/rate correction, late-cue skip and pause/switch/death cleanup. Missing contacts remain silent for W07.
