import {deformPositions} from './joint-model-r47.mjs';
// New attachment vertices follow their named boundary points after deformation.
// This is a geometric reconstruction of the computational closure, not tissue FEM.
export function deformEnclosure(c,state,model){
 const p=deformPositions(c.part.p,c.field.w,c.field.r,state,model.axis,model.centre,undefined,c.field.d);
 for(const a of c.attachments||[]){
  if(a.indices.length!==a.weights.length||Math.abs(a.weights.reduce((s,w)=>s+w,0)-1)>1e-8)throw Error('Invalid enclosure attachment');
  for(let k=0;k<3;k++){let sum=0;for(let j=0;j<a.indices.length;j++)sum+=a.weights[j]*p[a.indices[j]*3+k];p[a.vertex*3+k]=sum;}
 }
 return p;
}
