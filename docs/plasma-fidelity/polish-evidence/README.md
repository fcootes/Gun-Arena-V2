# W03 final polish evidence — draft PR #26

Actual shared Three.js weapon geometry and production App projectile/damage paths, continued from `43e87369dadc2f2bf3c5394628178fe71a17dd82`. This is the current evidence; the adjacent refinement directory records the earlier accepted design.

## Four changes

- Cyan-white shaped packets with tight envelopes, short tapered wakes and slight shader instability. Three instanced projectile draws reuse the existing 192 simulation slots. Full packet length <.45 m; shots remain 25 m apart at the unchanged 8 Hz/200 m/s cadence.
- Material-aware flashes, restrained sparks/dust and 80 bounded scorches. Marks remain fully visible 12 s and fade to expiry at 16 s. Separate limits: 32 flashes lasting .16 s, 192 particles lasting ≤.22 s. Three feedback draws; no dynamic lights/textures or per-shot GPU allocations. Combined bolt/feedback attribute buffers total 58,242 bytes (excluding driver/material overhead).
- Rounded graphite pressure vessel radius .025 m versus .021 m (+19%). Main vessel .156 m, capped body .178 m; metallic caps/collars, limited cyan strip and keyed couplings retain the original .206 m attachment span. Installed, spent and incoming objects share the same baked buffer/material; the bare weapon remains 21 meshes.
- Strong continuous side impulse at .58 s: >.12 m lateral displacement in 33 ms, >.30 m in .20 s. Fall/spin start after .065 s of clearance. The existing .66 s cosmetic lifetime, 1.58 s seat transaction, thumb press, hand motion, slap, doors and 2.20 s completion remain unchanged.

Collision winner selection, nearest solid priority, falloff, headshot, friendly blocking and existing App damage functions remain authoritative. Existing marked destructibles alone receive their normal environmental callback (≤12 damage per shot); ordinary walls never acquire destruction state. Surface marks use real mesh points/normals, validate their footprint, and invalidate on support removal/movement/hiding/destruction. Invisible bounds and characters never receive persistent marks.

## Screenshots

All PNGs are actual renderer output. Gameplay views use existing Area 51 interior or Training Field exterior lighting. Two simple concrete/metal diagnostic panels are added by the test harness only to compare finishes and mark fading reliably; these panels are not part of the shipped maps. The normal first-person weapon and actual production projectile pool render them.

| Evidence | Files |
|---|---|
| Oblique moving packet, dark / bright | [dark](dark-packet-profile.png), [bright](bright-packet-profile.png) |
| Actual muzzle-to-target flight | [dark](dark-concrete-flight.png), [bright](bright-concrete-flight.png) |
| Concrete impact | [dark](dark-concrete-impact.png), [bright](bright-concrete-impact.png) |
| Metal impact | [dark](dark-metal-impact.png), [bright](bright-metal-impact.png) |
| Six marks: new, fading after 13 s, expired after 16.1 s | [new](bright-marks-new.png), [fading](bright-marks-fading.png), [expired](bright-marks-expired.png) |
| Chunky cylinder in open chamber | [Armory close-up](armory-internal-cylinder.png), [first person](dark-inside.png) |
| First 33 ms of pop / completely clear after .10 s | [initial pop](dark-initial-pop.png), [clear](dark-cleared-doors.png) |
| Fresh cylinder seated / closed ready | [seated](dark-fresh-seat.png), [ready](dark-closed-ready.png) |
| Approved silhouette and ceramic emitter | [three-quarter](armory-ready-three-quarter.png), [front](armory-front-emitter.png) |
| Independent cooling shutters | [Armory](armory-thermal-shutters.png) |

The oblique packet views use a test-launched crossing shot through the production pool so the short wake can be inspected; muzzle-to-target views and video use the real App firing function. No generated concept art is presented as model evidence.

## Normal-speed video and provenance

[First-person firing, impacts, uninterrupted full reload and separate vent](fire-impacts-reload-vent-normal-speed.mp4).

**Offline 30 FPS normal-speed simulation playback, not a real-time/native GPU recording.** Actual App renderer, held world/AI, existing Area 51 lighting, diagnostic panels and production hands/reload/bolts. Each output frame advances four 1/120 s production updates. No animation interval is sped up: 66 consecutive frames cover the entire 2.20 s reload. The separate thermal action lasts 1.25 s, keeping the cartridge closed. The firing window begins from a ready trigger: its immediate and inclusive endpoint reports span eight .125 s intervals (60 → 51 charges). Fire/reload GPU counts stay 464 geometries / 52 textures. The first independent vent uploads one existing preallocated vapour geometry, then stays at 465 / 52; this is not a per-shot allocation. [Audit](evidence-audit.json). The export is silent; the existing audio code/WAVs are unchanged and its tests pass.

[Frame-by-frame states and export metadata](video-provenance.json) identify fire/swap/vent boundaries, charges, heat, physical parts, marks and GPU counts. [Dark](dark-states.json) / [bright](bright-states.json) screenshot states and the [Armory controls/resource check](armory-controls-memory.json) accompany the images.

## Verification and limits

- TypeScript and production build pass (existing Vite large-bundle warning).
- `test:plasma`, `test:plasma:polish`, `test:weapons`, `test:viewmodel`, `test:runtime`, `test:tactical`, `test:audio`, `test:area51` pass. No failing final checks.
- Existing tests preserve 8 Hz at 30/60/144 simulated FPS, one charge/shot, exact reload transactions/cancellation/class scaling, vent/heat/indicators, moving-target/wall sweeps, muzzle obstruction, expiry and cleanup.
- The polish test executes the actual App `damageBot`/`applyDamageToPlayer` functions through pool hits: Spartan body armour absorbs 7.8 of 12, leaving 4.2 health damage; headshot applies 20.4 while bypassing that armour; two 12-damage incoming bolts consume 15 player shield and 9 health. Attacker identity, no duplicate events, friendly blocking and a nearer wall are checked.
- Tests cover true rotated/nonuniform mesh normals, invisible/removed/moved supports, close-cover feedback, 80-slot recycle/fade/reset, existing environmental interface, zero per-shot GPU-object allocation and once-only disposal. Actual cylinder and articulated glove vertices clear the ejection path/doors at 240 Hz.
- Armory's real controls and six replacement/disposal cycles pass with stable 24 geometries / 4 textures. No browser page or shader errors in final captures.
- This environment uses SwiftShader. Native laptop quality/performance/feel still require the developer's acceptance. These exports do not establish native frame rate or real-time responsiveness. Original third-person body/arm posing is unchanged. Existing missing dedicated mechanical Foley remains documented in [W07 follow-up](../audio-follow-up.md).

PR #26 remains **draft**, unmerged, on the existing feature branch. No production deployment or W04 work.
