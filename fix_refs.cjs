const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `  const [squadDirectiveBanner, setSquadDirectiveBanner] = useState<{
    directive: SquadDirective;
    text: string;
    sub: string;
    timer: number;
  } | null>(null);`;

const newRefs = targetStr + `\n
  const [targetingPhase, setTargetingPhase] = useState(false);
  const targetingPhaseRef = useRef(false);
  targetingPhaseRef.current = targetingPhase;
`;

code = code.replace(targetStr, newRefs);
fs.writeFileSync('src/App.tsx', code);
