// Order visibility is independent of the Challenge deadline.
export function createOrderPeek(){
 let visible=false,remaining=0,intro=false;
 return {
  get visible(){return visible;},
  showIntro(){visible=true;remaining=8;intro=true;},
  open(){visible=true;intro=false;},
  close(){visible=false;intro=false;remaining=0;},
  advance(seconds,{paused=false}={}){
   if(!visible||!intro||paused||!Number.isFinite(seconds)||seconds<=0)return;
   remaining=Math.max(0,remaining-seconds);if(remaining===0){visible=false;intro=false;}
  }
 };
}

export function servingButtonPosition(glass,width,height,buttonWidth=98,buttonHeight=42){
 if(!glass||glass.x+glass.width/2<0||glass.x-glass.width/2>width||glass.y+glass.height/2<70||glass.y-glass.height/2>height-70)return null;
 const right=glass.x+glass.width/2+13,left=glass.x-glass.width/2-buttonWidth-13;
 const x=right+buttonWidth<=width-12?right:left>=12?left:glass.x-buttonWidth/2;
 const y=glass.y+glass.height*.25;
 return {x:Math.max(12,Math.min(width-buttonWidth-12,x)),y:Math.max(80,Math.min(height-buttonHeight-78,y))};
}
