import * as THREE from 'three';
import type { ReloadPhase, ReloadSequence } from './weaponReload';
import type { WeaponAssembly } from './weaponModels';
import type { WeaponSlotState } from './types';

export const LMG = Object.freeze({
  lift: .36, open: .44, eject: .56, pickup: .36, insert: .70,
  feed: .40, slap: .48, chamber: 1, close: .45,
  coverAngle: -1.15, contact: .43, lock: .72, chargeTravel: .050,
  coverPoint: [0, .031, .270] as const,
  palmPoint: [0, .021, -.023] as const,
  boxGrip: [-.086, -.055, .035] as const,
  boxRotation: [-Math.PI/2, -Math.PI/2, 0] as const,
  controlGrip: [-.036, -.020, .065] as const,
  controlRotation: [-Math.PI/2, -Math.PI/2, 0] as const,
  feedWrist: [-.058, .095, -.055] as const,
});
export const lmgEase=(v:number)=>{const p=THREE.MathUtils.clamp(v,0,1);return p*p*(3-2*p);};
export function lmgCoverAngle(phase: ReloadPhase,p:number) {
  if(phase==='lift'||phase==='chamber'||phase==='close')return 0;
  if(phase==='open')return LMG.coverAngle*lmgEase(p);
  if(phase==='slap')return LMG.coverAngle*(1-lmgEase((p-LMG.contact)/(LMG.lock-LMG.contact)));
  return LMG.coverAngle;
}
export const lmgCharge=(p:number)=>LMG.chargeTravel*lmgEase((p-.24)/.18)*(1-lmgEase((p-.46)/.11));
export type LmgEvent='extract'|'seat'|'cover'|'charge';
export type LmgListener=(event:LmgEvent,speed:number,late:number)=>void;
export function lmgCue(phase:ReloadPhase,duration:number):number|undefined {
  return phase==='eject'?duration*.35:phase==='insert'?duration*.70:
    phase==='slap'?duration*LMG.lock:phase==='chamber'?duration*.24:undefined;
}
export function lmgPhaseSeconds(phase:ReloadPhase) {return LMG[phase as keyof typeof LMG] as number;}

/** Restores cached origins; one state clock drives the hinged cover, side box,
 * feed visibility and charging control. No animation clock or runtime mesh. */
export function createLmgAnimator(assembly:WeaponAssembly) {
  const box=assembly.parts.magazine,fresh=assembly.parts.freshMagazine,cover=assembly.parts.feedTray,bolt=assembly.parts.bolt;
  const origin=box.position.clone(),q0=box.quaternion.clone(),hinge=cover.position.clone(),bolt0=bolt.position.clone();
  const carry=new THREE.Vector3(.08,-.25,-.32),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.12,.40,-.12));
  return (state:WeaponSlotState|null|undefined)=>{
    box.position.copy(origin);box.quaternion.copy(q0);box.visible=true;
    fresh.position.copy(origin);fresh.quaternion.copy(q0);fresh.visible=false;
    cover.position.copy(hinge);cover.rotation.set(0,0,0);bolt.position.copy(bolt0);
    const q=state?.reloading?state.reloadSequence:undefined,stage=q?.phases[q.index];
    assembly.parts.feedBelt.visible=true;
    if(!stage||!q)return;
    const p=q.elapsed/stage.duration,phase=stage.phase,exchange=q.phases[0].phase==='lift';
    const lift=phase==='lift'?lmgEase(p):phase==='close'?1-lmgEase(p):exchange?1:lmgEase(p/.20);
    assembly.root.position.lerp(carry,lift);assembly.root.quaternion.slerp(rotation,lift);
    cover.rotation.x=lmgCoverAngle(phase,p);
    if(exchange) {
      if(phase==='eject') {
        const out=lmgEase((p-.35)/.65);box.position.x-=.14*out;box.position.y-=.12*out;
      } else if(phase==='pickup') {
        const stow=lmgEase(p/.45),acquire=lmgEase((p-.45)/.55);
        box.position.x-=.14+.10*stow;box.position.y-=.12+.15*stow;box.visible=p<.45;
        fresh.position.x-=.24-.10*acquire;fresh.position.y-=.27-.15*acquire;fresh.visible=p>=.45;
      } else if(phase==='insert') {
        box.visible=false;fresh.visible=true;
        const approach=lmgEase(p/.70),seat=lmgEase((p-.70)/.30);
        fresh.position.x-=(.14-.025*approach)*(1-seat);fresh.position.y-=.12*(1-approach);
        const hit=Math.sin(Math.PI*THREE.MathUtils.clamp((p-.90)/.10,0,1));assembly.root.position.x+=hit*.004;
      } else if(['feed','slap','chamber','close'].includes(phase)) {box.visible=false;fresh.visible=true;}
      // Hide the complete path before the box detaches; restore only after a
      // seated box and the feed-preparation gesture. Both ends are then fixed.
      assembly.parts.feedBelt.visible=phase==='lift'||phase==='open'||(phase==='eject'&&p<.35)||
        (phase==='feed'&&p>=.55)||phase==='slap'||phase==='chamber'||phase==='close';
    }
    if(phase==='slap') {
      const hit=Math.sin(Math.PI*THREE.MathUtils.clamp((p-LMG.lock)/.20,0,1));
      assembly.root.position.y-=.005*hit;assembly.root.rotation.x+=.012*hit;
    }
    if(phase==='chamber')bolt.position.z+=lmgCharge(p);
  };
}

/** Exact moving-surface contact, with cached matrices. Palm surface (rather
 * than wrist centre) constrains the top-cover opening and downward slap. */
export function createLmgHandAnimator() {
  const inverse=new THREE.Matrix4(),matrix=new THREE.Matrix4(),euler=new THREE.Euler();
  const scale=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),coverWrist=new THREE.Vector3();
  const qa=new THREE.Quaternion(),qb=new THREE.Quaternion(),coverRotation=new THREE.Quaternion();
  const flat=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
  function partPose(assembly:WeaponAssembly,part:THREE.Object3D,offset:readonly number[],rotation:readonly [number,number,number],p:THREE.Vector3,q:THREE.Quaternion) {
    part.updateWorldMatrix(true,false);assembly.root.updateWorldMatrix(true,false);
    inverse.copy(assembly.root.matrixWorld).invert();matrix.multiplyMatrices(inverse,part.matrixWorld);
    p.fromArray(offset).applyMatrix4(matrix);matrix.decompose(a,qa,scale);
    q.setFromEuler(euler.set(...rotation)).premultiply(qa);
  }
  function coverPose(assembly:WeaponAssembly) {
    const cover=assembly.parts.feedTray;cover.updateWorldMatrix(true,false);assembly.root.updateWorldMatrix(true,false);
    inverse.copy(assembly.root.matrixWorld).invert();matrix.multiplyMatrices(inverse,cover.matrixWorld);
    matrix.decompose(a,qa,scale);coverRotation.copy(flat);
    coverWrist.fromArray(LMG.coverPoint).applyMatrix4(matrix);
    a.fromArray(LMG.palmPoint).applyQuaternion(coverRotation);coverWrist.sub(a);
  }
  return (assembly:WeaponAssembly,state:WeaponSlotState|null|undefined,support:THREE.Vector3,supportRotation:THREE.Quaternion,target:THREE.Vector3,orientation:THREE.Quaternion)=>{
    const q=state?.reloading?state.reloadSequence:undefined,stage=q?.phases[q.index];
    if(!q||!stage)return 0;
    const p=q.elapsed/stage.duration,phase=stage.phase;
    coverPose(assembly);
    const heldBox=phase==='pickup'&&p>=.45||['insert','feed','slap','chamber','close'].includes(phase)?assembly.parts.freshMagazine:assembly.parts.magazine;
    // b/qb are the box grip. Scratch a/qa are internal to partPose.
    partPose(assembly,heldBox,LMG.boxGrip,LMG.boxRotation,b,qb);
    target.copy(b);orientation.copy(qb);
    let flatness=0;
    if(phase==='lift') {
      const reach=lmgEase(p);target.lerpVectors(support,coverWrist,reach);orientation.slerpQuaternions(supportRotation,coverRotation,reach);flatness=reach;
    } else if(phase==='open') {target.copy(coverWrist);orientation.copy(coverRotation);flatness=.65;
    } else if(phase==='eject') {
      const reach=lmgEase(p/.32);target.lerpVectors(coverWrist,b,reach);orientation.slerpQuaternions(coverRotation,qb,reach);flatness=1-reach;
    } else if(phase==='feed') {
      const reach=lmgEase(p/.55);target.lerp(b.fromArray(LMG.feedWrist),reach);orientation.slerp(flat,reach);flatness=reach*.75;
    } else if(phase==='slap') {
      target.copy(coverWrist);orientation.copy(coverRotation);flatness=1;
      if(p<LMG.contact) {
        // Present the open glove while raised, then flex palm-down on the
        // descent. The wrist is solved from the palm surface throughout.
        qb.setFromEuler(euler.set(-.15,0,-.25));
        const reach=lmgEase(p/.28),drop=lmgEase((p-.28)/(LMG.contact-.28));
        orientation.slerpQuaternions(flat,qb,reach);orientation.slerp(flat,drop);
        b.copy(coverWrist).add(a.fromArray(LMG.palmPoint).applyQuaternion(flat));
        b.y+=.060*(1-drop);b.sub(a.fromArray(LMG.palmPoint).applyQuaternion(orientation));
        target.lerpVectors(a.fromArray(LMG.feedWrist),b,reach);
      }
    } else if(phase==='chamber') {
      partPose(assembly,assembly.parts.bolt,LMG.controlGrip,LMG.controlRotation,b,qb);
      const reach=lmgEase(p/.23);target.lerpVectors(q.phases[0].phase==='chamber'?support:coverWrist,b,reach);orientation.slerpQuaternions(q.phases[0].phase==='chamber'?supportRotation:coverRotation,qb,reach);flatness=1-reach;
      const recover=lmgEase((p-.70)/.30);target.lerp(support,recover);orientation.slerp(supportRotation,recover);
    } else if(phase==='close') {
      if(q.empty){coverWrist.copy(support);coverRotation.copy(supportRotation);}
      const recover=lmgEase(p);target.lerpVectors(coverWrist,support,recover);orientation.slerpQuaternions(coverRotation,supportRotation,recover);flatness=q.empty?0:1-recover;
    }
    return flatness;
  };
}

export function lmgReloadStatus(state:WeaponSlotState) {
  if(state.reloading) {
    const phase=state.reloadSequence?.phases[state.reloadSequence.index]?.phase;
    return phase==='slap'?'LOCKING FEED COVER…':phase==='chamber'?'CHAMBERING…':'RELOADING…';
  }
  return state.needsChamber?'[R] CHARGE WEAPON':'';
}
