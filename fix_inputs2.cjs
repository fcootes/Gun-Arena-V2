const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const startIdx = code.indexOf("if (e.code === 'KeyZ') {");
const endIdx = code.indexOf("if (e.code === 'Digit1') switchSlot(0);");

if (startIdx !== -1 && endIdx !== -1) {
  const newKeys = `
      // Squad Controls
      if (e.code === 'KeyZ') {
        const nextDirective = squadDirectiveRef.current === 'follow_lead' ? 'hold_position' : 'follow_lead';
        squadDirectiveRef.current = nextDirective;
        setSquadDirective(nextDirective);
        setSquadDirectiveBanner({
          directive: nextDirective,
          text: nextDirective === 'follow_lead' ? 'FOLLOW LEAD' : 'HOLD POSITION',
          sub: nextDirective === 'follow_lead' ? 'TETHER ACTIVE' : 'DEFENDING LOCAL NODE',
          timer: 2.8
        });
        AUDIO.sniperReload.play(0.65);
      }
      
      if (e.code === 'KeyX') {
        // Toggle targeting phase
        if (targetingPhaseRef.current) {
           targetingPhaseRef.current = false;
           setTargetingPhase(false);
        } else {
           targetingPhaseRef.current = true;
           setTargetingPhase(true);
        }
      }
      
      if (e.code === 'KeyC') {
        const nextDirective = 'push_objective';
        squadDirectiveRef.current = nextDirective;
        setSquadDirective(nextDirective);
        setSquadDirectiveBanner({
          directive: nextDirective,
          text: 'PUSH OBJECTIVE',
          sub: 'ADVANCING TO NEXT SECTOR',
          timer: 2.8
        });
        AUDIO.sniperReload.play(0.65);
      }

      // Melee (Moved from Z/F to V/E)
      if (e.code === 'KeyV' || e.code === 'KeyE') {
        if (!player.isMeleeing && player.alive) {
          player.isMeleeing = true;
          player.meleeTimer = 0.38;
          playKnifeSlashWhoosh();
          vmManager.triggerKnifeSlash();
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
          raycaster.far = 3.2;
          const hits = raycaster.intersectObjects(world.hittableObjects, false);
          if (hits.length > 0) {
            const hit = hits[0];
            const ud = hit.object.userData;
            spawnImpactSpark(hit.point, ud.type === 'botpart');
            if (ud.type === 'botpart' && ud.ref) {
              const bot = ud.ref;
              if (matchConfig.mode === 'EXTRACTION' && bot.team === player.team) return;
              if (matchConfig.mode === 'WAVE_SURVIVAL' && bot.team === 'blue') return;
              damageBot(bot, 65, false, 'player', raycaster.ray.direction);
              flashHit(bot);
              showHitmarker(false);
              showBloodSplatter();
              recoilKick += 0.04;
              recoilPitch += 0.02;
              AUDIO.bulletHit.play(1.0);
              if (bot.isZombie) addPoints(25);
            }
          }
        }
      }
      `;
  code = code.substring(0, startIdx) + newKeys + code.substring(endIdx);
  
  // Also add state for targeting phase
  if (!code.includes('const [targetingPhase, setTargetingPhase]')) {
    const stateHook = `const [targetingPhase, setTargetingPhase] = useState(false);
  const targetingPhaseRef = useRef(false);`;
    code = code.replace(/const \[squadDirectiveBanner, setSquadDirectiveBanner\] = useState<any>\(null\);/, 
    "const [squadDirectiveBanner, setSquadDirectiveBanner] = useState<any>(null);\n  " + stateHook);
  }
  
  // Add key 4 for medkit
  code = code.replace(/if \(e\.code === 'Digit1'\) switchSlot\(0\);[^\n]*\n[^\n]*Digit2[^\n]*\n[^\n]*Digit3[^\n]*\n/g, 
  "if (e.code === 'Digit1') switchSlot(0);\n      if (e.code === 'Digit2') switchSlot(1);\n      if (e.code === 'Digit3') switchSlot(2);\n      if (e.code === 'Digit4') activateMedkit();\n");

  fs.writeFileSync('src/App.tsx', code);
  console.log('Inputs updated successfully.');
} else {
  console.log('Could not find start or end indices.');
}
