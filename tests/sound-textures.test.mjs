import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { synthesizeSound } from '../dist/sound-textures.js';

const loops = ['water', 'milk', 'serve', 'cloud', 'whisk', 'scoop', 'sift'];
const kinds = [...loops, 'iceDry', 'iceWet'];
const rms = pcm => Math.sqrt(pcm.reduce((sum, sample) => sum + sample * sample, 0) / pcm.length);
const peak = pcm => pcm.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
const energy = pcm => pcm.reduce((sum, sample) => sum + sample * sample, 0);
const distance = (a, b) => rms(a.map((sample, i) => sample - b[i]));
const started = performance.now();
const takes = Object.fromEntries(kinds.map(kind => [kind, synthesizeSound(kind)]));

for (const kind of kinds) {
  const pcm = takes[kind];
  assert.ok(pcm instanceof Float32Array);
  assert.equal(pcm.length, Math.round((loops.includes(kind) ? 5.6 : .8) * 44100));
  assert.ok(pcm.every(Number.isFinite), `${kind}: finite PCM`);
  assert.ok(rms(pcm) >= .115 && rms(pcm) < .18, `${kind}: comfortable signal level (${rms(pcm)})`);
  assert.ok(peak(pcm) < .9, `${kind}: bounded peaks`);
  assert.deepEqual(pcm, synthesizeSound(kind), `${kind}: repeatable take`);
  assert.ok(distance(pcm, synthesizeSound(kind, { seed: 721 })) > .07, `${kind}: different take with another seed`);
  if (loops.includes(kind)) {
    const steps = [];
    for (let i = 1; i < pcm.length; i++) steps.push(Math.abs(pcm[i] - pcm[i - 1]));
    steps.sort((a, b) => a - b);
    assert.ok(Math.abs(pcm[0] - pcm.at(-1)) < steps[Math.floor(steps.length * .99)], `${kind}: wrap is within normal sample movement`);
    const head = rms(pcm.slice(0, 441)), tail = rms(pcm.slice(-441));
    assert.ok(tail > head * .35 && tail < head * 2.8, `${kind}: no silent or boosted loop boundary`);
  } else {
    assert.ok(pcm.slice(-Math.floor(.08 * 44100)).every(sample => sample === 0), `${kind}: silent end for clean retrigger`);
    assert.ok(energy(pcm.slice(0, Math.floor(.4 * 44100))) > energy(pcm) * .9, `${kind}: an impact, not a sustained ring`);
  }
}

// Each material has a distinct texture, and creamier pours carry less treble.
const roughness = pcm => rms(pcm.slice(1).map((sample, i) => sample - pcm[i])) / rms(pcm);
assert.ok(roughness(takes.cloud) < roughness(takes.water));
assert.ok(roughness(takes.milk) < roughness(takes.water));
assert.ok(distance(takes.water, takes.serve) > .1);
assert.ok(distance(takes.iceDry, takes.iceWet) > .08);

// A whisk has audible strokes rather than a uniform stationary noise bed.
const windows = Array.from({ length: 112 }, (_, i) => rms(takes.whisk.slice(i * 2205, (i + 1) * 2205)));
assert.ok(Math.max(...windows) / Math.min(...windows) > 2, 'whisk has distinct soft and strong strokes');

// Powder remains a soft, dry friction sound, with no isolated ice-like attack.
for (const kind of ['scoop', 'sift']) {
  const pcm = takes[kind];
  assert.ok(peak(pcm.slice(0, 882)) < .62, `${kind}: soft initial texture`);
  assert.ok(Math.abs(pcm.reduce((sum, sample) => sum + sample, 0) / pcm.length) < .002, `${kind}: no DC offset`);
  assert.ok(peak(pcm) / rms(pcm) < peak(takes.iceDry) / rms(takes.iceDry), `${kind}: no hard clink transient`);
  assert.ok(distance(pcm, takes.whisk) > .1, `${kind}: distinct from wet bamboo swishes`);
  assert.ok(roughness(pcm) < roughness(takes.water), `${kind}: no bright upper edge`);
}
assert.ok(distance(takes.scoop, takes.sift) > .1, 'scooping and sifting are separate textures');

// The small amplitude flutters sound like shaking a sieve rather than whisking.
const sieveEnvelope = Array.from({ length: 560 }, (_, i) => rms(takes.sift.slice(i * 441, (i + 1) * 441)));
const modulationAt = frequency => {
  const mean = sieveEnvelope.reduce((sum, sample) => sum + sample, 0) / sieveEnvelope.length;
  let real = 0, imaginary = 0;
  for (let i = 0; i < sieveEnvelope.length; i++) {
    real += (sieveEnvelope[i] - mean) * Math.cos(2 * Math.PI * frequency * i / 100);
    imaginary += (sieveEnvelope[i] - mean) * Math.sin(2 * Math.PI * frequency * i / 100);
  }
  return Math.hypot(real, imaginary);
};
assert.ok(modulationAt(5.5) > modulationAt(2.85) * 3, 'sieve has a fine flutter, separate from slower whisk strokes');

for (const sampleRate of [8000, 48000, 96000]) {
  for (const kind of ['milk', 'iceWet', 'scoop', 'sift']) {
    const pcm = synthesizeSound(kind, { sampleRate, duration: .3, seed: 0 });
    assert.equal(pcm.length, Math.round(sampleRate * .3));
    assert.ok(pcm.every(Number.isFinite));
    assert.ok(peak(pcm) < .9);
  }
}
assert.throws(() => synthesizeSound('unknown'), RangeError);
assert.throws(() => synthesizeSound('water', { sampleRate: 0 }), RangeError);
assert.throws(() => synthesizeSound('water', { duration: Infinity }), RangeError);
assert.throws(() => synthesizeSound('water', { seed: NaN }), RangeError);
console.log('Sound textures: deterministic PCM, distinct materials, stroke/flutter dynamics, soft powder friction, loop boundaries, clean ice tails, levels and alternate sample rates passed.');
console.log(Object.fromEntries(kinds.map(kind => [kind, { rms: +rms(takes[kind]).toFixed(3), peak: +peak(takes[kind]).toFixed(3), roughness: +roughness(takes[kind]).toFixed(3) }])));
console.log(`Nine default textures + validation generated in ${Math.round(performance.now() - started)} ms.`);
