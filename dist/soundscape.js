import { createAmbiencePlayer } from './ambience-player.js';
import { normalizeAtmosphere } from './atmosphere.js';
import { synthesizeSound } from './sound-textures.js?v=powder-audio-1';
import { createMusicPlayer } from './music-player.js?v=music-1';
import { loadPourRecording as loadRecordedPour } from './pour-recording.js?v=recorded-pour-1';
import { loadIceRecording as loadRecordedIce } from './ice-recording.js?v=ice-batch-1';

const CLAMP = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const CHANNELS = {
  water: { recorded: true, volume: 1, cutoff: 5000, pan: -.12 },
  milk: { recorded: true, volume: .92, cutoff: 4400, pan: .14 },
  serve: { recorded: true, volume: 1, cutoff: 4700, pan: .14 },
  cloud: { volume: .28, cutoff: 1700, pan: .14 },
  whisk: { volume: .33, cutoff: 3100, pan: -.10 },
  scoop: { volume: .18, cutoff: 1800, pan: -.20 },
  sift: { volume: .16, cutoff: 2600, pan: -.10 },
};

export function createSoundscape({ createContext, synthesize = synthesizeSound, createMusic = createMusicPlayer, createAmbience = createAmbiencePlayer, loadPourRecording = loadRecordedPour, loadIceRecording = loadRecordedIce } = {}) {
  let context, master, compressor, enabled = false, epoch = 0, iceSequence = 0;
  let effectsVolume=.7,musicVolume=0,music=null,musicOutput=null;
  let ambienceVolume=0,ambience=null,atmosphere='morning';
  let recordingBuffer=null,recordingPromise=null,recordingState='idle';
  let iceRecordings=null,iceLoading=null,iceRecordingState='idle';
  const loops = new Map(), voices = new Set();
  const levels = Object.fromEntries(Object.keys(CHANNELS).map(key => [key, 0]));

  function ramp(parameter, value, seconds = .065) {
    const now = context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(value, now, seconds);
  }
  function buffer(kind, seed = 1) {
    const pcm = synthesize(kind, { sampleRate: context.sampleRate, seed });
    const result = context.createBuffer(1, pcm.length, context.sampleRate);
    result.getChannelData(0).set(pcm);
    return result;
  }
  function panner(pan) {
    const node = context.createStereoPanner?.() ?? context.createGain();
    if (node.pan) node.pan.value = pan;
    return node;
  }
  function ensure() {
    if (context) return;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    context = createContext ? createContext() : Context ? new Context({ latencyHint: 'interactive' }) : null;
    if (!context) throw new Error('Audio unavailable');
    master = context.createGain(); master.gain.value = 0;
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -19; compressor.knee.value = 10; compressor.ratio.value = 2;
    compressor.attack.value = .006; compressor.release.value = .20;
    master.connect(compressor); compressor.connect(context.destination);
    for (const [kind, config] of Object.entries(CHANNELS)) {
      const filter = context.createBiquadFilter(), gain = context.createGain(), pan = panner(config.pan);
      filter.type = 'lowpass'; filter.frequency.value = config.cutoff; filter.Q.value = .45; gain.gain.value = 0;
      filter.connect(gain); gain.connect(pan); pan.connect(master);
      const channel = { source: null, filter, gain, pan, level: 0 };
      if (!config.recorded) {
        const source = context.createBufferSource();
        source.buffer = buffer(kind, 109 + loops.size * 127); source.loop = true;
        source.connect(filter); source.start(); channel.source = source;
      }
      loops.set(kind, channel);
    }
    if(musicVolume>0)ensureMusic();
    if(ambienceVolume>0)ensureAmbience();
  }
  function requestRecording() {
    if (recordingBuffer || recordingPromise) return;
    recordingState = 'loading';
    recordingPromise = Promise.resolve().then(() => loadPourRecording(context)).then(decoded => {
      if (!decoded) throw new Error('Pour recording unavailable');
      recordingBuffer = decoded; recordingState = 'ready';
      // Loading never starts a sound: the next live contact frame decides that.
    }).catch(() => { recordingState = 'failed'; }).finally(() => { recordingPromise = null; });
  }
  function requestIceRecording() {
    if (iceRecordings || iceLoading) return;
    iceRecordingState = 'loading';
    iceLoading = Promise.resolve().then(() => loadIceRecording(context)).then(takes => {
      if (!Array.isArray(takes) || !takes.length || takes.some(take => !take)) throw new Error('Ice recording unavailable');
      iceRecordings = takes; iceRecordingState = 'ready';
      // Never replay a landing that happened while this file was still loading.
    }).catch(() => { iceRecordingState = 'failed'; }).finally(() => { iceLoading = null; });
  }
  function startPour(channel) {
    if (channel.source || !recordingBuffer) return;
    const source = context.createBufferSource(), envelope = context.createGain();
    source.buffer = recordingBuffer; source.loop = true;
    envelope.gain.value = 0;
    source.connect(envelope); envelope.connect(channel.filter);
    source.onended = () => { source.disconnect(); envelope.disconnect(); };
    source.start(0, 0); ramp(envelope.gain,1,.02);
    channel.source = source; channel.pourEnvelope = envelope;
  }
  function stopPour(channel, seconds = .18) {
    if (!channel.source) return;
    const source = channel.source; channel.source = null;
    ramp(channel.pourEnvelope.gain,0,seconds<.1 ? .012 : .03);
    channel.pourEnvelope = null;
    try { source.stop(context.currentTime + seconds); } catch { /* Already ended. */ }
  }
  function ensureMusic(){
    if(!context||music)return;
    // Music has its own output: adjusting/compressing effects never changes it.
    musicOutput=context.createGain();musicOutput.gain.value=1;musicOutput.connect(context.destination);
    music=createMusic(context,musicOutput);music.setVolume(musicVolume);
  }
  function ensureAmbience(){
    if(!context||ambience)return;
    ambience=createAmbience(context,context.destination);ambience.setAtmosphere(atmosphere);ambience.setVolume(ambienceVolume);
  }
  function setAmbienceVolume(value){
    ambienceVolume=CLAMP(value,0,1);
    if(!context)return;
    if(ambienceVolume>0)ensureAmbience();
    ambience?.setVolume(ambienceVolume);if(ambienceVolume===0)ambience?.silence();
  }
  function setAtmosphere(value){atmosphere=normalizeAtmosphere(value);ambience?.setAtmosphere(atmosphere);}
  function setEffectsVolume(value){
    effectsVolume=CLAMP(value,0,1);
    if(!context)return;
    if(effectsVolume===0)silence();
    ramp(master.gain,enabled ? .5*effectsVolume/.7 : 0,.08);
  }
  function setMusicVolume(value){
    musicVolume=CLAMP(value,0,1);
    if(!context)return;
    if(musicVolume>0)ensureMusic();
    music?.setVolume(musicVolume);
    if(musicVolume===0)music?.silence();
  }
  function clearVoices() {
    for (const voice of [...voices]) {
      if (voice.stopping) continue;
      voice.stopping = true;
      ramp(voice.gain.gain, 0, .012);
      try { voice.source.stop(context.currentTime + .06); } catch { /* Already ended. */ }
    }
    // No delayed JavaScript callbacks can create another impact after muting/reset.
  }
  function silence() {
    if (!context) return;
    for (const [kind, channel] of loops) {
      if(channel.level!==0)ramp(channel.gain.gain, 0, .015);
      if(CHANNELS[kind].recorded)stopPour(channel,.08);
      levels[kind] = channel.level = 0;
    }
    clearVoices();
  }
  function pause(){silence();music?.silence();ambience?.silence();}
  async function setEnabled(next) {
    const request = ++epoch;
    if (!next) {
      enabled = false;
      if (context) { pause(); ramp(master.gain, 0, .025); }
      return false;
    }
    try {
      ensure();
      requestRecording();
      requestIceRecording();
      await context.resume();
      if (request !== epoch) return enabled;
      enabled = true; ramp(master.gain, .50*effectsVolume/.7, .08);
      return true;
    } catch {
      if (request !== epoch) return enabled;
      enabled = false;
      if (master) { pause(); ramp(master.gain, 0, .015); }
      return false;
    }
  }
  function resume() {
    if (!enabled || !context || context.state !== 'suspended') return;
    const request=epoch;
    Promise.resolve().then(()=>context.resume()).catch(() => { if(request===epoch)pause(); });
  }
  function ice(event) {
    if (!enabled || effectsVolume===0 || !context || context.state !== 'running' || !iceRecordings) return;
    // A small finite pool bounds rapid input while retaining independent resonances.
    if (voices.size >= 8) return;
    const source = context.createBufferSource(), gain = context.createGain(), pan = panner(CLAMP(event.pan, -.22, .22));
    source.buffer = iceRecordings[iceSequence++ % iceRecordings.length]; source.playbackRate.value = 1;
    gain.gain.value = .38 * CLAMP(event.intensity ?? 1, .25, 1);
    source.connect(gain); gain.connect(pan); pan.connect(master);
    const voice = { source, gain, pan }; voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); pan.disconnect(); };
    source.start();
  }
  function update(snapshot, { active = true, musicActive = active, ambienceActive = musicActive, iceEvents = [] } = {}) {
    if (!enabled || !context) return;
    music?.update({active:musicActive&&musicVolume>0&&context.state==='running'});
    ambience?.update({active:ambienceActive&&ambienceVolume>0&&context.state==='running'});
    if (!active || context.state !== 'running') { silence(); return; }
    const pour = snapshot?.pour || {}, whisk = snapshot?.whisk || {}, powder = snapshot?.powder || {};
    for (const [kind, channel] of loops) {
      const config = CHANNELS[kind], isWhisk = kind === 'whisk', isPowder = kind === 'scoop' || kind === 'sift';
      const intensity = effectsVolume>0?CLAMP(isPowder ? powder[kind] : isWhisk ? whisk.intensity : pour.kind === kind ? pour.intensity : 0, 0, 1):0;
      const next = intensity > .01 && (!config.recorded || recordingBuffer) ? Math.sqrt(intensity) * config.volume : 0;
      if (config.recorded) {
        if (next > 0) startPour(channel);
        else if (channel.source) stopPour(channel);
      }
      if (Math.abs(next - channel.level) > .001) {
        ramp(channel.gain.gain, next, next > channel.level ? .04 : .03);
        levels[kind] = channel.level = next;
      }
      if (next > 0) {
        const fill = CLAMP(pour.fill, 0, 1), foam = CLAMP(whisk.foam, 0, 1);
        ramp(channel.filter.frequency, config.cutoff * (isPowder ? 1 : isWhisk ? 1 - foam * .20 : .85 + fill * .25), .15);
        ramp(channel.source.playbackRate, isPowder ? 1 : isWhisk ? .93 + CLAMP(whisk.speed ?? 1, .3, 1.6) * .07 : .94 + fill * .09, .18);
      }
    }
    for (const event of iceEvents) ice(event);
  }
  return {
    setEnabled, resume, update, silence, pause, setEffectsVolume, setMusicVolume, setAmbienceVolume, setAtmosphere,
    get enabled() { return enabled; },
    get status() { return { enabled, state: context?.state ?? 'uninitialized', recording:recordingState, iceRecording:iceRecordingState, levels: { ...levels }, voices: voices.size,effectsVolume,musicVolume,ambienceVolume,ambience:ambience?.status??{playing:false,volume:ambienceVolume,atmosphere,beds:0},music:music?.status??{playing:false,position:0,voices:0,volume:musicVolume} }; },
  };
}
