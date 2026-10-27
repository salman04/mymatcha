export const DEFAULT_AUDIO=Object.freeze({
  musicVolume:.3,
  effectsVolume:.7,
  ambienceVolume:.28,
  musicMuted:false,
  effectsMuted:false,
  ambienceMuted:false
});

const STORAGE_KEY='sejenak-audio-v1';
const volume=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;

export function normalizeAudioPreferences(value){
  const prefs=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return {
    musicVolume:volume(prefs.musicVolume,DEFAULT_AUDIO.musicVolume),
    effectsVolume:volume(prefs.effectsVolume,DEFAULT_AUDIO.effectsVolume),
    ambienceVolume:volume(prefs.ambienceVolume,DEFAULT_AUDIO.ambienceVolume),
    musicMuted:typeof prefs.musicMuted==='boolean'?prefs.musicMuted:DEFAULT_AUDIO.musicMuted,
    effectsMuted:typeof prefs.effectsMuted==='boolean'?prefs.effectsMuted:DEFAULT_AUDIO.effectsMuted,
    // Preserve a deliberate all-silent setting saved before ambience existed.
    ambienceMuted:typeof prefs.ambienceMuted==='boolean'?prefs.ambienceMuted:((prefs.musicMuted===true||prefs.musicVolume===0)&&(prefs.effectsMuted===true||prefs.effectsVolume===0))
  };
}

export function loadAudioPreferences(storage){
  try{return normalizeAudioPreferences(JSON.parse(storage?.getItem(STORAGE_KEY)??'null'));}
  catch{return normalizeAudioPreferences();}
}

export function saveAudioPreferences(storage,prefs){
  const normalized=normalizeAudioPreferences(prefs);
  try{storage?.setItem(STORAGE_KEY,JSON.stringify(normalized));}
  catch{/* Audio controls still work when browser storage is unavailable. */}
  return normalized;
}
