// Conservative continuous contact for the reconstructed articular surfaces.
// Paths are linear vertex trajectories between accepted geometry states.
// No force, material modulus or patient trajectory is inferred by this guard.
import {dot,sub,add,cross,norm} from './simulator-collision.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
export function pointTriangle(p,t){
 const [a,b,c]=t,ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return a;
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return add(a,ab,d1/(d1-d3));
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return add(a,ac,d2/(d2-d6));
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return add(b,sub(c,b),(d4-d3)/(d4-d3+d5-d6));
 const sum=va+vb+vc;if(Math.abs(sum)<1e-24)return a;return add(add(a,ab,vb/sum),ac,vc/sum);
}
function segmentDistance(p,q,r,s){const u=sub(q,p),v=sub(s,r),w=sub(p,r),a=dot(u,u),b=dot(u,v),c=dot(v,v),d=dot(u,w),e=dot(v,w);let x=0,y=0;
 if(a<1e-24)return norm(sub(p,add(r,v,c?clamp(e/c):0)));
 if(c<1e-24)return norm(sub(add(p,u,clamp(-d/a)),r));
 const den=a*c-b*b;x=den>1e-24?clamp((b*e-c*d)/den):0;y=(b*x+e)/c;
 if(y<0){y=0;x=clamp(-d/a);}else if(y>1){y=1;x=clamp((b-d)/a);}return norm(sub(add(p,u,x),add(r,v,y)));
}
function segmentHits(p,q,t){const [a,b,c]=t,u=sub(b,a),v=sub(c,a),d=sub(q,p),h=cross(d,v),det=dot(u,h);if(Math.abs(det)<1e-13)return false;const s=sub(p,a),x=dot(s,h)/det;if(x<0||x>1)return false;const z=cross(s,u),y=dot(d,z)/det;if(y<0||x+y>1)return false;const f=dot(v,z)/det;return f>=0&&f<=1;}
export function triangleDistance(a,b){let d=Infinity;for(let i=0;i<3;i++){if(segmentHits(a[i],a[(i+1)%3],b)||segmentHits(b[i],b[(i+1)%3],a))return 0;d=Math.min(d,norm(sub(a[i],pointTriangle(a[i],b))),norm(sub(b[i],pointTriangle(b[i],a))));for(let j=0;j<3;j++)d=Math.min(d,segmentDistance(a[i],a[(i+1)%3],b[j],b[(j+1)%3]));}return d;}
function tree(items){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of items)for(let j=0;j<3;j++){min[j]=Math.min(min[j],t.min[j]);max[j]=Math.max(max[j],t.max[j]);}if(items.length<=8)return{min,max,items};const span=max.map((v,j)=>v-min[j]),axis=span.indexOf(Math.max(...span));items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);const mid=items.length>>1;return{min,max,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};}
function meshPath(a,b){const ts=[];for(let j=0;j<a.i.length;j+=3){const aa=a.i.slice(j,j+3).map(k=>Array.from(a.p.slice(k*3,k*3+3))),bb=a.i.slice(j,j+3).map(k=>Array.from(b.p.slice(k*3,k*3+3))),all=[...aa,...bb];ts.push({id:j/3,a:aa,b:bb,speed:Math.max(...aa.map((p,i)=>norm(sub(p,bb[i])))),min:[0,1,2].map(k=>Math.min(...all.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...all.map(p=>p[k])))});}return tree(ts);}
const overlaps=(a,b,eps)=>[0,1,2].every(i=>a.min[i]<=b.max[i]+eps&&a.max[i]>=b.min[i]-eps);
function pairSweep(a,b,eps){const speed=a.speed+b.speed;if(speed<1e-14)return null;const at=(t,s)=>s.a.map((p,i)=>add(p,sub(s.b[i],p),t));let count=0;
 function visit(lo,hi,depth){count++;const mid=(lo+hi)/2,aa=at(mid,a),bb=at(mid,b),d=triangleDistance(aa,bb);if(d>speed*(hi-lo)/2+eps)return null;if(d<=eps||depth>=20)return{time:mid,distance:d,point:aa[0],iterations:count};return visit(lo,mid,depth+1)||visit(mid,hi,depth+1);}
 return visit(0,1,0);
}
export function tissueSweep(before,after,{tolerance=1e-5,coRigidDiscCondyle=false}={}){
 const names=['temporal','condyle','disc'],paths=Object.fromEntries(names.map(n=>[n,meshPath(before.find(p=>p.name===n),after.find(p=>p.name===n))]));let pairs=0;
 // An identical rigid transform preserves every disc/condyle separation.
 // Enable only after verifying the caller uses the same rigid transform.
 for(const [a,b]of(coRigidDiscCondyle?[['temporal','condyle'],['temporal','disc']]:[['temporal','condyle'],['temporal','disc'],['condyle','disc']])){
  function walk(x,y){if(!overlaps(x,y,tolerance))return null;if(x.items&&y.items){for(const m of x.items)for(const n of y.items){if(!overlaps(m,n,tolerance))continue;pairs++;const r=pairSweep(m,n,tolerance);if(r)return{...r,triangles:[m.id,n.id]};}return null;}if(x.items)return walk(x,y.left)||walk(x,y.right);if(y.items)return walk(x.left,y)||walk(x.right,y);return walk(x.left,y.left)||walk(x.left,y.right)||walk(x.right,y.left)||walk(x.right,y.right);}
  const hit=walk(paths[a],paths[b]);if(hit)return{clear:false,pairs,hits:[{surface:`${a} ↔ ${b}`,kind:'tissue contact',...hit}],method:'continuous triangle-distance enclosure',tolerance};
 }
 return{clear:true,pairs,hits:[],method:'continuous triangle-distance enclosure',tolerance};
}
