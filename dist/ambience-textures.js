// Original outdoor sound beds, generated once per visited atmosphere.
// Sparse calls sit over shaded air/rain; stereo placement stays deliberately narrow.
import { normalizeAtmosphere } from './atmosphere.js';
const TAU=Math.PI*2;
export const AMBIENCE_LABELS=Object.freeze({morning:'Burung pagi & angin lembut',sunset:'Burung senja & gemerisik daun',night:'Jangkrik jauh & angin malam',rain:'Rintik hujan di luar jendela'});
function random(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let n=Math.imul(seed^seed>>>15,1|seed);n^=n+Math.imul(n^n>>>7,61|n);return((n^n>>>14)>>>0)/4294967296;};}
const pole=(hz,rate)=>1-Math.exp(-TAU*Math.min(hz,rate*.4)/rate);
export function synthesizeAmbience(atmosphere,{sampleRate=22050,duration=28,seed=347}={}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>96000)throw new RangeError('Invalid ambience sample rate');
 if(!Number.isFinite(duration)||duration<2||duration>60||!Number.isFinite(seed))throw new RangeError('Invalid ambience duration or seed');
 const key=normalizeAtmosphere(atmosphere),rain=key==='rain',night=key==='night',sunset=key==='sunset';
 const rand=random(seed+Object.keys(AMBIENCE_LABELS).indexOf(key)*971),frames=Math.round(sampleRate*duration),overlap=Math.round(sampleRate*.35);
 const channels=[new Float32Array(frames+overlap),new Float32Array(frames+overlap)];
 const aLow=pole(180,sampleRate),aMid=pole(rain?2300:950,sampleRate),aHigh=pole(3900,sampleRate);
 for(let channel=0;channel<2;channel++){
  let low=0,mid=0,high=0;const pcm=channels[channel];
  for(let i=0;i<pcm.length;i++){
   const n=rand()*2-1,t=i/sampleRate;low+=aLow*(n-low);mid+=aMid*(n-mid);high+=aHigh*(n-high);
   const breeze=.74+.14*Math.sin(TAU*t/duration*2+channel*.7)+.10*Math.sin(TAU*t/duration*5);
   pcm[i]=(rain?(mid-low)*.12+(high-mid)*.035+low*.04:(mid-low)*.052+low*.04)*breeze;
  }
 }
 function add(start,seconds,pan,sample){
  const first=Math.round(start*sampleRate),count=Math.round(seconds*sampleRate),left=Math.sqrt((1-pan)/2),right=Math.sqrt((1+pan)/2);
  for(let i=0;i<count&&first+i<channels[0].length;i++){
   if(first+i<0)continue;const v=sample(i/sampleRate,i/count);channels[0][first+i]+=v*left;channels[1][first+i]+=v*right;
  }
 }
 if(rain){
  // Tiny, softened contacts in leaves/eaves, with no loud isolated drops or thunder.
  for(let t=.1;t<duration+.35;t+=.06+rand()*.19){
   const hz=700+rand()*1900,amp=.009+rand()*.016,decay=.008+rand()*.015;let phase=rand()*TAU;
   add(t,.12,(rand()-.5)*.8,age=>{phase+=TAU*hz/sampleRate;return amp*(1-Math.exp(-age*900))*Math.exp(-age/decay)*(Math.sin(phase)*.28+(rand()*2-1)*.72);});
  }
 }else{
  if(!night){
   // Each bird phrase has different contours, spacing and breathy partials.
   for(let t=.7;t<duration-1.5;t+=(sunset?6.5:4.1)+rand()*3){
    const pan=(rand()-.5)*.7,base=1900+rand()*1100,notes=2+Math.floor(rand()*3);
    for(let n=0;n<notes;n++){
     const length=.14+rand()*.20,rise=500+rand()*1200,fall=600+rand()*1200,amp=(sunset?.052:.085)*(.65+rand()*.35);let phase=0;
     add(t+n*(.32+rand()*.09),length,pan,(age,p)=>{
      const hz=Math.min(sampleRate*.36,base+rise*Math.sin(Math.PI*p)-fall*p+90*Math.sin(age*TAU*34));phase+=TAU*hz/sampleRate;
      const envelope=Math.sin(Math.PI*p)**1.8;
      return envelope*amp*(Math.sin(phase+.18*Math.sin(phase*.5))+.08*Math.sin(phase*2)+(rand()*2-1)*.035);
     });
    }
   }
  }
  if(night||sunset){
   for(let t=.8;t<duration-1;t+=1.7+rand()*2.8){
    const hz=Math.min(sampleRate*.37,3200+rand()*950),amp=night?.018:.009,pan=(rand()-.5)*.65;let phase=0;
    add(t,.65+rand()*.5,pan,(age,p)=>{phase+=TAU*hz/sampleRate;const pulse=Math.max(0,Math.sin(TAU*age*(17+2*Math.sin(t))))**3;return Math.sin(Math.PI*p)**2*pulse*Math.sin(phase)*amp;});
   }
  }
 }
 // Crossfade the source's continuation into its beginning. No abrupt loop seam.
 return channels.map(source=>{
  const pcm=source.slice(overlap);
  for(let i=0;i<overlap;i++){const p=i/(overlap-1),index=frames-overlap+i;pcm[index]=source[frames+i]*Math.cos(p*Math.PI/2)+source[i]*Math.sin(p*Math.PI/2);}
  for(let i=0;i<pcm.length;i++)pcm[i]=.42*Math.tanh(pcm[i]/.42);
  return pcm;
 });
}
