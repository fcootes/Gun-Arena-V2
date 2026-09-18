const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetLoopZombie = `            } else {
              for (const other of bots) {
                if (!other.alive || !other.isZombie) continue;
                const d = bot.pos.distanceTo(other.pos);
                if (d < 60 && d < bestDist) {
                  bestDist = d;
                  targetObj = other;
                  targetPos = other.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                }
              }
            }
          } else {`;

const replacementZombie = `            } else {
              let hasFocusTarget = false;
              if (bot.team === player.team && focusTargetIDRef.current !== null) {
                 const focusedBot = bots.find(b => b.id === focusTargetIDRef.current);
                 if (focusedBot && focusedBot.alive && focusedBot.isZombie) {
                    targetObj = focusedBot;
                    targetPos = focusedBot.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                    hasFocusTarget = true;
                 } else {
                    focusTargetIDRef.current = null;
                 }
              }
              if (!hasFocusTarget) {
                for (const other of bots) {
                  if (!other.alive || !other.isZombie) continue;
                  const d = bot.pos.distanceTo(other.pos);
                  if (d < 60 && d < bestDist) {
                    bestDist = d;
                    targetObj = other;
                    targetPos = other.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                  }
                }
              }
            }
          } else {`;

code = code.replace(targetLoopZombie, replacementZombie);
fs.writeFileSync('src/App.tsx', code);
