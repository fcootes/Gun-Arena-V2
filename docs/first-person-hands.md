# Tactical Fidelity: first-person hands — implementation checkpoint

Branch: `feat/procedural-first-person-hands-20261015`, based on main
`794fdfd` with merged controls PR #13 and combat preparation PR #14.

`createWeaponAssembly` is unchanged. `viewmodelGrips.ts` defines absolute
weapon-local metre-space attachments (+Y up, muzzle -Z), palm orientations,
finger curl, camera poses, elbow anchors and reload reaches for all 12 weapons.
AR support is under its handguard; the pistol uses a two-hand grip; minigun hands
use its two rear spades; SMG/launchers use their vertical foregrips.

`viewmodelHands.ts` owns one reusable pair per viewmodel manager. Rounded palm
and wrist volumes, tapered sleeves, cuffs, seams and back panels use merged
geometry. Thirty articulated phalanges and knuckle pads use two instanced draws;
the full pair is eight meshes. The rig is reparented to the selected cached
assembly instead of duplicated for each weapon. USMC/APEX palettes use owned
materials; faction is set once during deployment preparation.

The firing hand stays on its configured grip. The support hand independently
follows existing animated magazine/loading/control parts and recovers to its
attachment, without changing reload phases, ammunition or audio. Camera poses
use exponential interpolation; cached rest transforms are restored before recoil,
bob, sprint and reload are applied. Pausing freezes animation and death/redeployment
resets presentation state. First-person stocks are hidden behind the eye to avoid
near-plane obstruction; inspection/character assemblies retain all their parts.

Existing `disposeBotVisuals(manager.root)` callers remain supported. A cleanup
hook releases instance buffers; shared buffers/materials/textures are still
released once by the existing traversal. An idempotent `manager.dispose()` is
also available. Animation allocates no geometry, materials or scene objects.
New lathed finger buffers exclude degenerate pole triangles so the existing
one-primitive lighting-preparation path draws a real triangle.

Focused viewmodel, weapon and tactical tests, TypeScript and production build
passed during implementation. `test:viewmodel` exercises all grips, orientations,
switching, frame-rate-independent ADS, independent reload poses, pause/death,
allocation invariants and both cleanup paths. Before screenshots were captured
from main at 1280x720 with the same fixture lighting.

Still in progress: full browser visual review, both-faction real-game lifecycle,
aspect/sight clearance and measured before/after cost. Do not treat this checkpoint
as final visual/performance acceptance. Browser output is under ignored
`performance-results/viewmodel*`; selected final comparisons will be committed.

```sh
npm run test:viewmodel
BENCHMARK_BROWSER=/usr/bin/chromium BENCHMARK_SINGLE_PROCESS=1 DISABLE_HMR=true \
  npm run test:viewmodel:browser
```
