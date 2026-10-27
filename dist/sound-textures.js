// Small, deterministic acoustic textures. These are generated once and cached by
// the audio engine; playback does not allocate or synthesize inside an audio node.
const LOOPS = new Set(['water', 'milk', 'serve', 'cloud', 'whisk', 'scoop', 'sift']);
const IMPACTS = new Set(['iceDry', 'iceWet']);
const TAU = Math.PI * 2;

function randomSource(seed, kind) {
  let value = seed >>> 0;
  for (let i = 0; i < kind.length; i++) value = Math.imul(value ^ kind.charCodeAt(i), 16777619) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let x = Math.imul(value ^ value >>> 15, value | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

const pole = (frequency, sampleRate) => 1 - Math.exp(-TAU * Math.min(frequency, sampleRate * .43) / sampleRate);

function liquidBed(pcm, sampleRate, random, kind) {
  const creamy = kind === 'cloud' ? 1 : kind === 'milk' ? .72 : kind === 'serve' ? .35 : 0;
  const whisk = kind === 'whisk';
  const aLow = pole(125 - creamy * 35, sampleRate);
  const aMid = pole(whisk ? 1100 : 1700 - creamy * 750, sampleRate);
  const aFine = pole(whisk ? 3800 : 3300 - creamy * 1600, sampleRate);
  const aMotion = pole(7, sampleRate), aBody = pole(27, sampleRate);
  let low = 0, mid = 0, fine = 0, motion = 0, body = 0, sweep = random() * TAU;
  for (let i = 0; i < pcm.length; i++) {
    const noise = random() * 2 - 1;
    low += aLow * (noise - low);
    mid += aMid * (noise - mid);
    fine += aFine * (noise - fine);
    motion += aMotion * (random() * 2 - 1 - motion);
    body += aBody * (noise - body);
    // The low gurgle and broad, soft splash carry the sound. Very little energy
    // reaches the upper band, so a held pour never becomes a bright hiss.
    const texture = low * .55 + (mid - low) * .48 + (fine - mid) * (whisk ? .12 : .055) + body * .25;
    if (whisk) {
      sweep += TAU * (2.85 + motion * 1.6) / sampleRate;
      const swish = Math.pow(.5 + .5 * Math.sin(sweep), 1.8);
      pcm[i] = texture * (.13 + .87 * swish) * .83 + (fine - mid) * swish * .035;
    } else {
      pcm[i] = texture * (.56 + Math.min(.35, Math.abs(motion) * 2.8)) * (1 - creamy * .18);
    }
  }
}

function liquidContact(pcm, sampleRate, random, start, frequency, decay, amplitude) {
  const offset = Math.floor(start * sampleRate);
  const length = Math.min(pcm.length - offset, Math.ceil(decay * 6 * sampleRate));
  if (length <= 0) return;
  const f1 = Math.min(sampleRate * .43, frequency * (.94 + random() * .12));
  const f2 = Math.min(sampleRate * .43, f1 * (1.43 + random() * .31));
  const f3 = Math.min(sampleRate * .43, f1 * (2.13 + random() * .26)), aNoise = pole(frequency * 2.3, sampleRate);
  const phase = random() * TAU;
  const step1 = TAU * f1 / sampleRate, step2 = TAU * f2 / sampleRate, step3 = TAU * f3 / sampleRate;
  const c1 = Math.cos(step1), s1 = Math.sin(step1), c2 = Math.cos(step2), s2 = Math.sin(step2), c3 = Math.cos(step3), s3 = Math.sin(step3);
  const attackFalloff = Math.exp(-2700 / sampleRate), decayFalloff = Math.exp(-1 / (decay * sampleRate));
  let sin1 = Math.sin(phase), cos1 = Math.cos(phase), sin2 = 0, cos2 = 1;
  let sin3 = Math.sin(phase * .37), cos3 = Math.cos(phase * .37), attack = 1, envelopeDecay = 1, noise = 0;
  for (let j = 0; j < length; j++) {
    const envelope = (1 - attack) * envelopeDecay;
    noise += aNoise * (random() * 2 - 1 - noise);
    // Short, rough, inharmonic resonances, rather than a clean pitched chirp.
    const modes = sin1 * .44 + sin2 * .22 + sin3 * .1;
    pcm[offset + j] += amplitude * envelope * (modes * .65 + noise * .75);
    const next1 = sin1 * c1 + cos1 * s1, next2 = sin2 * c2 + cos2 * s2, next3 = sin3 * c3 + cos3 * s3;
    cos1 = cos1 * c1 - sin1 * s1; sin1 = next1;
    cos2 = cos2 * c2 - sin2 * s2; sin2 = next2;
    cos3 = cos3 * c3 - sin3 * s3; sin3 = next3;
    attack *= attackFalloff; envelopeDecay *= decayFalloff;
  }
}

function liquidDetails(pcm, sampleRate, random, kind) {
  const seconds = pcm.length / sampleRate;
  const styles = {
    water: [28, 550, 1650, .018, .037, 4.5],
    milk: [14, 260, 850, .026, .028, 3.6],
    serve: [21, 380, 1250, .023, .034, 4.1],
    cloud: [8, 200, 570, .034, .023, 2.4],
    whisk: [39, 330, 1250, .012, .021, 2.1]
  };
  const [rate, low, high, decay, amount, glugs] = styles[kind];
  for (let time = random() / rate; time < seconds; time += (.3 + random() * 1.4) / rate) {
    const rhythm = kind === 'whisk' ? .28 + .72 * Math.pow(.5 + .5 * Math.sin(time * TAU * 2.85), 1.4) : 1;
    liquidContact(pcm, sampleRate, random, time, low + random() * (high - low), decay * (.6 + random() * .8), amount * (.45 + random() * .9) * rhythm);
  }
  for (let time = random() / glugs; time < seconds; time += (.4 + random() * 1.2) / glugs) {
    liquidContact(pcm, sampleRate, random, time, 95 + random() * (kind === 'water' ? 230 : 140), .025 + random() * .04, (kind === 'whisk' ? .024 : .049) * (.6 + random() * .6));
  }
}

function powderTexture(pcm, sampleRate, random, sifting) {
  const aBody = pole(sifting ? 270 : 185, sampleRate);
  const aGrain = pole(sifting ? 1020 : 680, sampleRate);
  const aFine = pole(sifting ? 2400 : 1550, sampleRate);
  const aMotion = pole(9, sampleRate), aContact = pole(410, sampleRate);
  const contactFalloff = Math.exp(-1 / ((sifting ? .014 : .028) * sampleRate));
  let body = 0, grain = 0, fine = 0, softenedFine = 0, motion = 0, contact = 0, contactNoise = 0;
  let phase = random() * TAU, previousTurn = Math.floor(phase / TAU);
  for (let i = 0; i < pcm.length; i++) {
    const noise = random() * 2 - 1;
    // A sparse, irregular exciter gives dry grains a fine texture. Successive
    // low-pass stages remove the sharp upper edge of raw white noise.
    const grains = noise * noise * noise;
    body += aBody * (grains - body);
    grain += aGrain * (grains - grain);
    fine += aFine * (grains - fine);
    softenedFine += aFine * (fine - softenedFine);
    motion += aMotion * (random() * 2 - 1 - motion);
    phase += TAU * ((sifting ? 5.5 : 1.35) + motion * (sifting ? .3 : .6)) / sampleRate;
    const stroke = Math.pow(.5 + .5 * Math.sin(phase), sifting ? 1.25 : .8);
    const flutter = sifting ? .24 + stroke * .76 : .52 + stroke * .48;
    const texture = (grain - body) * (sifting ? .31 : .7) + (softenedFine - grain) * (sifting ? .57 : .22);
    const turn = Math.floor(phase / TAU);
    if (turn !== previousTurn) {
      contact = .22 + random() * .18;
      previousTurn = turn;
    }
    contactNoise += aContact * (noise - contactNoise);
    // Muted bamboo/mesh contact remains unpitched and tucked under the grains.
    pcm[i] = texture * flutter * (.84 + motion * 1.1) + contactNoise * contact * (sifting ? .14 : .22);
    contact *= contactFalloff;
  }
}

function iceImpact(pcm, sampleRate, random, start, strength) {
  const offset = Math.floor(start * sampleRate), length = Math.min(pcm.length - offset, Math.ceil(.4 * sampleRate));
  const tuning = .78 + random() * .42;
  const modes = [
    [1370, .068, .3], [2310, .052, .25], [3485, .039, .21],
    [4930, .026, .13], [6590, .017, .08], [380, .026, .22]
  ].map(([f, decay, gain]) => {
    const step = TAU * Math.min(sampleRate * .43, f * tuning) / sampleRate;
    return { sin: 0, cos: 1, rotationSin: Math.sin(step), rotationCos: Math.cos(step), envelope: 1, falloff: Math.exp(-1 / (decay * (.8 + random() * .35) * sampleRate)), gain };
  });
  const a = pole(5100, sampleRate), b = pole(650, sampleRate);
  const attackFalloff = Math.exp(-8000 / sampleRate), fineFalloff = Math.exp(-1 / (.012 * sampleRate)), lowFalloff = Math.exp(-1 / (.027 * sampleRate));
  let fine = 0, low = 0, attack = 1, fineDecay = 1, lowDecay = 1;
  for (let j = 0; j < length; j++) {
    const noise = random() * 2 - 1;
    fine += a * (noise - fine); low += b * (noise - low);
    let resonances = 0;
    for (const mode of modes) {
      resonances += mode.sin * mode.envelope * mode.gain;
      const next = mode.sin * mode.rotationCos + mode.cos * mode.rotationSin;
      mode.cos = mode.cos * mode.rotationCos - mode.sin * mode.rotationSin; mode.sin = next;
      mode.envelope *= mode.falloff;
    }
    pcm[offset + j] += strength * (1 - attack) * (resonances * .58 + (fine - low) * fineDecay * .4 + low * lowDecay * .38);
    attack *= attackFalloff; fineDecay *= fineFalloff; lowDecay *= lowFalloff;
  }
}

function iceTexture(pcm, sampleRate, random, wet) {
  const seconds = pcm.length / sampleRate;
  const spread = Math.min(.32, seconds * .48);
  let time = .008;
  for (let i = 0; i < 5; i++) {
    iceImpact(pcm, sampleRate, random, time, (i === 0 ? .85 : .6 / Math.sqrt(i + .3)) * (.8 + random() * .3));
    time += spread * (.1 + random() * .28);
  }
  if (wet) {
    liquidContact(pcm, sampleRate, random, .012, 205, .045, .37);
    liquidContact(pcm, sampleRate, random, Math.min(.15, seconds * .23), 380, .028, .2);
    const a = pole(850, sampleRate), b = pole(95, sampleRate);
    let high = 0, low = 0;
    for (let i = 0; i < pcm.length; i++) {
      const age = i / sampleRate, n = random() * 2 - 1;
      high += a * (n - high); low += b * (n - low);
      pcm[i] += (high - low) * .42 * (1 - Math.exp(-age * 600)) * Math.exp(-age / .075);
    }
  }
  // Leave a quiet tail even for short custom previews and repeated ice additions.
  const fadeStart = Math.floor(pcm.length * .64), fadeLength = Math.max(1, Math.floor(pcm.length * .23));
  for (let i = fadeStart; i < pcm.length; i++) {
    const fade = Math.max(0, 1 - (i - fadeStart) / fadeLength);
    pcm[i] *= fade * fade;
  }
}

function normalize(pcm, target) {
  let energy = 0;
  for (let i = 0; i < pcm.length; i++) energy += pcm[i] * pcm[i];
  const scale = target / Math.max(.000001, Math.sqrt(energy / pcm.length));
  // A soft, symmetric peak shape keeps isolated splashes comfortable while
  // retaining their short attack. Nothing is hard-clipped.
  for (let i = 0; i < pcm.length; i++) pcm[i] = .88 * Math.tanh(pcm[i] * scale / .88);
  return pcm;
}

/**
 * Return a mono PCM texture. Pour/whisk/powder buffers loop; ice is one-shot.
 * sampleRate follows the AudioContext rate, seed changes the take reproducibly.
 */
export function synthesizeSound(kind, { sampleRate = 44100, seed = 1, duration } = {}) {
  const loop = LOOPS.has(kind);
  if (!loop && !IMPACTS.has(kind)) throw new RangeError(`Unknown sound texture: ${kind}`);
  const seconds = duration ?? (loop ? 5.6 : .8);
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('sampleRate must be an integer between 8000 and 192000');
  if (!Number.isFinite(seconds) || seconds < .12 || seconds > 30) throw new RangeError('duration must be between .12 and 30 seconds');
  if (!Number.isFinite(seed)) throw new RangeError('seed must be finite');
  const frames = Math.round(seconds * sampleRate), random = randomSource(seed, kind);
  if (!loop) {
    const pcm = new Float32Array(frames);
    iceTexture(pcm, sampleRate, random, kind === 'iceWet');
    return normalize(pcm, .165);
  }
  const overlap = Math.min(Math.round(.14 * sampleRate), Math.floor(frames / 4));
  const source = new Float32Array(frames + overlap);
  const powder = kind === 'scoop' || kind === 'sift';
  if (powder) powderTexture(source, sampleRate, random, kind === 'sift');
  else {
    liquidBed(source, sampleRate, random, kind);
    liquidDetails(source, sampleRate, random, kind);
  }
  const pcm = source.slice(overlap);
  for (let i = 0; i < overlap; i++) {
    const phase = (i + 1) / overlap * Math.PI * .5, index = frames - overlap + i;
    pcm[index] = source[frames + i] * Math.cos(phase) + source[i] * Math.sin(phase);
  }
  return normalize(pcm, powder ? .145 : .155);
}
