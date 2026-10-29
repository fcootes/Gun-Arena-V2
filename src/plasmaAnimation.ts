import * as THREE from 'three';
import type {WeaponAssembly} from './weaponModels';
import type {WeaponSlotState} from './types';
import {PLASMA,plasmaEase,plasmaSeating,plasmaActionPhase} from './plasmaMechanics';

/** Authored side-insertion path; shared by hands, model and geometric tests. */
export function plasmaFreshPose(phase:string,p:number,out:THREE.Vector3){
 if(phase==='insert'){
  if(p<.72)out.fromArray(PLASMA.freshStart).lerp(newAlign,plasmaEase(p/.72));
  else out.fromArray(PLASMA.freshAlign).lerp(newContact,plasmaEase((p-.72)/.28));
 }else if(phase==='slap')out.fromArray(PLASMA.freshContact).lerp(seated,plasmaSeating(p));
 else out.copy(seated);
 return out;
}
const newAlign=new THREE.Vector3().fromArray(PLASMA.freshAlign),newContact=new THREE.Vector3().fromArray(PLASMA.freshContact),seated=new THREE.Vector3().fromArray(PLASMA.cylinder);
export const PLASMA_EJECTION=Object.freeze({popDistance:.235,popTime:.018,drift:.50,fallStart:.055,upSpeed:.14,gravity:9.2});
/** Spring impulse clears the doorway first; only then can the shell tumble. */
export function plasmaEjectedPose(age:number,out:THREE.Vector3,rotation:THREE.Euler){
 const t=Math.max(0,age),pop=1-Math.exp(-t/PLASMA_EJECTION.popTime),fall=Math.max(0,t-PLASMA_EJECTION.fallStart);
 out.fromArray(PLASMA.cylinder);out.x-=PLASMA_EJECTION.popDistance*pop*pop+PLASMA_EJECTION.drift*t;
 out.y+=PLASMA_EJECTION.upSpeed*fall-.5*PLASMA_EJECTION.gravity*fall*fall;out.z+=.035*fall;
 rotation.set(4.8*fall,-3.4*fall,7.7*fall);
}
export function createPlasmaAnimator(assembly:WeaponAssembly,firstPerson=true){
 const a=assembly.parts,carryQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(...PLASMA.rotation));
 const gripPivot=new THREE.Vector3(.038,-.10,.100),pivotBefore=new THREE.Vector3(),pivotAfter=new THREE.Vector3();
 return(s:WeaponSlotState|null|undefined)=>{
  const b=s?.plasma,q=s?.reloading?s.reloadSequence:undefined,stage=s?plasmaActionPhase(s):undefined;
  const swap=q?.kind==='plasmaSwap',thermal=q?.kind==='plasmaVent',p=stage?q!.elapsed/stage.duration:0;
  a.chamberUpperDoor.rotation.z=-(b?.upperDoor??0)*PLASMA.doorAngle;
  a.chamberLowerDoor.rotation.z=(b?.lowerDoor??0)*PLASMA.doorAngle;
  a.chamberRelease.position.x=-.056+.003*(b?.release??0);
  a.cartridgeRetention.position.x=.030+.009*(1-(b?.lock??1));
  for(let n=0;n<3;n++)a['coolingShutter'+n].rotation.x=(b?.shutters??0)*.9;
  a.gasCylinder.position.fromArray(PLASMA.cylinder);a.gasCylinder.visible=b?.cartridgeInstalled??true;
  a.oldGasCylinder.visible=!!swap&&(b?.ejectionAge??-1)>=0&&(b?.ejectionAge??1)<PLASMA.ejectionLifetime;
  a.oldGasCylinder.rotation.set(0,0,0);a.freshGasCylinder.rotation.set(0,0,0);a.freshGasCylinder.visible=false;
  if(a.oldGasCylinder.visible)plasmaEjectedPose(b!.ejectionAge,a.oldGasCylinder.position,a.oldGasCylinder.rotation);
  if(!stage||!q)return;
  const lift=stage.phase==='present'?plasmaEase(p):stage.phase==='recover'?1-plasmaEase(p):1;
  if(firstPerson){
   // Cant about the firing grip, preserving the right-hand anchor in camera space.
   pivotBefore.copy(gripPivot).applyQuaternion(assembly.root.quaternion).add(assembly.root.position);
   assembly.root.quaternion.slerp(carryQ,thermal?lift*.40:lift);
   pivotAfter.copy(gripPivot).applyQuaternion(assembly.root.quaternion).add(assembly.root.position);
   assembly.root.position.add(pivotBefore.sub(pivotAfter));
   // Seating pressure is held, then released as a damped receiver response.
   if(swap&&stage.phase==='slap')assembly.root.rotation.z-=.012*plasmaSeating(p);
   if(swap&&stage.phase==='close'){
    const t=q.elapsed/(q.plasmaSpeed??1),mass=Math.exp(-t*19)*Math.cos(t*48);
    assembly.root.rotation.z-=.012*mass;assembly.root.rotation.x+=.020*Math.exp(-t*22)*Math.sin(t*55);
   }
   if(thermal&&stage.phase==='vent'){
    const t=q.elapsed/(q.plasmaSpeed??1),pressure=Math.exp(-t*16)*Math.sin(t*46);
    assembly.root.rotation.x+=.018*pressure;assembly.root.rotation.z-=.009*pressure;
   }
  }
  if(swap&&(stage.phase==='insert'||stage.phase==='slap')){
   a.gasCylinder.visible=false;a.freshGasCylinder.visible=true;plasmaFreshPose(stage.phase,p,a.freshGasCylinder.position);
  }
 };
}

/** Palm-front orientation: fingers along -Z, palm facing +X into the bay. */
const contactRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,-Math.PI/2,0));
/** FK matches the production left glove (thumb lengths, opposition and curl). */
export function plasmaThumbOffset(out:THREE.Vector3){
 const euler=new THREE.Euler(),rotation=new THREE.Quaternion(),joint=new THREE.Quaternion(),step=new THREE.Vector3();
 out.set(.043,.010,-.005);
 for(let n=0;n<3;n++){
  joint.setFromEuler(euler.set(-[.35,.60,.35][n],0,n===0?-.18:0));rotation.multiply(joint);
  out.add(step.set(0,[.028,.022,.018][n],0).applyQuaternion(rotation));
 }
 return out.applyQuaternion(contactRotation);
}
export function createPlasmaHandAnimator(){
 const inverse=new THREE.Matrix4(),relative=new THREE.Matrix4(),point=new THREE.Vector3(),release=new THREE.Vector3(),thermalTarget=new THREE.Vector3();
 const supportQ=new THREE.Quaternion(),reactionQ=new THREE.Quaternion(),ventHand=new THREE.Vector3(),reactHand=new THREE.Vector3(),euler=new THREE.Euler(),thumbOffset=plasmaThumbOffset(new THREE.Vector3());
 const clear=new THREE.Vector3(-.205,-.10,.160),outerFront=new THREE.Vector3(-.165,-.10,-.27),outerRear=new THREE.Vector3(),carryHand=new THREE.Vector3(),seatHand=new THREE.Vector3();
 function part(a:WeaponAssembly,name:string,offset:readonly number[],out:THREE.Vector3){a.parts[name].updateWorldMatrix(true,false);inverse.copy(a.root.matrixWorld).invert();relative.multiplyMatrices(inverse,a.parts[name].matrixWorld);return out.fromArray(offset).applyMatrix4(relative);}
 return(a:WeaponAssembly,s:WeaponSlotState|null|undefined,support:THREE.Vector3,gripRotation:readonly [number,number,number],out:THREE.Vector3,qout:THREE.Quaternion)=>{
  const q=s?.reloading?s.reloadSequence:undefined,stage=s?plasmaActionPhase(s):undefined;if(!q||!stage)return 1;
  const p=q.elapsed/stage.duration,phase=stage.phase;
  supportQ.setFromEuler(euler.set(...gripRotation));qout.copy(contactRotation);
  // Thumb pad (tip) contacts the left face of the actual moving release button.
  part(a,'chamberRelease',[-.0045,0,0],release).sub(thumbOffset);
  part(a,'thermalSwitch',[-.005,0,0],thermalTarget).sub(thumbOffset);
  plasmaFreshPose('insert',0,carryHand);carryHand.add(palmOffset);
  seatHand.fromArray(PLASMA.cylinder).add(palmOffset);
  if(q.kind==='plasmaVent'){
   const intensity=q.plasmaForcedVent?1:.50+.25*(q.plasmaStartHeat??0)/100;
   ventHand.set(-.190,-.005,-.170);reactHand.set(-.255,-.065,-.120);
   if(phase==='present'){
    if(p<.5)out.lerpVectors(support,outerFront,plasmaEase(p*2));
    else out.lerpVectors(outerFront,thermalTarget,plasmaEase((p-.5)*2));
    qout.slerpQuaternions(supportQ,contactRotation,plasmaEase(p));
   }else if(phase==='unlock')out.copy(thermalTarget);
   else if(phase==='open')out.lerpVectors(thermalTarget,ventHand,plasmaEase(p)*.55);
   else if(phase==='vent'){
    point.copy(thermalTarget).lerp(ventHand,.55);out.lerpVectors(point,ventHand,plasmaEase(p/.20));
   }else if(phase==='react'){
    out.lerpVectors(ventHand,reactHand,plasmaEase(p/.30));
    const shake=Math.sin(Math.PI*p)*Math.sin(p*Math.PI*5)*intensity;
    out.x-=.012*shake;out.y+=.014*shake;
    qout.multiply(reactionQ.setFromEuler(euler.set(.12*shake,0,.18*shake)));
   }else if(phase==='close')out.copy(reactHand);
   else if(phase==='recover'){
    if(p<.5)out.lerpVectors(reactHand,outerFront,plasmaEase(p*2));
    else out.lerpVectors(outerFront,support,plasmaEase((p-.5)*2));
    qout.slerpQuaternions(contactRotation,supportQ,plasmaEase(p));
   }
   return phase==='present'||phase==='unlock'?1:phase==='recover'?.65+.35*plasmaEase(p):.65;
  }
  if(phase==='present'){
   // Clear the closed receiver laterally before sweeping back to the thumb control.
   outerRear.copy(release);outerRear.x=outerFront.x;
   if(p<.20)out.lerpVectors(support,outerFront,plasmaEase(p/.20));
   else if(p<.65)out.lerpVectors(outerFront,outerRear,plasmaEase((p-.20)/.45));
   else out.lerpVectors(outerRear,release,plasmaEase((p-.65)/.15));
   qout.slerpQuaternions(supportQ,contactRotation,plasmaEase(p/.65));
  }
  else if(phase==='open'){
   point.copy(release);point.x=clear.x;
   if(p<.20)out.lerpVectors(release,point,plasmaEase(p/.20));
   else out.lerpVectors(point,clear,plasmaEase((p-.20)/.80));
  }
  else if(phase==='eject')out.lerpVectors(clear,carryHand,plasmaEase(p));
  else if(phase==='insert'||phase==='slap'){
   part(a,'freshGasCylinder',[-.052,-.016,.025],out);
   // A small palm rebrace communicates resistance; it returns to contact before
   // the cylinder moves through its final quarter, never driving from a gap.
   if(phase==='slap'&&p<.72)out.x-=.018*Math.sin(Math.PI*plasmaEase(p/.72));
  }
  else if(phase==='close'){
   // Withdraw outside the door sweep before returning under the fore-end.
   point.copy(seatHand);point.x-=.12;
   out.lerpVectors(seatHand,point,plasmaEase(p/.24));
   if(p>.24)out.lerp(outerFront,plasmaEase((p-.24)/.76));
  }else if(phase==='recover'){out.lerpVectors(outerFront,support,plasmaEase(p));qout.slerpQuaternions(contactRotation,supportQ,plasmaEase(p));}
  // Keep thumb-release FK exact and flatten only on the distinct seating beat.
  return phase==='eject'?1-.80*plasmaEase(p):phase==='insert'?.20:phase==='slap'?.20-.12*plasmaEase(p/.72):phase==='close'?.08+.92*plasmaEase(p):1;
 };
}
const palmOffset=new THREE.Vector3(-.052,-.016,.025);
