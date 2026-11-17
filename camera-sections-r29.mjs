import {projectPoint,projectDirection} from './camera-sections-r29-math.mjs';
const ns='http://www.w3.org/2000/svg';
const colors={temporal:'#d1c0a4',condyle:'#a2acae',disc:'#71b5c6','capsule-superior':'#c7b56d','capsule-inferior':'#c7b56d','medial-superior-continuity':'#c7b56d','lateral-discal-attachment':'#bca5dc','medial-discal-attachment':'#bca5dc','retrodiscal-temporal-lamina':'#c88e7d','retrodiscal-condylar-lamina':'#c88e7d','retrodiscal-loose-tissue':'#c88e7d',superior:'#48d8cf',inferior:'#f1a557'};
function element(tag,attrs={},text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;}
export function createSections({data,comparison}){
 for(const p of comparison.presets){const s=data.presets.find(s=>s.id===p.id);if(!s||!s.position_mm.every((v,i)=>v===p.position_mm[i]))throw Error('Section/preset coordinate mismatch');for(const [plane,axis] of [['sagittal',0],['coronal',1]])if(s.sections[plane].position!==p.position_mm[axis])throw Error('Section does not pass through camera');}
 let detail=false,last=null,rendered='';
 const button=document.querySelector('#section-detail');
 button.onclick=()=>{detail=!detail;button.setAttribute('aria-pressed',String(detail));button.textContent=detail?'Show joint context':'Zoom around lens';if(last)draw(...last);};
 const nodes=Object.fromEntries(['sagittal','coronal'].map(plane=>{
  const svg=document.querySelector('#'+plane+'-section');
  const grid=element('g'),contours=element('g'),cross=element('path',{class:'section-cross'}),ray=element('path',{class:'section-ray'}),tip=element('circle',{class:'section-tip',r:5}),axis=element('g');
  svg.append(grid,contours,cross,ray,tip,axis);return [plane,{svg,grid,contours,cross,ray,tip,axis}];
 }));
 function draw(preset,position,direction){
  const p=position.toArray(),d=direction.toArray();last=[preset,position,direction];
  const selected=data.presets.find(s=>s.id===preset.id),key=preset.id+detail,evidence={preset:preset.id,position:p,direction:d,detail,planes:{}};
  for(const plane of ['sagittal','coronal']){
   const s=selected.sections[plane],n=nodes[plane],point=projectPoint(plane,p),proj=projectDirection(plane,d),scale=detail?43:16,cx=detail?point[0]:0,cy=detail?point[1]:2;
   const screen=q=>[300+(q[0]-cx)*scale,140+(q[1]-cy)*scale],tip=screen(point);
   if(key!==rendered){
    n.grid.replaceChildren();n.contours.replaceChildren();n.axis.replaceChildren();
    for(let j=-35;j<=35;j++){const a=screen([j,-35]),b=screen([j,35]),c=screen([-35,j]),e=screen([35,j]);n.grid.append(element('path',{d:`M${a}L${b}M${c}L${e}`,class:'section-grid'}));}
    for(const part of s.parts){
     const add=(segments,color,closure=false)=>{if(!segments.length)return;const path=element('path',{d:segments.map(seg=>`M${screen(projectPoint(plane,seg.a))}L${screen(projectPoint(plane,seg.b))}`).join(''),fill:'none',stroke:color,'stroke-width':closure?2.8:part.source==='cavity'?1.5:part.category==='estimated tissue'?1.7:1.1,...(closure?{'stroke-dasharray':'5 3'}:{})});path.append(element('title',{},`${part.name}: ${closure?'computational closure, not tissue':part.category}`));n.contours.append(path);};
     add(part.segments,colors[part.name]);
     if(part.source==='cavity')add(part.segments.filter(s=>s.closure),'#ed79c9',true);
    }
    for(const [x,y,text] of [[14,24,plane==='sagittal'?'A (+Y)':'M (−X)'],[586,24,plane==='sagittal'?'P (−Y)':'L (+X)'],[300,24,'S (+Z) ↑'],[300,270,'I (−Z) ↓']])n.axis.append(element('text',{x,y,'text-anchor':x===14?'start':x===586?'end':'middle',class:'section-axis'},text));
    const bar=scale*2;n.axis.append(element('path',{d:`M22 249h${bar}`,class:'section-scale'}),element('text',{x:22,y:239,class:'section-axis'},'2 mm'));
   }
   n.cross.setAttribute('d',`M${tip[0]} 28V253M14 ${tip[1]}H586`);
   const end=[tip[0]+3*scale*proj.xy[0],tip[1]+3*scale*proj.xy[1]],a=Math.atan2(proj.xy[1],proj.xy[0]);
   n.ray.setAttribute('d',proj.degenerate?'':`M${tip}L${end}M${end[0]-8*Math.cos(a-.5)},${end[1]-8*Math.sin(a-.5)}L${end}L${end[0]-8*Math.cos(a+.5)},${end[1]-8*Math.sin(a+.5)}`);
   n.tip.setAttribute('cx',tip[0]);n.tip.setAttribute('cy',tip[1]);n.tip.setAttribute('data-world-point',JSON.stringify(p));
   const axisName=plane==='sagittal'?'X':'Y',normalName=plane==='sagittal'?'lateral':'anterior';
   document.querySelector('#'+plane+'-position').textContent=`${axisName} = ${s.position} mm`;
   document.querySelector('#'+plane+'-direction').textContent=proj.degenerate?`No in-plane arrow: projection < 0.000001. View is perpendicular to this plane.`:`Blue arrow: projected 3 mm view vector · length ${(3*proj.length).toFixed(3)} mm`;
   document.querySelector('#'+plane+'-normal').textContent=`Out of plane: ${proj.normal>=0?'+':''}${proj.normal.toFixed(4)} along ${axisName} (+ = ${normalName}) · ${proj.angleDegrees.toFixed(1)}° from plane`;
   n.svg.setAttribute('aria-label',`${plane} model section, ${axisName} ${s.position} millimetres. Camera marked. ${document.querySelector('#'+plane+'-normal').textContent}`);
   evidence.planes[plane]={axis:s.axis,plane:s.position,planePointError:s.position-p[s.axis],point2D:point,screenTip:tip,screenVector:proj.xy.map(v=>v*3*scale),projection:proj,sourceSegments:s.parts.reduce((v,p)=>v+p.segments.length,0)};
  }
  rendered=key;document.body.dataset.sectionsEvidence=JSON.stringify(evidence);
 }
 return {drawSections:draw,resetSections(){detail=false;button.setAttribute('aria-pressed','false');button.textContent='Zoom around lens';}};
}
