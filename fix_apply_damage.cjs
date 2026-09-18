const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `      if (player.health <= 0) {
        player.health = 0;
        player.alive = false;
        AUDIO.arSpray.stop();

        if (matchConfig.mode === 'extraction') {
          teamScoreRed++;
          pushKillFeed('YOU WERE ELIMINATED! RED TEAM SCORES');
          checkMatchOutcome();
        } else if (matchConfig.mode === 'zombie') {
          pushKillFeed('YOU HAVE BEEN OVERWHELMED BY THE HORDE!');
          triggerGameOver(false);
        } else if (false) {
          pushKillFeed('YOU WERE ELIMINATED!');
          triggerGameOver(false);
        } else {
          if (attackerBot) {
            attackerBot.kills = (attackerBot.kills || 0) + 1;
            pushKillFeed(\`YOU WERE ELIMINATED BY BOT #\${attackerBot.id}! (\${attackerBot.kills}/\${matchConfig.targetScore})\`);
          } else {
            pushKillFeed('YOU WERE ELIMINATED!');
          }
          checkMatchOutcome();
          if (player.health <= 0 && gameStateRef.current === 'playing') {
            triggerGameOver(false);
          }
        }
      }`;

const replacement = `      if (player.health <= 0) {
        player.health = 0;
        player.alive = false;
        AUDIO.arSpray.stop();

        if (matchConfig.mode === 'extraction') {
          pushKillFeed('MISSION FAILED: OPERATOR KILLED');
          triggerGameOver(false);
        } else if (matchConfig.mode === 'zombie') {
          pushKillFeed('YOU HAVE BEEN OVERWHELMED BY THE HORDE!');
          triggerGameOver(false);
        } else {
          if (attackerBot) {
            attackerBot.kills = (attackerBot.kills || 0) + 1;
            pushKillFeed(\`YOU WERE ELIMINATED BY BOT #\${attackerBot.id}! (\${attackerBot.kills}/\${matchConfig.targetScore})\`);
          } else {
            pushKillFeed('YOU WERE ELIMINATED!');
          }
          checkMatchOutcome();
          if (player.health <= 0 && gameStateRef.current === 'playing') {
            triggerGameOver(false);
          }
        }
      }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
