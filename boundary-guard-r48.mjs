// Strict validation of each rebuilt cavity. Hard-source and full-instrument
// continuous sweeps are performed independently in the navigation worker.
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a);
function bary(p,t){const u=sub(t[1],t[0]),v=sub(t[2],t[0]),q=sub(p,t[0]),a=dot(u,u),b=dot(u,v),c=dot(v,v),d=dot(q,u),e=dot(q,v),det=a*c-b*b;if(det<1e-22)return null;const y=(c*d-b*e)/det,z=(a*e-b*d)/det;return[1-y-z,y,z];}
function intersection(a,b){
 const points=[],epsilon=1e-7;
 for(const [x,t]of[[a,b],[b,a]]){
  const n=cross(sub(t[1],t[0]),sub(t[2],t[0])),ln=norm(n);if(ln<1e-12)continue;
  const distances=x.map(p=>dot(sub(p,t[0]),n)/ln);
  if(distances.every(d=>d>epsilon)||distances.every(d=>d< -epsilon))continue;
  for(let j=0;j<3;j++){
   const p=x[j],q=x[(j+1)%3],d=distances[j],e=distances[(j+1)%3];
   if(Math.abs(d)<epsilon){const c=bary(p,t);if(c&&c.every(v=>v>=-epsilon&&v<=1+epsilon))points.push(p);}
   if(d*e<0){const u=d/(d-e),v=p.map((z,k)=>z+u*(q[k]-z)),c=bary(v,t);if(c&&c.every(z=>z>=-epsilon&&z<=1+epsilon))points.push(v);}
  }
  // Coplanar edge crossings, including overlaps with no contained vertices.
  if(distances.every(d=>Math.abs(d)<epsilon)){
   const axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),axes=[0,1,2].filter(k=>k!==axis);
   for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const p=x[i],q=x[(i+1)%3],r=t[j],s=t[(j+1)%3],u=sub(q,p),v=sub(s,r),w=sub(r,p),[h,k]=axes,den=u[h]*v[k]-u[k]*v[h];if(Math.abs(den)<1e-14)continue;
    const c=(w[h]*v[k]-w[k]*v[h])/den,d=(w[h]*u[k]-w[k]*u[h])/den;
    if(c>=0&&c<=1&&d>=0&&d<=1)points.push(p.map((z,k)=>z+c*u[k]));
   }
  }
 }
 if(!points.length)return null;
 return {points};
}
const overlap=(a,b)=>a.min[0]<=b.max[0]+1e-7&&a.max[0]>=b.min[0]-1e-7&&a.min[1]<=b.max[1]+1e-7&&a.max[1]>=b.min[1]-1e-7&&a.min[2]<=b.max[2]+1e-7&&a.max[2]>=b.min[2]-1e-7;
function tree(items){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of items)for(let k=0;k<3;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}
 if(items.length<=12)return{min,max,items};const span=max.map((v,k)=>v-min[k]),k=span.indexOf(Math.max(...span));items.sort((a,b)=>a.min[k]+a.max[k]-b.min[k]-b.max[k]);const mid=items.length>>1;return{min,max,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};
}
function mesh(part){
 const vertices=Array.from({length:part.p.length/3},(_,i)=>[part.p[i*3],part.p[i*3+1],part.p[i*3+2]]);const faces=[];for(let f=0;f<part.i.length;f+=3){const ids=Array.from(part.i.slice(f,f+3)),p=ids.map(i=>vertices[i]);faces.push({id:f/3,ids,p,soft:part.faceBoundaries?!['temporal','condyle','disc'].includes(part.faceBoundaries[f/3]):false,min:[0,1,2].map(k=>Math.min(...p.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...p.map(v=>v[k])))});}
 for(const f of faces){f.n=cross(sub(f.p[1],f.p[0]),sub(f.p[2],f.p[0]));f.l=norm(f.n);}
 return{part,faces,tree:tree(faces.slice())};
}
function eachPair(a,b,visit){if(!overlap(a,b))return;if(a.items&&b.items){for(const x of a.items)for(const y of b.items)if(overlap(x,y)&&visit(x,y)===false)return false;return;}if(a.items)return eachPair(a,b.left,visit)===false?false:eachPair(a,b.right,visit);if(b.items)return eachPair(a.left,b,visit)===false?false:eachPair(a.right,b,visit);for(const x of[a.left,a.right])for(const y of[b.left,b.right])if(eachPair(x,y,visit)===false)return false;}
function selfPairs(node,visit){if(node.items){for(let i=0;i<node.items.length;i++)for(let j=i+1;j<node.items.length;j++){const a=node.items[i],b=node.items[j];if(overlap(a,b)&&visit(a,b)===false)return false;}return;}if(selfPairs(node.left,visit)===false||selfPairs(node.right,visit)===false)return false;return eachPair(node.left,node.right,visit);}
// Boolean topology changes on every step. Validate the resulting cavity,
// including hard facets, rather than a reference triangle's normal or the
// computational material removed by subtraction. Property seams are welded
// using Manifold's explicit vertex correspondence, never a spatial tolerance.
export function validateCavityDomain(parts){
 const began=performance.now();let pairs=0,triangles=0;
 const fail=(surface,kind,details={})=>({clear:false,hits:[{surface,kind,...details}],method:'rebuilt cavity topology and sampled self-intersection',continuous:false,pairs,elapsedMS:performance.now()-began});
 for(const part of parts){
  const count=part.p.length/3,parent=Uint32Array.from({length:count},(_,i)=>i);
  for(let j=0;j<(part.mergeFrom?.length||0);j++)parent[part.mergeFrom[j]]=part.mergeTo[j];
  const root=i=>{let n=i,steps=0;while(parent[n]!==n){n=parent[n];if(++steps>count)throw Error('Invalid cavity seam correspondence');}while(parent[i]!==i){const next=parent[i];parent[i]=n;i=next;}return n;};
  const indices=Array.from(part.i,root),edges=new Map();let signedVolume=0;
  if(!part.p.every(Number.isFinite)||!(part.volume>0))return fail(part.name,'invalid cavity coordinates or volume');
  for(let j=0;j<indices.length;j+=3){
   const p=part.p,a=3*indices[j],b=3*indices[j+1],c=3*indices[j+2];signedVolume+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);
   for(let k=0;k<3;k++){const a=indices[j+k],b=indices[j+(k+1)%3],key=Math.min(a,b)*count+Math.max(a,b),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}
  }
  signedVolume/=6000;if(!(signedVolume>0)||Math.abs(signedVolume-part.volume)>Math.max(1e-7,part.volume*1e-6))return fail(part.name,'rendered volume or orientation mismatch');
  for(const e of edges.values())if(e[0]!==2||e[1]!==0)return fail(part.name,'cavity is not closed and consistently wound');
  const c=mesh({...part,i:indices});triangles+=c.faces.length;
  for(const f of c.faces)if(f.l<1e-12)return fail(part.name,'degenerate cavity triangle',{face:f.id});
  let hit=null;
  selfPairs(c.tree,(a,b)=>{
   pairs++;
   const shared=a.ids.filter(i=>b.ids.includes(i));if(shared.length===3){hit={faces:[a.id,b.id],kind:'duplicate cavity face'};return false;}
   const na=a.n,nb=b.n,la=a.l,lb=b.l;
   if(shared.length){
    if(shared.length===2&&norm(cross(na,nb))>1e-7*la*lb)return;
    const da=a.p.filter((_,k)=>!shared.includes(a.ids[k])).map(p=>dot(sub(p,b.p[0]),nb)/lb),db=b.p.filter((_,k)=>!shared.includes(b.ids[k])).map(p=>dot(sub(p,a.p[0]),na)/la);
    if(da.every(d=>d>1e-7)||da.every(d=>d< -1e-7)||db.every(d=>d>1e-7)||db.every(d=>d< -1e-7))return;
    // Float32 Boolean clips can create sub-micron slivers with unstable
    // planes. At a shared vertex, require a meaningful noncoplanar signed
    // spread before applying the stated 20 nm penetration tolerance.
    // Coplanar/near-coplanar overlaps still receive the full predicate.
    const separatedWithinPrecision=d=>(Math.max(...d)>2e-5&&Math.min(...d)>=-2e-5)||(Math.min(...d)<-2e-5&&Math.max(...d)<=2e-5);
    if(shared.length===1&&(separatedWithinPrecision(da)||separatedWithinPrecision(db)))return;
    // With opposite edge winding, aligned coplanar normals put the two
    // triangles on opposite sides of their shared edge.
    if(shared.length===2&&dot(na,nb)>0&&da.every(d=>Math.abs(d)<1e-7)&&db.every(d=>Math.abs(d)<1e-7))return;
   }
   const contact=intersection(a.p,b.p);if(!contact)return;
   const common=shared.map(id=>a.p[a.ids.indexOf(id)]),tolerance=2e-5;
   const beyond=p=>{if(!common.length)return true;if(common.length===1)return norm(sub(p,common[0]))>tolerance;const v=sub(common[1],common[0]),u=sub(p,common[0]),t=Math.max(0,Math.min(1,dot(u,v)/dot(v,v)));return norm(u.map((x,k)=>x-t*v[k]))>tolerance;};
   if(!contact.points.some(beyond))return;
   if(!common.length&&!contact.points.some(p=>contact.points.some(q=>norm(sub(p,q))>tolerance)))return;
   hit={faces:[a.id,b.id],point:contact.points.find(beyond),kind:'rebuilt cavity self-intersection'};return false;
  });
  if(hit)return fail(part.name,hit.kind,hit);
 }
 return{clear:true,hits:[],method:'rebuilt cavity topology and sampled self-intersection',continuous:false,spatialToleranceMM:2e-5,triangles,pairs,elapsedMS:performance.now()-began};
}
