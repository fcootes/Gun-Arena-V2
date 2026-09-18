const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = "zombieTypeOverride: 'walker' | 'runner' | 'tank' | null = null";
const replacement = "zombieTypeOverride: 'walker' | 'runner' | 'tank' | 'brute' | 'banshee' | 'bloater' | 'megaboss' | null = null";

code = code.replace(target, replacement);

const ztype_dec = 'let zType: "walker" | "runner" | "tank" = "walker";';
const ztype_rep = 'let zType: "walker" | "runner" | "tank" | "brute" | "banshee" | "bloater" | "megaboss" = "walker";';
code = code.replace(ztype_dec, ztype_rep);

const types_arr = 'const types: ("walker" | "runner" | "tank")[] = ["walker", "walker", "runner", "walker", "tank"];';
const types_rep = 'const types: ("walker" | "runner" | "tank" | "brute" | "banshee" | "bloater" | "megaboss")[] = ["walker", "walker", "runner", "brute", "banshee", "bloater"];';
code = code.replace(types_arr, types_rep);

fs.writeFileSync('src/App.tsx', code);
