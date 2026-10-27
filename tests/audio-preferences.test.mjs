import assert from 'node:assert/strict';
import {DEFAULT_AUDIO,normalizeAudioPreferences,loadAudioPreferences,saveAudioPreferences} from '../dist/audio-preferences.js';

const values=new Map();
const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
assert.deepEqual(loadAudioPreferences(storage),DEFAULT_AUDIO,'A first visit uses quiet music and audible effects');
const selected={musicVolume:.12,effectsVolume:.86,ambienceVolume:.18,musicMuted:true,effectsMuted:false,ambienceMuted:true};
saveAudioPreferences(storage,selected);
assert.deepEqual(loadAudioPreferences(storage),selected,'Independent volume and mute preferences survive a visit');
assert.equal(values.size,1,'Preferences use a single stable storage key');
assert.ok(values.has('sejenak-audio-v1'));
const muted=loadAudioPreferences(storage);
muted.musicMuted=false;
assert.deepEqual(loadAudioPreferences(storage),selected,'Returned preferences do not mutate persisted settings');
assert.deepEqual(normalizeAudioPreferences({musicVolume:4,effectsVolume:-.5,musicMuted:false,effectsMuted:true}),{
  ...DEFAULT_AUDIO,musicVolume:1,effectsVolume:0,musicMuted:false,effectsMuted:true
},'Out-of-range stored levels stay within safe gain limits');
assert.deepEqual(normalizeAudioPreferences({musicVolume:NaN,effectsVolume:Infinity,musicMuted:'false',effectsMuted:1}),DEFAULT_AUDIO,'Malformed types fall back instead of muting or producing invalid gain');
for(const invalid of [null,undefined,[],false,'hello',12]){
  assert.deepEqual(normalizeAudioPreferences(invalid),DEFAULT_AUDIO);
}
for(const malformed of ['{broken','null','[]','42','{"musicVolume":"0","effectsMuted":"false"}']){
  values.set('sejenak-audio-v1',malformed);
  assert.deepEqual(loadAudioPreferences(storage),DEFAULT_AUDIO,'Corrupt browser settings never stop game startup');
}
const partial={musicVolume:0,effectsMuted:true};
assert.deepEqual(normalizeAudioPreferences(partial),{...DEFAULT_AUDIO,...partial,ambienceMuted:true},'Zero volume remains an intentional setting');
assert.deepEqual(saveAudioPreferences(storage,partial),{...DEFAULT_AUDIO,...partial,ambienceMuted:true});
assert.deepEqual(loadAudioPreferences(storage),{...DEFAULT_AUDIO,...partial,ambienceMuted:true});
const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}};
assert.deepEqual(loadAudioPreferences(blocked),DEFAULT_AUDIO);
assert.deepEqual(saveAudioPreferences(blocked,selected),selected,'Audio remains usable when storage is blocked or full');
assert.deepEqual(loadAudioPreferences(),DEFAULT_AUDIO);
assert.deepEqual(saveAudioPreferences(null,selected),selected);
assert.ok(Object.isFrozen(DEFAULT_AUDIO));
console.log('Audio preferences passed: independent persistence, bounded volumes, zero levels, partial/corrupt data, safe storage failures.');

assert.equal(normalizeAudioPreferences({musicMuted:true,effectsMuted:true}).ambienceMuted,true,'Upgrading preserves a legacy all-muted preference');
assert.equal(normalizeAudioPreferences({musicVolume:0,effectsVolume:0}).ambienceMuted,true,'Legacy zero volumes do not unexpectedly turn on ambience');
assert.equal(normalizeAudioPreferences({musicMuted:true,effectsMuted:true,ambienceMuted:false}).ambienceMuted,false,'Ambience can deliberately play alone');
assert.equal(normalizeAudioPreferences({ambienceVolume:5}).ambienceVolume,1);
assert.equal(normalizeAudioPreferences({ambienceVolume:NaN}).ambienceVolume,DEFAULT_AUDIO.ambienceVolume);
