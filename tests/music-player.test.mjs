import assert from 'node:assert/strict';
import test from 'node:test';
import { createMusicPlayer, MUSIC_SCORE } from '../dist/music-player.js';

class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  cancelScheduledValues(time) { this.events.push({ type: 'cancel', time }); }
  setValueAtTime(value, time) { this.events.push({ type: 'set', value, time }); }
  linearRampToValueAtTime(value, time) { this.events.push({ type: 'linear', value, time }); }
  exponentialRampToValueAtTime(value, time) { this.events.push({ type: 'exponential', value, time }); }
  setTargetAtTime(value, time, seconds) { this.events.push({ type: 'target', value, time, seconds }); }
}
class FakeNode {
  constructor(kind) {
    this.kind = kind; this.connections = []; this.disconnections = 0; this.starts = []; this.stops = [];
    for (const key of ['gain', 'frequency', 'Q', 'pan', 'detune', 'delayTime']) this[key] = new FakeParam();
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; this.disconnections++; }
  start(time) { this.starts.push(time); }
  stop(time) { this.stops.push(time); this.end = time; }
  finish() { if (this.finished) return; this.finished = true; this.onended?.(); }
}
class FakeContext {
  constructor({ room = true, pan = true } = {}) {
    this.state = 'running'; this.currentTime = 10; this.nodes = [];
    if (!room) this.createDelay = undefined;
    if (!pan) this.createStereoPanner = undefined;
  }
  node(kind) { const node = new FakeNode(kind); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createOscillator() { return this.node('oscillator'); }
  createBiquadFilter() { return this.node('filter'); }
  createStereoPanner() { return this.node('panner'); }
  createDelay() { return this.node('delay'); }
  advance(seconds) {
    this.currentTime += seconds;
    for (const node of this.sources) if (node.end <= this.currentTime) node.finish();
  }
  get sources() { return this.nodes.filter(node => node.kind === 'oscillator'); }
  get live() { return this.nodes.filter(node => !node.disconnections); }
}
function harness(options) {
  const context = new FakeContext(options), output = {}, music = createMusicPlayer(context, output);
  return { context, music, output, master: context.nodes[0] };
}
function tick(h, seconds, interval = 1 / 60) {
  for (let time = 0; time < seconds - 1e-8; time += interval) { h.context.advance(Math.min(interval, seconds - time)); h.music.update(); }
}

test('the original score is a sparse, immutable minute of gentle pentatonic melody with overlapping harmony', () => {
  assert.equal(MUSIC_SCORE.title, 'Senja di Meja Matcha');
  assert.equal(MUSIC_SCORE.bpm, 62); assert.equal(MUSIC_SCORE.beats, 64);
  assert.ok(MUSIC_SCORE.duration > 60 && MUSIC_SCORE.duration < 64);
  assert.ok(Object.isFrozen(MUSIC_SCORE) && Object.isFrozen(MUSIC_SCORE.events));
  const pads = MUSIC_SCORE.events.filter(event => event.kind === 'pad'), notes = MUSIC_SCORE.events.filter(event => event.kind === 'piano');
  assert.equal(pads.length, 8); assert.ok(notes.length > 28 && notes.length < 40);
  assert.ok(notes.every(event => event.notes.length === 1 && [60, 62, 64, 67, 69, 72].includes(event.notes[0])));
  assert.ok(pads.every(event => event.notes.length === 4 && event.notes.every(note => note >= 41 && note <= 64)));
  for (let i = 1; i < MUSIC_SCORE.events.length; i++) assert.ok(MUSIC_SCORE.events[i].time >= MUSIC_SCORE.events[i - 1].time);
  for (const event of MUSIC_SCORE.events) {
    assert.ok(Object.isFrozen(event) && Object.isFrozen(event.notes));
    assert.ok(event.velocity > .25 && event.velocity < .9 && event.duration > 4);
    assert.ok(event.time >= 0 && event.time < MUSIC_SCORE.duration);
  }
  assert.ok(pads.at(-1).time + pads.at(-1).duration > MUSIC_SCORE.duration + 2, 'the final harmony releases across the loop boundary');
  assert.throws(() => { MUSIC_SCORE.events[0].notes[0] = 100; }, TypeError);
});

test('music owns a separate smoothed gain and creates notes only when their onset approaches', () => {
  const h = harness();
  assert.equal(h.music.status.volume, .30); assert.equal(h.music.status.playing, false); assert.equal(h.context.sources.length, 0);
  assert.deepEqual(h.master.connections, [h.output]); assert.equal(h.master.gain.value, 0);
  h.music.update();
  assert.equal(h.music.status.playing, true); assert.equal(h.music.status.voices, 1);
  assert.equal(h.context.sources.length, 4, 'a single low chord is the first event');
  assert.ok(h.context.sources.every(source => source.starts[0] > h.context.currentTime && source.starts[0] < h.context.currentTime + .25));
  const nodes = h.context.nodes.length;
  for (let frame = 0; frame < 120; frame++) h.music.update();
  tick(h, .18); assert.equal(h.context.nodes.length, nodes, 'no nodes are allocated by render frames between score events');
  h.music.setVolume(.72);
  const change = h.master.gain.events.at(-1);
  assert.equal(change.type, 'target'); assert.equal(change.value, .72); assert.ok(change.seconds >= .08);
  assert.equal(h.music.status.voices, 1, 'changing the volume does not recreate notes');
  assert.equal(h.music.setVolume(4), 1); assert.equal(h.music.setVolume(-1), 0);
});

test('piano has detuned, decaying inharmonic partials, a rounded attack, restrained pan and a warm filter', () => {
  const h = harness(); h.music.update(); tick(h, .5);
  const piano = h.context.sources.slice(4);
  assert.equal(piano.length, 3); assert.ok(piano.every(source => source.type === 'sine'));
  assert.ok(Math.abs(piano[1].frequency.value / piano[0].frequency.value - 2.002) < 1e-10);
  assert.ok(Math.abs(piano[2].frequency.value / piano[0].frequency.value - 3.008) < 1e-10);
  const partial = piano[1].connections[0], gain = partial.connections[0], filter = gain.connections[0], pan = filter.connections[0];
  assert.ok(partial.gain.events.some(event => event.type === 'target' && event.seconds < .5));
  assert.ok(gain.gain.events.some(event => event.type === 'linear' && event.value > 0 && event.value < .07));
  assert.ok(gain.gain.events.filter(event => event.type === 'exponential').length >= 5);
  assert.equal(filter.type, 'lowpass'); assert.ok(filter.frequency.value <= 2100);
  assert.ok(Math.abs(pan.pan.value) < .2);
  assert.ok(piano.every(source => source.stops[0] > source.starts[0] + 4));
});

test('silencing fades active voices, cancels future attacks, freezes the phrase and resumes its existing tails', () => {
  const h = harness(); h.music.update(); tick(h, 6.2);
  const position = h.music.status.position, old = [...h.context.sources];
  h.music.silence(); assert.equal(h.music.status.playing, false); assert.equal(h.master.gain.events.at(-1).value, 0);
  const stops = old.reduce((count, source) => count + source.stops.length, 0);
  h.music.silence(); assert.equal(old.reduce((count, source) => count + source.stops.length, 0), stops, 'repeated inactive frames do not repeatedly stop voices');
  h.context.advance(40);
  assert.equal(h.music.status.position, position); assert.equal(h.music.status.voices, 0);
  assert.ok(old.every(source => source.disconnections === 1));
  const nodes = h.context.nodes.length;
  h.music.update({ active: false }); assert.equal(h.context.nodes.length, nodes);
  h.music.update();
  assert.ok(h.music.status.playing); assert.equal(h.music.status.position, position);
  const restored = h.context.sources.slice(old.length);
  assert.ok(restored.length > 0 && restored.length <= 16, `only a small number of sounding tails are restored (${restored.length} oscillators)`);
  assert.ok(restored.every(source => source.starts[0] >= h.context.currentTime && source.starts[0] <= h.context.currentTime + .25));
  const pianoTail = restored.find(source => source.type === 'sine');
  assert.ok(pianoTail, 'a decaying piano note remains in the phrase');
  const gain = pianoTail.connections[0].connections[0];
  const restoredPeak = Math.max(...gain.gain.events.filter(event => Number.isFinite(event.value)).map(event => event.value));
  assert.ok(restoredPeak < .04, 'restoring a tail does not replay its original loud attack');
  tick(h, .3); assert.ok(Math.abs(h.music.status.position - (position + .275)) < .02);
});

test('muting and a suspended context pause safely and preserve music volume independently of any other output', () => {
  const h = harness(); const unrelated = h.context.createGain(); unrelated.gain.value = .63;
  h.music.update(); tick(h, 1.2); h.music.setVolume(0);
  const position = h.music.status.position;
  h.context.advance(3); h.music.update();
  assert.equal(h.music.status.playing, false); assert.equal(h.music.status.position, position); assert.equal(unrelated.gain.value, .63);
  h.music.setVolume(.21); h.music.update(); assert.ok(h.music.status.playing); assert.equal(h.music.status.volume, .21);
  h.context.state = 'suspended'; h.music.update(); assert.equal(h.music.status.playing, false);
  const paused = h.music.status.position; h.context.advance(2); h.music.update(); assert.equal(h.music.status.position, paused);
  h.context.state = 'running'; h.music.update(); assert.ok(h.music.status.playing); assert.equal(h.music.status.volume, .21);
  h.music.setVolume(Number.NaN); assert.equal(h.music.status.volume, 0); assert.equal(h.music.status.playing, false);
});

test('a long frame skips missed attacks instead of scheduling a replay burst', () => {
  const h = harness(); h.music.update(); tick(h, .4);
  h.context.advance(28.1);
  const sources = h.context.sources.length, scheduled = h.music.status.scheduled;
  h.music.update();
  const newSources = h.context.sources.slice(sources);
  assert.ok(h.music.status.scheduled - scheduled <= 1, 'only a note actually due in the lookahead may be scheduled');
  assert.ok(newSources.every(source => source.starts[0] >= h.context.currentTime && source.starts[0] <= h.context.currentTime + .25));
  tick(h, 4); assert.ok(h.music.status.scheduled > scheduled, 'ordinary scheduling continues after a throttled frame');
});

test('several complete phrases keep voices and live nodes bounded, overlap the loop, and clean every ended oscillator', () => {
  const h = harness(); h.music.update(); let maxVoices = 0, maxNodes = 0;
  const seconds = MUSIC_SCORE.duration * 4 + 2;
  for (let time = 0; time < seconds; time += .04) {
    h.context.advance(.04); h.music.update();
    maxVoices = Math.max(maxVoices, h.music.status.voices); maxNodes = Math.max(maxNodes, h.context.live.length);
  }
  assert.ok(maxVoices <= 8, `bounded event voices: ${maxVoices}`); assert.ok(maxNodes < 90, `bounded live graph: ${maxNodes}`);
  assert.ok(h.music.status.scheduled >= MUSIC_SCORE.events.length * 4);
  assert.ok(h.context.sources.filter(source => source.finished).every(source => source.disconnections === 1));
  const paused = h.music.status.position; h.music.silence(); h.context.advance(.2);
  assert.equal(h.music.status.voices, 0); assert.equal(h.music.status.position, paused);
  assert.ok(h.context.sources.every(source => source.finished && source.disconnections === 1));
  assert.equal(h.context.live.length, 6, 'only the fixed output and quiet room graph remain connected');
});

test('the player works with the gain fallback when a browser omits stereo pan or delay', () => {
  const h = harness({ room: false, pan: false });
  assert.doesNotThrow(() => { h.music.update(); tick(h, 2); h.music.setVolume(.4); h.music.silence(); });
  h.context.advance(.2); assert.equal(h.music.status.voices, 0); assert.equal(h.context.live.length, 2);
  const status = h.music.status; status.volume = 100; assert.equal(h.music.status.volume, .4);
});
