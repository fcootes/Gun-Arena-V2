import * as THREE from 'three';
import type {WeaponSlotState} from './types';

/** Metres in weapon space; every reload contact runs on the gameplay clock. */
export const PLASMA=Object.freeze({
 capacity:60,reserve:180,interval:.125,speed:200,range:130,heatPerShot:2.5,cooling:16,vent:1.25,reload:2.20,
 cylinder:[-.008,.024,-.066] as const, cylinderRadius:.024,cylinderHalfLength:.103,
 upperHinge:[-.053,.080,-.066] as const,lowerHinge:[-.053,-.045,-.066] as const,doorAngle:86*Math.PI/180,
 freshStart:[-.24,-.22,-.066] as const,freshAlign:[-.16,.024,-.066] as const,freshContact:[-.080,.024,-.066] as const,
 carry:[.125,-.222,-.416] as const,rotation:[.025,.08,-.18] as const,
 ejectTime:.58,seatTime:1.58,ejectionLifetime:.66,
 swap:[['present',.38],['open',.20],['eject',.20],['insert',.57],['slap',.23],['close',.30],['recover',.32]] as const,
 thermal:[['present',.15],['unlock',.15],['open',.20],['vent',.50],['close',.15],['recover',.10]] as const,
});
export interface PlasmaState {
 upperDoor:number;lowerDoor:number;release:number;lock:number;shutters:number;
 cartridgeInstalled:boolean;
 /** -1 means inactive; one reusable cosmetic cylinder, never a pickup/projectile. */
 ejectionAge:number;
}
export const createPlasmaState=(installed=true):PlasmaState=>({upperDoor:0,lowerDoor:0,release:0,lock:installed?1:0,shutters:0,cartridgeInstalled:installed,ejectionAge:-1});
export type PlasmaEvent='chamber_release'|'doors_open'|'cylinder_eject'|'cylinder_align'|'cylinder_seat'|'doors_close'|'ready'|'cooling_pulse'|'thermal_open'|'thermal_close';
export type PlasmaListener=(event:PlasmaEvent,speed:number,late:number)=>void;
export const plasmaEase=(p:number)=>{p=THREE.MathUtils.clamp(p,0,1);return p*p*(3-2*p);};
export function plasmaDamageFalloff(distance:number){return distance<=60?1:Math.max(.40,1-((distance-60)/60)*.60);}
export function sealedReserve(charges:number){return Math.max(0,Math.floor((Number.isFinite(charges)?charges:0)/60)*60);}
/** A pickup is a sealed cartridge: reconcile arbitrary legacy charge grants once. */
export function addPlasmaSupply(state:Pick<WeaponSlotState,'reserve'>,charges:number){state.reserve=sealedReserve(state.reserve??0)+(Number.isFinite(charges)?Math.max(0,Math.ceil(charges/60))*60:0);}
export function plasmaReady(s:WeaponSlotState){const b=s.plasma;return !s.reloading&&!s.overheated&&(s.heat??0)<100&&(s.ammo??0)>0&&(!b||(b.cartridgeInstalled&&b.lock===1&&b.upperDoor<1e-8&&b.lowerDoor<1e-8&&b.release<1e-8&&b.shutters<1e-8));}
export function beginPlasmaAction(s:WeaponSlotState,multiplier=1,force?:'swap'|'vent'){
 if(s.reloading)return false;
 const reserve=sealedReserve(s.reserve??0),ammo=THREE.MathUtils.clamp(s.ammo??60,0,60);
 const heat=s.heat??0,spare=reserve>=60;
 const mode=s.overheated?'vent':force??((ammo===0&&spare)?'swap':heat>=65?'vent':ammo<60&&spare?'swap':ammo===60&&heat>=10?'vent':undefined);
 if(!mode||mode==='swap'&&(!spare||ammo===60)||mode==='vent'&&heat<=0&&!s.overheated)return false;
 if(mode==='swap'){s.reserve=reserve;s.ammo=ammo;}
 const physical=s.plasma??=createPlasmaState();physical.ejectionAge=-1;
 const speed=Math.max(.1,Number.isFinite(multiplier)?multiplier:1);
 const phases=(mode==='swap'?PLASMA.swap:PLASMA.thermal).map(([phase,duration])=>({phase,duration:duration*speed}));
 s.reloadSequence={kind:mode==='swap'?'plasmaSwap':'plasmaVent',phases,index:0,elapsed:0,empty:s.ammo===0,shellsRemaining:0,inserted:0,plasmaHadCylinder:physical.cartridgeInstalled,plasmaStartHeat:heat,plasmaSpeed:speed};
 s.reloading=true;s.totalReloadT=phases.reduce((n,p)=>n+p.duration,0);s.reloadT=s.totalReloadT;s.plasmaCooldown=PLASMA.interval;s.isTacticalReload=s.ammo>0;return true;
}
/** Recovery closes/locks the actual installed cartridge; resources never roll back. */
function closePlasmaMechanism(b:PlasmaState){b.upperDoor=b.lowerDoor=b.release=b.shutters=0;b.lock=b.cartridgeInstalled?1:0;b.ejectionAge=-1;}
export function cancelPlasmaAction(s:WeaponSlotState){if(s.plasma)closePlasmaMechanism(s.plasma);s.plasmaCooldown=PLASMA.interval;}
export function advancePlasmaAction(s:WeaponSlotState,delta:number,onContact?:PlasmaListener){
 const q=s.reloadSequence;if(!s.reloading||!q||!['plasmaSwap','plasmaVent'].includes(q.kind)||!Number.isFinite(delta)||delta<=0)return 0;
 const b=s.plasma!;let remaining=delta,inserted=0;
 while(remaining>1e-10&&s.reloading){
  const stage=q.phases[q.index],step=Math.min(remaining,stage.duration-q.elapsed);q.elapsed+=step;remaining-=step;s.reloadT=Math.max(0,s.reloadT!-step);
  const raw=q.elapsed/stage.duration,p=plasmaEase(raw);
  if(b.ejectionAge>=0)b.ejectionAge+=step/q.plasmaSpeed!;
  if(q.kind==='plasmaSwap'){
   if(stage.phase==='present')b.release=plasmaEase((raw-.80)/.20);
   if(stage.phase==='open'){b.upperDoor=p;b.lowerDoor=plasmaEase((raw-.08)/.92);b.lock=1-p;}
   if(stage.phase==='slap')b.lock=p;
   if(stage.phase==='close'){b.upperDoor=b.lowerDoor=1-plasmaEase((raw-.20)/.80);b.release=1-p;}
  }else{
   b.upperDoor=b.lowerDoor=b.release=0;
   if(stage.phase==='open')b.shutters=p;
   if(stage.phase==='vent'){b.shutters=1;s.heat=Math.max(0,q.plasmaStartHeat!*(1-p));}
   if(stage.phase==='close')b.shutters=1-p;
  }
  if(q.elapsed+1e-8<stage.duration)break;
  if(q.kind==='plasmaSwap'){
   if(stage.phase==='open'){
    // Both doors are fully clear before the installed cylinder is released.
    s.ammo=0;b.cartridgeInstalled=false;b.ejectionAge=q.plasmaHadCylinder?0:-1;
    onContact?.('doors_open',q.plasmaSpeed!,remaining);onContact?.('cylinder_eject',q.plasmaSpeed!,remaining);
   }
   if(stage.phase==='slap'&&q.inserted===0&&(s.reserve??0)>=60){s.reserve!-=60;s.ammo=60;b.cartridgeInstalled=true;b.lock=1;q.inserted=60;inserted=60;onContact?.('cylinder_seat',q.plasmaSpeed!,remaining);}
   const event=stage.phase==='present'?'chamber_release':stage.phase==='insert'?'cylinder_align':stage.phase==='close'?'doors_close':stage.phase==='recover'?'ready':undefined;
   if(event)onContact?.(event,q.plasmaSpeed!,remaining);
  }else if(stage.phase==='open'){onContact?.('thermal_open',q.plasmaSpeed!,remaining);onContact?.('cooling_pulse',q.plasmaSpeed!,remaining);}
  else if(stage.phase==='close')onContact?.('thermal_close',q.plasmaSpeed!,remaining);
  q.index++;q.elapsed=0;
  if(q.index===q.phases.length){if(q.kind==='plasmaVent'){s.heat=0;s.overheated=false;}closePlasmaMechanism(b);s.reloading=false;s.reloadT=0;s.reloadSequence=undefined;}
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
/** Independent authoritative display values, also used by geometry verification. */
export function plasmaAmmoSegment(ammo:number,index:number){return THREE.MathUtils.clamp(ammo/10-index,0,1);}
export function plasmaHeatColour(heat:number,out:THREE.Color){
 const h=THREE.MathUtils.clamp(heat,0,100);
 if(h<30)return out.setRGB(.12,.24,.25);
 if(h<60)return out.setRGB(.12+(.88*(h-30)/30),.24+.14*(h-30)/30,.25*(1-(h-30)/30));
 if(h<85)return out.setRGB(1,.38-.22*(h-60)/25,0);
 return out.setRGB(1,.16*(1-(h-85)/15),0);
}
