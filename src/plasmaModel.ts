import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
type Finish=Record<'steel'|'dark'|'polymer'|'rubber'|'edge'|'glow'|'ceramic',THREE.MeshStandardMaterial>;
/** PR-100 exterior follows approved panels 1–2; tray and cooling are independent. */
export function buildPlasmaModel(body:THREE.Group,parts:Record<string,THREE.Object3D>,m:Finish){
 const {steel,dark,polymer,rubber,edge,glow,ceramic}=m;
 steel.color.setHex(0x505c63);steel.metalness=.7;steel.roughness=.48;dark.color.setHex(0x20292e);dark.roughness=.65;polymer.color.setHex(0x283236);polymer.roughness=.85;edge.color.setHex(0x9baeb3);glow.color.setHex(0x41b7bf);glow.emissive.setHex(0x1f9dab);glow.emissiveIntensity=.45;
 function group(name:string,x=0,y=0,z=0,parent:THREE.Object3D=body){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);parts[name]=g;return g;}
 function mesh(name:string,g:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=body){const o=new THREE.Mesh(g,mat);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 function box(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material,parent:THREE.Object3D=body){return mesh(name,new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.15),mat,x,y,z,parent);}
 function tube(name:string,r:number,length:number,x:number,y:number,z:number,mat:THREE.Material,parent:THREE.Object3D=body,open=false){const o=mesh(name,new THREE.CylinderGeometry(r,r,length,12,1,open),mat,x,y,z,parent);o.rotation.x=Math.PI/2;return o;}
 function profile(name:string,points:number[][],width:number,mat:THREE.Material,parent:THREE.Object3D=body){const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:2,bevelSize:.002,bevelThickness:.002,steps:1});g.rotateY(-Math.PI/2);g.translate(width/2,0,0);return mesh(name,g,mat,0,0,0,parent);}
 profile('Continuous graphite receiver',[[-.43,-.027],[-.43,.063],[-.35,.080],[.16,.073],[.21,.035],[.20,-.043],[-.31,-.043]],.094,dark);
 profile('Smooth lower power housing',[[-.40,-.025],[-.36,-.060],[-.16,-.090],[-.10,-.060],[.04,-.045],[.04,-.015]],.105,polymer);
 for(const side of [-1,1]){
  box('Receiver armoured side panel',.015,.059,.180,side*.053,.022,.104,polymer);
  box('Protected plasma conduit',.004,.006,.265,side*.055,.029,-.282,glow);
  box('Emitter conduit guard',.010,.015,.285,side*.058,.011,-.282,steel);
  for(let n=0;n<6;n++)box('Heat-sink fin',.012,.023,.009,side*.040,.086,-.17+n*.028,steel);
 }
 // Signature white ceramic emitter: upper and lower plates frame an actual recess.
 profile('White ceramic upper emitter',[[-.570,.054],[-.566,.094],[-.408,.105],[-.403,.061],[-.455,.042]],.147,ceramic);
 profile('White ceramic lower emitter',[[-.566,-.010],[-.557,-.057],[-.445,-.064],[-.413,-.021],[-.464,-.002]],.137,ceramic);
 for(const side of [-1,1])box('Ceramic aperture cheek',.024,.070,.051,side*.064,.023,-.541,ceramic);
 tube('Recessed emitter engineering rim',.045,.025,0,.023,-.544,steel,body,true);
 tube('Recessed cyan emitter core',.030,.012,0,.023,-.553,glow);
 for(const side of [-1,1])tube('Pressure conduit collar',.012,.047,side*.048,.024,-.466,steel);
 const stock=group('stock',0,0,.18);
 box('Integrated stock upper beam',.066,.035,.240,0,.053,.105,polymer,stock);
 profile('Skeleton stock lower brace',[[.02,-.036],[.06,-.053],[.215,-.027],[.235,.032],[.203,.036],[.184,-.004],[.035,-.009]],.043,polymer,stock);
 box('Stock shoulder pad',.070,.124,.027,0,.008,.235,rubber,stock);
 box('Stock cheek rest',.070,.022,.155,0,.078,.094,polymer,stock);
 profile('Tactical firing grip',[[.067,-.030],[.118,-.034],[.145,-.142],[.121,-.168],[.078,-.157],[.053,-.060]],.045,polymer);
 box('Trigger guard lower bow',.018,.012,.085,0,-.103,.013,steel);
 box('Trigger guard front',.018,.054,.012,0,-.075,-.029,steel);
 box('Trigger blade',.007,.025,.009,0,-.065,.025,edge);
 for(let n=0;n<5;n++)box('Support grip rib',.103,.004,.009,0,-.069,-.30+n*.025,rubber);
 // Split sight foundations and side rails leave a real shutter opening.
 for(const z of [-.248,.043]){
  box('Compact upper sight foundation',.057,.014,.070,0,.098,z,steel);
  box('Sight foundation support',.050,.030,.060,0,.086,z,dark);
 }
 for(const side of [-1,1])box('Connected upper vent rim',.012,.014,.300,side*.045,.095,-.086,steel);
 for(const z of [-.27,-.25,-.23,.01,.03,.05,.07])box('Upper rail key',.063,.006,.012,0,.109,z,dark);
 box('Rear sight notch',.031,.020,.015,0,.118,.063,dark);box('Front sight post',.006,.022,.013,0,.120,-.230,steel);
 // Telescoping rods remain engaged with receiver sockets throughout 140 mm travel.
 const guides=group('trayGuides');
 for(const z of [-.174,.040]){
  box('Fixed side guide socket',.052,.025,.026,-.055,.004,z,steel,guides);
  box('Guide socket root',.025,.045,.032,-.041,.012,z,steel,guides);
 }
 const tray=group('plasmaTray');
 for(const z of [-.174,.040]){
  const rod=tube('Captive transverse guide rail',.006,.160,.003,.004,z,steel,tray);rod.rotation.set(0,0,Math.PI/2);
  box('Guide carriage shoe',.032,.022,.030,-.077,.004,z,steel,tray);
 }
 box('Side cartridge cradle floor',.070,.011,.240,-.077,.001,-.067,steel,tray);
 for(const z of [-.174,.040])box('Keyed cartridge end seat',.064,.034,.018,-.077,.017,z,dark,tray);
 box('Carriage protective side shield',.010,.029,.183,-.115,.006,-.067,dark,tray);
 box('Carriage support-hand handle',.014,.015,.075,-.128,.006,-.067,steel,tray);
 const clips=group('cartridgeClips',-.077,.008,-.067,tray);
 for(const z of [-.082,.082])box('Spring retaining clip',.060,.008,.011,0,.031,z,steel,clips);
 const latch=group('plasmaLatch',-.064,.047,.080);
 tube('Tray latch pivot',.007,.012,0,0,0,steel,latch).rotation.set(0,0,Math.PI/2);
 box('Tray retaining latch',.012,.013,.040,-.009,0,-.013,steel,latch);
 const thermal=group('thermalSwitch',-.055,.077,-.220);box('Dedicated thermal release',.010,.012,.027,-.055,.077,-.220,steel);
 for(let n=0;n<3;n++){
  const shutter=group('coolingShutter'+n,0,.108,-.165+n*.055);
  box('Independent upper cooling shutter',.080,.007,.043,0,0,-.018,steel,shutter);
 }
 // Cylinder is independently removable; its cradle never leaves the weapon.
 function cylinder(name:string,parent:THREE.Object3D){const g=group(name,0,0,0,parent);
  tube('Pressure-rated cyan gas cylinder',.021,.163,0,0,0,glow,g);
  for(const z of [-.092,.092]){tube('Metal cartridge end cap',.024,.022,0,0,z,steel,g);tube('Keyed retention groove',.025,.005,0,0,z*.93,steel,g);}
  box('Protected cylinder status strip',.007,.006,.115,-.021,.008,0,steel,g);g.visible=false;return g;
 }
 cylinder('gasCylinder',tray).position.set(-.077,.031,-.067);
 cylinder('oldGasCylinder',body);cylinder('freshGasCylinder',body);
 const gas=new Float32Array(24*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(gas,3).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{density:{value:0}},
  vertexShader:'void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(9./max(.2,-p.z),2.,18.);gl_Position=projectionMatrix*p;}',
  fragmentShader:'uniform float density;void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r*r),2.)*density;gl_FragColor=vec4(.65,.78,.82,a);}'
 });
 const vapour=new THREE.Points(geometry,material);vapour.name='plasmaVapour';vapour.frustumCulled=false;body.add(vapour);parts.plasmaVapour=vapour;
 return {muzzle:[0,.023,-.574] as const,update(heat:number,phaseTime:number,thermal:boolean,pulse:number){
  glow.emissiveIntensity=(.35+.55*heat/100)*(thermal?1:1-.30*pulse);vapour.visible=pulse>0;material.uniforms.density.value=.18*pulse;
  for(let n=0;n<24;n++){const f=((n/24+phaseTime*1.6)%1);gas[n*3]=(thermal?0:-.217)+Math.sin(n*2.4+f*3)*.025*f;gas[n*3+1]=(thermal?.10:.04)+f*.13;gas[n*3+2]=-.10+Math.cos(n*1.7)*.045;}
  geometry.attributes.position.needsUpdate=vapour.visible;
 }};
}
