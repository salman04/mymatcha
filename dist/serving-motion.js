// Carry the finished glass toward the guest without changing the drink recipe.
export const DELIVERY_DURATION = 4.8;
export const DELIVERY_RETURN_DURATION = 2.8;
export const DELIVERY_HOME = Object.freeze({x:3.28,y:0,z:1.24,yaw:0});
export const DELIVERY_DESTINATION = Object.freeze({x:1.72,y:0,z:-1.48,yaw:-.08});
const clamp = (value,low,high)=>Math.max(low,Math.min(high,value));
const ease = value=>value*value*value*(value*(value*6-15)+10);

export function createServingMotion(){
  const pose={...DELIVERY_HOME};
  let focusReleased=false,reduced=false,coasterPlaced=false;
  let phase='idle',elapsed=0,duration=DELIVERY_DURATION,lead=1.05,complete=null,origin={...pose};
  function reset(){coasterPlaced=false;focusReleased=false;phase='idle';elapsed=0;complete=null;Object.assign(pose,DELIVERY_HOME);return pose;}
  return {
    pose,reset,
    releaseFocus(){focusReleased=true;},
    get coasterOffset(){return coasterPlaced?0:phase==='outgoing'?.9*(1-ease(clamp(elapsed/.8,0,1))):.9;},
    // A small lift and gentle set-down happen before the coaster starts sliding.
    get lift(){if(reduced||phase!=='outgoing'||elapsed>=1.05)return 0;return Math.sin(Math.PI*elapsed/1.05)*.085;},
    start(onComplete,{reducedMotion=false}={}){
      if(phase!=='idle')return false;
      focusReleased=false;reduced=reducedMotion;phase='outgoing';elapsed=0;duration=reducedMotion?.24:DELIVERY_DURATION;lead=reducedMotion?0:1.05;
      complete=typeof onComplete==='function'?onComplete:null;origin={...pose};return true;
    },
    returnHome({reducedMotion=false}={}){
      if(phase==='idle'||phase==='returning')return false;
      phase='returning';elapsed=0;duration=reducedMotion?.24:DELIVERY_RETURN_DURATION;lead=0;
      complete=null;origin={...pose};return true;
    },
    advance(seconds,{active=true}={}){
      if(!active||!['outgoing','returning'].includes(phase))return pose;
      elapsed=Math.min(duration,elapsed+clamp(Number.isFinite(seconds)?seconds:0,0,.1));
      if(phase==='outgoing'&&(elapsed>=.8||reduced))coasterPlaced=true;
      const returning=phase==='returning',target=returning?DELIVERY_HOME:DELIVERY_DESTINATION;
      const progress=ease(clamp((elapsed-lead)/(duration-lead),0,1));
      for(const key in pose)pose[key]=origin[key]+(target[key]-origin[key])*progress;
      if(elapsed>=duration-1e-9){
        elapsed=duration;Object.assign(pose,target);phase=returning?'idle':'served';
        const callback=complete;complete=null;callback?.();
      }
      return pose;
    },
    get phase(){return phase;},
    get active(){return phase==='outgoing'||phase==='returning';},
    get elapsed(){return elapsed;},
    // Leave space above the glass for the guest's greeting. On return, the
    // camera independently eases back to the player's saved table position.
    get focus(){return focusReleased||phase==='idle'||phase==='returning'?null:{x:pose.x,y:.80,z:pose.z-.35,zoom:2.08};},
  };
}
