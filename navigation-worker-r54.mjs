import {createCavityBuilder} from './cavity-r53.mjs';
import {deformEnclosure} from './enclosure-r48.mjs';
import {solveFluid} from './fluid-r48.mjs';
import {admitMovingJoint} from './moving-instrument-r49.mjs';
import {validateCavityDomain} from './boundary-guard-r48.mjs';
import {admittedAxialRoll} from './optical-roll-r49.mjs';
import {traceDrag} from './drag-sweep-r54.mjs';
import {integrateInput} from './controls-r54.mjs';
import {prepareSurfaces} from './collision-r38.mjs';
import {admit} from './navigation-r49.mjs';
import * as M from './joint-model-r47.mjs';
import {tissueSweep} from './contact-r48.mjs';
let builder,domain,domainProof,domainLimit=null;let source,data,surfaces,parts,pose,geometryState,dense,contactSource,contactParts;let liningSource;let initialized=false;const preparationProofs=new Map();
function derive(state,input=source){return input.map(p=>{let out=p.p;const f=data.fields[p.name];if(f)out=Array.from(M.deformPositions(p.p,f.w,f.r,state,data.axis,data.centre,undefined,f.d));return{name:p.name,p:Array.from(out,Math.fround),i:p.i};});}
function liningAt(state){return liningSource.map(c=>({...c.part,p:Array.from(deformEnclosure(c,state,data),Math.fround)}));}
function guardSurfaces(state){return [...derive(state),...derive(state,contactSource).filter(p=>p.name==='denseTemporal')];}
function bindDense(state){return dense.map(s=>s.name!=='mandible'?s:{...s,forwardPoint:p=>M.rigidPoint(p,state.angle,state.anterior,data.axis,data.centre,state.distraction),inversePoint:p=>M.rigidPoint([p[0],p[1]-state.anterior,p[2]+state.distraction],-state.angle,0,data.axis,data.centre),inverseAxis:v=>M.rigidPoint(v,-state.angle,0,data.axis,[0,0,0])});}
function cropTemporal(p){const indices=[];for(let j=0;j<p.i.length;j+=3){const ids=Array.from(p.i.slice(j,j+3)),vs=ids.map(k=>Array.from(p.p.slice(3*k,3*k+3)));if([0,1,2].every(k=>Math.max(...vs.map(v=>v[k]))>=[-18,-18,-25][k]&&Math.min(...vs.map(v=>v[k]))<=[18,22,17][k]))indices.push(...ids);}return{name:'temporal',p:p.p,i:indices};}
onmessage=async e=>{const m=e.data;const progress=message=>postMessage({id:m.id,type:'progress',message});try{let result;if(m.type!=='init'&&!initialized)throw Error('Joint initialization is incomplete');
 if(m.type==='init'){initialized=false;domainLimit=null;progress('Building the original bone collision surfaces…');
 if(!source){liningSource=m.lining;source=m.parts;data=m.model;const lower=liningSource[1].field;if(!lower.w.every(x=>x===1)||!lower.d.every(x=>x===1)||!lower.r.every(x=>x===0))throw Error('Inferior enclosure must co-move rigidly');dense=prepareSurfaces(m.dense);const rawTemporal=cropTemporal(m.dense.find(p=>p.name==='skull'));contactSource=[{...rawTemporal,name:'denseTemporal'},...source.filter(p=>['condyle','disc'].includes(p.name))];}
 if(!builder){for(const name of ['disc','condyle']){const f=data.fields[name];if(!f.w.every(x=>x===1)||!f.d.every(x=>x===1)||!f.r.every(x=>x===0))throw Error('Source disc and condyle must share a rigid transform');}progress('Building source-bounded fluid compartments…');builder=await createCavityBuilder({enclosures:liningSource,solids:[...m.solids,...source.filter(p=>p.name==='disc')],model:data});}
 if(m.geometry.angle!==0||m.geometry.anterior!==0||m.geometry.wall!==0||![0,2.5].includes(m.geometry.distraction))throw Error('Unknown preparation');
 progress('Checking the prepared joint for bone and disc contact…');
 const contacts=state=>derive(state,contactSource).map(p=>({...p,name:p.name==='denseTemporal'?'temporal':p.name}));
 geometryState=m.geometry;parts=derive(geometryState);contactParts=contacts(geometryState);
 // Neutral source to prescribed preparation: prove the whole linear tissue path.
 const key=geometryState.distraction;let contact=preparationProofs.get(key);if(!contact){contact=tissueSweep(contacts({...geometryState,distraction:0,wall:0}),contactParts,{coRigidDiscCondyle:true});if(contact.clear)contact=tissueSweep(derive({...geometryState,distraction:0,wall:0}),parts,{coRigidDiscCondyle:true});if(contact.clear)preparationProofs.set(key,contact);}
 if(!contact.clear)result={accepted:false,hits:contact.hits,contact};
 else{progress('Verifying the withdrawn instrument before insertion…');surfaces=[...prepareSurfaces(parts),...bindDense(geometryState)];result=admit(surfaces,null,m.pose,{initial:true});result.contact=contact;if(result.accepted){progress('Checking rebuilt cavity topology and contacts…');domain=builder.build(geometryState);const validation=validateCavityDomain(domain.parts);domainProof=validation;if(!validation.clear)throw Error('Invalid reconstructed cavity: '+JSON.stringify(validation.hits));result.cavities=domain.parts;result.domainMS=domain.elapsedMS;result.liningBaselineContacts=0;result.liningContact=validation;pose=result.pose;initialized=true;}}
 }
 else if(m.type==='move'){
  if(m.inputs){
   const began=performance.now(),trajectory=[];let contacts=[],samples=0,limited=false;
   const steps=m.inputs.flatMap(input=>{const d=input.delta,n=Math.max(1,Math.ceil(Math.hypot(d.x||0,d.y||0)/.5),Math.ceil(Math.abs(d.roll||0)/3),Math.ceil(Math.abs(d.depth||0)/.1));return Array.from({length:n},()=>({...input,delta:Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v/n]))}));});
   for(const input of steps){
    const from={...pose},target=integrateInput(pose,input.delta,input.options);
    const step=admittedAxialRoll(pose,target)||traceDrag(surfaces,pose,target);samples+=step.samples||0;
    if(step.accepted)pose=step.pose;
    if(step.limited){
     limited=true;contacts=step.contactHits||[];
     // Steering obstruction must not swallow optical roll or a requested
     // withdrawal. Check the residual combined channel from the admitted pose.
     const residual={...pose,roll:target.roll,depth:input.delta.depth<0?Math.min(pose.depth,target.depth):pose.depth};
     const free=admittedAxialRoll(pose,residual)||traceDrag(surfaces,pose,residual);samples+=free.samples||0;
     if(free.accepted)pose=free.pose;
    }
    trajectory.push({from,requested:target,pose:{...pose},limited:!!step.limited});
   }
   result={accepted:true,pose:{...pose},limited,contactHits:contacts,hits:[],samples,trajectory,workerMS:performance.now()-began,method:'ordered coupled input; swept each segment; checked withdrawal and roll residual'};
  }else{result=admittedAxialRoll(pose,m.pose)||(m.limit?traceDrag(surfaces,pose,m.pose):admit(surfaces,pose,m.pose));if(result.accepted)pose=result.pose;}
 }
 else if(m.type==='geometry'){
 M.validateParameters(m.geometry);
 const hardChanged=['angle','anterior','distraction'].some(k=>m.geometry[k]!==geometryState[k]);
 const next=hardChanged?derive(m.geometry):parts,nextContact=hardChanged?derive(m.geometry,contactSource).map(p=>({...p,name:p.name==='denseTemporal'?'temporal':p.name})):contactParts;
 // The linear CCD path encloses the actual rigid arc after adding its sag
 // bound to the separation tolerance (conservative, never a relaxed guard).
 const arcTolerance=1e-5+170*(1-Math.cos(Math.abs(m.geometry.angle-geometryState.angle)*Math.PI/360));
 const contact=hardChanged?tissueSweep(contactParts,nextContact,{tolerance:arcTolerance,coRigidDiscCondyle:true}):{clear:true,hits:[],method:'unchanged admitted source geometry'},localContact=contact.clear&&hardChanged?tissueSweep(parts,next,{tolerance:arcTolerance,coRigidDiscCondyle:true}):contact;
 if(!localContact.clear)result={accepted:false,pose,hits:localContact.hits,contact:localContact};
 else{
  progress('Solving the rebuilt cavity and irrigation volume…');
  const equilibrium=m.geometry.sourcePressure/(1+(m.geometry.outletOpen?m.geometry.inletResistance/m.geometry.outletResistance:0));
  const supportsLimit=!hardChanged&&m.fluid&&equilibrium>=m.geometry.wallStiffness*m.fluid.wall-1e-9;
  if(domainLimit&&supportsLimit){const fluid=M.contactFluidStep(m.fluid,m.geometry,.1);postMessage({id:m.id,accepted:true,pose,hits:[],geometry:geometryState,cavityUnchanged:true,fluid,contact,liningContact:domainLimit.proof,domainLimit,method:'hydraulics at the last admitted model boundary'});return;}
  let solved=null,solveLimit=null;
  try{solved=m.fluid?solveFluid(m.fluid,m.geometry,.1,wall=>!hardChanged&&wall===geometryState.wall?domain:builder.build({...m.geometry,wall})):null;}
  catch(error){if(supportsLimit&&error.message==='Wall displacement limit reached')solveLimit={kind:'wall displacement bound',surface:'superior'};else throw error;}
  if(solveLimit){domainLimit={reason:solveLimit,proof:validateCavityDomain(domain.parts)};postMessage({id:m.id,accepted:true,pose,hits:[],geometry:geometryState,cavityUnchanged:true,fluid:M.contactFluidStep(m.fluid,m.geometry,.1),contact,liningContact:domainLimit.proof,domainLimit,method:'hydraulics at the last admitted model boundary'});return;}

  const target={...m.geometry,wall:solved?solved.fluid.wall:m.geometry.wall},nextDomain=solved?solved.geometry:builder.build(target);
  if(!Number.isFinite(target.wall)||target.wall<-.35||target.wall>.75)throw Error('Wall limit');
  let liningContact=nextDomain===domain&&!hardChanged?domainProof:null;
  if(!liningContact)for(const fraction of [.5,1]){const state={...target};for(const key of ['angle','anterior','distraction','wall'])state[key]=geometryState[key]+(target[key]-geometryState[key])*fraction;const sample=fraction===1?nextDomain:builder.build(state);liningContact=validateCavityDomain(sample.parts);if(!liningContact.clear)break;}
  if(!liningContact.clear){
   if(supportsLimit&&target.wall>=geometryState.wall){domainLimit={reason:liningContact.hits[0],proof:validateCavityDomain(domain.parts)};result={accepted:true,pose,hits:[],cavityUnchanged:true,fluid:M.contactFluidStep(m.fluid,m.geometry,.1),contact,liningContact:domainLimit.proof,domainLimit,method:'hydraulics at the last admitted model boundary'};}
   else result={accepted:false,pose,hits:liningContact.hits,liningContact,contact:liningContact};
  }
  else{
   progress('Checking moving tissues against the complete instrument…');
   const motion=hardChanged?admitMovingJoint(geometryState,target,pose,{fixed:[...prepareSurfaces(parts.filter(p=>p.name==='temporal')),...bindDense(geometryState).filter(p=>p.name==='skull')],movingAt:state=>[...prepareSurfaces(derive(state).filter(p=>p.name!=='temporal')),...bindDense(state).filter(p=>p.name==='mandible')]}):{accepted:true,pose,hits:[],method:'unchanged admitted source geometry'};
   result={...motion,liningContact,contact,fluid:solved?.fluid,fluidEvaluations:solved?.evaluations};
   if(result.accepted){domainLimit=null;parts=next;contactParts=nextContact;surfaces=[...prepareSurfaces(next),...bindDense(target)];geometryState=target;if(nextDomain===domain)result.cavityUnchanged=true;else result.cavities=nextDomain.parts;domain=nextDomain;domainProof=liningContact;result.domainMS=result.cavityUnchanged?0:domain.elapsedMS;}
  }
 }
 }else throw Error('Unknown request');postMessage({id:m.id,...result,geometry:geometryState});
 }catch(e){postMessage({id:m.id,error:e.message,accepted:false});}};
