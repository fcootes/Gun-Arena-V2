const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetLoop = `          world.moveEntityWithCollision(player.pos, player.vel, PLAYER_RADIUS, player.pos.y - eyeHeight, player.pos.y + 0.25, dt);
          player.pos.y += player.vel.y * dt;
          const ground = world.getHighestSurface(player.pos.x, player.pos.z, player.pos.y - eyeHeight) + eyeHeight;`;

const newTargetLoop = `          world.moveEntityWithCollision(player.pos, player.vel, PLAYER_RADIUS, player.pos.y - eyeHeight, player.pos.y + 0.25, dt);
          player.pos.y += player.vel.y * dt;
          
          // STRICT CEILING CLAMP
          if (selectedMapStateRef.current === 'hangar') {
             if (player.pos.y + 0.25 > 2.8) {
                 player.pos.y = 2.8 - 0.25;
                 if (player.vel.y > 0) player.vel.y = 0;
             }
          }
          
          const ground = world.getHighestSurface(player.pos.x, player.pos.z, player.pos.y - eyeHeight) + eyeHeight;`;

code = code.replace(targetLoop, newTargetLoop);
fs.writeFileSync('src/App.tsx', code);
