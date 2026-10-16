// node --import tsx scripts/compare-viewmodel-preserved.mjs /path/to/baseline
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const before = resolve(process.argv[2]), after = resolve('.');
async function sample(root) {
  const {WEAPONS, createViewmodelManager} = await import(pathToFileURL(resolve(root, 'src/weapons.ts')));
  const {createWeaponAssembly,disposeWeaponObject}=await import(pathToFileURL(resolve(root,'src/weaponModels.ts')));
  const {beginWeaponReload, advanceWeaponReload} = await import(pathToFileURL(resolve(root, 'src/weaponReload.ts')));
  const results = {};
  for (const w of WEAPONS.filter(w => w.type === 'weapon' && (process.env.EXCLUDE_SHOTGUN !== '1' || w.id !== 'shotgun'))) {
    const hash = createHash('sha256'), vm = createViewmodelManager(); vm.prepare([w.id]);
    function geometry(object) {
      object.traverse(o=>{
        if(o.geometry){
          for(const [name,attr] of Object.entries(o.geometry.attributes)){hash.update(name);hash.update(Buffer.from(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength));}
          if(o.geometry.index)hash.update(Buffer.from(o.geometry.index.array.buffer));
        }
        for(const mat of o.material?Array.isArray(o.material)?o.material:[o.material]:[])
          hash.update(JSON.stringify([mat.type,mat.color?.getHex(),mat.roughness,mat.metalness,mat.bumpScale]));
      });
    }
    geometry(vm.root);
    const bare=createWeaponAssembly(w.id);geometry(bare.root);disposeWeaponObject(bare.root);
    function capture() {
      vm.root.traverse(o => {
        hash.update(JSON.stringify([o.name, o.position.toArray(), o.quaternion.toArray(), o.scale.toArray(), o.visible]));
        if (o.instanceMatrix) hash.update(Buffer.from(o.instanceMatrix.array.buffer));
      });
    }
    for (const [aim, sprint] of (process.env.COMPARE_SPRINT === '1' ? [[false,false],[true,false],[false,true]] : [[false,false],[true,false]])) {
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
assert.deepEqual(current, baseline, 'Every other weapon keeps identical FP/actor geometry and materials, frame transforms, hand palettes and reload state');
console.log(JSON.stringify({baselineRoot:before,includeSprint:process.env.COMPARE_SPRINT==='1',excludeShotgun:process.env.EXCLUDE_SHOTGUN==='1',before:baseline,after:current,passed:true},null,2));
