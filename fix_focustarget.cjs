const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Add the ref
code = code.replace(/const squadDirectiveRef = useRef<'follow_lead' \| 'hold_position' \| 'push_objective'>\('follow_lead'\);/, "const squadDirectiveRef = useRef<'follow_lead' | 'hold_position' | 'push_objective'>('follow_lead');\n  const focusTargetIDRef = useRef<number | null>(null);");

// Remove the non-existent setters from my previous code block
code = code.replace(/setFocusTargetID\(targetHit\.id\);\n/g, "");

// Modify the bot targeting loop to prioritize the focused target
const targetLoop = `          } else {
            if (player.alive && bot.team !== player.team) {
              const dPlayer = bot.pos.distanceTo(player.pos);
              if (dPlayer < 55) {
                bestDist = dPlayer;
                targetObj = 'player';
                targetPos = camera.position.clone();
              }
            }
            for (const other of bots) {
              if (!other.alive || other === bot || other.team === bot.team) continue;
              const d = bot.pos.distanceTo(other.pos);
              if (d < 50 && d < bestDist) {
                bestDist = d;
                targetObj = other;
                targetPos = other.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
              }
            }
          }`;

const replacement = `          } else {
            if (player.alive && bot.team !== player.team) {
              const dPlayer = bot.pos.distanceTo(player.pos);
              if (dPlayer < 55) {
                bestDist = dPlayer;
                targetObj = 'player';
                targetPos = camera.position.clone();
              }
            }
            // Focus target override for friendly bots
            let hasFocusTarget = false;
            if (bot.team === player.team && focusTargetIDRef.current !== null) {
               const focusedBot = bots.find(b => b.id === focusTargetIDRef.current);
               if (focusedBot && focusedBot.alive) {
                  targetObj = focusedBot;
                  targetPos = focusedBot.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                  hasFocusTarget = true;
               } else {
                  focusTargetIDRef.current = null; // Clear if dead
               }
            }
            
            if (!hasFocusTarget) {
              for (const other of bots) {
                if (!other.alive || other === bot || other.team === bot.team) continue;
                const d = bot.pos.distanceTo(other.pos);
                if (d < 50 && d < bestDist) {
                  bestDist = d;
                  targetObj = other;
                  targetPos = other.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
                }
              }
            }
          }`;

code = code.replace(targetLoop, replacement);

fs.writeFileSync('src/App.tsx', code);
