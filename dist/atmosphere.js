// Lighting values stay independent of recipes, order deadlines and camera pose.
export const ATMOSPHERES = Object.freeze({
 morning:{label:'Pagi cerah',description:'Cahaya pagi & kelopak sakura',icon:'☀',sun:[1,.92,.79],sunPower:3.1,sunX:-5,fill:[.72,.84,1],fillPower:.45,sky:[.92,.96,.86],ambient:.48,environment:.46,exposure:.86,garden:[1,1,1],saturation:1,lantern:0,rain:0},
 sunset:{label:'Sore hangat',description:'Sinar keemasan menjelang senja',icon:'◒',sun:[1,.61,.30],sunPower:2.4,sunX:-8,fill:[.78,.65,.82],fillPower:.48,sky:[1,.73,.52],ambient:.43,environment:.39,exposure:.87,garden:[1,.68,.40],saturation:.88,lantern:.25,rain:0},
 night:{label:'Malam tenang',description:'Taman biru & lentera hangat',icon:'☾',sun:[.36,.50,1],sunPower:.62,sunX:4,fill:[1,.72,.39],fillPower:1.1,sky:[.40,.52,.77],ambient:.40,environment:.28,exposure:.88,garden:[.085,.14,.28],saturation:.5,lantern:1,rain:0},
 rain:{label:'Hujan malam',description:'Rintik di taman, hangat di kedai',icon:'☂',sun:[.33,.44,.68],sunPower:.35,sunX:3,fill:[1,.68,.34],fillPower:1.15,sky:[.40,.48,.64],ambient:.37,environment:.27,exposure:.9,garden:[.07,.11,.19],saturation:.36,lantern:1,rain:1}
});
export const normalizeAtmosphere=value=>Object.hasOwn(ATMOSPHERES,value)?value:'morning';
export function loadAtmosphere(storage){try{return normalizeAtmosphere(storage?.getItem('sejenak-atmosphere'));}catch{return 'morning';}}
export function saveAtmosphere(storage,value){try{storage?.setItem('sejenak-atmosphere',normalizeAtmosphere(value));}catch{}}
export function createAtmosphere(initial='morning'){
 let key=normalizeAtmosphere(initial),target=ATMOSPHERES[key];
 const values=Object.fromEntries(Object.entries(target).filter(([,v])=>typeof v==='number'||Array.isArray(v)).map(([k,v])=>[k,Array.isArray(v)?[...v]:v]));
 return {values,get key(){return key;},set(value){key=normalizeAtmosphere(value);target=ATMOSPHERES[key];return key;},
  advance(dt,{reducedMotion=false,active=true}={}){
   if(!active)return values;
   const blend=reducedMotion?1:1-Math.exp(-Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0))*1.35);
   for(const k in values){if(Array.isArray(values[k]))values[k]=values[k].map((v,i)=>v+(target[k][i]-v)*blend);else values[k]+=(target[k]-values[k])*blend;}
   return values;
  }
 };
}
