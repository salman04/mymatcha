import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareIceRecording,loadIceRecording} from '../dist/ice-recording.js';

class Buffer {
  constructor(channels,length,rate){this.numberOfChannels=channels;this.length=length;this.sampleRate=rate;this.duration=length/rate;this.channels=Array.from({length:channels},()=>new Float32Array(length));}
  getChannelData(channel){return this.channels[channel];}
}
const context=()=>({created:[],createBuffer(channels,length,rate){const buffer=new Buffer(channels,length,rate);this.created.push(buffer);return buffer;}});
const capture=({rate=1000,channels=2,duration=5.721}={})=>new Buffer(channels,Math.round(duration*rate),rate);
const near=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} is close to ${expected}`);

test('the supplied recording yields two independent mono impact clusters without changing the source',()=>{
  const decoded=capture(),ctx=context();decoded.channels[0].fill(.1);decoded.channels[1].fill(.3);
  const original=decoded.channels.map(channel=>channel.slice()),takes=prepareIceRecording(ctx,decoded);
  assert.equal(takes.length,2);assert.equal(ctx.created.length,2);assert.notEqual(takes[0],takes[1]);
  assert.deepEqual(takes.map(take=>take.length),[1300,1660]);
  near(takes[0].duration,1.3);near(takes[1].duration,1.66);
  for(const take of takes){assert.equal(take.numberOfChannels,1);assert.equal(take.sampleRate,1000);near(take.getChannelData(0)[50],.2);}
  assert.deepEqual(decoded.channels,original);
  takes[0].getChannelData(0)[50]=.9;near(takes[1].getChannelData(0)[50],.2);near(decoded.channels[0][170],.1);
});

test('only the requested capture ranges enter each take and original dynamics remain unchanged',()=>{
  const decoded=capture({channels:1}),source=decoded.getChannelData(0);source.fill(.9);
  source.fill(.04,120,1420);source.fill(-.08,2200,3860);
  source[500]=.46;source[2700]=-.24;
  const [first,second]=prepareIceRecording(context(),decoded),a=first.getChannelData(0),b=second.getChannelData(0);
  near(a[380],.46);near(a[100],.04);near(b[500],-.24);near(b[100],-.08);
  assert.ok(a.every(sample=>sample>=0&&sample<=.461));assert.ok(b.every(sample=>sample<=0&&sample>=-.241));
  assert.ok(a[380]/a[100]>11,'loud and quiet details retain their captured ratio');
});

test('short edge fades end at zero, remain bounded, and leave the main impact intact',()=>{
  const decoded=capture({channels:1});decoded.channels[0].fill(.4);
  for(const take of prepareIceRecording(context(),decoded)){
    const a=take.getChannelData(0),last=a.length-1;
    near(a[0],0);near(a[last],0);near(a[11],.4);near(a[last-11],.4);
    assert.ok(a[5]>0&&a[5]<.4);assert.ok(a[last-5]>0&&a[last-5]<.4);
    for(let i=1;i<12;i++)assert.ok(a[i]>=a[i-1]);
    assert.ok(a.every(sample=>Number.isFinite(sample)&&sample>=0&&sample<=.400001));
    near(a[100],.4);
  }
});

test('crop and fade lengths follow the decoded rate, including real 44.1 kHz audio',()=>{
  for(const rate of [24000,44100,48000]){
    const decoded=capture({rate,channels:1});decoded.channels[0].fill(.12);
    const takes=prepareIceRecording(context(),decoded);
    assert.deepEqual(takes.map(take=>take.length),[Math.round(1.42*rate)-Math.round(.12*rate),Math.round(3.86*rate)-Math.round(2.20*rate)]);
    for(const take of takes){const a=take.getChannelData(0);assert.equal(take.sampleRate,rate);near(a[0],0);near(a.at(-1),0);near(a[Math.round(.02*rate)],.12);}
  }
});

test('the loader fetches and decodes the bundled MP3 once before returning both prepared takes',async()=>{
  const decoded=capture(),ctx=context(),encoded=new ArrayBuffer(16),calls=[];
  ctx.decodeAudioData=async value=>{calls.push({decode:value});return decoded;};
  const takes=await loadIceRecording(ctx,{fetchAudio:async url=>{calls.push({fetch:url});return {ok:true,arrayBuffer:async()=>encoded};}});
  assert.equal(calls.length,2);assert.ok(calls[0].fetch instanceof URL);assert.ok(calls[0].fetch.pathname.endsWith('/dist/audio/ice-cube.mp3'));
  assert.equal(calls[1].decode,encoded);assert.deepEqual(takes,ctx.created);assert.equal(takes.length,2);
});

test('network, HTTP, empty data, and corrupt MP3 failures reject without creating a take',async()=>{
  const ctx=context();ctx.decodeAudioData=async()=>capture();
  await assert.rejects(loadIceRecording(ctx,{fetchAudio:async()=>{throw new Error('Offline');}}),/Offline/);
  await assert.rejects(loadIceRecording(ctx,{fetchAudio:async()=>({ok:false,status:404})}),/404/);
  await assert.rejects(loadIceRecording(ctx,{fetchAudio:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)})}),/empty/);
  ctx.decodeAudioData=async()=>{throw new Error('Invalid MP3');};
  await assert.rejects(loadIceRecording(ctx,{fetchAudio:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})}),error=>error.message.includes('decode')&&error.cause?.message==='Invalid MP3');
  await assert.rejects(loadIceRecording({}, {fetchAudio:async()=>{throw new Error('Should not fetch');}}),/unavailable/);
  assert.equal(ctx.created.length,0);
});

test('invalid metadata and incomplete or non-finite PCM never produce malformed audio',()=>{
  const invalid=[null,{},capture({duration:3}),{...capture(),sampleRate:0},{...capture(),numberOfChannels:0}];
  const short=capture();short.channels[1]=new Float32Array(10);invalid.push(short);
  const nan=capture();nan.channels[0][600]=Number.NaN;invalid.push(nan);
  const infinity=capture();infinity.channels[1][5000]=Number.POSITIVE_INFINITY;invalid.push(infinity);
  for(const decoded of invalid){const ctx=context();assert.throws(()=>prepareIceRecording(ctx,decoded),/recording|PCM/i);assert.equal(ctx.created.length,0);}
  assert.throws(()=>prepareIceRecording({},capture()),/Invalid/);
});
