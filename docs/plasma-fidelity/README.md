# W03 PR-100 Plasma Repeater

The current pass corrects backward recoil, true upward aim climb, cartridge seating force and forced-overheat hand timing on existing draft [PR #26](https://github.com/fcootes/Gun-Arena-V2/pull/26), branch `feat/plasma-repeater-fidelity`.

- **3.20 s cartridge reload:** held 75% insertion → 105 mm support-hand wind-back → .16 s fast slap → one ammo transaction at **2.23 s** → lock/settle → closure → ready.
- **2.90 s forced recovery:** .90 s deliberate glove withdrawal/wave/settle. Preventative manual vent remains **2.25 s**, without a discomfort reaction.
- **Backward shot response:** exact critically damped spring, ~34 mm compression, ~.274° secondary model rise; no rest-crossing recoil oscillation.
- **True aim recoil:** persistent .258° hip / .168° ADS player-pitch impulse per successful shot, compensated with normal mouse input. No duplicate legacy camera impulse; launched bolts keep pre-shot aim.

The approved exterior, chamber, eight bolts/s, 60/180 charges, damage, projectile collision, thermal buildup, indicators, pooled material impacts, audio assets and other weapons are preserved.

See the [final acceptance report, timings, tests and three clips](final-acceptance/README.md). Earlier [tactile](tactile-evidence/README.md) and [refinement](refinement-evidence/) evidence is historical comparison material. Dedicated future Foley remains documented in [audio follow-up](audio-follow-up.md); the forced-only `heat_react` event is silent until an approved discomfort recording exists.

PR #26 stays draft and unmerged. Native laptop appearance/feel/performance remain for developer acceptance. No production deployment or W04 work.
