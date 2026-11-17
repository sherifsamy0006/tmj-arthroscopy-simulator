// Backward Euler against the ACTUAL Boolean cavity, not an uncut volume proxy.
import {validateParameters,BOUNDS} from './joint-model-r47.mjs';
export function solveFluid(previous,parameters,dt,volumeAt,initialWall=previous.wall){
 validateParameters(parameters);if(!(dt>0&&dt<=.1))throw Error('Invalid fluid time step');
 const gi=1/parameters.inletResistance,go=parameters.outletOpen?1/parameters.outletResistance:0,k=parameters.wallStiffness;
 const conservedVolume=previous.initialVolume+previous.netIn;
 const evaluate=wall=>{const geometry=volumeAt(wall),volume=geometry.parts[0].volume,pressure=k*wall,qin=(parameters.sourcePressure-pressure)*gi,qout=pressure*go;return{wall,geometry,volume,pressure,qin,qout,residual:volume-conservedVolume-dt*(qin-qout)};};
 let lo=BOUNDS.wall[0],hi=BOUNDS.wall[1],current=evaluate(Math.max(lo,Math.min(hi,initialWall))),last=null,evaluations=1;
 for(let iteration=0;iteration<25;iteration++){
  if(Math.abs(current.residual)<1e-9){
   const {wall,geometry,volume,pressure,qin,qout}=current,incoming=Math.max(0,qin)+Math.max(0,-qout),outgoing=Math.max(0,qout)+Math.max(0,-qin),netIn=previous.netIn+dt*(qin-qout),tracerMass=previous.tracerMass/(1+dt*outgoing/volume);
   return{geometry,fluid:{...previous,wall,volume,pressure,qin,qout,netIn,grossIn:previous.grossIn+dt*incoming,grossOut:previous.grossOut+dt*outgoing,tracerMass,concentration:tracerMass/volume,elapsed:previous.elapsed+dt,residual:volume-previous.initialVolume-netIn,contactLimited:false,reactionPressure:0},evaluations};
  }
  if(current.residual>0)hi=current.wall;else lo=current.wall;
  // Secant slope includes storage and hydraulic conductance. The bracket
  // prevents overshoot; default derivative is only an iteration seed.
  let slope=last&&current.wall!==last.wall?(current.residual-last.residual)/(current.wall-last.wall):.02+dt*k*(gi+go);
  if(!(slope>0))slope=.02+dt*k*(gi+go);
  let next=current.wall-current.residual/slope;
  if(!(next>lo&&next<hi))next=(lo+hi)/2;
  if(Math.abs(next-current.wall)<1e-9)throw Error('Wall displacement limit reached');
  last=current;current=evaluate(next);evaluations++;
 }
 throw Error('Cavity/flow solve did not converge');
}
