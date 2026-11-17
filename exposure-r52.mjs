// Display response only, not a measured Nexus sensor or calibrated irradiance.
export {meterPixels,nextExposure} from './exposure-r44.mjs';
export function exposureTarget(compensation){return Math.max(.60,Math.min(.86,.78*Math.pow(compensation/1.05,.3)));}
export function adaptExposure(current,target,dt){
 const tau=target<current?.12:.45;
 const t=1-Math.exp(-Math.max(0,Math.min(.05,dt))/tau);
 return Math.exp(Math.log(current)+(Math.log(target)-Math.log(current))*t);
}
