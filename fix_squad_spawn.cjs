const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target1 = `        } else {
          for (let i = 0; i < matchConfig.friendlyCount; i++) makeBot('blue');
        }`;

const replace1 = `        } else {
          for (let i = 0; i < matchConfig.friendlyCount; i++) {
            const bot = makeBot('blue');
            bot.pos.set(player.pos.x + (Math.random() - 0.5) * 4, 1.2, player.pos.z + (Math.random() - 0.5) * 4);
            bot.group.position.copy(bot.pos);
          }
        }`;

code = code.replace(target1, replace1); // for zombie
code = code.replace(target1, replace1); // for extraction

const target2 = `        } else {
          for (let i = 0; i < matchConfig.friendlyCount; i++) makeBot('blue');
        }
        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot('red');`;

const replace2 = `        } else {
          for (let i = 0; i < matchConfig.friendlyCount; i++) {
            const bot = makeBot('blue');
            bot.pos.set(player.pos.x + (Math.random() - 0.5) * 4, 1.2, player.pos.z + (Math.random() - 0.5) * 4);
            bot.group.position.copy(bot.pos);
          }
        }
        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot('red');`;
        
code = code.replace(target2, replace2); // for team

fs.writeFileSync('src/App.tsx', code);
