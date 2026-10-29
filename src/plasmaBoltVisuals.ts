import * as THREE from 'three';
import type {PlasmaBolt} from './plasmaProjectiles';
/** Velocity-aligned, bounded energy packets. Shared GPU buffers; no shot lights. */
export function createPlasmaBoltVisuals(capacity:number){
 const root=new THREE.Group();root.name='Instanced directional plasma packets';
 const profile=(points:number[][])=>new THREE.LatheGeometry(points.map(([r,z])=>new THREE.Vector2(r,z)),8).rotateX(Math.PI/2);
 const coreGeometry=profile([[0,-.090],[.009,-.065],[.019,-.025],[.021,.025],[.014,.062],[0,.085]]);
 const haloGeometry=profile([[0,-.115],[.022,-.055],[.032,.010],[.023,.062],[0,.100]]);
 const wakeGeometry=new THREE.ConeGeometry(.023,.32,7,1,true).rotateX(-Math.PI/2).translate(0,0,-.19);
 const data=new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(THREE.DynamicDrawUsage);
 for(const geometry of [coreGeometry,haloGeometry,wakeGeometry])geometry.setAttribute('boltData',data);
 const uniforms={time:{value:0}};
 const vertex=`attribute vec2 boltData;uniform float time;varying vec3 localPoint;varying vec2 packet;void main(){vec3 p=position;packet=boltData;localPoint=p;float tail=clamp((-p.z-.03)/.32,0.,1.);p.xy+=tail*.0018*vec2(sin(time*97.+packet.x*19.+p.z*57.),cos(time*83.+packet.x*23.+p.z*61.));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`;
 const coreMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:`uniform float time;varying vec3 localPoint;varying vec2 packet;void main(){float activity=.94+.06*sin(time*71.+packet.x*31.+localPoint.z*90.);float nose=smoothstep(-.07,.06,localPoint.z);vec3 c=mix(vec3(.20,.88,1.12),vec3(1.35,1.63,1.70),nose)*activity;gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>}`});
 const haloMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fragmentShader:'uniform float time;varying vec3 localPoint;varying vec2 packet;void main(){float instability=.85+.15*sin(time*89.+packet.x*29.+localPoint.z*80.);gl_FragColor=vec4(.12,.56,.66,.12*instability);}'});
 const wakeMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fragmentShader:'uniform float time;varying vec3 localPoint;varying vec2 packet;void main(){float front=clamp((localPoint.z+.35)/.32,0.,1.);float filament=.65+.35*sin(localPoint.z*135.+time*103.+packet.x*27.);gl_FragColor=vec4(.18,.62,.76,pow(front,1.7)*filament*.27);}'});
 const meshes=[new THREE.InstancedMesh(coreGeometry,coreMaterial,capacity),new THREE.InstancedMesh(haloGeometry,haloMaterial,capacity),new THREE.InstancedMesh(wakeGeometry,wakeMaterial,capacity)];
 for(const [i,mesh]of meshes.entries()){mesh.name=['Cyan-white dense plasma cores','Constrained plasma envelopes','Short tapered energy wakes'][i];mesh.frustumCulled=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);}
 const axis=new THREE.Vector3(0,0,1),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1);let time=0,disposed=false;
 function render(bolts:readonly PlasmaBolt[],dt=0){if(disposed)return;time+=dt;uniforms.time.value=time;let count=0;
  for(let slot=0;slot<bolts.length;slot++){const bolt=bolts[slot];if(!bolt.active)continue;rotation.setFromUnitVectors(axis,bolt.direction);matrix.compose(bolt.position,rotation,scale);for(const mesh of meshes)mesh.setMatrixAt(count,matrix);data.setXY(count++,slot*.61803398875%1,bolt.distance);}
  data.needsUpdate=true;for(const mesh of meshes){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
 }
 function clear(){for(const mesh of meshes)mesh.count=0;}
 function dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const mesh of meshes)mesh.dispose();for(const g of [coreGeometry,haloGeometry,wakeGeometry])g.dispose();for(const m of [coreMaterial,haloMaterial,wakeMaterial])m.dispose();root.clear();}
 return {root,render,clear,dispose};
}
