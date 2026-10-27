import { volume, space } from './recipe.js?v=challenge-1';
import { GLASS_CAPACITY_ML } from './glass-size.js?v=challenge-1';

export function createMeasurementCards(root){
 const ids=['chawan-card','glass-card','measure-powder','measure-water','measure-foam','measure-liquid','measure-ice','measure-cloud','measure-remaining','glass-capacity','glass-capacity-fill','glass-capacity-label','measure-announcement'];
 const el=Object.fromEntries(ids.map(id=>[id,root.getElementById(id)]));
 let previous=null,announcementTimer;
 const glowTimers={};
 const set=(id,text)=>{text=String(text);if(el[id].textContent!==text)el[id].textContent=text;};
 function glow(id){
  // Hold one quiet highlight throughout a pour, then fade it after the last change.
  clearTimeout(glowTimers[id]);el[id].classList.add('is-changing');
  glowTimers[id]=setTimeout(()=>el[id].classList.remove('is-changing'),700);
 }
 function reset(){
  previous=null;clearTimeout(announcementTimer);set('measure-announcement','');
  for(const id of ['chawan-card','glass-card']){clearTimeout(glowTimers[id]);el[id].classList.remove('is-changing');}
 }
 function update(state,{animate=true}={}){
  const g=state.glass,liquid=Math.round(volume(g)),remaining=Math.round(space(g));
  const used=Math.min(GLASS_CAPACITY_ML,Math.max(0,GLASS_CAPACITY_ML-space(g)));
  const powder=state.powder,water=Math.round(state.water),foam=Math.round(state.foam*100);
  const next={chawan:`${powder}|${water}|${foam}`,glass:`${liquid}|${g.ice}|${g.cream}|${remaining}`};
  set('measure-powder',powder);set('measure-water',water);set('measure-foam',foam);
  set('measure-liquid',liquid);set('measure-ice',g.ice);el['measure-cloud'].hidden=g.cream<=0;
  set('measure-remaining',remaining>0?`Sisa ${remaining} ml`:'Gelas penuh');
  set('glass-capacity-label',`${Math.round(used)} / ${GLASS_CAPACITY_ML} ml · termasuk es`);
  el['glass-capacity-fill'].style.transform=`scaleX(${used/GLASS_CAPACITY_ML})`;
  el['glass-capacity'].setAttribute('aria-valuemax',GLASS_CAPACITY_ML);
  el['glass-capacity'].setAttribute('aria-valuenow',Math.round(used));
  el['glass-capacity'].setAttribute('aria-valuetext',`${Math.round(used)} dari ${GLASS_CAPACITY_ML} ml terpakai, termasuk ${g.ice} es. Cairan ${liquid} ml. Sisa ${remaining} ml.`);
  if(animate&&previous){
   const chawanChanged=previous.chawan!==next.chawan,glassChanged=previous.glass!==next.glass;
   if(chawanChanged)glow('chawan-card');if(glassChanged)glow('glass-card');
   if(chawanChanged||glassChanged){
    clearTimeout(announcementTimer);
    // Announce the settled amount, rather than reading every frame of a pour.
    announcementTimer=setTimeout(()=>set('measure-announcement',`Chawan: ${powder} sendok, ${water} ml air, busa ${foam} persen. Gelas: ${liquid} ml cairan, ${g.ice} es${g.cream>0?', dengan cloud':''}. Sisa ${remaining} ml.`),1000);
   }
  }
  previous=next;
 }
 return {update,reset};
}
