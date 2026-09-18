const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(/useState<'ffa' \| 'team' \| 'zombie' \| 'escort'>\('ffa'\)/g, "useState<GameMode>('EXTRACTION')");
// Replace other string mode checks
code = code.replace(/matchMode === 'team' \|\| matchMode === 'zombie' \|\| matchMode === 'escort'/g, "matchMode === 'EXTRACTION' || matchMode === 'WAVE_SURVIVAL'");
code = code.replace(/matchMode === 'team'/g, "matchMode === 'EXTRACTION'");
code = code.replace(/matchMode === 'zombie'/g, "matchMode === 'WAVE_SURVIVAL'");
code = code.replace(/matchMode === 'ffa'/g, "false");
code = code.replace(/matchMode === 'escort'/g, "false");

code = code.replace(/matchConfig\.mode === 'team' \|\| matchConfig\.mode === 'zombie' \|\| matchConfig\.mode === 'escort'/g, "matchConfig.mode === 'EXTRACTION' || matchConfig.mode === 'WAVE_SURVIVAL'");
code = code.replace(/matchConfig\.mode === 'team'/g, "matchConfig.mode === 'EXTRACTION'");
code = code.replace(/matchConfig\.mode === 'zombie'/g, "matchConfig.mode === 'WAVE_SURVIVAL'");
code = code.replace(/matchConfig\.mode === 'ffa'/g, "false");
code = code.replace(/matchConfig\.mode === 'escort'/g, "false");

code = code.replace(/matchModeRef\.current === 'zombie'/g, "matchModeRef.current === 'WAVE_SURVIVAL'");
code = code.replace(/matchModeRef\.current === 'team'/g, "matchModeRef.current === 'EXTRACTION'");

fs.writeFileSync('src/App.tsx', code);
