import * as THREE from 'three';
import { MILK_TYPES } from './milk-types.js';

// Printed artwork belongs to the paperboard surface, so it follows the carton
// through the same 3D lighting, picking, and pouring transform as its geometry.
function cartonPrint(type,side=false){
 const c=document.createElement('canvas');c.width=512;c.height=1024;
 const ctx=c.getContext('2d'),style=MILK_TYPES[type];ctx.fillStyle=style.paper;ctx.fillRect(0,0,512,1024);
 ctx.fillStyle=style.accent;ctx.fillRect(0,0,512,65);ctx.fillRect(0,970,512,54);
 ctx.fillStyle=style.ink;ctx.textAlign='center';ctx.font='26px Georgia';ctx.fillText('sejenak.',256,118);
 if(side){
  ctx.font='38px Georgia';ctx.fillText('A little pause.',256,290);ctx.font='23px sans-serif';ctx.fillText(MILK_TYPES[type].name,256,345);
  ctx.strokeStyle=style.accent;ctx.lineWidth=2;ctx.strokeRect(82,440,348,272);
  for(let y=477;y<700;y+=38){ctx.beginPath();ctx.moveTo(100,y);ctx.lineTo(410,y);ctx.stroke();}
  ctx.font='20px sans-serif';ctx.fillText('1 L',256,910);
 }else{
  ctx.font='bold 68px Georgia';ctx.fillText(type.toUpperCase(),256,245);ctx.fillText('MILK',256,325);
  ctx.strokeStyle=style.ink;ctx.lineCap='round';
  if(type==='fresh'){
   ctx.fillStyle='#cedce0';ctx.beginPath();ctx.moveTo(0,600);ctx.bezierCurveTo(100,465,220,650,330,540);ctx.bezierCurveTo(430,480,450,530,512,560);ctx.lineTo(512,975);ctx.lineTo(0,975);ctx.fill();
   for(const [y,color]of[[710,'#a6b68a'],[820,'#7e9465'],[935,'#5f794e']]){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(130,y-100,330,y+80,512,y-45);ctx.lineTo(512,975);ctx.lineTo(0,975);ctx.fill();}
   ctx.fillStyle='#f6eed9';ctx.fillRect(215,655,92,72);ctx.fillStyle='#b77c55';ctx.beginPath();ctx.moveTo(202,657);ctx.lineTo(260,609);ctx.lineTo(320,657);ctx.fill();ctx.fillStyle='#65735c';ctx.fillRect(250,686,20,41);
   for(const x of[60,400]){ctx.fillStyle='#6d8557';ctx.beginPath();ctx.ellipse(x,663,29,42,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8d795a';ctx.fillRect(x-4,680,8,80);}
  }else if(type==='almond'){
   ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(135,887);ctx.bezierCurveTo(190,710,340,673,367,475);ctx.stroke();
   for(const [x,y,a]of[[205,730,-.6],[312,638,.6],[335,533,-.5],[235,840,.5]]){
    ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#7d9059';ctx.beginPath();ctx.ellipse(45,-25,43,14,-.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#bf8b4b';ctx.beginPath();ctx.moveTo(0,-62);ctx.bezierCurveTo(66,-12,40,60,0,66);ctx.bezierCurveTo(-40,35,-49,-12,0,-62);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#91653c';for(const dx of[-15,0,15]){ctx.beginPath();ctx.moveTo(0,-45);ctx.quadraticCurveTo(dx+14,0,dx,49);ctx.stroke();}ctx.restore();
   }
  }else{
   for(const [x,h,lean] of[[118,310,45],[244,420,-35],[358,350,26]]){
    const base=920,top=base-h;ctx.strokeStyle='#a88c4b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,base);ctx.quadraticCurveTo(x-lean*.4,top+100,x+lean,top);ctx.stroke();
    for(let i=0;i<6;i++){const y=top+30+i*40,cx=x+lean*(1-i/8);for(const sign of[-1,1]){ctx.fillStyle=i%2?'#c5aa62':'#b69b51';ctx.beginPath();ctx.ellipse(cx+sign*19,y,12,29,sign*.7,0,Math.PI*2);ctx.fill();}}
   }
  }
  ctx.fillStyle=style.ink;ctx.font='20px sans-serif';ctx.fillText('SIMPLE MOMENTS  ·  1 L',256,952);
 }
 // Very light fibers, deterministic so all cartons retain a calm paper finish.
 for(let i=0;i<4000;i++){ctx.fillStyle=i%2?'#ffffff08':'#806c5005';ctx.fillRect((i*127)%512,(i*379)%1024,1,3);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
export function buildMilkCarton(group,type){
 const style=MILK_TYPES[type];
 const paper=new THREE.MeshStandardMaterial({color:style.paper,roughness:.78});
 const front=new THREE.MeshStandardMaterial({map:cartonPrint(type),roughness:.72});
 const side=new THREE.MeshStandardMaterial({map:cartonPrint(type,true),roughness:.78});
 const roof=new THREE.MeshStandardMaterial({color:style.accent,roughness:.72,side:THREE.DoubleSide});
 const white=new THREE.MeshStandardMaterial({color:0xf8f6ee,roughness:.55});
 function mesh(geo,mat,x=0,y=0,z=0,parent=group){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 const w=.68,d=.61,h=1.32,roofH=.35;
 mesh(new THREE.BoxGeometry(w,h,d),[side,side,paper,paper,front,side],0,h/2,0);
 // Sloping front/back roof with folded triangular sides and a sealed top fin.
 for(const sign of[-1,1]){
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-w/2,h,sign*d/2,w/2,h,sign*d/2,w/2,h+roofH,0,-w/2,h+roofH,0],3));geo.setIndex(sign===1?[0,1,2,0,2,3]:[0,2,1,0,3,2]);geo.computeVertexNormals();mesh(geo,roof);
  const fold=new THREE.BufferGeometry();fold.setAttribute('position',new THREE.Float32BufferAttribute([sign*w/2,h,-d/2,sign*w/2,h,d/2,sign*w/2,h+roofH,0],3));fold.setIndex([0,1,2]);fold.computeVertexNormals();mesh(fold,roof);
 }
 mesh(new THREE.BoxGeometry(w,.09,.025),roof,0,h+roofH+.035,0);
 for(const x of[-w/2+.008,w/2-.008])mesh(new THREE.BoxGeometry(.009,h,.008),paper,x,h/2,d/2+.004);
 mesh(new THREE.BoxGeometry(w+.005,.028,d+.005),paper,0,.016,0);
 const mouth=new THREE.Group();mouth.position.set(0,1.493,.166);mouth.rotation.x=.72;group.add(mouth);
 mesh(new THREE.CylinderGeometry(.090,.095,.026,40),white,0,0,0,mouth);
 const hole=mesh(new THREE.CircleGeometry(.069,40),new THREE.MeshStandardMaterial({color:0x827c67,roughness:.9}),0,.015,0,mouth);hole.rotation.x=-Math.PI/2;
 const cap=new THREE.Group();cap.name='carton-cap';mouth.add(cap);
 mesh(new THREE.CylinderGeometry(.084,.087,.054,48),white,0,.042,0,cap);
 for(let i=0;i<40;i++){const a=i*Math.PI/20;mesh(new THREE.CylinderGeometry(.002,.002,.038,4),white,Math.cos(a)*.085,.041,Math.sin(a)*.085,cap);}
 const outlet=new THREE.Object3D();outlet.name='carton-mouth';mouth.add(outlet);outlet.position.y=.022;
 group.userData.milkType=type;group.userData.cap=cap;
 return {outlet,local:outlet.getWorldPosition(new THREE.Vector3()).sub(group.position).toArray()};
}
