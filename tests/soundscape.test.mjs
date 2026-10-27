import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundscape } from '../dist/soundscape.js';

class FakeParam {
  constructor(value = 0) { this.value = value; this.targets = []; this.cancellations = []; }
  cancelScheduledValues(time) { this.cancellations.push(time); }
  setTargetAtTime(value, time, seconds) { this.value = value; this.targets.push({ value, time, seconds }); }
}
class FakeNode {
  constructor(type) {
    this.nodeType = type; this.connections = []; this.disconnections = 0;
    for (const key of ['gain', 'frequency', 'Q', 'pan', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new FakeParam();
    this.stops = []; this.starts = 0; this.startCalls = [];
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnections++; this.connections.length = 0; }
  start(...args) { this.starts++; this.startCalls.push(args); }
  stop(time) { this.stops.push(time); }
  finish() { if(this.finished)return;this.finished=true;this.onended?.(); }
}
class FakeContext {
  constructor() { this.sampleRate = 1000; this.currentTime = 10; this.state = 'suspended'; this.destination = {}; this.nodes = []; this.buffers = []; this.resumes = 0; }
  node(type) { const node = new FakeNode(type); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createBufferSource() { return this.node('source'); }
  createBiquadFilter() { return this.node('filter'); }
  createStereoPanner() { return this.node('pan'); }
  createBuffer(channels, length, sampleRate) {
    const pcm = new Float32Array(length), buffer = { sampleRate, duration: length / sampleRate, length, numberOfChannels: channels, getChannelData: () => pcm };
    this.buffers.push(buffer); return buffer;
  }
  resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
  get sources() { return this.nodes.filter(node => node.nodeType === 'source'); }
  get loops() { return this.sources.filter(node => node.loop); }
  get pours() { return this.sources.filter(node => node.buffer?.isPourRecording); }
  get procedural() { return this.sources.filter(node => node.loop && !node.buffer?.isPourRecording); }
  get impacts() { return this.sources.filter(node => !node.loop && !node.buffer?.isPourRecording); }
}
function pourBuffer(context) {
  const pcm = new Float32Array(context.sampleRate * 6);
  return { isPourRecording: true, duration: 6, sampleRate: context.sampleRate, length: pcm.length, numberOfChannels: 1, getChannelData: () => pcm };
}
function iceBuffers(context){
  return [1.3,1.66].map((duration,index)=>{const pcm=new Float32Array(Math.round(context.sampleRate*duration));return {isIceRecording:true,take:index,duration,sampleRate:context.sampleRate,length:pcm.length,numberOfChannels:1,getChannelData:()=>pcm};});
}
function harness(context = new FakeContext(), { loadPourRecording,loadIceRecording } = {}) {
  let contexts = 0;
  const synthesized = [], loads = [],iceLoads=[],recording = pourBuffer(context),iceRecordings=iceBuffers(context);
  const sound = createSoundscape({ createContext: () => { contexts++; return context; }, synthesize: (kind, options) => { synthesized.push({ kind, options }); return new Float32Array([.1, -.1, .05, 0]); }, loadPourRecording: ctx => { loads.push(ctx); return loadPourRecording ? loadPourRecording(ctx) : Promise.resolve(recording); },loadIceRecording:ctx=>{iceLoads.push(ctx);return loadIceRecording?loadIceRecording(ctx):Promise.resolve(iceRecordings);} });
  return { sound, context, synthesized, recording, loads,iceLoads,iceRecordings,contexts: () => contexts };
}
const pour = (kind, intensity = 1, fill = .5) => ({ pour: { kind, intensity, fill }, whisk: { intensity: 0, foam: 0, speed: 1 } });
const powder = (scoop = 0, sift = 0) => ({ powder: { scoop, sift } });
const ice = (wet = true) => ({ wet, index: 0, intensity: .8, pan: .6 });
const allSilent = sound => assert.ok(Object.values(sound.status.levels).every(level => level === 0));
const pourFilter = source => source.connections[0].connections[0];
const flush = () => new Promise(resolve => setImmediate(resolve));

test('audio stays lazy, unlocks only on enabling, and reuses its initialized graph', async () => {
  const h = harness();
  h.sound.update(pour('water'), { iceEvents: [ice()] }); h.sound.resume(); h.sound.silence();
  assert.equal(await h.sound.setEnabled(false), false);
  assert.equal(h.contexts(), 0); assert.equal(h.context.nodes.length, 0);
  assert.equal(h.sound.status.state, 'uninitialized'); assert.equal(h.sound.status.recording, 'idle'); assert.equal(h.loads.length, 0);assert.equal(h.sound.status.iceRecording,'idle');assert.equal(h.iceLoads.length,0);
  assert.equal(await h.sound.setEnabled(true), true);
  await flush();
  assert.equal(h.contexts(), 1); assert.equal(h.context.resumes, 1); assert.equal(h.sound.status.state, 'running');
  assert.equal(h.context.loops.length, 4); assert.equal(h.context.pours.length, 0);
  assert.deepEqual(h.synthesized.map(item => item.kind), ['cloud', 'whisk', 'scoop', 'sift']);
  assert.equal(h.sound.status.recording, 'ready'); assert.deepEqual(h.loads, [h.context]);
  assert.equal(h.sound.status.iceRecording,'ready');assert.deepEqual(h.iceLoads,[h.context]);
  assert.ok(h.context.loops.every(source => source.starts === 1));
  const nodeCount = h.context.nodes.length;
  await h.sound.setEnabled(false); await h.sound.setEnabled(true); await flush();
  assert.equal(h.contexts(), 1); assert.equal(h.context.nodes.length, nodeCount); assert.equal(h.loads.length, 1);assert.equal(h.iceLoads.length,1);
});

test('only actual contact intensity opens the matching fluid or whisk channel', async () => {
  const h = harness(); await h.sound.setEnabled(true); await flush();
  for (const kind of ['water', 'milk', 'serve', 'cloud']) {
    h.sound.update(pour(kind, 0)); allSilent(h.sound);
    h.sound.update(pour(kind, .01)); allSilent(h.sound);
    h.sound.update(pour(kind, 1));
    for (const [channel, level] of Object.entries(h.sound.status.levels)) assert.equal(level > 0, channel === kind);
    const full = h.sound.status.levels[kind];
    h.sound.update(pour(kind, .25)); assert.ok(h.sound.status.levels[kind] > 0 && h.sound.status.levels[kind] < full);
  }
  h.sound.update(pour('unknown', 1)); allSilent(h.sound);
  h.sound.update({ whisk: { intensity: 1, foam: .8, speed: .6 } });
  assert.ok(h.sound.status.levels.whisk > 0);
  assert.ok(Object.entries(h.sound.status.levels).every(([kind, level]) => kind === 'whisk' || level === 0));
  const filters = h.context.nodes.filter(node => node.nodeType === 'filter');
  assert.ok(new Set(filters.map(filter => filter.frequency.value)).size >= 4, 'fluids and whisk retain different acoustic color');
  assert.ok(h.context.procedural[1].playbackRate.value < 1.01, 'whisk speed affects its loop rate');
  h.sound.update({ pour: { kind: 'water', intensity: Number.NaN }, whisk: { intensity: Number.POSITIVE_INFINITY } }); allSilent(h.sound);
  h.sound.update(undefined); allSilent(h.sound);
});

test('powder phases open only the matching scoop or sift channel and may overlap naturally', async () => {
  const h=harness();await h.sound.setEnabled(true);await flush();
  for(const [kind,full] of [['scoop',.18],['sift',.16]]){
    h.sound.update({powder:{[kind]:1}});
    assert.equal(h.sound.status.levels[kind],full);
    assert.ok(Object.entries(h.sound.status.levels).every(([key,level])=>key===kind?level>0:level===0));
    h.sound.update({powder:{[kind]:.25}});
    assert.equal(h.sound.status.levels[kind],full*.5,'a softer physical phase lowers its own channel');
    h.sound.update({powder:{[kind]:0}});allSilent(h.sound);
  }
  h.sound.update(powder(.64,.25));
  assert.ok(Math.abs(h.sound.status.levels.scoop-.18*.8)<1e-10);
  assert.equal(h.sound.status.levels.sift,.16*.5);
  assert.ok(Object.entries(h.sound.status.levels).every(([kind,level])=>['scoop','sift'].includes(kind)?level>0:level===0));
  assert.equal(h.context.pours.length,0);assert.equal(h.context.impacts.length,0,'powder phases do not trigger liquid or ice sources');
  const sources=h.context.procedural.slice(2),filters=sources.map(source=>source.connections[0]);
  assert.notEqual(filters[0],filters[1]);assert.ok(filters[0].frequency.value<filters[1].frequency.value,'scooping is darker than the fine sieve texture');
});

test('powder intensity is bounded and selecting a tool without a physical phase stays silent', async () => {
  const h=harness();await h.sound.setEnabled(true);await flush();
  for(const snapshot of [undefined,{}, {selected:'scoop'}, {selected:'sift'}, {tool:'scoop'}, {powder:{}}, {powder:{kind:'sift',intensity:1}},powder(.01,.01),powder(-1,-2),powder(Number.NaN,Number.POSITIVE_INFINITY)]){
    h.sound.update(snapshot);allSilent(h.sound);
  }
  h.sound.update(powder(5,10));assert.equal(h.sound.status.levels.scoop,.18);assert.equal(h.sound.status.levels.sift,.16);
  h.sound.update(powder(0,1));assert.equal(h.sound.status.levels.scoop,0);assert.equal(h.sound.status.levels.sift,.16);
  h.sound.update({selected:'sift'});allSilent(h.sound);
});

test('powder animation frames reuse the four procedural loops and smoothly change gains without allocating sources', async () => {
  const h=harness();await h.sound.setEnabled(true);await flush();
  const nodes=h.context.nodes.length,buffers=h.context.buffers.length,synthesis=h.synthesized.length;
  for(let frame=0;frame<360;frame++){
    h.context.currentTime+=1/60;
    const phase=(frame%120)/120;
    h.sound.update(powder(frame<180?Math.sin(Math.PI*phase):0,frame>60?Math.sin(Math.PI*phase)*.8:0));
  }
  h.sound.update(undefined);allSilent(h.sound);
  assert.equal(h.context.nodes.length,nodes);assert.equal(h.context.buffers.length,buffers);assert.equal(h.synthesized.length,synthesis);
  assert.equal(h.context.sources.length,4);assert.ok(h.context.procedural.every(source=>source.starts===1&&source.stops.length===0));
  for(const source of h.context.procedural.slice(2)){
    const gain=source.connections[0].connections[0].gain;
    assert.ok(gain.targets.length>60);assert.ok(gain.targets.every(target=>target.seconds>0));assert.equal(gain.targets.at(-1).value,0);
  }
});

test('a sustained pour reuses one recorded source while render frames only adjust its parameters', async () => {
  const h = harness(); await h.sound.setEnabled(true); await flush();
  h.sound.update(pour('water'));
  const nodes = h.context.nodes.length, buffers = h.context.buffers.length, synthesis = h.synthesized.length;
  for (let frame = 0; frame < 240; frame++) {
    h.context.currentTime += 1 / 60;
    h.sound.update(pour('water', .2 + (frame % 60) / 100, frame / 240));
  }
  assert.equal(h.context.nodes.length, nodes); assert.equal(h.context.buffers.length, buffers); assert.equal(h.synthesized.length, synthesis);
  assert.equal(h.context.pours.length, 1); assert.equal(h.context.pours[0].starts, 1);
  const waterGain = pourFilter(h.context.pours[0]).connections[0].gain;
  assert.ok(waterGain.targets.length > 1); assert.ok(waterGain.targets.every(target => target.seconds > 0));
  h.sound.update(pour('milk')); assert.equal(h.context.pours.length, 2); assert.equal(h.context.pours[0].stops.length, 1);
  const afterSwitch = h.context.nodes.length;
  for(let frame=0;frame<180;frame++){h.context.currentTime+=1/60;h.sound.update(pour('milk',.2+(frame%60)/100));}
  assert.equal(h.context.nodes.length, afterSwitch); assert.equal(h.context.pours.length, 2);
  const detached = h.sound.status; detached.levels.milk = 100;
  assert.ok(h.sound.status.levels.milk < 1, 'status callers cannot mutate internal channel levels');
});

test('water, milk and chawan transfer share the supplied recording and each new pour starts at its beginning', async () => {
  const h=harness();await h.sound.setEnabled(true);await flush();
  assert.equal(h.context.pours.length,0,'loading a recording cannot play it');
  for(const kind of ['water','milk','serve']){
    const count=h.context.pours.length;
    h.sound.update(pour(kind,0));assert.equal(h.context.pours.length,count);
    h.sound.update(pour(kind,1));assert.equal(h.context.pours.length,count+1);
    const source=h.context.pours.at(-1),envelope=source.connections[0],filter=pourFilter(source);
    assert.equal(source.buffer,h.recording);assert.equal(source.loop,true);
    assert.deepEqual(source.startCalls,[[0,0]],`${kind} starts the actual take from offset zero`);
    assert.ok(h.sound.status.levels[kind]>0);
    h.sound.update(pour(kind,0));allSilent(h.sound);
    assert.equal(source.stops.length,1);assert.ok(source.stops[0]>h.context.currentTime&&source.stops[0]<=h.context.currentTime+.2);
    source.finish();assert.equal(source.disconnections,1);
    assert.equal(envelope.disconnections,1,'the completed pour releases its private fade envelope');
    assert.equal(filter.disconnections,0,'the persistent channel filter survives the completed pour');
  }
  assert.deepEqual(h.synthesized.map(item=>item.kind),['cloud','whisk','scoop','sift'],'the three pours never synthesize a substitute texture');
  assert.equal(h.loads.length,1,'all three channels reuse one decoded buffer');
});

test('a delayed recording load only caches audio and waits for a fresh active contact update', async () => {
  let resolveLoad;
  const h=harness(new FakeContext(),{loadPourRecording:()=>new Promise(resolve=>{resolveLoad=resolve;})});
  await h.sound.setEnabled(true);await flush();
  assert.equal(h.sound.status.recording,'loading');assert.equal(h.loads.length,1);
  h.sound.update(pour('water'));allSilent(h.sound);assert.equal(h.context.pours.length,0);
  h.sound.silence();
  resolveLoad(h.recording);await flush();
  assert.equal(h.sound.status.recording,'ready');allSilent(h.sound);
  assert.equal(h.context.pours.length,0,'the completion callback cannot replay a cancelled action');
  h.sound.update(pour('water',0));assert.equal(h.context.pours.length,0);
  h.sound.update(pour('water'));assert.equal(h.context.pours.length,1);
});

test('loading after mute cannot start audio, and re-enabling reuses the cached recording without autoplay', async () => {
  let resolveLoad;
  const h=harness(new FakeContext(),{loadPourRecording:()=>new Promise(resolve=>{resolveLoad=resolve;})});
  await h.sound.setEnabled(true);await flush();h.sound.update(pour('serve'));
  await h.sound.setEnabled(false);resolveLoad(h.recording);await flush();
  assert.equal(h.sound.status.recording,'ready');assert.equal(h.sound.enabled,false);assert.equal(h.context.pours.length,0);allSilent(h.sound);
  h.sound.update(pour('serve'));assert.equal(h.context.pours.length,0);
  await h.sound.setEnabled(true);await flush();
  assert.equal(h.loads.length,1);assert.equal(h.context.pours.length,0);
  h.sound.update(pour('serve'));assert.equal(h.context.pours.length,1);
});

test('a failed recording stays quiet and retries on the next enable while other effect channels remain available', async () => {
  let attempts=0,recording;
  const h=harness(new FakeContext(),{loadPourRecording:()=>++attempts===1?Promise.reject(new Error('Decode failed')):Promise.resolve(recording)});
  recording=h.recording;
  await h.sound.setEnabled(true);await flush();
  assert.equal(h.sound.status.recording,'failed');assert.equal(h.sound.enabled,true);
  for(const kind of ['water','milk','serve']){h.sound.update(pour(kind));allSilent(h.sound);}
  assert.equal(h.context.pours.length,0);
  h.sound.update(pour('cloud'),{iceEvents:[ice()]});assert.ok(h.sound.status.levels.cloud>0);assert.equal(h.context.impacts.length,1);
  h.sound.update({whisk:{intensity:1}});assert.ok(h.sound.status.levels.whisk>0);
  await h.sound.setEnabled(true);await flush();
  assert.equal(h.loads.length,2);assert.equal(h.sound.status.recording,'ready');assert.equal(h.context.pours.length,0);
  h.sound.update(pour('milk'));assert.equal(h.context.pours.length,1);assert.equal(h.context.pours[0].buffer,recording);
});

test('pending enable requests share one load and a synchronously throwing loader fails quietly', async () => {
  let resolveLoad;
  const h=harness(new FakeContext(),{loadPourRecording:()=>new Promise(resolve=>{resolveLoad=resolve;})});
  await h.sound.setEnabled(true);await flush();await h.sound.setEnabled(true);await flush();
  assert.equal(h.loads.length,1);assert.equal(h.sound.status.recording,'loading');
  resolveLoad(h.recording);await flush();assert.equal(h.sound.status.recording,'ready');assert.equal(h.context.pours.length,0);
  const failure=harness(new FakeContext(),{loadPourRecording:()=>{throw new Error('Unavailable decoder');}});
  assert.equal(await failure.sound.setEnabled(true),true);await flush();
  assert.equal(failure.sound.status.recording,'failed');assert.doesNotThrow(()=>failure.sound.update(pour('water')));allSilent(failure.sound);
});

test('short pours fade at contact end, long pours loop one source and later pours restart cleanly', async () => {
  const h=harness();await h.sound.setEnabled(true);await flush();
  h.sound.update(pour('water'));const short=h.context.pours[0];
  h.context.currentTime+=.08;h.sound.update(pour('water',0));
  assert.equal(short.stops.length,1);assert.ok(Math.abs(short.stops[0]-(h.context.currentTime+.18))<1e-8);
  h.sound.update(pour('water',0));assert.equal(short.stops.length,1);short.finish();
  h.sound.update(pour('water'));const long=h.context.pours[1],nodeCount=h.context.nodes.length;
  for(let second=0;second<120;second++){h.context.currentTime+=1;h.sound.update(pour('water'));}
  assert.equal(long.loop,true);assert.equal(long.starts,1);assert.equal(long.stops.length,0);
  assert.equal(h.context.pours.length,2);assert.equal(h.context.nodes.length,nodeCount,'a long pour never allocates replacement loop sources');
  h.sound.update(undefined);assert.equal(long.stops.length,1);long.finish();
  h.sound.update(pour('water'));const next=h.context.pours[2];
  assert.deepEqual(next.startCalls,[[0,0]]);assert.notEqual(next,long);
});

test('rapid repeat pours fade independently and an old source ending cannot disconnect the new pour', async () => {
  const h=harness();await h.sound.setEnabled(true);await flush();
  h.sound.update(pour('water'));const first=h.context.pours[0],oldEnvelope=first.connections[0],filter=pourFilter(first);
  h.sound.update(pour('water',0));h.sound.update(pour('water'));
  const second=h.context.pours[1],newEnvelope=second.connections[0];
  assert.notEqual(first,second);assert.notEqual(oldEnvelope,newEnvelope);assert.equal(pourFilter(second),filter);
  assert.equal(oldEnvelope.gain.targets.at(-1).value,0,'reopening the channel does not reopen the retired source envelope');
  assert.equal(newEnvelope.gain.targets.at(-1).value,1);assert.equal(first.stops.length,1);
  first.finish();assert.equal(first.disconnections,1);assert.equal(oldEnvelope.disconnections,1);
  assert.equal(second.disconnections,0);assert.equal(newEnvelope.disconnections,0);assert.equal(filter.disconnections,0);
  h.sound.update(pour('water'));assert.equal(h.context.pours.length,2);assert.equal(second.stops.length,0);
});

test('silence, backgrounding, effects mute and master mute cancel recorded pours without late restarts', async () => {
  for(const stop of [h=>h.sound.silence(),h=>h.sound.pause(),h=>h.sound.update(pour('water'),{active:false}),h=>h.sound.setEffectsVolume(0),h=>h.sound.setEnabled(false)]){
    const h=harness();await h.sound.setEnabled(true);await flush();h.sound.update(pour('water'));
    const source=h.context.pours[0];await stop(h);allSilent(h.sound);
    assert.equal(source.stops.length,1);assert.ok(source.stops[0]<=h.context.currentTime+.1);
    source.finish();assert.equal(source.disconnections,1);
    const nodes=h.context.nodes.length;await flush();assert.equal(h.context.nodes.length,nodes);assert.equal(h.context.pours.length,1);
  }
});

test('ice alternates the two supplied recording takes at original speed, caps voices, and cleans finished nodes', async () => {
  const h = harness(); await h.sound.setEnabled(true); await flush();
  h.sound.update({}, { iceEvents: [ice(true), ice(false)] });
  assert.deepEqual(h.context.impacts.map(source=>source.buffer),h.iceRecordings);
  assert.deepEqual(h.synthesized.map(item=>item.kind),['cloud','whisk','scoop','sift'],'ice never creates a procedural substitute');
  assert.equal(h.sound.status.voices, 2);
  for (const source of h.context.impacts) {
    assert.equal(source.starts, 1);assert.equal(source.playbackRate.value,1); const gain = source.connections[0], pan = gain.connections[0];
    assert.ok(gain.gain.value > 0 && gain.gain.value < .5); assert.equal(pan.pan.value, .22, 'ice pan stays subtle');
  }
  h.sound.update({}, { iceEvents: Array.from({ length: 30 }, () => ice()) });
  assert.equal(h.sound.status.voices, 8); assert.equal(h.context.impacts.length, 8);
  const nodes = h.context.nodes.length;
  h.sound.update({}, { iceEvents: [ice()] }); assert.equal(h.context.nodes.length, nodes);
  const first = h.context.impacts[0], gain = first.connections[0], pan = gain.connections[0]; first.finish();
  assert.equal(h.sound.status.voices, 7); assert.equal(first.disconnections, 1); assert.equal(gain.disconnections, 1); assert.equal(pan.disconnections, 1);
  h.sound.update({}, { iceEvents: [ice()] }); assert.equal(h.sound.status.voices, 8, 'finished impacts release their pool slot');
});

test('a pending ice load drops old landings and completion only caches the recording',async()=>{
  let resolveLoad;
  const h=harness(new FakeContext(),{loadIceRecording:()=>new Promise(resolve=>{resolveLoad=resolve;})});
  await h.sound.setEnabled(true);await flush();assert.equal(h.sound.status.iceRecording,'loading');assert.equal(h.iceLoads.length,1);
  h.sound.update({}, {iceEvents:[ice(),ice(false)]});assert.equal(h.context.impacts.length,0);assert.equal(h.sound.status.voices,0);
  h.sound.silence();resolveLoad(h.iceRecordings);await flush();
  assert.equal(h.sound.status.iceRecording,'ready');assert.equal(h.context.impacts.length,0);assert.equal(h.sound.status.voices,0);
  h.sound.update({});assert.equal(h.context.impacts.length,0,'a later frame does not replay a landing missed during loading');
  h.sound.update({}, {iceEvents:[ice()]});assert.equal(h.context.impacts.length,1);assert.equal(h.context.impacts[0].buffer,h.iceRecordings[0]);
});

test('late ice loading cannot replay a batch after reset, backgrounding, inactive state, or either mute',async()=>{
  const stops=[h=>h.sound.silence(),h=>h.sound.pause(),h=>h.sound.update({}, {active:false}),h=>h.sound.setEffectsVolume(0),h=>h.sound.setEnabled(false)];
  for(const stop of stops){
    let resolveLoad;
    const h=harness(new FakeContext(),{loadIceRecording:()=>new Promise(resolve=>{resolveLoad=resolve;})});
    await h.sound.setEnabled(true);await flush();h.sound.update({}, {iceEvents:[ice()]});
    await stop(h);resolveLoad(h.iceRecordings);await flush();
    assert.equal(h.sound.status.iceRecording,'ready');assert.equal(h.context.impacts.length,0);allSilent(h.sound);
    h.sound.setEffectsVolume(.7);await h.sound.setEnabled(true);await flush();h.sound.update({});
    assert.equal(h.iceLoads.length,1);assert.equal(h.context.impacts.length,0,'resuming after cancellation cannot restart an old batch');
    h.sound.update({}, {iceEvents:[ice()]});assert.equal(h.context.impacts.length,1,'only a new live landing starts the cached take');
  }
});

test('repeated batches alternate cached takes and never reload, resynthesize, or change the recording pitch',async()=>{
  const h=harness();await h.sound.setEnabled(true);await flush();
  for(let batch=0;batch<10;batch++){
    h.sound.update({}, {iceEvents:[ice(batch%2===0)]});
    const source=h.context.impacts.at(-1);
    assert.equal(source.buffer,h.iceRecordings[batch%2]);assert.equal(source.playbackRate.value,1);assert.equal(source.loop,undefined);
    assert.equal(source.starts,1);assert.ok(Math.abs(source.connections[0].gain.value-.38*.8)<1e-10);
    assert.equal(h.sound.status.voices,1);source.finish();assert.equal(h.sound.status.voices,0);
  }
  await h.sound.setEnabled(false);await h.sound.setEnabled(true);await flush();
  assert.equal(h.iceLoads.length,1);assert.equal(h.context.impacts.length,10);
  assert.deepEqual(h.synthesized.map(item=>item.kind),['cloud','whisk','scoop','sift']);
});

test('pending enable requests share one ice load, and invalid or synchronously throwing loaders fail quietly',async()=>{
  let resolveLoad;
  const h=harness(new FakeContext(),{loadIceRecording:()=>new Promise(resolve=>{resolveLoad=resolve;})});
  await h.sound.setEnabled(true);await flush();await h.sound.setEnabled(true);await flush();
  assert.equal(h.iceLoads.length,1);assert.equal(h.sound.status.iceRecording,'loading');
  resolveLoad(h.iceRecordings);await flush();assert.equal(h.sound.status.iceRecording,'ready');assert.equal(h.context.impacts.length,0);
  for(const loadIceRecording of [()=>{throw new Error('Decoder unavailable');},()=>Promise.resolve([]),()=>Promise.resolve([null])]){
    const failure=harness(new FakeContext(),{loadIceRecording});
    assert.equal(await failure.sound.setEnabled(true),true);await flush();assert.equal(failure.sound.status.iceRecording,'failed');
    assert.doesNotThrow(()=>failure.sound.update({}, {iceEvents:[ice()]}));assert.equal(failure.context.impacts.length,0);
    assert.deepEqual(failure.synthesized.map(item=>item.kind),['cloud','whisk','scoop','sift']);
  }
});

test('inactive scenes and explicit silence fade loops and cancel existing ice without spawning new impacts', async () => {
  const h = harness(); await h.sound.setEnabled(true); await flush();
  h.sound.update(pour('serve'), { iceEvents: [ice()] });
  const first = h.context.impacts[0], firstGain = first.connections[0];
  h.sound.update(pour('milk'), { active: false, iceEvents: [ice()] });
  allSilent(h.sound); assert.equal(h.context.impacts.length, 1); assert.equal(firstGain.gain.value, 0);
  assert.equal(first.stops.length, 1); assert.ok(first.stops[0] > h.context.currentTime);
  h.sound.update({}, { active: false }); h.sound.silence(); assert.equal(first.stops.length, 1, 'repeated inactive frames do not repeatedly stop a voice');
  first.finish(); assert.equal(h.sound.status.voices, 0);
  h.sound.update(pour('cloud'), { iceEvents: [ice()] }); assert.ok(h.sound.status.levels.cloud > 0);
  h.sound.silence(); allSilent(h.sound); assert.equal(h.context.impacts[1].stops.length, 1);
});

test('mute cancels current action audio and ignores impacts until enabled again', async () => {
  const h = harness(); await h.sound.setEnabled(true); await flush();
  h.sound.update(pour('water'), { iceEvents: [ice()] });
  assert.equal(await h.sound.setEnabled(false), false); allSilent(h.sound);
  assert.equal(h.context.nodes[0].gain.value, 0, 'master is muted'); assert.equal(h.context.impacts[0].stops.length, 1);
  const nodes = h.context.nodes.length;
  h.sound.update(pour('water'), { iceEvents: [ice(), ice()] }); h.sound.resume();
  assert.equal(h.context.nodes.length, nodes); assert.equal(h.context.resumes, 1);
  h.context.impacts[0].finish(); assert.equal(h.sound.status.voices, 0);
  await h.sound.setEnabled(true); await flush(); h.sound.update(pour('milk')); assert.ok(h.sound.status.levels.milk > 0);
});

test('muting during a pending audio unlock wins over the older activation request', async () => {
  const h = harness(); let unlock;
  h.context.resume = function () { this.resumes++; return new Promise(resolve => { unlock = () => { this.state = 'running'; resolve(); }; }); };
  const pending = h.sound.setEnabled(true);
  assert.equal(await h.sound.setEnabled(false), false); unlock();
  assert.equal(await pending, false); assert.equal(h.sound.enabled, false); allSilent(h.sound);
  assert.equal(h.context.nodes[0].gain.value, 0);
  h.sound.update(pour('water'), { iceEvents: [ice()] }); assert.equal(h.context.impacts.length, 0);
});

test('an obsolete failed unlock cannot mute a newer successful enable request', async () => {
  const h = harness(); let rejectOld;
  h.context.resume = function () {
    this.resumes++;
    if(this.resumes === 1)return new Promise((resolve, reject) => { rejectOld = reject; });
    this.state = 'running'; return Promise.resolve();
  };
  const oldRequest = h.sound.setEnabled(true);
  await h.sound.setEnabled(false); assert.equal(await h.sound.setEnabled(true), true); await flush();
  h.sound.update(pour('milk')); assert.ok(h.sound.status.levels.milk > 0);
  rejectOld(new Error('Old gesture expired')); await oldRequest;
  assert.equal(h.sound.enabled, true); assert.ok(h.sound.status.levels.milk > 0);
});

test('unavailable audio and rejected unlocks fail quietly and remain silent', async () => {
  const unavailable = createSoundscape({ createContext: () => null });
  assert.equal(await unavailable.setEnabled(true), false); assert.equal(unavailable.enabled, false);
  assert.doesNotThrow(() => { unavailable.resume(); unavailable.update(pour('water')); unavailable.silence(); });
  const h = harness(); h.context.resume = () => Promise.reject(new Error('User gesture needed'));
  assert.equal(await h.sound.setEnabled(true), false); allSilent(h.sound);
  h.sound.update(pour('milk'), { iceEvents: [ice()] }); assert.equal(h.context.impacts.length, 0);
});

test('an interrupted context keeps the sound preference, silences failures, and recovers on retry', async () => {
  const h = harness(); await h.sound.setEnabled(true); await flush(); h.sound.update(pour('water'));
  h.context.state = 'suspended'; h.sound.update(pour('water')); allSilent(h.sound);
  h.sound.resume(); await flush(); assert.equal(h.context.resumes, 2); assert.equal(h.context.state, 'running');
  h.sound.update(pour('water'), { iceEvents: [ice()] }); assert.ok(h.sound.status.levels.water > 0);
  h.context.state = 'suspended'; h.context.resume = () => Promise.reject(new Error('Interrupted'));
  assert.doesNotThrow(() => h.sound.resume()); await flush();
  assert.equal(h.sound.enabled, true, 'temporary device failure preserves the user preference'); allSilent(h.sound); assert.equal(h.context.impacts[0].stops.length, 1);
  h.context.resume = FakeContext.prototype.resume;
  h.sound.resume(); await flush(); assert.equal(h.context.state, 'running');
  h.sound.update(pour('milk')); assert.ok(h.sound.status.levels.milk > 0, 'a later user gesture can recover audio');
});

test('a context whose resume throws synchronously also fails quietly', async () => {
  const h = harness(); await h.sound.setEnabled(true); await flush(); h.sound.update(pour('water'));
  h.context.state = 'suspended'; h.context.resume = () => { throw new Error('Audio device unavailable'); };
  assert.doesNotThrow(() => h.sound.resume()); await flush();
  assert.equal(h.sound.enabled, true, 'temporary device failure preserves the user preference'); allSilent(h.sound);
  h.context.resume = FakeContext.prototype.resume;
  h.sound.resume(); await flush(); assert.equal(h.context.state, 'running');
  h.sound.update(pour('water')); assert.ok(h.sound.status.levels.water > 0);
});

function musicHarness(context = new FakeContext(),{loadIceRecording}={}) {
  const calls={contexts:0,players:[],volumes:[],updates:[],silences:0,iceLoads:[]},iceRecordings=iceBuffers(context);
  const sound=createSoundscape({
    createContext:()=>{calls.contexts++;return context;},
    synthesize:()=>new Float32Array([.1,-.1,.05,0]),
    loadPourRecording:()=>Promise.resolve(pourBuffer(context)),
    loadIceRecording:ctx=>{calls.iceLoads.push(ctx);return loadIceRecording?loadIceRecording(ctx):Promise.resolve(iceRecordings);},
    createMusic:(ctx,output)=>{
      let volume=0,playing=false;
      const player={
        setVolume:value=>{volume=value;calls.volumes.push(value);},
        update:options=>{calls.updates.push({...options});playing=options.active&&volume>0;},
        silence:()=>{playing=false;calls.silences++;},
        get status(){return {playing,volume,position:0,voices:playing?2:0};}
      };
      calls.players.push({ctx,output,player});return player;
    }
  });
  return {sound,context,calls,iceRecordings};
}

test('an ice recording failure leaves pouring and music working and retries only on a later enable',async()=>{
  let attempts=0,takes;
  const h=musicHarness(new FakeContext(),{loadIceRecording:()=>++attempts===1?Promise.reject(new Error('Ice decode failed')):Promise.resolve(takes)});
  takes=h.iceRecordings;h.sound.setMusicVolume(.4);await h.sound.setEnabled(true);await flush();
  assert.equal(h.sound.enabled,true);assert.equal(h.sound.status.iceRecording,'failed');assert.equal(h.sound.status.recording,'ready');
  h.sound.update(pour('water'),{iceEvents:[ice()]});assert.ok(h.sound.status.levels.water>0);assert.equal(h.sound.status.music.playing,true);assert.equal(h.context.impacts.length,0);
  h.sound.update({whisk:{intensity:1}});assert.ok(h.sound.status.levels.whisk>0);assert.equal(h.sound.status.music.playing,true);
  h.sound.update(powder(1,1));assert.ok(h.sound.status.levels.scoop>0&&h.sound.status.levels.sift>0);
  assert.equal(h.calls.iceLoads.length,1,'normal render frames do not repeatedly retry a failed download');
  await h.sound.setEnabled(true);await flush();
  assert.equal(h.calls.iceLoads.length,2);assert.equal(h.sound.status.iceRecording,'ready');assert.equal(h.context.impacts.length,0,'successful retry does not replay the old batch');
  h.sound.update({}, {iceEvents:[ice()]});assert.equal(h.context.impacts.length,1);assert.equal(h.context.impacts[0].buffer,takes[0]);assert.equal(h.sound.status.music.playing,true);
});

test('powder effects follow the effects slider while music volume and playback remain independent', async () => {
  const h=musicHarness();h.sound.setMusicVolume(.4);await h.sound.setEnabled(true);await flush();
  h.sound.update(powder(1,.5));
  const scoop=h.sound.status.levels.scoop,sift=h.sound.status.levels.sift,musicSilences=h.calls.silences;
  assert.ok(scoop>0&&sift>0);assert.equal(h.sound.status.music.playing,true);
  h.sound.setEffectsVolume(0);allSilent(h.sound);assert.equal(h.sound.status.music.playing,true);assert.equal(h.calls.silences,musicSilences);
  const nodes=h.context.nodes.length;
  h.sound.update(powder(1,1));allSilent(h.sound);assert.equal(h.context.nodes.length,nodes);assert.equal(h.sound.status.music.volume,.4);
  h.sound.setEffectsVolume(.35);h.sound.update(powder(1,.5));
  assert.equal(h.sound.status.levels.scoop,scoop);assert.equal(h.sound.status.levels.sift,sift);assert.equal(h.context.nodes[0].gain.value,.25);
  h.sound.setMusicVolume(0);assert.equal(h.sound.status.music.playing,false);
  assert.equal(h.sound.status.levels.scoop,scoop);assert.equal(h.sound.status.levels.sift,sift);assert.equal(h.sound.status.effectsVolume,.35);
  h.sound.setMusicVolume(.55);h.sound.update(powder(1,.5));assert.equal(h.sound.status.music.playing,true);assert.equal(h.sound.status.music.volume,.55);
  assert.equal(h.context.nodes.length,nodes,'the two sliders reuse the existing audio graph');
});

test('reset silence and inactive actions fade powder phases while background pause also stops music', async () => {
  const h=musicHarness();h.sound.setMusicVolume(.4);await h.sound.setEnabled(true);await flush();
  h.sound.update(powder(1,1));const nodes=h.context.nodes.length,silences=h.calls.silences;
  h.sound.silence();allSilent(h.sound);assert.equal(h.sound.status.music.playing,true);assert.equal(h.calls.silences,silences);
  h.sound.update({selected:'scoop'});allSilent(h.sound);
  h.sound.update(powder(1,1),{active:false,musicActive:true});allSilent(h.sound);assert.equal(h.sound.status.music.playing,true);
  h.sound.update(powder(1,1));assert.ok(h.sound.status.levels.scoop>0&&h.sound.status.levels.sift>0);
  h.sound.pause();allSilent(h.sound);assert.equal(h.sound.status.music.playing,false);
  h.context.state='suspended';h.sound.update(powder(1,1),{musicActive:true});allSilent(h.sound);assert.equal(h.sound.status.music.playing,false);
  h.sound.resume();await flush();h.sound.update(powder(1,1));
  assert.ok(h.sound.status.levels.scoop>0&&h.sound.status.levels.sift>0);assert.equal(h.sound.status.music.playing,true);
  assert.equal(h.context.nodes.length,nodes);assert.equal(h.context.sources.length,4);
});

test('master mute suppresses powder phases until enabled again without restarting procedural sources', async () => {
  const h=musicHarness();h.sound.setMusicVolume(.4);await h.sound.setEnabled(true);await flush();
  h.sound.update(powder(1,1));assert.ok(h.sound.status.levels.scoop>0&&h.sound.status.levels.sift>0);
  await h.sound.setEnabled(false);allSilent(h.sound);assert.equal(h.sound.status.music.playing,false);
  const nodes=h.context.nodes.length,updates=h.calls.updates.length;
  h.sound.update(powder(1,1));allSilent(h.sound);assert.equal(h.calls.updates.length,updates);assert.equal(h.context.nodes.length,nodes);
  await h.sound.setEnabled(true);await flush();allSilent(h.sound);
  h.sound.update(powder(.4,.8));assert.ok(h.sound.status.levels.scoop>0&&h.sound.status.levels.sift>0);assert.equal(h.sound.status.music.playing,true);
  assert.equal(h.context.nodes.length,nodes);assert.ok(h.context.procedural.every(source=>source.starts===1&&source.stops.length===0));
});

test('volume settings stay lazy and music uses a separate destination route', async () => {
  const h=musicHarness();
  assert.equal(h.sound.status.effectsVolume,.7);assert.equal(h.sound.status.musicVolume,0);
  h.sound.setMusicVolume(.42);h.sound.setEffectsVolume(.35);
  assert.equal(h.calls.contexts,0);assert.equal(h.calls.players.length,0);
  assert.equal(h.sound.status.effectsVolume,.35);assert.equal(h.sound.status.musicVolume,.42);
  await h.sound.setEnabled(true); await flush();
  assert.equal(h.calls.players.length,1);assert.equal(h.calls.players[0].ctx,h.context);
  const output=h.calls.players[0].output,compressor=h.context.nodes.find(node=>node.nodeType==='compressor');
  assert.deepEqual(output.connections,[h.context.destination],'music bypasses the effects master and compressor');
  assert.ok(!compressor.connections.includes(output));assert.ok(!output.connections.includes(compressor));
  assert.equal(h.context.nodes[0].gain.value,.25,'effects slider scales its own master independently');
  assert.equal(h.sound.status.music.volume,.42);
  h.sound.update({}, {active:false,musicActive:true});assert.equal(h.sound.status.music.playing,true);
});

test('default music stays uncreated and later volume edits reuse one independent player', async () => {
  const h=musicHarness();await h.sound.setEnabled(true); await flush();
  assert.equal(h.calls.players.length,0);assert.equal(h.sound.status.music.playing,false);
  h.sound.update(pour('water'));const effectLevel=h.sound.status.levels.water,master=h.context.nodes[0];
  h.sound.setMusicVolume(.2);assert.equal(h.calls.players.length,1);
  const nodeCount=h.context.nodes.length;
  h.sound.setMusicVolume(.6);h.sound.setMusicVolume(.3);
  assert.equal(h.calls.players.length,1);assert.equal(h.context.nodes.length,nodeCount);
  assert.equal(h.sound.status.levels.water,effectLevel);assert.equal(master.gain.value,.5);
  h.sound.update(pour('water'),{musicActive:true});assert.equal(h.sound.status.music.playing,true);
  assert.equal(h.sound.status.music.volume,.3);
});

test('zero effects volume cancels impacts and suppresses channels while music continues', async () => {
  const h=musicHarness();h.sound.setMusicVolume(.4);await h.sound.setEnabled(true); await flush();
  h.sound.update(pour('water'),{iceEvents:[ice()]});assert.equal(h.sound.status.music.playing,true);
  const impact=h.context.impacts[0],silences=h.calls.silences;
  h.sound.setEffectsVolume(0);allSilent(h.sound);assert.equal(impact.stops.length,1);
  assert.equal(h.context.nodes[0].gain.value,0);assert.equal(h.sound.status.music.playing,true);
  assert.equal(h.calls.silences,silences);assert.equal(h.sound.status.musicVolume,.4);
  const nodeCount=h.context.nodes.length;
  h.sound.update({whisk:{intensity:1,foam:.8,speed:1}},{iceEvents:[ice(),ice()]});
  allSilent(h.sound);assert.equal(h.context.nodes.length,nodeCount);assert.equal(h.context.impacts.length,1);
  assert.equal(h.sound.status.music.playing,true);impact.finish();
  h.sound.setEffectsVolume(.35);h.sound.update(pour('milk'),{iceEvents:[ice(false)]});
  assert.ok(h.sound.status.levels.milk>0);assert.equal(h.context.impacts.length,2);
  assert.equal(h.context.nodes[0].gain.value,.25);assert.equal(h.sound.status.music.volume,.4);
});

test('zero music volume silences only music and keeps pouring effects active', async () => {
  const h=musicHarness();h.sound.setMusicVolume(.5);await h.sound.setEnabled(true); await flush();
  h.sound.update(pour('serve'));const effectLevel=h.sound.status.levels.serve,masterLevel=h.context.nodes[0].gain.value;
  h.sound.setMusicVolume(0);
  assert.equal(h.sound.status.music.playing,false);assert.equal(h.sound.status.music.volume,0);
  assert.equal(h.sound.status.levels.serve,effectLevel);assert.equal(h.context.nodes[0].gain.value,masterLevel);
  assert.equal(h.sound.status.effectsVolume,.7);
  h.sound.update(pour('serve'),{musicActive:true});assert.equal(h.calls.updates.at(-1).active,false);
  assert.equal(h.sound.status.music.playing,false);assert.equal(h.sound.status.levels.serve,effectLevel);
  h.sound.setMusicVolume(.45);h.sound.update(pour('serve'));
  assert.equal(h.calls.players.length,1);assert.equal(h.sound.status.music.playing,true);
});

test('musicActive and action activity can be controlled independently', async () => {
  const h=musicHarness();h.sound.setMusicVolume(.4);await h.sound.setEnabled(true); await flush();
  h.sound.update(pour('water'),{active:false,musicActive:true,iceEvents:[ice()]});
  allSilent(h.sound);assert.equal(h.context.impacts.length,0);assert.equal(h.sound.status.music.playing,true);
  h.sound.update(pour('milk'),{active:true,musicActive:false});
  assert.ok(h.sound.status.levels.milk>0);assert.equal(h.sound.status.music.playing,false);
  h.sound.update(pour('milk'),{active:false});allSilent(h.sound);assert.equal(h.sound.status.music.playing,false);
  h.sound.update(pour('milk'));assert.equal(h.sound.status.music.playing,true);
});

test('action silence preserves music, while pause silences both and permits context recovery', async () => {
  const h=musicHarness();h.sound.setMusicVolume(.5);await h.sound.setEnabled(true); await flush();
  h.sound.update(pour('water'),{iceEvents:[ice()]});const musicSilences=h.calls.silences;
  h.sound.silence();allSilent(h.sound);assert.equal(h.context.impacts[0].stops.length,1);
  assert.equal(h.sound.status.music.playing,true);assert.equal(h.calls.silences,musicSilences);
  h.sound.update(pour('milk'));h.sound.pause();allSilent(h.sound);
  assert.equal(h.sound.status.music.playing,false);assert.equal(h.calls.silences,musicSilences+1);
  assert.equal(h.sound.enabled,true);assert.equal(h.sound.status.musicVolume,.5);assert.equal(h.sound.status.effectsVolume,.7);
  h.context.state='suspended';h.sound.update(pour('milk'),{musicActive:true});
  allSilent(h.sound);assert.equal(h.sound.status.music.playing,false);
  h.sound.resume();await flush();h.sound.update(pour('milk'),{musicActive:true});
  assert.ok(h.sound.status.levels.milk>0);assert.equal(h.sound.status.music.playing,true);
  assert.equal(h.calls.players.length,1);
});

test('master mute silences both routes and an obsolete enable cannot restart music', async () => {
  const h=musicHarness();let unlock;
  h.sound.setMusicVolume(.4);
  h.context.resume=function(){this.resumes++;return new Promise(resolve=>{unlock=()=>{this.state='running';resolve();};});};
  const pending=h.sound.setEnabled(true);assert.equal(h.calls.players.length,1);
  await h.sound.setEnabled(false);unlock();assert.equal(await pending,false);
  const updates=h.calls.updates.length;
  h.sound.update(pour('water'),{musicActive:true,iceEvents:[ice()]});
  allSilent(h.sound);assert.equal(h.sound.status.music.playing,false);assert.equal(h.calls.updates.length,updates);assert.equal(h.context.impacts.length,0);
  h.context.resume=FakeContext.prototype.resume;await h.sound.setEnabled(true); await flush();
  h.sound.update(pour('water'));assert.ok(h.sound.status.levels.water>0);assert.equal(h.sound.status.music.playing,true);
  await h.sound.setEnabled(false);allSilent(h.sound);assert.equal(h.sound.status.music.playing,false);
  assert.equal(h.sound.status.musicVolume,.4);assert.equal(h.sound.status.effectsVolume,.7);
});

test('each slider clamps invalid values without changing the other volume', async () => {
  const h=musicHarness();
  h.sound.setEffectsVolume(-2);assert.equal(h.sound.status.effectsVolume,0);assert.equal(h.sound.status.musicVolume,0);
  h.sound.setMusicVolume(2);assert.equal(h.sound.status.musicVolume,1);assert.equal(h.sound.status.effectsVolume,0);
  h.sound.setEffectsVolume(2);assert.equal(h.sound.status.effectsVolume,1);assert.equal(h.sound.status.musicVolume,1);
  h.sound.setMusicVolume(Number.NaN);assert.equal(h.sound.status.musicVolume,0);assert.equal(h.sound.status.effectsVolume,1);
  h.sound.setEffectsVolume(Number.POSITIVE_INFINITY);assert.equal(h.sound.status.effectsVolume,0);assert.equal(h.calls.contexts,0);
});
