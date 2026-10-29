import * as THREE from 'three';
export type PlasmaSurface='concrete'|'metal'|'paintedMetal'|'stone'|'shield'|'armour'|'body'|'generic';
export const PLASMA_IMPACT=Object.freeze({marks:80,markLife:16,fadeStart:12,flashes:32,particles:192,flashLife:.16,offset:.002});
const actorKinds=new Set<PlasmaSurface>(['shield','armour','body']);
/** Metadata first; conservative finish/name inference for existing untagged props. */
export function plasmaSurface(object:THREE.Object3D,materialIndex=0):PlasmaSurface{
 const data=object.userData,raw=String(data.plasmaSurface??data.surfaceType??data.materialType??'');
 if(['concrete','metal','paintedMetal','stone'].includes(raw))return raw as PlasmaSurface;
 const mesh=object as THREE.Mesh,material=Array.isArray(mesh.material)?mesh.material[materialIndex]:mesh.material;
 if(!material||!material.visible)return 'generic';
 const finish=material as THREE.MeshStandardMaterial,name=(object.name+' '+(material.name??'')).toLowerCase();
 if(/glass|water|liquid|sky|foliage/.test(name)||material.transparent&&material.opacity<.75)return 'generic';
 if(/painted|coated/.test(name))return 'paintedMetal';
 if(/steel|metal|alloy|armou?r|pipe|hull|vehicle|container/.test(name)||(finish.metalness??0)>.35)return 'metal';
 if(/stone|rock|granite/.test(name))return 'stone';
 if(/concrete|cement|wall|floor|road|building/.test(name)||(finish.roughness??0)>.72)return 'concrete';
 return 'generic';
}
export function plasmaVisibleSurface(object:THREE.Object3D,scene:THREE.Scene){
 if(!(object instanceof THREE.Mesh)||object.userData.collisionOnly||object.userData.destroyed||object.userData.type==='botpart'||object.userData.type==='pickup'||object.userData.plasmaScorch===false)return false;
 const materials=Array.isArray(object.material)?object.material:[object.material];if(!materials.some(m=>m.visible&&(!m.transparent||m.opacity>=.75)))return false;
 let parent:THREE.Object3D|null=object;while(parent&&parent!==scene){if(!parent.visible)return false;parent=parent.parent;}return parent===scene;
}
/** Three bounded draws. No hit allocates GPU resources or retains an actor. */
export function createPlasmaImpactEffects(scene:THREE.Scene){
 const root=new THREE.Group();root.name='PR100ImpactFeedback';scene.add(root);
 const plane=new THREE.PlaneGeometry(1,1),markData=new THREE.InstancedBufferAttribute(new Float32Array(PLASMA_IMPACT.marks*4),4).setUsage(THREE.DynamicDrawUsage);
 plane.setAttribute('markData',markData);
 const markMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
 vertexShader:'attribute vec4 markData;varying vec2 uvMark;varying vec4 dataMark;void main(){uvMark=uv;dataMark=markData;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 uvMark;varying vec4 dataMark;void main(){vec2 q=(uvMark-.5)*2.;float r=length(q);float a=atan(q.y,q.x);float edge=.82+.055*sin(a*5.+dataMark.z*17.)+.035*sin(a*11.-dataMark.z*9.);float mask=1.-smoothstep(edge-.19,edge,r);float grain=.79+.21*sin(q.x*53.+sin(q.y*37.+dataMark.z*23.));vec3 c=vec3(.028,.025,.022);if(dataMark.y>.5&&dataMark.y<2.5){float ring=exp(-pow((r-.53)*8.,2.));c+=ring*vec3(.042,.020,.047);}c+=dataMark.w*exp(-pow((r-.58)*12.,2.))*vec3(.10,.04,.012);gl_FragColor=vec4(c,mask*grain*dataMark.x*.78);if(gl_FragColor.a<.003)discard;
 #include <tonemapping_fragment>
 #include <colorspace_fragment>}`});
 const scorch=new THREE.InstancedMesh(plane,markMaterial,PLASMA_IMPACT.marks);scorch.name='Pooled plasma scorch marks';root.add(scorch);scorch.count=0;scorch.frustumCulled=false;scorch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 const flashGeometry=new THREE.PlaneGeometry(1,1),flashData=new THREE.InstancedBufferAttribute(new Float32Array(PLASMA_IMPACT.flashes*3),3).setUsage(THREE.DynamicDrawUsage);flashGeometry.setAttribute('flashData',flashData);
 const flashMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,
 vertexShader:'attribute vec3 flashData;varying vec2 uvFlash;varying vec3 dataFlash;void main(){uvFlash=uv;dataFlash=flashData;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec2 uvFlash;varying vec3 dataFlash;void main(){vec2 p=(uvFlash-.5)*2.;float r=length(p);float core=exp(-r*r*18.);float rim=exp(-pow((r-.55)*12.,2.));float broken=.7+.3*sin(atan(p.y,p.x)*7.+dataFlash.z*11.);float shield=step(3.5,dataFlash.y)*(1.-step(4.5,dataFlash.y));vec3 c=mix(vec3(.60,.90,1.),vec3(.22,.72,.92),shield);float a=(core+rim*broken*mix(.13,.5,shield))*dataFlash.x;gl_FragColor=vec4(c,a);}' });
 const flashesMesh=new THREE.InstancedMesh(flashGeometry,flashMaterial,PLASMA_IMPACT.flashes);flashesMesh.name='Directional plasma contacts';flashesMesh.frustumCulled=false;flashesMesh.count=0;flashesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(flashesMesh);
 const positions=new Float32Array(PLASMA_IMPACT.particles*3),colours=new Float32Array(positions.length),alpha=new Float32Array(PLASMA_IMPACT.particles),size=new Float32Array(alpha.length);
 const particleGeometry=new THREE.BufferGeometry();for(const [name,array,n]of [['position',positions,3],['color',colours,3],['alpha',alpha,1],['size',size,1]]as const)particleGeometry.setAttribute(name,new THREE.BufferAttribute(array,n).setUsage(THREE.DynamicDrawUsage));
 const particleMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,
 vertexShader:'attribute float alpha;attribute float size;varying float opacity;varying vec3 tint;void main(){opacity=alpha;tint=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*330./max(.1,-p.z),1.,8.);gl_Position=projectionMatrix*p;}',
 fragmentShader:'varying float opacity;varying vec3 tint;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(tint,opacity*pow(max(0.,1.-r*r),2.));}' });
 const particlesMesh=new THREE.Points(particleGeometry,particleMaterial);particlesMesh.frustumCulled=false;particlesMesh.name='Bounded plasma contact flecks';root.add(particlesMesh);
 const marks=Array.from({length:PLASMA_IMPACT.marks},()=>({active:false,position:new THREE.Vector3(),normal:new THREE.Vector3(),rotation:new THREE.Quaternion(),surfaceMatrix:new THREE.Matrix4(),instanceMatrix:new THREE.Matrix4(),object:null as THREE.Mesh|null,instanceId:-1,age:0,radius:0,kind:0,seed:0}));
 const flashes=Array.from({length:PLASMA_IMPACT.flashes},()=>({age:1,position:new THREE.Vector3(),normal:new THREE.Vector3(),kind:0,seed:0}));
 const particles=Array.from({length:PLASMA_IMPACT.particles},()=>({position:new THREE.Vector3(),velocity:new THREE.Vector3(),life:0,total:1,gravity:0}));
 const ray=new THREE.Raycaster(),hits:THREE.Intersection[]=[],point=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3(),up=new THREE.Vector3(0,0,1),scale=new THREE.Vector3(),matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),instanceMatrix=new THREE.Matrix4(),q=new THREE.Quaternion();
 let markIndex=0,flashIndex=0,particleIndex=0,serial=0,disposed=false;
 const kindId=(kind:PlasmaSurface)=>kind==='metal'?1:kind==='paintedMetal'?2:kind==='stone'?3:kind==='shield'?4:kind==='armour'?5:0;
 function supported(mesh:THREE.Mesh,at:THREE.Vector3,normal:THREE.Vector3,radius:number,id:number){
  q.setFromUnitVectors(up,normal);u.set(1,0,0).applyQuaternion(q);v.set(0,1,0).applyQuaternion(q);
  for(let corner=0;corner<4;corner++){
   point.copy(at).addScaledVector(u,(corner&1?1:-1)*radius*.82).addScaledVector(v,(corner&2?1:-1)*radius*.82).addScaledVector(normal,.012);
   ray.set(point,scale.copy(normal).negate());ray.near=0;ray.far=.026;hits.length=0;ray.intersectObject(mesh,false,hits);
   const hit=hits.find(h=>(h.instanceId??-1)===id&&Math.abs(h.distance-.012)<.004);
   if(!hit?.face)return false;
   matrix.copy(mesh.matrixWorld);if(mesh instanceof THREE.InstancedMesh){mesh.getMatrixAt(id,instanceMatrix);matrix.multiply(instanceMatrix);}normalMatrix.getNormalMatrix(matrix);
   point.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();if(Math.abs(point.dot(normal))<.995)return false;
  }return true;
 }
 function contact(at:THREE.Vector3,normal:THREE.Vector3,object:THREE.Mesh|null=null,kind:PlasmaSurface='generic',instanceId=-1){
  if(disposed)return;
  const seed=(++serial*.61803398875)%1,id=kindId(kind),flash=flashes[flashIndex++%flashes.length];flash.age=0;flash.position.copy(at).addScaledVector(normal,.003);flash.normal.copy(normal);flash.kind=id;flash.seed=seed;
  q.setFromUnitVectors(up,normal);
  const count=kind==='metal'||kind==='paintedMetal'||kind==='armour'?6:3;
  for(let n=0;n<count;n++){
   const index=particleIndex++%particles.length,p=particles[index],angle=n*2.399963+seed*6.28,spark=count===6;
   p.position.copy(at).addScaledVector(normal,.005);p.velocity.set(Math.cos(angle)*(spark?.65:.13),Math.sin(angle)*(spark?.65:.13),spark?.45:.16).applyQuaternion(q);
   p.life=p.total=spark?.11+n*.012:.18+n*.02;p.gravity=spark?3.4:.4;size[index]=spark?.012:.026;
   const energy=kind==='shield'||kind==='body';colours[index*3]=spark?.75:energy?.23:.30;colours[index*3+1]=spark?.45:energy?.35:.29;colours[index*3+2]=spark?.20:energy?.40:.27;
  }
  if(!object||actorKinds.has(kind)||kind==='generic'||!plasmaVisibleSurface(object,scene))return;
  const radius=kind==='metal'?.052:kind==='paintedMetal'?.058:.067;
  if(!supported(object,at,normal,radius,instanceId))return;
  const mark=marks[markIndex++%marks.length];mark.active=true;mark.object=object;mark.instanceId=instanceId;mark.age=0;mark.position.copy(at).addScaledVector(normal,PLASMA_IMPACT.offset);mark.normal.copy(normal);mark.rotation.setFromUnitVectors(up,normal);mark.radius=radius;mark.kind=id;mark.seed=seed;mark.surfaceMatrix.copy(object.matrixWorld);
  if(object instanceof THREE.InstancedMesh)object.getMatrixAt(instanceId,mark.instanceMatrix);
 }
 function render(dt=0){if(disposed)return;
  let count=0;
  for(const mark of marks){if(!mark.active)continue;mark.age+=dt;mark.object?.updateWorldMatrix(true,false);
   if(mark.age>=PLASMA_IMPACT.markLife||!mark.object||!plasmaVisibleSurface(mark.object,scene)||!mark.object.matrixWorld.equals(mark.surfaceMatrix)){mark.active=false;mark.object=null;continue;}
   if(mark.object instanceof THREE.InstancedMesh){mark.object.getMatrixAt(mark.instanceId,instanceMatrix);if(!instanceMatrix.equals(mark.instanceMatrix)){mark.active=false;mark.object=null;continue;}}
   const fade=1-Math.max(0,(mark.age-PLASMA_IMPACT.fadeStart)/(PLASMA_IMPACT.markLife-PLASMA_IMPACT.fadeStart));scale.set(mark.radius*2,mark.radius*2,1);matrix.compose(mark.position,mark.rotation,scale);scorch.setMatrixAt(count,matrix);markData.setXYZW(count++,fade,mark.kind,mark.seed,Math.max(0,1-mark.age/.25));
  }scorch.count=count;scorch.instanceMatrix.needsUpdate=markData.needsUpdate=true;
  count=0;for(const flash of flashes){flash.age+=dt;const fade=Math.max(0,1-flash.age/PLASMA_IMPACT.flashLife);if(fade<=0)continue;q.setFromUnitVectors(up,flash.normal);scale.setScalar((flash.kind===4?.18:.11)+flash.age*.32);matrix.compose(flash.position,q,scale);flashesMesh.setMatrixAt(count,matrix);flashData.setXYZ(count++,fade,flash.kind,flash.seed);}flashesMesh.count=count;flashesMesh.instanceMatrix.needsUpdate=flashData.needsUpdate=true;
  for(let n=0;n<particles.length;n++){const p=particles[n];p.life=Math.max(0,p.life-dt);if(p.life>0){p.position.addScaledVector(p.velocity,dt);p.velocity.y-=p.gravity*dt;}p.position.toArray(positions,n*3);alpha[n]=p.life/p.total*.65;}
  for(const name of ['position','alpha','color','size'])particleGeometry.attributes[name].needsUpdate=true;
 }
 function clear(){for(const m of marks){m.active=false;m.object=null;}for(const f of flashes)f.age=1;for(const p of particles)p.life=0;alpha.fill(0);scorch.count=flashesMesh.count=0;particleGeometry.attributes.alpha.needsUpdate=true;}
 function dispose(){if(disposed)return;clear();disposed=true;root.removeFromParent();scorch.dispose();flashesMesh.dispose();plane.dispose();flashGeometry.dispose();particleGeometry.dispose();markMaterial.dispose();flashMaterial.dispose();particleMaterial.dispose();root.clear();}
 return {root,contact,render,clear,dispose,marks,get markCount(){return marks.reduce((n,m)=>n+Number(m.active),0);}};
}
