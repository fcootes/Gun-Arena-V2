const fs = require('fs');
let code = fs.readFileSync('src/LobbyTerminal.tsx', 'utf-8');

// Replace GameMode props
code = code.replace(/matchMode: 'ffa' \| 'team' \| 'zombie' \| 'escort';/g, "matchMode: GameMode;");
code = code.replace(/setMatchMode: \(m: 'ffa' \| 'team' \| 'zombie' \| 'escort'\) => void;/g, "setMatchMode: (m: GameMode) => void;");

// Fix initial matchMode in App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');
appCode = appCode.replace(/useState<'ffa' \| 'team' \| 'zombie' \| 'escort'>\('ffa'\)/g, "useState<GameMode>('EXTRACTION')");

fs.writeFileSync('src/LobbyTerminal.tsx', code);
fs.writeFileSync('src/App.tsx', appCode);
