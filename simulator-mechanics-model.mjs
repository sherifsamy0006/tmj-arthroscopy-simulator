// Quantitative reference models. None are registered to the simulator head.
export const REGIONS = [
 {id:'anterior',name:'Anterior',ha:18.61,haSD:3.02,k:8.95,kSD:1.17},
 {id:'posterior',name:'Posterior',ha:25.44,haSD:7.27,k:8.07,kSD:1.55},
 {id:'medial',name:'Medial',ha:59.81,haSD:11.2,k:3.86,kSD:.70},
 {id:'intermediate',name:'Intermediate',ha:74.93,haSD:10.99,k:3.64,kSD:.67},
 {id:'lateral',name:'Lateral',ha:74.51,haSD:12.23,k:3.74,kSD:.78}
];
const finite = (v,min,max,name) => {if(!Number.isFinite(v)||v<min||v>max)throw Error('Invalid '+name);return v;};
export function bolusPeak(p0){
 finite(p0,5,60,'baseline pressure');
 const index=.001*p0+.538,deltaV=.2,peak=p0*10**(deltaV/index);
 return {p0,index,deltaV,peak,peakKPa:peak*.133322387415};
}
// Linear one-dimensional confined biphasic step-creep solution, drained top,
// impermeable base. H_A*k is hydraulic diffusivity; h is the drainage length.
// The coefficients are measured group means; the generated trace is a model.
export function creep(regionId,seconds){
 const r=REGIONS.find(r=>r.id===regionId);if(!r)throw Error('Unknown region');
 finite(seconds,0,864000,'time');
 const h=.0014,area=Math.PI*(.005/2)**2,D=r.ha*1000*r.k*1e-15;
 const tau=4*h*h/(Math.PI**2*D);let fraction=0;
 if(seconds>0){let remaining=0;for(let n=0;n<160;n++){const odd=2*n+1;remaining+=8/(Math.PI**2*odd*odd)*Math.exp(-odd*odd*seconds/tau);}fraction=Math.max(0,Math.min(1,1-remaining));}
 return {fraction,incrementalStrain:.02*fraction,compressionMm:1.4*.02*fraction,forceN:r.ha*1000*.02*area,tauSeconds:tau,diffusivity:D};
}
export const FRAMES={SGF:4,RSLF:10,LSLF:16};
export function motionPoints(series,frame='SGF',relative=true){
 const start=FRAMES[frame];if(!start||!series?.rows?.length)throw Error('Invalid motion');
 return series.rows.map(row=>[0,1,2].map(k=>row[start+k]-(relative?series.rows[0][start+k]:0)));
}
export function selectedSample(series,cycle){return series.rows[Math.round(finite(cycle,1,100,'cycle'))-1];}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,k)=>a.map(x=>x*k),mag=a=>Math.hypot(...a);
export function triangulation({angle=45,depth=20,roll=0,workingDistance=5,offset=0}={}){
 finite(angle,20,70,'shaft angle');finite(depth,10,40,'shaft insertion');finite(roll,-180,180,'roll');finite(workingDistance,2,12,'working distance');finite(offset,-8,8,'working tip offset');
 const a=angle*Math.PI/180,r=roll*Math.PI/180,s=[Math.cos(a),0,Math.sin(a)],u=[-Math.sin(a),0,Math.cos(a)],v=[0,1,0];
 const look=add(mul(s,Math.cos(Math.PI/6)),add(mul(u,Math.sin(Math.PI/6)*Math.cos(r)),mul(v,Math.sin(Math.PI/6)*Math.sin(r))));
 const lens=mul(s,depth),target=add(lens,mul(look,workingDistance)),tip=add(target,[offset,0,0]),portal=[tip[0],tip[1],0],ray=add(tip,mul(lens,-1));
 const viewAngle=Math.acos(Math.max(-1,Math.min(1,dot(ray,look)/mag(ray))))*180/Math.PI;
 return {s,look,lens,target,tip,portal,spacing:mag(portal),normalDepth:tip[2],shaftAngle:90-angle,targetError:Math.abs(offset),viewAngle,inView:dot(ray,look)>0&&viewAngle<=32.5};
}
export const LAVAGE=[{name:'Arthroscopic lavage',n:37,id:2.4,sourceKPa:27.575,jointKPa:14.883,sd:.860},{name:'Arthrocentesis',n:41,id:.8,sourceKPa:27.575,jointKPa:13.012,sd:1.021}];
export function pressureDrop(group){const g=LAVAGE[group];if(!g)throw Error('Invalid group');return {dropKPa:g.sourceKPa-g.jointKPa,fraction:g.jointKPa/g.sourceKPa};}
