import assert from 'node:assert/strict';
import test from 'node:test';
import {loadPourRecording,preparePourRecording} from '../dist/pour-recording.js';

class Buffer {
  constructor(channels,length,rate){this.numberOfChannels=channels;this.length=length;this.sampleRate=rate;this.duration=length/rate;this.channels=Array.from({length:channels},()=>new Float32Array(length));}
  getChannelData(channel){return this.channels[channel];}
}
const context=()=>({created:[],createBuffer(channels,length,rate){const buffer=new Buffer(channels,length,rate);this.created.push(buffer);return buffer;}});
function capture({rate=1000,channels=2,duration=6.216}={}){return new Buffer(channels,Math.round(duration*rate),rate);}
const near=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} is close to ${expected}`);

test('the supplied capture becomes a mono 4.57-second loop with a modest fixed gain',()=>{
  const decoded=capture(),ctx=context();decoded.channels[0].fill(.1);decoded.channels[1].fill(.3);
  const original=decoded.channels.map(channel=>channel.slice());
  const prepared=preparePourRecording(ctx,decoded),samples=prepared.getChannelData(0);
  assert.equal(prepared.numberOfChannels,1);assert.equal(prepared.sampleRate,1000);assert.equal(prepared.length,4570);near(prepared.duration,4.57);
  assert.ok(samples.every(sample=>Math.abs(sample-.4)<1e-6),'channels average together before the +6 dB gain');
  assert.deepEqual(decoded.channels,original,'the decoded source is preserved');assert.equal(ctx.created.length,1);
});

test('quiet lead and tail are excluded and the main captured texture stays unchanged',()=>{
  const decoded=capture({channels:1}),ctx=context(),source=decoded.getChannelData(0);
  source.fill(.8,0,200);source.fill(-.8,4850);
  for(let i=200;i<4850;i++)source[i]=.06*Math.sin(i*.17)+.02*Math.cos(i*.037);
  const prepared=preparePourRecording(ctx,decoded),samples=prepared.getChannelData(0);
  for(let i=80;i<samples.length;i+=37)near(samples[i],source[200+i]*2);
  assert.ok(samples.every(sample=>Math.abs(sample)<.17),'discarded lead/tail markers cannot enter the loop');
});

test('the overlap joins adjacent captured samples across the loop and both crossfade boundaries',()=>{
  const decoded=capture({channels:1}),source=decoded.getChannelData(0);
  for(let i=0;i<source.length;i++)source[i]=(i-200)/4650*.4-.2;
  const samples=preparePourRecording(context(),decoded).getChannelData(0);
  near(samples[0],source[4770]*2);near(samples[79],source[279]*2);near(samples[80],source[280]*2);near(samples.at(-1),source[4769]*2);
  const naiveGap=Math.abs(source[4849]-source[200])*2,preparedGap=Math.abs(samples[0]-samples.at(-1));
  assert.ok(naiveGap>.7);assert.ok(preparedGap<.001,'the loop seam follows neighboring source samples instead of jumping across the recording');
  assert.ok(Math.abs(samples[80]-samples[79])<.001,'the overlap returns continuously to the original captured texture');
  assert.ok(samples.every(Number.isFinite));
});

test('levels retain their dynamics without aggressive normalization or new clipping for this recording',()=>{
  const decoded=capture({channels:1}),source=decoded.getChannelData(0);source.fill(.002);
  source[2669]=.249;source[2670]=-.21;
  const samples=preparePourRecording(context(),decoded).getChannelData(0);
  near(samples[2469],.498);near(samples[2470],-.42);near(samples[1800],.004);
  assert.ok(Math.max(...samples)<.5,'the measured source peak retains comfortable headroom after gain');
  assert.ok(samples[2469]/samples[1800]>120,'the recording dynamics are preserved');
});

test('cropping and crossfade use the decoded rate rather than a hard-coded sample count',()=>{
  for(const rate of [24000,44100,48000]){
    const decoded=capture({rate,channels:1});decoded.channels[0].fill(.05);
    const prepared=preparePourRecording(context(),decoded);
    assert.equal(prepared.length,Math.round(4.85*rate)-Math.round(.2*rate)-Math.round(.08*rate));
    assert.equal(prepared.sampleRate,rate);near(prepared.duration,4.57,1/rate);
    near(prepared.getChannelData(0)[100],.1);
  }
});

test('loading fetches the bundled MP3 once, decodes it once, and returns only the prepared buffer',async()=>{
  const decoded=capture(),encoded=new ArrayBuffer(16),ctx=context(),calls=[];
  decoded.channels.forEach(channel=>channel.fill(.1));
  ctx.decodeAudioData=async value=>{calls.push({decode:value});return decoded;};
  const prepared=await loadPourRecording(ctx,{fetchAudio:async url=>{calls.push({fetch:url});return {ok:true,arrayBuffer:async()=>encoded};}});
  assert.equal(calls.length,2);assert.ok(calls[0].fetch instanceof URL);assert.ok(calls[0].fetch.pathname.endsWith('/dist/audio/water-pour.mp3'));
  assert.equal(calls[1].decode,encoded);assert.equal(prepared,ctx.created[0]);assert.equal(prepared.numberOfChannels,1);assert.equal(prepared.length,4570);
});

test('network, HTTP, empty-file and decoder failures reject without producing a loop',async()=>{
  const ctx=context();ctx.decodeAudioData=async()=>capture();
  await assert.rejects(loadPourRecording(ctx,{fetchAudio:async()=>{throw new Error('Network offline');}}),/Network offline/);
  await assert.rejects(loadPourRecording(ctx,{fetchAudio:async()=>({ok:false,status:404})}),/404/);
  await assert.rejects(loadPourRecording(ctx,{fetchAudio:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)})}),/empty/);
  ctx.decodeAudioData=async()=>{throw new Error('Corrupt MP3');};
  await assert.rejects(loadPourRecording(ctx,{fetchAudio:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})}),error=>error.message.includes('decode')&&error.cause?.message==='Corrupt MP3');
  assert.equal(ctx.created.length,0);
});

test('invalid or incomplete decoded PCM is rejected instead of creating NaN or malformed audio',()=>{
  const malformed=[null,{},capture({duration:2}),{...capture(),sampleRate:0},{...capture(),numberOfChannels:0}];
  const nonFinite=capture();nonFinite.channels[0][300]=Number.NaN;malformed.push(nonFinite);
  const shortChannel=capture();shortChannel.channels[1]=new Float32Array(10);malformed.push(shortChannel);
  for(const decoded of malformed){const ctx=context();assert.throws(()=>preparePourRecording(ctx,decoded),/recording|PCM/i);assert.equal(ctx.created.length,0);}
  assert.throws(()=>preparePourRecording({},capture()),/Invalid/);
});
