import * as THREE from 'three';
import { createAtmosphere } from './atmosphere.js';

export function createShopAtmosphere(scene,renderer,shop,{sun,fill,hemisphere}){
 const mood=createAtmosphere(),garden=shop.garden.material;
 const saturation={value:1},tint={value:new THREE.Color(1,1,1)};
 garden.onBeforeCompile=shader=>{shader.uniforms.gardenSaturation=saturation;shader.uniforms.gardenTint=tint;shader.fragmentShader='uniform vec3 gardenTint; uniform float gardenSaturation;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat gardenLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)); diffuseColor.rgb=mix(vec3(gardenLuma),diffuseColor.rgb,gardenSaturation)*gardenTint;');};
 garden.customProgramCacheKey=()=> 'garden-atmosphere-1';
 const fixtures=new THREE.Group();fixtures.name='warm-window-lanterns';shop.group.add(fixtures);
 const paper=new THREE.MeshStandardMaterial({color:0xf9e2bc,roughness:.9,emissive:0xffb454,emissiveIntensity:0});
 const trim=new THREE.MeshStandardMaterial({color:0x54402b,roughness:.8});
 const lamps=[];
 for(const x of [-5.06,5.06]){
  const fixture=new THREE.Group();fixture.position.set(x,.96,-3.05);fixtures.add(fixture);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.17,.48,24),paper);fixture.add(body);
  for(const y of [-.26,.26]){const rim=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.035,24),trim);rim.position.y=y;fixture.add(rim);}
  for(let i=0;i<7;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.165,.004,4,32),trim);ring.rotation.x=Math.PI/2;ring.position.y=-.2+i*.066;fixture.add(ring);}
  const hook=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.3,6),trim);hook.position.y=.41;fixture.add(hook);
  const glow=new THREE.PointLight(0xffbd70,0,4,2);glow.position.set(x,.96,-2.8);scene.add(glow);lamps.push(glow);
 }
 const count=260,positions=new Float32Array(count*6),seeds=Array.from({length:count},(_,i)=>{
  const rand=n=>{const v=Math.sin(i*73.19+n*91.71)*43758.5453;return v-Math.floor(v);};
  return {x:(rand(1)-.5)*11.9,y:rand(2),z:-4.1-rand(3)*.8,speed:.75+rand(4)*.65,length:.10+rand(5)*.16};
 });
 const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 const rainMaterial=new THREE.LineBasicMaterial({color:0xb5cbe3,transparent:true,opacity:0,depthWrite:false});
 const rain=new THREE.LineSegments(rainGeometry,rainMaterial);rain.name='rain-outside-window';rain.frustumCulled=false;rain.visible=false;shop.group.add(rain);
 let time=0;
 return {set:key=>mood.set(key),get key(){return mood.key;},
  update(dt,{active=true,reducedMotion=false}={}){
   const v=mood.advance(dt,{active,reducedMotion});
   sun.color.setRGB(...v.sun);sun.intensity=v.sunPower;sun.position.x=v.sunX;
   fill.color.setRGB(...v.fill);fill.intensity=v.fillPower;hemisphere.color.setRGB(...v.sky);hemisphere.intensity=v.ambient;
   scene.environmentIntensity=v.environment;renderer.toneMappingExposure=v.exposure;
   scene.background.setRGB(.42+v.garden[0]*.35,.46+v.garden[1]*.28,.48+v.garden[2]*.20);
   garden.color.setRGB(1,1,1);tint.value.setRGB(...v.garden);saturation.value=v.saturation;
   paper.emissiveIntensity=v.lantern*1.8;for(const lamp of lamps)lamp.intensity=v.lantern*3.8;
   rain.visible=v.rain>.005;rainMaterial.opacity=v.rain*(reducedMotion?.18:.48);shop.petals.visible=v.rain<.5;
   if(active&&!reducedMotion)time+=Math.min(.05,Math.max(0,dt));
   if(rain.visible){
    const height=shop.garden.geometry.parameters.height*shop.garden.scale.y;
    for(let i=0;i<count;i++){const s=seeds[i],y=-1.9+(1-(s.y+time*s.speed*.30)%1)*height,j=i*6;
     positions[j]=s.x;positions[j+1]=y;positions[j+2]=s.z;positions[j+3]=s.x+.025;positions[j+4]=y+s.length;positions[j+5]=s.z;
    }rainGeometry.attributes.position.needsUpdate=true;
   }
  }
 };
}
