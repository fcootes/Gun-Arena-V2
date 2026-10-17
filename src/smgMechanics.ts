import * as THREE from 'three';
import type { WeaponAssembly } from './weaponModels';
import type { WeaponSlotState } from './types';

/** SMG-only presentation and player timings. Existing composite audio runs at
 * native speed after the reach; its manifest cues are the action landmarks. */
export const SMG = Object.freeze({
  tactical: { open: .24, eject: .2808, insert: .6318, close: .4474 },
  empty: { open: .26, eject: .396, insert: .790, chamber: .497, close: .297 },
  travel: .034, fireTravel: .012,
  magazineGrip: [-.034, -.056, .018] as const,
  magazineRotation: [-Math.PI / 2, -Math.PI / 2, 0] as const,
  chargingGrip: [-.033, -.020, .065] as const,
  chargingRotation: [-Math.PI / 2, -Math.PI / 2, 0] as const,
  tacticalClip: 1.1232083333333334, emptyClip: 1.98, chamberOffset: 1.186,
});
export const smgEase = (v: number) => { const t = THREE.MathUtils.clamp(v, 0, 1); return t*t*(3-2*t); };
export const smgStroke = (p: number) => SMG.travel * smgEase((p-.306)/.264) * (1-smgEase((p-.64)/.31));
export const smgReach = (p: number) => smgEase(p/.30);
export const smgSwap = .18;
export function smgSeatStart(empty: boolean) { return empty ? .546/.790 : (.5276041666666667-.2808)/.6318; }

/** All transforms are restored from cached model-space origins every tick. */
export function createSmgAnimator(assembly: WeaponAssembly) {
  const old=assembly.parts.magazine, fresh=assembly.parts.freshMagazine, bolt=assembly.parts.bolt;
  const origin=old.position.clone(), rotation=old.quaternion.clone(), boltOrigin=bolt.position.clone();
  const carry=new THREE.Vector3(.115,-.155,-.345);
  const tilt=new THREE.Quaternion().setFromEuler(new THREE.Euler(.06,.12,-.30));
  return (state: WeaponSlotState | null | undefined, firing: number) => {
    old.position.copy(origin);old.quaternion.copy(rotation);old.visible=true;
    fresh.position.copy(origin);fresh.quaternion.copy(rotation);fresh.visible=false;
    bolt.position.copy(boltOrigin);
    const q=state?.reloading ? state.reloadSequence : undefined, stage=q?.phases[q.index];
    if (!q || !stage) { bolt.position.z += SMG.fireTravel*Math.max(0,firing);return; }
    const p=q.elapsed/stage.duration;
    const lift=stage.phase==='open'?smgEase(p):stage.phase==='close'?1-smgEase(p):1;
    assembly.root.position.lerp(carry,lift);assembly.root.quaternion.slerp(tilt,lift);
    if(stage.phase==='eject') {
      const extract=smgEase((p-(q.empty ? .166/.396 : 0))/(q.empty?1-.166/.396:1));
      old.position.y-=.135*extract;
    } else if(stage.phase==='insert') {
      const side=q.empty ? .16 : .08, drop=q.empty ? .20 : .10;
      const stow=smgEase(p/.16), acquire=smgEase((p-smgSwap)/(smgSeatStart(q.empty)-smgSwap));
      old.position.set(origin.x-side*stow,origin.y-.135-drop*stow,origin.z);
      old.visible=p<smgSwap;
      fresh.position.set(origin.x-side*(1-acquire),origin.y-.135-drop*(1-acquire),origin.z);
      fresh.visible=p>=smgSwap;
      const seat=smgEase((p-smgSeatStart(q.empty))/(1-smgSeatStart(q.empty)));
      fresh.position.y+=(origin.y-fresh.position.y)*seat;
      const impulse=Math.sin(Math.PI*THREE.MathUtils.clamp((p-.92)/.08,0,1));
      assembly.root.position.y+=.004*impulse;assembly.root.rotation.x-=.012*impulse;
    } else if(q.phases.some(s=>s.phase==='insert') && stage.phase!=='open') {
      old.visible=false;fresh.visible=true;
    }
    if(stage.phase==='chamber') bolt.position.z+=smgStroke(p);
  };
}
