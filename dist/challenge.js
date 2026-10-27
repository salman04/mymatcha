export const ORDER_DURATION_MS=3*60*1000;
export const formatRemaining=ms=>{const seconds=Math.ceil(Math.max(0,ms)/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;};

// Use a deadline rather than animation-frame deltas, so a hidden tab or a help
// dialog never pauses an active order. Only the uninteractive delivery freezes it.
export function createChallenge(total,now=()=>performance.now()){
 let round=0,status='idle',deadline=0,remaining=ORDER_DURATION_MS,spent=0,attempts=0,results=[],pending=null;
 const tick=()=>{if(status==='running'){remaining=Math.max(0,deadline-now());if(remaining===0)status='expired';}return remaining;};
 const startAttempt=()=>{pending=null;remaining=ORDER_DURATION_MS;deadline=now()+remaining;status='running';attempts++;};
 const retry=()=>{tick();if(status!=='idle')spent+=ORDER_DURATION_MS-remaining;results[round]=null;startAttempt();};
 const pass=rating=>{status='passed';results[round]={round,score:rating.score,stars:rating.stars,elapsedMs:spent+ORDER_DURATION_MS-remaining,attempts};return true;};
 const serve=(matches,rating={score:100,stars:5})=>{
  tick();if(status!=='running')return false;
  if(matches)pass(rating);
  return matches;
 };
 return {
  get round(){return round;},get status(){return status;},
  get completed(){return round+(status==='passed'?1:0);},
  get complete(){return status==='passed'&&round===total-1;},
  get summary(){
   const customers=results.filter(Boolean).map(result=>({...result}));
   return {customers,totalOrders:total,completed:customers.length,
    totalScore:customers.reduce((sum,r)=>sum+r.score,0),maxScore:total*100,
    totalStars:customers.reduce((sum,r)=>sum+r.stars,0),maxStars:total*5,
    elapsedMs:customers.reduce((sum,r)=>sum+r.elapsedMs,0)};
  },
  tick,retry,serve,
  start(){round=0;results=[];spent=attempts=0;startAttempt();},
  stop(){pending=null;round=0;status='idle';remaining=ORDER_DURATION_MS;deadline=0;results=[];spent=attempts=0;},
  beginPresentation(matches,rating={score:100,stars:5}){
   tick();if(status!=='running')return false;
   pending={matches,rating:{score:rating.score,stars:rating.stars}};status='presenting';return true;
  },
  finishPresentation(){
   if(status!=='presenting'||!pending)return false;
   const result=pending;pending=null;
   // Acceptance already checked the deadline. Never expire an accepted drink
   // because the clock advances between reads while committing its result.
   if(result.matches)return pass(result.rating);
   deadline=now()+remaining;status='running';return false;
  },
  next(){if(status!=='passed'||round>=total-1)return false;round++;spent=attempts=0;startAttempt();return true;}
 };
}
