import {shaftDirection,testCylinder} from './collision-r38.mjs';

// Every accepted interval is enclosed, never merely point-sampled.
// Refine a colliding coarse enclosure instead of treating its padding as anatomy.
export function sweptCylinder(surfaces,pivot,from,to,{radius=.95,length=63.1}={}){
 if(from.yaw===to.yaw&&from.pitch===to.pitch){
  return {...testCylinder(surfaces,pivot,shaftDirection(to.yaw,to.pitch),radius,
   Math.min(from.depth,to.depth)-length,Math.max(from.depth,to.depth)),
   method:'exact translational union',samples:1,inflation:0};
 }
 const angular=(Math.abs(to.yaw-from.yaw)+Math.abs(to.pitch-from.pitch))*Math.PI/180;
 const radiusFromPivot=Math.hypot(Math.max(Math.abs(from.depth),Math.abs(to.depth),
  Math.abs(from.depth-length),Math.abs(to.depth-length)),radius);
 let candidates=0,samples=0,maxInflation=0,acceptedIntervals=0;
 const poseAt=t=>Object.fromEntries(['yaw','pitch','depth'].map(k=>[k,from[k]+(to[k]-from[k])*t]));
 function interval(a,b,level){
  const mid=(a+b)/2,p=poseAt(mid);
  // Angular speed is bounded by |yaw'|+|pitch'|. Arc length is a safe
  // Hausdorff bound for every point of this finite cylinder.
  const inflate=radiusFromPivot*angular*(b-a)/2+Math.abs(to.depth-from.depth)*(b-a)/2+1e-7;
  const r=testCylinder(surfaces,pivot,shaftDirection(p.yaw,p.pitch),radius+inflate,
   p.depth-length-inflate,p.depth+inflate);
  candidates+=r.candidates;samples++;
  if(r.surfaceClear){maxInflation=Math.max(maxInflation,inflate);acceptedIntervals++;return null;}
  // Unresolved intervals are rejected, including tangent and near-contact cases.
  if(inflate<=.002||level>=16)return r.hits;
  return interval(a,mid,level+1)||interval(mid,b,level+1);
 }
 const hits=interval(0,1,0)||[];
 return {hits,candidates,surfaceClear:!hits.length,method:'adaptive enclosed angular sweep',
  samples,inflation:maxInflation,acceptedIntervals,resolutionMM:.002};
}

export function interpolatePose(from,to,t){
 return Object.fromEntries(['yaw','pitch','depth','roll'].map(k=>[k,from[k]+(to[k]-from[k])*t]));
}

// Stop at a proven prefix of the requested path. Never skip an obstruction to
// reach a clear endpoint on its other side.
export function advanceToContact(admit,surfaces,from,to){
 const requested=admit(surfaces,from,to);
 if(requested.accepted)return {...requested,limited:false,fraction:1,requestedPose:{...to}};
 let lo=0,hi=1,best=null;
 for(let i=0;i<11;i++){
  const mid=(lo+hi)/2,r=admit(surfaces,from,interpolatePose(from,to,mid));
  if(r.accepted){lo=mid;best=r;}else hi=mid;
 }
 if(!best||lo<.001)return {...requested,limited:true,fraction:0,requestedPose:{...to}};
 return {...best,limited:true,fraction:lo,requestedPose:{...to},
  contactHits:requested.hits,contactBody:requested.body||false};
}
