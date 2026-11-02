// node --import tsx scripts/compare-minigun-geometry.mjs /path/to/previous-head
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
const handleRevision=process.env.MINIGUN_HANDLE_REVISION==='1';

async function sample(root,firstPerson){
 const {createWeaponAssembly,disposeWeaponObject}=await import(pathToFileURL(resolve(root,'src/weaponModels.ts')));
 const assembly=createWeaponAssembly('minigun',{firstPerson});assembly.root.updateMatrixWorld(true);
 const hash=createHash('sha256');let draws=0;
 assembly.root.traverse(object=>{
  // New first-person clothing is the only added drawable; every actual gun
  // buffer, texture, material and transform must match the accepted branch head.
  if(!object.geometry||object.parent?.name==='minigunleftUpperArm'||object.parent?.name==='minigunrightUpperArm')return;
  if(firstPerson&&handleRevision){let parent=object,rotor=false;while(parent){if(parent===assembly.parts.rotor)rotor=true;parent=parent.parent;}if(!rotor)return;}
  draws++;hash.update(JSON.stringify(object.matrixWorld.toArray()));
  for(const [name,attribute]of Object.entries(object.geometry.attributes)){
   hash.update(name);hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  }
  if(object.geometry.index)hash.update(Buffer.from(object.geometry.index.array.buffer));
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   hash.update(JSON.stringify([material.type,material.color?.getHex(),material.roughness,material.metalness,material.bumpScale]));
   for(const name of ['map','bumpMap','roughnessMap'])if(material[name]?.image?.data)hash.update(Buffer.from(material[name].image.data));
  }
 });
 hash.update(JSON.stringify([assembly.muzzle.position.toArray(),assembly.backblast.position.toArray()]));
 disposeWeaponObject(assembly.root);return{sha256:hash.digest('hex'),draws};
}
const baseline=resolve(process.argv[2]),current=resolve('.'),results=[];
for(const firstPerson of [false,true]){
 const before=await sample(baseline,firstPerson),after=await sample(current,firstPerson);
 assert.deepEqual(after,before,'Accepted Minigun gun/rotor/control/cradle buffers/materials/transforms are unchanged');
 results.push({firstPerson,before,after,passed:true});
}
const sharedCore=[];
if(handleRevision)for(const section of ['rotaryCore','feedChute']){
 const digest=root=>{const source=readFileSync(resolve(root,'src/weaponModels.ts'),'utf8'),start=source.indexOf("} else if (id === 'minigun')"),block=source.slice(start,source.indexOf("} else if (id === 'railgun')",start));const code=section==='rotaryCore'?block.slice(block.indexOf("tube('Electric drive motor'"),block.indexOf('if (options.firstPerson)')):block.slice(block.indexOf('const belt ='),block.indexOf("box('Top mechanical sight'")).replace(/^.*box\('Carry bracket'.*\n/gm,'');return createHash('sha256').update(code).digest('hex');};
 const before=digest(baseline),after=digest(current);assert.equal(after,before,'Shared fixed motor/barrel/feed construction is unchanged');sharedCore.push({section,before,after,passed:true});
}
console.log(JSON.stringify({baselineRoot:baseline,exclusion:handleRevision?'Authorized first-person handles/mounts and clothing: compare whole bare model, actual first-person rotor/muzzle, and unchanged shared motor/barrel/feed construction':'Only two new first-person upper-sleeve clothing meshes',results,sharedCore},null,2));
