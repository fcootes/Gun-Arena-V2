const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetLoop = `            if (player.alive) {
              const dPlayer = bot.pos.distanceTo(player.pos);
              if (dPlayer < 55) {
                bestDist = dPlayer;
                targetObj = 'player';
                targetPos = camera.position.clone();
              }
            }`;
            
const replaceLoop = `            if (player.alive && bot.team !== player.team) {
              const dPlayer = bot.pos.distanceTo(player.pos);
              if (dPlayer < 55) {
                bestDist = dPlayer;
                targetObj = 'player';
                targetPos = camera.position.clone();
              }
            }`;
            
code = code.replace(targetLoop, replaceLoop);

const targetLoopZombie = `            if (bot.isZombie) {
              if (player.alive) {
                bestDist = bot.pos.distanceTo(player.pos);
                targetObj = 'player';
                targetPos = camera.position.clone();
              }`;

const replaceLoopZombie = `            if (bot.isZombie) {
              if (player.alive && bot.team !== player.team) {
                bestDist = bot.pos.distanceTo(player.pos);
                targetObj = 'player';
                targetPos = camera.position.clone();
              }`;

code = code.replace(targetLoopZombie, replaceLoopZombie);

fs.writeFileSync('src/App.tsx', code);
