# Combat Pistol fidelity and one-handed sprint

The CP-9 pistol now has a chamfered metal slide, an open ejection window and barrel bore, a hollow contoured polymer grip, an open bevelled trigger guard with a curved trigger, a visible magazine baseplate, compact accessory rail, rear/front serrations, and matte non-emissive sight inserts. Slide, magazine, slide release, and magazine catch remain separate named parts.

Baseline: verified `origin/main` / PR #19 merge `ca954ccd794a1e92a80491fe1a9b3e0de142f3b8`. Branch: `feat/pistol-fidelity-one-handed-sprint`. This is a draft review change; no merge or production promotion is authorized.

## Reload and audio

The existing `beginWeaponReload` / `advanceWeaponReload` sequence owns timing and ammunition. Presentation never changes that state. Existing class multipliers, phase boundaries, recordings, sound decay, cancellation, volume and pause handling are preserved.

| Action | Duration at multiplier 1 | Sequence |
| --- | --- | --- |
| Tactical | 1.1856 s | Support hand takes the old magazine, extracts and stows it below the viewport, acquires the visible replacement, guides it up the magwell axis, then recovers the two-handed grip. Slide stays forward. |
| Empty | 2.09 s | Slide stays rearward during extraction and insertion. After ammunition transfers at magazine seating, the left thumb reaches the actual slide release, the paddle presses and the slide returns, then support grip recovers. |
| Interrupted after insertion | Existing chamber-only clock | Preserve inserted ammo; operate the slide without replaying the magazine exchange. |

Batch1 manifest cue onsets remain unchanged: tactical removal 0 / insertion 0.5682917 s; empty removal 0.083 / insertion 1.0335 / chamber 1.3665 s. The existing composite recordings are fitted to the authoritative duration. No chamber layer, replacement sound, download, synthesis or additional audio asset is introduced.

Two magazine groups share baked geometry/materials. Old/fresh visibility exchanges below the viewport; only one remains seated. Every update restores original parts before applying absolute phase poses. Switching, cancellation, death and redeployment clear stale presentation without granting ammunition or bypassing chambering.

## One-handed sprint

The supplied Master Chief running image informed the raised, secure right-handed pistol carry and reciprocal free left arm. First person uses the existing gameplay `sprinting`, grounded and movement flags. It does not infer sprint from camera motion.

The current sprint uses a shared, speed-scaled complete stride pair, C2 authored trajectories, shoulder/elbow forward kinematics, a constrained right-hand carry, independent left running fist, footfall compression, subtle wrist lag and critically damped transitions. The local third-person actor reads the same gait. See [sprint biomechanics and current visual evidence](../pistol-sprint-gait/README.md) for architecture, cadence, validation and the continuous in-game clip.

## Preserved behavior and ownership

Pistol values remain 15 / 60, semi-auto, 0.22 s fire interval, 28 damage, 0.022 spread and existing recoil, ADS, input and grounded sprint restrictions. No movement, physics, stamina, collision, bot AI, map, deployment preparation or HUD changes are included.

All 11 other weapon models were compared with verified main in both first-person and actor/studio modes: geometry attributes, material properties, transforms, part visibility and feature groups match exactly. Battle Rifle, sniper and shotgun state-machine/hand tests pass.

The cached pistol animator allocates its scratch vectors/quaternions once. The hand rig reuses its instanced digits and sleeve buffers. Fresh magazines share the original baked buffers. Existing traversal-based disposal deduplicates geometry, materials and owned textures, and releases hand instance buffers exactly once. No geometry, mesh, material or React state is created in the animation tick.

## Validation

Passed: `npm run lint`, `npm run build`, `npm run test:weapons`, `npm run test:viewmodel`, `npm run test:controls`, `npm run test:audio`, `npm run test:br`, `npm run test:sniper`, `npm run test:shotgun`, and `npm run test:pistol`.

Pistol tests cover tactical/empty reloads at 30/60/144 Hz and three class speeds, magazine-hand contact, fixed right grip, slide lock/release order, reserve conservation, interruption/chamber-only recovery, variable-rate sprint agreement, independent wrist motion, pause, ADS/stop, switching and death/reset. Shared tests check cached resource allocation, near-plane bounds and disposal.

The browser harness uses the actual App scene/camera and actual WeaponStudio component. Still poses step the real authoritative reload clock deterministically; live controls are exercised separately. See `evidence/validation.json` for the completed live checks and sampled transforms. Software-rendered Chromium captures are evidence of the actual models/rig, not generated concept art. Build succeeds with the existing Vite chunk-size advisory.

Reproduce game checks with `npm run test:pistol:browser`. Set `PISTOL_STUDIO_ONLY=1` for armory profiles. To reproduce the original model, export `src/weaponModels.ts` from the baseline commit into `work/`, then pass its absolute path as `PISTOL_BASELINE_MODELS` with studio-only mode. `PISTOL_OUTPUT` selects the evidence directory; `BENCHMARK_BROWSER` overrides `/usr/bin/chromium`.

## Review evidence

[Current sprint contact sheet, continuous cycle and validation](../pistol-sprint-gait/README.md). Prior local model/reload evidence remains preserved in the backup checkpoint.

## Preview

The existing `gun-arena-v2` project creates non-production previews for PR #20. Vercel's GitHub commit status confirms successful deployment of source checkpoint `5d0dd1b9d001a67144733a6c05847740e5c775bf`. See [the current gait report](../pistol-sprint-gait/README.md) and PR checks for the latest evidence head. Direct deployment-inspection API access remains blocked by HTTP 403 for scope `fcootes`; the exact-head association is checked through Vercel's status on the GitHub SHA. No production deployment, promotion, merge or protection change was made.
