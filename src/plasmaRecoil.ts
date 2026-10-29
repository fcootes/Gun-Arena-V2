import * as THREE from 'three';
/** Presentation only: no camera, aim, spread, projectile or gameplay state. */
export const PLASMA_RECOIL=Object.freeze({frequency:42,damping:.72,rearwardVelocity:2.35,pitchVelocity:4.2,lateralVelocity:.16,rollVelocity:.54,adsScale:.62});
export function createPlasmaRecoil(){
 const position=new THREE.Vector3(),rotation=new THREE.Vector3(),linearVelocity=new THREE.Vector3(),angularVelocity=new THREE.Vector3();
 const omega=PLASMA_RECOIL.frequency,a=omega*PLASMA_RECOIL.damping,b=omega*Math.sqrt(1-PLASMA_RECOIL.damping**2);
 const pivot=new THREE.Vector3(.038,-.10,.100),before=new THREE.Vector3(),after=new THREE.Vector3(),offset=new THREE.Vector3(),q=new THREE.Quaternion(),euler=new THREE.Euler();
 let serial=0;
 function reset(){position.set(0,0,0);rotation.set(0,0,0);linearVelocity.set(0,0,0);angularVelocity.set(0,0,0);serial=0;}
 function impulse(){const side=(serial++%2)*2-1;linearVelocity.z=Math.min(5,linearVelocity.z+PLASMA_RECOIL.rearwardVelocity);linearVelocity.x+=side*PLASMA_RECOIL.lateralVelocity;angularVelocity.x=Math.min(9,angularVelocity.x+PLASMA_RECOIL.pitchVelocity);angularVelocity.y+=side*.18;angularVelocity.z+=side*PLASMA_RECOIL.rollVelocity;}
 /** Exact underdamped solution, stable across 30/60/144 Hz and stalls. */
 function advance(dt:number){
  if(!Number.isFinite(dt)||dt<=0)return;
  const decay=Math.exp(-a*dt),c=Math.cos(b*dt),s=Math.sin(b*dt);
  integrate(position,linearVelocity,decay,c,s);integrate(rotation,angularVelocity,decay,c,s);
 }
 function integrate(x:THREE.Vector3,v:THREE.Vector3,decay:number,c:number,s:number){
  for(let i=0;i<3;i++){const initial=x.getComponent(i),velocity=v.getComponent(i),k=(velocity+a*initial)/b;
   x.setComponent(i,decay*(initial*c+k*s));v.setComponent(i,decay*(velocity*c-(a*velocity+omega*omega*initial)/b*s));}
 }
 /** Caller restores its base pose before each application; grip owns angular pivot. */
 function apply(root:THREE.Object3D,scale=1){
  before.copy(pivot).applyQuaternion(root.quaternion).add(root.position);
  q.setFromEuler(euler.set(rotation.x*scale,rotation.y*scale,rotation.z*scale));root.quaternion.multiply(q);
  after.copy(pivot).applyQuaternion(root.quaternion).add(root.position);root.position.add(before.sub(after));
  offset.copy(position).multiplyScalar(scale).applyQuaternion(root.quaternion);root.position.add(offset);
 }
 return {position,rotation,impulse,advance,apply,reset};
}
export type PlasmaRecoil=ReturnType<typeof createPlasmaRecoil>;
