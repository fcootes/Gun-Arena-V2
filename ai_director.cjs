const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = "// 6. World doors & interactions";
const directorCode = `
        // === AI DIRECTOR: DIRECTIONAL PROGRESSIVE SPAWNING ===
        if (matchConfig.mode === 'EXTRACTION') {
          if (!window.aiDirectorState) {
            window.aiDirectorState = {
              currentSector: 1,
              spawnTimer: 0,
              waveCount: 0
            };
          }
          const dir = window.aiDirectorState;
          dir.spawnTimer -= dt;
          
          // Determine Player Sector
          let pSector = 1;
          if (player.pos.z > 25) pSector = 5;
          else if (player.pos.z > 5) pSector = 4;
          else if (player.pos.z > -15) pSector = 3;
          else if (player.pos.z > -35) pSector = 2;
          
          dir.currentSector = pSector;

          // Progressive Spawning: spawn enemies ahead of the player
          if (dir.spawnTimer <= 0) {
            dir.spawnTimer = 4.5 + Math.random() * 3; // Spawn every 4-7 seconds
            dir.waveCount++;
            
            // Only spawn if total bots are low
            if (bots.length < 25) {
              const spawnCount = 2 + Math.floor(dir.waveCount / 5);
              for (let i = 0; i < spawnCount; i++) {
                const zTypeRoll = Math.random();
                let zType = 'walker';
                if (zTypeRoll > 0.95 && dir.currentSector > 3) zType = 'megaboss';
                else if (zTypeRoll > 0.8) zType = 'brute';
                else if (zTypeRoll > 0.7) zType = 'banshee';
                else if (zTypeRoll > 0.5) zType = 'bloater';
                else if (zTypeRoll > 0.3) zType = 'runner';

                const bot = makeBot('zombie', zType, false);
                
                // Set spawn position ahead of player's sector
                let spawnZ = player.pos.z + 15 + Math.random() * 15;
                if (spawnZ > 42) spawnZ = 42; // Cap at end of map
                
                bot.pos.set((Math.random() - 0.5) * 16, 1.2, spawnZ);
                bot.group.position.copy(bot.pos);
              }
            }
          }
        }
        
        `;

code = code.replace(target, directorCode + target);
fs.writeFileSync('src/App.tsx', code);
