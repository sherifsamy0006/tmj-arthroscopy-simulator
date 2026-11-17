// Prescribed, force-independent motion with rigid source bone and disc.
// Disc and condyle share one prescribed rigid motion. This preserves the
// reconstructed lower-space fit, but does not model condylar roll under the disc.
// Only estimated compliant lining receives the scalar pressure-wall mode.
export * from './joint-model-r38.mjs';
import {rigidPoint} from './joint-model-r38.mjs';
export function deformPoint(p,weight,radial,state,axis,centre,distractionWeight=weight){
 const q=rigidPoint(p,state.angle*weight,state.anterior*weight,axis,centre,(state.distraction||0)*distractionWeight);
 return q.map((x,j)=>x+state.wall*radial[j]);
}
export function deformPositions(base,weights,radials,state,axis,centre,out=new Float64Array(base.length),distractionWeights=weights){
 for(let i=0;i<base.length;i+=3){const p=deformPoint(base.slice(i,i+3),weights[i/3],radials.slice(i,i+3),state,axis,centre,distractionWeights[i/3]);out.set(p,i);}return out;
}
export function rigidBoundaryFields(parts,fields){
 const next={...fields};
 for(const part of parts){
  if(!['temporal','condyle','disc'].includes(part.name))continue;
  const n=part.p.length/3,k=part.name==='temporal'?0:1;
  next[part.name]={...fields[part.name],w:new Float64Array(n).fill(k),d:new Float64Array(n).fill(part.name==='temporal'?0:1),r:new Float64Array(n*3)};
 }
 return next;
}
