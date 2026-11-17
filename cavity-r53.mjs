// A derived fluid domain: estimated enclosure minus exact transformed source
// solids. A bounded estimated posterior envelope is unioned before subtraction.
// Original hard surfaces and their instrument collision checks remain exact.
// This module never replaces the untouched source collision surfaces.
import Module from './vendor/manifold-3.5.4/manifold.js';
import * as M from './joint-model-r47.mjs';
import {deformEnclosure} from './enclosure-r48.mjs';
export async function createCavityBuilder({enclosures,solids,model}){
 solids=solids.map(s=>({...s,name:s.name==='skull'?'temporal':s.name==='mandible'?'condyle':s.name,faceBoundaries:s.capMask?s.i.filter((_,i)=>i%3===0).map((_,f)=>s.capMask[f]?'operand-cap':s.faceBoundaries[f]):s.faceBoundaries}));
 const wasm=await Module();wasm.setup();const {Manifold,Mesh}=wasm;
 const names=[...new Set([...enclosures.flatMap(c=>[c,...(c.overlays||[])].flatMap(o=>o.part.faceBoundaries)),...solids.flatMap(s=>s.faceBoundaries||[s.name])])];
 const provenance=[],sourceIDs=new Map();
 for(const part of [...enclosures.flatMap(c=>[c.part,...(c.overlays||[]).map(o=>o.part)]),...solids]){const ids=Uint32Array.from({length:part.i.length/3},(_,face)=>{const id=provenance.length;provenance.push({source:part.name,provenanceGroup:part.provenanceGroup||part.name,face,label:part.faceBoundaries?.[face]||part.name});return id;});sourceIDs.set(part,ids);}
 function solid(part,positions=part.p,materialReference=part.p){
  const props=new Float32Array(positions.length*3);
  for(let v=0;v<positions.length/3;v++)for(let k=0;k<3;k++){props[9*v+k]=positions[3*v+k];props[9*v+3+k]=part.p[3*v+k];props[9*v+6+k]=materialReference[3*v+k];}
  let indices=Uint32Array.from(part.i);
  if(M.signedVolume(positions,indices)<0){indices=indices.slice();for(let j=0;j<indices.length;j+=3)[indices[j+1],indices[j+2]]=[indices[j+2],indices[j+1]];}
  return new Manifold(new Mesh({numProp:9,vertProperties:props,triVerts:indices,faceID:sourceIDs.get(part)}));
 }
 // Reference material metric at the prepared joint. The neutral soft enclosure
 // is almost collapsed: using its raw coordinates stretches vessel pigment into
 // long rails after distraction. This extra interpolated attribute is appearance
 // only; original rest positions and exact collision geometry remain unchanged.
 const referenceState={...M.DEFAULTS,angle:0,anterior:0,distraction:2.5,wall:0};
 const materialReferences=new Map(enclosures.flatMap(c=>[c,...(c.overlays||[])]).map(c=>[c.part,deformEnclosure(c,referenceState,model)]));
 for(const s of solids)materialReferences.set(s,s.name==='temporal'?s.p:Array.from({length:s.p.length/3},(_,i)=>M.rigidPoint(s.p.slice(i*3,i*3+3),0,0,model.axis,model.centre,2.5)).flat());
 const fixed=solids.filter(s=>s.name==='temporal').map(s=>solid(s));
 function build(state,{onlyUpper=false}={}){
  const began=performance.now(),moving=solids.filter(s=>s.name!=='temporal').map(s=>solid(s,Array.from({length:s.p.length/3},(_,i)=>M.rigidPoint(s.p.slice(i*3,i*3+3),state.angle,state.anterior,model.axis,model.centre,state.distraction)).flat(),materialReferences.get(s))),result=[];
  try{for(const c of onlyUpper?enclosures.slice(0,1):enclosures){
   const p=deformEnclosure(c,state,model),base=solid(c.part,p,materialReferences.get(c.part));let output=base;
   let originalVolume;
   try{
    for(const overlay of c.overlays||[]){
     const extra=solid(overlay.part,deformEnclosure(overlay,state,model),materialReferences.get(overlay.part));
     try{const next=output.add(extra);if(output!==base)output.delete();output=next;}finally{extra.delete();}
    }
    originalVolume=output.volume()/1000;
    for(const operand of [...fixed,...moving]){const next=output.subtract(operand);if(output!==base)output.delete();output=next;}
    if(output.status()!=='NoError'||output.isEmpty())throw Error('Fluid domain could not be reconstructed');
    // A uniform-pressure chamber must be connected. Boolean clipping leaves
    // tiny isolated numerical pockets; exclude them explicitly, and reject a
    // substantial split instead of silently joining disconnected fluid.
    const components=output.decompose().sort((a,b)=>b.volume()-a.volume()),totalVolume=output.volume()/1000;
    const excludedVolume=components.slice(1).reduce((v,p)=>v+p.volume()/1000,0),excludedComponents=components.length-1;
    if(excludedVolume>Math.min(1e-5,totalVolume*.001)){for(const part of components)part.delete();throw Error('Reconstructed fluid chamber split into disconnected regions');}
    const principal=components.shift();for(const part of components)part.delete();if(output!==base)output.delete();output=principal;
    const mesh=output.getMesh(),positions=new Float32Array(mesh.numVert*3),rest=new Float32Array(mesh.numVert*3),textureRest=new Float32Array(mesh.numVert*3);
    for(let i=0;i<mesh.numVert;i++)for(let k=0;k<3;k++){positions[3*i+k]=mesh.vertProperties[mesh.numProp*i+k];rest[3*i+k]=mesh.vertProperties[mesh.numProp*i+k+3];textureRest[3*i+k]=mesh.vertProperties[mesh.numProp*i+k+6];}
    const volume=output.volume()/1000;if(!(volume>0)||volume>originalVolume+1e-8)throw Error('Invalid reconstructed cavity volume');
    if(mesh.faceID.some(id=>!provenance[id]))throw Error('Cavity source provenance is incomplete');
    const faceBoundaries=Array.from(mesh.faceID,id=>provenance[id].label);
    if(faceBoundaries.includes('operand-cap'))throw Error('Distant operand cap entered the joint domain');
    result.push({name:c.part.name,p:positions,i:mesh.triVerts,rest,textureRest,faceBoundaries,sourceFaces:Array.from(mesh.faceID,id=>provenance[id]),rim:c.part.rim||[],volume,enclosureVolume:originalVolume,removedVolume:originalVolume-volume,excludedComponents,excludedVolume,connectedComponents:1,method:c.overlays?.length?'principal connected reconstructed posterior enclosure union minus original source solids':'principal connected enclosure minus original source solids',mergeFrom:mesh.mergeFromVert,mergeTo:mesh.mergeToVert});
   }finally{if(output!==base)output.delete();base.delete();}
  }}finally{for(const m of moving)m.delete();}
  return {parts:result,elapsedMS:performance.now()-began};
 }
 return{build,dispose(){for(const m of fixed)m.delete();},labels:names};
}
