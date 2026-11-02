// node --import tsx scripts/compare-minigun-geometry.mjs /path/to/previous-head
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

async function sample(root,firstPerson){
 const {createWeaponAssembly,disposeWeaponObject}=await import(pathToFileURL(resolve(root,'src/weaponModels.ts')));
 const assembly=createWeaponAssembly('minigun',{firstPerson});assembly.root.updateMatrixWorld(true);
 const hash=createHash('sha256');let draws=0;
 assembly.root.traverse(object=>{
  // New first-person clothing is the only added drawable; every actual gun
  // buffer, texture, material and transform must match the accepted branch head.
  if(!object.geometry||object.parent?.name==='minigunleftUpperArm'||object.parent?.name==='minigunrightUpperArm')return;
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
 disposeWeaponObject(assembly.root);return{sha256:hash.digest('hex'),draws};
}
const baseline=resolve(process.argv[2]),current=resolve('.'),results=[];
for(const firstPerson of [false,true]){
 const before=await sample(baseline,firstPerson),after=await sample(current,firstPerson);
 assert.deepEqual(after,before,'Accepted Minigun gun/rotor/control/cradle buffers/materials/transforms are unchanged');
 results.push({firstPerson,before,after,passed:true});
}
console.log(JSON.stringify({baselineRoot:baseline,exclusion:'Only two new first-person upper-sleeve clothing meshes',results},null,2));
