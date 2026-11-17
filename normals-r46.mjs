// Lighting-only normals. Position/index buffers, collision, ray hits and volume
// are never changed. Angle weighting avoids bias from long skinny closure faces.
export function smoothTissueNormals(p,indices,adj){
 const n=p.length/3,normals=new Float64Array(p.length);
 for(let f=0;f<indices.length;f+=3){
  const ids=[indices[f],indices[f+1],indices[f+2]],a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
  const u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],v=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
  const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...normal);
  if(len<1e-14)continue;
  for(let k=0;k<3;k++)normal[k]/=len;
  for(let j=0;j<3;j++){
   const o=ids[j]*3,q=ids[(j+1)%3]*3,r=ids[(j+2)%3]*3;
   const x=[p[q]-p[o],p[q+1]-p[o+1],p[q+2]-p[o+2]],y=[p[r]-p[o],p[r+1]-p[o+1],p[r+2]-p[o+2]];
   const dot=x.reduce((s,z,k)=>s+z*y[k],0),cross=Math.hypot(x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]);
   const angle=Math.atan2(cross,dot);
   for(let k=0;k<3;k++)normals[o+k]+=normal[k]*angle;
  }
 }
 for(let i=0;i<n;i++){const o=i*3,len=Math.hypot(normals[o],normals[o+1],normals[o+2]);if(len>1e-12)for(let k=0;k<3;k++)normals[o+k]/=len;else normals[o+2]=1;}
 let current=normals;
 // Distance weights limit the influence of coarse, long closure edges.
 // The original direction anchors each pass; opposite fold walls do not mix.
 for(let pass=0;pass<3;pass++){
  const next=current.slice();
  for(let i=0;i<n;i++){
   const o=i*3,sum=[normals[o]*2,normals[o+1]*2,normals[o+2]*2];
   for(const j of adj[i]){
    const q=j*3,dot=normals[o]*normals[q]+normals[o+1]*normals[q+1]+normals[o+2]*normals[q+2];
    if(dot<=.1)continue;
    const d2=(p[q]-p[o])**2+(p[q+1]-p[o+1])**2+(p[q+2]-p[o+2])**2;
    const w=Math.exp(-d2/.16)*dot*dot;
    for(let k=0;k<3;k++)sum[k]+=current[q+k]*w;
   }
   const len=Math.hypot(...sum)||1;for(let k=0;k<3;k++)next[o+k]=sum[k]/len;
  }
  current=next;
 }
 return new Float32Array(current);
}
