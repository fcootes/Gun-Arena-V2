const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldActivateMedkit = `    function activateMedkit() {
      if (player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 50);
        pushKillFeed('MEDKIT DEPLOYED // +50 HP');
        AUDIO.sniperReload.play(0.65);
      } else {
        pushKillFeed('HP FULL // MEDKIT CONSERVED', true);
      }
    }`;

const newActivateMedkit = `    function activateMedkit() {
      if (player.isDrinking) return; // Already healing
      if (player.health < player.maxHealth) {
        player.isDrinking = true;
        player.drinkTimer = 2.0;
        // Medkit activation will finish in the update loop
        pushKillFeed('APPLYING MEDKIT...');
        AUDIO.sniperReload.play(0.65); // Radio sound effect proxy
      } else {
        pushKillFeed('HP FULL // MEDKIT CONSERVED', true);
      }
    }`;

code = code.replace(oldActivateMedkit, newActivateMedkit);

const oldDrinkTimerLoop = `          if (player.isDrinking) {
            player.drinkTimer -= dt;
            if (player.drinkTimer <= 0) {
              player.isDrinking = false;
              const w = currentSlot();
              const ws = currentSlotState();
              if (w.id === 'mini') {
                player.shield = Math.min(50, player.shield + 25);
                pushKillFeed('+25 SHIELD APPLIED');
                if (ws && (ws.count ?? 0) > 0) ws.count!--;
              } else if (w.id === 'medkit') {
                player.health = player.maxHealth;
                player.shield = player.maxShield;
                pushKillFeed('HEALTH AND SHIELD FULLY RESTORED');
                if (ws && (ws.count ?? 0) > 0) ws.count!--;
              }
            }
          }`;

const newDrinkTimerLoop = `          if (player.isDrinking) {
            player.drinkTimer -= dt;
            if (player.drinkTimer <= 0) {
              player.isDrinking = false;
              // Dedicated Hotkey Medkit (+50 HP)
              player.health = Math.min(player.maxHealth, player.health + 50);
              pushKillFeed('MEDKIT DEPLOYED // +50 HP');
            }
          }`;

code = code.replace(oldDrinkTimerLoop, newDrinkTimerLoop);

fs.writeFileSync('src/App.tsx', code);
