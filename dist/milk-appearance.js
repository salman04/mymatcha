import { Color } from './vendor/three.module.js';
import { MILK_TYPES } from './milk-types.js?v=milk-colors-1';

const colors=Object.fromEntries(Object.entries(MILK_TYPES).map(([type,milk])=>[type,new Color(milk.liquid)]));

// Blend the milk actually present, in linear light. Selecting another carton
// must never recolor what has already been poured.
export function milkColor(glass,target=new Color()){
 target.setRGB(0,0,0);let total=0;
 for(const [type,color] of Object.entries(colors)){
  const amount=glass?.milkParts?.[type];
  if(!Number.isFinite(amount)||amount<=0)continue;
  target.r+=color.r*amount;target.g+=color.g*amount;target.b+=color.b*amount;total+=amount;
 }
 return total>0?target.multiplyScalar(1/total):target.copy(colors[glass?.milkType]||colors.fresh);
}
