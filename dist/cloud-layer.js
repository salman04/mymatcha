import * as THREE from './vendor/three.module.js';

// Small, smooth surface motion in world units: a wet cream, not whipped peaks.
export function cloudHeight(x,z,time,energy,depth,reduced=false){
 const r=Math.min(1,Math.hypot(x,z)/.315);
 const meniscus=.0012*Math.pow(r,8);
 if(reduced)return meniscus;
 const amplitude=Math.min(depth*.16,.0011+.004*Math.min(1,energy));
 return meniscus+amplitude*(Math.sin(x*13+time*.65)*Math.cos(z*10-time*.43)*.65+Math.sin(z*17+x*6-time*.82)*.35)*(1-r*r*.75);
}

export function createCloudLayer(maps={}){
 const group=new THREE.Group();group.name='cloud-layer';group.visible=false;
 const surfaceMaterial=new THREE.MeshPhysicalMaterial({color:0xfffcf3,roughness:.32,clearcoat:.48,clearcoatRoughness:.24,metalness:0,...maps,normalScale:new THREE.Vector2(.10,.10)});
 const sideMaterial=new THREE.MeshPhysicalMaterial({color:0xf9f4e8,roughness:.29,clearcoat:.4,clearcoatRoughness:.22});
 const base={value:new THREE.Color(0x588322)};
 sideMaterial.onBeforeCompile=shader=>{
  shader.uniforms.cloudBase=base;
  shader.vertexShader='varying vec3 cloudPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncloudPosition=position;');
  shader.fragmentShader='uniform vec3 cloudBase; varying vec3 cloudPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float angle=atan(cloudPosition.z,cloudPosition.x);
   float feather=sin(angle*5.+sin(angle*3.))*.06;
   float cream=smoothstep(-.64,-.05,cloudPosition.y+feather);
   diffuseColor.rgb=mix(cloudBase,diffuseColor.rgb,cream);
  `);
 };
 sideMaterial.customProgramCacheKey=()=> 'soft-cloud-side-1';
 const segments=80,rings=12,vertices=[0,.5,0],uvs=[.5,.5],indices=[];
 for(let ring=1;ring<=rings;ring++)for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2,r=ring/rings*.315,x=Math.cos(a)*r,z=Math.sin(a)*r;
  vertices.push(x,.5,z);uvs.push(.5+x/.63,.5+z/.63);
 }
 for(let i=0;i<segments;i++)indices.push(0,1+i+1,1+i);
 for(let ring=1;ring<rings;ring++)for(let i=0;i<segments;i++){
  const a=1+(ring-1)*(segments+1)+i,b=a+segments+1;
  indices.push(a,b+1,b,a,a+1,b+1);
 }
 const topGeometry=new THREE.BufferGeometry();
 topGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3).setUsage(THREE.DynamicDrawUsage));
 topGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));topGeometry.setIndex(indices);topGeometry.computeVertexNormals();
 const top=new THREE.Mesh(topGeometry,surfaceMaterial);top.name='cloud-liquid-surface';
 const sideGeometry=new THREE.CylinderGeometry(.315,.312,1,segments,4,true);
 const side=new THREE.Mesh(sideGeometry,sideMaterial);side.name='cloud-soft-edge';
 const sideRest=sideGeometry.attributes.position.array.slice();
 for(const m of [top,side]){m.castShadow=m.receiveShadow=false;m.frustumCulled=false;group.add(m);}
 // Sparse, nearly flat bubble rims collect near the edge of the wet surface.
 const bubbles=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.10,4,12).rotateX(-Math.PI/2),new THREE.MeshPhysicalMaterial({color:0xcfc7af,roughness:.4,transparent:true,opacity:.38,depthWrite:false}),64);
 bubbles.name='cloud-microbubbles';bubbles.count=0;bubbles.castShadow=bubbles.receiveShadow=false;bubbles.frustumCulled=false;group.add(bubbles);
 const bubblePos=[],bubbleObject=new THREE.Object3D();let seed=47;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<64;i++){const angle=random()*Math.PI*2,r=i<48?.23+random()*.068:Math.sqrt(random())*.23; bubblePos.push({x:Math.cos(angle)*r,z:Math.sin(angle)*r,size:.0015+random()**2*.003});}
 let time=0,energy=0;
 const colour=new THREE.Color(),defaultMilk=new THREE.Color(0xffffff);
 function setBaseColor(green,milkRatio,progress,milkTint=defaultMilk){
  if(green)base.value.set(0x588322);else base.value.copy(milkTint);
  colour.setRGB(Math.exp(Math.log(.085)*(1-milkRatio)+Math.log(milkTint.r)*milkRatio),Math.exp(Math.log(.23)*(1-milkRatio)+Math.log(milkTint.g)*milkRatio),Math.exp(Math.log(.012)*(1-milkRatio)+Math.log(milkTint.b)*milkRatio));
  base.value.lerp(colour,progress);
 }
 function update(dt,{pouring=0,mixing=0,reducedMotion=false,active=true}={}){
  if(!group.visible||!active)return;
  dt=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0));
  if(!reducedMotion)time+=dt;
  const target=Math.min(1,pouring+mixing*.25);
  energy=reducedMotion?0:THREE.MathUtils.lerp(energy,target,1-Math.exp(-dt*(target>energy?3:1.4)));
  const depth=Math.max(.001,group.scale.y),p=topGeometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,.5+cloudHeight(p.getX(i),p.getZ(i),time,energy,depth,reducedMotion)/depth);
  p.needsUpdate=true;topGeometry.computeVertexNormals();
  const s=sideGeometry.attributes.position;
  for(let i=0;i<s.count;i++){
   const x=sideRest[i*3],y=sideRest[i*3+1],z=sideRest[i*3+2],weight=y+.5;
   const feather=-.10*(1-weight);
   s.setY(i,y+feather+cloudHeight(x,z,time,energy,depth,reducedMotion)/depth*weight);
  }
  s.needsUpdate=true;sideGeometry.computeVertexNormals();
  for(let i=0;i<bubblePos.length;i++){
   const b=bubblePos[i],drift=reducedMotion?0:Math.sin(time*.3+i)*.002;
   const x=b.x+drift,z=b.z;
   bubbleObject.position.set(x,.5+(cloudHeight(x,z,time,energy,depth,reducedMotion)+.0003)/depth,z);
   bubbleObject.scale.set(b.size,b.size*.16/depth,b.size);bubbleObject.updateMatrix();bubbles.setMatrixAt(i,bubbleObject.matrix);
  }
  bubbles.count=bubblePos.length;bubbles.instanceMatrix.needsUpdate=true;
 }
 function reset(){time=energy=0;group.visible=false;bubbles.count=0;}
 function disturb(strength){if(group.visible&&Number.isFinite(strength))energy=Math.min(1,energy+Math.max(0,strength)*.45);}
 function syncClone(root){const copy=root.getObjectByName(bubbles.name);if(copy){copy.instanceMatrix=bubbles.instanceMatrix;copy.count=bubbles.count;}}
 return {group,surfaceMaterial,top,side,update,setBaseColor,reset,disturb,syncClone,get energy(){return energy;}};
}
