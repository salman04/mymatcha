import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeAmbience,AMBIENCE_LABELS} from '../dist/ambience-textures.js';
import {createAmbiencePlayer} from '../dist/ambience-player.js';
import {createSoundscape} from '../dist/soundscape.js';
const rms=pcm=>Math.sqrt(pcm.reduce((sum,v)=>sum+v*v,0)/pcm.length);
class Param{
 constructor(value=0){this.value=value;this.events=[];}
 cancelScheduledValues(time){this.events.push({type:'cancel',time});}
 setTargetAtTime(value,time,seconds){this.value=value;this.events.push({value,time,seconds});}
}
class Context{
 constructor(){this.state='running';this.currentTime=0;this.sampleRate=22050;this.destination={};this.nodes=[];this.buffers=[];}
 node(type){const n={type,connections:[],starts:0,connect(to){this.connections.push(to);},disconnect(){this.connections=[];},start(){this.starts++;},stop(){this.stopped=true;}};for(const key of ['gain','frequency','Q','pan','playbackRate','threshold','knee','ratio','attack','release'])n[key]=new Param();this.nodes.push(n);return n;}
 createGain(){return this.node('gain');}createBufferSource(){return this.node('source');}createBiquadFilter(){return this.node('filter');}createStereoPanner(){return this.node('pan');}createDynamicsCompressor(){return this.node('compressor');}
 createBuffer(count,length,rate){const channels=Array.from({length:count},()=>new Float32Array(length));const b={length,sampleRate:rate,duration:length/rate,getChannelData:i=>channels[i]};this.buffers.push(b);return b;}
 resume(){this.state='running';return Promise.resolve();}
}
const tiny=()=>[new Float32Array([.01,0,-.01,0]),new Float32Array([0,.01,0,-.01])];

test('four outdoor beds are distinct, restrained stereo textures with smooth loop boundaries',()=>{
 const takes={};
 for(const key of Object.keys(AMBIENCE_LABELS)){
  const channels=synthesizeAmbience(key);takes[key]=channels;
  assert.equal(channels.length,2);assert.equal(channels[0].length,28*22050);
  for(const pcm of channels){
   assert.ok(pcm.every(Number.isFinite));assert.ok(rms(pcm)>.003&&rms(pcm)<.045,`${key}: restrained level ${rms(pcm)}`);
   assert.ok(pcm.every(v=>Math.abs(v)<.20),`${key}: no sudden loud peaks`);
   assert.ok(Math.abs(pcm.reduce((s,v)=>s+v,0)/pcm.length)<.001,`${key}: no DC offset`);
   assert.ok(Math.abs(pcm[0]-pcm.at(-1))<.04,`${key}: smooth loop seam`);
  }
  assert.ok(rms(channels[0].map((v,i)=>v-channels[1][i]))>.002,'Stereo image is not duplicated mono');
 }
 assert.ok(rms(takes.rain[0])>rms(takes.night[0])*2,'Rain has a continuous bed; nighttime remains sparse');
 assert.ok(Math.max(...takes.morning[0].slice(20000,50000))>Math.max(...takes.night[0].slice(20000,50000)),'Morning has distinct bird phrases');
 const a=synthesizeAmbience('sunset',{duration:3,sampleRate:8000}),b=synthesizeAmbience('sunset',{duration:3,sampleRate:8000});assert.deepEqual(a,b);
 assert.notDeepEqual(a,synthesizeAmbience('sunset',{duration:3,sampleRate:8000,seed:19}));
 assert.throws(()=>synthesizeAmbience('rain',{duration:Infinity}),RangeError);assert.throws(()=>synthesizeAmbience('rain',{sampleRate:0}),RangeError);
});

test('ambience is lazy, crossfades moods and bounds voices even under rapid switching',()=>{
 const context=new Context(),output={},calls=[],player=createAmbiencePlayer(context,output,{synthesize:key=>{calls.push(key);return tiny();}});
 player.setAtmosphere('rain');player.setVolume(.2);assert.equal(context.buffers.length,0);assert.deepEqual(context.nodes[0].connections,[output]);
 player.update();assert.equal(player.status.playing,true);assert.deepEqual(calls,['rain']);
 for(let i=0;i<100;i++){player.setAtmosphere(['morning','sunset','night','rain'][i%4]);player.update();context.currentTime+=.05;}
 assert.equal(player.status.beds,4);assert.equal(context.buffers.length,4);assert.equal(context.nodes.filter(n=>n.type==='source').length,4);
 assert.ok(context.nodes.filter(n=>n.type==='source').every(n=>n.loop&&n.starts===1));
 const transitions=context.nodes.filter(n=>n.type==='gain').slice(1).flatMap(n=>n.gain.events.filter(e=>'seconds'in e));
 assert.ok(transitions.every(e=>e.seconds>=.6),'Moods crossfade gently instead of cutting');
 const count=context.nodes.length;for(let i=0;i<1000;i++)player.update();assert.equal(context.nodes.length,count);
});

test('zero volume, backgrounding and suspension silence ambience without rebuilding buffers',()=>{
 const context=new Context(),player=createAmbiencePlayer(context,context.destination,{synthesize:tiny});player.update();const count=context.nodes.length;
 player.setVolume(0);assert.equal(player.status.playing,false);player.update();assert.equal(player.status.playing,false);
 player.setVolume(.4);player.update();assert.equal(player.status.volume,.4);assert.equal(player.status.playing,true);
 player.update({active:false});assert.equal(player.status.playing,false);context.state='suspended';player.update();assert.equal(player.status.playing,false);
 context.state='running';context.currentTime+=120;player.update();assert.equal(player.status.playing,true);assert.equal(context.nodes.length,count,'No catch-up calls or new voices');
 player.setVolume(NaN);assert.equal(player.status.volume,0);player.setVolume(9);assert.equal(player.status.volume,1);
});

test('ambience has an independent output and keeps playing with both music and effects muted',async()=>{
 const context=new Context();let player,created=0;
 const sound=createSoundscape({createContext:()=>context,synthesize:()=>new Float32Array(4),createAmbience:(ctx,out)=>{created++;return player=createAmbiencePlayer(ctx,out,{synthesize:tiny});},loadPourRecording:()=>Promise.resolve(null),loadIceRecording:()=>Promise.resolve(null)});
 sound.setEffectsVolume(0);sound.setMusicVolume(0);sound.setAmbienceVolume(.28);sound.setAtmosphere('rain');assert.equal(created,0);
 await sound.setEnabled(true);sound.update({}, {active:false,musicActive:false,ambienceActive:true});
 assert.equal(player.status.playing,true);assert.equal(player.status.atmosphere,'rain');assert.equal(sound.status.effectsVolume,0);assert.equal(sound.status.musicVolume,0);
 const master=context.nodes.find(n=>n.connections.includes(context.destination)&&n.type==='gain');assert.ok(master,'Ambience bypasses the effects master/compressor');
 sound.silence();assert.equal(player.status.playing,true,'Action silence does not cut nature ambience');
 sound.setEffectsVolume(.5);assert.equal(player.status.volume,.28);sound.setAmbienceVolume(.12);assert.equal(sound.status.effectsVolume,.5);
 sound.pause();assert.equal(player.status.playing,false);sound.update({}, {ambienceActive:false});assert.equal(player.status.playing,false);
 sound.update({});assert.equal(player.status.playing,true);await sound.setEnabled(false);assert.equal(player.status.playing,false);sound.update({});assert.equal(player.status.playing,false);
 await sound.setEnabled(true);sound.update({});assert.equal(player.status.playing,true);assert.equal(created,1);
});

test('a stale unlock cannot restart ambience after mute, and inactive mood changes stay lazy',async()=>{
 const context=new Context();let resume;context.resume=()=>new Promise(resolve=>resume=resolve);
 const sound=createSoundscape({createContext:()=>context,synthesize:()=>new Float32Array(4),createAmbience:(ctx,out)=>createAmbiencePlayer(ctx,out,{synthesize:tiny}),loadPourRecording:()=>Promise.resolve(null),loadIceRecording:()=>Promise.resolve(null)});
 sound.setAmbienceVolume(.3);const enabling=sound.setEnabled(true);await sound.setEnabled(false);resume();assert.equal(await enabling,false);
 sound.setAtmosphere('night');sound.update({});assert.equal(sound.status.ambience.playing,false);assert.equal(sound.status.ambience.beds,0);
});
