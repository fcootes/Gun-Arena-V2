import * as THREE from 'three';
import type {WeaponAssembly} from './weaponModels';
import type {WeaponMuzzleEffect} from './weaponEffects';
/** Compact kinetic contact flash and six bounded particles. No shock ring,
 * cone, lightning ribbon, texture dependency, or resource allocation on fire. */
export function createRailgunMuzzleEffect(assembly:WeaponAssembly):WeaponMuzzleEffect {
 const root=new THREE.Group();root.name='MuzzleFX_railgun';assembly.root.add(root);
 const origin=new THREE.Vector3();assembly.root.updateMatrixWorld(true);assembly.muzzle.getWorldPosition(origin);assembly.root.worldToLocal(origin);
 const flashMaterial=new THREE.MeshBasicMaterial({color:0xe5f8ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.020,10,6),flashMaterial);flash.name='Kinetic muzzle contact';flash.position.copy(origin);root.add(flash);
 const light=new THREE.PointLight(0xc3eaff,0,.70,2);light.position.copy(origin);root.add(light);
 const capacity=32,positions=new Float32Array(capacity*3),colors=new Float32Array(capacity*3),sizes=new Float32Array(capacity),alphas=new Float32Array(capacity),velocity=new Float32Array(capacity*3),life=new Float32Array(capacity),maximum=new Float32Array(capacity);
 const geometry=new THREE.BufferGeometry();
 for(const[name,array,size]of[['position',positions,3],['color',colors,3],['size',sizes,1],['alpha',alphas,1]]as const)geometry.setAttribute(name,new THREE.BufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage));
 const shotAttributes=[geometry.attributes.position,geometry.attributes.color,geometry.attributes.size,geometry.attributes.alpha],movingAttributes=[geometry.attributes.position,geometry.attributes.size,geometry.attributes.alpha];
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,
 vertexShader:'attribute float size;attribute float alpha;varying vec3 c;varying float a;void main(){c=color;a=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*280./max(.1,-p.z),1.,10.);gl_Position=projectionMatrix*p;}',
 fragmentShader:'varying vec3 c;varying float a;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(c,a*pow(max(0.,1.-r*r),2.));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
 const points=new THREE.Points(geometry,material);points.name='Railgun micro sparks and vapour';points.frustumCulled=false;root.add(points);
 let age=1,disabled=false,seed=0;
 function reset(){age=1;life.fill(0);alphas.fill(0);geometry.attributes.alpha.needsUpdate=true;flash.visible=false;light.intensity=0;}
 root.userData.cleanupWeaponEffect=()=>{disabled=true;reset();};reset();
 return{root,reset,trigger(){
  if(disabled)return;age=0;seed++;flash.visible=true;flash.scale.set(1,.8,1.25);flashMaterial.opacity=.95;light.intensity=.9;
  for(let i=0;i<6;i++){
   const k=i*3,spark=i<3,angle=i*2.399963+seed*.7;
   positions[k]=origin.x;positions[k+1]=origin.y;positions[k+2]=origin.z;
   velocity[k]=Math.cos(angle)*(spark?.18:.015);velocity[k+1]=Math.sin(angle)*(spark?.14:.012)+(spark?.02:.035);velocity[k+2]=spark?-.45:-.025;
   maximum[i]=life[i]=spark?.085+i*.012:.36+(i-3)*.035;sizes[i]=spark?.005:.014;alphas[i]=spark?.65:.055;
   colors[k]=spark?1.3:.47;colors[k+1]=spark?1.6:.56;colors[k+2]=spark?1.8:.62;
  }
  for(const attribute of shotAttributes)attribute.needsUpdate=true;
 },update(delta){
  if(disabled)return;const dt=Math.max(0,Math.min(.1,delta));age+=dt;
  const f=Math.max(0,1-age/.04);flash.visible=f>0;flashMaterial.opacity=.95*f*f;flash.scale.set(1,.8,1.25);light.intensity=.9*f*f;
  for(let i=0;i<6;i++){
   if(life[i]<=0)continue;life[i]=Math.max(0,life[i]-dt);const k=i*3;
   positions[k]+=velocity[k]*dt;positions[k+1]+=velocity[k+1]*dt;positions[k+2]+=velocity[k+2]*dt;
   if(i<3)velocity[k+1]-=.3*dt;else sizes[i]+=.025*dt;
   alphas[i]=(i<3?.65:.055)*Math.pow(life[i]/maximum[i],2);
  }
  for(const attribute of movingAttributes)attribute.needsUpdate=true;
 }};
}
