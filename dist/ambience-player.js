import { normalizeAtmosphere } from './atmosphere.js';
import { synthesizeAmbience } from './ambience-textures.js';
const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));

export function createAmbiencePlayer(context,output,{synthesize=synthesizeAmbience}={}){
 const master=context.createGain();master.gain.value=0;master.connect(output);
 const beds=new Map();let volume=.28,key='morning',playing=false,current=null;
 function ramp(param,value,seconds){param.cancelScheduledValues(context.currentTime);param.setTargetAtTime(value,context.currentTime,seconds);}
 function ensureBed(name){
  if(beds.has(name))return beds.get(name);
  const rate=22050,pcm=synthesize(name,{sampleRate:rate}),buffer=context.createBuffer(2,pcm[0].length,rate);
  for(let channel=0;channel<2;channel++)buffer.getChannelData(channel).set(pcm[channel]);
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;
  source.connect(gain);gain.connect(master);source.start();const bed={source,gain};beds.set(name,bed);return bed;
 }
 function silence(){if(!playing)return;playing=false;ramp(master.gain,0,.035);}
 return {
  setAtmosphere(value){key=normalizeAtmosphere(value);},
  setVolume(value){volume=clamp(value);if(volume===0)silence();else if(playing)ramp(master.gain,volume,.12);return volume;},
  silence,
  update({active=true}={}){
   if(!active||volume===0||context.state!=='running'){silence();return;}
   ensureBed(key);
   if(current!==key){for(const [name,bed]of beds)ramp(bed.gain.gain,name===key?1:0,.65);current=key;}
   if(!playing){playing=true;ramp(master.gain,volume,.5);}
  },
  // At most four cheap buffer loops, allocated only for visited moods. Mutes and
  // rapid A/B changes reuse their gain nodes instead of accumulating voices.
  get status(){return {volume,atmosphere:key,playing,beds:beds.size};}
 };
}
