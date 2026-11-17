// Display-only exposure metering. It is not a measured Nexus camera response.
export function exposureTarget(compensation){return Math.max(.64,Math.min(.90,.82*Math.pow(compensation/1.05,.3)));}
export function meterPixels(rgba,width,height){
 const values=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const nx=(x+.5)/width*2-1,ny=(y+.5)/height*2-1;if(nx*nx+ny*ny>.81)continue;
  const i=(y*width+x)*4;if(rgba[i+3]===0)continue;
  values.push((.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2])/255);
 }
 if(!values.length)return 0;values.sort((a,b)=>a-b);return values[Math.floor((values.length-1)*.85)];
}
export function nextExposure(current,level,target){
 if(!Number.isFinite(level)||level<.025)return current;
 return Math.max(.16,Math.min(2.2,current*Math.pow(target/level,2.4)));
}
