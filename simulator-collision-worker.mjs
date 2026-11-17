import {prepareSurfaces,testCylinder,sweptCylinder,shaftDirection} from './simulator-collision.mjs';
let surfaces=[];
onmessage=e=>{try{const m=e.data;if(m.type==='init'){surfaces=prepareSurfaces(m.parts);postMessage({id:m.id,ready:true,triangles:surfaces.reduce((n,s)=>n+s.triangles.length,0)});return;}const result=m.from?sweptCylinder(surfaces,m.pivot,m.from,m.to,m.tool):testCylinder(surfaces,m.pivot,shaftDirection(m.to.yaw,m.to.pitch),m.tool.radius,m.to.depth-m.tool.length,m.to.depth);postMessage({id:m.id,result});}catch(err){postMessage({id:e.data.id,error:err.message});}};
