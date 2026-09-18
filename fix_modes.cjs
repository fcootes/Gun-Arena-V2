const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix checkMatchOutcome
const oldCheckOutcome = `    function checkMatchOutcome() {
      if (matchConfig.mode === 'zombie') {
        if (zombiesRemaining <= 0 && !waveIntermission && !extractionPhase) {
          if (currentWave >= 3) {
            // Trigger Extraction
            extractionPhase = true;
            if (factionAlignmentRef.current === 'apex') {
              extractionState = 'mainframe_search';
              pushKillFeed('HQ: MAINFRAME LOCATED. INITIATE DATA HEIST.', true);
            } else {
              extractionState = 'cryo_search';
              pushKillFeed('COMMAND: CRYO-POD DETECTED. SECURE THE ASSET.', true);
            }
            
            // Spawn target at a random spot
            const geo = new THREE.BoxGeometry(1.5, 2.5, 1.5);
            const mat = new THREE.MeshStandardMaterial({ color: factionAlignmentRef.current === 'apex' ? 0xff0000 : 0x00aaff, emissive: factionAlignmentRef.current === 'apex' ? 0x440000 : 0x004488 });
            extractionTargetObj = new THREE.Mesh(geo, mat);
            extractionTargetObj.position.set((Math.random() - 0.5) * 40, 1.25, (Math.random() - 0.5) * 40);
            scene.add(extractionTargetObj);
            
            // Add a point light to make it visible
            const light = new THREE.PointLight(factionAlignmentRef.current === 'apex' ? 0xff0000 : 0x00aaff, 2, 10);
            light.position.set(0, 2, 0);
            extractionTargetObj.add(light);
            
            addPoints(500);
          } else {
            waveIntermission = true;
            intermissionTimer = 5.0;
            addPoints(250);
          }
        }
      } else if (matchConfig.mode === 'extraction') {
        if (teamScoreBlue >= matchConfig.targetScore) triggerGameOver(true);
        else if (teamScoreRed >= matchConfig.targetScore) triggerGameOver(false);
      } else if (false) {
        const vip = bots.find(b => b.isVIP);
        if (!vip || !vip.alive) {
           triggerGameOver(false); // VIP killed
        }
      } else {
        if (player.kills >= matchConfig.targetScore) {
          triggerGameOver(true);
          return;
        }
        for (const b of bots) {
          if (b.kills >= matchConfig.targetScore) {
            triggerGameOver(false, b);
            return;
          }
        }
      }
    }`;

const newCheckOutcome = `    function checkMatchOutcome() {
      if (matchConfig.mode === 'zombie') {
        if (zombiesRemaining <= 0 && !waveIntermission) {
           waveIntermission = true;
           intermissionTimer = 5.0;
           addPoints(250);
        }
      } else if (matchConfig.mode === 'extraction') {
        // Extraction is linear; game over triggers when boss is killed or player dies
      } else if (matchConfig.mode === 'team') {
        if (teamScoreBlue >= matchConfig.targetScore) triggerGameOver(true);
        else if (teamScoreRed >= matchConfig.targetScore) triggerGameOver(false);
      } else if (matchConfig.mode === 'ffa') {
        if (player.kills >= matchConfig.targetScore) {
          triggerGameOver(true);
          return;
        }
        for (const b of bots) {
          if (b.kills >= matchConfig.targetScore) {
            triggerGameOver(false, b);
            return;
          }
        }
      }
    }`;

code = code.replace(oldCheckOutcome, newCheckOutcome);

// TDM / FFA Score strings
const oldSubText = `      if (matchConfig.mode === 'zombie') {
        subText = \`OVERWHELMED ON WAVE \${currentWave}\`;
      } else if (matchConfig.mode === 'extraction') {
        const allyLabel = matchConfig.faction === 'usmc' ? 'USMC COALITION' : 'APEX MERCENARIES';
        const opLabel = matchConfig.faction === 'usmc' ? 'APEX MERCENARIES' : 'USMC COALITION';
        subText = victory ? \`\${allyLabel} HIT TARGET SCORE FIRST\` : \`\${opLabel} OUTPERFORMED YOUR SQUAD\`;
      } else {
        if (victory) subText = 'YOU REACHED THE TARGET SCORE FIRST';
        else if (winningBot) subText = \`BOT #\${winningBot.id} REACHED \${matchConfig.targetScore} KILLS FIRST\`;
        else subText = 'ZONE / OPPONENT ELIMINATED YOU';
      }`;

const newSubText = `      if (matchConfig.mode === 'zombie') {
        subText = \`OVERWHELMED ON WAVE \${currentWave}\`;
      } else if (matchConfig.mode === 'team') {
        const allyLabel = matchConfig.faction === 'usmc' ? 'USMC COALITION' : 'APEX MERCENARIES';
        const opLabel = matchConfig.faction === 'usmc' ? 'APEX MERCENARIES' : 'USMC COALITION';
        subText = victory ? \`\${allyLabel} HIT TARGET SCORE FIRST\` : \`\${opLabel} OUTPERFORMED YOUR SQUAD\`;
      } else if (matchConfig.mode === 'extraction') {
        subText = victory ? 'SUCCESSFUL EXTRACTION' : 'MISSION FAILED';
      } else {
        if (victory) subText = 'YOU REACHED THE TARGET SCORE FIRST';
        else if (winningBot) subText = \`BOT #\${winningBot.id} REACHED \${matchConfig.targetScore} KILLS FIRST\`;
        else subText = 'ZONE / OPPONENT ELIMINATED YOU';
      }`;
code = code.replace(oldSubText, newSubText);

fs.writeFileSync('src/App.tsx', code);
