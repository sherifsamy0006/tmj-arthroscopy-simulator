import {sweptCylinder} from './sweep-r41.mjs';
import {add,sub,dot,cross,unit,shaftDirection,testCylinder} from './collision-r38.mjs';
export const TOOL=Object.freeze({radius:.95,length:63.1,overall:115,bodyRadius:24});
// Pivot on the estimated lateral capsule crossing, not the remote approach origin.
// The legacy travel datum is retained: depth zero is fully withdrawn.
// This is a model entry reference, not a measured skin portal or cannula assembly.
export const APPROACH_REFERENCE=Object.freeze([30,4,-4]);
export const DEPTH_OFFSET=20.788525168710507;
export const PIVOT=Object.freeze([10.761954168424495,-3.0020760481424738,-0.390110488070305]);
export const START=Object.freeze({yaw:-100,pitch:10,depth:0,roll:75});
export const PREPARED=Object.freeze({...START,depth:23});
export const PREPARATION=2.5;
export function validatePose(p){for(const k of ['yaw','pitch','depth','roll'])if(!Number.isFinite(p[k]))throw Error('Invalid instrument pose');if(p.yaw < -140||p.yaw > -40||Math.abs(p.pitch)>40||p.depth<0||p.depth>30||Math.abs(p.roll)>180)throw Error('Instrument travel limit');return p;}
export function opticalPose(p,pivot=PIVOT){validatePose(p);const axis=shaftDirection(p.yaw,p.pitch),a=unit(sub([0,0,1],axis.map(v=>v*axis[2]))),b=cross(axis,a),r=p.roll*Math.PI/180,normal=add(a.map(v=>v*Math.cos(r)),b,Math.sin(r));return{tip:add(pivot,axis,p.depth-DEPTH_OFFSET),axis,direction:add(axis.map(v=>v*Math.cos(Math.PI/6)),normal,.5),up:add(normal.map(v=>v*Math.cos(Math.PI/6)),axis,-.5)};}
// Three non-axis-aligned rays and deduplicated crossings guard initial solid
// containment. Once admitted, swept collision guards the complete trajectory.
export function insideSurface(s,p){let votes=0;for(const direction of [[.337,.571,.749],[.719,.211,.662],[.181,.934,.309]]){const d=unit(direction),dist=[];for(const t of s.triangles){const e1=sub(t.v[1],t.v[0]),e2=sub(t.v[2],t.v[0]),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-10)continue;const q=sub(p,t.v[0]),u=dot(q,h)/det;if(u<0||u>1)continue;const v=dot(d,cross(q,e1))/det;if(v<0||u+v>1)continue;const tt=dot(e2,cross(q,e1))/det;if(tt>1e-6)dist.push(tt);}dist.sort((a,b)=>a-b);if(dist.filter((v,i)=>!i||v-dist[i-1]>1e-5).length%2)votes++;}return votes>=2;}
export function admit(surfaces,from,to,{pivot=PIVOT,movement=0,initial=false}={}){validatePose(to);if(from)validatePose(from);const axial=p=>({...p,depth:p.depth-DEPTH_OFFSET}),target=axial(to),origin=from&&axial(from),axis=shaftDirection(to.yaw,to.pitch);let test;
 if(from&&movement===0)test=sweptCylinder(surfaces,pivot,origin,target,TOOL);
 else test=testCylinder(surfaces,pivot,axis,TOOL.radius+movement,target.depth-TOOL.length-movement,target.depth+movement);
 if(test.surfaceClear){const shifted=p=>({...p,depth:p.depth-TOOL.length});const body=from&&movement===0?sweptCylinder(surfaces,pivot,shifted(origin),shifted(target),{radius:TOOL.bodyRadius,length:TOOL.overall-TOOL.length}):testCylinder(surfaces,pivot,axis,TOOL.bodyRadius+movement,target.depth-TOOL.overall-movement,target.depth-TOOL.length+movement);if(!body.surfaceClear)test={...body,body:true};}
 if(test.surfaceClear&&initial&&to.depth!==0)throw Error('Initial pose must be fully withdrawn; insertion requires a swept path');

 return{...test,accepted:test.surfaceClear,pose:test.surfaceClear?{...to}:from?{...from}:null};
}
