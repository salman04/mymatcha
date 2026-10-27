import * as THREE from 'three';
import { ACTION_DURATION, createToolMotion } from './preparation-motion.js?v=tongs-1';
import { createHoverGlow } from './hover-glow.js';
import { preparationAction } from './object-interactions.js';
import { buildMilkCarton } from './milk-cartons.js';
import { MILK_TYPES } from './milk-types.js?v=milk-colors-1';
import { milkColor } from './milk-appearance.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { makeMaterials, random, foamMaps } from './materials.js?v=detail-4';
import { createCloudLayer } from './cloud-layer.js?v=milk-colors-1';
import { createMixingState } from './mixing.js?v=cozy-motion-1';
import { createIceTransfer, TONGS_YAW } from './ice-transfer.js';
import { createIceTongs } from './ice-tongs.js';
import { createIceMotion, createIceBatchCue } from './ice-motion.js?v=ice-ripples-1';
import { createCameraMotion } from './camera-motion.js?v=milk-side-1';
import { createServingMotion } from './serving-motion.js?v=atmosphere-1';
import { createPourEffects, createTiltedTea, pourPhase, POUR_DURATION } from './pour-effects.js?v=ice-ripples-1';
import { powderSoundLevels } from './powder-sounds.js?v=powder-1';
import { buildShopEnvironment } from './shop-environment.js?v=cozy-motion-1';
import { createShopAtmosphere } from './shop-atmosphere.js';
import { getShopView } from './shop-view.js?v=mobile-1';
import { GLASS_CAPACITY_ML, MAX_ICE_CUBES, GLASS_BASE_Y, GLASS_FILL_DEPTH, GLASS_RIM_Y, glassWallY } from './glass-size.js?v=challenge-1';

export function buildStudio(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xe9e2d4);
  const camera=new THREE.OrthographicCamera(-7,7,4.5,-4.5,.1,60);camera.position.set(0,11,7.7);camera.lookAt(0,0,0);
  const cameraMotion=createCameraMotion();
  function applyCamera(pose){const view=getShopView(pose,canvas.clientWidth,canvas.clientHeight);Object.assign(camera,view.frustum);camera.position.set(view.position.x,view.position.y,view.position.z);camera.lookAt(view.target.x,view.target.y,view.target.z);camera.zoom=view.zoom;camera.updateProjectionMatrix();}
  const pmrem=new THREE.PMREMGenerator(renderer);const envRoom=new RoomEnvironment();const env=pmrem.fromScene(envRoom,.025);scene.environment=env.texture;scene.environmentIntensity=.46;envRoom.dispose();pmrem.dispose();
  const hemisphere=new THREE.HemisphereLight(0xf4f5ed,0x64705d,.48);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight(0xfff0dc,3.1);sun.position.set(-5,10,-5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:7,bottom:-7,near:.1,far:30});sun.shadow.bias=-.00015;sun.shadow.normalBias=.006;sun.shadow.radius=2.3;sun.shadow.blurSamples=8;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xdce9f0,.45);fill.position.set(4,7,5);scene.add(fill);
  const M=makeMaterials(); const pickables=[];const anchors={};
  const shop=buildShopEnvironment(scene,M,{gardenUrl:new URL('./assets/sakura-garden.jpg',import.meta.url).href});
  const atmosphere=createShopAtmosphere(scene,renderer,shop,{sun,fill,hemisphere});
  function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function lathe(profile,mat,parent,x=0,y=0,z=0,segments=96){
    const smooth=new THREE.SplineCurve(profile.map(p=>new THREE.Vector2(...p))).getPoints(Math.max(64,profile.length*6));
    const low=Math.min(...profile.map(p=>p[1])),high=Math.max(...profile.map(p=>p[1]));
    smooth.forEach(p=>{p.x=Math.max(0,p.x);p.y=THREE.MathUtils.clamp(p.y,low,high);});
    return mesh(new THREE.LatheGeometry(smooth,segments),mat,parent,x,y,z);
  }
  function tube(points,r,mat,parent,segments=48){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,segments,r,8,false),mat,parent);}
  function torus(radius,thickness,mat,parent,x=0,y=0,z=0){const t=mesh(new THREE.TorusGeometry(radius,thickness,10,96),mat,parent,x,y,z);t.rotation.x=Math.PI/2;return t;}
  function group(name,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);g.userData.tool=name;scene.add(g);anchors[name]=g;pickables.push(g);return g;}
  function combine(parent,material){const items=parent.children.filter(m=>m.isMesh&&m.material===material);if(items.length<2)return;const parts=items.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});const total=parts.reduce((n,g)=>n+g.attributes.position.count,0),geo=new THREE.BufferGeometry();for(const key of['position','normal','uv']){const size=key==='uv'?2:3,data=new Float32Array(total*size);let offset=0;for(const g of parts){data.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;}geo.setAttribute(key,new THREE.BufferAttribute(data,size));}let offset=0;const indices=[];for(const g of parts){for(const v of g.index.array)indices.push(v+offset);offset+=g.attributes.position.count;}geo.setIndex(indices);geo.computeBoundingSphere();items.forEach(m=>{parent.remove(m);m.geometry.dispose();});parts.forEach(g=>g.dispose());mesh(geo,material,parent);}
  function rounded(w,d,r){const s=new THREE.Shape();const x=-w/2,y=-d/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
  function woodUV(geo,w,d){const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/w+.5,p.getZ(i)/d+.5);}
  function slab(w,d,h,r,mat,parent,y=0){const g=new THREE.ExtrudeGeometry(rounded(w,d,r),{depth:h,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:24});g.rotateX(-Math.PI/2);woodUV(g,w,d);return mesh(g,mat,parent,0,y,0);}
  const tableGeometry=new THREE.BoxGeometry(60,.25,60),tableUV=tableGeometry.attributes.uv;
  for(let i=0;i<tableUV.count;i++)tableUV.setXY(i,tableUV.getX(i)*2.5,tableUV.getY(i)*60/18);
  const table=mesh(tableGeometry,M.table,scene,0,-.15,26.75);table.castShadow=false;
  // Restrained joints make the matte porcelain read as a real worktop.
  const groutMat=new THREE.MeshStandardMaterial({color:0x9b9e98,roughness:1});
  for(const z of[-3.25,3.6]){const joint=mesh(new THREE.BoxGeometry(60,.001,.014),groutMat,scene,0,-.024,z);joint.castShadow=false;}
  for(const x of[-6.5,6.5]){const joint=mesh(new THREE.BoxGeometry(.014,.001,60),groutMat,scene,x,-.024,26.75);joint.castShadow=false;}
  // Fine porcelain seam, outside the active preparation area.
  const seam=mesh(new THREE.BoxGeometry(.013,.001,18),new THREE.MeshStandardMaterial({color:0xa5a79d,roughness:1}),scene,8,-.022,5.75);seam.castShadow=false;
  const tray=new THREE.Group();tray.position.set(-3.65,.03,0);scene.add(tray);slab(2.35,3.65,.09,.18,M.wood,tray);
  const rim=rounded(2.35,3.65,.18);const hole=rounded(2.12,3.42,.16);rim.holes.push(new THREE.Path(hole.getPoints(48).reverse()));const rimGeo=new THREE.ExtrudeGeometry(rim,{depth:.15,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:6,curveSegments:24});rimGeo.rotateX(-Math.PI/2);woodUV(rimGeo,2.35,3.65);mesh(rimGeo,M.woodSide,tray,0,.075,0);
  // A recessed join and fine inset rim catch light around the solid timber tray.
  const trayJoin=new THREE.MeshStandardMaterial({color:0x79502e,roughness:.8});
  const insetPath=rounded(2.10,3.40,.16).getPoints(80).map(p=>[p.x,.105,-p.y]);insetPath.push(insetPath[0]);tube(insetPath,.006,trayJoin,tray,160);
  for(const x of[-.98,.98])for(const z of[-1.57,1.57]){const peg=mesh(new THREE.CircleGeometry(.022,16),M.woodSide,tray,x,.233,z);peg.rotation.x=-Math.PI/2;peg.castShadow=false;}
  // Soft contact shadow underneath the wooden tray.
  const sc=document.createElement('canvas');sc.width=sc.height=128;const sx=sc.getContext('2d');const sg=sx.createRadialGradient(64,64,15,64,64,64);sg.addColorStop(0,'rgba(24,29,19,.40)');sg.addColorStop(.35,'rgba(24,29,19,.17)');sg.addColorStop(1,'rgba(35,34,24,0)');sx.fillStyle=sg;sx.fillRect(0,0,128,128);const shadowTex=new THREE.CanvasTexture(sc);
  function contact(x,z,w,d){const m=mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}),scene,x,-.019,z);m.rotation.x=-Math.PI/2;m.castShadow=false;return m;}
  contact(-3.65,0,3.05,4.3);
  const bowl=group('bowl',0,0,.22);
  const chawanProfile=[[0,.13],[.34,.13],[.49,.17],[.65,.25],[.76,.39],[.81,.59],[.845,.77],[.847,.82],[.824,.845],[.793,.82],[.779,.65],[.724,.46],[.633,.32],[.475,.247],[.22,.232],[0,.232]];
  const chawanCurve=new THREE.SplineCurve(chawanProfile.map(p=>new THREE.Vector2(...p)));
  const chawanGeometry=new THREE.LatheGeometry(chawanCurve.getPoints(110),128);
  const chawanVertices=chawanGeometry.attributes.position;
  for(let i=0;i<chawanVertices.count;i++){
    const x=chawanVertices.getX(i),y=chawanVertices.getY(i),z=chawanVertices.getZ(i),angle=Math.atan2(z,x);
    const irregularity=1+.006*Math.sin(angle*3)+.003*Math.sin(angle*7+.7)+.002*Math.sin(y*92+Math.sin(angle*2));
    chawanVertices.setXYZ(i,x*irregularity,y+Math.max(0,(y-.52)/.33)*.007*Math.sin(angle*3+.5),z*irregularity);
  }
  chawanGeometry.computeVertexNormals();
  const glazeColors=[],rimTone=new THREE.Color(0xa98f68),baseTone=new THREE.Color(0xffffff);
  for(let i=0;i<chawanVertices.count;i++){
    const y=chawanVertices.getY(i),a=Math.atan2(chawanVertices.getZ(i),chawanVertices.getX(i));
    const edge=THREE.MathUtils.smoothstep(y,.794,.842)*(.48+Math.sin(a*5)*.12);
    const tone=baseTone.clone().lerp(rimTone,edge);glazeColors.push(tone.r,tone.g,tone.b);
  }
  chawanGeometry.setAttribute('color',new THREE.Float32BufferAttribute(glazeColors,3));const chawanMat=M.ceramic.clone();chawanMat.vertexColors=true;mesh(chawanGeometry,chawanMat,bowl);
  const footMaterial=M.stoneware;
  lathe([[.29,.025],[.37,.025],[.39,.05],[.39,.13],[.35,.16],[.29,.13],[.29,.025]],footMaterial,bowl);
  contact(0,.22,2.1,1.8);
  function setFoam(material,amount,milk=0){
    const maps=amount>.12?foamMaps(amount,milk):null,changed=!!material.map!==!!maps;
    material.map=maps?.map||null;material.normalMap=maps?.normalMap||null;material.roughnessMap=maps?.roughnessMap||null;material.normalScale.set(.36,.36);
    if(changed)material.needsUpdate=true;
  }
  const teaMat=M.tea.clone();setFoam(teaMat,.85);const liquid=mesh(new THREE.CircleGeometry(.72,128),teaMat,bowl,0,.65,0);liquid.rotation.x=-Math.PI/2;liquid.castShadow=false;
  const meniscus=torus(.717,.009,teaMat,bowl,0,.65,0);meniscus.castShadow=false;
  const ringM=new THREE.MeshBasicMaterial({color:0xb7c576,transparent:true,opacity:0,depthWrite:false});const ripple=torus(.30,.008,ringM,bowl,0,.66,0);ripple.castShadow=false;ripple.receiveShadow=false;ripple.visible=false;
  function foamRelief(radius,count,material,parent){
    const geo=new THREE.SphereGeometry(1,8,4,0,Math.PI*2,0,Math.PI/2),bubbles=new THREE.InstancedMesh(geo,material,count),r=random(471),o=new THREE.Object3D();
    for(let i=0;i<count;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*radius*.975,size=.0015+Math.pow(r(),2)*.005;
      o.position.set(Math.cos(a)*d,0,Math.sin(a)*d);o.scale.set(size,size*.48,size);o.updateMatrix();bubbles.setMatrixAt(i,o.matrix);}
    bubbles.castShadow=bubbles.receiveShadow=false;parent.add(bubbles);return bubbles;
  }
  const foamReliefMat=new THREE.MeshPhysicalMaterial({color:0x749c35,roughness:.46,clearcoat:.3,clearcoatRoughness:.28});
  const bowlMicrofoam=foamRelief(.72,650,foamReliefMat,bowl);
  const tiltedTea=createTiltedTea(teaMat,chawanInnerRadius);bowl.add(tiltedTea.mesh);
  const lipWashGeometry=new THREE.BufferGeometry();lipWashGeometry.setAttribute('position',new THREE.Float32BufferAttribute([.77,.816,-.04,.844,.833,-.028,.844,.833,.028,.77,.816,.04],3));lipWashGeometry.setIndex([0,2,1,0,3,2]);lipWashGeometry.computeVertexNormals();
  const lipWash=mesh(lipWashGeometry,new THREE.MeshPhysicalMaterial({color:0x557d15,roughness:.24,clearcoat:.45,side:THREE.DoubleSide}),bowl);lipWash.visible=false;lipWash.castShadow=false;
  function powderSurface(radius,mat,parent,y=0,depth=.04){const geom=new THREE.PlaneGeometry(radius*2,radius*2,72,72);const p=geom.attributes.position;const rand=random(42);for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),r=Math.hypot(x,z),clamp=Math.min(1,r/radius);if(r>radius){p.setX(i,x/r*radius);p.setY(i,z/r*radius);}p.setZ(i,depth*Math.pow(1-clamp,1.3)+(rand()-.5)*.007+Math.sin(x*41+Math.sin(z*29))*Math.cos(z*34+x*16)*.002+Math.sin(x*22+z*15)*.006*(1-clamp));}geom.computeVertexNormals();const m=mesh(geom,mat,parent,0,y,0);m.rotation.x=-Math.PI/2;return m;}
  const dry=powderSurface(.41,M.powder,bowl,.25,.075);dry.visible=false;
  const rand=random(107);const grains=mesh(new THREE.IcosahedronGeometry(.009,0),M.powder,bowl);bowl.remove(grains);grains.geometry.dispose();
  function granules(parent,r,y,n,scale=1,mound=0){const geo=new THREE.IcosahedronGeometry(.008,0),inst=new THREE.InstancedMesh(geo,M.powder,n),o=new THREE.Object3D();for(let i=0;i<n;i++){const a=rand()*Math.PI*2,d=Math.sqrt(rand())*r;o.position.set(Math.cos(a)*d,y+mound*Math.pow(1-d/r,1.3)+(rand()-.5)*.006,Math.sin(a)*d);const s=(rand()*.9+.3)*scale;o.scale.set(s,s*.65,s);o.rotation.set(rand()*3,rand()*3,rand()*3);o.updateMatrix();inst.setMatrixAt(i,o.matrix);inst.setColorAt(i,new THREE.Color().setRGB(.76+rand()*.24,.81+rand()*.19,.61+rand()*.32));}inst.castShadow=false;inst.receiveShadow=true;parent.add(inst);return inst;}
  const dryGrains=granules(bowl,.38,.254,1000,.7,.075);dryGrains.visible=false;
  const tin=group('powder',-4.04,.18,-1.10);lathe([[0,0],[.35,0],[.38,.035],[.38,.66],[.37,.69],[.34,.69],[.34,.10],[0,.10]],M.tin,tin);torus(.365,.012,M.gold,tin,0,.66,0);torus(.365,.011,M.tin,tin,0,.045,0);powderSurface(.336,M.powder,tin,.58,.035);granules(tin,.33,.584,2600,.5,.035);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=256;const labelCtx=labelCanvas.getContext('2d');labelCtx.fillStyle='#e7e6c9';labelCtx.textAlign='center';labelCtx.font='32px Georgia';labelCtx.fillText('sejenak.',256,86);labelCtx.font='16px sans-serif';labelCtx.fillText('C E R E M O N I A L',256,133);labelCtx.font='13px sans-serif';labelCtx.fillText('M A T C H A   ·   3 0 g',256,168);labelCtx.strokeStyle='#c8c99f';labelCtx.lineWidth=1;labelCtx.beginPath();labelCtx.moveTo(110,110);labelCtx.lineTo(402,110);labelCtx.stroke();
  const labelTex=new THREE.CanvasTexture(labelCanvas);labelTex.colorSpace=THREE.SRGBColorSpace;const labelMat=new THREE.MeshStandardMaterial({map:labelTex,transparent:true,depthWrite:false,roughness:.85});
  const tinLabel=mesh(new THREE.LatheGeometry([new THREE.Vector2(.393,.16),new THREE.Vector2(.393,.47)],48,-.9,1.8),labelMat,tin);tinLabel.castShadow=false;
  const crater=mesh(new THREE.SphereGeometry(.19,40,16,0,Math.PI*2,0,Math.PI/2),M.powder,tin,0,.56,0);crater.scale.y=.21;crater.rotation.x=Math.PI;crater.visible=false;
  const scoop=group('scoop',-3.752,.40,-.006);scoop.rotation.y=-.9;
  const scoopHandle=slab(.085,.96,.025,.035,M.bamboo,scoop,.012);scoopHandle.position.z=-.19;
  const spoonBowl=mesh(new THREE.SphereGeometry(.13,32,16,0,Math.PI*2,0,Math.PI/2),M.bamboo,scoop,0,.04,.38);spoonBowl.rotation.x=Math.PI;spoonBowl.scale.set(.62,.26,1.5);
  const spoonPowder=powderSurface(.078,M.powder,scoop,.057,.055);spoonPowder.position.z=.38;spoonPowder.scale.set(1,1.5,1);
  const rest=new THREE.Group();rest.position.set(-3.53,.16,-.19);rest.rotation.y=-.9;scene.add(rest);slab(.23,.25,.19,.03,M.wood,rest);
  const holder=group('holder',-3.20,.16,.30);lathe([[0,0],[.24,0],[.29,.05],[.27,.12],[.21,.2],[.16,.42],[.12,.49],[.08,.48],[.075,.37],[0,.32]],M.sage,holder);
  const whisk=group('whisk',-3.20,.57,.30);lathe([[0,0],[.095,0],[.098,.29],[.10,.32],[0,.32]],M.bamboo,whisk,0,0,0,48);torus(.10,.008,M.thread,whisk,0,.29,0);for(let band=0;band<5;band++)torus(.099,.0027,M.thread,whisk,0,.276+band*.007,0);torus(.098,.004,M.bamboo,whisk,0,.07,0);
  for(let i=0;i<64;i++){const a=i/64*Math.PI*2;const pts=[[.09,.26],[.14,.39],[.26,.69],[.30,.88],[.27,.98],[.22,.96],[.21,.90]].map(([r,y])=>[Math.cos(a)*r,y,Math.sin(a)*r]);tube(pts,.0065,M.bambooFine,whisk,24);}
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2;const pts=[[.08,.28],[.10,.52],[.13,.73],[.10,.86],[.065,.89],[.045,.85]].map(([r,y])=>[Math.cos(a)*r,y,Math.sin(a)*r]);tube(pts,.0055,M.bambooFine,whisk,20);}
  tube([[.10,.29,0],[.14,.27,.04],[.12,.15,.09],[.15,.09,.12]],.008,M.thread,whisk,16);
  combine(whisk,M.bambooFine);combine(whisk,M.thread);
  const sieve=group('sieve',-4.05,.26,.23);torus(.34,.019,M.metal,sieve,0,.12,0);
  // Woven steel wires alternate over and under, with a reflective curved profile.
  const sieveWeave=new THREE.Group();sieve.add(sieveWeave);
  const step=.021,r=.32;
  for(let k=-15;k<=15;k++){
    const off=k*step,extent=Math.sqrt(Math.max(0,r*r-off*off));
    for(let dir=0;dir<2;dir++){
      const pts=[];for(let j=0;j<=32;j++){const v=-extent+j/32*extent*2,x=dir?off:v,z=dir?v:off;
        pts.push([x,.12-.145*(1-(x*x+z*z)/(r*r))+.002*Math.cos(v/step*Math.PI+k*Math.PI)*(dir?1:-1),z]);}
      const wire=tube(pts,.0028,M.metal,sieveWeave,48);wire.castShadow=false;
    }
  }
  combine(sieveWeave,M.metal);sieveWeave.children[0].castShadow=false;
  torus(.326,.007,M.metal,sieve,0,.109,0);
  tube([[-.09,.12,.30],[-.10,.13,.63],[-.11,.13,1.00],[0,.13,1.08],[.11,.13,1.00],[.10,.13,.63],[.09,.12,.30]],.012,M.metal,sieve,48);tube([[-.08,.12,-.32],[-.08,.12,-.42],[.08,.12,-.42],[.08,.12,-.32]],.01,M.metal,sieve,24);
  const siftedPowder=powderSurface(.25,M.powder,sieve,.04,.025);siftedPowder.visible=false;
  const cartons={};
  for(const [i,type]of ['fresh','almond','oat'].entries()){
    const key=`milk-${type}`,carton=group(key,-4.48+i*.83,0,-2.34);
    cartons[key]=buildMilkCarton(carton,type);contact(carton.position.x,-2.34,.90,.82);
  }
  const kettle=group('water',3.28,0,-1.23);lathe([[0,.03],[.25,.03],[.39,.07],[.49,.25],[.50,.49],[.43,.72],[.33,.88],[.31,.90],[.28,.89],[.30,.83],[.37,.70],[.43,.48],[.41,.2],[.24,.10],[0,.10]],M.ceramic,kettle);
  lathe([[0,.02],[.29,.02],[.33,.04],[.32,.07],[.27,.13],[.17,.19],[0,.21]],M.ceramic,kettle,0,.87,0);mesh(new THREE.SphereGeometry(.078,32,16),M.ceramic,kettle,0,1.12,0);torus(.319,.01,M.gold,kettle,0,.922,0);
  const spout=tube([[-.37,.52,0],[-.53,.65,0],[-.65,.81,0],[-.78,.85,0]],.105,M.ceramic,kettle,32);const spoutHole=mesh(new THREE.CircleGeometry(.081,32),new THREE.MeshStandardMaterial({color:0x5e604d,roughness:.8}),kettle,-.795,.862,0);spoutHole.rotation.y=-Math.PI/2;spoutHole.rotation.z=-.3;
  tube([[.38,.65,0],[.65,.70,0],[.77,.48,0],[.63,.24,0],[.43,.25,0]],.055,M.ceramic,kettle,40);contact(3.28,-1.23,1.4,1.3);
  const glass=group('glass',3.28,0,1.24);lathe([[0,.025],[.27,.025],[.30,.05],[.34,.65],[.345,.70],[.328,.71],[.315,.66],[.282,.10],[0,.10]].map(([r,y])=>[r,glassWallY(y)]),M.glass,glass,0,0,0,96);torus(.336,.009,M.glass,glass,0,glassWallY(.703),0);torus(.285,.012,M.glass,glass,0,.06,0);glass.traverse(o=>{o.castShadow=false;o.receiveShadow=false;});const glassContact=contact(3.28,1.24,.95,.92);
  // A thin timber coaster travels with the glass; keep it outside the glass
  // hierarchy so the result close-up only clones the actual drink.
  const servingCoaster=new THREE.Group();scene.add(servingCoaster);
  slab(.92,.86,.025,.16,M.wood,servingCoaster,-.025);
  const coasterLine=rounded(.83,.77,.13).getPoints(64).map(p=>[p.x,.027,-p.y]);coasterLine.push(coasterLine[0]);tube(coasterLine,.003,M.woodSide,servingCoaster,96);
  const delivery=createServingMotion();
  function poseDelivery(){const p=delivery.pose;glass.position.set(p.x,p.y+delivery.lift,p.z);glass.rotation.y=p.yaw;servingCoaster.position.set(p.x+delivery.coasterOffset,p.y,p.z);servingCoaster.rotation.y=p.yaw;glassContact.position.set(p.x,-.019,p.z);}
  poseDelivery();
  const edgeMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,depthWrite:false});const edge=mesh(new THREE.LatheGeometry([new THREE.Vector2(.304,.08),new THREE.Vector2(.338,glassWallY(.67))],20,.6,.065),edgeMat,glass);edge.castShadow=false;edge.receiveShadow=false;
  const glassEdge=torus(.335,.0035,new THREE.MeshBasicMaterial({color:0xf8fffa,transparent:true,opacity:.48,depthWrite:false}),glass,0,glassWallY(.705),0);glassEdge.castShadow=false;glassEdge.receiveShadow=false;
  const condensation=new THREE.Group();condensation.name='condensation';glass.add(condensation);
  const dewMat=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.025,metalness:0,transmission:.85,thickness:.004,ior:1.33,transparent:true,opacity:.55,depthWrite:false});
  const dew=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),dewMat,130),dewObject=new THREE.Object3D(),dewRandom=random(319);
  for(let i=0;i<130;i++){const a=dewRandom()*Math.PI*2,wallY=.11+Math.pow(dewRandom(),.75)*.48,y=glassWallY(wallY),r=.302+(wallY-.08)/.59*.037,size=.002+Math.pow(dewRandom(),2)*.005;
    dewObject.position.set(Math.sin(a)*(r+.001),y,Math.cos(a)*(r+.001));dewObject.rotation.set(0,a,0);dewObject.scale.set(size,size*(1+dewRandom()*.7),size*.45);dewObject.updateMatrix();dew.setMatrixAt(i,dewObject.matrix);}
  dew.castShadow=false;dew.receiveShadow=false;condensation.add(dew);condensation.visible=false;
  // Serving starts slow advection and diffusion of the two visible layers.
  const mixing=createMixingState(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const servingMat=M.tea.clone();
  const latteUniforms={milkTint:{value:milkColor(null)},milkRatio:{value:0},milkFirst:{value:1},hasMatcha:{value:0},mixProgress:{value:0},mixTime:{value:0},mixMotion:{value:1},surfaceFoam:{value:0}};
  const latteDeclarations=`uniform float milkRatio, milkFirst, hasMatcha, mixProgress, mixTime, mixMotion, surfaceFoam;
    uniform vec3 milkTint;
    vec3 latteGreen(){return vec3(.085,.23,.012);}
    vec3 latteIvory(){return milkTint;}
    vec3 blendedLatte(){return exp(mix(log(latteGreen()),log(latteIvory()),milkRatio));}
  `;
  servingMat.color.set(0xffffff);servingMat.roughness=.42;
  servingMat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,latteUniforms);
    shader.vertexShader='varying vec3 lattePos;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlattePos=position;');
    shader.fragmentShader='varying vec3 lattePos;\n'+latteDeclarations+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float h=lattePos.y+.5;
      float a=atan(lattePos.z,lattePos.x);
      float motion=sin(mixProgress*3.14159265)*mixMotion;
      float swirl=a+motion*(h*5.-mixTime*.28);
      float flow=sin(swirl*3.+h*7.-mixTime*.40)*.17+sin(swirl*5.-h*9.+mixTime*.23)*.08;
      float advected=h+motion*flow;
      float strands=sin(swirl*9.+sin(swirl*5.))*0.035+sin(swirl*17.+h*8.)*0.012;
      float edge=mix(1.-milkRatio,milkRatio,milkFirst);
      float wisps=strands*exp(-abs(h-edge)*7.);
      float drips=pow(max(0.,sin(swirl*7.+sin(swirl*3.))),8.)*.13*exp(-abs(h-edge)*5.);
      float feather=.045+mixProgress*.18;
      float upper=smoothstep(edge-feather,edge+feather,advected+wisps+drips*milkFirst);
      float milkAmount=mix(upper,1.-upper,milkFirst);
      milkAmount=mix(milkAmount,1.,step(.999,milkRatio));
      milkAmount=mix(milkAmount,0.,step(milkRatio,.001));
      vec3 green=latteGreen(), ivory=latteIvory();
      vec3 blend=mix(green,ivory,milkAmount);
      blend=mix(blend,blendedLatte(),smoothstep(.08,1.,mixProgress));
      blend=mix(ivory,blend,hasMatcha);
      diffuseColor.rgb*=blend;
    `);
  };
  const glassLiquid=mesh(new THREE.CylinderGeometry(.315,.282,1,96,1,true),servingMat,glass);glassLiquid.visible=false;glassLiquid.castShadow=false;
  const glassTop=mesh(new THREE.CircleGeometry(.315,96),M.tea.clone(),glass);glassTop.rotation.x=-Math.PI/2;glassTop.visible=false;glassTop.castShadow=false;
  glassTop.material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,latteUniforms);
    shader.vertexShader='varying vec2 latteSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlatteSurface=position.xy/.315;');
    shader.fragmentShader='varying vec2 latteSurface;\n'+latteDeclarations+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float radius=length(latteSurface), angle=atan(latteSurface.y,latteSurface.x);
      float motion=sin(mixProgress*3.14159265)*mixMotion;
      float spiral=sin(angle*3.+radius*9.-mixTime*.5)*.16+sin(angle*5.-radius*6.+mixTime*.25)*.08;
      float localMix=clamp(mixProgress+motion*spiral,0.,1.);
      float bubbleDetail=mix(1.,clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/.22,.60,1.08),surfaceFoam);
      diffuseColor.rgb=mix(diffuseColor.rgb,blendedLatte()*bubbleDetail,localMix);
    `);
  };
  const glassFoamMat=foamReliefMat.clone();
  glassFoamMat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,latteUniforms);shader.fragmentShader=latteDeclarations+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,blendedLatte()*1.12,mixProgress);');
  };
  const glassMicrofoam=foamRelief(.315,400,glassFoamMat,glass);
  const cloudLayer=createCloudLayer(foamMaps(.25,1)),cloudCap=cloudLayer.group,creamSurface=cloudLayer.surfaceMaterial;
  glass.add(cloudCap);
  const iceMat=M.ice;
  const iceShape=rounded(.145,.145,.018);const iceGeometry=new THREE.ExtrudeGeometry(iceShape,{depth:.12,bevelEnabled:true,bevelSegments:5,bevelSize:.012,bevelThickness:.012,curveSegments:10});iceGeometry.center();
  const airMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.26,depthWrite:false});
  const iceAir=new THREE.Group(),airRandom=random(83);
  for(let i=0;i<11;i++){const bubble=mesh(new THREE.SphereGeometry(.0012+airRandom()*.0019,6,4),airMat,iceAir,(airRandom()-.5)*.09,(airRandom()-.5)*.09,(airRandom()-.5)*.07);bubble.scale.y=1+airRandom()*1.5;}
  combine(iceAir,airMat);iceAir.children[0].castShadow=false;iceAir.children[0].receiveShadow=false;
  function cube(parent,x,y,z,i){const ice=mesh(iceGeometry,iceMat,parent,x,y,z);ice.rotation.set(.13+i*.33,i*.9,.2+i*.17);ice.castShadow=false;ice.receiveShadow=false;ice.add(iceAir.clone(true));return ice;}
  const glassIce=new THREE.Group();glassIce.name='floating-ice';glass.add(glassIce);for(let i=0;i<MAX_ICE_CUBES;i++)cube(glassIce,0,.2,0,i);
  const iceDish=group('ice',4.48,.015,-.02);
  lathe([[0,0],[.55,0],[.65,.06],[.72,.16],[.76,.43],[.754,.48],[.727,.491],[.698,.46],[.68,.20],[.60,.10],[0,.10]],M.sage,iceDish);
  torus(.733,.018,M.metal,iceDish,0,.483,0);torus(.565,.014,M.sage,iceDish,0,.028,0);
  const packedIce=random(612),storedIce=new THREE.Group();storedIce.name='stored-ice';iceDish.add(storedIce);
  function storedCube(angle,radius,height,size,index){
    const c=cube(storedIce,Math.cos(angle)*radius,height,Math.sin(angle)*radius,index);
    c.scale.setScalar(size);c.rotation.set((packedIce()-.5)*.5,packedIce()*Math.PI*2,(packedIce()-.5)*.5);
  }
  // Nine lower cubes and nineteen across the open top make a full, layered
  // bucket. The outer ring sits lower so its corners remain behind the rim.
  storedCube(0,0,.255,1.35,0);
  for(let i=0;i<8;i++)storedCube(i*Math.PI/4+.13,.34,.25+(packedIce()-.5)*.018,1.25+packedIce()*.14,i+1);
  storedCube(0,0,.412,1.48,9);
  for(let i=0;i<6;i++)storedCube(i*Math.PI/3+.26,.27,.405+(packedIce()-.5)*.022,1.38+packedIce()*.13,i+10);
  for(let i=0;i<12;i++)storedCube(i*Math.PI/6+.02,.52,.365+(packedIce()-.5)*.022,1.20+packedIce()*.10,i+16);
  contact(4.48,-.02,1.75,1.7);
  const pickupCubes=storedIce.children.slice(9,21);
  pickupCubes.forEach(c=>{c.scale.setScalar(1);c.rotation.set(0,TONGS_YAW,0);});
  const iceToGlass=iceDish.position.clone().sub(glass.position);
  const tongHome={x:iceToGlass.x+.39,y:iceToGlass.y+.50,z:iceToGlass.z-.38};
  const transferMotion=createIceTransfer({home:tongHome,pickups:pickupCubes.map(c=>({x:c.position.x+iceToGlass.x,y:c.position.y+iceToGlass.y,z:c.position.z+iceToGlass.z}))});
  const iceMotion=createIceMotion({transfer:transferMotion});
  const iceTongs=createIceTongs(M.metal);iceDish.add(iceTongs.group);
  function poseTongs(){const p=iceMotion.tongs;iceTongs.group.position.set(p.x-iceToGlass.x,p.y-iceToGlass.y,p.z-iceToGlass.z);iceTongs.group.rotation.y=p.yaw;iceTongs.open(p.opening);pickupCubes.forEach((c,i)=>{c.visible=!iceMotion.poses[i].picked;});}
  poseTongs();
  const cloudJug=group('cloud',-3.55,.16,1.25);lathe([[0,0],[.23,0],[.30,.05],[.31,.35],[.28,.4],[.25,.39],[.27,.33],[.25,.07],[0,.07]],M.ceramic,cloudJug);const creamTop=mesh(new THREE.CircleGeometry(.26,64),creamSurface,cloudJug,0,.32,0);creamTop.rotation.x=-Math.PI/2;
  const steam=new THREE.Group();glass.add(steam);const steamMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.15,depthWrite:false});
  for(let i=0;i<3;i++){const wisp=tube([[-.1+i*.1,0,0],[-.13+i*.1,.11,.02],[-.08+i*.1,.24,0],[-.1+i*.1,.36,-.02]],.006,steamMat,steam,24);wisp.castShadow=false;}
  let currentState=null,glassFoam=-1,glassGreen=false;
  // The result uses the actual serving glass and mixture, rendered up close.
  const resultScene=new THREE.Scene();resultScene.background=new THREE.Color(0xe7e4da);
  resultScene.environment=scene.environment;resultScene.environmentIntensity=.42;
  resultScene.add(new THREE.HemisphereLight(0xf7f8ed,0x758365,.6));
  const resultSun=new THREE.DirectionalLight(0xfff3e2,3);resultSun.position.set(-3,5,3);resultScene.add(resultSun);
  const resultFill=new THREE.DirectionalLight(0xe8f0ff,.6);resultFill.position.set(3,3,-2);resultScene.add(resultFill);
  const resultFloor=mesh(new THREE.PlaneGeometry(30,30),M.table,resultScene,0,0,0);resultFloor.rotation.x=-Math.PI/2;resultFloor.castShadow=false;
  const resultContact=mesh(new THREE.PlaneGeometry(1.3,1.2),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.65}),resultScene,0,.003,0);resultContact.rotation.x=-Math.PI/2;resultContact.castShadow=false;
  const resultCamera=new THREE.OrthographicCamera(-2,2,2,-2,.1,20);resultCamera.position.set(1.7,2.35,3.2);resultCamera.lookAt(0,GLASS_RIM_Y*.48,0);
  let resultGlass=null,resultIce=null,resultActive=false,servedLevel=.45;
  // A restrained canopy pattern breaks the morning light at the top left.
  const lc=document.createElement('canvas');lc.width=lc.height=512;const lctx=lc.getContext('2d');lctx.clearRect(0,0,512,512);lctx.fillStyle='rgba(0,0,0,.15)';lctx.strokeStyle='rgba(0,0,0,.12)';lctx.lineWidth=7;const lr=random(8);for(let i=0;i<22;i++){const x=lr()*400,y=lr()*500;lctx.save();lctx.translate(x,y);lctx.rotate(-.7+lr()*.5);lctx.beginPath();lctx.ellipse(0,0,18+lr()*16,4+lr()*5,0,0,Math.PI*2);lctx.fill();lctx.restore();}const leafTex=new THREE.CanvasTexture(lc);const foliage=mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshBasicMaterial({map:leafTex,transparent:true,depthWrite:false,opacity:.35}),scene,-6,-.015,-3.5);foliage.rotation.x=-Math.PI/2;foliage.castShadow=false;
  // Reusable powder particles and pouring stream.
  const partGeo=new THREE.BufferGeometry();const partPositions=new Float32Array(160*3);partGeo.setAttribute('position',new THREE.BufferAttribute(partPositions,3));const particleMat=new THREE.PointsMaterial({color:0x799927,size:.018,transparent:true,opacity:.8,sizeAttenuation:true});const particles=new THREE.Points(partGeo,particleMat);particles.visible=false;scene.add(particles);
  const pourEffects=createPourEffects(scene,{bowl,glass});
  const outlets={},pourAim=new THREE.Vector3(),tipOffset=new THREE.Vector3();
  const pourTools={
    water:{local:[-.795,.862,0],aim:[.02,1.15,.14],tilt:.72,direction:new THREE.Vector3(-.9,.25,0),receiver:'bowl',color:0xc8e1d3,radius:.016},
    bowl:{local:[.84,.831,0],aim:[3.13,1.33,1.18],tilt:-.95,direction:new THREE.Vector3(1,0,0),receiver:'glass',color:0x557d15,radius:.023},
    cloud:{local:[.277,.397,0],aim:[3.14,1.27,1.18],tilt:-.8,direction:new THREE.Vector3(1,0,0),receiver:'glass',color:0xf5eedb,radius:.022}
  };
  // Tip inward from the right, with the carton face toward the player. A quarter
  // turn here used to move the carton body in front of the glass instead.
  for(const[key,carton]of Object.entries(cartons))pourTools[key]={local:carton.local,aim:[3.28,1.66,1.15],tilt:1.12,direction:new THREE.Vector3(0,.75,.66),receiver:'glass',color:MILK_TYPES[key.slice(5)].liquid,radius:.018};
  for(const[key,config]of Object.entries(pourTools)){const outlet=new THREE.Object3D();outlet.position.fromArray(config.local);outlet.name='pour-outlet';anchors[key].add(outlet);outlets[key]=outlet;}
  function aimPour(key){const config=pourTools[key];tipOffset.fromArray(config.local).applyEuler(anchors[key].rotation);return pourAim.fromArray(config.aim).sub(tipOffset);}
  function pourInput(key,kind=key){return {...pourTools[key],outlet:outlets[key],kind};}
  tray.userData.tool='tray';pickables.push(tray);rest.userData.tool='scoop';pickables.push(rest);
  const whiskOffset=new THREE.Vector2();
  const heldMotions=Object.fromEntries(['water','whisk',...Object.keys(cartons)].map(key=>[key,createToolMotion()]));
  const homes={};for(const [k,g]of Object.entries(anchors))homes[k]={position:g.position.clone(),rotation:g.rotation.clone()};
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  let action=null,lastFoam=-1,lastMilk=-1,serveProgress=0,shadowUntil=1,frameNumber=0;
  const iceSounds=[];
  const iceBatchCue=createIceBatchCue();
  const audioState={pour:{kind:null,intensity:0,receiver:null,fill:0},whisk:{intensity:0,foam:0,speed:1},powder:{scoop:0,sift:0},ice:iceSounds};
  const previousIceFall=new Uint8Array(MAX_ICE_CUBES),previousIceVelocity=new Float32Array(MAX_ICE_CUBES);
  function clearIceSounds(){iceSounds.length=0;iceBatchCue.clear();}
  function silenceAudio(){Object.assign(audioState.pour,{kind:null,intensity:0,receiver:null,fill:0});Object.assign(audioState.whisk,{intensity:0,foam:0,speed:1});audioState.powder.scoop=audioState.powder.sift=0;clearIceSounds();}
  function drainIceSounds(){if(document.hidden||resultActive){clearIceSounds();return [];}return iceSounds.splice(0);}
  const width=()=>canvas.clientWidth,height=()=>canvas.clientHeight;
  function resize(){const w=width(),h=height();renderer.setSize(w,h,false);const aspect=w/h;shop.resize(w,h);cameraMotion.setMobile(w<=700);applyCamera(cameraMotion.pose);
    const wide=w>700,heroHeight=wide?Math.min(390,h*.55):Math.min(205,h*.25),viewHeight=h*(GLASS_RIM_Y+.30)/heroHeight;
    resultCamera.left=-viewHeight*aspect/2;resultCamera.right=viewHeight*aspect/2;resultCamera.top=viewHeight/2;resultCamera.bottom=-viewHeight/2;
    resultCamera.setViewOffset(w,h,wide?w*.235:0,wide?0:h*.33,w,h);resultCamera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);resize();
  function setZoom(delta){cameraMotion.setZoom(delta);}
  function startAction(type,onComplete){if(delivery.phase!=='idle'||resultActive)return false;type=preparationAction(type);hoverGlow.clear();action={type,time:0,onComplete,creamFrom:cloudCap.visible?cloudCap.scale.y/GLASS_FILL_DEPTH*GLASS_CAPACITY_ML:0};if(type==='serve')pourEffects.reset();if(type==='ice'){iceSounds.length=0;iceBatchCue.start(iceMotion.poses.filter(p=>p.visible).length,3,{individual:true});}return true;}
  function startDelivery(onComplete){
    if(action||resultActive)return false;
    if(!delivery.start(onComplete,{reducedMotion:reducedMotion.matches}))return false;
    hoverGlow.clear();silenceAudio();pourEffects.reset();mixing.start();renderer.shadowMap.needsUpdate=true;return true;
  }
  function returnDelivery(){return delivery.returnHome({reducedMotion:reducedMotion.matches});}
  function hideResult(){clearIceSounds();resultActive=false;renderer.shadowMap.needsUpdate=true;}
  function showResult(){hoverGlow.clear();silenceAudio();pourEffects.reset();mixing.start();if(resultGlass)resultScene.remove(resultGlass);resultGlass=glass.clone(true);cloudLayer.syncClone(resultGlass);resultIce=resultGlass.getObjectByName('floating-ice');resultGlass.position.set(0,0,0);resultGlass.rotation.set(0,-.22,0);resultScene.add(resultGlass);resultActive=true;resize();renderer.shadowMap.needsUpdate=true;}
  function resetObjects(){hoverGlow.clear();silenceAudio();delivery.reset();poseDelivery();hideResult();tiltedTea.mesh.visible=lipWash.visible=false;pourEffects.reset();applyCamera(cameraMotion.reset());mixing.reset();iceMotion.reset();poseTongs();Object.values(heldMotions).forEach(m=>m.reset());whiskOffset.set(0,0);resultIce=null;latteUniforms.mixProgress.value=latteUniforms.mixTime.value=0;renderer.shadowMap.needsUpdate=true;action=null;for(const[k,g]of Object.entries(anchors)){g.position.copy(homes[k].position);g.rotation.copy(homes[k].rotation);if(g.userData.cap)g.userData.cap.visible=true;}particles.visible=false;siftedPowder.visible=false;spoonPowder.visible=true;glassLiquid.visible=false;glassTop.visible=false;cloudLayer.reset();glassIce.visible=false;glassMicrofoam.visible=bowlMicrofoam.visible=false;steam.visible=false;condensation.visible=false;serveProgress=0;}
  function chawanInnerRadius(level){const contour=[[.232,0],[.247,.475],[.32,.633],[.46,.724],[.65,.779],[.82,.793]];for(let i=1;i<contour.length;i++){if(level<=contour[i][0]){const [lowY,lowR]=contour[i-1],[highY,highR]=contour[i];return THREE.MathUtils.lerp(lowR,highR,(level-lowY)/(highY-lowY))-.014;}}return .779;}
  function renderGlass(g,temperature){
    if(action?.type==='cloud')g={...g,cream:THREE.MathUtils.lerp(action.creamFrom,g.cream,pourPhase(action.time/POUR_DURATION.cloud).fill)};
    mixing.setRecipe(g);latteUniforms.mixProgress.value=mixing.progress;
    const total=g.water+g.milk,depth=GLASS_FILL_DEPTH*Math.min(total/GLASS_CAPACITY_ML,1),creamDepth=GLASS_FILL_DEPTH*g.cream/GLASS_CAPACITY_ML,displace=GLASS_FILL_DEPTH*g.ice*10/GLASS_CAPACITY_ML;
    const top=GLASS_BASE_Y+depth+displace,radius=.282+Math.min((top-GLASS_BASE_Y)/(.60*1.5),1)*.035;
    glassLiquid.visible=glassTop.visible=total>.1;
    glassLiquid.scale.set(1,depth+displace,1);glassLiquid.position.y=GLASS_BASE_Y+(depth+displace)/2;
    glassTop.position.y=top+.002;glassTop.scale.setScalar(radius/.315);
    latteUniforms.milkRatio.value=g.milk/Math.max(total,1);latteUniforms.milkFirst.value=g.first==='milk'?1:0;latteUniforms.hasMatcha.value=g.powder>0?1:0;
    milkColor(g,latteUniforms.milkTint.value);
    const greenTop=g.powder>0&&(g.first==='milk'||g.milk<1);
    if(greenTop!==glassGreen||Math.abs(g.foam-glassFoam)>.1){setFoam(glassTop.material,greenTop?g.foam:0);glassGreen=greenTop;glassFoam=g.foam;}
    if(greenTop)glassTop.material.color.set(glassTop.material.map?0xffffff:0x4b7119);else glassTop.material.color.copy(latteUniforms.milkTint.value);
    latteUniforms.surfaceFoam.value=glassTop.material.map?1:0;
    glassTop.material.roughness=.48;
    glassMicrofoam.visible=total>.1&&greenTop&&g.foam>.12;glassMicrofoam.position.y=top+.003;glassMicrofoam.scale.setScalar(radius/.315);glassMicrofoam.count=Math.floor(400*g.foam);
    cloudCap.visible=g.cream>.01;
    cloudCap.scale.set(radius/.315,Math.max(.0005,creamDepth),radius/.315);cloudCap.position.y=top+creamDepth/2;
    cloudLayer.setBaseColor(greenTop,latteUniforms.milkRatio.value,mixing.progress,latteUniforms.milkTint.value);
    glassIce.visible=g.ice>0;iceMotion.setFill(g.ice,top,total>.1,top+creamDepth);
    condensation.visible=temperature==='ice'&&g.ice>0&&total>0;
    steam.visible=temperature==='hot'&&total>0;steam.position.y=top+creamDepth+.035;
  }
  function renderBowlVolume(volume){
    const hasLiquid=volume>.1,level=.255+Math.min(volume/180,1)*.445,radius=chawanInnerRadius(level);
    liquid.visible=meniscus.visible=hasLiquid;liquid.position.y=meniscus.position.y=level;liquid.scale.setScalar(radius/.72);meniscus.scale.set(radius/.717,radius/.717,1);
    bowlMicrofoam.position.y=level+.002;bowlMicrofoam.scale.setScalar(radius/.72);if(!hasLiquid)bowlMicrofoam.visible=false;
    return {hasLiquid,level,radius};
  }
  function updateMixture(state){
    currentState=state;
    const {hasLiquid,level,radius}=renderBowlVolume(state.water);
    teaMat.color.set(state.powder>0?(state.foam>.12?0xffffff:0x56781b):0xb9cdc0);teaMat.roughness=state.foam>.25?.45:.20;
    if(Math.abs(state.foam-lastFoam)>.10||(state.powder>0)!==lastMilk){setFoam(teaMat,state.powder>0?state.foam:0);lastFoam=state.foam;lastMilk=state.powder>0;}
    dry.visible=dryGrains.visible=state.powder>0&&!hasLiquid;const scale=Math.min(1.4,.4+state.powder*.2);dry.scale.set(scale,scale,scale);dryGrains.scale.set(scale,1,scale);dry.position.y=.25;
    bowlMicrofoam.visible=hasLiquid&&state.powder>0&&state.foam>.12;bowlMicrofoam.position.y=level+.002;bowlMicrofoam.scale.setScalar(radius/.72);bowlMicrofoam.count=Math.floor(650*state.foam);
    renderGlass(state.glass,state.temperature);
  }
  function fillGlass(progress){if(!currentState)return;const s=currentState,g=s.glass,water=s.water*progress;renderGlass({...g,water:g.water+water,powder:g.powder+s.powder*progress,foam:(g.foam*g.water+s.foam*water)/Math.max(.001,g.water+water),first:g.first||'matcha'},s.temperature);}
  function showServed(){tiltedTea.mesh.visible=lipWash.visible=false;fillGlass(1);liquid.visible=meniscus.visible=dry.visible=dryGrains.visible=bowlMicrofoam.visible=false;}
  function animateIce(dt,holding,selected){
    const pouring=pourEffects.receiver==='glass'?pourEffects.impact:0;
    iceMotion.poses.forEach((p,i)=>{previousIceFall[i]=p.falling?1:0;previousIceVelocity[i]=p.vy;});
    if(!document.hidden)iceMotion.advance(dt,{pouring,swirl:Math.sin(mixing.progress*Math.PI),reducedMotion:reducedMotion.matches});
    poseTongs();
    if(!document.hidden&&!resultActive){
      const surface={level:cloudCap.visible?cloudCap.position.y+cloudCap.scale.y/2:glassTop.position.y,radius:glassTop.scale.x*.315,wet:glassTop.visible,matcha:glassGreen&&!cloudCap.visible};
      for(const contact of iceMotion.contacts){
        pourEffects.addImpactRipples('glass',cloudCap.visible?{...contact,strength:contact.strength*.55}:contact,surface,reducedMotion.matches);
        if(!reducedMotion.matches)cloudLayer.disturb(contact.strength);
      }
    }
    iceMotion.poses.forEach((p,i)=>{
      if(!document.hidden&&!resultActive&&p.visible&&previousIceFall[i]&&!p.falling){
        const batch=iceBatchCue.landing(i);
        if(batch)iceSounds.push({...batch,wet:glassTop.visible,index:i,intensity:THREE.MathUtils.clamp(Math.abs(previousIceVelocity[i])/1.8,.45,1),pan:THREE.MathUtils.clamp((glass.position.x+p.x-camera.position.x)/6.5,-.6,.6)});
      }
      for(const group of resultActive?[glassIce,resultIce]:[glassIce]){
        const cube=group.children[i];cube.visible=p.visible;
        cube.position.set(p.x,p.y,p.z);cube.rotation.set(p.rx,p.ry,p.rz);
      }
    });
  }
  function animate(dt,t,state,holding,selected){
    hoverGlow.update(dt,reducedMotion.matches);
    atmosphere.update(dt,{active:!document.hidden,reducedMotion:reducedMotion.matches});
    shop.update(dt,{active:!document.hidden&&!resultActive,reducedMotion:reducedMotion.matches});
    audioState.powder.scoop=audioState.powder.sift=0;
    if(document.hidden||resultActive)silenceAudio();
    if(!document.hidden)mixing.advance(dt);
    latteUniforms.mixProgress.value=mixing.progress;latteUniforms.mixTime.value=mixing.elapsed*.65;latteUniforms.mixMotion.value=reducedMotion.matches?0:1;
    cloudLayer.setBaseColor(glassGreen,latteUniforms.milkRatio.value,mixing.progress,latteUniforms.milkTint.value);
    cloudLayer.update(dt,{pouring:pourEffects.receiver==='glass'?pourEffects.impact:0,mixing:Math.sin(mixing.progress*Math.PI),reducedMotion:reducedMotion.matches,active:!document.hidden});
    if(resultActive){animateIce(dt,false,selected);resultGlass.rotation.y=reducedMotion.matches?-.22:-.22+Math.sin(t*.18)*.05;renderer.render(resultScene,resultCamera);return;}
    delivery.advance(dt,{active:!document.hidden});poseDelivery();
    // Completion can open the result dialog during advance(). Render that
    // scene immediately, without a final counter frame flashing over it.
    if(resultActive){animateIce(dt,false,selected);renderer.render(resultScene,resultCamera);return;}
    frameNumber++;if(action||holding||delivery.active)shadowUntil=t+1.8;if((t<shadowUntil&&frameNumber%2===0)||frameNumber%24===0)renderer.shadowMap.needsUpdate=true;
    applyCamera(cameraMotion.advance(document.hidden?0:dt,{holding,selected,action:action?.type,delivery:delivery.focus,reducedMotion:reducedMotion.matches}));
    let flowInput=null;
    if(action){if(!document.hidden||action.type!=='ice')action.time+=dt;const a=action;const dur=a.type==='ice'&&reducedMotion.matches?.2:ACTION_DURATION[a.type]||3.2;
      if(a.type==='sieve'){
        const p=Math.min(a.time/dur,1),smooth=(a,b)=>THREE.MathUtils.smoothstep(p,a,b);
        const lift=smooth(0,.23)*(1-smooth(.80,1)),spoonLift=smooth(0,.23)*(1-smooth(.49,.70));
        sieve.position.lerpVectors(homes.sieve.position,new THREE.Vector3(0,1.04,.22),lift);
        const shaking=smooth(.42,.49)*(1-smooth(.75,.80));
        sieve.position.x+=Math.sin(t*17)*.028*shaking;
        // The spoon's bowl sits directly over the sieve before sifting begins.
        scoop.rotation.y=THREE.MathUtils.lerp(homes.scoop.rotation.y,0,spoonLift);
        scoop.rotation.z=-.45*smooth(.23,.31)*(1-smooth(.46,.55));
        scoop.position.lerpVectors(homes.scoop.position,new THREE.Vector3(-.024,1.53,-.16),spoonLift);
        spoonPowder.visible=p<.42||p>.92;
        siftedPowder.visible=p>.28&&p<.80;siftedPowder.scale.setScalar(Math.max(.02,smooth(.28,.42)*(1-smooth(.46,.80))));
        if(!document.hidden)powderSoundLevels('sieve',p,audioState.powder);
        particles.visible=p>.26&&p<.80;
        const toSieve=p<.45,origin=toSieve?1.55:1.02,landing=toSieve?1.02:(state.water>0?bowl.position.y+liquid.position.y:bowl.position.y+.27),spread=toSieve?.055:.25;
        for(let i=0;i<160;i++){const cycle=(t*1.8+i/160)%1;partPositions[i*3]=Math.sin(i*7.13)*spread+(toSieve?0:sieve.position.x);partPositions[i*3+1]=origin-cycle*(origin-landing);partPositions[i*3+2]=.22+Math.cos(i*5.37)*spread;}
        partGeo.attributes.position.needsUpdate=true;
      }else if(a.type==='serve'){
        const phase=pourPhase(a.time/dur);bowl.rotation.z=pourTools.bowl.tilt*phase.tilt;bowl.position.lerpVectors(homes.bowl.position,aimPour('bowl'),phase.lift);
        if(phase.flow)flowInput=pourInput('bowl','serve');fillGlass(phase.fill);renderBowlVolume(state.water*(1-phase.fill));
        tiltedTea.update(state.water*(1-phase.fill),bowl.rotation.z);liquid.visible=meniscus.visible=bowlMicrofoam.visible=false;lipWash.visible=phase.flow&&tiltedTea.mesh.visible;
      }
      if(a.type==='cloud'){const phase=pourPhase(a.time/dur);cloudJug.rotation.z=pourTools.cloud.tilt*phase.tilt;cloudJug.position.lerpVectors(homes.cloud.position,aimPour('cloud'),phase.lift);if(phase.flow)flowInput=pourInput('cloud');renderGlass(state.glass,state.temperature);}
      if(a.time>=dur){for(const key of['scoop','sieve','bowl','cloud']){anchors[key].position.copy(homes[key].position);anchors[key].rotation.copy(homes[key].rotation);}particles.visible=false;siftedPowder.visible=false;spoonPowder.visible=true;if(a.type==='serve')showServed();action=null;a.onComplete?.();}
    }
    const pouring=holding&&(selected==='water'||selected==='milk');const whisking=holding&&selected==='whisk';
    const milkKey=`milk-${state.selectedMilk||'fresh'}`;
    for(const key of['water','whisk',...Object.keys(cartons)]){
      const g=anchors[key],isMilk=key.startsWith('milk-'),active=holding&&(isMilk?selected==='milk'&&key===milkKey:selected===key);
      const motion=heldMotions[key].advance(dt,active),stroke=motion.stroke;
      if(isMilk){g.rotation.y=0;g.userData.cap.visible=!active&&motion.tilt<.1;}
      g.rotation.z=(key==='whisk'?Math.PI+.15:pourTools[key].tilt)*motion.tilt;
      g.rotation.x=key==='whisk'?Math.sin(t*12)*.08*stroke:0;
      if(key==='whisk'){
        const follow=1-Math.exp(-dt*6);
        whiskOffset.x=THREE.MathUtils.lerp(whiskOffset.x,(state.manualWhisk?state.whiskX:Math.sin(t*11)*.085)*stroke,follow);
        whiskOffset.y=THREE.MathUtils.lerp(whiskOffset.y,(state.manualWhisk?state.whiskZ:Math.cos(t*9)*.055)*stroke,follow);
      }
      const target=key==='whisk'?new THREE.Vector3(whiskOffset.x,1.28,.22+whiskOffset.y):aimPour(key);
      g.position.lerpVectors(homes[key].position,target,motion.lift);
    }
    const pourKey=selected==='milk'?milkKey:selected;
    if(pouring&&Math.abs(anchors[pourKey].rotation.z)>.4)flowInput=pourInput(pourKey,selected);
    pourEffects.update(dt,t,flowInput,{
      bowl:{level:liquid.position.y,radius:liquid.scale.x*.72,wet:liquid.visible},
      glass:{level:cloudCap.visible?cloudCap.position.y+cloudCap.scale.y/2:glassTop.position.y,radius:glassTop.scale.x*.315,wet:glassTop.visible}
    },reducedMotion.matches);
    const whiskNearBowl=Math.hypot(anchors.whisk.position.x,anchors.whisk.position.z-.22)<.30&&anchors.whisk.rotation.z>2.6;
    ripple.visible=whisking&&whiskNearBowl&&state.water>0;
    if(ripple.visible){liquid.rotation.z+=dt*.45;const pulse=(t*1.1)%1;ripple.position.y=liquid.position.y+.005;ripple.scale.setScalar(.5+pulse*1.5);ringM.opacity=(1-pulse)*.3;}else ringM.opacity=0;
    steam.children.forEach((w,i)=>{w.position.x=Math.sin(t*.8+i)*.013;});
    animateIce(dt,holding,selected);
    if(!document.hidden){
      const receiver=pourEffects.receiver;
      Object.assign(audioState.pour,{kind:pourEffects.kind||null,intensity:pourEffects.impact,receiver:receiver||null,fill:THREE.MathUtils.clamp(receiver==='bowl'?(liquid.position.y-.255)/.445:(glassTop.position.y-GLASS_BASE_Y)/GLASS_FILL_DEPTH,0,1)});
      Object.assign(audioState.whisk,{intensity:whisking&&whiskNearBowl&&state.water>=5&&state.powder>=1?1:0,foam:state.foam,speed:.65});
    }
    renderer.render(scene,camera);
  }
  function pick(clientX,clientY){const rect=canvas.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(pickables,true)[0];if(!hit)return null;let obj=hit.object;while(obj&&!obj.userData.tool)obj=obj.parent;return obj?.userData.tool||null;}
  // Invisible hit volumes make slender bamboo and the mesh sieve usable by touch.
  const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  function hitVolume(key,size,position){const hit=new THREE.Mesh(new THREE.BoxGeometry(...size),hitMaterial);hit.position.set(...position);anchors[key].add(hit);}
  hitVolume('sieve',[.68,.13,1.48],[0,.14,.34]);
  hitVolume('whisk',[.52,.98,.52],[0,.51,0]);
  hitVolume('scoop',[.20,.12,1.36],[0,.05,-.02]);
  hitVolume('glass',[.66,GLASS_RIM_Y,.66],[0,GLASS_RIM_Y/2,0]);
  const hitBounds={};
  scene.updateMatrixWorld(true);
  for(const [key,g]of Object.entries({...anchors,tray})){
    const box=new THREE.Box3(),partBox=new THREE.Box3(),inverse=g.matrixWorld.clone().invert();
    // Hidden liquid/ice and invisible touch targets must not push labels away.
    g.traverseVisible(part=>{
      if(!part.isMesh)return;
      const materials=Array.isArray(part.material)?part.material:[part.material];
      if(materials.every(m=>!m.colorWrite||m.opacity===0))return;
      if(part.isInstancedMesh){part.computeBoundingBox();partBox.copy(part.boundingBox);}
      else{part.geometry.computeBoundingBox();partBox.copy(part.geometry.boundingBox);}
      box.union(partBox.applyMatrix4(part.matrixWorld));
    });
    hitBounds[key]=[box.min.clone().applyMatrix4(inverse),box.max.clone().applyMatrix4(inverse)];
  }
  const hoverGlow=createHoverGlow({...anchors,tray,rest},{powder:['powder','scoop','sieve','rest'],scoop:['scoop','sieve','rest'],sieve:['scoop','sieve','rest'],holder:['holder','whisk']});
  const screenPoint=new THREE.Vector3();
  function screenTargets(){
    const rect=canvas.getBoundingClientRect(),targets={};camera.updateMatrixWorld();
    for(const [key,[min,max]]of Object.entries(hitBounds)){
      const g=key==='tray'?tray:anchors[key];g.updateWorldMatrix(true,false);let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(let i=0;i<8;i++){screenPoint.set(i&1?max.x:min.x,i&2?max.y:min.y,i&4?max.z:min.z).applyMatrix4(g.matrixWorld).project(camera);const x=(screenPoint.x+1)*rect.width/2,y=(1-screenPoint.y)*rect.height/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      targets[key]={x:(left+right)/2,y:(top+bottom)/2,width:right-left,height:bottom-top};
    }return targets;
  }
  return {setAtmosphere:key=>{atmosphere.set(key);renderer.shadowMap.needsUpdate=true;},releaseDeliveryFocus(){delivery.releaseFocus();},setHover(key,immediate=false){if(immediate)hoverGlow.clear();else hoverGlow.set(key);},clearPour(){pourEffects.reset({preserveImpacts:true});},resetView(){cameraMotion.setZoom(1.14-cameraMotion.tableZoom);cameraMotion.center();},
    panTable(pixels){const v=getShopView(cameraMotion.pose,width(),height());cameraMotion.panBy(-pixels*2*v.frustum.right/v.zoom/width());},
    stepTable(direction){cameraMotion.panBy(direction*3.4);},
    focusObject(key){if(width()<=700&&anchors[key])cameraMotion.panBy(anchors[key].position.x-cameraMotion.tableX);},screenTargets,renderer,scene,camera,anchors,homes,animate,pick,setZoom,startAction,startDelivery,returnDelivery,updateMixture,resetObjects,showServed,showResult,hideResult,drainIceSounds,get audioState(){if(document.hidden||resultActive)silenceAudio();return audioState;},get delivering(){return delivery.active;},get busy(){return !!action||delivery.active;},get pourRate(){return pourEffects.rate;},get whiskRate(){return audioState.whisk.intensity;}};
}
