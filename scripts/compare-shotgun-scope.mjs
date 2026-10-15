// node --import tsx scripts/compare-shotgun-scope.mjs /tmp/shotgun-before
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const before = resolve(process.argv[2]), after = resolve('.');
async function sample(root) {
  const {WEAPONS, createViewmodelManager} = await import(pathToFileURL(resolve(root, 'src/weapons.ts')));
  const {beginWeaponReload, advanceWeaponReload} = await import(pathToFileURL(resolve(root, 'src/weaponReload.ts')));
  const results = {};
  for (const w of WEAPONS.filter(w => w.type === 'weapon' && w.id !== 'shotgun')) {
    const hash = createHash('sha256'), vm = createViewmodelManager(); vm.prepare([w.id]);
    function capture() {
      vm.root.traverse(o => {
        hash.update(JSON.stringify([o.name, o.position.toArray(), o.quaternion.toArray(), o.scale.toArray(), o.visible]));
        if (o.instanceMatrix) hash.update(Buffer.from(o.instanceMatrix.array.buffer));
      });
    }
    for (const [aim, sprint] of [[false,false],[true,false],[false,true]]) {
      vm.resetEffects();
      for (let i=0;i<60;i++) { vm.update(1/60,w,{},aim,sprint,true,sprint,false,false,0,true,true); capture(); }
    }
    for (const ammo of [0,2]) {
      vm.resetEffects(); const ws = {ammo, reserve:100, heat:80}; beginWeaponReload(w,ws);
      while(ws.reloading) { advanceWeaponReload(w,ws,1/60); vm.update(1/60,w,ws,false,false,true,false,false,false,0,true,true); hash.update(JSON.stringify(ws)); capture(); }
    }
    results[w.id] = hash.digest('hex'); vm.dispose();
  }
  return results;
}
const baseline = await sample(before), current = await sample(after);
assert.deepEqual(current, baseline, 'Every other weapon keeps identical frame-by-frame transforms, hand palettes and reload state');
console.log(JSON.stringify({baselineCommit:'3778c568db1162d40822676d5d31ffc385b0681a',before:baseline,after:current,passed:true},null,2));
