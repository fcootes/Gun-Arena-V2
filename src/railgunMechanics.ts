import * as THREE from 'three';
import type {WeaponAssembly} from './weaponModels';
import type {WeaponSlotState} from './types';
import type {ReloadPhase,ReloadSequence,ReloadPhaseListener} from './weaponReload';

export const RAILGUN = Object.freeze({
  present:.22,unlock:.18,slideForward:.35,raiseCradle:.32,pickup:.34,insert:.50,lowerCradle:.23,close:.34,lock:.18,recover:.14,
  reload:2.8,charge:1.2,slideTravel:.270,cradleAngle:-32*Math.PI/180,ejectFraction:.80,
  hinge:[0,.020,.035] as const, chamber:[0,.019,.097] as const,
  slugGrip:[-.0385,-.040,-.030] as const,
  coverGrip:[-.130,-.042,.035] as const,latchGrip:[-.036,-.036,.022] as const,
  carry:[-.10,-.210,-.440] as const,rotation:[.08,.50,-.28] as const,
});
export interface RailgunBreechState {cover:number;cradle:number;latch:number;carrier:boolean;seated:boolean;}
export type RailgunEvent='railgun_breech_unlock'|'railgun_breech_open'|'railgun_carrier_eject'|'railgun_slug_seat'|'railgun_breech_close'|'railgun_breech_lock';
export type RailgunListener=(event:RailgunEvent,speed:number,late:number)=>void;
export const railgunEase=(v:number)=>{const p=THREE.MathUtils.clamp(v,0,1);return p*p*(3-2*p);};
export function railgunBreechReady(state:WeaponSlotState){const b=state.railgunBreech;return !b||(b.cover<1e-8&&(b.cradle??0)<1e-8&&b.latch<1e-8);}
export function canChargeRailgun(state:WeaponSlotState){return !state.reloading&&(state.ammo??0)>0&&railgunBreechReady(state);}
export function markRailgunFired(state:WeaponSlotState){state.railgunBreech={cover:0,cradle:0,latch:0,carrier:true,seated:false};}
export function railgunCue(phase:ReloadPhase):RailgunEvent|undefined {
  return phase==='unlock'?'railgun_breech_unlock':phase==='slideForward'?'railgun_breech_open':phase==='raiseCradle'?'railgun_carrier_eject':phase==='insert'?'railgun_slug_seat':phase==='close'?'railgun_breech_close':phase==='lock'?'railgun_breech_lock':undefined;
}
export function beginRailgunReload(state:WeaponSlotState,multiplier=1):boolean {
  if(state.reloading||(state.ammo??0)<=0&&(state.reserve??0)<=0)return false;
  if((state.ammo??0)>0&&railgunBreechReady(state))return false;
  const b=state.railgunBreech??={cover:0,cradle:0,latch:0,carrier:(state.ammo??0)===0,seated:(state.ammo??0)>0};
  b.cradle??=0;
  const speed=Math.max(.1,Number.isFinite(multiplier)?multiplier:1),phases:ReloadSequence['phases']=[];
  const add=(phase:ReloadPhase,seconds:number)=>{if(seconds>1e-8)phases.push({phase,duration:seconds*speed});};
  add('present',RAILGUN.present);
  if((state.ammo??0)===0){
    add('unlock',RAILGUN.unlock*(1-b.latch));add('slideForward',RAILGUN.slideForward*(1-b.cover));
    // A cancelled raised/ejected tray resumes without manufacturing a carrier.
    if(b.cradle<1-1e-8||b.carrier)add('raiseCradle',RAILGUN.raiseCradle*Math.max(b.carrier ? .2 : 0,1-b.cradle));
    add('pickup',RAILGUN.pickup);add('insert',RAILGUN.insert);
  }
  add('lowerCradle',RAILGUN.lowerCradle*((state.ammo??0)===0?1:b.cradle));
  add('close',RAILGUN.close*((state.ammo??0)===0?1:b.cover));
  add('lock',RAILGUN.lock);add('recover',RAILGUN.recover);
  state.reloadSequence={kind:'railgun',phases,index:0,elapsed:0,empty:(state.ammo??0)===0,shellsRemaining:0,inserted:0,railgunStartCover:b.cover,railgunStartCradle:b.cradle,railgunStartLatch:b.latch,railgunSpeed:speed,railgunHadCarrier:b.carrier&&(state.ammo??0)===0,railgunEjectTilt:b.cradle+(1-b.cradle)*railgunEase(RAILGUN.ejectFraction),railgunRecoveryOnly:(state.ammo??0)>0};
  state.reloading=true;state.totalReloadT=phases.reduce((n,p)=>n+p.duration,0);state.reloadT=state.totalReloadT;
  state.charging=false;state.chargeTimer=0;return true;
}
/** Gameplay, visual poses and future silent Foley markers share this clock. */
export function advanceRailgunReload(state:WeaponSlotState,delta:number,listener?:RailgunListener,onPhase?:ReloadPhaseListener):number {
  const q=state.reloadSequence,b=state.railgunBreech;if(!state.reloading||q?.kind!=='railgun'||!b||!Number.isFinite(delta)||delta<=0)return 0;
  let remaining=delta,inserted=0;
  while(remaining>1e-10&&state.reloading){
    const stage=q.phases[q.index],cue=railgunCue(stage.phase),at=stage.phase==='raiseCradle'?stage.duration*RAILGUN.ejectFraction:stage.duration;
    const boundary=cue&&!q.railgunCuePlayed?at:stage.duration;
    const step=Math.min(remaining,Math.max(0,boundary-q.elapsed));q.elapsed+=step;remaining-=step;state.reloadT=Math.max(0,(state.reloadT??0)-step);
    const p=railgunEase(q.elapsed/stage.duration);
    if(stage.phase==='unlock')b.latch=q.railgunStartLatch!+(1-q.railgunStartLatch!)*p;
    if(stage.phase==='slideForward')b.cover=q.railgunStartCover!+(1-q.railgunStartCover!)*railgunEase((q.elapsed/stage.duration-.20)/.80);
    if(stage.phase==='raiseCradle'&&b.cover>1-1e-8)b.cradle=q.railgunStartCradle!+(1-q.railgunStartCradle!)*p;
    if(stage.phase==='lowerCradle')b.cradle=q.railgunStartCradle!*(1-p);
    if(stage.phase==='close'&&b.cradle<1e-8)b.cover=q.railgunStartCover!*(1-railgunEase((q.elapsed/stage.duration-.30)/.70));
    if(stage.phase==='lock')b.latch=q.railgunStartLatch!*(1-railgunEase((q.elapsed/stage.duration-.25)/.75));
    if(cue&&!q.railgunCuePlayed&&q.elapsed+1e-8>=at){
      q.railgunCuePlayed=true;let emit=true;
      if(stage.phase==='raiseCradle'){emit=b.carrier;b.carrier=false;}
      if(stage.phase==='insert'&&!b.seated&&(state.reserve??0)>0){state.ammo=(state.ammo??0)+1;state.reserve!--;q.inserted++;inserted++;b.seated=true;}
      if(stage.phase==='lock'){b.latch=0;b.cover=0;b.cradle=0;state.needsChamber=false;}
      if(emit)listener?.(cue,q.railgunSpeed!,remaining);
    }
    if(q.elapsed+1e-8<stage.duration){if(remaining>1e-10)continue;break;}
    q.index++;q.elapsed=0;q.railgunCuePlayed=false;q.railgunStartCover=b.cover;q.railgunStartCradle=b.cradle;q.railgunStartLatch=b.latch;
    if(q.index===q.phases.length){state.reloading=false;state.reloadT=0;state.reloadSequence=undefined;}else{const next=q.phases[q.index];onPhase?.(next.phase,next.duration,q.empty);}
  }
  return inserted;
}

/** Cached transforms only: no per-frame geometry, object creation or reparenting. */
export function createRailgunAnimator(assembly:WeaponAssembly,firstPerson=true){
  const a=assembly.parts,lockX=a.breechLock.position.x,seat=new THREE.Vector3().fromArray(RAILGUN.chamber),present=new THREE.Vector3().fromArray(RAILGUN.carry);
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...RAILGUN.rotation));
  const stow=new THREE.Vector3(-.29,-.29,.12),acquire=new THREE.Vector3(),destination=new THREE.Vector3();
  const destinationQ=new THREE.Quaternion(),slugQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.55,.25,-.10));
  const ejectOrigin=new THREE.Vector3(),ejectQ=new THREE.Quaternion(),ejectRotation=new THREE.Quaternion(),euler=new THREE.Euler();
  return(state:WeaponSlotState|null|undefined)=>{
    const q=state?.reloading?state.reloadSequence:undefined,stage=q?.kind==='railgun'?q.phases[q.index]:undefined;
    const b=state?.railgunBreech,cover=b?.cover??0,latch=b?.latch??0,cradle=b?.cradle??0;
    a.breechSlide.position.set(0,0,-RAILGUN.slideTravel*cover);
    a.cartridgeCradle.rotation.x=RAILGUN.cradleAngle*cradle;
    a.breechLatch.rotation.z=-.70*latch;a.breechLock.position.x=lockX-.028*latch;
    a.chamberedSlug.position.copy(seat);a.chamberedSlug.quaternion.identity();a.chamberedSlug.visible=(state?.ammo??1)>0&&(b?.seated??true);
    a.cartridgeCradle.updateMatrix();destination.copy(seat).applyMatrix4(a.cartridgeCradle.matrix);destinationQ.copy(a.cartridgeCradle.quaternion);
    a.spentCarrier.position.set(0,.019,.165).applyMatrix4(a.cartridgeCradle.matrix);a.spentCarrier.quaternion.copy(destinationQ);a.spentCarrier.visible=b?.carrier??false;
    a.freshSlug.visible=false;a.freshSlug.position.copy(stow);a.freshSlug.quaternion.copy(slugQ);
    if(!stage||!q)return;
    const p=q.elapsed/stage.duration,phase=stage.phase;
    const lift=phase==='present'?railgunEase(p):phase==='recover'?1-railgunEase(p):1;
    if(firstPerson){assembly.root.position.lerp(present,lift);assembly.root.quaternion.slerp(rotation,lift);}
    if(q.railgunHadCarrier&&(phase==='raiseCradle'&&p>=RAILGUN.ejectFraction||phase==='pickup')){
      const raise=q.phases.find(s=>s.phase==='raiseCradle')!;
      const t=(phase==='raiseCradle'?(p-RAILGUN.ejectFraction)*raise.duration:raise.duration*(1-RAILGUN.ejectFraction)+p*stage.duration)/q.railgunSpeed!;
      ejectQ.setFromEuler(euler.set(RAILGUN.cradleAngle*q.railgunEjectTilt!,0,0));
      ejectOrigin.set(0,.019,.165).applyQuaternion(ejectQ).add(a.cartridgeCradle.position);
      a.spentCarrier.visible=t<.50;a.spentCarrier.position.copy(ejectOrigin);
      a.spentCarrier.position.x-=1.25*t;a.spentCarrier.position.y+=1.05*t-3.8*t*t;a.spentCarrier.position.z-=.45*t;
      ejectRotation.setFromEuler(euler.set(t*12,t*16,t*9));a.spentCarrier.quaternion.copy(ejectQ).multiply(ejectRotation);
    }
    acquire.copy(destination).add(stow.set(-.10,.105,.035));stow.set(-.29,-.29,.12);
    if(phase==='pickup'){
      const reach=railgunEase((p-.25)/.75);a.freshSlug.visible=p>=.25;a.freshSlug.position.lerpVectors(stow,acquire,reach);a.freshSlug.quaternion.slerpQuaternions(ejectRotation.identity(),slugQ,reach);
    }
    if(phase==='insert'){
      a.freshSlug.visible=true;
      const align=railgunEase(p/.40),press=railgunEase((p-.40)/.60);
      a.freshSlug.position.lerpVectors(acquire,destination,align);a.freshSlug.position.y=acquire.y+(destination.y-acquire.y)*press;
      a.freshSlug.quaternion.slerpQuaternions(slugQ,destinationQ,align);
    }
  };
}

export function createRailgunHandAnimator(){
  const matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),point=new THREE.Vector3(),cover=new THREE.Vector3(),latch=new THREE.Vector3();
  const coverQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-Math.PI/2,0)),slugQ=new THREE.Quaternion(),latchQ=new THREE.Quaternion(),palmOffset=new THREE.Vector3(),contact=new THREE.Vector3(),partRotation=new THREE.Quaternion();
  const euler=new THREE.Euler(),supportQ=new THREE.Quaternion(),pickup=new THREE.Vector3(-.3285,-.330,.09);
  function part(assembly:WeaponAssembly,name:string,offset:readonly number[]|THREE.Vector3,out:THREE.Vector3){const object=assembly.parts[name];object.updateWorldMatrix(true,false);assembly.root.updateWorldMatrix(true,false);inverse.copy(assembly.root.matrixWorld).invert();matrix.multiplyMatrices(inverse,object.matrixWorld);if(offset instanceof THREE.Vector3)out.copy(offset);else out.fromArray(offset);out.applyMatrix4(matrix);return out;}
  function slugPose(assembly:WeaponAssembly,name:string,_blend:number,out:THREE.Vector3,orientation:THREE.Quaternion){
    // Wrap from the operator's left: keep the wrist below the loading
    // channel rather than sweeping a flat palm/forearm across the camera.
    slugQ.copy(coverQ);contact.set(-.0155,0,-.030);
    palmOffset.set(0,.040,-.023).applyQuaternion(slugQ);contact.sub(palmOffset);
    part(assembly,name,contact,out);partRotation.setFromRotationMatrix(matrix);orientation.copy(slugQ).premultiply(partRotation);
  }
  return(assembly:WeaponAssembly,state:WeaponSlotState|null|undefined,support:THREE.Vector3,rotation:readonly [number,number,number],target:THREE.Vector3,orientation:THREE.Quaternion)=>{
    const sequence=state?.reloading?state.reloadSequence:undefined,stage=sequence?.kind==='railgun'?sequence.phases[sequence.index]:undefined;if(!stage||!sequence)return;
    const p=sequence.elapsed/stage.duration,phase=stage.phase;supportQ.setFromEuler(euler.set(...rotation));
    part(assembly,'breechCover',RAILGUN.coverGrip,cover);part(assembly,'breechLatch',RAILGUN.latchGrip,latch);
    latchQ.copy(coverQ).premultiply(assembly.parts.breechLatch.quaternion);
    target.copy(latch);orientation.copy(coverQ);
    if(phase==='present'){
      const next=sequence.phases[1].phase;
      if(next==='lowerCradle'){
        slugPose(assembly,'chamberedSlug',1,point,orientation);target.lerpVectors(support,point,railgunEase(p));orientation.slerpQuaternions(supportQ,orientation,railgunEase(p));
      }else{
        const contact=next==='pickup'?pickup:next==='close'||next==='lock'||next==='raiseCradle'?cover:latch;
        target.lerpVectors(support,contact,railgunEase(p));orientation.slerpQuaternions(supportQ,next==='unlock'||next==='slideForward'?latchQ:coverQ,railgunEase(p));
      }
    }
    else if(phase==='unlock'){target.copy(latch);orientation.copy(latchQ);}
    else if(phase==='slideForward'){const reach=railgunEase(p/.20);target.lerpVectors(latch,cover,reach);orientation.slerpQuaternions(latchQ,coverQ,reach);}
    else if(phase==='raiseCradle'){target.lerpVectors(cover,pickup,railgunEase(p));orientation.copy(coverQ);}
    else if(phase==='pickup'){
      if(p<.25){target.copy(pickup);orientation.copy(coverQ);}
      else{slugPose(assembly,'freshSlug',0,target,orientation);}
    }else if(phase==='insert'){slugPose(assembly,'freshSlug',railgunEase((p-.40)/.30),target,orientation);}
    else if(phase==='lowerCradle'){slugPose(assembly,'chamberedSlug',1,target,orientation);}
    else if(phase==='close'){
      slugPose(assembly,'chamberedSlug',1,point,orientation);const reach=sequence.railgunRecoveryOnly?1:railgunEase(p/.30);
      target.lerpVectors(point,cover,reach);target.y+=.055*Math.sin(Math.PI*reach);orientation.slerp(coverQ,reach);
    }else if(phase==='lock'){const reach=railgunEase(p/.25);target.lerpVectors(cover,latch,reach);orientation.slerpQuaternions(coverQ,latchQ,reach);}
    else if(phase==='recover'){target.lerpVectors(latch,support,railgunEase(p));orientation.slerpQuaternions(coverQ,supportQ,railgunEase(p));}
  };
}

export function createRailgunArmSolver(){
  const axis=new THREE.Vector3(),bend=new THREE.Vector3();
  return(cuff:THREE.Vector3,shoulder:THREE.Vector3,elbow:THREE.Vector3)=>{
    shoulder.set(-.26,-.43,-.22);axis.subVectors(cuff,shoulder);let distance=axis.length();axis.divideScalar(Math.max(1e-8,distance));
    shoulder.addScaledVector(axis,THREE.MathUtils.clamp(distance-.588,0,.12));axis.subVectors(cuff,shoulder);distance=axis.length();axis.divideScalar(Math.max(1e-8,distance));
    const reach=THREE.MathUtils.clamp(distance,.06,.588),along=(.32*.32-.28*.28+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,.32*.32-along*along));
    bend.set(-.8,-1,-.65).addScaledVector(axis,-axis.dot(bend)).normalize();elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,height);
  };
}
