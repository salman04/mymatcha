import { GLASS_BASE_Y, GLASS_FILL_TOP, MAX_ICE_CUBES } from './glass-size.js?v=challenge-1';
import { createIceTransfer, ICE_CYCLE, ICE_RELEASE, ICE_TRANSFER_DURATION } from './ice-transfer.js';
// Lightweight, deterministic presentation motion; quantities stay in recipe.js.
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const follow=(current,target,rate,dt)=>current+(target-current)*(1-Math.exp(-rate*dt));
const TAU=Math.PI*2;

// A handful of cubes is one presentation/audio event, even when their landing
// times differ. Old falling cubes cannot consume a newly started batch's cue.
export function createIceBatchCue(){
 let sequence=0,pending=null;
 return {
  start(first,count=3,{individual=false}={}){pending={batchId:++sequence,first,count,individual,landed:new Set(),played:false};},
  clear(){pending=null;},
  landing(index){
   if(!pending||pending.played||pending.landed.has(index)||index<pending.first||index>=pending.first+pending.count)return null;
   pending.landed.add(index);pending.played=!pending.individual;
   return {batchId:pending.individual?pending.batchId*MAX_ICE_CUBES+index:pending.batchId,count:pending.individual?1:pending.count};
  }
 };
}

export function createIceMotion({transfer=createIceTransfer()}={}){
 const poses=Array.from({length:MAX_ICE_CUBES},(_,i)=>({x:0,y:.2,z:0,rx:0,ry:i*.7,rz:0,vy:0,carry:0,carryTime:0,carryDuration:0,batchFirst:0,slot:0,picked:false,touchedLiquid:false,falling:false,visible:false}));
 let count=0,surface=.1,contactSurface=.1,liquid=false,time=0,orbit=0,current=0;
 let transferTime=ICE_TRANSFER_DURATION,transferFirst=0;
 const tongs=transfer.sample(transferTime),carried={};
 const contacts=[];
 const rest=i=>.195+(count>6?Math.floor(i/4)*.15:count>3&&i%2?.14:0);
 const level=i=>Math.max(rest(i),surface-.038-(count>6?Math.floor(i/6)*.175:0)+(i%2)*.009);
 const ringAngle=i=>count>6?(i%6)*TAU/Math.min(6,count-Math.floor(i/6)*6)+Math.floor(i/6)*.5:i*TAU/count;
 function constrain(p){
  // Keep the rounded cubes inside the tapered glass, including their corners.
  const limit=.157+.035*clamp((p.y-.19)/(GLASS_FILL_TOP-.06-.19),0,1),radius=Math.hypot(p.x,p.z);
  if(radius>limit){p.x*=limit/radius;p.z*=limit/radius;}
  if(p.y<.19){p.y=.19;p.vy=Math.max(0,p.vy);}
 }
 return {
  poses,tongs,contacts,
  setFill(nextCount,top,hasLiquid,impactTop=top){
   const previous=count;count=clamp(Math.trunc(nextCount),0,MAX_ICE_CUBES);
   if(count>previous){transferTime=0;transferFirst=previous;transfer.sample(0,transferFirst,tongs);}
   surface=clamp(top,GLASS_BASE_Y,GLASS_FILL_TOP);contactSurface=clamp(impactTop,GLASS_BASE_Y,GLASS_FILL_TOP);liquid=hasLiquid;
   poses.forEach((p,i)=>{
    p.visible=i<count&&(p.picked||p.carry===0);
    if(i>=previous&&i<count){
     p.slot=(i-previous)%3;p.batchFirst=previous;p.carryTime=0;
     p.carryDuration=p.carry=p.slot*ICE_CYCLE+ICE_RELEASE;
     transfer.carried(0,previous,p.slot,carried);
     p.x=carried.x;p.y=carried.y;p.z=carried.z;p.vy=0;p.falling=true;p.picked=false;p.touchedLiquid=false;p.visible=false;
    }
   });
  },
  reset(){
   count=0;surface=contactSurface=.1;liquid=false;time=orbit=current=0;contacts.length=0;
   transferTime=ICE_TRANSFER_DURATION;transferFirst=0;transfer.sample(transferTime,0,tongs);
   poses.forEach(p=>Object.assign(p,{x:0,y:.2,z:0,rx:0,ry:0,rz:0,vy:0,carry:0,carryTime:0,carryDuration:0,batchFirst:0,slot:0,picked:false,touchedLiquid:false,falling:false,visible:false}));
  },
  advance(seconds,{pouring=0,swirl=0,reducedMotion=false}={}){
   contacts.length=0;
   if(!Number.isFinite(seconds)||seconds<=0)return;
   // Fixed upper step prevents a background-tab pause from launching a cube.
   const dt=Math.min(seconds,.05);time+=dt*.7;
   transferTime=reducedMotion?ICE_TRANSFER_DURATION:Math.min(ICE_TRANSFER_DURATION,transferTime+dt);
   transfer.sample(transferTime,transferFirst,tongs);
   current=follow(current,liquid&&!reducedMotion?clamp(pouring+swirl*.65,0,1):0,1.8,dt);
   orbit+=dt*(liquid&&!reducedMotion?.012+current*.14:0);
   for(let i=0;i<count;i++){
    const p=poses[i],phase=i*2.39,ground=rest(i);
    if(p.carry>0){
     p.carryTime=reducedMotion?p.carryDuration:p.carryTime+dt;p.carry=Math.max(0,p.carryDuration-p.carryTime);
     transfer.carried(p.carryTime,p.batchFirst,p.slot,carried);
     p.x=carried.x;p.y=carried.y;p.z=carried.z;p.rx=p.rz=0;p.ry=carried.yaw;
     p.picked=p.visible=carried.picked;
     if(p.carry>0)continue;
    }
    const afloat=liquid?clamp((surface-ground+.035)/.12,0,1):0;
    const motion=reducedMotion?0:afloat;
    const dryAngle=(i%4)*TAU/4+Math.floor(i/4)*.6;
    const baseAngle=count>6?dryAngle+(ringAngle(i)-dryAngle)*afloat:ringAngle(i);
    const angle=baseAngle+orbit+motion*Math.sin(time*.65+phase)*(.015+current*.06);
    const radius=(count===1?.055:count===2?.105:count===3?.137:.172)+motion*Math.sin(time*.77+phase)*(.003+current*.007);
    p.x=follow(p.x,Math.cos(angle)*radius,2.5,dt);
    p.z=follow(p.z,Math.sin(angle)*radius,2.5,dt);
    const target=(liquid?level(i):ground)+motion*Math.sin(time*1.35+phase)*(.004+current*.011);
    if(p.falling&&!reducedMotion){
     const previousBottom=p.y-.075;
     p.vy-=2.8*dt;p.y+=p.vy*dt;
     // Emit once at the first liquid contact, before the cube finishes sinking.
     // Resting cubes and those still clamped by the tongs cannot create ripples.
     if(liquid&&!p.touchedLiquid&&previousBottom>contactSurface&&p.y-.075<=contactSurface){
      p.touchedLiquid=true;contacts.push({index:i,x:p.x,z:p.z,strength:clamp(Math.abs(p.vy)/1.8,.45,1)});
     }
     if(p.y<=target){p.y=target;p.vy=liquid?.06:0;p.falling=false;}
    }else{
     if(p.falling){p.y=target;p.vy=0;p.falling=false;}
     p.vy+=(target-p.y)*22*dt;p.vy*=Math.exp(-7*dt);p.y+=p.vy*dt;
    }
    const rock=motion*(.025+current*.09);
    p.rx=follow(p.rx,.07+Math.sin(time*1.05+phase)*rock,3,dt);
    p.rz=follow(p.rz,-.04+Math.cos(time*.91+phase)*rock,3,dt);
    p.ry=follow(p.ry,angle+.35+motion*Math.sin(time*.6+phase)*(.025+current*.10),2,dt);
    constrain(p);
   }
   // Soft separation avoids intersecting centres as a full glass starts floating.
   for(let pass=0;pass<3;pass++)for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
    const a=poses[i],b=poses[j];if(a.falling||b.falling)continue;
    const dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y;
    const needed=Math.sqrt(Math.max(0,.166**2-dy*dy)),distance=Math.hypot(dx,dz);
    if(distance<needed){
     const ux=distance>1e-6?dx/distance:Math.cos(i*2.4),uz=distance>1e-6?dz/distance:Math.sin(i*2.4);
     const push=(needed-distance)*.5;
     a.x-=ux*push;a.z-=uz*push;b.x+=ux*push;b.z+=uz*push;constrain(a);constrain(b);
    }
   }
  }
 };
}
