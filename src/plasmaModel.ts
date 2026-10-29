import * as THREE from 'three';
import {PLASMA,plasmaHeatColour} from './plasmaMechanics';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
type Finish=Record<'steel'|'dark'|'polymer'|'rubber'|'edge'|'glow'|'ceramic',THREE.MeshStandardMaterial>;
/** Continuous front shell, hollow internal cartridge bay and independent cooling. */
export function buildPlasmaModel(body:THREE.Group,parts:Record<string,THREE.Object3D>,m:Finish){
 const {steel,dark,polymer,rubber,edge,glow,ceramic}=m;
 steel.color.setHex(0x505c63);steel.metalness=.7;steel.roughness=.48;dark.color.setHex(0x20292e);dark.roughness=.65;polymer.color.setHex(0x283236);polymer.roughness=.85;edge.color.setHex(0x9baeb3);glow.color.setHex(0x41b7bf);glow.emissive.setHex(0x1f9dab);glow.emissiveIntensity=.45;
 function group(name:string,x=0,y=0,z=0,parent:THREE.Object3D=body){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);parts[name]=g;return g;}
 function mesh(name:string,g:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=body){const o=new THREE.Mesh(g,mat);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 function box(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material,parent:THREE.Object3D=body){return mesh(name,new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.15),mat,x,y,z,parent);}
 function tube(name:string,r:number,length:number,x:number,y:number,z:number,mat:THREE.Material,parent:THREE.Object3D=body,open=false){const o=mesh(name,new THREE.CylinderGeometry(r,r,length,12,1,open),mat,x,y,z,parent);o.rotation.x=Math.PI/2;return o;}
 function profile(name:string,points:number[][],width:number,mat:THREE.Material,parent:THREE.Object3D=body){const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:2,bevelSize:.002,bevelThickness:.002,steps:1});g.rotateY(-Math.PI/2);g.translate(width/2,0,0);return mesh(name,g,mat,0,0,0,parent);}
 // The chamber is EMPTY SPACE between structural walls, not a solid receiver
 // with a hidden cylinder. End bulkheads sit beyond the cartridge end caps.
 profile('Forward graphite receiver',[[-.430,-.027],[-.430,.063],[-.350,.080],[-.190,.080],[-.190,-.043],[-.310,-.043]],.094,dark);
 profile('Rear graphite receiver',[[.058,-.043],[.058,.073],[.160,.073],[.210,.035],[.200,-.043]],.094,dark);
 box('Chamber roof',.094,.014,.248,0,.073,-.066,dark);
 box('Chamber floor',.094,.013,.248,0,-.0275,-.066,dark);
 box('Chamber fixed right wall',.012,.077,.248,.041,.023,-.066,polymer);
 for(const z of [-.184,.052])box('Chamber end bulkhead',.094,.086,.012,0,.024,z,dark);
 profile('Smooth lower power housing',[[-.40,-.025],[-.36,-.060],[-.16,-.090],[-.10,-.060],[.04,-.045],[.04,-.025]],.105,polymer);
 for(const side of [-1,1]){
  box('Rear receiver armour',.009,.060,.132,side*.051,.022,.126,polymer);
  box('Protected plasma conduit',.004,.005,.245,side*.048,.029,-.313,glow);
  box('Emitter conduit guard',.006,.012,.245,side*.049,.012,-.313,steel);
  for(let n=0;n<6;n++)box('Heat-sink fin',.012,.018,.009,side*.034,.085,-.17+n*.028,steel);
 }
 // A single tapered octagonal shell joins the existing receiver. Ceramic is a
 // flush material region of this shell; the nose has no separate white jaws.
 const contour=[[-1,-.55],[-.62,-1],[.62,-1],[1,-.55],[1,.55],[.62,1],[-.62,1],[-1,.55]];
 const stations=[[-.574,.041,.047],[-.548,.043,.049],[-.464,.047,.052],[-.385,.047,.055]];
 function surface(name:string,vertices:number[][],mat:THREE.Material){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap(v=>[v[2]*4,v[1]*4]),2));geometry.computeVertexNormals();
  // Custom loft triangles use both sides at the small recessed aperture.
  return mesh(name,geometry,mat,0,0,0);
 }
 for(let band=0;band<stations.length-1;band++)for(let n=0;n<8;n++){
  const next=(n+1)%8,[z0,w0,h0]=stations[band],[z1,w1,h1]=stations[band+1],a=contour[n],b=contour[next];
  const p0=[a[0]*w0,.023+a[1]*h0,z0],p1=[b[0]*w0,.023+b[1]*h0,z0],p2=[b[0]*w1,.023+b[1]*h1,z1],p3=[a[0]*w1,.023+a[1]*h1,z1];
  surface('Sculpted continuous emitter shell',[p0,p1,p2,p0,p2,p3],band<2&&[0,1,2,4,5,6].includes(n)?ceramic:dark);
 }
 for(let n=0;n<8;n++){
  const next=(n+1)%8,a=contour[n],b=contour[next],p0=[a[0]*.041,.023+a[1]*.047,-.574],p1=[b[0]*.041,.023+b[1]*.047,-.574],p2=[b[0]*.032,.023+b[1]*.032,-.574],p3=[a[0]*.032,.023+a[1]*.032,-.574];
  surface('Dark recessed aperture frame',[p0,p2,p1,p0,p3,p2],dark);
 }
 tube('Recessed discharge liner',.030,.035,0,.023,-.552,steel,body,true);
 tube('Concentric cyan emitter',.023,.006,0,.023,-.564,glow);
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
 // Fixed internal seats leave a direct transverse loading/ejection path.
 const seat=group('cartridgeSeat',...PLASMA.cylinder);
 for(const z of [-.100,.100]){
  box('Internal keyed end seat',.018,.050,.010,.034,0,z,steel,seat);
  tube('Recessed cartridge contact',.012,.006,.014,0,z,edge,seat);
 }
 box('Internal ejector spring pad',.008,.025,.055,.036,0,0,steel,seat);
 const retaining=group('cartridgeRetention',.030,.024,-.066);
 for(const z of [-.092,.092])box('Internal locking finger',.010,.014,.012,0,.013,z,steel,retaining);
 for(const [name,pivot,sign] of [['chamberUpperDoor',PLASMA.upperHinge,-1],['chamberLowerDoor',PLASMA.lowerHinge,1]] as const){
  const door=group(name,...pivot);
  box('Flush split receiver armour',.006,.0615,.222,0,sign*.03125,0,polymer,door);
  // Hinge barrels are fixed to the receiver; the door turns around their Z axis.
  for(const z of [-.164,.032])tube('Connected longitudinal door hinge',.0045,.018,pivot[0],pivot[1],z,steel);
 }
 const release=group('chamberRelease',-.056,.041,.079);
 box('Thumb release button',.009,.018,.022,0,0,0,steel,release);
 const thermal=group('thermalSwitch',-.055,.077,-.220);
 box('Dedicated thermal release',.010,.012,.027,0,0,0,steel,thermal);
 for(let n=0;n<3;n++){
  const shutter=group('coolingShutter'+n,0,.108,-.165+n*.055);
  box('Independent upper cooling shutter',.080,.007,.043,0,0,-.018,steel,shutter);
 }
 // Three preallocated representations; baked buffers are shared by the factory.
 // The spent cylinder is cosmetic, hidden after a bounded trajectory, never spawned.
 const cylinderMaterial=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:.65,roughness:.48,emissive:0x155c66,emissiveIntensity:.45});
 cylinderMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= step(.40,vColor.g)*step(.45,vColor.b);\n#endif');};
 cylinderMaterial.customProgramCacheKey=()=> 'PR100-pressure-canister-v2';
 function cylinder(name:string){const g=group(name);
  const profile=[[0,-.078],[.015,-.076],[.0235,-.069],[.025,-.056],[.025,.056],[.0235,.069],[.015,.076],[0,.078]];
  const vessel=new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r,z)),16).rotateX(Math.PI/2);
  mesh('Rounded graphite cartridge pressure vessel',vessel,dark,0,0,0,g);
  for(const z of [-.079,.079]){
   tube('Reinforced metal cartridge end cap',.0275,.020,0,0,z,steel,g);
   mesh('Rounded retaining collar',new THREE.TorusGeometry(.0246,.003,6,16),edge,0,0,z*.90,g);
   // Keyed coupling span is unchanged so the existing seats still engage.
   tube('Keyed pressure coupling',.011,.022,0,0,Math.sign(z)*.092,steel,g);
  }
  box('Recessed cyan gas inspection strip',.0025,.012,.072,-.025,.001,0,glow,g);
  for(const z of [-.035,.035])tube('Narrow pressure inspection band',.0252,.005,0,0,z,glow,g);
  box('Reinforced cartridge seating pad',.005,.019,.057,-.026,0,0,steel,g);
  g.traverse(object=>{if(object instanceof THREE.Mesh){const color=(object.material as THREE.MeshStandardMaterial).color,values=new Float32Array(object.geometry.attributes.position.count*3);for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b;}object.geometry.setAttribute('color',new THREE.BufferAttribute(values,3));object.material=cylinderMaterial;}});g.visible=false;return g;
 }
 cylinder('gasCylinder').position.fromArray(PLASMA.cylinder);
 cylinder('oldGasCylinder');cylinder('freshGasCylinder');
 // All six recessed segments share one shader/draw; no per-frame buffer rebuild.
 const indicator=group('ammoIndicator',-.057,-.043,-.075),vertices:number[]=[],indices:number[]=[];
 for(let n=0;n<6;n++){
  const z=-.038+n*.015,k=vertices.length/3;
  vertices.push(0,-.002,z-.004,0,.002,z-.004,0,.002,z+.004,0,-.002,z+.004);indices.push(k,k+2,k+1,k,k+3,k+2);
 }
 const indicatorGeometry=new THREE.BufferGeometry();indicatorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));indicatorGeometry.setAttribute('segment',new THREE.Float32BufferAttribute(Array.from({length:24},(_,i)=>Math.floor(i/4)),1));indicatorGeometry.setIndex(indices);
 const indicatorMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{ammo:{value:60}},vertexShader:'attribute float segment;varying float gasSegment;void main(){gasSegment=segment;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float ammo;varying float gasSegment;void main(){float level=clamp(ammo/10.-gasSegment,0.,1.);gl_FragColor=vec4(mix(vec3(.014,.035,.038),vec3(.10,.72,.80),level),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}'});
 mesh('Six recessed cyan ammunition segments',indicatorGeometry,indicatorMaterial,0,0,0,indicator);
 box('Recessed diagnostic bezel',.005,.010,.102,-.053,-.043,-.075,dark);
 const heatMaterial=new THREE.MeshStandardMaterial({color:0x24383a,emissive:0x24383a,emissiveIntensity:.35,roughness:.6});
 const heatIndicator=group('heatIndicator',-.052,.096,-.100);
 box('Independent thermal status line',.003,.003,.095,0,0,0,heatMaterial,heatIndicator);
 const gas=new Float32Array(24*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(gas,3).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{density:{value:0}},
  vertexShader:'void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(9./max(.2,-p.z),2.,18.);gl_Position=projectionMatrix*p;}',
  fragmentShader:'uniform float density;void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r*r),2.)*density;gl_FragColor=vec4(.65,.78,.82,a);}'
 });
 const vapour=new THREE.Points(geometry,material);vapour.name='plasmaVapour';vapour.frustumCulled=false;body.add(vapour);parts.plasmaVapour=vapour;
 return {muzzle:[0,.023,-.574] as const,update(heat:number,phaseTime:number,thermal:boolean,pulse:number,ammo=60){
  indicatorMaterial.uniforms.ammo.value=ammo;
  indicator.userData.ammo=ammo;
  plasmaHeatColour(heat,heatMaterial.emissive);heatMaterial.color.copy(heatMaterial.emissive);heatMaterial.emissiveIntensity=.20+.70*Math.max(0,Math.min(1,heat/100));heatIndicator.userData.heat=heat;
  glow.emissiveIntensity=.35;vapour.visible=pulse>0;material.uniforms.density.value=.18*pulse;
  for(let n=0;n<24;n++){const f=((n/24+phaseTime*1.6)%1);gas[n*3]=Math.sin(n*2.4+f*3)*.025*f;gas[n*3+1]=.10+f*.13;gas[n*3+2]=-.10+Math.cos(n*1.7)*.045;}
  geometry.attributes.position.needsUpdate=vapour.visible;
 }};
}
