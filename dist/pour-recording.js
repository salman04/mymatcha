const CROP_START=.20,CROP_END=4.85,CROSSFADE=.08,GAIN=2;

export function preparePourRecording(context,decoded){
  const rate=decoded?.sampleRate,channels=decoded?.numberOfChannels,length=decoded?.length;
  if(typeof context?.createBuffer!=='function'||!Number.isFinite(rate)||rate<=0||!Number.isInteger(channels)||channels<1||channels>32||!Number.isInteger(length)||length<=0||typeof decoded?.getChannelData!=='function')throw new Error('Invalid decoded pouring recording.');
  const start=Math.round(CROP_START*rate),end=Math.round(CROP_END*rate),fade=Math.max(2,Math.round(CROSSFADE*rate)),frames=end-start;
  if(end>length||frames<=fade*2)throw new Error('Pouring recording is too short for its clean loop.');
  const mono=new Float32Array(frames);
  for(let channel=0;channel<channels;channel++){
    const samples=decoded.getChannelData(channel);
    if(!samples||samples.length<length)throw new Error('Invalid PCM channel in pouring recording.');
    for(let i=0;i<length;i++)if(!Number.isFinite(samples[i]))throw new Error('Non-finite PCM sample in pouring recording.');
    for(let i=0;i<frames;i++)mono[i]+=samples[start+i]/channels;
  }
  // Keep the captured pour, remove its quiet lead/tail, and overlap the ends so
  // a held action can loop without replaying the recording's trailing pause.
  const result=context.createBuffer(1,frames-fade,rate),output=result.getChannelData(0);
  for(let i=0;i<fade;i++){
    const t=i/(fade-1),blend=t*t*(3-2*t);
    output[i]=(mono[frames-fade+i]*(1-blend)+mono[i]*blend)*GAIN;
  }
  for(let i=fade;i<output.length;i++)output[i]=mono[i]*GAIN;
  return result;
}

export async function loadPourRecording(context,{fetchAudio=globalThis.fetch}={}){
  if(typeof fetchAudio!=='function'||typeof context?.decodeAudioData!=='function')throw new Error('Pouring audio loading is unavailable.');
  const response=await fetchAudio(new URL('./audio/water-pour.mp3',import.meta.url));
  if(!response?.ok||typeof response.arrayBuffer!=='function')throw new Error(`Unable to load pouring recording${response?.status?` (${response.status})`:''}.`);
  const encoded=await response.arrayBuffer();
  if(!encoded?.byteLength)throw new Error('Pouring recording is empty.');
  let decoded;
  try{decoded=await context.decodeAudioData(encoded);}catch(error){throw new Error('Unable to decode pouring recording.',{cause:error});}
  return preparePourRecording(context,decoded);
}
