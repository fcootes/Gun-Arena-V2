import * as THREE from 'three';
import type {WeaponSlotState} from './types';
import type {ReloadPhase,ReloadSequence} from './weaponReload';
export const PLASMA=Object.freeze({capacity:60,reserve:180,interval:.125,speed:200,range:130,heatPerShot:2.5,cooling:16,vent:1.25,reload:2.8,trayTravel:.140,
  cylinder:[-.077,.031,-.066] as const,carry:[.10,-.215,-.415] as const,rotation:[.04,.10,-.22] as const,
  swap:[['present',.22],['unlock',.23],['open',.42],['vent',.20],['eject',.35],['insert',.44],['close',.46],['lock',.22],['recover',.26]] as const,
  thermal:[['present',.15],['unlock',.15],['open',.20],['vent',.50],['close',.15],['recover',.10]] as const});
export interface PlasmaState {tray:number;latch:number;shutters:number;loaded:boolean;}
export type PlasmaListener=(event:PlasmaEvent,speed:number,late:number)=>void;
export type PlasmaEvent='tray_unlock'|'tray_open'|'cooling_pulse'|'cylinder_remove'|'cylinder_seat'|'tray_close'|'tray_lock'|'thermal_open'|'thermal_close';
export const plasmaEase=(p:number)=>{p=THREE.MathUtils.clamp(p,0,1);return p*p*(3-2*p);};
export function plasmaDamageFalloff(distance:number){return distance<=60?1:Math.max(.40,1-((distance-60)/60)*.60);}
export function sealedReserve(charges:number){return Math.max(0,Math.floor((Number.isFinite(charges)?charges:0)/60)*60);}
/** A pickup is a sealed cartridge: reconcile arbitrary legacy charge grants once. */
export function addPlasmaSupply(state:Pick<WeaponSlotState,'reserve'>,charges:number){state.reserve=sealedReserve(state.reserve??0)+(Number.isFinite(charges)?Math.max(0,Math.ceil(charges/60))*60:0);}
export function plasmaReady(s:WeaponSlotState){const b=s.plasma;return !s.reloading&&!s.overheated&&(s.heat??0)<100&&(s.ammo??0)>0&&(!b||(b.loaded&&b.tray<1e-8&&b.latch<1e-8&&b.shutters<1e-8));}
export function beginPlasmaAction(s:WeaponSlotState,multiplier=1,force?:'swap'|'vent'){
  if(s.reloading)return false;
  s.reserve=sealedReserve(s.reserve??0);s.ammo=THREE.MathUtils.clamp(s.ammo??60,0,60);
  const heat=s.heat??0,spare=s.reserve>=60;
  const mode=s.overheated?'vent':force??((s.ammo===0&&spare)?'swap':heat>=65?'vent':s.ammo<60&&spare?'swap':s.ammo===60&&heat>=10?'vent':undefined);
  if(!mode||mode==='swap'&&(!spare||s.ammo===60)||mode==='vent'&&heat<=0&&!s.overheated)return false;
  const physical=s.plasma??={tray:0,latch:0,shutters:0,loaded:true};
  const speed=Math.max(.1,Number.isFinite(multiplier)?multiplier:1);
  const phases=(mode==='swap'?PLASMA.swap:PLASMA.thermal).map(([phase,duration])=>({phase,duration:duration*speed}));
  s.reloadSequence={kind:mode==='swap'?'plasmaSwap':'plasmaVent',phases,index:0,elapsed:0,empty:s.ammo===0,shellsRemaining:0,inserted:0,plasmaHadCylinder:physical.loaded,plasmaStartHeat:heat,plasmaSpeed:speed,plasmaEvents:0};
  s.reloading=true;s.totalReloadT=phases.reduce((n,p)=>n+p.duration,0);s.reloadT=s.totalReloadT;s.plasmaCooldown=PLASMA.interval;s.isTacticalReload=s.ammo>0;return true;
}
export function cancelPlasmaAction(s:WeaponSlotState){if(s.plasma){s.plasma.tray=0;s.plasma.latch=0;s.plasma.shutters=0;}s.plasmaCooldown=PLASMA.interval;}
export function advancePlasmaAction(s:WeaponSlotState,delta:number,onContact?:PlasmaListener){
 const q=s.reloadSequence;if(!s.reloading||!q||!['plasmaSwap','plasmaVent'].includes(q.kind)||!Number.isFinite(delta)||delta<=0)return 0;
 const b=s.plasma!;let remaining=delta,inserted=0;
 while(remaining>1e-10&&s.reloading){
  const stage=q.phases[q.index],step=Math.min(remaining,stage.duration-q.elapsed);q.elapsed+=step;remaining-=step;s.reloadT=Math.max(0,s.reloadT!-step);
  const p=plasmaEase(q.elapsed/stage.duration);
  if(q.kind==='plasmaSwap'){
   if(stage.phase==='unlock')b.latch=p;
   if(stage.phase==='open')b.tray=plasmaEase((q.elapsed/stage.duration-.25)/.75);
   if(stage.phase==='close')b.tray=1-plasmaEase((q.elapsed/stage.duration-.23)/.77);
   if(stage.phase==='lock')b.latch=1-p;
  }else{
   b.tray=0;b.latch=0;
   if(stage.phase==='open')b.shutters=p;
   if(stage.phase==='vent'){b.shutters=1;s.heat=Math.max(0,q.plasmaStartHeat!*(1-p));}
   if(stage.phase==='close')b.shutters=1-p;
  }
  if(q.elapsed+1e-8<stage.duration)break;
  if(q.kind==='plasmaSwap'&&stage.phase==='eject'){s.ammo=0;b.loaded=false;}
  if(q.kind==='plasmaSwap'&&stage.phase==='insert'&&q.inserted===0&&(s.reserve??0)>=60){s.reserve!-=60;s.ammo=60;b.loaded=true;q.inserted=60;inserted=60;}
  if(q.kind==='plasmaSwap'){
    const event=stage.phase==='unlock'?'tray_unlock':stage.phase==='open'?'tray_open':stage.phase==='eject'?'cylinder_remove':stage.phase==='insert'?'cylinder_seat':stage.phase==='close'?'tray_close':stage.phase==='lock'?'tray_lock':undefined;
    if(event)onContact?.(event,q.plasmaSpeed!,remaining);if(stage.phase==='open')onContact?.('cooling_pulse',q.plasmaSpeed!,remaining);
  }else if(stage.phase==='open'){onContact?.('thermal_open',q.plasmaSpeed!,remaining);onContact?.('cooling_pulse',q.plasmaSpeed!,remaining);}
  else if(stage.phase==='close')onContact?.('thermal_close',q.plasmaSpeed!,remaining);
  q.index++;q.elapsed=0;
  if(q.index===q.phases.length){if(q.kind==='plasmaVent'){s.heat=0;s.overheated=false;}b.tray=b.latch=b.shutters=0;s.reloading=false;s.reloadT=0;s.reloadSequence=undefined;}
 }
 return inserted;
}
export function advancePlasmaCooling(s:WeaponSlotState,dt:number){
 if(!Number.isFinite(dt)||dt<=0)return;
 if((s.heat??0)>=100)s.overheated=true;
 s.plasmaIdle=(s.plasmaIdle??1)+dt;
 if(s.plasmaIdle>.15&&s.reloadSequence?.kind!=='plasmaVent')s.heat=Math.max(0,(s.heat??0)-PLASMA.cooling*dt);
}
/** Simulation cadence; at most two due shots after a stall, with backlog dropped.
 * Resource mutation follows successful pool acquisition, never attempted shots. */
export function advancePlasmaFire(s:WeaponSlotState,dt:number,held:boolean,launch:()=>boolean,rateMultiplier=1){
 if(!Number.isFinite(dt)||dt<=0)return 0;
 const interval=PLASMA.interval*Math.max(1,rateMultiplier);
 s.plasmaCooldown=Math.max(-interval,(s.plasmaCooldown??interval)-Math.min(dt,interval*2));
 if(!held||!plasmaReady(s)){s.plasmaCooldown=Math.max(0,s.plasmaCooldown);return 0;}
 let count=0;
 while(s.plasmaCooldown<=1e-8&&count<2&&plasmaReady(s)){
  if(!launch()){s.plasmaCooldown=interval;break;}
  s.ammo!--;s.heat=Math.min(100,(s.heat??0)+PLASMA.heatPerShot);s.plasmaIdle=0;s.plasmaCooldown+=interval;count++;
  if(s.heat>=100)s.overheated=true;
 }
 return count;
}
export function plasmaActionPhase(s:WeaponSlotState){const q=s.reloadSequence;return q&&['plasmaSwap','plasmaVent'].includes(q.kind)?q.phases[q.index]:undefined;}
