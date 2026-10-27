// An original, unhurried score. Audio is scheduled ahead only when a note is due;
// the render loop never creates a continuously growing bank of oscillators.
const BPM = 62, BEAT = 60 / BPM, BEATS = 64;
const LOOKAHEAD = .25, LEAD = .025, MAX_VOICES = 12, EPSILON = .00001;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : lo));
const frequency = note => 440 * 2 ** ((note - 69) / 12);
const harmony = [[48, 55, 62, 64], [45, 52, 55, 60], [41, 48, 55, 57], [43, 50, 57, 60]];
const melody = [
  [[.5, 64, .65], [2, 67, .48], [3.25, 69, .39]],
  [[1, 67, .50], [2.75, 62, .42]],
  [[.25, 64, .56], [2.5, 60, .43]],
  [[1.25, 62, .47], [3, 64, .38]],
  [[.5, 69, .52], [2.25, 67, .45]],
  [[1, 64, .51], [3.25, 62, .38]],
  [[.75, 67, .51], [2.5, 69, .41]],
  [[1.25, 62, .48]],
  [[.5, 64, .60], [2, 67, .49], [3.25, 72, .35]],
  [[1, 69, .47], [2.75, 67, .39]],
  [[.25, 64, .54], [2.5, 62, .41]],
  [[1.25, 60, .47], [3, 64, .36]],
  [[.5, 69, .50], [2.25, 67, .42]],
  [[1, 64, .49], [3.25, 60, .37]],
  [[.75, 62, .49], [2.5, 67, .41]],
  [[1.25, 64, .44], [3.5, 62, .32]],
];
const events = [];
for (let i = 0; i < 8; i++) events.push({ kind: 'pad', beat: i * 8, notes: harmony[i % 4], velocity: i % 2 ? .79 : .83, duration: BEAT * 8 + 2.4 });
for (let bar = 0; bar < melody.length; bar++) {
  for (const [beat, note, velocity] of melody[bar]) events.push({ kind: 'piano', beat: bar * 4 + beat, notes: [note], velocity, duration: 4.7 });
}
events.sort((a, b) => a.beat - b.beat || (a.kind === 'pad' ? -1 : 1));
export const MUSIC_SCORE = Object.freeze({
  title: 'Senja di Meja Matcha', bpm: BPM, beats: BEATS, duration: BEATS * BEAT,
  events: Object.freeze(events.map(event => Object.freeze({ ...event, time: event.beat * BEAT, notes: Object.freeze([...event.notes]) }))),
});

// A held pad overlaps the next harmony; a struck note sheds its overtones early.
// These envelopes also let a paused phrase resume at the existing decay instead
// of replaying all the note attacks that were active before the pause.
function envelope(kind, age, duration) {
  if (age <= 0 || age >= duration) return 0;
  if (kind === 'pad') {
    if (age < 1.8) return age / 1.8;
    const release = duration - 2.4;
    return age < release ? 1 : Math.max(0, (duration - age) / 2.4);
  }
  if (age < .016) return age / .016;
  return Math.exp(-(age - .016) / 1.18) * Math.min(1, (duration - age) / .12);
}

export function createMusicPlayer(context, output) {
  const master = context.createGain(), sum = context.createGain(), voices = new Set();
  master.gain.value = 0; sum.gain.value = 1; sum.connect(master); master.connect(output);
  // A quiet, dark reflection gives the dry instrument some room without a
  // permanent noise loop or an external recording.
  if (typeof context.createDelay === 'function') {
    const delay = context.createDelay(.5), feedback = context.createGain(), room = context.createGain(), shade = context.createBiquadFilter();
    delay.delayTime.value = .187; feedback.gain.value = .19; room.gain.value = .14;
    shade.type = 'lowpass'; shade.frequency.value = 1150; shade.Q.value = .35;
    sum.connect(delay); delay.connect(shade); shade.connect(room); room.connect(master);
    shade.connect(feedback); feedback.connect(delay);
  }
  let volume = .30, running = false, position = 0, origin = 0, nextIndex = 0, nextCycle = 0, lastUpdate = null, scheduled = 0;

  function ramp(value, seconds = .09) {
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(value, now, seconds);
  }
  function playhead(now = context.currentTime) { return running ? Math.max(position, now - origin) : position; }
  function seekCursor(at) {
    nextCycle = Math.floor(at / MUSIC_SCORE.duration);
    const local = at - nextCycle * MUSIC_SCORE.duration;
    nextIndex = MUSIC_SCORE.events.findIndex(event => event.time >= local - EPSILON);
    if (nextIndex === -1) { nextCycle++; nextIndex = 0; }
  }
  function advanceCursor() {
    if (++nextIndex === MUSIC_SCORE.events.length) { nextIndex = 0; nextCycle++; }
  }
  function cleanup(voice) {
    if (!voices.delete(voice)) return;
    for (const node of voice.nodes) node.disconnect();
  }
  function schedule(event, when, age = 0) {
    if (age >= event.duration - .12 || voices.size >= MAX_VOICES) return;
    const gain = context.createGain(), filter = context.createBiquadFilter();
    const pan = context.createStereoPanner?.() ?? context.createGain();
    const nodes = [gain, filter, pan], oscillators = [];
    const voice = { nodes, oscillators, gain, kind: event.kind, end: when + event.duration - age, stopping: false };
    const peak = (event.kind === 'pad' ? .031 : .09) * event.velocity;
    const initial = envelope(event.kind, age, event.duration) * peak;
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, when);
    const attack = event.kind === 'pad' ? 1.8 : .016;
    if (age >= attack) gain.gain.linearRampToValueAtTime(initial, when + .07);
    if (age < attack) gain.gain.linearRampToValueAtTime(peak, when + attack - age);
    if (event.kind === 'pad') {
      const release = event.duration - 2.4;
      if (age < release) gain.gain.setValueAtTime(peak, when + release - age);
      gain.gain.linearRampToValueAtTime(0, voice.end);
    } else {
      // Several curved segments keep the decay close to an acoustic string and
      // avoid a long, electronic sustained sine tone.
      for (const checkpoint of [.20, .55, 1.1, 1.9, 3, event.duration - .12]) {
        if (checkpoint > Math.max(age + .07, attack)) gain.gain.exponentialRampToValueAtTime(Math.max(.00001, peak * envelope('piano', checkpoint, event.duration)), when + checkpoint - age);
      }
      gain.gain.linearRampToValueAtTime(0, voice.end);
    }
    filter.type = 'lowpass'; filter.Q.value = .38;
    filter.frequency.value = event.kind === 'pad' ? 850 : Math.max(680, 2100 * Math.exp(-age / 1.8));
    if (event.kind === 'piano') filter.frequency.setTargetAtTime(680, when, .8);
    if (pan.pan) pan.pan.value = event.kind === 'pad' ? -.05 : clamp((event.notes[0] - 65) * .024, -.16, .16);
    gain.connect(filter); filter.connect(pan); pan.connect(sum);
    function oscillator(note, ratio, weight, decay = 0, detune = 0) {
      const source = context.createOscillator(), partial = context.createGain();
      source.type = event.kind === 'pad' ? 'triangle' : 'sine';
      source.frequency.value = frequency(note) * ratio;
      if (source.detune) source.detune.value = detune;
      partial.gain.value = weight * (decay ? Math.exp(-age / decay) : 1);
      if (decay) partial.gain.setTargetAtTime(.0001, when, decay);
      source.connect(partial); partial.connect(gain); nodes.push(source, partial); oscillators.push(source);
    }
    if (event.kind === 'pad') event.notes.forEach((note, index) => oscillator(note, 1, .82, 0, index % 2 ? 2.3 : -2.3));
    else {
      oscillator(event.notes[0], 1, 1, 0, -.6);
      oscillator(event.notes[0], 2.002, .25, .42);
      oscillator(event.notes[0], 3.008, .07, .25);
    }
    let remaining = oscillators.length;
    for (const source of oscillators) {
      source.onended = () => { if (--remaining === 0) cleanup(voice); };
      source.start(when); source.stop(voice.end + .025);
    }
    voices.add(voice); scheduled++;
  }
  function restoreTails(at, when) {
    const cycle = Math.floor(at / MUSIC_SCORE.duration);
    // The preceding phrase matters near the loop boundary because its final
    // chord is deliberately allowed to finish over the first new chord.
    for (const pass of [cycle - 1, cycle]) {
      if (pass < 0) continue;
      for (const event of MUSIC_SCORE.events) {
        const age = at - (pass * MUSIC_SCORE.duration + event.time);
        if (age > EPSILON && age < event.duration - .12 && envelope(event.kind, age, event.duration) > .012) schedule(event, when, age);
      }
    }
  }
  function silence() {
    if (running) position = playhead();
    running = false; lastUpdate = null; ramp(0, .025);
    for (const voice of voices) {
      if (voice.stopping) continue;
      voice.stopping = true;
      voice.gain.gain.cancelScheduledValues(context.currentTime);
      voice.gain.gain.setTargetAtTime(0, context.currentTime, .015);
      for (const source of voice.oscillators) {
        try { source.stop(context.currentTime + .10); } catch { /* The release may already have finished. */ }
      }
    }
  }
  function setVolume(next) {
    const value = clamp(next, 0, 1);
    if (value === volume) return volume;
    volume = value;
    if (volume === 0) silence();
    else if (running) ramp(volume);
    return volume;
  }
  function update({ active = true } = {}) {
    if (!active || volume === 0 || context.state !== 'running') { if (running) silence(); return; }
    const now = context.currentTime;
    if (!running) {
      running = true; origin = now + LEAD - position;
      seekCursor(position); restoreTails(position, now + LEAD); ramp(volume, .14);
    }
    const at = playhead(now), horizon = now + LOOKAHEAD;
    // A throttled frame skips stale attacks. It cannot catch up by playing a
    // whole missed bar at once when the tab or device becomes responsive.
    if (lastUpdate !== null && now - lastUpdate > LOOKAHEAD) seekCursor(at + LEAD);
    while (true) {
      const event = MUSIC_SCORE.events[nextIndex], absolute = nextCycle * MUSIC_SCORE.duration + event.time;
      const when = origin + absolute;
      if (when > horizon) break;
      if (when >= now - EPSILON) schedule(event, Math.max(now, when));
      advanceCursor();
    }
    lastUpdate = now;
  }
  return {
    setVolume, update, silence,
    get status() { return { volume, playing: running, position: playhead() % MUSIC_SCORE.duration, voices: voices.size, scheduled, duration: MUSIC_SCORE.duration, title: MUSIC_SCORE.title }; },
  };
}
