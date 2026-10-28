# W07 audio follow-up — no scouting performed in W03

Usable existing audio retained: discrete plasma report, cylinder seating and a bounded segment of the cooling hiss. Source WAV bytes are unchanged. The beam loop and legacy reload composite are not used for W03.

Dedicated recordings still needed for later approval:

| Silent contact | Base contact time | Desired recording |
|---|---:|---|
| Tray latch unlock | .45 s | Compact loaded metal detent |
| Carriage reaches outer stop | .87 s | Short guided metal slide and stop |
| Exposed gas handling pulse | .87 s | Subtle pressure release distinct from the thermal hiss |
| Old cylinder removal | 1.42 s | Retention clip release / short handled canister contact |
| Carriage reaches receiver stop | 2.32 s | Weighted short return slide |
| Final latch lock | 2.54 s | Positive locking detent |
| Thermal switch and shutter motion | .30/.50/1.15 s | Separate switch / small shutter open / shutter close contacts |

`advancePlasmaAction` exposes typed contact callbacks on the authoritative clock. The second callback argument is the class duration multiplier; the third is elapsed simulation time after that event within a late frame. Completed events occur once per action and cancellation discards unperformed contacts. No placeholder or unrelated recording is substituted. Railgun mechanical Foley remains outside W03.
