// Shading attributes only: source triangles and deformed positions stay exact.
// Tissue transitions are interpolated, rather than painted as hard triangle groups.
export function tissueWeights(name){
 const weights=[0,0,0,0],parts=name.split('|');
 for(const part of parts){
  const k=['temporal','condyle'].includes(part)?0:part==='disc'?1:part.includes('retro')?2:3;
  weights[k]+=1/parts.length;
 }
 return weights;
}
export function createLining(T,cavity,material){
 const {part,g:source}=cavity,n=part.p.length/3,weights=new Float32Array(n*4),totals=new Float64Array(n),adj=Array.from({length:n},()=>new Set());
 for(let f=0;f<part.i.length;f+=3){
  const ids=part.i.slice(f,f+3),a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
  const u=[0,1,2].map(k=>part.p[b+k]-part.p[a+k]),v=[0,1,2].map(k=>part.p[c+k]-part.p[a+k]);
  const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
  const w=tissueWeights(part.faceBoundaries[f/3]);
  for(const id of ids){totals[id]+=area;for(let k=0;k<4;k++)weights[id*4+k]+=w[k]*area;for(const other of ids)if(other!==id)adj[id].add(other);}
 }
 for(let i=0;i<n;i++)for(let k=0;k<4;k++)weights[i*4+k]/=totals[i]||1;
 // One local pass removes tessellation-dependent colour edges without shifting anatomy.
 const mixed=weights.slice();
 for(let i=0;i<n;i++)if(adj[i].size)for(let k=0;k<4;k++){
  let sum=0;for(const j of adj[i])sum+=weights[j*4+k];
  mixed[i*4+k]=weights[i*4+k]*.7+sum/adj[i].size*.3;
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',source.attributes.position);
 g.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(n*3),3));
 g.setAttribute('tissueRestNormal',source.attributes.normal.clone());
 g.setAttribute('tissueRest',new T.Float32BufferAttribute(part.p,3));
 g.setAttribute('tissueMix',new T.Float32BufferAttribute(mixed,4));
 g.setIndex(part.i);
 const mesh=new T.Mesh(g,material);mesh.name='joint-space-lining';
 function update(){
  // Smooth lighting normals only. Preserve opposing walls and sharp fold directions.
  let normals=source.attributes.normal.array.slice();
  for(let pass=0;pass<4;pass++){
   const next=normals.slice();
   for(let i=0;i<n;i++){
    const o=i*3,a=normals.subarray(o,o+3),sum=[a[0]*2,a[1]*2,a[2]*2];
    for(const j of adj[i]){
     const q=j*3,dot=a[0]*normals[q]+a[1]*normals[q+1]+a[2]*normals[q+2];
     if(dot<.15)continue;
     const w=Math.max(.3,dot);for(let k=0;k<3;k++)sum[k]+=normals[q+k]*w;
    }
    const len=Math.hypot(...sum)||1;for(let k=0;k<3;k++)next[o+k]=sum[k]/len;
   }
   normals=next;
  }
  g.attributes.normal.array.set(normals);g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();
 }
 update();
 return{mesh,update,boundaries:part.faceBoundaries};
}
