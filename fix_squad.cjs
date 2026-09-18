const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const startIdx = code.indexOf("// Elite Squad Directives & Dynamic Behavior");
const endIdx = code.indexOf("              // Non-sniper bot engagement range restricted");

if (startIdx !== -1 && endIdx !== -1) {
  const newSquad = `// Elite Squad Directives & Dynamic Behavior
              if (bot.team === 'blue' && bot.isElite) {
                const directive = squadDirectiveRef.current;
                const distToPlayer = bot.pos.distanceTo(player.pos);
                
                // Tethering Logic
                let tetherX = player.pos.x;
                let tetherZ = player.pos.z;
                
                if (directive === 'follow_lead') {
                  const pyaw = player.yaw;
                  const slotOffsets = {
                    2: { x: 3.2, z: 2.2 },   // Right flank
                    3: { x: 0.0, z: -3.8 },  // Rear guard
                    4: { x: -3.8, z: -2.0 }, // Left flank
                    5: { x: -3.2, z: 2.2 }   // Front left
                  };
                  const off = slotOffsets[bot.eliteSlot || 2] || { x: 2, z: 2 };
                  tetherX = player.pos.x + Math.sin(pyaw) * off.z + Math.cos(pyaw) * off.x;
                  tetherZ = player.pos.z + Math.cos(pyaw) * off.z - Math.sin(pyaw) * off.x;
                  
                  const dToSlot = Math.hypot(tetherX - bot.pos.x, tetherZ - bot.pos.z);
                  
                  if (distToPlayer > 14) {
                     // Hard Catch-up
                     bot.pos.x = tetherX;
                     bot.pos.z = tetherZ;
                  } else if (distToPlayer > 7.5) {
                     // Outer Sprint
                     moveX = ((tetherX - bot.pos.x) / dToSlot) * 2.0;
                     moveZ = ((tetherZ - bot.pos.z) / dToSlot) * 2.0;
                  } else if (distToPlayer > 3) {
                     // Inner Jog
                     moveX = ((tetherX - bot.pos.x) / dToSlot) * 1.3;
                     moveZ = ((tetherZ - bot.pos.z) / dToSlot) * 1.3;
                  } else {
                     // In formation
                     if (dToSlot > 1.5) {
                       moveX = (tetherX - bot.pos.x) * 0.8;
                       moveZ = (tetherZ - bot.pos.z) * 0.8;
                     }
                  }
                } else if (directive === 'hold_position') {
                  moveX *= 0.1;
                  moveZ *= 0.1; // Stay put
                } else if (directive === 'push_objective') {
                  // Push ahead of player (sector progression)
                  tetherZ = player.pos.z + 15; // Push forward
                  const dToSlot = Math.hypot(tetherX - bot.pos.x, tetherZ - bot.pos.z);
                  if (dToSlot > 2) {
                    moveX = ((tetherX - bot.pos.x) / dToSlot) * 1.5;
                    moveZ = ((tetherZ - bot.pos.z) / dToSlot) * 1.5;
                  }
                }

                // Elite Melee Combat Routine
                if (bot.meleeCooldown > 0) {
                  bot.meleeCooldown -= dt;
                } else if (dist <= 2.4) {
                  bot.meleeCooldown = 0.85;
                  if (bot.armRPivot) bot.armRPivot.rotation.x = -1.9;
                  if (targetObj && targetObj !== 'player' && targetObj.alive) {
                    damageBot(targetObj, bot.meleeDmg, false, bot);
                    flashHit(targetObj);
                    AUDIO.bulletHit.play(0.85);
                  }
                }

                // Elite Archetype Special Abilities
                if (bot.eliteRole === 'heavy') {
                  bot.fireTimer -= dt * 0.35;
                } else if (bot.eliteRole === 'medic') {
                  bot.regenAuraTimer = (bot.regenAuraTimer || 0) + dt;
                  if (bot.regenAuraTimer >= 1.0) {
                    bot.regenAuraTimer = 0;
                    if (player.alive && distToPlayer < 7.0 && player.health < player.maxHealth) {
                      player.health = Math.min(player.maxHealth, player.health + 8);
                    }
                    for (const ally of bots) {
                      if (ally.alive && ally.team === 'blue' && ally !== bot && bot.pos.distanceTo(ally.pos) < 7.0) {
                        ally.health = Math.min(ally.maxHealth, ally.health + 8);
                      }
                    }
                  }
                } else if (bot.eliteRole === 'recon') {
                  bot.reconPingTimer = (bot.reconPingTimer || 0) + dt;
                  if (bot.reconPingTimer >= 3.5) {
                    bot.reconPingTimer = 0;
                    const now = performance.now();
                    for (const hostile of bots) {
                      if (hostile.alive && (hostile.isZombie || hostile.team !== 'blue') && bot.pos.distanceTo(hostile.pos) <= 55) {
                        radarPingsRef.current.push({
                          x: hostile.pos.x,
                          z: hostile.pos.z,
                          timestamp: now,
                          duration: 2.2,
                          type: 'zombie'
                        });
                      }
                    }
                  }
                } else if (bot.eliteRole === 'engineer') {
                  if (bot.deployedCoverCooldown && bot.deployedCoverCooldown > 0) {
                    bot.deployedCoverCooldown -= dt;
                  } else if (dist <= 18) {
                    bot.deployedCoverCooldown = 25.0;
                    world.spawnDeployableCover(bot.pos, bot.facing);
                    pushKillFeed('WRENCH-5: DEPLOYED FORTIFIED COVER!');
                    AUDIO.sniperReload.play(0.65);
                  }
                }
              }

`;
  code = code.substring(0, startIdx) + newSquad + code.substring(endIdx);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Squad directives updated successfully.');
} else {
  console.log('Could not find start or end indices.');
}
