import {smoothTissueNormals} from './normals-r46.mjs';
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
 const {part,g:source}=cavity,n=part.p.length/3,weights=new Float32Array(n*4),totals=new Float64Array(n);
 const parent=Uint32Array.from({length:n},(_,i)=>i);
 for(let j=0;j<(part.mergeFrom?.length||0);j++)parent[part.mergeFrom[j]]=part.mergeTo[j];
 const root=i=>{while(parent[i]!==i)i=parent[i];return i;};
 const canonical=Array.from({length:n},(_,i)=>root(i)),welded=Array.from(part.i,i=>canonical[i]),weldAdj=Array.from({length:n},()=>new Set());
 for(let f=0;f<welded.length;f+=3){const ids=welded.slice(f,f+3);for(const id of ids)for(const other of ids)if(id!==other)weldAdj[id].add(other);}
 for(let f=0;f<part.i.length;f+=3){
  const ids=part.i.slice(f,f+3),a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
  const u=[0,1,2].map(k=>part.p[b+k]-part.p[a+k]),v=[0,1,2].map(k=>part.p[c+k]-part.p[a+k]);
  const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
  const w=tissueWeights(part.faceBoundaries[f/3]);
  for(const id of ids){const c=canonical[id];totals[c]+=area;for(let k=0;k<4;k++)weights[c*4+k]+=w[k]*area;}
 }
 for(let i=0;i<n;i++)if(canonical[i]===i)for(let k=0;k<4;k++)weights[i*4+k]/=totals[i]||1;
 // Metric colour transition on the prepared tissue surface. One adjacency
 // pass is resolution-dependent and made the rebuilt lining look like paint.
 // Surface-area quadrature keeps dense Boolean slivers from dominating tint.
 const rest=part.textureRest||part.rest||part.p;
 const restNormals=smoothTissueNormals(rest,welded,weldAdj);for(let i=0;i<n;i++)restNormals.set(restNormals.slice(canonical[i]*3,canonical[i]*3+3),i*3);
 const mixed=weights.slice(),radius=.55,sigma=.25,grid=new Map();
 const cell=i=>[0,1,2].map(k=>Math.floor(rest[i*3+k]/radius));
 for(let i=0;i<n;i++)if(canonical[i]===i){const key=cell(i).join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);}
 for(let i=0;i<n;i++)if(canonical[i]===i){
  const c=cell(i),sum=[0,0,0,0];let total=0;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const j of grid.get([c[0]+x,c[1]+y,c[2]+z].join(','))||[]){
   let d2=0,nd=0;for(let k=0;k<3;k++){d2+=(rest[j*3+k]-rest[i*3+k])**2;nd+=restNormals[j*3+k]*restNormals[i*3+k];}
   if(d2>radius*radius||nd<-.15)continue;
   const w=Math.exp(-d2/(2*sigma*sigma))*totals[j];total+=w;for(let k=0;k<4;k++)sum[k]+=weights[j*4+k]*w;
  }
  if(total)for(let k=0;k<4;k++)mixed[i*4+k]=weights[i*4+k]*.2+sum[k]/total*.8;
 }
 // Boolean boundary vertices can be duplicated for source provenance. They are
 // one physical location and must receive the same tissue pigment mixture.
 for(let i=0;i<n;i++)if(canonical[i]!==i)for(let k=0;k<4;k++)mixed[i*4+k]=mixed[canonical[i]*4+k];
 const g=new T.BufferGeometry();
 g.setAttribute('position',source.attributes.position);
 g.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(n*3),3));
 g.setAttribute('tissueRestNormal',new T.Float32BufferAttribute(restNormals,3));
 g.setAttribute('tissueRest',new T.Float32BufferAttribute(part.textureRest||part.rest||part.p,3));
 g.setAttribute('tissueMix',new T.Float32BufferAttribute(mixed,4));
 g.setIndex(new T.BufferAttribute(Uint32Array.from(part.i),1));
 const mesh=new T.Mesh(g,material);mesh.name='joint-space-lining';mesh.castShadow=true;mesh.receiveShadow=true;
 function update(){
  const normals=smoothTissueNormals(source.attributes.position.array,welded,weldAdj);for(let i=0;i<n;i++)normals.set(normals.slice(canonical[i]*3,canonical[i]*3+3),i*3);
  g.attributes.normal.array.set(normals);g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();
 }
 update();
 return{mesh,update,boundaries:part.faceBoundaries};
}

