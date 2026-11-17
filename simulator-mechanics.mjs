import {REGIONS,FRAMES,motionPoints,selectedSample,triangulation,creep,bolusPeak,LAVAGE,pressureDrop} from './simulator-mechanics-model.mjs';
import {download} from './simulator-training.mjs';
const COLORS=['#efb36b','#72d2b4','#87b4ff','#d9a2ed','#f08b98'];
const $=id=>document.getElementById(id),fmt=(n,d=2)=>n.toFixed(d);
function surface(id){const c=$(id),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.fillStyle='#0b1822';g.fillRect(0,0,c.width,c.height);g.lineJoin='round';return {g,w:c.width,h:c.height};}
function text(g,t,x,y,color='#bed0db',size=18){g.fillStyle=color;g.font=`${size}px system-ui`;g.fillText(t,x,y);}
function line(g,points,color,width=3,dash=[]){g.strokeStyle=color;g.lineWidth=width;g.setLineDash(dash);g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.stroke();g.setLineDash([]);}
function dot(g,p,color,r=6){g.beginPath();g.arc(...p,r,0,2*Math.PI);g.fillStyle=color;g.fill();}
function chart(g,w,h,xmin,xmax,ymin,ymax,xlabel,ylabel){
 const left=84,right=w-28,top=58,bottom=h-62,X=x=>left+(x-xmin)/(xmax-xmin)*(right-left),Y=y=>bottom-(y-ymin)/(ymax-ymin)*(bottom-top);
 for(let i=0;i<=4;i++){const y=ymin+(ymax-ymin)*i/4;line(g,[[left,Y(y)],[right,Y(y)]],'#253746',1);text(g,fmt(y,Math.abs(ymax-ymin)>10?0:1),12,Y(y)+6);const x=xmin+(xmax-xmin)*i/4;text(g,fmt(x,0),X(x)-12,bottom+27);}
 text(g,ylabel,left,28);text(g,xlabel,w/2-90,h-12);return {X,Y,left,right,top,bottom};
}
function projector(points,w,h,yaw=35){
 const a=yaw*Math.PI/180,e=.48,rot=p=>[Math.cos(a)*p[0]-Math.sin(a)*p[1],Math.sin(e)*(Math.sin(a)*p[0]+Math.cos(a)*p[1])+Math.cos(e)*p[2]];
 const p=points.map(rot),mins=[0,1].map(k=>Math.min(...p.map(p=>p[k]))),maxs=[0,1].map(k=>Math.max(...p.map(p=>p[k]))),s=Math.min((w-170)/Math.max(.5,maxs[0]-mins[0]),(h-130)/Math.max(.5,maxs[1]-mins[1]));
 return v=>{const q=rot(v);return[w/2+(q[0]-(mins[0]+maxs[0])/2)*s,h/2-(q[1]-(mins[1]+maxs[1])/2)*s];};
}
function renderPortal(){
 const v={angle:+$('portal-angle').value,depth:+$('portal-depth').value,roll:+$('portal-roll').value,workingDistance:+$('portal-distance').value,offset:+$('portal-offset').value},r=triangulation(v);
 for(const [id,value,unit] of [['angle',v.angle,'°'],['depth',v.depth,' mm'],['roll',v.roll,'°'],['distance',v.workingDistance,' mm'],['offset',v.offset,' mm']])$('portal-'+id+'-value').textContent=value+unit;
 const {g,w,h}=surface('portal-plot'),plane=[[-4,-8,0],[44,-8,0],[44,8,0],[-4,8,0]],P=projector([...plane,r.lens,r.tip,r.target],w,h,-35);
 g.fillStyle='#2f536349';g.beginPath();plane.map(P).forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();line(g,[...plane,plane[0]].map(P),'#4e758b',1);
 line(g,[P([0,0,0]),P(r.lens)],COLORS[0],8);line(g,[P(r.portal),P(r.tip)],COLORS[1],7);line(g,[P(r.lens),P(r.target)],COLORS[2],3,[7,4]);line(g,[P([0,0,0]),P(r.portal)],'#9bb3c4',2,[5,4]);
 // Cone boundary ring at the optical working distance, orthogonal to look.
 let u=[-r.look[1],r.look[0],0],len=Math.hypot(...u);if(len<1e-8){u=[1,0,0];len=1;}u=u.map(x=>x/len);const z=r.look,b=[z[1]*u[2]-z[2]*u[1],z[2]*u[0]-z[0]*u[2],z[0]*u[1]-z[1]*u[0]],radius=v.workingDistance*Math.tan(32.5*Math.PI/180),ring=Array.from({length:49},(_,i)=>r.target.map((x,k)=>x+radius*(Math.cos(i*Math.PI/24)*u[k]+Math.sin(i*Math.PI/24)*b[k])));
 line(g,ring.map(P),'#87b4ff88',1.5);for(const i of [0,12,24,36])line(g,[P(r.lens),P(ring[i])],'#87b4ff55',1);
 dot(g,P(r.lens),COLORS[0]);dot(g,P(r.target),COLORS[2],5);dot(g,P(r.tip),r.inView?COLORS[1]:'#f18c85',6);
 text(g,'SYNTHETIC SKIN PLANE',25,30,'#a6bbca',17);for(const [label,p,color,dx,dy] of [['Scope portal',[0,0,0],COLORS[0],-50,28],['Working portal',r.portal,COLORS[1],-50,28],['Lens',r.lens,COLORS[0],-48,-12],['Target',r.target,COLORS[2],9,-12]]){const xy=P(p);text(g,label,xy[0]+dx,xy[1]+dy,color,17);}
 $('portal-values').innerHTML=`<strong>${r.inView?'Working tip inside optical field':'Working tip outside optical field'}</strong><dl><dt>Portal spacing on plane</dt><dd>${fmt(r.spacing)} mm</dd><dt>Normal working depth</dt><dd>${fmt(r.normalDepth)} mm</dd><dt>Angle between shafts</dt><dd>${fmt(r.shaftAngle,1)}°</dd><dt>Tip-to-target error</dt><dd>${fmt(r.targetError)} mm</dd><dt>Tip angle from optical axis</dt><dd>${fmt(r.viewAngle,1)}° / 32.5° half-field</dd></dl>`;
 document.body.dataset.portalLab=JSON.stringify({...v,...r});
}
function renderTissue(){const id=$('tissue-region').value,minutes=+$('tissue-time').value,r=REGIONS.find(r=>r.id===id),current=creep(id,minutes*60),{g,w,h}=surface('tissue-plot'),a=chart(g,w,h,0,120,0,2,'Elapsed time (minutes)','Additional compression strain (%)');
 REGIONS.forEach((r,i)=>{const points=Array.from({length:241},(_,j)=>[a.X(j/2),a.Y(creep(r.id,j*30).incrementalStrain*100)]);line(g,points,r.id===id?COLORS[i]:COLORS[i]+'66',r.id===id?4:2);});
 line(g,[[a.X(minutes),a.top],[a.X(minutes),a.bottom]],'#fff6',1,[5,5]);dot(g,[a.X(minutes),a.Y(current.incrementalStrain*100)],COLORS[REGIONS.indexOf(r)]);
 $('tissue-time-value').textContent=minutes+' min';$('tissue-values').innerHTML=`<strong>${r.name} region</strong><dl><dt>Measured aggregate modulus</dt><dd>${fmt(r.ha)} ± ${fmt(r.haSD)} kPa</dd><dt>Measured permeability</dt><dd>${fmt(r.k)} ± ${fmt(r.kSD)} × 10⁻¹⁵ m⁴/N·s</dd><dt>Calculated load for 2% final strain</dt><dd>${fmt(current.forceN*1000,1)} mN</dd><dt>Compression at ${minutes} min</dt><dd>${fmt(current.compressionMm*1000,2)} µm · ${fmt(current.incrementalStrain*100,3)}%</dd><dt>Derived first-mode time constant</dt><dd>${fmt(current.tauSeconds/60,1)} min</dd></dl>`;
 document.body.dataset.tissueLab=JSON.stringify({region:id,minutes,...current});
}
function renderFluid(){const r=bolusPeak(+$('fluid-pressure').value),{g,w,h}=surface('fluid-plot'),a=chart(g,w,h,5,60,0,140,'Initial pressure P₀ (mmHg)','Calculated peak pressure (mmHg)');line(g,Array.from({length:111},(_,i)=>{const x=5+i/2;return[a.X(x),a.Y(bolusPeak(x).peak)];}),COLORS[2],4);line(g,[[a.X(5),a.Y(5)],[a.X(60),a.Y(60)]],'#9aaebc',2,[5,5]);line(g,[[a.X(r.p0),a.Y(r.p0)],[a.X(r.p0),a.Y(r.peak)]],COLORS[0],3);dot(g,[a.X(r.p0),a.Y(r.peak)],COLORS[0]);text(g,'Dashed: peak = initial',a.left+20,a.bottom-18,'#9aaebc',17);
 $('fluid-pressure-value').textContent=r.p0+' mmHg';$('fluid-values').innerHTML=`<strong>${fmt(r.peak,1)} mmHg calculated peak</strong><dl><dt>Peak in kPa</dt><dd>${fmt(r.peakKPa,2)} kPa</dd><dt>Fixed injected bolus</dt><dd>0.2 mL</dd><dt>Pressure–volume index</dt><dd>${fmt(r.index,3)} mL</dd><dt>Peak / initial pressure</dt><dd>${fmt(r.peak/r.p0,3)}</dd></dl>`;document.body.dataset.fluidLab=JSON.stringify(r);
 const index=+$('lavage-group').value,l=LAVAGE[index],drop=pressureDrop(index);$('lavage-bars').replaceChildren();for(const [name,p,color] of [['Source',l.sourceKPa,COLORS[0]],['Joint mean',l.jointKPa,COLORS[2]]]){const row=document.createElement('div');row.className='pressure-bar';const label=document.createElement('span');label.textContent=name+' · '+fmt(p,3)+' kPa';const bar=document.createElement('i');bar.style.width=(100*p/30)+'%';bar.style.background=color;row.append(label,bar);$('lavage-bars').append(row);} $('lavage-values').textContent=`${l.name}, n = ${l.n}: measured joint pressure ${fmt(l.jointKPa,3)} ± ${fmt(l.sd,3)} kPa. Mean source-to-joint pressure difference: ${fmt(drop.dropKPa,3)} kPa.`;
}
export async function createMechanics(){
 let data,playing=false,raf=0,lastTime=0,accumulator=0;
 function stop(){playing=false;cancelAnimationFrame(raf);$('motion-play').textContent='Play cycle';document.body.dataset.motionPlaying='false';}
 try{
 const response=await fetch('./assets/mechanics-r33/motion.json');if(!response.ok)throw Error('Motion data HTTP '+response.status);data=await response.json();if(data.series.length!==15||data.series.some(s=>s.rows.length!==100||s.rows.some(row=>row.length!==27||row.some(v=>!Number.isFinite(v)))))throw Error('Invalid motion data');
 function currentSeries(){return data.series.find(s=>s.subject===$('motion-subject').value&&s.motion_id===$('motion-kind').value);}
 function renderMotion(){const series=currentSeries(),frame=$('motion-frame').value,relative=$('motion-origin').value==='relative',points=motionPoints(series,frame,relative),cycle=+$('motion-cycle').value,index=cycle-1,row=selectedSample(series,cycle),p=points[index],{g,w,h}=surface('motion-plot');
 const mins=[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),maxs=[0,1,2].map(k=>Math.max(...points.map(p=>p[k]))),span=Math.max(...maxs.map((x,k)=>x-mins[k]),.5),base=mins.map(x=>x-span*.1),axes=[0,1,2].map(k=>base.map((x,j)=>x+(k===j?span*.35:0))),P=projector([...points,base,...axes],w,h,+$('motion-orbit').value);
 for(let k=0;k<3;k++){line(g,[P(base),P(axes[k])],COLORS[k],2);const end=P(axes[k]);text(g,'XYZ'[k],end[0]+6,end[1],COLORS[k]);}line(g,points.map(P),'#456071',2);line(g,points.slice(0,cycle).map(P),COLORS[2],4);dot(g,P(points[0]),COLORS[1],5);dot(g,P(p),COLORS[0],8);
 text(g,series.subject+' · '+series.motion+' · '+frame,26,30,'#dce8ed',20);text(g,(relative?'Relative to sample 1':'Original coordinates')+' · cycle '+cycle+'%',26,h-22,'#b3c8d4',18);
 const trace=surface('motion-trace'),lo=Math.min(...mins),hi=Math.max(...maxs),pad=Math.max(.1,(hi-lo)*.08),a=chart(trace.g,trace.w,trace.h,1,100,lo-pad,hi+pad,'Normalized cycle (%)','Translation (mm)');for(let k=0;k<3;k++)line(trace.g,points.map((p,i)=>[a.X(i+1),a.Y(p[k])]),COLORS[k],2);line(trace.g,[[a.X(cycle),a.top],[a.X(cycle),a.bottom]],'#ffffff88',1,[4,3]);
 $('motion-cycle-value').textContent=cycle+'%';$('motion-values').innerHTML=`<strong>${series.subject} · cycle ${cycle}%</strong><dl>${p.map((v,k)=>`<dt>${relative?'Δ':''}${'XYZ'[k]}</dt><dd>${fmt(v,3)} mm</dd>`).join('')}<dt>Displacement from sample 1</dt><dd>${fmt(Math.hypot(...motionPoints(series,frame,true)[index]),3)} mm</dd><dt>Published OVP rotation (X / Y / Z)</dt><dd>${row.slice(FRAMES[frame]-3,FRAMES[frame]).map(x=>fmt(x,2)).join(' / ')}°</dd></dl>`;
 document.body.dataset.motionLab=JSON.stringify({series:series.id,frame,relative,cycle,translation:p,rawRotation:row.slice(FRAMES[frame]-3,FRAMES[frame]),sampleCount:series.rows.length});
 }
 for(const id of ['motion-subject','motion-kind','motion-frame','motion-origin'])$(id).onchange=()=>{stop();renderMotion();};for(const id of ['motion-cycle','motion-orbit'])$(id).oninput=()=>{stop();renderMotion();};
 function tick(time){if(!playing)return;accumulator+=Math.min(time-lastTime,200);lastTime=time;const steps=Math.floor(accumulator/80);if(steps){accumulator-=steps*80;$('motion-cycle').value=((+$('motion-cycle').value-1+steps)%100)+1;renderMotion();}raf=requestAnimationFrame(tick);}
 $('motion-play').onclick=()=>{if(playing)return stop();playing=true;lastTime=performance.now();accumulator=0;$('motion-play').textContent='Pause cycle';document.body.dataset.motionPlaying='true';raf=requestAnimationFrame(tick);};
 $('motion-export').onclick=()=>download('tmj-bescond-'+currentSeries().id+'.json',{schema:'tmj-source-motion-series-r33',source:data.source_url,doi:data.doi,license:data.license,creator:data.creator,source_sha256:data.source_sha256,columns:data.columns,limits:data.limits,series:currentSeries()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});renderMotion();$('mechanics-status').textContent='15 measured series loaded · 1,500 samples · source values preserved.';document.body.dataset.mechanicsState='ready';
 }catch(e){$('mechanics-status').textContent='Motion data could not load: '+e.message;document.body.dataset.mechanicsState='error';$('motion-play').disabled=true;$('motion-export').disabled=true;}
 const tabs=[...document.querySelectorAll('[data-lab]')];function activate(tab){stop();tabs.forEach(t=>{const selected=t===tab;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;$('lab-'+t.dataset.lab).hidden=!selected;});document.body.dataset.activeLab=tab.dataset.lab;}
 tabs.forEach((tab,i)=>{tab.onclick=()=>activate(tab);tab.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();tabs[next].focus();activate(tabs[next]);}};});
 for(const id of ['portal-angle','portal-depth','portal-roll','portal-distance','portal-offset'])$(id).oninput=renderPortal;
 $('portal-reset').onclick=()=>{for(const [id,value] of [['angle',45],['depth',20],['roll',0],['distance',5],['offset',0]])$('portal-'+id).value=value;renderPortal();};
 $('tissue-region').onchange=renderTissue;$('tissue-time').oninput=renderTissue;$('fluid-pressure').oninput=renderFluid;$('lavage-group').onchange=renderFluid;
 $('tissue-table').querySelector('tbody').innerHTML=REGIONS.map((r,i)=>`<tr><th scope="row" style="color:${COLORS[i]}">${r.name}</th><td>${fmt(r.ha)} ± ${fmt(r.haSD)}</td><td>${fmt(r.k)} ± ${fmt(r.kSD)}</td></tr>`).join('');renderPortal();renderTissue();renderFluid();
 document.body.dataset.referenceModels='ready';
}
