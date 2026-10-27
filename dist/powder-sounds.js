const smooth=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
const window=(progress,start,end,attack,release)=>smooth((progress-start)/attack)*smooth((end-progress)/release);

// Progress follows the existing 1.7-second scoop/sieve animation. Reusing `out`
// lets the scene publish current levels without allocating on every frame.
export function powderSoundLevels(type,progress,out={scoop:0,sift:0}){
  out.scoop=out.sift=0;
  if(!Number.isFinite(progress)||(type!=='powder'&&type!=='sieve'))return out;
  const p=Math.max(0,Math.min(1,progress));
  const pickup=window(p,.03,.28,.04,.06),grains=window(p,.25,.80,.08,.12);
  out.scoop=.34*pickup+(type==='powder'?.18*grains:0);
  out.sift=type==='sieve'?.42*grains:0;
  return out;
}
