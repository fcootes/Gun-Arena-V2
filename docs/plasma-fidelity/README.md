# W03 PR-100 Plasma Repeater

The current **final tactile pass** continues existing draft PR #26 from verified head `8aaf082121df8f9da95bdfb90c8b0bcdfcc26153`, on `feat/plasma-repeater-fidelity`.

The approved integrated ceramic/graphite emitter, hollow internal cartridge chamber, 86° opposing side doors, pressure-cartridge geometry, six cyan ammunition segments and separate progressive heat indicator are preserved. No model redesign is included.

- **Cartridge reload: 2.70 s.** Thumb press → open → stronger ejection → controlled 75% insertion → resistance/palm rebrace → decisive final 25% drive → closure → ready. Old charges are discarded at **.64 s**; the new 60-charge cartridge consumes one spare and becomes authoritative only at its successful final seat at **2.01 s**.
- **Thermal action: 2.25 s.** Independent shutters and a bounded pressure release are followed by a restrained gloved-hand heat reaction. Forced overheating produces the stronger reaction. Cartridge doors stay closed and ammunition never changes during venting.
- **Firing:** an analytical damped spring gives each successful shot approximately **25 mm rearward travel / 2.58° peak muzzle rise**, alternating small lateral/roll vibration and quick recovery. ADS scales presentation to 62%. Existing camera feedback is unchanged; this adds no aiming/spread penalty.
- **Plasma appearance:** the newer pooled packet/impact implementation is retained, with a modestly fuller core, shorter denser wake, directional muzzle discharge, small pressure ring and restrained stronger contact/residual energy. Scorch limits, support checks and hit events remain intact.

[Full current implementation, timing, tuning, audio and acceptance report](tactile-evidence/README.md) · [Exact changed files](tactile-evidence/changed-files.txt) · [Validation](verification.txt) · [W07 audio contacts](audio-follow-up.md).

## Preserved gameplay

Internal ID `laser`; 60 installed / 180 reserve charges; eight bolts per second (.125 s); 200 units/s; 130-unit range; damage 12; 1.7× headshot; existing falloff, cover checks, swept collisions and player/bot attribution. Heat remains 2.5 per shot with the existing 16/s passive cooling and .15 s grace period. Context-sensitive R precedence and automatic overheat recovery remain intact. Class duration multipliers scale each entire action once.

The authoritative muzzle remains `(0, .023, -.574)`. All three cartridge representations reuse their existing shared geometry/material. Ejection is a bounded cosmetic object, never a projectile or pickup. Ammo/heat indicators read the true counters. The existing 192-bolt pool, 80 scorch marks, 32 flashes and 192 material flecks retain their capacities and ownership. Scorches remain full through 12 s, fading to expiry at 16 s. Other weapons, maps, factions, controls and existing audio files are unchanged.

## Review history

- [Initial audit](audit.md): historical external-tray baseline.
- [Internal-chamber refinement evidence](refinement-evidence/README.md): earlier 2.20/1.25 s actions, now superseded by the current durations.
- [Packet/impact polish evidence](polish-evidence/README.md): approved model, packet, material and scorch foundation at `8aaf082`.
- [Current tactile evidence](tactile-evidence/README.md): final 2.70/2.25 s actions, shot response and forced heat reaction.

PR #26 remains draft for the developer's native-laptop visual/feel/performance acceptance. No merge, production promotion or W04 work.
