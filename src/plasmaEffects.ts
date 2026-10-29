import * as THREE from 'three';
import type {WeaponAssembly} from './weaponModels';
import type {WeaponMuzzleEffect} from './weaponEffects';
/** One directional flash and pressure ring, reused by every successful shot. */
export function createPlasmaMuzzleEffect(a:WeaponAssembly):WeaponMuzzleEffect{
 const root=new THREE.Group();root.name='MuzzleFX_laser';a.muzzle.add(root);
 const material=new THREE.MeshBasicMaterial({color:0xc3faff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
 const geometry=new THREE.ConeGeometry(.028,.130,8,1,true).rotateX(-Math.PI/2).translate(0,0,-.057);
 const flash=new THREE.Mesh(geometry,material);root.add(flash);
 const ringMaterial=new THREE.MeshBasicMaterial({color:0x69d9ec,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
 const ring=new THREE.Mesh(new THREE.RingGeometry(.018,.024,14),ringMaterial);ring.position.z=-.008;root.add(ring);
 const light=new THREE.PointLight(0x61dbe8,0,.55);root.add(light);
 let age=1,disposed=false,fresh=false;
 const reset=()=>{age=1;fresh=false;flash.visible=ring.visible=false;light.intensity=0;a.plasmaRecoil?.reset();};root.userData.cleanupWeaponEffect=()=>{disposed=true;reset();};reset();
 return {root,reset,trigger(){if(disposed)return;age=0;fresh=true;flash.visible=ring.visible=true;a.plasmaRecoil?.impulse();},update(dt){
  if(fresh){age=0;fresh=false;}else age+=dt;
  const p=Math.max(0,1-age/.045),wave=Math.max(0,1-age/.065);
  material.opacity=p*.92;flash.scale.set(.78+.36*p,.78+.36*p,.75+.45*p);flash.visible=p>0;
  ringMaterial.opacity=wave*.27;ring.scale.setScalar(1+Math.min(age,.065)*12);ring.visible=wave>0;light.intensity=p*.85;
 }};
}
