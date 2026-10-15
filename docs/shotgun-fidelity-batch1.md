# Shotgun fidelity — Batch 1

Stacked on unmerged draft [PR #15](https://github.com/fcootes/Gun-Arena-V2/pull/15),
base `3778c568db1162d40822676d5d31ffc385b0681a`. Branch:
`feat/shotgun-fidelity-batch1-20261015`; PR target:
`feat/procedural-first-person-hands-20261015`. Neither PR is merged. This does
not mark the foundation visually accepted or authorize Batch 2.

## Diagnosis and implementation

The previous `App.fireWeapon()` started the report, pump recording and renderer
pump timer together. `weapons.update()` also had a separate sine-wave pump for
`boltCycleT`, and the support wrist interpolated behind the moving part. Shell
cues began at the start of an insertion phase; a second cylinder rotation stood
the shell across the bore, and a solid receiver box occupied the loading path.

`shotgunMechanics.ts` now provides one simulation clock for a fired or interrupted
chamber action. `advanceWeaponReload()` emits pump and committed seating events
at boundaries, including frames crossing multiple boundaries. `weapons.ts` and
the existing shared `viewmodelHands.ts` palette read this clock and the same
moving pump attachment. Presentation does not change ammo or schedule sounds.
The two obsolete presentation-only APIs (`triggerShotgunPump()` and
`playShotgunReloadPhase()`) have been migrated at every source/test caller.

The shotgun alone gets restrained receiver recoil, a rear stop and closing
settle. Camera recoil values, fire interval, damage, spread, magazine, reserves,
input and movement are unchanged. Its first-person receiver has an open bottom,
bounded side walls and visible lips. A red hull and brass base travel parallel
to the bore through that opening. Reload roll exposes the underside; normal
hip/ADS/sprint transforms remain unchanged. There is still one shared hand pair.

## Timings

All values below are seconds of simulation time, at class multiplier 1.

| Fired action | Start → end | Behavior |
| --- | --- | --- |
| Report | 0 | Immediate accepted shot; natural tail continues |
| Recoil/recovery | 0 → .180 | Sharp 35 ms receiver peak; asymmetric recovery; pump stays still |
| Rearward stroke | .180 → .410 | 75 mm; delayed pump cue starts at .180 |
| Rear stop | .410 → .440 | Full rearward endpoint, small receiver response |
| Forward stroke | .440 → .660 | Positive return to zero displacement |
| Lock/settle | .660 → .740 | Action stays locked until closed |
| Next shot eligibility | ≥ .850 | Existing fire interval remains authoritative |

The physical pump gesture lasts .560 s, after the .180 s recovery. The reused
.420 s recording fits the .480 s moving/stop interval at playback rate .875.

| Shell reload | Duration / boundary | Behavior |
| --- | --- | --- |
| Open/access | .300 | Release pump, briefly access port, reach pickup |
| Each shell | .850 | Pickup 0–.136; carry .136–.442; press .442–.612; follow-through/reset .612–.850 |
| Seating/transfer | .612 into each shell | Exactly one reserve decrement, ammo increment and cue; shell becomes hidden inside port |
| Tactical finish | .260 | Return to fore-end; no redundant pump of an already chambered action |
| Empty chamber action | .740 | .180 hand return, then the same .560 pump gesture |
| Empty close | .180 | Recover ready pose |

Shell `n` seats at `.300 + (n−1) × .850 + .612`. With six missing shells:
`.912, 1.762, 2.612, 3.462, 4.312, 5.162`; chamber action starts at 5.400,
pump cue at 5.580, ready at 6.320. A partial reload with four missing shells
takes 3.960 s; two missing shells take 2.260 s. Reload phase durations, seating
and cue fitting all scale with the existing class reload multiplier. Post-shot
cycling remains .740 s across classes.

The deliberate shell window intentionally increases reload time: the old insert
was .39312 s tactical / .55440 s empty at class speed 1. Other weapon reload
times and the shotgun firing balance constants are unchanged.

## Interrupts and lifecycle

A loaded tactical reload may interrupt immediately. An empty reload cannot fire
before its first real seating transfer. Once a shell is seated, interruption
preserves its ammo and requires a chamber cycle before consuming the held trigger.
Interrupting a chamber action carries its elapsed progress and pump-event flag
forward, rather than restarting it or replaying its cue. `pendingReloadShot`
remains a one-shot request consumed by the App only when ready and still held.

Switching, death and match exit clear queued fire and cancel the shotgun action.
An unfinished action remains `needsChamber`; returning requires the existing
chamber-only reload path. Pause freezes the simulation and preserves audio
cursors. Existing weapon-audio stop/release paths stop all active voices.

## Existing sounds and listening limits

All four supplied WAV files remain byte-for-byte unchanged. Shell cues start at
seating, fitted to .480 s × class multiplier: tactical .39312 s → rate .819;
empty .55440 s → rate 1.155. Late frames seek into a cue; wholly obsolete cues
are skipped rather than burst-played. Pump playback never stops the report tail.

The environment has no listening/audition tool. Playback events and file metadata
are verified; the suspected embedded pump in `shotgun_fire_single.wav` remains
unconfirmed. No replacement recording has been acquired, generated, overwritten
or recommended on that unverified premise. Please audition the report/pump blend
and the modest fitting on the preview during acceptance.

## Deferred foundation acceptance

These remain separate PR #15/backlog issues; no fix is included here:

- Global sprint tilt points the opposite way from the user's intended left carry.
- Sniper and SMG charging-handle reach travels too far rearward.
- Battle rifle needs a more upright, visible reload.
- LMG needs a firmer magazine slap/seating action.
- Minigun handle should face up.
- RPG needs stronger reload tilt and a recognisable rocket mesh.

The accepted AR charging latch and pistol reload are preserved. Do not begin
Heavy Sniper Fidelity (Batch 2) until the user visually approves this batch.
