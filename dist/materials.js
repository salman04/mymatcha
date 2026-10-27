import * as THREE from 'three';

export function random(seed=23){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const TAU=Math.PI*2;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
function noise2(x,y){
 const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,a=u*u*(3-2*u),b=v*v*(3-2*v);
 const hash=(x,y)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;};
 const p=hash(ix,iy),q=hash(ix+1,iy),r=hash(ix,iy+1),s=hash(ix+1,iy+1);
 return(p+(q-p)*a)*(1-b)+(r+(s-r)*a)*b;
}
function canvas(size){const c=document.createElement('canvas');c.width=c.height=size;return[c,c.getContext('2d')];}
function texture(c,repeat=1,color=true){const t=new THREE.CanvasTexture(c);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;return t;}
function heightMaps(color,height,roughness,repeat=1,strength=1){
 const size=height.width,[normal,nc]=canvas(size),pixels=height.getContext('2d').getImageData(0,0,size,size).data,out=nc.createImageData(size,size);
 const h=(x,y)=>pixels[(((y+size)%size)*size+(x+size)%size)*4]/255;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(h(x-1,y)-h(x+1,y))*strength,dy=(h(x,y-1)-h(x,y+1))*strength,l=Math.hypot(dx,dy,1),i=(y*size+x)*4;
  out.data[i]=(dx/l*.5+.5)*255;out.data[i+1]=(dy/l*.5+.5)*255;out.data[i+2]=(1/l*.5+.5)*255;out.data[i+3]=255;
 }
 nc.putImageData(out,0,0);
 return{map:texture(color,repeat),normalMap:texture(normal,repeat,false),roughnessMap:texture(roughness,repeat,false)};
}
// Color, surface relief and roughness use separate, correctly encoded maps.
function surface(size,sample,repeat=1,strength=1){
 const [c,ctx]=canvas(size),[h,hx]=canvas(size),[r,rx]=canvas(size),cd=ctx.createImageData(size,size),hd=hx.createImageData(size,size),rd=rx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const [red,green,blue,height,rough]=sample(x,y,size),i=(y*size+x)*4;
  cd.data.set([red,green,blue,255],i);hd.data.set([height,height,height,255],i);rd.data.set([rough,rough,rough,255],i);
 }
 ctx.putImageData(cd,0,0);hx.putImageData(hd,0,0);rx.putImageData(rd,0,0);return heightMaps(c,h,r,repeat,strength);
}

export function makeMaterials(){
 const rand=random(23);
 const table=surface(1024,(x,y,s)=>{
  const u=x/s*TAU,v=y/s*TAU;
  const cloud=Math.sin(u*3+Math.sin(v*2))*Math.cos(v*4)*2.5+Math.sin(u*7-v*5)*1.4;
  const grain=(rand()-.5)*9,pore=rand()>.996?-13:0;
  const value=cloud+grain+pore;
  return[183+value,187+value,186+value,128+grain*3+pore,222+grain+cloud];
 },5,1.7);
 const ceramic=surface(1024,(x,y,s)=>{
  const u=x/s*TAU,v=y/s*TAU,flow=Math.sin(v*4+Math.sin(u*3))*.6+Math.sin(u*7-v*2)*.3;
  const wheel=Math.sin(v*53+Math.sin(u*2)*.5),grain=(rand()-.5)*5;
  const iron=rand()>.997?20+rand()*35:0;
  return[211+flow*7+grain-iron,208+flow*8+grain-iron*1.1,188+flow*10+grain-iron*1.4,128+wheel*4+grain*2+flow*6-iron*.3,175+flow*25+grain*2];
 },1,1.4);
 const wood=surface(1024,(x,y,s)=>{
  const u=x/s,v=y/s,warp=Math.sin(v*TAU)*.017+Math.sin(v*TAU*3+u*6)*.007;
  const knot=Math.exp(-((u-.73)**2*95+(v-.32)**2*32));
  const ring=(u+warp+knot*.035)*TAU;
  const growth=Math.sin(ring*19+Math.sin(ring*5)*1.5),late=Math.pow(Math.max(0,Math.sin(ring*43+Math.sin(v*TAU*2))),7);
  const fiber=Math.sin(ring*290+Math.sin(v*TAU*4)*2),noise=(rand()-.5)*5;
  const grain=growth*7-late*10+fiber*2+noise-knot*8;
  return[155+grain,109+grain*.82,65+grain*.55,128+growth*5-late*16+fiber*5+noise,183+late*17-growth*7+noise];
 },1,1.8);
 const woodSide={};for(const[k,t]of Object.entries(wood)){woodSide[k]=t.clone();woodSide[k].repeat.set(1,2);woodSide[k].needsUpdate=true;}
 const bamboo=surface(512,(x,y,s)=>{
  const u=x/s*TAU,v=y/s*TAU;
  const grain=Math.sin(u*63+Math.sin(v)*.4)*4+Math.sin(u*149)*2+(rand()-.5)*5;
  const node=Math.pow(Math.max(0,Math.cos(v*2)),35)*5;
  return[191+grain-node,151+grain-node,82+grain*.7-node,128+grain*2+node,187+grain];
 },1,1.4);
 const powder=surface(512,(x,y)=>{
  const grain=(rand()-.5)*32,clump=(noise2(x*.07,y*.07)-.5)*18+(noise2(x*.021,y*.021)-.5)*10;
  return[70+grain+clump,100+grain+clump,15+grain*.25,128+grain*2+clump*3,240+grain*.3];
 },2,2.5);
 const metalSurface=surface(256,(x,y)=>{const scratch=Math.sin(y*2.1)*7+(rand()-.5)*5;return[235,237,232,128+scratch,155+scratch*3];},1,1.1);
 const iceSurface=surface(256,(x,y,s)=>{const u=x/s*TAU,v=y/s*TAU,flow=Math.sin(u*3+Math.cos(v*2))*Math.sin(v*4-u)*5;return[244,252,250,128+flow+(rand()-.5)*1.3,115+flow*4];},1,.85);
 return{
  table:new THREE.MeshStandardMaterial({...table,normalScale:new THREE.Vector2(.32,.32),roughness:1}),
  ceramic:new THREE.MeshPhysicalMaterial({...ceramic,normalScale:new THREE.Vector2(.3,.3),roughness:.48,clearcoat:.48,clearcoatRoughness:.23}),
  sage:new THREE.MeshPhysicalMaterial({...ceramic,color:0xabc2a5,normalScale:new THREE.Vector2(.2,.2),roughness:.43,clearcoat:.4,clearcoatRoughness:.22}),
  stoneware:new THREE.MeshStandardMaterial({...ceramic,color:0xb09a75,normalScale:new THREE.Vector2(.65,.65),roughness:.98}),
  tin:new THREE.MeshPhysicalMaterial({color:0x596e47,normalMap:metalSurface.normalMap,normalScale:new THREE.Vector2(.12,.12),roughnessMap:metalSurface.roughnessMap,roughness:.78,metalness:.42,clearcoat:.18}),
  gold:new THREE.MeshStandardMaterial({color:0xb19b67,roughnessMap:metalSurface.roughnessMap,roughness:.5,metalness:.85}),
  wood:new THREE.MeshPhysicalMaterial({...wood,normalScale:new THREE.Vector2(.45,.45),roughness:.8,clearcoat:.12,clearcoatRoughness:.65}),
  woodSide:new THREE.MeshStandardMaterial({...woodSide,color:0xeee2cd,normalScale:new THREE.Vector2(.4,.4),roughness:.82}),
  bamboo:new THREE.MeshStandardMaterial({...bamboo,normalScale:new THREE.Vector2(.28,.28),roughness:.72}),
  bambooFine:new THREE.MeshStandardMaterial({...bamboo,color:0xf2d9a0,normalScale:new THREE.Vector2(.12,.12),roughness:.78}),
  metal:new THREE.MeshStandardMaterial({...metalSurface,color:0xbcc4bc,normalScale:new THREE.Vector2(.15,.15),metalness:.95,roughness:.45}),
  thread:new THREE.MeshStandardMaterial({color:0x272b22,roughness:.9}),
  glass:new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.018,transmission:.94,thickness:.025,ior:1.46,transparent:true,opacity:.34,envMapIntensity:1.1,depthWrite:false}),
  ice:new THREE.MeshPhysicalMaterial({color:0xeefbf8,normalMap:iceSurface.normalMap,normalScale:new THREE.Vector2(.20,.20),roughnessMap:iceSurface.roughnessMap,roughness:.17,transmission:.9,thickness:.12,ior:1.31,transparent:true,opacity:.76,clearcoat:1,clearcoatRoughness:.07,depthWrite:false}),
  powder:new THREE.MeshStandardMaterial({...powder,normalScale:new THREE.Vector2(.7,.7),roughness:1}),
  tea:new THREE.MeshPhysicalMaterial({color:0x426b0d,roughness:.29,clearcoat:.6,clearcoatRoughness:.2}),
  milk:new THREE.MeshPhysicalMaterial({color:0xf3eddd,roughness:.32,clearcoat:.24,clearcoatRoughness:.32}),
 };
}

// A bounded shared atlas cache avoids regenerating thousands of bubbles while whisking.
const foamCache=new Map();
export function foamMaps(amount=1,milk=0){
 const density=Math.round(clamp(amount)*10)/10,milkiness=Math.round(clamp(milk)*10)/10,key=`${density}:${milkiness}`;
 if(foamCache.has(key))return foamCache.get(key);
 const size=1024,[c,ctx]=canvas(size),[h,hx]=canvas(size),[r,rx]=canvas(size),rand=random(105);
 const base=new THREE.Color(0x588322).lerp(new THREE.Color(0xf3ecdc),milkiness);
 ctx.fillStyle=`#${base.getHexString()}`;ctx.fillRect(0,0,size,size);hx.fillStyle='#777';hx.fillRect(0,0,size,size);rx.fillStyle='#aeaeae';rx.fillRect(0,0,size,size);
 const grad=ctx.createRadialGradient(430,400,70,512,512,610);grad.addColorStop(0,milkiness>.5?'rgba(255,255,249,.15)':'rgba(174,194,87,.10)');grad.addColorStop(1,milkiness>.5?'rgba(166,152,124,.10)':'rgba(23,58,4,.20)');ctx.fillStyle=grad;ctx.fillRect(0,0,size,size);
 const count=Math.floor(13000*density);
 for(let i=0;i<count;i++){
  const x=rand()*size,y=rand()*size,big=rand()>.985,rad=big?3.5+rand()*4.5:.7+rand()*2.2;
  const clustered=.65+.35*Math.sin(x*.014+Math.sin(y*.012));if(rand()>clustered)continue;
  ctx.fillStyle=milkiness>.5?(big?'rgba(154,145,125,.38)':'rgba(160,153,137,.24)'):(big?'rgba(22,49,4,.60)':'rgba(34,69,9,.32)');ctx.beginPath();ctx.arc(x,y,rad,0,TAU);ctx.fill();
  ctx.strokeStyle=milkiness>.5?'rgba(255,255,247,.65)':big?'rgba(196,213,129,.70)':'rgba(175,197,100,.44)';ctx.lineWidth=big?.75:.5;ctx.beginPath();ctx.arc(x,y,rad+.3,.7,3.8);ctx.stroke();
  if(big){ctx.fillStyle=milkiness>.5?'rgba(255,255,251,.75)':'rgba(245,249,208,.72)';ctx.beginPath();ctx.ellipse(x-rad*.32,y-rad*.37,rad*.28,rad*.12,-.7,0,TAU);ctx.fill();}
  hx.fillStyle=big?'#424242':'#5b5b5b';hx.beginPath();hx.arc(x,y,rad,0,TAU);hx.fill();hx.strokeStyle='#b6b6b6';hx.lineWidth=.8;hx.stroke();
  rx.fillStyle=big?'#5a5a5a':'#929292';rx.beginPath();rx.arc(x,y,rad,0,TAU);rx.fill();
 }
 const maps=heightMaps(c,h,r,1,1.6);foamCache.set(key,maps);
 // The application uses eleven densities for each of its two foam types.
 if(foamCache.size>22){const first=foamCache.keys().next().value;const old=foamCache.get(first);Object.values(old).forEach(t=>t.dispose());foamCache.delete(first);}
 return maps;
}
export function foamTexture(amount=1,milk=0){return foamMaps(amount,milk).map;}
