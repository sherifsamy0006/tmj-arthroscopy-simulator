export const PROJECTION_EPS=1e-6;
export function projectPoint(plane,p){return plane==='sagittal'?[-p[1],-p[2]]:[p[0],-p[2]];}
export function projectDirection(plane,d){
 const xy=projectPoint(plane,d),normal=d[plane==='sagittal'?0:1],length=Math.hypot(...xy);
 return {xy,normal,length,degenerate:length<PROJECTION_EPS,angleDegrees:Math.atan2(Math.abs(normal),length)*180/Math.PI};
}
export function directionFromAngles(yaw,pitch){const y=yaw*Math.PI/180,p=pitch*Math.PI/180;return [Math.cos(p)*Math.sin(y),Math.cos(p)*Math.cos(y),Math.sin(p)];}
