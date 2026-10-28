import * as THREE from 'three';
import type {WeaponAssembly} from './weaponModels';
import type {WeaponMuzzleEffect} from './weaponEffects';
export function createPlasmaMuzzleEffect(a:WeaponAssembly):WeaponMuzzleEffect{
 const root=new THREE.Group();root.name='MuzzleFX_laser';a.root.add(root);
 const position=a.muzzle.getWorldPosition(new THREE.Vector3());a.root.worldToLocal(position);
 const material=new THREE.MeshBasicMaterial({color:0xbaffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.024,8,5),material);flash.position.copy(position);root.add(flash);
 const light=new THREE.PointLight(0x61dbe8,0,.5);light.position.copy(position);root.add(light);
 let age=1,disposed=false,fresh=false;
 const reset=()=>{age=1;fresh=false;flash.visible=false;light.intensity=0;};root.userData.cleanupWeaponEffect=()=>{disposed=true;reset();};reset();
 return {root,reset,trigger(){if(disposed)return;age=0;fresh=true;flash.visible=true;},update(dt){if(fresh){age=0;fresh=false;}else age+=dt;const p=Math.max(0,1-age/.035);material.opacity=p*.8;flash.scale.set(1,.8,1.2+p*.4);flash.visible=p>0;light.intensity=p*.6;}};
}
