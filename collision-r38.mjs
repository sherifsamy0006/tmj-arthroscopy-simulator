// Exact finite-cylinder vs triangle-surface intersection at a pose.
// Clipping and convex projected-polygon method ported from the r27 audit.
// This does not establish solid containment or absent anatomy.
const EPS=1e-8;
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const add=(a,b,k=1)=>a.map((v,i)=>v+k*b[i]);
export const sub=(a,b)=>add(a,b,-1);
export const norm=a=>Math.sqrt(dot(a,a));
export const unit=a=>{const n=norm(a);if(n<1e-12)throw Error('Zero axis');return a.map(v=>v/n);};
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function shaftDirection(yaw,pitch){const y=yaw*Math.PI/180,p=pitch*Math.PI/180;return[Math.cos(p)*Math.sin(y),Math.cos(p)*Math.cos(y),Math.sin(p)];}
function clip(poly,bound,above){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],a=(p[2]-bound)*(above?1:-1)>=0,b=(q[2]-bound)*(above?1:-1)>=0;if(a)out.push(p);if(a!==b)out.push(add(p,sub(q,p),(bound-p[2])/(q[2]-p[2])));}return out;}
export function radialClosest(poly){let best=Infinity,w=null;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],e=sub(q,p),den=e[0]*e[0]+e[1]*e[1],t=den>1e-25?Math.max(0,Math.min(1,-(p[0]*e[0]+p[1]*e[1])/den)):0;const hit=add(p,e,t),d=hit[0]*hit[0]+hit[1]*hit[1];if(d<best){best=d;w=hit;}}
 for(let i=1;i<poly.length-1;i++){const p=poly[0],u=sub(poly[i],p),v=sub(poly[i+1],p),det=u[0]*v[1]-u[1]*v[0];if(Math.abs(det)<1e-16)continue;const a=(-p[0]*v[1]+p[1]*v[0])/det,b=(-u[0]*p[1]+u[1]*p[0])/det;if(a>=-EPS&&b>=-EPS&&a+b<=1+EPS)return{distance:0,point:add(add(p,u,a),v,b)};}
 return{distance:Math.sqrt(best),point:w};}
export function triangleCylinder(triangle,origin,axis,radius,lo,hi=0){const z=unit(axis),x=unit(cross(z,Math.abs(z[2])<.99?[0,0,1]:[0,1,0])),y=cross(z,x),local=triangle.map(p=>{const d=sub(p,origin);return[dot(d,x),dot(d,y),dot(d,z)];});
 if([0,1].some(i=>Math.min(...local.map(p=>p[i]))>radius+EPS||Math.max(...local.map(p=>p[i]))<-radius-EPS)||Math.min(...local.map(p=>p[2]))>hi+EPS||Math.max(...local.map(p=>p[2]))<lo-EPS)return null;
 let poly=clip(local,lo-EPS,true);if(poly.length)poly=clip(poly,hi+EPS,false);if(!poly.length)return null;const r=radialClosest(poly);if(r.distance>radius+EPS)return null;return{radialOverlap:radius-r.distance,point:add(add(add(origin,x,r.point[0]),y,r.point[1]),z,r.point[2])};
}
function tree(items){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of items)for(let k=0;k<3;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}if(items.length<=12)return{min,max,items};const span=max.map((v,k)=>v-min[k]),k=span.indexOf(Math.max(...span));items.sort((a,b)=>a.min[k]+a.max[k]-b.min[k]-b.max[k]);const mid=items.length>>1;return{min,max,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};}
export function prepareSurfaces(parts){return parts.map(p=>{const triangles=[];for(let i=0;i<p.i.length;i+=3){const v=Array.from(p.i.slice(i,i+3),n=>Array.from(p.p.slice(n*3,n*3+3),Math.fround));triangles.push({v,min:[0,1,2].map(k=>Math.min(...v.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...v.map(p=>p[k])))});}return{name:p.name,triangles,tree:tree(triangles.slice())};});}
export function testCylinder(surfaces,origin,axis,radius,lo,hi=0){const hits=[];let candidates=0;
 for(const s of surfaces){const o=s.inversePoint?s.inversePoint(origin):origin,d=s.inverseAxis?s.inverseAxis(axis):axis,a=add(o,d,lo),b=add(o,d,hi),min=a.map((v,k)=>Math.min(v,b[k])-radius-EPS),max=a.map((v,k)=>Math.max(v,b[k])+radius+EPS);let count=0,witness=null;
 const overlaps=t=>[0,1,2].every(k=>t.max[k]>=min[k]&&t.min[k]<=max[k]);function visit(t){if(!overlaps(t))return;if(t.items){for(const q of t.items){if(!overlaps(q))continue;candidates++;const h=triangleCylinder(q.v,o,d,radius,lo,hi);if(h){count++;if(!witness||h.radialOverlap>witness.radialOverlap)witness=h;}}}else{visit(t.left);visit(t.right);}}visit(s.tree);if(count)hits.push({surface:s.name,count,...witness,point:s.forwardPoint?s.forwardPoint(witness.point):witness.point});
 }return{hits,candidates,surfaceClear:hits.length===0};
}
export function sweptCylinder(surfaces,pivot,from,to,{radius=.95,length=63.1}={}){
 // Insertion on an unchanged axis: the exact union is one longer cylinder.
 if(from.yaw===to.yaw&&from.pitch===to.pitch){const axis=shaftDirection(to.yaw,to.pitch),r=testCylinder(surfaces,pivot,axis,radius,Math.min(from.depth,to.depth)-length,Math.max(from.depth,to.depth));return{...r,method:'exact translational union',samples:1,inflation:0};}
 // A conservative enclosure covers the motion between angular samples.
 // |dyaw|+|dpitch| bounds total angular travel; radius+axial inflation
 // contains the Euclidean displacement from each interval's closest sample.
 const angular=(Math.abs(to.yaw-from.yaw)+Math.abs(to.pitch-from.pitch))*Math.PI/180,n=Math.max(1,Math.ceil(angular/(Math.PI/180))),R=Math.hypot(length+Math.max(Math.abs(from.depth),Math.abs(to.depth)),radius),inflate=2*R*Math.sin(Math.min(Math.PI,angular/n)/4)+Math.abs(to.depth-from.depth)/(2*n),hits=new Map();let candidates=0;
 for(let j=0;j<=n;j++){const t=j/n,p={yaw:from.yaw+(to.yaw-from.yaw)*t,pitch:from.pitch+(to.pitch-from.pitch)*t,depth:from.depth+(to.depth-from.depth)*t};const r=testCylinder(surfaces,pivot,shaftDirection(p.yaw,p.pitch),radius+inflate,p.depth-length-inflate,p.depth+inflate);candidates+=r.candidates;for(const h of r.hits)if(!hits.has(h.surface))hits.set(h.surface,h);if(hits.size)break;}
 return{hits:[...hits.values()],candidates,surfaceClear:hits.size===0,method:'conservative angular sweep',samples:n+1,inflation:inflate};
}
