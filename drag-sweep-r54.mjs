import {add,shaftDirection,triangleCylinder} from './collision-r38.mjs';
import {PIVOT,DEPTH_OFFSET,TOOL,validatePose} from './navigation-r49.mjs';
const EPS=1e-8;
// Identical finite-cylinder predicate and BVH bounds; a rejection needs one
// witness, not a census of every intersecting triangle in the whole head.
export function firstCylinderContact(surfaces,origin,axis,radius,lo,hi){
 let candidates=0;
 for(const s of surfaces){
  const o=s.inversePoint?s.inversePoint(origin):origin,d=s.inverseAxis?s.inverseAxis(axis):axis;
  const a=add(o,d,lo),b=add(o,d,hi),min=a.map((v,k)=>Math.min(v,b[k])-radius-EPS),max=a.map((v,k)=>Math.max(v,b[k])+radius+EPS);
  const overlaps=t=>[0,1,2].every(k=>t.max[k]>=min[k]&&t.min[k]<=max[k]);
  function visit(t){if(!overlaps(t))return null;if(t.items){for(const q of t.items){if(!overlaps(q))continue;candidates++;const h=triangleCylinder(q.v,o,d,radius,lo,hi);if(h)return h;}return null;}return visit(t.left)||visit(t.right);}
  const h=visit(s.tree);if(h)return{surfaceClear:false,candidates,hits:[{surface:s.name,count:1,witnessOnly:true,...h,point:s.forwardPoint?s.forwardPoint(h.point):h.point}]};
 }
 return{surfaceClear:true,candidates,hits:[]};
}
const wrap=v=>((v+180)%360+360)%360-180;
export const interpolatePose=(a,b,t)=>Object.fromEntries(['yaw','pitch','depth','roll'].map(k=>[k,k==='roll'?wrap(a[k]+wrap(b[k]-a[k])*t):a[k]+(b[k]-a[k])*t]));
const lerp=interpolatePose;
// Walk the path once, chronologically. Each accepted interval encloses the
// complete shaft AND proximal body, using the existing conservative arc bound.
// On obstruction return the proven prefix, instead of repeating the entire
// expensive sweep eleven times in a binary search.
export function traceDrag(surfaces,from,to){
 validatePose(from);validatePose(to);
 const angularDegrees=Math.abs(to.yaw-from.yaw)+Math.abs(to.pitch-from.pitch),angular=angularDegrees*Math.PI/180,depthDelta=Math.abs(to.depth-from.depth);
 let end=0,hits=[],samples=0,candidates=0,body=false;
 const segments=[{length:TOOL.length,radius:TOOL.radius,shift:0},{length:TOOL.overall-TOOL.length,radius:TOOL.bodyRadius,shift:TOOL.length}];
 function interval(a,b,level){
  const p=lerp(from,to,(a+b)/2),axis=shaftDirection(p.yaw,p.pitch);let collision=null,maxInflation=0;
  for(const seg of segments){
   const d0=from.depth-DEPTH_OFFSET-seg.shift,d1=to.depth-DEPTH_OFFSET-seg.shift;
   const reach=Math.hypot(Math.max(Math.abs(d0),Math.abs(d1),Math.abs(d0-seg.length),Math.abs(d1-seg.length)),seg.radius);
   const inflate=reach*angular*(b-a)/2+depthDelta*(b-a)/2+1e-7,depth=p.depth-DEPTH_OFFSET-seg.shift;
   maxInflation=Math.max(maxInflation,inflate);
   const da=d0+(d1-d0)*a,db=d0+(d1-d0)*b;
   const r=angular===0
    ?firstCylinderContact(surfaces,PIVOT,axis,seg.radius,Math.min(da,db)-seg.length,Math.max(da,db))
    :firstCylinderContact(surfaces,PIVOT,axis,seg.radius+inflate,depth-seg.length-inflate,depth+inflate);samples++;candidates+=r.candidates;
   if(!r.surfaceClear){collision=r;body=seg.shift>0;break;}
  }
  if(!collision){end=b;return true;}
  if(maxInflation<=.002||level>=16){hits=collision.hits;return false;}
  const mid=(a+b)/2;return interval(a,mid,level+1)&&interval(mid,b,level+1);
 }
 const clear=interval(0,1,0);
 // A small retreat inside the already-proven prefix avoids parking at a
 // numerically tangent limit. It also leaves room for a small reverse gesture.
 const retreat=clear?0:1/Math.max(1,angularDegrees/.08,depthDelta/.01);
 const fraction=clear?1:Math.max(0,end-retreat),accepted=clear||fraction>1e-8;
 return{accepted,pose:accepted?lerp(from,to,fraction):{...from},limited:!clear,fraction,provenFraction:end,requestedPose:{...to},hits:accepted?[]:hits,contactHits:hits,body,contactBody:body,samples,candidates,resolutionMM:.002,method:'chronological complete-instrument enclosed sweep',contactRetreat:!clear};
}
