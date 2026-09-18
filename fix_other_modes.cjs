const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const otherModesOld = `        // AI Director will handle hostile spawns in EXTRACTION.
      } else if (false) {
        makeBot('blue', null, true); // Create VIP
        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot('red');
      } else {
        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot();
      }`;

const otherModesNew = `        // AI Director will handle hostile spawns in EXTRACTION.
      } else if (matchConfig.mode === 'team') {
        const isElite = deploymentProtocolRef.current === 'elite';
        if (isElite) {
          const squad = eliteSquadRef.current || DEFAULT_ELITE_SQUAD;
          squad.forEach((companion) => makeBot('blue', null, false, companion));
          pushKillFeed('COMMAND: ELITE TASK FORCE DEPLOYED');
        } else {
          for (let i = 0; i < matchConfig.friendlyCount; i++) makeBot('blue');
        }
        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot('red');
      } else if (matchConfig.mode === 'ffa') {
        for (let i = 0; i < matchConfig.enemyCount; i++) makeBot();
      }`;

code = code.replace(otherModesOld, otherModesNew);
fs.writeFileSync('src/App.tsx', code);
