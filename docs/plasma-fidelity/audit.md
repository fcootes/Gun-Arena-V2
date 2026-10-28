# W03 pre-change audit

Base: main 6dd3b2d, including merged Railgun PR #24. Dedicated branch feat/plasma-repeater-fidelity; no changes to main.

Legacy laser: 0.055 s frame/wall-gated hitscan in App.fireWeapon; ammo excluded from decrement; persistent laserBeamMesh; heat +1.9/shot with 26/s idle cooling. Generic battery reload conflates cooling/insertion and refills mag for free. HUD displays inverse heat as charge. Bot class combat decrements ammo but uses instant probabilistic damage and an independent .3 s delay. Existing model is a purple pronged shell with a bottom cell.

Shared integration: WeaponSlotState holds loadout resources, begin/advance/cancelWeaponReload own action clocks. Weapon factories serve first person, Armory/lobby and actors. Hands target parts in weapon-local space. Bot.classAI.weaponState drives class combat. world.hittableObjects contains world meshes and registered bot hit parts; worldColliders supplies active bounds. App.damageBot and applyDamageToPlayer own shields/armour, difficulty, kill credit and damage attribution. World.collectPickup, App support packs and facility refills grant ammunition through several paths. Map/unmount cleanup is App.clearMatchEntities plus world/scene teardown.

Reference priorities: supplied PR-100 panels 1–2 define exterior (white ceramic emitter, graphite chassis, integrated skeleton stock, compact top and cyan side cylinder). Panels 3–4 provide mechanism only. Panel 5 uses separate shutters with closed tray. Panel 6 means discrete 8 Hz bolts.

Existing audio: plasma_fire_single.wav is .165 s, cooling hiss 2.2 s; cartridge-insert and composite reload also exist. Reuse single reports with bounded overlap and sync approved insert/hiss to real contacts. Do not reuse the beam loop or assume a composite's unidentified clicks match new mechanism. No new recordings acquired.
