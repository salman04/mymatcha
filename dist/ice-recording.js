const TAKES=[[.12,1.42],[2.20,3.86]],EDGE_FADE=.012;
const smooth=value=>value*value*(3-2*value);

export function prepareIceRecording(context,decoded){
  const rate=decoded?.sampleRate,channels=decoded?.numberOfChannels,length=decoded?.length;
  if(typeof context?.createBuffer!=='function'||!Number.isFinite(rate)||rate<=0||!Number.isInteger(channels)||channels<1||channels>32||!Number.isInteger(length)||length<=0||typeof decoded?.getChannelData!=='function')throw new Error('Invalid decoded ice recording.');
  const ranges=TAKES.map(([start,end])=>[Math.round(start*rate),Math.round(end*rate)]),fade=Math.max(2,Math.round(EDGE_FADE*rate));
  if(ranges.some(([start,end])=>end>length||end-start<=fade*2))throw new Error('Ice recording is too short for its captured impacts.');
  const tracks=[];
  for(let channel=0;channel<channels;channel++){
    const samples=decoded.getChannelData(channel);
    if(!samples||samples.length<length)throw new Error('Invalid PCM channel in ice recording.');
    for(let i=0;i<length;i++)if(!Number.isFinite(samples[i]))throw new Error('Non-finite PCM sample in ice recording.');
    tracks.push(samples);
  }
  // Each captured cluster plays once for a three-cube batch. Only trim the quiet
  // gaps and soften the edit boundaries; retain the recording's original level.
  return ranges.map(([start,end])=>{
    const result=context.createBuffer(1,end-start,rate),output=result.getChannelData(0);
    for(let i=0;i<output.length;i++){
      let mono=0;
      for(const track of tracks)mono+=track[start+i]/channels;
      const edge=Math.min(1,i/(fade-1),(output.length-1-i)/(fade-1));
      output[i]=mono*smooth(edge);
    }
    return result;
  });
}

export async function loadIceRecording(context,{fetchAudio=globalThis.fetch}={}){
  if(typeof fetchAudio!=='function'||typeof context?.decodeAudioData!=='function')throw new Error('Ice audio loading is unavailable.');
  const response=await fetchAudio(new URL('./audio/ice-cube.mp3',import.meta.url));
  if(!response?.ok||typeof response.arrayBuffer!=='function')throw new Error(`Unable to load ice recording${response?.status?` (${response.status})`:''}.`);
  const encoded=await response.arrayBuffer();
  if(!encoded?.byteLength)throw new Error('Ice recording is empty.');
  let decoded;
  try{decoded=await context.decodeAudioData(encoded);}catch(error){throw new Error('Unable to decode ice recording.',{cause:error});}
  return prepareIceRecording(context,decoded);
}
