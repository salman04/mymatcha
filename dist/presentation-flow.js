// Arrival comes from the real coaster animation, never a competing wall timer.
export function createPresentationFlow(){
 let phase='idle',elapsed=0,callbacks=null,returnDuration=3.2;
 function reset(){phase='idle';elapsed=0;callbacks=null;}
 return {get phase(){return phase;},reset,
  start({onReaction,onReturn,onComplete,reducedMotion=false}={}){
   if(phase!=='idle')return false;
   callbacks={onReaction,onReturn,onComplete};returnDuration=reducedMotion?.3:3.2;elapsed=0;phase='travelling';return true;
  },
  arrive(){if(phase!=='travelling')return false;phase='reaction';elapsed=0;callbacks?.onReaction?.();return true;},
  advance(dt,{active=true}={}){
   if(!active||!['reaction','returning'].includes(phase))return;
   elapsed+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
   if(phase==='reaction'&&elapsed>=5){phase='returning';elapsed=0;callbacks?.onReturn?.();}
   else if(phase==='returning'&&elapsed>=returnDuration){const complete=callbacks?.onComplete;reset();complete?.();}
  }
 };
}
