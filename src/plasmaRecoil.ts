import * as THREE from 'three';
/** Plasma only. Physical compression and permanent, mouse-compensable aim are separate. */
export const PLASMA_RECOIL=Object.freeze({frequency:50,damping:1,rearwardVelocity:4.6,pitchVelocity:.65,lateralVelocity:.045,rollVelocity:.12,adsScale:.62,aimPitch:.0045,adsAimScale:.65});
/** Radians, applied once AFTER successful projectile acquisition to the player's pitch.
 * The launched bolt owns its pre-recoil target. No automatic pitch recovery. */
export function plasmaAimPitch(pitch:number,aiming:boolean){
 return THREE.MathUtils.clamp(pitch+PLASMA_RECOIL.aimPitch*(aiming?PLASMA_RECOIL.adsAimScale:1),-Math.PI/2+.02,Math.PI/2-.02);
}
export function createPlasmaRecoil(){
 const position=new THREE.Vector3(),rotation=new THREE.Vector3(),linearVelocity=new THREE.Vector3(),angularVelocity=new THREE.Vector3();
 const omega=PLASMA_RECOIL.frequency;
 const pivot=new THREE.Vector3(.038,-.10,.100),before=new THREE.Vector3(),after=new THREE.Vector3(),offset=new THREE.Vector3(),q=new THREE.Quaternion(),euler=new THREE.Euler();
 let serial=0;
 function reset(){position.set(0,0,0);rotation.set(0,0,0);linearVelocity.set(0,0,0);angularVelocity.set(0,0,0);serial=0;}
 function impulse(){const side=(serial++%2)*2-1;linearVelocity.z=Math.min(6,linearVelocity.z+PLASMA_RECOIL.rearwardVelocity);linearVelocity.x+=side*PLASMA_RECOIL.lateralVelocity;angularVelocity.x=Math.min(1,angularVelocity.x+PLASMA_RECOIL.pitchVelocity);angularVelocity.z+=side*PLASMA_RECOIL.rollVelocity;}
 /** Exact critically damped solution: no overshoot, periodic rocking or dt substeps. */
 function advance(dt:number){
  if(!Number.isFinite(dt)||dt<=0)return;
  const decay=Math.exp(-omega*dt);
  integrate(position,linearVelocity,decay,dt);integrate(rotation,angularVelocity,decay,dt);
 }
 function integrate(x:THREE.Vector3,v:THREE.Vector3,decay:number,dt:number){
  for(let i=0;i<3;i++){const initial=x.getComponent(i),velocity=v.getComponent(i),k=velocity+omega*initial;
   x.setComponent(i,decay*(initial+k*dt));v.setComponent(i,decay*(velocity-omega*k*dt));}
 }
 /** Caller restores its base pose; both articulated hands inherit this grip pivot. */
 function apply(root:THREE.Object3D,scale=1){
  before.copy(pivot).applyQuaternion(root.quaternion).add(root.position);
  q.setFromEuler(euler.set(rotation.x*scale,rotation.y*scale,rotation.z*scale));root.quaternion.multiply(q);
  after.copy(pivot).applyQuaternion(root.quaternion).add(root.position);root.position.add(before.sub(after));
  offset.copy(position).multiplyScalar(scale).applyQuaternion(root.quaternion);root.position.add(offset);
 }
 return {position,rotation,impulse,advance,apply,reset};
}
export type PlasmaRecoil=ReturnType<typeof createPlasmaRecoil>;
