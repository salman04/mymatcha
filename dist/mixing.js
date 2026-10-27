import { MIXING_DURATION, MIXING_PAUSE } from './preparation-motion.js';
// Presentation state only: never change the recipe or customer rating.
export function createMixingState(){
 let key='',eligible=false,started=false,elapsed=0;
 return {
  setRecipe(g){
   const next=[g.water,g.milk,g.powder,g.first].join('|');
   if(next!==key){key=next;started=false;elapsed=0;}
   eligible=g.powder>0&&g.water>0&&g.milk>0;
  },
  start(){if(eligible)started=true;},
  reset(){key='';eligible=started=false;elapsed=0;},
  advance(seconds){if(started&&Number.isFinite(seconds)&&seconds>0)elapsed=Math.min(MIXING_DURATION,elapsed+seconds);},
  get progress(){const p=Math.max(0,Math.min(1,(elapsed-MIXING_PAUSE)/(MIXING_DURATION-MIXING_PAUSE)));return p*p*(3-2*p);},
  get elapsed(){return elapsed;}
 };
}
