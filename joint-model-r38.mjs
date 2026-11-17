// r34 engineering sensitivity model. These kinematics and wall stiffness are
// explicit assumptions, not the source FEM, patient motion, or clinical FSI.
export const DEFAULTS=Object.freeze({angle:0,anterior:0,distraction:0,sourcePressure:0,inletResistance:20,outletResistance:20,wallStiffness:5,outletOpen:true});
export const BOUNDS=Object.freeze({wall:[-.35,.75],angle:[0,8],anterior:[0,2],distraction:[0,3],sourcePressure:[0,3],inletResistance:[5,100],outletResistance:[5,100],wallStiffness:[2,15]});
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function validateParameters(p){for(const k of Object.keys(BOUNDS).filter(k=>k!=='wall'))if(!Number.isFinite(p[k])||p[k]<BOUNDS[k][0]||p[k]>BOUNDS[k][1])throw Error(`Outside model domain: ${k}`);if(typeof p.outletOpen!=='boolean')throw Error('Invalid outlet state');return p;}
export function rigidPoint(p,angle,anterior,axis,centre,distraction=0){
 if(angle===0&&anterior===0&&distraction===0)return p.slice();
 const t=angle*Math.PI/180,c=Math.cos(t),s=Math.sin(t),v=p.map((x,j)=>x-centre[j]),d=dot(axis,v),cross=[axis[1]*v[2]-axis[2]*v[1],axis[2]*v[0]-axis[0]*v[2],axis[0]*v[1]-axis[1]*v[0]];
 return v.map((x,j)=>centre[j]+c*x+s*cross[j]+(1-c)*d*axis[j]+(j===1?anterior:0)-(j===2?distraction:0));
}
export function deformPoint(p,weight,radial,state,axis,centre,distractionWeight=weight){const q=rigidPoint(p,state.angle,state.anterior,axis,centre,0);return p.map((x,j)=>x+weight*(q[j]-x)+state.wall*radial[j]-(j===2?(state.distraction||0)*distractionWeight:0));}
export function deformPositions(base,weights,radials,state,axis,centre,out=new Float64Array(base.length),distractionWeights=weights){
 for(let i=0;i<base.length;i+=3){const p=deformPoint(base.slice(i,i+3),weights[i/3],radials.slice(i,i+3),state,axis,centre,distractionWeights[i/3]);out.set(p,i);}return out;
}
export function signedVolume(p,indices){let sum=0;for(let j=0;j<indices.length;j+=3){const a=3*indices[j],b=3*indices[j+1],c=3*indices[j+2];sum+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);}return sum/6000;}
// mL; with a linear spatial wall mode, enclosed signed volume is exactly cubic.
export function volumePolynomial(base,indices,radial){const sign=Math.sign(signedVolume(base,indices));if(!sign)throw Error('Zero envelope volume');const v=b=>{const p=base.map((x,i)=>x+b*radial[i]);return sign*signedVolume(p,indices);};const a=v(0),vp=v(1),vm=v(-1),v2=v(2),c=(vp+vm)/2-a,d=(v2-a-4*c-(vp-vm))/6,b=(vp-vm)/2-d;return [a,b,c,d];}
export const volumeAt=(a,b)=>((a[3]*b+a[2])*b+a[1])*b+a[0];
export const derivativeAt=(a,b)=>(3*a[3]*b+2*a[2])*b+a[1];
export function checkPolynomial(a){const [lo,hi]=BOUNDS.wall;const samples=[lo,hi];if(a[3]!==0){const x=-a[2]/(3*a[3]);if(x>lo&&x<hi)samples.push(x);}return samples.every(x=>derivativeAt(a,x)>1e-8)&&volumeAt(a,lo)>0;}
export function wallForVolume(a,volume){if(!checkPolynomial(a))throw Error('Non-monotone deformation domain');let [lo,hi]=BOUNDS.wall;if(volume<volumeAt(a,lo)-1e-12||volume>volumeAt(a,hi)+1e-12)throw Error('Wall displacement limit reached');for(let j=0;j<55;j++){const m=(lo+hi)/2;if(volumeAt(a,m)<volume)lo=m;else hi=m;}return(lo+hi)/2;}
export function initialFluid(poly){return{volume:poly[0],wall:0,pressure:0,netIn:0,grossIn:0,grossOut:0,tracerMass:poly[0],initialVolume:poly[0],elapsed:0};}
// Closed well-mixed scalar circuit: clean reservoirs at both boundaries.
// Positive rates enter / leave the joint respectively. Reverse flow is retained.
// Backward Euler solves wall, pressure and fluid storage in one monotone root.
export function fluidStep(previous,poly,p,dt){validateParameters(p);if(!Number.isFinite(dt)||dt<=0||dt>.1)throw Error('Time step must be in (0, 0.1] seconds');if(!checkPolynomial(poly))throw Error('Invalid envelope response');
 const inConductance=1/p.inletResistance,outConductance=p.outletOpen?1/p.outletResistance:0,k=p.wallStiffness;
 const flow=b=>({qin:(p.sourcePressure-k*b)*inConductance,qout:k*b*outConductance});
 const f=b=>{const {qin,qout}=flow(b);return volumeAt(poly,b)-previous.volume-dt*(qin-qout);};
 let[lo,hi]=BOUNDS.wall;if(f(lo)>1e-12||f(hi)<-1e-12)throw Error('Wall displacement limit reached — reduce the pose/pressure or reset');
 for(let j=0;j<55;j++){const m=(lo+hi)/2;if(f(m)>0)hi=m;else lo=m;}
 const wall=(lo+hi)/2,pressure=k*wall,{qin,qout}=flow(wall),volume=volumeAt(poly,wall),incoming=Math.max(0,qin)+Math.max(0,-qout),outgoing=Math.max(0,qout)+Math.max(0,-qin);
 const tracerMass=previous.tracerMass/(1+dt*outgoing/volume),netIn=previous.netIn+dt*(qin-qout);
 return{...previous,contactLimited:false,reactionPressure:0,volume,wall,pressure,qin,qout,netIn,grossIn:previous.grossIn+dt*incoming,grossOut:previous.grossOut+dt*outgoing,tracerMass,concentration:tracerMass/volume,elapsed:previous.elapsed+dt,residual:volume-previous.initialVolume-netIn};
}
export function poseFluid(previous,poly,stiffness){const wall=wallForVolume(poly,previous.volume);return{...previous,wall,pressure:wall*stiffness};}

// Fixed-volume hydraulic step while a unilateral tissue contact blocks expansion.
// The pressure residual is carried by a reduced contact reaction, not penetration.
export function contactFluidStep(previous,p,dt){
 validateParameters(p);if(!(dt>0&&dt<=.1))throw Error('Invalid contact time step');
 const gi=1/p.inletResistance,go=p.outletOpen?1/p.outletResistance:0,pressure=p.sourcePressure*gi/(gi+go),reactionPressure=pressure-p.wallStiffness*previous.wall;
 if(reactionPressure< -1e-9)throw Error('Contact cannot support tensile pressure');
 const qin=(p.sourcePressure-pressure)*gi,qout=pressure*go,outgoing=Math.max(0,qout)+Math.max(0,-qin),incoming=Math.max(0,qin)+Math.max(0,-qout),volume=previous.volume;
 return {...previous,pressure,reactionPressure,contactLimited:true,qin,qout,netIn:previous.netIn+dt*(qin-qout),grossIn:previous.grossIn+dt*incoming,grossOut:previous.grossOut+dt*outgoing,tracerMass:previous.tracerMass/(1+dt*outgoing/volume),elapsed:previous.elapsed+dt,residual:volume-previous.initialVolume-previous.netIn};
}
