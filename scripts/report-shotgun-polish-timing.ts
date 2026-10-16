import {writeFileSync} from 'node:fs';
import {SHOTGUN,beginShotgunCycle,shotgunPumpStroke} from '../src/shotgunMechanics';
import {beginWeaponReload,advanceWeaponReload} from '../src/weaponReload';
import {WEAPONS} from '../src/weapons';
import type {WeaponSlotState} from '../src/types';
const gun=WEAPONS.find(w=>w.id==='shotgun')!;
const rates=[30,60,144].map(hz=>{
 const state:WeaponSlotState={ammo:5,reserve:14},events:object[]=[];beginShotgunCycle(state);let time=0;
 while(state.shotgunCycle){time+=1/hz;advanceWeaponReload(gun,state,1/hz,undefined,(event,duration,empty,late)=>events.push({event,simulationBoundary:time-late,observedFrame:time,late,duration}));}
 return {hz,events,firstReadyFrame:time,firstFireIntervalFrame:Math.ceil(gun.fireRate!*hz)/hz,ammo:state.ammo,reserve:state.reserve,needsChamber:state.needsChamber};
});
const reloads=[1,.75,.9].flatMap(speed=>[0,2].map(ammo=>{
 const state:WeaponSlotState={ammo,reserve:14},events:object[]=[];beginWeaponReload(gun,state,speed);const duration=state.totalReloadT;let time=0;
 while(state.reloading){time+=1/144;advanceWeaponReload(gun,state,1/144,undefined,(event,clipWindow,empty,late)=>events.push({event,simulationBoundary:time-late,observedFrame:time,clipWindow,ammo:state.ammo,reserve:state.reserve,needsChamber:state.needsChamber}));}
 return {speed,initialAmmo:ammo,duration,events,finalAmmo:state.ammo,reserve:state.reserve};
}));
const report={units:'simulation seconds; observed frame quantization shown separately from exact boundaries',before:{recovery:.18,rearward:.23,rearStop:.03,forward:.22,settle:.08,cycle:.74,fireInterval:.85,rollRadians:-1.25},after:{...SHOTGUN,fireInterval:gun.fireRate,rollRadians:-.52},strokeSamples:[0,.18,.31,.32,.42,.52,.53,.54,.65,.76,.80,.84].map(seconds=>({seconds,metres:shotgunPumpStroke(seconds)})),rates,reloads};
const json=JSON.stringify(report,null,2)+'\n';if(process.argv[2])writeFileSync(process.argv[2],json);else process.stdout.write(json);
