const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const startIdx = code.indexOf("if (e.code === 'KeyZ') {");
const endIdx = code.indexOf("if (e.code === 'KeyE') {");

if (startIdx !== -1 && endIdx !== -1) {
  const newKeys = `      if (e.code === 'KeyZ') {
        // Toggle Follow / Hold
        if (matchConfig.mode === 'EXTRACTION' || matchConfig.mode === 'WAVE_SURVIVAL') {
          const nextDirective = squadDirectiveRef.current === 'follow_lead' ? 'hold_position' : 'follow_lead';
          squadDirectiveRef.current = nextDirective;
          setSquadDirective(nextDirective);
          setSquadDirectiveBanner({
            directive: nextDirective,
            text: nextDirective === 'follow_lead' ? 'FOLLOW LEAD' : 'HOLD POSITION',
            sub: nextDirective === 'follow_lead' ? 'TETHER ACTIVE' : 'DEFENDING LOCAL NODE',
            timer: 2.8
          });
        }
      }
      if (e.code === 'KeyC') {
        // Push Objective
        if (matchConfig.mode === 'EXTRACTION' || matchConfig.mode === 'WAVE_SURVIVAL') {
          const nextDirective = 'push_objective';
          squadDirectiveRef.current = nextDirective;
          setSquadDirective(nextDirective);
          setSquadDirectiveBanner({
            directive: nextDirective,
            text: 'PUSH OBJECTIVE',
            sub: 'ADVANCING TO NEXT SECTOR',
            timer: 2.8
          });
        }
      }
      // Target Selection Phase (X Key)
      if (e.code === 'KeyX') {
        if (targetingPhaseRef.current) {
           targetingPhaseRef.current = false;
           setTargetingPhase(false);
        } else {
           targetingPhaseRef.current = true;
           setTargetingPhase(true);
        }
      }
      `;
  code = code.substring(0, startIdx) + newKeys + code.substring(endIdx);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Keys updated successfully.');
} else {
  console.log('Could not find start or end indices.');
}
