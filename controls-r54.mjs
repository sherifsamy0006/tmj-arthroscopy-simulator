import {opticalPose,PREPARED,TOOL,DEPTH_OFFSET} from './navigation-r53.mjs';
import {dot,cross,unit,sub} from './collision-r38.mjs';
export {wrapRoll} from './controls-r49.mjs';
import {wrapRoll} from './controls-r49.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rotate=(v,n,a)=>v.map((x,i)=>x*Math.cos(a)+cross(n,v)[i]*Math.sin(a)+n[i]*dot(n,v)*(1-Math.cos(a)));
const reference=opticalPose(PREPARED),referenceUp=unit(cross(unit(cross(reference.direction,[0,0,1])),reference.direction));
const clocking=Math.atan2(dot(reference.direction,cross(reference.up,referenceUp)),dot(reference.up,referenceUp));
// One fixed camera-to-telescope clocking, aligned upright at the prepared pose.
// This is a rigid coupler assumption, not a measured Nexus camera assembly.
export function imageBasis(p,orientation='coupled',cameraRoll=0){
 const optical=opticalPose(p),direction=optical.direction;
 const up=orientation==='stabilized'?unit(cross(unit(cross(direction,[0,0,1])),direction)):unit(rotate(optical.up,direction,clocking));
 const cameraUp=unit(rotate(up,direction,cameraRoll*Math.PI/180));
 return{direction,up:cameraUp,right:unit(cross(direction,cameraUp))};
}
export function steerPose(start,horizontal,vertical,orientation='coupled',cameraRoll=0){
 let p={...start};const steps=Math.max(1,Math.ceil(Math.hypot(horizontal,vertical)/.05));
 for(let i=0;i<steps;i++){
  const {direction,right,up}=imageBasis(p,orientation,cameraRoll),e=.001;
  const derivative=k=>{const delta=p[k]>=(k==='yaw'?-40:40)?-e:e;return sub(opticalPose({...p,[k]:p[k]+delta}).direction,direction).map(x=>x/delta);};
  const y=derivative('yaw'),t=derivative('pitch'),a=dot(y,right),b=dot(t,right),c=dot(y,up),d=dot(t,up),det=a*d-b*c;
  if(Math.abs(det)<1e-8)break;
  const x=horizontal/steps*Math.PI/180,z=vertical/steps*Math.PI/180;
  p={...p,yaw:clamp(p.yaw+(d*x-b*z)/det,-140,-40),pitch:clamp(p.pitch+(-c*x+a*z)/det,-40,40)};
 }
 return p;
}
// Patient-fixed hand axes. Telescope/camera rotation NEVER rotates the hand frame.
// This lever is the modeled external working shaft, not a measured grip position.
const handFrame=imageBasis(PREPARED);
export function handlePose(start,horizontal,vertical,orientation='coupled'){
 let p={...start};const steps=Math.max(1,Math.ceil(Math.hypot(horizontal,vertical)/.05));
 for(let i=0;i<steps;i++){
  const {axis}=opticalPose(p),{right,up}=handFrame;
  const lever=TOOL.length-(p.depth-DEPTH_OFFSET);
  const delta=right.map((v,k)=>(v*horizontal+up[k]*vertical)/steps),axial=dot(delta,axis);
  const hand=axis.map((v,k)=>-v*lever+delta[k]-v*axial);
  const a=unit(hand).map(v=>-v);
  p.yaw=clamp(Math.atan2(a[0],a[1])*180/Math.PI,-140,-40);
  p.pitch=clamp(Math.asin(clamp(a[2],-1,1))*180/Math.PI,-40,40);
 }
 return p;
}
// Simultaneous channels use midpoint depth/roll. Numerical step is independent
// of rendering/worker scheduling. The worker checks each chronological segment.
export function integrateInput(start,delta,o={}){
 const d={x:0,y:0,depth:0,roll:0,...delta};
 const n=Math.max(1,Math.ceil(Math.hypot(d.x,d.y)/.02),Math.ceil(Math.abs(d.depth)/.01),Math.ceil(Math.abs(d.roll)/.2));
 let p={...start};
 for(let i=0;i<n;i++){
  const mid={...p,depth:clamp(p.depth+d.depth/n/2,0,30),roll:wrapRoll(p.roll+d.roll/n/2)};
  const q=d.x===0&&d.y===0?mid:o.grip==='handle'?handlePose(mid,d.x/n,d.y/n):steerPose(mid,d.x/n,d.y/n,o.orientation,o.cameraRoll||0);
  p={...q,depth:clamp(p.depth+d.depth/n,0,30),roll:wrapRoll(p.roll+d.roll/n)};
 }
 return p;
}
// Keep ordered events, including reversals and coupled pinch/twist. Never sum
// arbitrary inputs: rotations and hand translations do not commute.
export function instrumentInput(options=()=>({})){
 let queue=[],cancelled=false,events=0,maximumQueuedSteps=0,batch=[];
 return{
  add(delta){if(cancelled)return;const d={};for(const k of ['x','y','depth','roll']){d[k]=delta[k]??0;if(!Number.isFinite(d[k]))throw Error('Invalid gesture');}if(Object.values(d).some(v=>Math.abs(v)>1e-9))queue.push({delta:d,options:{...options()},at:performance.now()});events++;maximumQueuedSteps=Math.max(maximumQueuedSteps,queue.length);},
  get diagnostics(){return{queuedSteps:queue.length,oldestAgeMS:queue.length?performance.now()-queue[0].at:0,clipped:0,maximumQueuedSteps,events};},
  get batch(){return batch;},
  get pending(){return !cancelled&&queue.length>0;},
  discardBlocked(){/* The worker rechecks remaining independent channels. */},
  clear(){queue=[];},
  cancel(){cancelled=true;this.clear();},
  take(p){batch=cancelled?[]:queue.splice(0,8);return batch.reduce((p,s)=>integrateInput(p,s.delta,s.options),p);
  }
 };
}
export function pointerDelta(mode,dx,dy,{fine=false,grip='view',width=450}={}){
 const factor=(fine?.28:1)*450/Math.max(120,width);
 if(mode==='roll')return{roll:dx*.3*factor};
 if(mode==='advance')return{depth:-dy*.025*factor};
 const gain=grip==='handle'?.16:.14;
 return{x:dx*gain*factor,y:-dy*gain*factor};
}
export function pairFrame(points){const [a,b]=points;return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)};}
export function pairDelta(a,b,options){const d=pointerDelta('aim',b.x-a.x,b.y-a.y,options),factor=options.fine?.28:1,scale=450/Math.max(120,options.width||450);return{...d,depth:(b.d-a.d)*.015*factor*scale,roll:Math.min(a.d,b.d)<24?0:wrapRoll((b.angle-a.angle)*180/Math.PI)*factor};}

