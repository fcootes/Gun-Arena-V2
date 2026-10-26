import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
/** New kinetic accelerator, designed around its open-top rear chamber. All
 * hardware is baked by the owning factory within stable articulated groups. */
export function buildRailgunModel(body:THREE.Group,parts:Record<string,THREE.Object3D>,m:{steel:THREE.MeshStandardMaterial;dark:THREE.MeshStandardMaterial;polymer:THREE.MeshStandardMaterial;rubber:THREE.MeshStandardMaterial;edge:THREE.MeshStandardMaterial;glow:THREE.MeshStandardMaterial},firstPerson:boolean){
 const {steel,dark,polymer,rubber,edge,glow}=m;
 steel.color.setHex(0x56616a);steel.roughness=.53;steel.metalness=.72;
 dark.color.setHex(0x2d363e);dark.roughness=.64;dark.metalness=.50;
 polymer.color.setHex(0x343e43);polymer.roughness=.88;rubber.color.setHex(0x171e23);
 edge.color.setHex(0xaab8c0);edge.roughness=.52;edge.metalness=.68;glow.color.setHex(0x355866);glow.emissiveIntensity=.16;
 function group(name:string,x=0,y=0,z=0,parent:THREE.Object3D=body){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);parts[name]=g;return g;}
 function mesh(name:string,g:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=body){const o=new THREE.Mesh(g,mat);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 function box(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material,parent:THREE.Object3D=body){return mesh(name,new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.16),mat,x,y,z,parent);}
 function tube(name:string,r:number,length:number,x:number,y:number,z:number,mat:THREE.Material,parent:THREE.Object3D=body,r2=r,open=false){const o=mesh(name,new THREE.CylinderGeometry(r,r2,length,12,1,open),mat,x,y,z,parent);o.rotation.x=Math.PI/2;return o;}
 function profile(name:string,points:number[][],width:number,mat:THREE.Material,parent:THREE.Object3D=body){const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:2,bevelSize:.002,bevelThickness:.002,steps:1});g.rotateY(-Math.PI/2);g.translate(width/2,0,0);return mesh(name,g,mat,0,0,0,parent);}
 // Continuous lower load-bearing spine; real open well, not a solid receiver
 // hidden under a moving decoration. Walls stop below the seated slug's crown.
 profile('Forged accelerator keel',[[-.78,-.025],[-.71,-.064],[-.28,-.067],[-.15,-.085],[.22,-.071],[.27,-.040],[.25,-.010],[-.25,-.010]],.072,dark);
 const chamber=group('loadingChamber');
 box('Machined chamber floor',.065,.012,.185,0,.007,.125,steel,chamber);
 for(const side of [-1,1]){
  if(side>0)box('Rear receiver wall',.018,.050,.205,side*.046,.020,.125,steel,chamber);else{box('Scalloped near-side loading sill',.018,.018,.205,side*.046,.004,.125,steel,chamber);for(const z of [.030,.224])box('Loading well end buttress',.018,.050,.028,side*.046,.020,z,steel,chamber);}
  box('Inset armoured receiver cheek',.009,.038,.150,side*.059,-.005,.13,polymer);
  if(side>0)box('Visible captive guide housing',.012,.015,.235,side*.076,.051,.135,dark);else for(const z of [.050,.210])box('Guide with ejection clearance',.012,.015,.080,side*.076,.051,z,dark);
  if(!firstPerson)tube('Hydraulic stock recoil guide',.011,.17,side*.044,-.013,.27,steel);
  if(!firstPerson)tube('Recoil guide piston',.006,.045,side*.044,-.013,.32,edge);
 }
 const seat=group('chamberSeat',0,.020,.132);
 for(const side of [-1,1])box('Slug V-block seating rail',.010,.010,.132,side*.0135,.0035,0,edge,seat).rotation.z=side*Math.PI/4;
 box('Forward chamber stop',.056,.031,.012,0,.028,.027,steel);
 box('Rear chamber stop',.056,.031,.012,0,.028,.224,steel);
 const ejection=group('carrierEjectionPort',-.060,.033,.125);
 box('Ejection opening lower lip',.012,.012,.047,0,-.019,0,edge,ejection);
 box('Carrier extractor claw',.010,.015,.017,.016,.005,.020,edge,ejection);
 // Sliding undercarriage and cover remain captive and separately addressable.
 const slide=group('breechSlide');
 for(const side of [-1,1]){
  for(const z of [.025,.225])box('Guide structural standoff',.042,.025,.025,side*.060,.043,z,steel);
  box('Captive upper runner',.009,.012,.215,side*.076,.069,.130,edge,slide);
  box('Slider keyed shoe',.018,.021,.055,side*.073,.065,.185,dark,slide);
 }
 const cover=group('breechCover',0,.082,.125,slide);
 profile('Bevelled sliding breech shroud',[[-.10,-.020],[-.10,.008],[-.070,.025],[.070,.025],[.10,.006],[.10,-.020]],.158,polymer,cover);
 for(const side of [-1,1])box('Breech roof titanium inset',.025,.006,.142,side*.022,.026,0,steel,cover);
 for(let n=0;n<4;n++)box('Recessed roof witness cut',.064,.002,.004,0,.030,-.052+n*.034,polymer,cover);
 for(const side of [-1,1])for(let n=0;n<4;n++)box('Cover grip serration',.004,.018,.012,side*.080,-.001,-.045+n*.028,steel,cover);
 box('Near-side sliding handle bridge',.030,.015,.085,-.092,-.004,.035,polymer,cover);
 box('Near-side knurled cover handle',.012,.019,.060,-.106,-.004,.035,steel,cover);
 const latch=group('breechLatch',-.082,.048,.195);
 tube('Latch hinge axle',.009,.026,0,0,0,steel,latch).rotation.set(0,0,Math.PI/2);
 box('Mechanical unlock lever',.020,.011,.052,-.012,.004,.022,steel,latch);
 const lock=group('breechLock',-.066,.046,.195);box('Visible cross-bolt lock',.020,.017,.028,0,0,0,edge,lock);
 // Stock and grip are purpose-built; no capacitor is treated as ammunition.
 const stock=group('stock',0,0,.265);
 profile('Reinforced recoil stock',[[0,.030],[.16,.039],[.205,.018],[.205,-.100],[.15,-.106],[.045,-.055],[0,-.044]],.056,polymer,stock);
 box('Stock elastomer shoulder pad',.063,.123,.023,0,-.032,.209,rubber,stock);
 box('Adjustable cheek riser',.056,.020,.104,0,.044,.136,polymer,stock);
 const grip=profile('Angled ergonomic firing grip',[[.10,-.038],[.155,-.041],[.179,-.155],[.153,-.183],[.112,-.172],[.088,-.068]],.046,polymer);
 for(const side of [-1,1])for(let i=0;i<5;i++)box('Grip moulded inset',.002,.006,.039,side*.024,-.085-i*.016,.131+i*.003,polymer);
 // Rectangular reinforced guard has an actual finger opening.
 box('Trigger guard lower bow',.018,.012,.087,0,-.102,.048,steel);
 box('Trigger guard front post',.018,.058,.012,0,-.072,.006,steel);
 box('Trigger guard rear post',.018,.034,.012,0,-.084,.091,steel);
 box('Curved trigger blade',.007,.032,.010,0,-.062,.060,edge).rotation.x=-.25;
 // Integrated rail enclosure: twin rails remain visible through narrow service
 // windows, protected by continuous side shells and interrupted upper armour.
 for(const side of [-1,1]){
  profile('Accelerator armoured side shell',[[-.81,-.012],[-.79,.043],[-.68,.058],[-.20,.058],[-.14,.033],[-.14,-.034],[-.71,-.034]],.018,polymer).position.x=side*.057;
  box('Parallel conductive rail',.016,.022,.64,side*.021,.023,-.470,steel);
  box('Protected conductive strip',.004,.006,.590,side*.012,.034,-.475,glow);
  for(let n=0;n<5;n++){
   const z=-.215-n*.118;
   box('Bolted accelerator coil module',.024,.054,.077,side*.037,.009,z,dark);
   box('Module contact cover',.003,.023,.044,side*.068,.013,z,steel);
   box('Tiny coil charge indicator',.002,.004,.025,side*.070,.023,z,glow);
   tube('Recessed hex fastener',.004,.003,side*.070,.002,z,edge).rotation.set(0,0,Math.PI/2);
  }
  box('Fixed capacitor bank',.027,.048,.190,side*.071,-.029,-.102,dark);
  for(let n=0;n<5;n++)box('Capacitor cooling fin',.030,.003,.017,side*.071,-.010,-.174+n*.032,steel);
  box('Fixed capacitor power bus',.009,.009,.275,side*.046,-.035,-.230,edge);
 }
 for(const z of [-.20,-.42,-.65])box('Accelerator upper reinforcement',.135,.016,.046,0,.063,z,steel);
 box('Under-barrel support cradle',.082,.038,.185,0,-.063,-.260,polymer);
 for(let i=0;i<6;i++)box('Support grip texture',.084,.004,.009,0,-.084,-.185-i*.026,rubber);
 // Front termination frames the real projectile channel; no solid plate over it.
 for(const side of [-1,1])box('Muzzle rail termination',.021,.072,.034,side*.039,.023,-.818,steel);
 for(const y of [-.010,.056])box('Muzzle collar crossmember',.065,.010,.034,0,y,-.818,dark);
 // Fixed optic bridge is entirely forward of the rear loading chamber.
 const optic=group('opticBridge');
 for(const side of [-1,1])box('Fixed optic bridge strut',.012,.050,.19,side*.038,.088,-.267,dark,optic);
 box('Fixed optic mounting saddle',.086,.012,.218,0,.118,-.267,steel,optic);
 for(const z of [-.335,-.196])box('Optic clamping foot',.059,.020,.021,0,.132,z,dark,optic);
 tube('Scope tube',.023,.182,0,.157,-.266,dark,optic,.023,firstPerson);
 for(const z of [-.358,-.174])tube('Scope bell',.028,.016,0,.157,z,steel,optic,.026,true);
 for(const z of [-.334,-.199]){
  const ring=mesh('Optic retaining ring',new THREE.TorusGeometry(.026,.004,5,16),steel,0,.157,z,optic);ring.rotation.z=.1;
 }
 box('Optic elevation turret',.026,.019,.025,0,.186,-.258,dark,optic);
 for(const side of [-1,1])box('Precision witness marking',.0015,.009,.020,side*.025,.166,-.24,edge,optic);
 // Reusable ammunition: one fresh slug, one seated slug, one small spent ring.
 function slug(name:string){const g=group(name);tube('Kinetic steel slug',.0155,.130,0,0,0,edge,g);tube('Conductive slug base',.0175,.016,0,0,.073,edge,g);tube('Tungsten projectile nose',.0155,.034,0,0,-.079,edge,g,.003);g.visible=false;return g;}
 const fresh=slug('freshSlug'),loaded=slug('chamberedSlug');loaded.position.set(0,.039,.132);loaded.visible=true;
 const carrier=group('spentCarrier',0,.039,.125);tube('Spent conductive carrier sleeve',.016,.024,0,0,0,edge,carrier,.016,true);tube('Spent carrier retaining flange',.018,.005,0,0,.011,edge,carrier,.018,true);carrier.visible=false;
 if(firstPerson){const upper=group('supportUpperArm');upper.name='railgunLeftUpperArm';mesh('Railgun upper sleeve',new THREE.CapsuleGeometry(.054,.32,5,10).scale(1,1/.32,1),polymer,0,0,0,upper);upper.visible=false;}
 // Economical etched markings, geometry-batched and readable without textures.
 for(let n=0;n<4;n++)box('Serial witness dash',.0015,.003,.010,-.064,-.009,.06+n*.018,edge);
 box('Caution plate',.002,.018,.036,-.064,.014,.19,dark);
 const arcGeometry=new THREE.BufferGeometry(),arcPositions=new Float32Array(36);
 arcGeometry.setAttribute('position',new THREE.BufferAttribute(arcPositions,3).setUsage(THREE.DynamicDrawUsage));
 const arcMaterial=new THREE.LineBasicMaterial({color:0xb7efff,transparent:true,opacity:0,depthWrite:false});
 const activity=new THREE.LineSegments(arcGeometry,arcMaterial);activity.name='Contained charge corona';activity.frustumCulled=false;activity.visible=false;body.add(activity);
 return {muzzle:[0,.023,-.848] as const,update(charge:number,time:number){
  glow.emissiveIntensity=.16+1.7*charge;activity.visible=charge>.08;arcMaterial.opacity=.28*charge;
  if(activity.visible)for(let i=0;i<12;i++){const k=i*3,endpoint=i%2;arcPositions[k]=endpoint?.012:-.012;arcPositions[k+1]=.032+.003*Math.sin(time*23+i);arcPositions[k+2]=-.30-(Math.floor(i/2)%2)*.15+.003*Math.cos(time*29+i);}
  arcGeometry.attributes.position.needsUpdate=activity.visible;
 }};
}
