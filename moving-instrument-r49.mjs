// The temporal bone is stationary. Only the disc/mandible cluster needs a
// motion enclosure; inflating the stationary roof would forbid harmless motion.
import {admit} from './navigation-r49.mjs';
export function admitMovingJoint(from,to,pose,{fixed,movingAt,radius=170}){
 const stationary=admit(fixed,null,pose);if(!stationary.accepted)return stationary;
 const at=t=>Object.fromEntries(Object.keys(to).map(k=>[k,['angle','anterior','distraction','wall'].includes(k)?from[k]+(to[k]-from[k])*t:to[k]]));
 let samples=0,maxDepth=0;
 function interval(a,b,depth){
  maxDepth=Math.max(maxDepth,depth);const mid=(a+b)/2,state=at(mid),surfaces=movingAt(state);
  // Rigid rotation chord is bounded by radius * angular travel. Translation
  // and rotation add by the triangle inequality; nearest midpoint is half-step.
  const inflation=(b-a)/2*(radius*Math.abs(to.angle-from.angle)*Math.PI/180+Math.hypot(to.anterior-from.anterior,to.distraction-from.distraction))+1e-6;
  samples++;const enclosed=admit(surfaces,null,pose,{movement:inflation});if(enclosed.accepted)return null;
  const exact=admit(surfaces,null,pose);if(!exact.accepted)return{...exact,time:mid};
  if(depth>=18)return{...enclosed,uncertain:true,time:mid};
  return interval(a,mid,depth+1)||interval(mid,b,depth+1);
 }
 const blocked=interval(0,1,0);
 return blocked?{...blocked,accepted:false,method:'bounded moving-source instrument sweep',samples,maxDepth}:{accepted:true,pose:{...pose},hits:[],method:'bounded moving-source instrument sweep',samples,maxDepth};
}
