import * as THREE from 'three';
import type {Bot} from './types';
import type {CombatSystemsContext} from './gameLoop';
import {PLASMA,plasmaDamageFalloff} from './plasmaMechanics';
export interface PlasmaBolt {active:boolean;position:THREE.Vector3;direction:THREE.Vector3;distance:number;life:number;team:string;owner:'player'|Bot|null;damage:number;headshot:number;}
/** Segment/box slab entry. Used for solid bounds and relative moving-target sweeps. */
export function plasmaBoxEntry(origin:THREE.Vector3,delta:THREE.Vector3,b:{minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}){
 let lo=0,hi=1;
 for(let axis=0;axis<3;axis++){
  const p=axis===0?origin.x:axis===1?origin.y:origin.z,d=axis===0?delta.x:axis===1?delta.y:delta.z;
  const min=axis===0?b.minX:axis===1?b.minY:b.minZ,max=axis===0?b.maxX:axis===1?b.maxY:b.maxZ;
  if(Math.abs(d)<1e-10){if(p<min||p>max)return Infinity;continue;}
  let a=(min-p)/d,c=(max-p)/d;if(a>c){const temp=a;a=c;c=temp;}lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity;
 }
 return lo;
}
export function createPlasmaProjectilePool(scene:THREE.Scene,capacity=192){
 const coreGeometry=new THREE.SphereGeometry(1,6,4),coreMaterial=new THREE.MeshBasicMaterial({color:0xd7ffff,toneMapped:false});
 const haloGeometry=new THREE.SphereGeometry(1,6,4),haloMaterial=new THREE.MeshBasicMaterial({color:0x37cddd,transparent:true,opacity:.33,depthWrite:false,toneMapped:false});
 const impactMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 const cores=new THREE.InstancedMesh(coreGeometry,coreMaterial,capacity),halos=new THREE.InstancedMesh(haloGeometry,haloMaterial,capacity),impacts=new THREE.InstancedMesh(haloGeometry,impactMaterial,32);
 const impactColor=new THREE.Color();for(let n=0;n<32;n++)impacts.setColorAt(n,impactColor);impacts.instanceColor!.setUsage(THREE.DynamicDrawUsage);
 const root=new THREE.Group();root.name='PR100ProjectilePool';root.add(cores,halos,impacts);scene.add(root);
 for(const mesh of [cores,halos,impacts]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;}
 const bolts:PlasmaBolt[]=Array.from({length:capacity},()=>({active:false,position:new THREE.Vector3(),direction:new THREE.Vector3(),distance:0,life:0,team:'',owner:null,damage:0,headshot:1}));
 const flashes=Array.from({length:32},()=>({position:new THREE.Vector3(),life:0}));let flashIndex=0,disposed=false;
 const ray=new THREE.Raycaster(),hits:THREE.Intersection[]=[],delta=new THREE.Vector3(),direction=new THREE.Vector3(),relative=new THREE.Vector3(),relativeDelta=new THREE.Vector3(),point=new THREE.Vector3(),normal=new THREE.Vector3(0,0,1),scale=new THREE.Vector3(),matrix=new THREE.Matrix4(),quat=new THREE.Quaternion();
 const previous=new Map<number,THREE.Vector3>(),playerPrevious=new THREE.Vector3();let sampledPlayer=false;
 const bodyBox={minX:-.30,maxX:.30,minY:0,maxY:1.45,minZ:-.30,maxZ:.30},headBox={minX:-.22,maxX:.22,minY:1.45,maxY:1.92,minZ:-.22,maxZ:.22};
 function flash(position:THREE.Vector3){const f=flashes[flashIndex++%flashes.length];f.position.copy(position);f.life=.16;}
 function solidFraction(from:THREE.Vector3,step:THREE.Vector3,ctx:CombatSystemsContext){let t=Infinity;for(const box of ctx.world.worldColliders)if(box.active&&box.maxX>=Math.min(from.x,from.x+step.x)&&box.minX<=Math.max(from.x,from.x+step.x)&&box.maxZ>=Math.min(from.z,from.z+step.z)&&box.minZ<=Math.max(from.z,from.z+step.z))t=Math.min(t,plasmaBoxEntry(from,step,box));return t;}
 function spawn(origin:THREE.Vector3,target:THREE.Vector3,team:string,owner:'player'|Bot,damage=12,headshot=1.7,eye?:THREE.Vector3,ctx?:CombatSystemsContext){
  if(disposed)return false;const b=bolts.find(b=>!b.active);if(!b)return false;
  if(eye&&ctx){delta.subVectors(origin,eye);let t=solidFraction(eye,delta,ctx);const d=delta.length();if(d>1e-8){ray.set(eye,direction.copy(delta).normalize());ray.near=0;ray.far=d;hits.length=0;ray.intersectObjects(ctx.world.hittableObjects,false,hits);for(const h of hits)if(h.object.userData.type!=='botpart'&&h.object.userData.type!=='pickup')t=Math.min(t,h.distance/d);}if(t<=1){point.copy(eye).addScaledVector(delta,t);flash(point);return true;}}
  b.active=true;b.position.copy(origin);b.direction.subVectors(target,origin).normalize();b.team=team;b.owner=owner;b.damage=damage;b.headshot=headshot;b.distance=0;b.life=PLASMA.range/PLASMA.speed+.05;return true;
 }
 function update(dt:number,ctx:CombatSystemsContext){
  if(disposed||!Number.isFinite(dt)||dt<=0)return;
  // Resolve world and hit-part intersections together, then compare against
  // active solid bounds and moving actor sweeps. Walls always win nearest ties.
  for(const b of bolts){if(!b.active)continue;
   const length=Math.min(PLASMA.speed*dt,PLASMA.range-b.distance);delta.copy(b.direction).multiplyScalar(length);
   let fraction=solidFraction(b.position,delta,ctx),target:Bot|'player'|null=null,head=false;
   hits.length=0;ray.set(b.position,b.direction);ray.near=0;ray.far=length;
   ray.intersectObjects(ctx.world.hittableObjects,false,hits);if(!ctx.world.hittableObjects.includes(ctx.world.terrainMesh))ray.intersectObject(ctx.world.terrainMesh,false,hits);
   for(const hit of hits){const ud=hit.object.userData;if(ud.type==='pickup'||ud.type==='projectile')continue;
    const bot=ud.type==='botpart'?ud.ref as Bot:undefined;
    if(bot&&(bot===b.owner||!bot.alive||bot.userData?.boarded||bot.userData?.entranceActive))continue;
    const t=hit.distance/length;if(t<fraction-1e-8){fraction=t;target=bot??null;head=ud.part==='head';}
   }
   for(const bot of ctx.bots){if(bot===b.owner||!bot.alive||bot.userData?.boarded||bot.userData?.entranceActive)continue;
    const prev=previous.get(bot.id);if(!prev||prev.distanceToSquared(bot.pos)<1e-6)continue;
    relative.subVectors(b.position,prev);relativeDelta.copy(delta).sub(direction.subVectors(bot.pos,prev));
    const h=plasmaBoxEntry(relative,relativeDelta,headBox),t=Math.min(h,plasmaBoxEntry(relative,relativeDelta,bodyBox));
    if(t<fraction-1e-8){fraction=t;target=bot;head=h<=t;}
   }
   if(b.owner!=='player'&&ctx.player.alive){
    const prev=sampledPlayer?playerPrevious:ctx.player.pos;relative.subVectors(b.position,prev);relative.y+=1.65;
    relativeDelta.copy(delta).sub(direction.subVectors(ctx.player.pos,prev));
    const h=plasmaBoxEntry(relative,relativeDelta,headBox),t=Math.min(h,plasmaBoxEntry(relative,relativeDelta,bodyBox));
    if(t<fraction-1e-8){fraction=t;target='player';head=h<=t;}
   }
   b.position.addScaledVector(delta,Math.min(1,fraction));b.distance+=length*Math.min(1,fraction);b.life-=dt;
   if(fraction<=1){
    flash(b.position);
    const owner=b.owner;
    if(target==='player'&&owner&&owner!=='player'&&ctx.player.team!==b.team)ctx.player.applyDamage(b.damage*plasmaDamageFalloff(b.distance)*(head?b.headshot:1),false,false,owner);
    else if(target&&target!=='player'&&target.team!==b.team&&owner){ctx.damageBot(target,b.damage*plasmaDamageFalloff(b.distance)*(head?b.headshot:1),head,owner,b.direction);if(owner==='player')ctx.onPlasmaHit?.(target,head,b.position);}
    b.active=false;b.owner=null;
   }else if(b.life<=0||b.distance>=PLASMA.range-1e-8){b.active=false;b.owner=null;}
  }
  for(const bot of ctx.bots){if(!bot.alive){previous.delete(bot.id);continue;}let p=previous.get(bot.id);if(!p){p=new THREE.Vector3();previous.set(bot.id,p);}p.copy(bot.pos);}
  for(const id of previous.keys())if(!ctx.bots.some(b=>b.id===id&&b.alive))previous.delete(id);
  playerPrevious.copy(ctx.player.pos);sampledPlayer=true;
  render(dt);
 }
 function render(dt=0){let n=0;for(const b of bolts)if(b.active){quat.setFromUnitVectors(normal,b.direction);scale.set(.035,.035,.12);matrix.compose(b.position,quat,scale);cores.setMatrixAt(n,matrix);scale.set(.065,.065,.28);matrix.compose(b.position,quat,scale);halos.setMatrixAt(n++,matrix);}cores.count=halos.count=n;
  let f=0;for(const flash of flashes){flash.life=Math.max(0,flash.life-dt);if(flash.life>0){scale.setScalar(.035+(.16-flash.life)*.7);matrix.compose(flash.position,quat.identity(),scale);impacts.setMatrixAt(f,matrix);impactColor.setRGB(.25,.8,1).multiplyScalar(flash.life/.16);impacts.setColorAt(f++,impactColor);}}impacts.count=f;impacts.instanceColor!.needsUpdate=true;
  cores.instanceMatrix.needsUpdate=halos.instanceMatrix.needsUpdate=impacts.instanceMatrix.needsUpdate=true;
 }
 function clear(){bolts.forEach(b=>{b.active=false;b.owner=null;});flashes.forEach(f=>f.life=0);previous.clear();sampledPlayer=false;cores.count=halos.count=impacts.count=0;}
 function dispose(){if(disposed)return;clear();disposed=true;root.removeFromParent();cores.dispose();halos.dispose();impacts.dispose();coreGeometry.dispose();haloGeometry.dispose();coreMaterial.dispose();haloMaterial.dispose();impactMaterial.dispose();root.clear();}
 return {root,bolts,spawn,update,render,clear,dispose,get activeCount(){return bolts.reduce((n,b)=>n+Number(b.active),0);}};
}
