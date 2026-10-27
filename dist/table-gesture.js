// Separate browsing the counter from using a tool. No recipe changes on a swipe.
export function createTableGesture({onPan=()=>{},onTap=()=>{},onHold=()=>{},onRelease=()=>{}}={}){
 let session=null;
 return {
  get active(){return !!session;},get id(){return session?.id;},get mode(){return session?.mode;},
  start({id,x,y,time,hit=null,holdable=false}){if(session)return false;session={id,x,y,lastX:x,time,hit,holdable,mode:'pending'};return true;},
  move(id,x,y){
   if(!session||id!==session.id)return;
   const s=session,dx=x-s.x,dy=y-s.y;
   if(s.mode==='pending'&&Math.hypot(dx,dy)>10)s.mode=Math.abs(dx)>Math.abs(dy)*.8?'pan':'cancelled';
   if(s.mode==='pan')onPan(x-s.lastX);
   s.lastX=x;
  },
  advance(time){if(session?.mode==='pending'&&session.holdable&&time-session.time>=360){session.mode='hold';onHold(session.hit,session);}},
  end(id){if(!session||id!==session.id)return;const s=session;session=null;if(s.mode==='pending'&&s.hit)onTap(s.hit);else if(s.mode==='hold')onRelease();},
  cancel(){const held=session?.mode==='hold';session=null;if(held)onRelease();}
 };
}
