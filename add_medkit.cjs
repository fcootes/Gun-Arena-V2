const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = "    function switchSlot(index: number) {";
const medkitCode = `    function activateMedkit() {
      if (player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + 50);
        pushKillFeed('MEDKIT DEPLOYED // +50 HP');
        AUDIO.sniperReload.play(0.65);
      } else {
        pushKillFeed('HP FULL // MEDKIT CONSERVED', true);
      }
    }
    
`;

code = code.replace(target, medkitCode + target);
fs.writeFileSync('src/App.tsx', code);
