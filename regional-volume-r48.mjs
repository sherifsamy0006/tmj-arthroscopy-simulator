// Both ordinary and typed index buffers are supported after Boolean rebuilding.
export function regionalVolumes(p,indices){
 let whole=0,front=0;
 const triple=(a,b,c)=>a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
 for(let f=0;f<indices.length;f+=3){
  const tri=Array.from(indices.slice(f,f+3),i=>Array.from(p.slice(i*3,i*3+3)));
  whole+=triple(...tri);const clipped=[];
  for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],inside=a[1]>=0,next=b[1]>=0;if(inside)clipped.push(a);if(inside!==next){const t=a[1]/(a[1]-b[1]);clipped.push(a.map((x,j)=>x+t*(b[j]-x)));}}
  for(let i=1;i+1<clipped.length;i++)front+=triple(clipped[0],clipped[i],clipped[i+1]);
 }
 const sign=Math.sign(whole)||1;return{anteriorML:sign*front/6000,posteriorML:sign*(whole-front)/6000,totalML:Math.abs(whole)/6000,plane:'model Y=0',separatePressures:false};
}
