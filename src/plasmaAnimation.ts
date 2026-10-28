import * as THREE from 'three';
import type {WeaponAssembly} from './weaponModels';
import type {WeaponSlotState} from './types';
import {PLASMA,plasmaEase,plasmaActionPhase} from './plasmaMechanics';
export function createPlasmaAnimator(assembly:WeaponAssembly,firstPerson=true){
 const a=assembly.parts,base=new THREE.Vector3().fromArray(PLASMA.cylinder),seat=new THREE.Vector3(),carry=new THREE.Vector3().fromArray(PLASMA.carry),carryQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(...PLASMA.rotation));
 const stow=new THREE.Vector3(-.34,-.32,-.04),align=new THREE.Vector3();
 return(s:WeaponSlotState|null|undefined)=>{
  const b=s?.plasma,q=s?.reloading?s.reloadSequence:undefined,stage=s?plasmaActionPhase(s):undefined;
  const swap=q?.kind==='plasmaSwap',thermal=q?.kind==='plasmaVent',p=stage?q!.elapsed/stage.duration:0;
  a.plasmaTray.position.x=-PLASMA.trayTravel*(b?.tray??0);a.plasmaLatch.rotation.z=-(b?.latch??0)*.75;
  for(let n=0;n<3;n++)a['coolingShutter'+n].rotation.x=(b?.shutters??0)*.9;
  a.cartridgeClips.rotation.z=swap&&(stage?.phase==='eject'||stage?.phase==='insert')?-.5:0;
  a.gasCylinder.position.copy(base);a.gasCylinder.visible=b?.loaded??true;
  a.oldGasCylinder.visible=a.freshGasCylinder.visible=false;
  a.oldGasCylinder.quaternion.identity();a.freshGasCylinder.quaternion.identity();
  seat.copy(base).add(a.plasmaTray.position);align.copy(seat);align.y+=.095;
  if(!stage||!q)return;
  const lift=stage.phase==='present'?plasmaEase(p):stage.phase==='recover'?1-plasmaEase(p):1;
  if(firstPerson){assembly.root.position.lerp(carry,thermal?lift*.55:lift);assembly.root.quaternion.slerp(carryQ,thermal?lift*.55:lift);}
  if(swap&&stage.phase==='eject'&&q.plasmaHadCylinder){
   a.gasCylinder.visible=false;a.oldGasCylinder.visible=p<.98;
   const take=plasmaEase((p-.20)/.30),discard=plasmaEase((p-.50)/.50);
   a.oldGasCylinder.position.copy(seat);a.oldGasCylinder.position.y+=.095*take;
   a.oldGasCylinder.position.lerp(stow,discard);
  }
  if(swap&&stage.phase==='insert'){
   a.gasCylinder.visible=false;a.freshGasCylinder.visible=true;
   if(p<.55)a.freshGasCylinder.position.lerpVectors(stow,align,plasmaEase(p/.55));
   else a.freshGasCylinder.position.lerpVectors(align,seat,plasmaEase((p-.55)/.45));
  }
 };
}
export function createPlasmaHandAnimator(){
 const inverse=new THREE.Matrix4(),relative=new THREE.Matrix4(),point=new THREE.Vector3(),latch=new THREE.Vector3(),handle=new THREE.Vector3(),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-Math.PI/2,0)),partQ=new THREE.Quaternion(),supportQ=new THREE.Quaternion(),euler=new THREE.Euler();
 const stow=new THREE.Vector3(-.384,-.36,-.04);
 function part(a:WeaponAssembly,name:string,offset:readonly number[],out:THREE.Vector3){a.parts[name].updateWorldMatrix(true,false);inverse.copy(a.root.matrixWorld).invert();relative.multiplyMatrices(inverse,a.parts[name].matrixWorld);out.fromArray(offset).applyMatrix4(relative);partQ.setFromRotationMatrix(relative);return out;}
 return(a:WeaponAssembly,s:WeaponSlotState|null|undefined,support:THREE.Vector3,gripRotation:readonly [number,number,number],out:THREE.Vector3,qout:THREE.Quaternion)=>{
  const q=s?.reloading?s.reloadSequence:undefined,stage=s?plasmaActionPhase(s):undefined;if(!q||!stage)return;
  const p=q.elapsed/stage.duration,phase=stage.phase;
  supportQ.setFromEuler(euler.set(...gripRotation));
  part(a,'plasmaLatch',[-.032,-.040,-.013],latch);part(a,'plasmaTray',[-.151,-.034,-.067],handle);
  qout.copy(rotation);
  if(q.kind==='plasmaVent'){
   part(a,'thermalSwitch',[-.023,-.04,0],point);
   if(phase==='present'){out.lerpVectors(support,point,plasmaEase(p));qout.slerpQuaternions(supportQ,rotation,plasmaEase(p));}
   else if(phase==='recover'){out.lerpVectors(point,support,plasmaEase(p));qout.slerpQuaternions(rotation,supportQ,plasmaEase(p));}
   else out.copy(point);
  }else{
   if(phase==='present'){out.lerpVectors(support,latch,plasmaEase(p));qout.slerpQuaternions(supportQ,rotation,plasmaEase(p));}
   else if(phase==='unlock'){out.copy(latch);qout.premultiply(a.parts.plasmaLatch.quaternion);}
   else if(phase==='open')out.lerpVectors(latch,handle,plasmaEase(p/.25));
   else if(phase==='vent')out.copy(handle);
   else if(phase==='eject'){
    if(q.plasmaHadCylinder){part(a,'oldGasCylinder',[-.044,-.040,0],point);out.lerpVectors(handle,point,plasmaEase(p/.20));}
    else out.lerpVectors(handle,stow,plasmaEase(p));
   }else if(phase==='insert'){part(a,'freshGasCylinder',[-.044,-.040,0],out);}
   else if(phase==='close'){part(a,'gasCylinder',[-.044,-.040,0],point);out.lerpVectors(point,handle,plasmaEase(p/.23));}
   else if(phase==='lock'){out.lerpVectors(handle,latch,plasmaEase(p/.25));qout.premultiply(a.parts.plasmaLatch.quaternion);}
   else if(phase==='recover'){out.lerpVectors(latch,support,plasmaEase(p));qout.slerpQuaternions(rotation,supportQ,plasmaEase(p));}
  }
 };
}
