const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const medkitOld = `    function activateMedkit() {
      if (player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + 50);
        pushKillFeed('MEDKIT DEPLOYED // +50 HP');
        AUDIO.sniperReload.play(0.65);
      } else {
        pushKillFeed('HP FULL // MEDKIT CONSERVED', true);
      }
    }`;

const medkitNew = `    function activateMedkit() {
      if (player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 50);
        pushKillFeed('MEDKIT DEPLOYED // +50 HP');
        AUDIO.sniperReload.play(0.65);
      } else {
        pushKillFeed('HP FULL // MEDKIT CONSERVED', true);
      }
    }`;

code = code.replace(medkitOld, medkitNew);
fs.writeFileSync('src/App.tsx', code);
