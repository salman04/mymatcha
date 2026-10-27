import { MILK_TYPES, milkName } from './milk-types.js';
import { GLASS_CAPACITY_ML, MAX_ICE_CUBES } from './glass-size.js?v=challenge-1';
import { customerForOrder, customerForRound } from './customers.js';
export const ORDERS = [
  {milkType:'fresh',name:'Ice Matcha Latte',temperature:'ice',cloud:false,note:'Latte dingin, lapisan hijau segar, dan es yang cukup.'},
  {milkType:'oat',name:'Ice Cloud Matcha Latte',temperature:'ice',cloud:true,note:'Latte dingin dengan lapisan krim cloud yang lembut.'},
  {milkType:'almond',name:'Hot Matcha Latte',temperature:'hot',cloud:false,note:'Latte hangat yang lembut, tanpa es.'},
  {milkType:'oat',name:'Ice Matcha Latte · Extra Ice',temperature:'ice',cloud:false,iceMin:9,note:'Segarnya lebih lama. Tambahkan setidaknya 9 es batu.'},
  {milkType:'fresh',name:'Hot Cloud Matcha Latte',temperature:'hot',cloud:true,note:'Hangat, dengan krim cloud yang lembut di atasnya.'},
  {milkType:'almond',name:'Ice Matcha Latte · Milky',temperature:'ice',cloud:false,milk:[180,240],note:'Lebih lembut dengan 180–240 ml susu.'},
  {milkType:'oat',name:'Hot Matcha Latte · Strong',temperature:'hot',cloud:false,powder:[3,4],note:'Rasa matcha lebih pekat, dengan 3–4 sendok bubuk.'},
  {milkType:'almond',name:'Ice Cloud Matcha · Strong',temperature:'ice',cloud:true,powder:[3,4],iceMin:6,note:'Matcha pekat, cloud lembut, dan setidaknya 6 es batu.'},
  {milkType:'fresh',name:'Ice Cloud Matcha · Milky',temperature:'ice',cloud:true,milk:[180,240],iceMin:6,note:'Susu lebih banyak, cloud, dan setidaknya 6 es batu.'},
  {milkType:'oat',name:'Ice Matcha Latte · Twelve',temperature:'ice',cloud:false,powder:[3,4],iceMin:12,note:'Racikan terakhir: matcha pekat dengan 12 es batu.'}
].map((order,index)=>({...order,customerId:customerForRound(index).id}));
export const orderAmounts=order=>({powder:order.powder||[1,3],water:[25,100],milk:order.milk||[80,180],iceMin:order.iceMin||3});
export const emptyGlass=()=>({water:0,powder:0,foam:0,milk:0,milkType:null,milkParts:{},cream:0,ice:0,first:null});
export const newRecipe=()=>({powder:0,water:0,foam:0,temperature:'hot',selectedMilk:'fresh',glass:emptyGlass(),started:true,served:false});
export const drinkTemperature=s=>s.glass.ice>0?'ice':'hot';
export const canServe=s=>s.glass.powder>0&&s.glass.water>=5;
export const volume=g=>g.water+g.milk+g.cream;
export const space=g=>Math.max(0,GLASS_CAPACITY_ML-volume(g)-g.ice*10);
export function addMilk(s,ml,type=s.selectedMilk||'fresh'){
 if(!MILK_TYPES[type]||!Number.isFinite(ml)||ml<=0||s.glass.cream)return 0;
 const g=s.glass,n=Math.min(ml,space(g));
 if(n>0){g.first??='milk';g.milkType=g.milk===0?type:g.milkType===type?type:'mixed';g.milkParts??={};g.milkParts[type]=(g.milkParts[type]||0)+n;g.milk+=n;}
 return n;
}
export function addIce(s){if(s.glass.ice+3>MAX_ICE_CUBES||space(s.glass)<30)return false;s.glass.ice+=3;s.temperature=drinkTemperature(s);return true;}
export function addCloud(s,ml=25){if(s.glass.water<1||s.glass.milk<1||s.glass.cream>=40)return false;const n=Math.min(ml,40-s.glass.cream,space(s.glass));if(n<1)return false;s.glass.cream+=n;return true;}
export function transfer(s){if(s.water<5||s.powder<1||s.water>space(s.glass)+.001)return false;const g=s.glass;g.first??='matcha';g.foam=(g.foam*g.water+s.foam*s.water)/(g.water+s.water);g.water+=s.water;g.powder+=s.powder;s.water=s.powder=s.foam=0;return true;}
export function evaluate(s,order){const g=s.glass,a=orderAmounts(order),within=(v,range)=>v>=range[0]&&v<=range[1];return [
 {key:'temperature',weight:20,label:order.temperature==='ice'?'Ice · dengan es':'Hot · tanpa es',ok:drinkTemperature(s)===order.temperature},
 {key:'matcha',weight:25,label:`${a.powder.join('–')} sendok matcha · 25–100 ml air`,ok:within(g.powder,a.powder)&&within(g.water,a.water)},
 {key:'milk',weight:20,label:`${a.milk.join('–')} ml ${milkName(order.milkType||'fresh')}`,ok:within(g.milk,a.milk)&&g.milkType===(order.milkType||'fresh')},
 {key:'foam',weight:10,label:'Matcha dikocok hingga berbusa',ok:g.foam>=.25},
 {key:'ice',weight:15,label:order.temperature==='ice'?`Minimal ${a.iceMin} es batu`:'Tanpa es batu',ok:order.temperature==='ice'?g.ice>=a.iceMin&&g.ice<=MAX_ICE_CUBES:g.ice===0},
 {key:'cloud',weight:10,label:order.cloud?'20–40 ml krim cloud':'Tanpa krim cloud',ok:order.cloud?g.cream>=20&&g.cream<=40:g.cream===0}
];}

// Only the served recipe affects the rating. Time and pour order are deliberately absent.
function recipeFeedback(s,order,key){
 const g=s.glass,a=orderAmounts(order),wantedMilk=milkName(order.milkType||'fresh');
 const feedback=(reason,detail)=>({reason,detail});
 if(key==='temperature')return order.temperature==='hot'
  ?feedback('temperature-hot','Aku memesan Hot tanpa es. Gelas ini menjadi Ice karena berisi es.')
  :feedback('temperature-ice','Aku memesan Ice. Tambahkan es agar racikannya menjadi latte dingin.');
 if(key==='matcha'){
  if(g.powder<=0)return feedback('matcha-missing','Matchanya belum ada di gelasku. Tuangkan racikan dari chawan setelah dikocok, ya.');
  if(g.water<=0)return feedback('water-missing','Matchanya masih perlu dicampur air dan dikocok sebelum disajikan.');
  if(g.powder<a.powder[0])return feedback('matcha-weak',`Aku ingin matchanya lebih pekat, dengan ${a.powder.join('–')} sendok bubuk.`);
  if(g.powder>a.powder[1])return feedback('matcha-strong',`Matchanya lebih pekat dari yang kupesan. Aku suka takaran ${a.powder.join('–')} sendok.`);
  if(g.water<a.water[0])return feedback('water-low','Air untuk matchanya masih terlalu sedikit. Aku suka racikan dengan 25–100 ml air.');
  return feedback('water-high','Air untuk matchanya lebih banyak dari yang kupesan. Coba 25–100 ml agar rasanya tidak terlalu encer.');
 }
 if(key==='milk'){
  if(g.milk<=0)return feedback('milk-missing',`Susunya belum ada. Aku memesan ${wantedMilk} untuk latte ini.`);
  if(g.milkType!==(order.milkType||'fresh'))return feedback('milk-type',`Aku memesan ${wantedMilk}${g.milkType==='mixed'?', sementara susu di gelas ini tercampur beberapa jenis.':`, tetapi gelasku berisi ${milkName(g.milkType)}.`}`);
  return g.milk<a.milk[0]
   ?feedback('milk-low',`Aku suka susu sedikit lebih banyak, sekitar ${a.milk.join('–')} ml ${wantedMilk}.`)
   :feedback('milk-high',`Susunya lebih banyak dari yang kusuka. Takaran ${a.milk.join('–')} ml ${wantedMilk} akan lebih pas untukku.`);
 }
 if(key==='foam')return feedback('foam-low','Aku ingin busa matcha yang lebih halus. Kocok sedikit lagi sebelum menuangnya ke gelas.');
 if(key==='ice'){
  if(order.temperature==='hot')return feedback('ice-unwanted','Aku memesan latte hangat tanpa es. Kali ini masih ada es di gelasku.');
  if(g.ice>MAX_ICE_CUBES)return feedback('ice-high',`Esnya terlalu banyak. Maksimal ${MAX_ICE_CUBES} es sudah cukup untuk gelas ini.`);
  return feedback(g.ice===0?'ice-missing':'ice-low',`${g.ice===0?'Esnya belum ada.':'Aku ingin sedikit lebih banyak es.'} Untuk pesananku, setidaknya ${a.iceMin} es batu, ya.`);
 }
 if(key==='cloud'){
  if(!order.cloud)return feedback('cloud-unwanted','Aku memesan latte tanpa cloud. Kali ini masih ada krim cloud di atasnya.');
  if(g.cream===0)return feedback('cloud-missing','Cloud-nya belum ada. Aku ingin lapisan krim cloud yang lembut, sekitar 20–40 ml.');
  return feedback(g.cream<20?'cloud-low':'cloud-high',`${g.cream<20?'Cloud-nya masih sedikit.':'Cloud-nya lebih banyak dari yang kupesan.'} Aku suka takaran 20–40 ml.`);
 }
 return {reason:null,detail:''};
}
export function rateOrder(s,order){
 const checks=evaluate(s,order),missing=checks.filter(c=>!c.ok),score=checks.reduce((n,c)=>n+(c.ok?c.weight:0),0);
 const stars=missing.length===0?5:score>=80?4:score>=60?3:score>=35?2:1;
 const reactions={
  5:{mood:'delighted',label:'Pas sekali!'},
  4:{mood:'happy',label:'Hampir pas'},
  3:{mood:'hopeful',label:'Mulai terasa pas'},
  2:{mood:'curious',label:'Masih bisa diracik'},
  1:{mood:'patient',label:'Kita coba lagi, ya'}
 };
 const g=s.glass,a=orderAmounts(order);
 const tips={
  temperature:order.temperature==='hot'?'Untuk pesanan Hot, buat ulang tanpa es.':`Tambahkan setidaknya ${a.iceMin} es batu untuk latte Ice pesananku.`,
  matcha:`Gunakan ${a.powder.join('–')} sendok matcha dan 25–100 ml air. Kocok di chawan sebelum dituang.`,
  milk:g.milk>0&&g.milkType!==(order.milkType||'fresh')?`Aku memesan ${milkName(order.milkType||'fresh')}. Buat ulang menggunakan kotak susu yang sesuai, ya.`:`Tuang ${a.milk.join('–')} ml ${milkName(order.milkType||'fresh')}. Jika sudah berlebih atau ada cloud, coba buat ulang.`,
  foam:'Saat membuat ulang, kocok matcha hingga berbusa sebelum dituang ke gelas.',
  ice:order.temperature==='ice'?`Tambahkan es hingga setidaknya ${a.iceMin} buah, maksimal ${MAX_ICE_CUBES}.`:'Buat ulang tanpa es untuk pesanan Hot.',
  cloud:order.cloud?'Lengkapi latte dengan 20–40 ml krim cloud di bagian atas.':'Untuk pesanan ini, coba buat ulang tanpa krim cloud.'
 };
 const customer=customerForOrder(order),feedback=recipeFeedback(s,order,(missing.find(c=>c.key!=='temperature')||missing[0])?.key);
 const quote=missing.length?`${customer.encouragement} ${feedback.detail}`:customer.perfectQuote;
 return {checks,score,stars,...reactions[stars],customer,reason:feedback.reason,quote,tip:missing.length?tips[missing[0].key]:'Semua bagian pesanan cocok. Nikmati hasil racikanmu.',perfect:missing.length===0};
}
