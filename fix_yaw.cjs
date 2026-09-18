const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `      player.pos.set(0, terrainHeight(0, -45) + PLAYER_EYE, -45);
      player.vel.set(0, 0, 0);
      player.yaw = 0;
      player.pitch = 0;`;

const newStr = `      player.pos.set(0, terrainHeight(0, -45) + PLAYER_EYE, -45);
      player.vel.set(0, 0, 0);
      player.yaw = Math.PI; // Face directly down the corridor (North)
      player.pitch = 0;`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/App.tsx', code);
