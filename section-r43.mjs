// Intersections of the actual deformed triangle buffers with x = lens.x.
// This is a sagittal model slice, not a registered patient scan.
export function sliceTriangles(positions,indices,x){
 const segments=[],eps=1e-8;
 for(let f=0;f<indices.length;f+=3){
  const ids=[indices[f]*3,indices[f+1]*3,indices[f+2]*3],points=[];
  for(let e=0;e<3;e++){
   const a=ids[e],b=ids[(e+1)%3],da=positions[a]-x,db=positions[b]-x;
   if(Math.abs(da)<eps&&Math.abs(db)<eps)continue;
   if((da>eps&&db>eps)||(da<-eps&&db<-eps))continue;
   const t=da/(da-db);
   if(!Number.isFinite(t)||t<0||t>1)continue;
   const p=[positions[a+1]+t*(positions[b+1]-positions[a+1]),positions[a+2]+t*(positions[b+2]-positions[a+2])];
   if(!points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<eps))points.push(p);
  }
  if(points.length===2&&Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1])>eps)segments.push(points);
 }
 return segments;
}
export function sectionContours(segments){
 const key=p=>p.map(v=>Math.round(v*1e5)).join(','),adj=new Map(),used=new Set(),result=[];
 segments.forEach((s,i)=>s.forEach(p=>{const k=key(p);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);}));
 for(let i=0;i<segments.length;i++)if(!used.has(i)){
  const start=segments[i][0],points=[start,segments[i][1]];used.add(i);
  for(let n=0;n<segments.length;n++){
   const last=points.at(-1);if(key(last)===key(start))break;
   const next=(adj.get(key(last))||[]).find(j=>!used.has(j));if(next===undefined)break;
   used.add(next);const s=segments[next];points.push(key(s[0])===key(last)?s[1]:s[0]);
  }
  result.push({points,closed:key(points[0])===key(points.at(-1))});
 }
 return result;
}
export function createSection({canvas,records,cavities}){
 const ctx=canvas.getContext('2d'),parts=[...records.filter(r=>['temporal','condyle','disc'].includes(r.part.name)),...cavities];
 let geometryKey='',drawKey='',contours=[],evidence=null;
 const palette={temporal:'#e4d5b5',condyle:'#c1d0c9',disc:'#e69caf',superior:'#6de0c2',inferior:'#f1c36e'};
 function draw({optical,entry,first,compartment,zoom=1}){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),dpr=Math.min(devicePixelRatio,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);drawKey='';}
  const key=optical.tip[0]+'/'+cavities[0].g.attributes.position.version;
  if(key!==geometryKey){geometryKey=key;contours=parts.map(r=>({name:r.part.name,lines:sectionContours(sliceTriangles(r.g.attributes.position.array,r.g.index.array,optical.tip[0]))}));}
  const next=JSON.stringify([key,w,h,optical,entry,first?.point?.toArray(),compartment,zoom]);if(next===drawKey)return evidence;drawKey=next;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0c1c27';ctx.fillRect(0,0,w,h);
  // Stable joint-centred framing; moving the instrument never moves this frame.
  const scale=Math.min((w-100)/44,(h-120)/40)/zoom,centre=[1,-5],project=p=>[w/2+(p[0]-centre[0])*scale,h/2-(p[1]-centre[1])*scale];
  const path=points=>{ctx.beginPath();points.forEach((p,i)=>{const [x,y]=project(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});};
  ctx.strokeStyle='#1c3442';ctx.lineWidth=1;
  for(let y=-20;y<=24;y+=5){path([[y,-25],[y,15]]);ctx.stroke();}
  for(let z=-25;z<=15;z+=5){path([[-21,z],[23,z]]);ctx.stroke();}
  for(const part of contours){
   ctx.strokeStyle=palette[part.name];ctx.fillStyle=palette[part.name];ctx.lineWidth=['superior','inferior'].includes(part.name)?2.2:1.6;
   for(const line of part.lines){path(line.points);if(line.closed){ctx.closePath();ctx.globalAlpha=['superior','inferior'].includes(part.name)?.28:.10;ctx.fill();ctx.globalAlpha=1;}ctx.stroke();}
  }
  const tip=project(optical.tip.slice(1)),dir=optical.direction.slice(1),dl=Math.hypot(...dir),end=[tip[0]+dir[0]*scale*7,tip[1]-dir[1]*scale*7];
  if(entry){ctx.setLineDash([5,4]);ctx.strokeStyle='#c49ad8';ctx.lineWidth=2;path([entry.slice(1),optical.tip.slice(1)]);ctx.stroke();ctx.setLineDash([]);const p=project(entry.slice(1));ctx.beginPath();ctx.arc(...p,6,0,Math.PI*2);ctx.stroke();}
  ctx.strokeStyle='#6dcfff';ctx.fillStyle='#6dcfff';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(...end);ctx.stroke();
  if(dl>.05){const a=Math.atan2(end[1]-tip[1],end[0]-tip[0]);ctx.beginPath();ctx.moveTo(...end);ctx.lineTo(end[0]-9*Math.cos(a-.4),end[1]-9*Math.sin(a-.4));ctx.lineTo(end[0]-9*Math.cos(a+.4),end[1]-9*Math.sin(a+.4));ctx.closePath();ctx.fill();}
  ctx.beginPath();ctx.arc(...tip,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d7f3ff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...tip,9,0,Math.PI*2);ctx.stroke();
  if(first){const p=project(first.point.toArray().slice(1));ctx.strokeStyle='#ffcf84';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(...p);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffcf84';ctx.beginPath();ctx.arc(...p,3.5,0,Math.PI*2);ctx.fill();}
  ctx.font='12px system-ui';ctx.fillStyle='#dbe8ed';ctx.fillText('SAGITTAL SLICE · x = '+optical.tip[0].toFixed(2)+' mm',20,27);
  ctx.fillStyle='#99b5c3';ctx.font='10px system-ui';ctx.fillText('Solid: tissue intersection · dashed: shaft / view projection',16,h-25);
  ctx.fillText('Grid 5 mm · source model coordinates',16,h-10);
  ctx.fillStyle='#dbe8ed';ctx.fillText('P',20,h/2);ctx.fillText('A',w-27,h/2);ctx.fillText('S',w/2,48);ctx.fillText('I',w/2,h-43);
  ctx.fillStyle='#6dcfff';ctx.fillText('Lens · '+compartment,Math.max(20,Math.min(w-220,tip[0]+14)),Math.max(67,Math.min(h-55,tip[1]-12)));
  // A compact key remains outside the tissue contours on narrow screens.
  let legendY=69;for(const [name,label] of [['temporal','Temporal'],['disc','Disc'],['condyle','Condyle'],['superior','Superior space'],['inferior','Inferior space']]){
   ctx.fillStyle=palette[name];ctx.fillRect(16,legendY-6,7,2);ctx.fillText(label,28,legendY);legendY+=15;
  }
  evidence={plane:'sagittal',x:optical.tip[0],lens:optical.tip,projectedDirection:dir,frameCentre:centre,sourceBuffersShared:true,geometryVersion:cavities[0].g.attributes.position.version,segments:contours.map(c=>({name:c.name,contours:c.lines.length,closed:c.lines.filter(l=>l.closed).length})),projection:true};
  return evidence;
 }
 return{draw};
}
