const fs = require('fs');
let code = fs.readFileSync('src/world.ts', 'utf-8');

// The file looks like:
// [0 ... startIdx] (Original up to "  } else {")
// [startIdx ... startIdx + newMap.length] (The new map injected)
// [startIdx + newMap.length ... end] (Original from "  return {" at line 43)

const startStr = "  } else {";
const startIdx = code.indexOf(startStr);

// Find where the new map ends and the duplicated line 43 begins
const duplicateStart = code.indexOf("  return {", startIdx); 

// The duplicated string from duplicateStart is the original file from line 43 onwards.
// We want to reconstruct the original file.
const originalLine43Onwards = code.substring(duplicateStart);

// We need the original file from line 0 to line 43
const originalLine0To43 = code.substring(0, code.indexOf("  return {"));

const originalFile = originalLine0To43 + originalLine43Onwards;

fs.writeFileSync('src/world.ts.restored', originalFile);
