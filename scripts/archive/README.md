# Historical source patch scripts

These scripts are retained as history, not supported development commands. Do not
run them against the current engine. They mutate or reconstruct old source layouts.

- `rewrite_world.cjs` and `rewrite_world_safe.cjs` target `const labAmbient = new
  THREE.AmbientLight(0x283442, 1.3);`, old Sector 4 walls and the old boss pit;
  none of those authored source anchors exists in current world.ts.
- `fix_restore.cjs` reconstructs a formerly duplicated world file using the first
  textual `else` and `return` positions. Current world.ts has separate complete
  Training/Offshore/facility builders and that duplication does not exist.

The other 43 root scripts remain untouched pending individual anchor review.
None is referenced by npm scripts or the runtime import graph. This archive keeps
content byte-for-byte; git history retains original paths.
