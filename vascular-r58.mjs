// Deterministic illustrative vessel pigment. It is not a clinical image or a
// reconstructed vascular tree. Branches are blended onto soft lining only.
// r58: more tortuous branches and short curled capillaries between them.
// Red channel: vessel core. Green channel: soft perivascular flush.
let texture;
export function vascularTexture(T){
 if(texture)return texture;
 const size=1024,c=document.createElement('canvas');c.width=c.height=size;
 const ctx=c.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,size,size);ctx.lineCap='round';ctx.lineJoin='round';
 let state=420178;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 // Every stroke is repeated across the tile edges so the texture wraps without seams.
 function stroke(points,width,core,flush){
  for(const dx of[-size,0,size])for(const dy of[-size,0,size]){
   ctx.beginPath();ctx.moveTo(points[0][0]+dx,points[0][1]+dy);
   for(let i=1;i<points.length-1;i++){const a=points[i],b=points[i+1];ctx.quadraticCurveTo(a[0]+dx,a[1]+dy,(a[0]+b[0])/2+dx,(a[1]+b[1])/2+dy);}
   const last=points[points.length-1];ctx.lineTo(last[0]+dx,last[1]+dy);
   if(flush>0){ctx.strokeStyle=`rgba(0,255,0,${flush*.7})`;ctx.lineWidth=width*5;ctx.stroke();ctx.strokeStyle=`rgba(0,255,0,${flush})`;ctx.lineWidth=width*2.5;ctx.stroke();}
   ctx.strokeStyle=`rgba(255,80,0,${core})`;ctx.lineWidth=width;ctx.stroke();
  }
 }
 // A wandering path: small heading changes at every short segment give the
 // curled look of synovial vessels instead of straight spokes.
 function wander(x,y,angle,length,curl){
  const points=[[x,y]],n=Math.max(4,Math.round(length/9));let drift=(random()-.5)*curl;
  for(let i=0;i<n;i++){drift=drift*.72+(random()-.5)*curl;angle+=drift;x+=Math.cos(angle)*length/n;y+=Math.sin(angle)*length/n;points.push([x,y]);}
  return{points,x,y,angle};
 }
 function branch(x,y,angle,length,width,level){
  if(level>5||width<.3)return;
  const path=wander(x,y,angle,length,.42+level*.07);
  stroke(path.points,width,.82-level*.07,.26-level*.03);
  if(level<5){
   branch(path.x,path.y,path.angle+(random()-.5)*.35,length*(.56+random()*.16),width*.72,level+1);
   branch(path.x,path.y,path.angle+(random()>.5?1:-1)*(.45+random()*.42),length*(.42+random()*.2),width*.56,level+1);
   if(random()>.55){const mid=path.points[Math.floor(path.points.length/2)];branch(mid[0],mid[1],path.angle+(random()>.5?1:-1)*(.7+random()*.5),length*.36,width*.45,level+2);}
  }
 }
 for(let i=0;i<22;i++)branch(random()*size,random()*size,random()*Math.PI*2,90+random()*105,1.9+random()*2.1,0);
 // Short corkscrew capillaries and hairpin loops.
 for(let i=0;i<260;i++){const path=wander(random()*size,random()*size,random()*Math.PI*2,26+random()*46,1.05);stroke(path.points,.55+random()*.5,.42+random()*.22,.07);}
 texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;
 texture.colorSpace=T.NoColorSpace;
 return texture;
}
