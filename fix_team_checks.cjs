const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex1 = /if \(matchConfig\.mode === 'extraction' && bot\.team === ownerTeam\) continue;\n\s*if \(matchConfig\.mode === 'zombie' && bot\.team === 'blue' && ownerTeam === 'blue'\) continue;/g;
code = code.replace(regex1, "if (bot.team === ownerTeam) continue;");

const regex2 = /if \(matchConfig\.mode === 'extraction' && bot\.team === player\.team\) continue;\n\s*if \(matchConfig\.mode === 'zombie' && bot\.team === 'blue'\) continue;/g;
code = code.replace(regex2, "if (bot.team === player.team) continue;");

const regex3 = /if \(matchConfig\.mode === 'extraction' && bot\.team === player\.team\) return;\n\s*if \(matchConfig\.mode === 'zombie' && bot\.team === 'blue'\) return;/g;
code = code.replace(regex3, "if (bot.team === player.team) return;");

const regex4 = /if \(!\(matchConfig\.mode === 'extraction' && bot\.team === player\.team\) &&\n\s*!\(matchConfig\.mode === 'zombie' && bot\.team === 'blue'\)\) {/g;
code = code.replace(regex4, "if (bot.team !== player.team) {");

fs.writeFileSync('src/App.tsx', code);
