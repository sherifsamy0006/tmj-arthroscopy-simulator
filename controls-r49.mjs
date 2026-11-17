import {opticalPose} from './navigation-r49.mjs';
import {dot,cross,unit,sub} from './collision-r38.mjs';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const wrapRoll=v=>((v+180)%360+360)%360-180;
export function imageBasis(p){const direction=opticalPose(p).direction,right=unit(cross(direction,[0,0,1])),up=unit(cross(right,direction));return{direction,right,up};}
// Invert the local optical-direction Jacobian. A horizontal gesture steers the
// viewed ray horizontally in the displayed image even with a rolled 30-degree lens.
// Small angular steps keep this mapping accurate; the worker checks the entire path.
export function steerPose(start,horizontal,vertical){
 let p={...start};const steps=Math.max(1,Math.ceil(Math.hypot(horizontal,vertical)/.25));
 for(let i=0;i<steps;i++){
  const {direction,right,up}=imageBasis(p),e=.001;
  const derivative=k=>sub(opticalPose({...p,[k]:p[k]+(p[k]>=(k==='yaw'?-40:40)?-e:e)}).direction,direction).map(x=>x/(p[k]>=(k==='yaw'?-40:40)?-e:e));
  const y=derivative('yaw'),t=derivative('pitch'),a=dot(y,right),b=dot(t,right),c=dot(y,up),d=dot(t,up),det=a*d-b*c;
  if(Math.abs(det)<1e-8)break;
  const x=horizontal/steps*Math.PI/180,z=vertical/steps*Math.PI/180;
  p={...p,yaw:clamp(p.yaw+(d*x-b*z)/det,-140,-40),pitch:clamp(p.pitch+(-c*x+a*z)/det,-40,40)};
 }
 return p;
}
export function scopeDragPose(start,mode,dx,dy,fine=false){
 if(!Number.isFinite(dx)||!Number.isFinite(dy))throw Error('Invalid pointer displacement');
 if(mode==='roll')return{...start,roll:wrapRoll(start.roll+dx*(fine?.1:.3))};
 if(mode==='advance')return{...start,depth:clamp(start.depth-dy*(fine?.006:.025),0,30)};
 return steerPose(start,dx*(fine?.025:.09),-dy*(fine?.025:.09));
}
