import {validatePose} from './navigation-r49.mjs';
// A rotation about the existing shaft axis does not change either collision
// envelope: the shaft and conservative proximal guard are circular cylinders.
// Caller must already hold an admitted pose in the current geometry.
export function admittedAxialRoll(from,to){
 validatePose(to);
 if(!from||!['yaw','pitch','depth'].every(k=>from[k]===to[k]))return null;
 return {accepted:true,surfaceClear:true,pose:{...to},hits:[],limited:false,
  method:'unchanged admitted axisymmetric envelope',samples:0,inflation:0,
  invariant:['shaft cylinder','conservative proximal cylinder']};
}
