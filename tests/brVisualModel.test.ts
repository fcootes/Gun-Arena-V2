import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWeaponAssembly,disposeWeaponObject} from '../src/weaponModels';
const expected:Record<string,number[]>={receiver:[0,0,0],stock:[0,0,.25],optic:[0,.07,0],bolt:[-.045,.048,-.025],magazine:[0,-.065,.21]};
for(const firstPerson of [false,true]){
 const assembly=createWeaponAssembly('br',{firstPerson});assembly.root.updateMatrixWorld(true);
 for(const [name,position]of Object.entries(expected)){assert.deepEqual(assembly.parts[name].position.toArray(),position,name+' protected position');assert.deepEqual(assembly.parts[name].quaternion.toArray(),[0,0,0,1],name+' protected orientation');}
 assert.ok(assembly.muzzle.position.distanceTo(new THREE.Vector3(0,.015,-.605))<1e-12);
 // A conservative full magazine volume swept along the protected extraction
 // axis must not hit any fixed receiver, lip, stock, optic or grip triangle.
 const swept=new THREE.Box3(new THREE.Vector3(-.0255,-.395,.165),new THREE.Vector3(.0255,-.063,.255));
 const tri=new THREE.Triangle(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const matrix=new THREE.Matrix4(),inverse=assembly.root.matrixWorld.clone().invert();
 const moving=[assembly.parts.magazine,assembly.parts.freshMagazine].filter(Boolean);
 const excluded=(o:THREE.Object3D)=>{for(let p:THREE.Object3D|null=o;p;p=p.parent)if(moving.includes(p))return true;return false;};
 let checked=0;
 assembly.root.traverse(o=>{
  if(!(o instanceof THREE.Mesh)||excluded(o))return;
  const g=o.geometry,positions=g.attributes.position,index=g.index;
  matrix.multiplyMatrices(inverse,o.matrixWorld);
  const count=index?.count??positions.count;
  for(let i=0;i<count;i+=3){
   a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(matrix);
   b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(matrix);
   c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(matrix);
   tri.set(a,b,c);assert.equal(tri.intersectsBox(swept),false,'Fixed BR geometry blocks the real magazine extraction corridor');checked++;
  }
 });
 assert.ok(checked>1000);
 const stockBounds=new THREE.Box3().setFromObject(assembly.parts.stock);
 assert.ok(stockBounds.max.z>.50 && stockBounds.max.z-stockBounds.min.z>.24,
   'Structural stock must extend meaningfully behind the protected magazine');
 assert.ok(stockBounds.max.y<.08 && stockBounds.min.y>-.08,
   'Extended shoulder housing stays compact in height');
 const widthAt=(z:number)=>{
   const hits=new THREE.Raycaster(new THREE.Vector3(.15,0,z),new THREE.Vector3(-1,0,0))
     .intersectObject(assembly.root,true);
   assert.ok(hits.length>0,'Chassis has an actual side surface at '+z);
   return hits[0].point.x;
 };
 assert.ok(widthAt(-.45)<widthAt(-.20),'Fore-end has a real transverse taper');
 assert.ok(widthAt(.48)<widthAt(.32),'Shoulder housing tapers towards the butt');
 assembly.root.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   for(const value of o.geometry.attributes.normal.array)assert.ok(Number.isFinite(value));
 });

 disposeWeaponObject(assembly.root);
}
console.log('PASS: FP/actor functional anchor positions/orientations and fixed-triangle clearance along the entire rear magazine extraction path; extended stock envelope, real transverse hull tapers and finite normals');
