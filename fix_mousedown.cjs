const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldMouseDown = `    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      if (gameStateRef.current !== 'playing') return;

      // In browser preview, attempt pointer lock on click if not already locked
      if (document.pointerLockElement !== renderer.domElement) {
        requestGamePointerLock();
      }

      if (e.button === 0) {
        player.fireHeld = true;
        if (!currentSlotState()?.reloading) {
          fireWeapon();
        }
      }
    };`;

const newMouseDown = `    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      if (gameStateRef.current !== 'playing') return;

      if (document.pointerLockElement !== renderer.domElement) {
        requestGamePointerLock();
      }

      if (e.button === 0) {
        if (targetingPhaseRef.current) {
          // X Key: Focus Target Lock Phase
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
          const hits = raycaster.intersectObjects(world.hittables, false);
          let targetHit = null;
          for (const hit of hits) {
            const bot = hit.object.userData?.ref;
            if (bot && bot.alive && bot.team !== player.team) {
              targetHit = bot;
              break;
            }
          }
          if (targetHit) {
            focusTargetIDRef.current = targetHit.id;
            setFocusTargetID(targetHit.id);
            setSquadDirectiveBanner({
              directive: 'focus_target',
              text: 'TARGET ACQUIRED',
              sub: \`LOCKING ALL FIRE ON BOT #\${targetHit.id}\`,
              timer: 3.5
            });
            pushKillFeed(\`SQUAD CMD: ALL FIRE ON BOT #\${targetHit.id}\`);
            AUDIO.sniperReload.play(0.85);
          } else {
            pushKillFeed('TARGETING PHASE FAILED - NO HOSTILE ACQUIRED');
          }
          targetingPhaseRef.current = false;
          setTargetingPhase(false);
          return; // Do not fire weapon during targeting phase click
        }
        
        player.fireHeld = true;
        if (!currentSlotState()?.reloading) {
          fireWeapon();
        }
      }
    };`;

code = code.replace(oldMouseDown, newMouseDown);
fs.writeFileSync('src/App.tsx', code);
