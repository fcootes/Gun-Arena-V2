const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const spawnBlockOld = `              for (let i = 0; i < spawnCount; i++) {
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
                
                bot.pos.set((Math.random() - 0.5) * 3.0, 1.2, spawnZ);
                bot.group.position.copy(bot.pos);
              }`;

const spawnBlockNew = `              for (let i = 0; i < spawnCount; i++) {
                // Set spawn position ahead of player's sector
                let spawnZ = player.pos.z + 15 + Math.random() * 15;
                if (spawnZ > 42) spawnZ = 42; // Cap at end of map
                
                let bot;
                if (matchConfig.mode === 'extraction') {
                  const s = dir.currentSector;
                  const roll = Math.random();
                  if (s <= 2) {
                    bot = makeBot('red'); // Heavy Mercenary
                  } else if (s === 3) {
                    if (roll > 0.7) bot = makeBot('zombie', 'brute', false); // Nugget Brute
                    else bot = makeBot('red'); // Mercenary Enforcers
                  } else if (s === 4) {
                    if (roll > 0.85) bot = makeBot('zombie', 'banshee', false);
                    else if (roll > 0.7) bot = makeBot('zombie', 'bloater', false);
                    else bot = makeBot('red'); // Rogue Bio-Tech Mercs
                  } else {
                    if (roll > 0.95 && !extractionTankBossSpawned) {
                      bot = makeBot('zombie', 'megaboss', false);
                      extractionTankBossSpawned = true;
                    } else if (roll > 0.7) bot = makeBot('zombie', 'brute', false);
                    else bot = makeBot('red');
                  }
                } else {
                  const zTypeRoll = Math.random();
                  let zType = 'walker';
                  if (zTypeRoll > 0.95 && dir.currentSector > 3) zType = 'megaboss';
                  else if (zTypeRoll > 0.8) zType = 'brute';
                  else if (zTypeRoll > 0.7) zType = 'banshee';
                  else if (zTypeRoll > 0.5) zType = 'bloater';
                  else if (zTypeRoll > 0.3) zType = 'runner';
                  bot = makeBot('zombie', zType, false);
                }
                
                if (bot) {
                  bot.pos.set((Math.random() - 0.5) * 3.0, 1.2, spawnZ);
                  bot.group.position.copy(bot.pos);
                }
              }`;

code = code.replace(spawnBlockOld, spawnBlockNew);
fs.writeFileSync('src/App.tsx', code);
