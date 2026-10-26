import * as THREE from 'three';
import type {WeaponAssembly} from './weaponModels';
import type {WeaponSlotState} from './types';
import type {ReloadPhase,ReloadSequence,ReloadPhaseListener} from './weaponReload';

export const RAILGUN = Object.freeze({
  present:.28,unlock:.24,retract:.35,eject:.16,pickup:.40,insert:.55,close:.37,lock:.20,recover:.25,
  reload:2.8,charge:1.2,slideTravel:.200,slideRise:.014,
  chamber:[0,.039,.132] as const,
  slugGrip:[-.0385,-.040,-.030] as const,
  coverGrip:[-.130,-.042,.035] as const,
  latchGrip:[-.036,-.036,.022] as const,
  carry:[-.090,-.155,-.780] as const,rotation:[.02,.55,-.22] as const,
});
export interface RailgunBreechState {cover:number;latch:number;carrier:boolean;seated:boolean;}
export type RailgunEvent='railgun_breech_unlock'|'railgun_breech_open'|'railgun_carrier_eject'|'railgun_slug_seat'|'railgun_breech_close'|'railgun_breech_lock';
export type RailgunListener=(event:RailgunEvent,speed:number,late:number)=>void;
export const railgunEase=(v:number)=>{const p=THREE.MathUtils.clamp(v,0,1);return p*p*(3-2*p);};
export function railgunBreechReady(state:WeaponSlotState){return !state.railgunBreech||(state.railgunBreech.cover<1e-8&&state.railgunBreech.latch<1e-8);}
export function canChargeRailgun(state:WeaponSlotState){return !state.reloading&&(state.ammo??0)>0&&railgunBreechReady(state);}
export function markRailgunFired(state:WeaponSlotState){state.railgunBreech={cover:0,latch:0,carrier:true,seated:false};}
export function railgunCue(phase:ReloadPhase):RailgunEvent|undefined {
  return phase==='unlock'?'railgun_breech_unlock':phase==='retract'?'railgun_breech_open':phase==='eject'?'railgun_carrier_eject':phase==='insert'?'railgun_slug_seat':phase==='close'?'railgun_breech_close':phase==='lock'?'railgun_breech_lock':undefined;
}
export function beginRailgunReload(state:WeaponSlotState,multiplier=1):boolean {
  if(state.reloading||(state.ammo??0)<=0&&(state.reserve??0)<=0)return false;
  if((state.ammo??0)>0&&railgunBreechReady(state))return false;
  const breech=state.railgunBreech??={cover:0,latch:0,carrier:(state.ammo??0)===0,seated:(state.ammo??0)>0};
  const speed=Math.max(.1,Number.isFinite(multiplier)?multiplier:1),phases:ReloadSequence['phases']=[];
  const add=(phase:ReloadPhase,seconds:number)=>phases.push({phase,duration:seconds*speed});
  add('present',RAILGUN.present);
  if((state.ammo??0)===0){
    if(breech.latch<1-1e-8)add('unlock',RAILGUN.unlock*(1-breech.latch));
    if(breech.cover<1-1e-8)add('retract',RAILGUN.retract*(1-breech.cover));
    if(breech.carrier)add('eject',RAILGUN.eject);
    add('pickup',RAILGUN.pickup);add('insert',RAILGUN.insert);
  }
  if(breech.cover>1e-8||(state.ammo??0)===0)add('close',RAILGUN.close);
  add('lock',RAILGUN.lock);add('recover',RAILGUN.recover);
  state.reloadSequence={kind:'railgun',phases,index:0,elapsed:0,empty:(state.ammo??0)===0,shellsRemaining:0,inserted:0,railgunStartCover:breech.cover,railgunStartLatch:breech.latch,railgunSpeed:speed,railgunHadCarrier:breech.carrier&&(state.ammo??0)===0,railgunRecoveryOnly:(state.ammo??0)>0};
  state.reloading=true;state.totalReloadT=phases.reduce((n,p)=>n+p.duration,0);state.reloadT=state.totalReloadT;
  state.charging=false;state.chargeTimer=0;return true;
}
/** Same authoritative phase clock as other weapons. Persistent physical state
 * survives cancellation; seating consumes a round once, locking gates charge. */
export function advanceRailgunReload(state:WeaponSlotState,delta:number,listener?:RailgunListener,onPhase?:ReloadPhaseListener):number {
  const q=state.reloadSequence,b=state.railgunBreech;if(!state.reloading||q?.kind!=='railgun'||!b)return 0;
  let remaining=delta,inserted=0;
  while(remaining>1e-10&&state.reloading){
    const stage=q.phases[q.index],cue=railgunCue(stage.phase),at=stage.phase==='eject'?stage.duration*.18:stage.duration;
    const boundary=cue&&!q.railgunCuePlayed?at:stage.duration;
    const step=Math.min(remaining,Math.max(0,boundary-q.elapsed));q.elapsed+=step;remaining-=step;state.reloadT=Math.max(0,(state.reloadT??0)-step);
    const p=railgunEase(q.elapsed/stage.duration);
    if(stage.phase==='unlock')b.latch=q.railgunStartLatch!+(1-q.railgunStartLatch!)*p;
    if(stage.phase==='retract')b.cover=q.railgunStartCover!+(1-q.railgunStartCover!)*railgunEase((q.elapsed/stage.duration-.20)/.80);
    if(stage.phase==='close')b.cover=q.railgunStartCover!*(1-railgunEase(Math.max(0,q.elapsed/stage.duration-.30)/.70));
    if(stage.phase==='lock')b.latch=q.railgunStartLatch!*(1-railgunEase((q.elapsed/stage.duration-.25)/.75));
    if(cue&&!q.railgunCuePlayed&&q.elapsed+1e-8>=at){
      q.railgunCuePlayed=true;
      if(stage.phase==='eject')b.carrier=false;
      if(stage.phase==='insert'&&!b.seated&&(state.reserve??0)>0){state.ammo=(state.ammo??0)+1;state.reserve!--;q.inserted++;inserted++;b.seated=true;}
      if(stage.phase==='lock'){b.latch=0;b.cover=0;state.needsChamber=false;}
      listener?.(cue,q.railgunSpeed!,remaining);
    }
    if(q.elapsed+1e-8<stage.duration){if(remaining>1e-10)continue;break;}
    q.index++;q.elapsed=0;q.railgunCuePlayed=false;q.railgunStartCover=b.cover;q.railgunStartLatch=b.latch;
    if(q.index===q.phases.length){state.reloading=false;state.reloadT=0;state.reloadSequence=undefined;}else{const next=q.phases[q.index];onPhase?.(next.phase,next.duration,q.empty);}
  }
  return inserted;
}

/** Cached part-local poses, driven entirely by authoritative reload state. */
export function createRailgunAnimator(assembly:WeaponAssembly,firstPerson=true){
  const a=assembly.parts,lockX=a.breechLock.position.x,seat=new THREE.Vector3().fromArray(RAILGUN.chamber),present=new THREE.Vector3().fromArray(RAILGUN.carry);
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...RAILGUN.rotation));
  const acquire=new THREE.Vector3(-.15,.120,.145),stow=new THREE.Vector3(-.29,-.29,.12);
  const identity=new THREE.Quaternion(),slugQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.78,.35,-.10));
  return(state:WeaponSlotState|null|undefined)=>{
    const q=state?.reloading?state.reloadSequence:undefined,stage=q?.kind==='railgun'?q.phases[q.index]:undefined;
    const b=state?.railgunBreech,cover=b?.cover??0,latch=b?.latch??0;
    a.breechSlide.position.set(0,RAILGUN.slideRise*railgunEase(cover/.20),RAILGUN.slideTravel*cover);
    a.breechLatch.rotation.z=-.70*latch;a.breechLock.position.x=lockX-.028*latch;
    a.chamberedSlug.position.copy(seat);a.chamberedSlug.visible=(state?.ammo??1)>0&&(b?.seated??true);
    a.spentCarrier.position.copy(seat);a.spentCarrier.quaternion.identity();a.spentCarrier.visible=b?.carrier??false;
    a.freshSlug.visible=false;a.freshSlug.position.copy(stow);a.freshSlug.quaternion.copy(slugQ);
    if(!stage||!q)return;
    const p=q.elapsed/stage.duration,phase=stage.phase;
    const lift=phase==='present'?railgunEase(p):phase==='recover'?1-railgunEase(p):1;
    if(firstPerson){assembly.root.position.lerp(present,lift);assembly.root.quaternion.slerp(rotation,lift);}
    if(phase==='eject'&&p>=.18||phase==='pickup'&&q.railgunHadCarrier){
      const seconds=phase==='eject'?(p-.18)*RAILGUN.eject:RAILGUN.eject*.82+p*RAILGUN.pickup;
      const t=Math.max(0,seconds);a.spentCarrier.visible=t<.37;
      a.spentCarrier.position.addScaledVector(acquire.set(-1.7,.8,.15),t);a.spentCarrier.position.y-=2*t*t;
      a.spentCarrier.rotation.set(t*12,t*16,t*9);
      acquire.set(-.15,.120,.145);
    }
    if(phase==='pickup'){
      const reach=railgunEase((p-.25)/.75);a.freshSlug.visible=p>=.25;a.freshSlug.position.lerpVectors(stow,acquire,reach);a.freshSlug.quaternion.slerpQuaternions(identity,slugQ,reach);
    }
    if(phase==='insert'){
      a.freshSlug.visible=true;
      const align=railgunEase(p/.40),lower=railgunEase((p-.40)/.60);
      a.freshSlug.position.lerpVectors(acquire,seat,align);a.freshSlug.position.y=.120+(.039-.120)*lower;
      a.freshSlug.quaternion.slerpQuaternions(slugQ,identity,align);
    }
  };
}

export function createRailgunHandAnimator(){
  const matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),point=new THREE.Vector3(),cover=new THREE.Vector3(),latch=new THREE.Vector3();
  const coverQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-Math.PI/2,0)),flat=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)),slugQ=new THREE.Quaternion(),latchQ=new THREE.Quaternion(),palmOffset=new THREE.Vector3(),contact=new THREE.Vector3();
  const euler=new THREE.Euler(),supportQ=new THREE.Quaternion(),pickup=new THREE.Vector3(-.3285,-.330,.09);
  function part(assembly:WeaponAssembly,name:string,offset:readonly number[]|THREE.Vector3,out:THREE.Vector3){const object=assembly.parts[name];object.updateWorldMatrix(true,false);assembly.root.updateWorldMatrix(true,false);inverse.copy(assembly.root.matrixWorld).invert();matrix.multiplyMatrices(inverse,object.matrixWorld);if(offset instanceof THREE.Vector3)out.copy(offset);else out.fromArray(offset);out.applyMatrix4(matrix);return out;}
  function slugPose(assembly:WeaponAssembly,name:string,blend:number,out:THREE.Vector3,orientation:THREE.Quaternion){
    slugQ.slerpQuaternions(coverQ,flat,blend);
    const angle=blend*Math.PI/2;
    contact.set(-.0155*Math.cos(angle),.0155*Math.sin(angle),-.030-.015*blend);
    palmOffset.set(0,.040,-.023).applyQuaternion(slugQ);contact.sub(palmOffset);
    part(assembly,name,contact,out);orientation.copy(slugQ).premultiply(assembly.parts[name].quaternion);
  }
  return(assembly:WeaponAssembly,state:WeaponSlotState|null|undefined,support:THREE.Vector3,rotation:readonly [number,number,number],target:THREE.Vector3,orientation:THREE.Quaternion)=>{
    const sequence=state?.reloading?state.reloadSequence:undefined,stage=sequence?.kind==='railgun'?sequence.phases[sequence.index]:undefined;if(!stage||!sequence)return;
    const p=sequence.elapsed/stage.duration,phase=stage.phase;supportQ.setFromEuler(euler.set(...rotation));
    part(assembly,'breechCover',RAILGUN.coverGrip,cover);part(assembly,'breechLatch',RAILGUN.latchGrip,latch);
    latchQ.copy(coverQ).premultiply(assembly.parts.breechLatch.quaternion);
    target.copy(latch);orientation.copy(coverQ);
    if(phase==='present'){const next=sequence.phases[1].phase;const contact=next==='pickup'?pickup:next==='close'||next==='lock'||next==='eject'?cover:latch;target.lerpVectors(support,contact,railgunEase(p));orientation.slerpQuaternions(supportQ,next==='unlock'||next==='retract'?latchQ:coverQ,railgunEase(p));}
    else if(phase==='unlock'){target.copy(latch);orientation.copy(latchQ);}
    else if(phase==='retract'){const reach=railgunEase(p/.20);target.lerpVectors(latch,cover,reach);orientation.slerpQuaternions(latchQ,coverQ,reach);}
    else if(phase==='eject'){target.lerpVectors(cover,pickup,railgunEase(p));orientation.copy(coverQ);}
    else if(phase==='pickup'){
      if(p<.25){target.copy(pickup);orientation.copy(coverQ);}
      else{slugPose(assembly,'freshSlug',0,target,orientation);}
    }else if(phase==='insert'){slugPose(assembly,'freshSlug',railgunEase((p-.40)/.30),target,orientation);}
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
