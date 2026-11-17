// Visualize the existing single, well-mixed tracer. No local velocity field,
// optical calibration or second-compartment irrigation is inferred.
export function washoutState(fluid,enabled,insideSuperior){
 const fraction=Math.max(0,Math.min(1,fluid.volume>0?fluid.tracerMass/fluid.volume:0));
 const active=!!enabled&&!!insideSuperior;
 return{enabled:!!enabled,active,fraction,density:active?.11*Math.sqrt(fraction):0,
  compartment:'superior',mapping:'illustrative distance fog',calibrated:false};
}
