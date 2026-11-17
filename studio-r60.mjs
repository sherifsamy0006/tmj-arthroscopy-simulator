import {interpolatePose} from './drag-sweep-r54.mjs';
import {regionalVolumes} from './regional-volume-r48.mjs';
import {applyAttachment} from './reconstruction-r51.mjs';
import {applyReconstruction} from './reconstruction-r48.mjs';
import {meterPixels,exposureTarget,nextExposure,adaptExposure} from './exposure-r52.mjs';
import {createSection} from './section-r43.mjs';
import {washoutState} from './washout-r43.mjs';
import * as T from './vendor/three-0.170.0.module.min.js';
import * as M from './joint-model-r47.mjs';
import {START,PREPARED,PREPARATION,PIVOT,DEPTH_OFFSET,APPROACH_REFERENCE,TOOL,opticalPose} from './navigation-r53.mjs';
import {createMap} from './map-r59.mjs';
import {tissueMaterial,withViewDistance} from './materials-r58.mjs';
import {createLensFX} from './lensfx-r60.mjs';
import {createFluidParticles} from './fluidfx-r58.mjs';
import {STEPS,PROTRUSION,createFluidState,stepFluid,clarity,describeFluid,exchangeRate} from './procedure-r58.mjs';
import {createLining} from './lining-r54.mjs';
import {bindInstrumentGestures} from './gestures-r60.mjs';
import {steerPose,wrapRoll,imageBasis} from './controls-r54.mjs';
const $=s=>document.querySelector(s),V=a=>new T.Vector3(...a),fmt=(v,n=2)=>Number(v).toFixed(n);
const bootStarted=performance.now();let startupMS=0,scopeRenderMS=0,regional=null,fieldSamples=[];
let stopEngine=()=>{};
function lockControls(){const ready=document.body.dataset.state==='ready';for(const c of document.querySelectorAll('button,input,select'))if(c.id!=='retry'&&!c.dataset.tab&&!c.dataset.dock)c.disabled=!ready;for(const c of document.querySelectorAll('canvas')){c.setAttribute('aria-disabled',String(!ready));c.tabIndex=ready&&c.id!=='overview'?0:-1;}$('#workspace').setAttribute('aria-busy',String(document.body.dataset.state==='loading'));$('#retry').hidden=document.body.dataset.state!=='error';$('#retry').disabled=false;}
function fatal(error,message='The joint could not finish loading. Please retry.'){if(document.body.dataset.state==='error')return;document.body.dataset.state='error';document.body.dataset.failure=error.message;stopEngine(error);lockControls();$('#load').textContent=message;$('#load').classList.add('error');$('#motion-status').textContent='Navigation paused. No further movement is accepted.';$('#motion-status').className='motion-status blocked';console.error(error);}
$('#retry').onclick=()=>location.reload();
document.body.dataset.state='loading';lockControls();
// Canvas input and tab visibility can fire while the collision worker initializes.
// Keep the whole interface locked until both preparation and insertion settle.
for(const name of ['pointerdown','pointermove','pointerup','keydown','input','change','click','wheel'])document.addEventListener(name,e=>{if(document.body.dataset.state!=='ready'&&e.target.closest?.('button,input,select,canvas')&&!e.target.closest('#retry,[data-tab],[data-dock]')){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
async function load(path,hash){const r=await fetch(path);if(!r.ok)throw Error(`${path}: ${r.status}`);const b=await r.arrayBuffer();if(hash){const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');if(h!==hash)throw Error('Geometry checksum mismatch');}return JSON.parse(new TextDecoder().decode(b));}
try{
 const data=await load('./assets/access-r38/model.json'),[anatomy,spaces]=await Promise.all([load('./tmj-anatomy-v21.json',data.sourceHash),load('./joint-spaces-v26.json',data.cavityHash)]);
 const access=await load('./assets/access-r38/manifest.json'),dense=await Promise.all(access.parts.map(async p=>{const response=await fetch('./assets/access-r38/'+p.file);if(!response.ok)throw Error('Dense source unavailable');const raw=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==p.sha256)throw Error('Dense source checksum mismatch');return{name:p.name,p:new Float32Array(raw,0,p.vertices*3),i:new Uint32Array(raw,p.vertices*12,p.triangles*3)};}));
 const sourceParts=anatomy.parts.filter(p=>['temporal','condyle','disc'].includes(p.name));
 data.fields=M.rigidBoundaryFields(sourceParts,data.fields);
 const reconstructionHash='d0b63243eb1a8ae4d78bbaa664e4e8cd3f59d96857df3f43facd09fe4a06b527';
 const reconstructed=await load('./assets/r47/geometry-candidate.json',reconstructionHash);
 const sourceOperands=await load('./assets/r48/closed-source-operands.json','7e83f43cda4927ef6d8647178c3d5ff90f3003421f3aa57eb0481c94c25189b8');
 const reconstructionRepairHash='2156fbf404fcae63e8da8005536861b4f7ebfb0570671a3d40a748f7a15932c2';
 const fieldOverride=await load('./assets/r48/enclosure-source-repaired.json',reconstructionRepairHash);
 const attachmentHash='a22a5f082635fa28ed0fae78a345f616b8e23078dcb78ae08c2e09d80a3bba3f';
 const attachmentPatch=await load('./assets/r51/attachment-candidate.json',attachmentHash);applyAttachment(fieldOverride,attachmentPatch);
 applyReconstruction(reconstructed,fieldOverride);
 const envelopeHash='7a20df4c9fd5bf8ba47906243de2e3c6d56e266a55748b0fbd73a09d753b1323';
 reconstructed.overlays=[await load('./assets/r54/posterior-envelope.json',envelopeHash)];
 const scene=new T.Scene();scene.background=new T.Color('#080606');// Warm fill: light scattered between the walls of a small closed cavity is reddened by tissue.
 scene.add(new T.AmbientLight('#f4bfcd',.72));
 const camera=new T.PerspectiveCamera(65,1,.01,250),lamp=new T.SpotLight('#fff9f4',15,65,.98,.85,2),fill=new T.SpotLight('#fffaf6',5,65,.98,.85,2);scene.add(lamp,lamp.target,fill,fill.target);
 const renderer=new T.WebGLRenderer({canvas:$('#scope'),antialias:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=T.PCFShadowMap;
 // The joint is drawn in linear light, then one display pass adds lens optics and fluid.
 const fx=createLensFX(T,renderer),particles=createFluidParticles(T);scene.add(particles.points);
 for(const light of [lamp,fill]){light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.025;light.shadow.camera.far=35;light.shadow.bias=-.0003;light.shadow.normalBias=0;light.shadow.radius=8;}
 function geo(p){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.p,3));g.setIndex(p.i);g.computeVertexNormals();return g;}
 const records=anatomy.parts.filter(p=>!p.head&&p.mode!=='original').map(part=>{const g=geo(part),mesh=new T.Mesh(g,tissueMaterial(T,part.layer,part.name));mesh.name=part.name;scene.add(mesh);return{part,g,mesh,field:data.fields[part.name]};});
 const heads=anatomy.parts.filter(p=>p.head).map(part=>({part,g:geo(part)}));
 const originalCavities=['superior','inferior'].map(n=>spaces.parts.find(p=>p.name===n));
 // Use the audited precomputed asset; fairing is not repeated on every visit.
 if(!reconstructed.inferior)throw Error('Reconstructed lining data is incomplete');
 const foldRefinement=[{part:reconstructed.part,report:reconstructed.report},{part:reconstructed.inferior.part,report:reconstructed.inferior.report||{method:'unchanged rest mesh, rigid hard boundary fields'}}];
 const liningDeformation=[reconstructed,reconstructed.inferior].map(c=>({field:c.field,report:{method:'shared reconstructed soft lining; rigid hard boundary fields',measuredMechanics:false}}));
 const cavityParts=foldRefinement.map(r=>r.part);
 const cavities=cavityParts.map((part,i)=>({part,g:geo(part),field:liningDeformation[i].field,overlays:i===0?reconstructed.overlays:[]})),upper=cavities[0];
 const closureIndices=[];upper.part.faceBoundaries.forEach((n,i)=>{if(n==='closure')closureIndices.push(...upper.part.i.slice(i*3,i*3+3));});const closureGeo=new T.BufferGeometry();closureGeo.setAttribute('position',upper.g.attributes.position);closureGeo.setIndex(closureIndices);closureGeo.computeVertexNormals();const closure=new T.Mesh(closureGeo,tissueMaterial(T,'capsule','computational-closure')); closure.name='Computational closure';scene.add(closure);
 // Render the reconstructed fluid-space boundary from its actual lens position.
 // Boundary positions are the same buffers used by the locator and volume model.
 const liningMaterials=[tissueMaterial(T,'lining','compartment',{lining:true})];
 const lining=cavities.map(c=>{const l=createLining(T,c,liningMaterials[0]);scene.add(l.mesh);return l;});
 const map=createMap(T,{canvas:$('#map'),overviewCanvas:$('#overview'),records,heads,cavities,labelLayer:$('#map-labels')});
 const section=createSection({canvas:$('#section'),records,cavities});
 // Procedure state. The telescope is the only collision-checked instrument; the syringe,
 // outflow needle and irrigation lines are teaching overlays.
 const visual=createFluidState(),proc={step:-1,done:-1,working:false,scopeHidden:false,awaitBleed:false,readyAt:0,fill:0};
 const approach=opticalPose(START).axis;
 const tools={inject:{visible:false,advance:0,plunger:0,tip:PIVOT.map((v,i)=>v+approach[i]*2),axis:approach},
  outflow:{visible:false,advance:0,tip:[0,0,0],axis:[0,1,0],syringe:false,fill:0,tint:0,flow:false,phase:0},
  inflow:{visible:false,flow:false,phase:0}};
 const needle=new T.Group(),needleSteel=withViewDistance(new T.MeshStandardMaterial({color:'#c9d1d4',metalness:.55,roughness:.32}));
 {const shaft=new T.Mesh(new T.CylinderGeometry(.64,.64,16,20),needleSteel);shaft.position.y=-8;const bevel=new T.Mesh(new T.ConeGeometry(.64,1.8,20),needleSteel);bevel.position.y=.9;for(const m of[shaft,bevel]){m.castShadow=true;m.name='outflow needle';needle.add(m);}}
 needle.visible=false;scene.add(needle);
 const lens={blood:0,haze:0,occlusion:0,standby:0,collapse:0,dissolve:0,notch:0,optics:true},spaceScale={value:1};
 let sprites=particles.summary(),spritesWereAlive=false,spaceGlow=0,lastFrame=performance.now(),sceneKey='';
 let currentDomain=null;
 let sectionEvidence=null,scopeKey='',rayKey='',scopeRenders=0,raycasts=0,washout=null;
 let pose={...START},params={...M.DEFAULTS,distraction:PREPARATION},fluid=null,running=false,busy=false,queued=null,blocked=null,lastCheck=null,orbit={az:-42,el:18,zoom:1,panX:0,panY:0},frameCount=0,lastFluid=0,hit=null,locator=null,geometryRevision=0,requestId=0,alive=true;
 const worker=new Worker(new URL('./navigation-worker-r54.mjs',import.meta.url),{type:'module'}),pending=new Map();
 stopEngine=error=>{alive=false;running=false;queued=null;worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();};
 worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;if(e.data.type==='progress'){p.arm();if(document.body.dataset.state==='loading')$('#load').textContent=e.data.message;else status(e.data.message,'pending');return;}pending.delete(e.data.id);clearTimeout(p.timer);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data);};
 worker.onerror=e=>{e.preventDefault();fatal(Error(e.message||'Collision worker unavailable'),'Navigation engine stopped. Please retry to restore the checked joint.');};
 worker.onmessageerror=()=>fatal(Error('Collision worker response could not be read'),'Navigation engine stopped. Please retry.');
 function check(type,payload){if(!alive)return Promise.reject(Error('Collision engine unavailable'));return new Promise((resolve,reject)=>{const id=++requestId,p={resolve,reject,timer:null,arm(){clearTimeout(p.timer);p.timer=setTimeout(()=>fatal(Error('Collision check timed out'),'The movement check did not finish. Please retry.'),60000);}};pending.set(id,p);p.arm();worker.postMessage({id,type,...payload});});}
 const canInteract=()=>alive&&document.body.dataset.state==='ready';
 let travel=null,exposure=1.05,exposureApplied=1.05,exposureMeter=null;
 const meterCanvas=document.createElement('canvas');meterCanvas.width=meterCanvas.height=32;
 const meterContext=meterCanvas.getContext('2d',{willReadFrequently:true});
 const meterIntervalMS = 125;
 let exposureSettling=false,lastExposureTime=-Infinity,exposureNext=1.05;
 let lastShadowKey = '';

 let lastPoseKey='', lastMotionTime=-Infinity;
 function renderScope(now, meterDelay, redraw=true){
  const began=performance.now(),automatic=$('#auto-exposure').checked;
  exposureApplied=automatic?exposureNext:exposure;
  if(redraw){fx.renderScene(scene,camera);scopeRenders++;}
  fx.present({...lens,look:Number($('#lens-look').value),exposure:exposureApplied,time:now/1000,optics:$('#lens-optics').checked});
  if (!automatic) {
   exposureMeter=null;
   exposureSettling=false;
  } else if (now-lastExposureTime >= meterDelay) {
   exposureSettling=false;
   meterContext.drawImage(renderer.domElement,0,0,32,32);
   exposureMeter=meterPixels(meterContext.getImageData(0,0,32,32).data,32,32);
   const target=exposureTarget(exposure),desired=nextExposure(exposureApplied,exposureMeter,target);
   const dt=Math.min(.15,Math.max(.008,(now-lastExposureTime)/1000));
   if(Math.abs(exposureMeter-target)>.012&&Math.abs(desired-exposureApplied)>.002){
    exposureNext=adaptExposure(exposureApplied,desired,dt);exposureSettling=true;
   }
   lastExposureTime=now;
  } else {
   // A changed view still needs a meter reading after a short gesture ends.
   exposureSettling=true;
  }
  scopeRenderMS=performance.now()-began;
  $('#exposure-mode').textContent=automatic?'Auto · gradual adaptation, faster highlight protection':'Manual · fixed exposure';
 }

 const increment=()=>Number($('#step').value);
 async function followCheckedPose(target,rollInvariant=false,travelMS=0){
  // Only the worker can certify that the already-admitted envelope is unchanged.
  if(rollInvariant){pose={...target,roll:wrapRoll(target.roll)};travel=null;return;}
  const from={...pose};target={...target,roll:from.roll+wrapRoll(target.roll-from.roll)};const distance=Math.abs(target.depth-from.depth),angle=Math.max(...['yaw','pitch','roll'].map(k=>Math.abs(target[k]-from[k])));
  // The worker has already admitted the whole sweep, including intermediate angles.
  // No camera easing is independent of the physical shaft.
  if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){pose={...target,roll:wrapRoll(target.roll)};return;}
  const duration=travelMS||Math.min(240,Math.max(40,distance*20,angle*4));
  let previous=performance.now(),progress=0;
  travel={from,target:{...target},progress:0,admitted:true};
  while(alive){
   // Advance on rendered frames. A delayed timer must not consume the whole
   // admitted path before the renderer has shown any intermediate positions.
   const now=await new Promise(resolve=>requestAnimationFrame(resolve));
   if(!alive)break;
   if(document.hidden){pose={...target,roll:wrapRoll(target.roll)};break;}
   progress=Math.min(1,progress+Math.min(.35,Math.max(0,now-previous)/duration));previous=now;
   const t=progress,u=t*t*(3-2*t);
   pose=interpolatePose(from,target,u);travel.progress=t;
   if(t===1)break;
  }
  if(alive)pose={...target,roll:wrapRoll(target.roll)};travel=null;
 }
 $('#roll-left').onclick=()=>move(p=>({...p,roll:wrapRoll(p.roll-15)}));$('#roll-right').onclick=()=>move(p=>({...p,roll:wrapRoll(p.roll+15)}));
 $('#identify').onchange=()=>{$('#field-tissues').hidden=!$('#identify').checked;};
 $('#step').onchange=()=>{const step=increment();$('#withdraw').textContent='← Outward '+step+' mm';$('#advance').textContent='Inward '+step+' mm →';};
 $('#exposure').oninput=e=>{exposure=Number(e.target.value);renderer.toneMappingExposure=exposure;$('#exposure-out').textContent=exposure.toFixed(2)+'×';};
 $('#reticle').onchange=e=>$('.reticle').hidden=!e.target.checked;


 function status(text,kind=''){const e=$('#motion-status');e.textContent=text;e.className='motion-status '+kind;$('#scope-state').textContent=kind==='pending'?'CHECKING MOTION':kind==='blocked'?'CONTACT LIMIT':kind==='wall'?'JOINT BOUNDARY':'LIVE LENS';$('#scope-state').dataset.kind=kind;}
 let atlasAngles={yaw:0,pitch:0};$('#optical-mode').value='instrument';
 function sync(){lockControls();const sliced=$('#locator-mode').value==='section';for(const id of ['view','map-drag','separate','cutaway','lens-guides','translucent-roof','envelope','teaching'])$('#'+id).disabled=sliced||!canInteract();$('#anatomy-key').hidden=sliced||!$('#teaching').checked;const atlas=$('#optical-mode').value!=='instrument';for(const id of ['depth','yaw','pitch','roll','advance','withdraw','park','scope-drag'])$('#'+id).disabled=atlas||!canInteract();for(const k of ['depth','yaw','pitch','roll']){$('#'+k).value=pose[k];$('#'+k+'-out').textContent=fmt(pose[k],k==='depth'?2:1)+(k==='depth'?' mm':'°');}$('#jaw').value=params.angle;$('#jaw-out').textContent=fmt(params.angle,2)+'°';$('#slide').value=params.anterior;$('#slide-out').textContent=fmt(params.anterior)+' mm';$('#distraction').value=params.distraction;$('#distraction-out').textContent=fmt(params.distraction)+' mm';$('.preparation').textContent=`${params.distraction?'Prepared':'Neutral'} joint · ${fmt(params.distraction)} mm prescribed inferior distraction. Disc and condyle co-translate in this mode.`;$('#pressure').value=params.sourcePressure;$('#pressure-out').textContent=fmt(params.sourcePressure,1)+' kPa';$('#outlet').checked=params.outletOpen;$('#flow').textContent=running?'Pause flow':'Run flow';syncProcedure();}
 function applyDomain(parts){
  if(!parts)throw Error('Missing rebuilt cavity');currentDomain=parts;
  for(let k=0;k<cavities.length;k++){
   const c=cavities[k],p=parts[k];Object.assign(c.part,{p:p.p,i:p.i,faceBoundaries:p.faceBoundaries,rest:p.rest,textureRest:p.textureRest,mergeFrom:p.mergeFrom,mergeTo:p.mergeTo});
   c.g.setAttribute('position',new T.Float32BufferAttribute(p.p,3));c.g.attributes.position.version=geometryRevision+1;c.g.setIndex(new T.BufferAttribute(p.i,1));c.g.computeVertexNormals();c.g.computeBoundingSphere();
   scene.remove(lining[k].mesh);lining[k].mesh.geometry.dispose();lining[k]=createLining(T,c,liningMaterials[0]);scene.add(lining[k].mesh);
  }
  const indices=[];upper.part.faceBoundaries.forEach((n,i)=>{if(n==='closure')indices.push(...upper.part.i.slice(i*3,i*3+3));});closureGeo.setAttribute('position',upper.g.attributes.position);closureGeo.setIndex(indices);closureGeo.computeVertexNormals();closureGeo.computeBoundingSphere();
 }
 function geometry(domain){const state={...params,wall:fluid.wall};
  for(const r of records){M.deformPositions(r.part.p,r.field.w,r.field.r,state,data.axis,data.centre,r.g.attributes.position.array,r.field.d);r.g.attributes.position.needsUpdate=true;r.g.computeVertexNormals();r.g.computeBoundingSphere();}
  if(domain)applyDomain(domain);
  for(const h of heads){const arr=h.g.attributes.position.array;for(let i=0;i<arr.length;i+=3){const p=h.part.p.slice(i,i+3);arr.set(h.part.name==='skull'?p:M.rigidPoint(p,params.angle,params.anterior,data.axis,data.centre,params.distraction),i);}h.g.attributes.position.needsUpdate=true;h.g.computeVertexNormals();h.g.computeBoundingSphere();}
  regional=regionalVolumes(upper.g.attributes.position.array,upper.part.i);geometryRevision++;
 }
 async function task(fn){if(!canInteract())return;if(busy){queued=fn;return;}busy=true;try{await fn();}catch(e){running=false;status(e.message,'blocked');}finally{busy=false;sync();const next=queued;queued=null;if(next)task(next);}}
 function rejected(result,prefix='Movement stopped'){blocked=result.contactHits?.[0]||result.hits?.[0]||null;lastCheck=result;status(`${prefix} · ${blocked?.surface||'model limit'}${result.body?' · proximal instrument envelope':''}. Steer away from contact or withdraw. Rotation only changes the viewing direction.`,'blocked');}
 // r59: the lens stays inside the joint space it is in. Steering that would carry the tip
 // through the soft lining slides the telescope along its own axis instead (a short
 // withdrawal or advance); when that is not enough, the movement stops at the wall. Bone and
 // disc contact is still decided by the collision worker, and withdrawal is never restricted.
 // This is an illustrative soft-tissue limit, not a force model.
 const wallRay=new T.Raycaster(),wallMeshes=cavities.map(c=>new T.Mesh(c.g,new T.MeshBasicMaterial({side:T.DoubleSide}))),WALL=.45,EDGE=.02,GAP=.25,SLIDE=2.5,RETURN=.3,BACK=14;let lastWall=null,wishDepth=null,movedDepth=null,entryHold=0;
 const spaceIndex=p=>{const c=map.classify(opticalPose(p).tip);return c==='Superior joint space'?0:c==='Inferior joint space'?1:-1;};
 const withinTravel=p=>({yaw:Math.max(-140,Math.min(-40,p.yaw)),pitch:Math.max(-40,Math.min(40,p.pitch)),depth:Math.max(0,Math.min(30,p.depth)),roll:wrapRoll(p.roll)});
 // Stretches of this shaft axis that lie inside compartment k, measured from the pivot.
 function axisSpans(p,k){
  const axis=V(opticalPose(p).axis);wallRay.set(V(PIVOT).addScaledVector(axis,-BACK),axis);wallRay.near=0;wallRay.far=BACK+40;
  const hits=wallRay.intersectObject(wallMeshes[k],false).filter((h,i,a)=>!i||h.distance-a[i-1].distance>1e-5),spans=[];
  // Third entry: the stretch ends at a crease of the lining thinner than GAP, with more of
  // the same space directly beyond it. A crease is not a far wall, but the lens may not rest in it.
  for(let i=0;i+1<hits.length;i+=2)spans.push([hits[i].distance-BACK,hits[i+1].distance-BACK,false]);
  for(let i=0;i+1<spans.length;i++)spans[i][2]=spans[i+1][0]-spans[i][1]<GAP;
  return spans;
 }
 // Deepest depth on this axis, never further in than asked, that keeps the lens inside
 // compartment k and clear of its far wall. The limit only ever withdraws the telescope:
 // pushing it deeper to stay inside could wedge the shaft against the disc.
 function fitDepth(p,k){
  const along=p.depth-DEPTH_OFFSET;let best=null;
  for(const[a,b,crease]of axisSpans(p,k)){if(along<a+EDGE)continue;const v=Math.min(b-(crease?EDGE:WALL),along);if(v<a+EDGE)continue;if(best===null||v>best)best=v;}
  return best===null?null:Math.max(0,Math.min(30,best+DEPTH_OFFSET));
 }
 // Shallowest depth on this axis that is still inside the stretch of joint space the lens is in.
 // After the jaw moves the space no longer starts at the capsule entry, so easing back uses this.
 function nearEdge(p){
  const k=spaceIndex(p);if(k<0)return 0;const along=p.depth-DEPTH_OFFSET;
  for(const[a,b]of axisSpans(p,k))if(along>=a-1e-6&&along<=b+1e-6)return Math.max(DEPTH_OFFSET+EDGE,a+EDGE+DEPTH_OFFSET);
  return DEPTH_OFFSET+EDGE;
 }
 // A jaw or fluid change reshapes the joint space around a still telescope. If that leaves the
 // lens just outside the space it was in, move it along its own axis to the nearest point inside.
 const SEAT=.15,NEAR=.9;
 function reseat(was){
  if(was<0||proc.scopeHidden||spaceIndex(pose)>=0)return;
  const along=pose.depth-DEPTH_OFFSET;let best=null;
  for(const[a,b,crease]of axisSpans(pose,was)){const lo=a+EDGE+SEAT,hi=b-(crease?EDGE:WALL);if(hi<lo)continue;const v=Math.max(lo,Math.min(hi,along));if(Math.abs(v-along)<=SLIDE&&(best===null||Math.abs(v-along)<Math.abs(best-along)))best=v;}
  if(best!==null)setTimeout(()=>move({depth:Math.max(0,Math.min(30,best+DEPTH_OFFSET))}),0);
 }
 // The joint wall may slide the telescope back while it is steered. wishDepth remembers the
 // depth the user last chose, and steering eases back toward it as room returns. It never
 // advances further than the user did.
 function keepInside(from,wanted,pause=false){
  const to=withinTravel(wanted),steering=to.yaw!==from.yaw||to.pitch!==from.pitch,explicit=to.depth!==from.depth;
  if(movedDepth!==from.depth)wishDepth=null;
  if(!steering&&to.depth<=from.depth){
   // Scrolling back pauses once at the capsule entry, so the lens does not fall out of the
   // joint by accident. A further scroll after the pause withdraws it. A gesture only.
   const entry=DEPTH_OFFSET+EDGE,now=performance.now();
   if(pause&&to.depth<entry&&from.depth>=entry&&spaceIndex(from)>=0&&(from.depth>entry+1e-3||now<entryHold)){
    if(from.depth>entry+1e-3)entryHold=now+450;
    return{pose:{...to,depth:Math.min(from.depth,entry)},explicit,adjusted:true,stopped:true,message:'Capsule entry · the lens is at the edge of the joint space. Scroll back again to take the telescope out of the joint.'};
   }
   return{pose:to,explicit};
  }
  const k=spaceIndex(from);
  if(k<0){
   // Outside the joint: steer freely, but advance only along an axis that enters the superior space.
   if(to.depth<=from.depth)return{pose:to,explicit};
   const spans=axisSpans(to,0).filter(([a,b,crease])=>!crease&&b-a>=WALL+EDGE),limit=(spans.length?spans[spans.length-1][1]-WALL:0)+DEPTH_OFFSET;
   if(to.depth<=limit)return{pose:to,explicit};
   return{pose:{...to,depth:Math.max(from.depth,Math.min(to.depth,limit))},explicit,stopped:true,message:spans.length?'Far wall of the joint space · the lens stays inside. Steer to look around, or withdraw.':'This direction misses the joint space · steer toward the joint, then advance.'};
  }
  const returning=steering&&!explicit&&wishDepth!==null&&wishDepth>from.depth+1e-6,aim=returning?{...to,depth:Math.min(wishDepth,from.depth+RETURN)}:to;
  let fitted=fitDepth(aim,k),followed=false;
  // The near wall of the space is not at one depth for every direction. When the next
  // direction starts a little deeper than the lens is, follow that wall by at most NEAR, so
  // a lens resting at the entry edge can still be steered back. The sweep still checks contact.
  // An advance that makes no headway against a thin fold of lining steps over it the same way.
  const balked=!steering&&to.depth>from.depth+1e-6&&(fitted===null||fitted<=from.depth+1e-6);
  if((fitted===null&&steering)||balked){const along=(balked?from.depth:aim.depth)-DEPTH_OFFSET;for(const[a,b,crease]of axisSpans(aim,k)){const lo=a+EDGE+SEAT;if(lo>along&&lo-along<=NEAR&&b-(crease?EDGE:WALL)>=lo){fitted=Math.min(30,lo+DEPTH_OFFSET);followed=true;break;}}}
  if(fitted!==null&&aim.depth-fitted<=SLIDE){
   const next={...aim,depth:fitted},adjusted=Math.abs(fitted-to.depth)>1e-6;
   if(!adjusted)return{pose:to,explicit};
   return{pose:next,explicit,adjusted,slid:steering&&fitted<from.depth-1e-6,stopped:!steering,message:followed?'Near wall of the joint space · the telescope follows it to stay inside.':'Joint wall ahead · the lens stays inside the joint space. Steer to look around, or withdraw.'};
  }
  let low=0,high=1,best={...from,roll:to.roll};
  for(let i=0;i<7;i++){const f=(low+high)/2,q={yaw:from.yaw+(to.yaw-from.yaw)*f,pitch:from.pitch+(to.pitch-from.pitch)*f,depth:from.depth+(to.depth-from.depth)*f,roll:to.roll},d=fitDepth(q,k);if(d!==null&&q.depth-d<=SLIDE){low=f;best={...q,depth:d};}else high=f;}
  return{pose:best,explicit,stopped:true,message:'Edge of the joint space · the telescope cannot turn further here. Steer back, or advance for more room.'};
 }
 // One checked movement. A pointer gesture is traced as a single swept segment to the pose the
 // queued input asks for. When bone or the disc stops the steering, the telescope is eased back
 // a little along its own axis and the steer is tried again, so it slides along the surface
 // instead of sticking. Easing only withdraws, and never past the capsule entry.
 const EASE=[.3,.8],steered=(a,b)=>Math.abs(b.yaw-a.yaw)+Math.abs(b.pitch-a.pitch);let lastEase=null,lastMove=null;
 // A sweep that is in contact from its first instant reports no admitted motion. For a
 // gesture that is a contact limit at the present pose, not a failed movement.
 const sweep=async(target,cost)=>{const began=performance.now(),x=await check('move',{pose:target,limit:true});cost.calls++;cost.ms+=performance.now()-began;cost.samples+=x.samples||0;return !x.accepted&&x.limited&&x.contactRetreat?{...x,accepted:true,hits:[]}:x;};
 function move(next,gesture=null){if(proc.scopeHidden){gestures.cancel();return;}task(async()=>{
  if(gesture&&!gesture.pending)return;
  status('Checking complete instrument and movement…','pending');
  const from={...pose},wanted=typeof next==='function'?next(pose):{...pose,...next},wall=keepInside(pose,wanted,!!gesture),held=!!(wall.adjusted||wall.stopped),target=held?wall.pose:wanted;
  lastWall=held?{slid:!!wall.slid,stopped:!!wall.stopped}:null;
  const cost={calls:0,ms:0,samples:0};let r=await sweep(target,cost),eased=null;
  if(r.accepted&&r.limited&&gesture){
   const contact=r.contactHits,keep=x=>({...x,limited:true,contactHits:x.limited&&x.contactHits?.length?x.contactHits:contact});
   // A steering contact never swallows the roll or a withdrawal asked for in the same gesture.
   if(target.roll!==r.pose.roll||target.depth<r.pose.depth-1e-6){const free=await sweep({...r.pose,roll:target.roll,depth:Math.min(r.pose.depth,target.depth)},cost);if(free.accepted)r=keep(free);}
   const asked=steered(from,target);
   if(asked>.05&&target.depth<=from.depth+1e-6&&steered(from,r.pose)<.5*asked){
    const floor=nearEdge(r.pose),before=steered(from,r.pose),began=r.pose.depth;
    for(const back of EASE){
     const depth=Math.max(floor,r.pose.depth-back);if(depth>r.pose.depth-.02)break;
     const out=await sweep({...r.pose,depth},cost);if(!out.accepted||out.pose.depth>r.pose.depth-.02)break;
     r=keep(out);
     const again=keepInside(r.pose,{...target,depth:r.pose.depth}),turned=await sweep(again.pose,cost);if(!turned.accepted)break;
     r=turned.limited?keep(turned):turned;
     if(steered(from,r.pose)>before+.02){eased={surface:contact?.[0]?.surface||'joint boundary',withdrawn:+(began-r.pose.depth).toFixed(3)};break;}
    }
    lastEase=eased||{surface:contact?.[0]?.surface||'joint boundary',withdrawn:+(began-r.pose.depth).toFixed(3),freed:false};
   }
  }
  lastCheck=r;lastMove={calls:cost.calls,ms:+cost.ms.toFixed(1),samples:cost.samples};
  if(r.accepted){
   if(gesture){pose={...r.pose};travel=null;}else await followCheckedPose(r.pose,r.method==='unchanged admitted axisymmetric envelope');
   if(r.limited||eased||wall.explicit||!(wishDepth>r.pose.depth+1e-6))wishDepth=r.pose.depth;movedDepth=r.pose.depth;
   if(eased&&!r.limited){blocked=null;status('Sliding along the '+eased.surface+' · the telescope eases back to keep turning');}
   else if(r.limited){blocked=r.contactHits?.[0]||null;const surface=blocked?.surface||'joint boundary';status(steered(from,target)>.05?'Contact · '+surface+' · the telescope cannot turn this way here. Scroll back to withdraw, or steer another way.':'Contact · '+surface+' ahead · the telescope cannot advance here. Steer toward open space, or withdraw.','blocked');}
   else if(wall.stopped){blocked=null;status(wall.message,'wall');}
   else if(wall.slid){blocked=null;status('Sliding along the joint wall · the lens stays inside the joint space');}
   else{blocked=null;status('Live lens moving · shaft and locator synchronized');}
  }else rejected(r);
  if(gesture&&gesture.pending&&!queued)requestAnimationFrame(()=>move(p=>gesture.take(p),gesture));
 });}
 const compactResult=r=>({...r,cavities:undefined});
 // State and checked movement for automated checks. Every request still passes the worker.
 window.tmjStudio=Object.freeze({capture:()=>capture(),pose:()=>({...pose}),moveTo:next=>move(next),busy:()=>busy||!!travel,wallProbe:p=>({space:spaceIndex(p),spans:[0,1].map(k=>axisSpans(p,k).map(s=>s.map(v=>+(v+DEPTH_OFFSET).toFixed(2))))})});
 async function changeGeometry(next,flowStep=false){
  const r=await check('geometry',{geometry:{...next,wall:fluid.wall},fluid});lastCheck=compactResult(r);
  if(r.accepted){params=next;fluid=r.fluid;if(r.cavities){const was=spaceIndex(pose);startDissolve();geometry(r.cavities);reseat(was);}blocked=null;status(r.domainLimit?'Flow continues at the last admitted cavity shape · model distension limit':'Joint updated · source contact, complete instrument and actual cavity volume checked');return true;}
  blocked=r.hits?.[0]||null;status('Tissue movement stopped · '+(blocked?.surface?.split(':')[0]||'model boundary')+'. Reduce the request or reset the joint.','blocked');running=false;return false;
 }
 // Jaw movement. The map shows the requested rigid movement at once; the joint itself
 // changes only through contact-checked rebuilds — one per translation, one per degree
 // of rotation. The lens image dissolves to each checked state.
 const jawKeys=['angle','anterior','distraction'],sameJaw=(a,b)=>jawKeys.every(k=>Math.abs(a[k]-b[k])<1e-9);
 const smooth=u=>u*u*u*(u*(u*6-15)+10),still=()=>document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const tween=(object,key,to,ms,ease=smooth)=>new Promise(resolve=>{const from=object[key],began=performance.now();if(still()){object[key]=to;resolve();return;}(function tick(){const u=Math.min(1,(performance.now()-began)/ms);object[key]=from+(to-from)*ease(u);if(u<1&&alive)requestAnimationFrame(tick);else resolve();})();});
 let jawVisual=null,jawMotion=null,dissolveStart=-Infinity;
 const rigidMatrix=state=>{const c=data.centre;return new T.Matrix4().makeTranslation(c[0],c[1]+state.anterior,c[2]-state.distraction).multiply(new T.Matrix4().makeRotationAxis(V(data.axis).normalize(),state.angle*Math.PI/180)).multiply(new T.Matrix4().makeTranslation(-c[0],-c[1],-c[2]));};
 function showJaw(to,duration){return new Promise(resolve=>{jawMotion?.resolve();if(still()){jawMotion=null;jawVisual={...to};resolve();return;}jawMotion={from:{...(jawVisual||params)},to:{...to},start:performance.now(),duration,resolve};});}
 function startDissolve(){if(scopeRenders){fx.keepPrevious();dissolveStart=performance.now();sceneKey='';}}
 // Adopt one checked geometry. Volume that the movement adds or removes is booked as
 // exchange through the open portal, so the fluid balance stays exact.
 function adopt(next,r,wall=fluid.wall){
  const before=fluid.volume;params=next;if(wall!==fluid.wall)fluid={...fluid,wall,pressure:params.wallStiffness*wall};
  if(r.cavities){const was=spaceIndex(pose);startDissolve();geometry(r.cavities);reseat(was);const volume=r.cavities[0].volume,change=volume-before;fluid={...fluid,volume,netIn:fluid.netIn+change,grossIn:fluid.grossIn+Math.max(0,change),grossOut:fluid.grossOut+Math.max(0,-change),tracerMass:Math.min(fluid.tracerMass,volume)};}
  blocked=null;
 }
 async function commitJaw(next){
  const from={...params},steps=Math.max(1,Math.ceil(Math.abs(next.angle-from.angle)-1e-9));
  for(let i=1;i<=steps;i++){
   const state={...next};for(const k of jawKeys)state[k]=i===steps?next[k]:from[k]+(next[k]-from[k])*i/steps;
   const r=await check('geometry',{geometry:{...state,wall:fluid.wall}});lastCheck=compactResult(r);
   if(!r.accepted){blocked=r.hits?.[0]||null;return false;}
   adopt(state,r);sync();
  }
  return true;
 }
 async function jawTo(target,{duration=1300,label='Mandible moving'}={}){
  const next={...params,...target};M.validateParameters(next);if(sameJaw(next,params))return true;
  status(label+' · checking contact and rebuilding the joint space…','pending');
  const shown=showJaw(next,duration),accepted=await commitJaw(next);
  if(accepted){await shown;jawVisual=null;status('Joint updated · source contact, complete instrument and rebuilt cavity checked');return true;}
  await showJaw(params,420);jawVisual=null;running=false;
  status('Tissue movement stopped · '+(blocked?.surface?.split(':')[0]||'model boundary')+'. Reduce the request or reset the joint.','blocked');return false;
 }
 function jawChange(key,value){task(()=>jawTo({[key]:value},{duration:Math.min(1400,320+Math.abs(value-params[key])*(key==='angle'?170:520))}));}
 // Insufflation: one checked rebuild of the superior space at a larger lining displacement.
 async function distend(walls){
  for(const wall of walls){
   const r=await check('geometry',{geometry:{...params,wall}});lastCheck=compactResult(r);
   if(r.accepted){adopt({...params},r,wall);sync();return wall;}
  }
  return null;
 }
 $('#jaw').oninput=e=>jawChange('angle',Number(e.target.value));$('#slide').oninput=e=>jawChange('anterior',Number(e.target.value));$('#distraction').oninput=e=>jawChange('distraction',Number(e.target.value));
 $('#pressure').oninput=e=>{const v=Number(e.target.value);task(async()=>{const next={...params,sourcePressure:v};M.validateParameters(next);params=next;running=v>0;lastFluid=performance.now();status(v>0?'Irrigation running · pressure, volume and tissue contact coupled':'Source pressure set to zero');});};$('#outlet').onchange=e=>{const open=e.target.checked;task(async()=>{params={...params,outletOpen:open};status(open?'Outlet connected':'Outlet closed');});};
 for(const k of ['depth','yaw','pitch','roll'])$('#'+k).oninput=e=>move({[k]:Number(e.target.value)});
 $('#advance').onclick=()=>move(p=>({...p,depth:Math.min(30,p.depth+increment())}));$('#withdraw').onclick=()=>move(p=>({...p,depth:Math.max(0,p.depth-increment())}));$('#park').onclick=()=>move({depth:0});
 $('#flow').onclick=()=>{if(!canInteract())return;running=!running;lastFluid=performance.now();sync();};
 function turn(dx,dy){move(p=>steerPose(p,dx,dy,$('#image-orientation').value,Number($('#camera-roll').value)));}
 for(const [id,x,y] of [['steer-left',-1,0],['steer-right',1,0],['steer-up',0,1],['steer-down',0,-1]])$('#'+id).onclick=()=>turn(x*(increment()===.1?.25:1),y*(increment()===.1?.25:1));
 $('#optical-mode').onchange=()=>{atlasAngles={yaw:0,pitch:0};sync();};
 const sc=$('#scope');
 const gestureText={aim:'Move handle: drag opposite the desired view · Two fingers: steer + pinch + twist',advance:'One finger: up inserts / down withdraws · Two fingers combine all movements',roll:'One finger: left / right rotates lens · Two fingers combine all movements',combined:'Two fingers: move together to steer · Spread to insert · Pinch to withdraw · Twist to rotate'};
 const gestureOptions=()=>({mode:$('#scope-drag').value,fine:increment()===.1,grip:$('#hand-grip').value,orientation:$('#image-orientation').value,cameraRoll:Number($('#camera-roll').value),width:sc.clientWidth,speed:Number($('#scope-speed').value)});
 const gestures=bindInstrumentGestures(sc,{enabled:()=>canInteract()&&!proc.scopeHidden,options:gestureOptions,submit:input=>move(p=>input.take(p),input),describe:mode=>{$('#gesture-hint').textContent=mode==='aim'&&$('#hand-grip').value==='view'?'Direct view: drag toward the desired view · Two fingers: steer + pinch + twist':gestureText[mode];sc.dataset.gesture=mode;}});
 function cancelGesture(){gestures.cancel();}
 function selectDragMode(mode){cancelGesture();$('#scope-drag').value=mode;for(const key of ['aim','advance','roll'])$('#mode-'+key).setAttribute('aria-pressed',String(mode===key));$('#gesture-hint').textContent=mode==='aim'&&$('#hand-grip').value==='view'?'Direct view: drag toward the desired view · Two fingers: steer + pinch + twist':gestureText[mode];sc.dataset.gesture=mode;}
 for(const mode of ['aim','advance','roll'])$('#mode-'+mode).onclick=()=>selectDragMode(mode);
 $('#scope-drag').onchange=e=>selectDragMode(e.target.value);selectDragMode('aim');
 $('#camera-roll').oninput=e=>{$('#camera-roll-out').textContent=e.target.value+'°';scopeKey='';};
 for(const id of ['hand-grip','image-orientation','step'])$('#'+id).addEventListener('change',()=>{cancelGesture();selectDragMode($('#scope-drag').value);});
 window.addEventListener('blur',cancelGesture);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
 sc.onkeydown=e=>{if(!canInteract())return;if($('#optical-mode').value!=='instrument')return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(d){e.preventDefault();turn(...d.map(x=>x*(increment()===.1?.25:1)));}if(['[',']'].includes(e.key)){e.preventDefault();move(p=>({...p,roll:wrapRoll(p.roll+(e.key==='['?-5:5))}));}if(['+','=','-'].includes(e.key)){e.preventDefault();move(p=>({...p,depth:Math.max(0,Math.min(30,p.depth+(e.key==='-'?-increment():increment())))}));}};
 // r59 map: drag orbits the joint, the wheel zooms toward the pointer, right / middle /
 // Shift-drag pans and Ctrl-drag turns the telescope about its own axis. Two fingers pinch
 // and pan. The view eases toward its goal on every frame.
 const mc=$('#map'),HOME={az:-42,el:18,zoom:1,panX:0,panY:0},VIEWS={lateral:[-42,18],posterior:[-90,12],superior:[-42,84]};let goal={...HOME};
 const mapPoints=new Map();let mapMode='orbit',pinch=null,spin=0;
 const mapScale=()=>(locator?.span||46*orbit.zoom)/Math.max(1,mc.clientHeight);
 const bound=()=>{goal.el=Math.max(-70,Math.min(85,goal.el));goal.zoom=Math.max(.28,Math.min(2.4,goal.zoom));goal.panX=Math.max(-32,Math.min(32,goal.panX));goal.panY=Math.max(-32,Math.min(32,goal.panY));};
 function zoomAt(factor,x,y){const before=goal.zoom;goal.zoom=Math.max(.28,Math.min(2.4,before*factor));const r=mc.getBoundingClientRect(),k=($('#separate').checked?66:46)*(before-goal.zoom)/Math.max(1,r.height);goal.panX+=(x-r.left-r.width/2)*k;goal.panY-=(y-r.top-r.height/2)*k;bound();}
 function setView(name){const v=VIEWS[name]||VIEWS.lateral;goal={az:v[0],el:v[1],zoom:1,panX:0,panY:0};$('#view').value=VIEWS[name]?name:'lateral';for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===$('#view').value));}
 mc.oncontextmenu=e=>e.preventDefault();
 mc.onpointerdown=e=>{if(!canInteract())return;e.preventDefault();mc.focus({preventScroll:true});mc.setPointerCapture(e.pointerId);mapPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(mapPoints.size===1)mapMode=e.pointerType!=='touch'&&e.ctrlKey?'spin':e.button===2||e.button===1||e.shiftKey||$('#map-drag').value==='pan'?'pan':'orbit';pinch=null;mc.dataset.drag=mapMode;};
 mc.onpointermove=e=>{const p=mapPoints.get(e.pointerId);if(!p||!canInteract())return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(mapPoints.size>=2){const[a,b]=[...mapPoints.values()],d=Math.hypot(b.x-a.x,b.y-a.y),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;if(pinch){if(d>24&&pinch.d>24)zoomAt(pinch.d/d,cx,cy);const k=mapScale();goal.panX-=(cx-pinch.x)*k;goal.panY+=(cy-pinch.y)*k;bound();}pinch={d,x:cx,y:cy};return;}
  if(mapMode==='spin'){spin+=dx*.35;if(Math.abs(spin)>.2)move(q=>{const turn=spin;spin=0;return{...q,roll:wrapRoll(q.roll+turn)};});}
  else if(mapMode==='pan'){const k=mapScale();goal.panX-=dx*k;goal.panY+=dy*k;}
  else{goal.az-=dx*.4;goal.el+=dy*.4;for(const b of document.querySelectorAll('[data-view][aria-pressed=true]'))b.setAttribute('aria-pressed','false');}
  bound();};
 for(const ev of['pointerup','pointercancel','lostpointercapture'])mc.addEventListener(ev,e=>{mapPoints.delete(e.pointerId);pinch=null;if(!mapPoints.size)delete mc.dataset.drag;});
 mc.addEventListener('wheel',e=>{if(!canInteract())return;e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?mc.clientHeight:1);zoomAt(Math.exp(Math.max(-240,Math.min(240,pixels))*.0016),e.clientX,e.clientY);},{passive:false});
 mc.ondblclick=()=>{if(canInteract())setView('lateral');};
 mc.onkeydown=e=>{if(!canInteract())return;const d={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,10],ArrowDown:[0,-10]}[e.key];if(d){e.preventDefault();goal.az+=d[0];goal.el+=d[1];bound();}if(['+','=','-'].includes(e.key)){e.preventDefault();const r=mc.getBoundingClientRect();zoomAt(e.key==='-'?1.2:1/1.2,r.left+r.width/2,r.top+r.height/2);}if(e.key==='0'){e.preventDefault();setView('lateral');}};
 $('#centre').onclick=()=>setView('lateral');$('#view').onchange=e=>setView(e.target.value);
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{if(canInteract())setView(b.dataset.view);};
 $('#locator-mode').onchange=()=>{const sliced=$('#locator-mode').value==='section';$('#section').hidden=!sliced;$('.map-wrap').classList.toggle('sliced',sliced);$('#map-caption').textContent=sliced?'Section through the actual lens. Solid contours intersect this plane; the dashed shaft and view ray are projections. The physical joint and lens stay assembled.':'The frame stays centred on the joint. Cutaway and layer separation change this teaching view only.';sync();};
 $('#separate').onchange=()=>{$('#map-caption').textContent=$('#separate').checked?'Teaching separation enlarges the spaces. The real lens and all collision geometry stay in assembled coordinates.':'Assembled anatomy. The roof cutaway reveals the disc while the instrument remains at its physical pose.';};
 $('#teaching').onchange=()=>sync();
 $('#texture').onchange=e=>[...records.map(r=>r.mesh.material),...liningMaterials].forEach(m=>m.userData.textureUniform.value=e.target.checked?1:0);
 async function resetSession(prepared=true){selectDragMode('aim');running=false;endProcedure();const p={...M.DEFAULTS,distraction:prepared?PREPARATION:0};
 const r=await check('init',{geometry:{...p,wall:0},pose:START});if(!r.accepted){fatal(Error('Joint preparation failed clearance'),'The prepared joint could not be checked. Please retry.');return;}pose={...START};params=p;fluid=M.initialFluid([r.cavities[0].volume,0,0,0]);geometry(r.cavities);blocked=null;lastCheck=compactResult(r);
 if(prepared){const insertion=await check('move',{pose:PREPARED});lastCheck=insertion;if(!insertion.accepted){rejected(insertion,'Automatic entry stopped');sync();return;}pose=insertion.pose;}
 $('#optical-mode').value='instrument';$('#load').textContent='Synchronized lens & shaft · bone / disc boundaries active';status(prepared?'Prepared joint · complete insertion path checked · live lens':'Neutral source joint · telescope fully withdrawn');}
 $('#reset').onclick=()=>{cancelGesture();task(()=>resetSession(true));};$('#neutral').onclick=()=>{cancelGesture();task(()=>resetSession(false));};$('#reinsert').onclick=()=>task(async()=>{if(params.distraction!==PREPARATION||params.angle!==0||params.anterior!==0){status('Use Reset prepared joint to restore the audited route.','blocked');return;}const withdraw=await check('move',{pose:{...pose,depth:0}});if(!withdraw.accepted){rejected(withdraw);return;}await followCheckedPose(withdraw.pose);const align=await check('move',{pose:START});if(!align.accepted){rejected(align);return;}await followCheckedPose(align.pose);const inserted=await check('move',{pose:PREPARED});if(!inserted.accepted){rejected(inserted);return;}lastCheck=inserted;await followCheckedPose(inserted.pose);blocked=null;$('#load').textContent='Synchronized lens & shaft · bone / disc boundaries active';status('Inserted along the checked lateral capsule route');});

 // ---- Guided procedure -------------------------------------------------------------------
 function endProcedure(){
  Object.assign(visual,createFluidState());particles.clear();
  Object.assign(tools.inject,{visible:false,advance:0,plunger:0});Object.assign(tools.outflow,{visible:false,advance:0,syringe:false,fill:0,flow:false});tools.inflow.visible=false;
  Object.assign(proc,{step:-1,done:-1,scopeHidden:false,awaitBleed:false,readyAt:0,fill:0});
  jawMotion?.resolve();jawMotion=null;jawVisual=null;spaceScale.value=1;
 }
 // About 5 mm anterior to the portal, aimed into the superior space. Sites are tried in
 // order until the tip lies inside the rebuilt space.
 function planOutflow(){
  const mesh=lining[0].mesh,solids=records.filter(r=>['temporal','condyle','disc'].includes(r.part.name)).map(r=>r.mesh),entry=locator?.entry?V(locator.entry):V(PIVOT),axis=V(approach);
  // The hub lies lateral, anterior and inferior, below the lateral rim of the fossa, so the
  // needle converges on the cannula as a second puncture does. A route that crosses bone
  // or disc is skipped.
  try{
   for(const[forward,down,depth]of[[8,-1.2,4],[7,-1,4],[6,-1,4],[5,-.8,4],[4,-.4,3.5],[3,0,3],[4.5,1,3.5],[2.5,.5,2.5]])for(const[lateral,anterior,superior]of[[13,6,-4],[13,6,-6],[13,4,-4],[13,3,-4],[13,3,-6],[13,2,-3],[13,0,-2],[13,0,-4]]){
    const target=entry.clone().addScaledVector(axis,depth).add(V([0,forward,down])),origin=target.clone().add(V([lateral,anterior,superior])),direction=target.clone().sub(origin).normalize();
    ray.set(origin,direction);ray.near=0;ray.far=40;const first=ray.intersectObject(mesh)[0];
    if(!first)continue;
    for(const inset of[2.4,1.6,1]){
     const solid=ray.intersectObjects(solids)[0];if(solid&&solid.distance<first.distance+inset+.3)break;
     const tip=first.point.clone().addScaledVector(direction,inset).toArray();if(map.classify(tip)==='Superior joint space')return{tip,axis:direction.toArray()};
    }
   }
  }finally{ray.far=Infinity;}
  return null;
 }
 async function placeOutflow(){
  if(tools.outflow.visible)return true;
  const plan=planOutflow();if(!plan){status('No clear site for the outflow needle in this joint position. Reset the prepared joint and try again.','blocked');return false;}
  Object.assign(tools.outflow,plan,{visible:true,advance:0,syringe:false,fill:0});
  status('Outflow needle entering the superior space anterior to the cannula…','pending');
  await tween(tools.outflow,'advance',1,1200);
  visual.bleed=Math.max(visual.bleed,.22); // a second puncture oozes briefly
  return true;
 }
 const stepRunners={
  async position(){
   if(!await jawTo({distraction:PREPARATION},{duration:1500,label:'Distracting the condyle'}))return false;
   const forward=await jawTo({anterior:PROTRUSION},{duration:1300,label:'Protruding the mandible'});
   status(forward?`Mandible protruded · ${fmt(PREPARATION,1)} mm distraction and ${fmt(PROTRUSION,1)} mm anterior translation · posterior recess open`:`Mandible distracted ${fmt(PREPARATION,1)} mm · anterior translation stopped at tissue contact`);
   return true;
  },
  async insufflate(){
   const before=fluid.volume;Object.assign(tools.inject,{visible:true,advance:0,plunger:0});
   status('Insufflation needle entering the posterior recess…','pending');
   await tween(tools.inject,'advance',1,1100);
   status('Injecting Ringer’s solution · the capsule distends…','pending');
   const early=Promise.all([tween(tools.inject,'plunger',.3,1200,u=>u),tween(proc,'fill',.3,1200,u=>u)]),wall=fluid.wall>.1?fluid.wall:await distend([.45,.35,.25,.15]);await early;
   // Grow the rebuilt space from its previous volume while the rest of the syringe empties.
   spaceScale.value=Math.cbrt(before/fluid.volume);
   await Promise.all([tween(tools.inject,'plunger',1,1700,u=>u),tween(proc,'fill',1,1700,u=>u),tween(spaceScale,'value',1,1700)]);
   await tween(tools.inject,'plunger',.86,360);await pause(260);await tween(tools.inject,'plunger',1,300);
   await tween(tools.inject,'advance',0,800);tools.inject.visible=false;
   visual.bubbles=Math.max(visual.bubbles,.3);
   if(wall===null){status('The model could not distend this joint position further. Continue with the puncture.','blocked');return true;}
   status(`Joint insufflated · superior space ${fmt(before*1000,0)} → ${fmt(fluid.volume*1000,0)} µL (model volume) · plunger rebound confirms the joint`);
   return true;
  },
  async insert(){
   proc.scopeHidden=false;sync();
   status('Trocar and cannula puncturing the capsule · arthroscope advancing…','pending');
   const r=await check('move',{pose:PREPARED});lastCheck=r;if(!r.accepted){rejected(r,'Insertion stopped');return false;}
   proc.awaitBleed=true;await followCheckedPose(r.pose,false,2800);blocked=null;
   // The capsule moves with the mandible: advance in checked steps until the lens is inside.
   for(let i=0;i<8&&map.classify(opticalPose(pose).tip)!=='Superior joint space';i++){const deeper=await check('move',{pose:{...pose,depth:Math.min(30,pose.depth+.5)},limit:true});lastCheck=deeper;if(!deeper.accepted||deeper.limited)break;await followCheckedPose(deeper.pose,false,220);}
   proc.readyAt=performance.now()+4500;
   status('Arthroscope in the superior joint space · bleeding from the puncture clouds the image');
   return true;
  },
  async lavage(){
   if(!await placeOutflow())return false;
   tools.inflow.visible=true;visual.inflow=true;visual.outflow=true;visual.bubbles=Math.max(visual.bubbles,.45);
   status('Outflow needle placed · irrigation running · blood leaves through the needle and the image clears');
   return true;
  },
  async suction(){
   if(!await placeOutflow())return false;
   tools.inflow.visible=true;visual.inflow=true;tools.outflow.syringe=true;tools.outflow.fill=0;visual.suction=true;sync();
   status('Suction on the outflow needle · aspirating blood, debris and bubbles','pending');
   // Aspirate until the view is clear, within a readable time.
   const began=performance.now();await pause(3200);
   while(alive&&performance.now()-began<11000&&(clarity(visual)<96||visual.debris>.03))await pause(150);
   visual.suction=false;await pause(400);tools.outflow.syringe=false;tools.outflow.fill=0;
   status(`Aspiration complete · view clarity ${clarity(visual)}% · lavage continues through the needle`);
   return true;
  },
  async explore(){
   visual.inflow=false;visual.outflow=false;visual.suction=false;
   status('Withdrawing the arthroscope…','pending');
   const r=await check('move',{pose:{...pose,depth:0}});lastCheck=r;if(!r.accepted){rejected(r,'Withdrawal stopped');return false;}
   await followCheckedPose(r.pose,false,2200);
   if(tools.outflow.visible){await tween(tools.outflow,'advance',0,700);tools.outflow.visible=false;}
   tools.inflow.visible=false;proc.scopeHidden=true;
   status('Procedure complete · arthroscope and outflow needle withdrawn');
   return true;
  }
 };
 function startProcedure(){cancelGesture();task(async()=>{proc.working=true;sync();try{await resetSession(false);if(document.body.dataset.state!=='ready')return;proc.scopeHidden=true;proc.step=0;status('Neutral joint · arthroscope not yet inserted. Step 1: protrude the mandible.');}finally{proc.working=false;}});}
 function runStep(){const index=proc.step;cancelGesture();task(async()=>{proc.working=true;sync();try{if(await stepRunners[STEPS[index].id]()){proc.done=index;proc.step=index+1;}}finally{proc.working=false;}});}
 $('#procedure-action').onclick=()=>{if(!canInteract()||busy)return;if(proc.step<0||proc.step>=STEPS.length)startProcedure();else runStep();};
 $('#procedure-restart').onclick=()=>{if(canInteract()&&!busy)startProcedure();};
 $('#fx-bleed').onclick=()=>{if(!canInteract()||proc.scopeHidden)return;visual.bleed=1;visual.debris=Math.max(visual.debris,.3);status(describeFluid(visual));sync();};
 $('#fx-irrigation').onchange=e=>{if(!canInteract())return;visual.inflow=e.target.checked;if(visual.inflow){tools.inflow.visible=true;visual.bubbles=Math.max(visual.bubbles,.3);}status(describeFluid(visual));sync();};
 $('#fx-outflow').onchange=e=>{const open=e.target.checked;task(async()=>{if(open){if(await placeOutflow())visual.outflow=true;}else{visual.outflow=false;visual.suction=false;tools.outflow.syringe=false;if(tools.outflow.visible){await tween(tools.outflow,'advance',0,700);tools.outflow.visible=false;}}status(describeFluid(visual));});};
 $('#fx-suction').onclick=()=>{if(!canInteract()||proc.scopeHidden)return;task(async()=>{if(visual.suction){visual.suction=false;tools.outflow.syringe=false;}else if(await placeOutflow()){tools.outflow.syringe=true;tools.outflow.fill=0;visual.outflow=true;visual.suction=true;}status(describeFluid(visual));});};
 function syncProcedure(){
  const list=$('#procedure-steps');if(!list.children.length)for(const step of STEPS){const item=document.createElement('li');item.textContent=step.short;list.append(item);}
  [...list.children].forEach((item,i)=>{item.dataset.state=proc.step<0?'':i<proc.step?'done':i===proc.step?'current':'';if(i===proc.step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
  const current=STEPS[proc.step],finished=proc.step>=STEPS.length,waiting=!!current&&performance.now()<proc.readyAt,ready=canInteract()&&!busy&&!proc.working;
  $('#procedure-title').textContent=proc.step<0?'Free navigation':finished?'Procedure complete':current.title;
  $('#procedure-note').textContent=proc.step<0?'The arthroscope is in the prepared superior joint space. Start the guided procedure to perform every step in order, from mandibular protrusion to suction.':finished?'The arthroscope and the outflow needle are withdrawn. Run the procedure again, or reset the prepared joint for free navigation.':current.text;
  $('#procedure-model').textContent=current?current.model:'Teaching sequence. Timing, bleeding and clearance are illustrative, not clinical measurements.';
  const action=$('#procedure-action');action.textContent=proc.step<0?'Start guided procedure':finished?'Run the procedure again':waiting?'Blood is filling the view…':current.action;action.disabled=!ready||waiting;
  $('#procedure-restart').hidden=proc.step<0||finished;$('#procedure-restart').disabled=!ready;
  const inJoint=canInteract()&&!proc.scopeHidden;$('#fx-bleed').disabled=$('#fx-irrigation').disabled=!inJoint;$('#fx-outflow').disabled=$('#fx-suction').disabled=!inJoint||busy;
  $('#fx-irrigation').checked=visual.inflow;$('#fx-outflow').checked=visual.outflow;$('#fx-suction').setAttribute('aria-pressed',String(visual.suction));
  $('#lens-standby').hidden=!proc.scopeHidden;
 }
 // Direction letters on the rim of the lens image: where anterior, superior and lateral
 // lie in the picture. A teaching aid, not part of a clinical display.
 const rim=$('#lens-rim'),rimLabels=Object.fromEntries([...rim.children].map(e=>[e.dataset.axis,e])),rimAxes={ant:[0,1,0],post:[0,-1,0],sup:[0,0,1],inf:[0,0,-1],lat:[1,0,0],med:[-1,0,0]};let rimKey='';
 function updateRim(right,upward){
  const shown=$('#lens-rim-toggle').checked&&!proc.scopeHidden&&lens.occlusion<.5;if(rim.hidden===shown)rim.hidden=!shown;if(!shown)return;
  const radius=sc.clientWidth*.445,key=[radius,...right.toArray(),...upward.toArray()].map(v=>v.toFixed(3)).join();if(key===rimKey)return;rimKey=key;
  for(const[name,direction]of Object.entries(rimAxes)){const d=V(direction),x=d.dot(right),y=d.dot(upward),m=Math.hypot(x,y)||1,e=rimLabels[name];
   e.style.opacity=String(Math.max(0,Math.min(1,(m-.3)/.3)));e.style.transform=`translate(-50%,-50%) translate(${(x/m*radius).toFixed(1)}px,${(-y/m*radius).toFixed(1)}px)`;}
 }
 $('#lens-rim-toggle').onchange=()=>{rimKey='';};
 function capture(){return{schema:'tmj-studio-r60',contactEase:{steps:EASE,last:lastEase,lastMoveCost:lastMove,method:'when bone or disc stops a steering gesture the telescope is withdrawn a little along its own axis and the steer is retried; only withdraws, never past the capsule entry',forceModel:false,clinicallyValidated:false},jointWallLimit:{clearance:WALL,maximumSlide:SLIDE,last:lastWall,nearWallFollow:NEAR,method:'lens kept inside its joint space along the shaft axis; the limit withdraws, and advances only by nearWallFollow per move to follow the near wall of the space or to re-seat the lens after the joint changes shape; withdrawal unrestricted',forceModel:false,clinicallyValidated:false},mapView:{...goal},procedure:{step:proc.step,stepId:STEPS[proc.step]?.id||null,done:proc.done,working:proc.working,scopeHidden:proc.scopeHidden,sequence:STEPS.map(step=>step.id),clinicallyValidated:false},visualFluid:{...visual,clarity:clarity(visual),exchangePerSecond:exchangeRate(visual),description:describeFluid(visual),sprites,model:'well-mixed blood level with drifting sprites; illustrative rates'},instruments:{inject:{...tools.inject},outflow:{...tools.outflow},inflow:{...tools.inflow},overlaysCollisionChecked:false},jawPreview:jawVisual?{...jawVisual}:null,lensDisplay:{...lens,hdr:fx.hdr,pass:'linear buffer; barrel distortion, near-field defocus, glare, blood absorption by view distance, field stop, ACES tone map',calibrated:false},interaction:{revision:'r54-ordered-coupled-patient-frame',mouse:'lens — left:steer; right/Ctrl/Alt:roll; middle/Shift:depth; wheel:eased depth · map — left:orbit; wheel:zoom at pointer; right/middle/Shift:pan; Ctrl:roll telescope; double-click:reset',touch:'one:selected mode; two:centroid steer, spread/pinch depth, twist roll',grip:$('#hand-grip').value,imageOrientation:$('#image-orientation').value,cameraHeadRoll:Number($('#camera-roll').value),activePointers:gestures.active,pending:gestures.pending,inputQueue:gestures.diagnostics,handleModel:'patient-fixed external hand frame; midpoint coupled input; fixed model portal; unmeasured grip lever',pointerGainCalibrated:false,contactReversal:'relative to last admitted pose',calibratedHandTracking:false},pose:{...pose},pivot:PIVOT,approachReference:APPROACH_REFERENCE,depthOffset:DEPTH_OFFSET,parameters:{...params},fluid:{...fluid},cavityReconstruction:currentDomain?.map(p=>({name:p.name,volume:p.volume,enclosureVolume:p.enclosureVolume,removedVolume:p.removedVolume,connectedComponents:p.connectedComponents,excludedComponents:p.excludedComponents,excludedVolume:p.excludedVolume,vertices:p.p.length/3,triangles:p.i.length/3,method:p.method})),optical:opticalPose(pose),cameraBasis:imageBasis(pose,$('#image-orientation').value,Number($('#camera-roll').value)),sourceHashes:{anatomy:data.sourceHash,cavity:data.cavityHash,reconstructionBase:reconstructionHash,reconstruction:reconstructionRepairHash,attachment:attachmentHash,posteriorEnvelope:envelopeHash,booleanOperands:'7e83f43cda4927ef6d8647178c3d5ff90f3003421f3aa57eb0481c94c25189b8'},tool:TOOL,collisionSurfaces:[...sourceParts.map(p=>p.name),'dense skull','dense mandible'],preparation:{initialDepth:PREPARED.depth,distraction:PREPARATION,mode:'prescribed disc-condyle co-translation',pathChecked:true},denseSource:access.parts.map(p=>({name:p.name,sha256:p.sha256})),geometryRevision,locatorMode:$('#locator-mode').value,section:$('#locator-mode').value==='section'?sectionEvidence:null,washout,renderStats:{scopeRenders,raycasts,locatorRenders:locator?.frameNumber||0},performance:{startupMS,scopeRenderMS},regionalVolumes:regional,fieldSamples,viewMode:$('#optical-mode').value,atlasAngles:{...atlasAngles},clinicalValidation:false,clinicalPortal:false,cannulaFit:false,internalSurface:'reconstructed compartment boundary, shared with fluid-volume mesh',motionLaw:'prescribed rigid disc-condyle cluster; inferior chamber co-moves; pressure deforms estimated superior soft lining only',liningContactGuard:'Actual Boolean cavity closedness/winding and self-intersections at midpoint and endpoint; continuous hard source and bounded moving-instrument sweep',appearance:{revision:'r60',look:Number($('#lens-look').value),scopeSpeed:Number($('#scope-speed').value),geometryRevision:'r54',imageUp:$('#image-orientation').value==='coupled'?'fixed camera-to-telescope clocking, upright at prepared pose':'projected model superior',cameraCouplingMeasured:false,illumination:'two soft cone lights at physical tip, offset 0.55 mm; inverse-square falloff; two filtered shadow maps with constant depth bias without normal extrusion',wetFilm:'broken clearcoat with irregular connective strands and fine vascular pigment',exposureResponse:'temporal highlight protection 0.12 s, brightening 0.45 s; illustrative',pixelFootprintFilter:true,colourCalibration:false,autoExposure:$('#auto-exposure').checked,exposureApplied,exposureMeter,normalSmoothingOnly:false,shading:'angle-weighted normals with local metric filtering',mesoscopicRelief:'rest-anchored shading only, no displacement',r46GeometryUnchanged:false,sourceHardRestGeometryUnchanged:true,rigidDisc:true,softFolds:{method:'short broad irregular posterior pleats with distance-tapered attachments; dynamic enclosure union and exact source subtraction',priorAttachmentRetained:true,preparedAddedVolumeML:.007971833732,measuredSynovium:false},liningMotion:liningDeformation.map(r=>r.report),vascularPattern:'deterministic branching pigment with restrained perivascular tint, restricted to synovial and retrodiscal regions',boneDiscVerticesExact:true,restAnchoredTexture:true,materialReferenceDistraction:2.5,blendedRegions:true,exposure,lightOrigins:[lamp.position.toArray(),fill.position.toArray()],lightDirection:opticalPose(pose).direction,calibratedOptics:false},travel:travel?{...travel}:null,renderFramePaced:true,increment:increment(),liningBuffersShared:lining.every((l,i)=>l.mesh.geometry.attributes.position===cavities[i].g.attributes.position),assumptions:{...data.assumptions,softMotion:'Prescribed disc-condyle rigid cluster with harmonic superior soft-lining weights; inferior rigid co-motion',wall:'Outward-normal scalar compliant superior mode tapered into hard/contact anchors; uncalibrated',contact:'Continuous rigid bone/disc guard and full instrument sweep; strict sampled rebuilt-domain self-intersections; 0.00002 mm extent/penetration tolerance for Float32 clipping; not a force solver',distraction:data.assumptions.distraction,motionFlow:'Moving-geometry backward Euler with boundary exchange per accepted 0.1 s step'}};}
 $('#export').onclick=()=>{sampleField();const u=URL.createObjectURL(new Blob([JSON.stringify(capture(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='tmj-studio-r59-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);$('#record').textContent='Session exported with geometry provenance and assumptions.';};
 const ray=new T.Raycaster(),labels={temporal:'Temporal articular surface',condyle:'Mandibular condyle',disc:'Articular disc','capsule-superior':'Estimated superior capsule','capsule-inferior':'Estimated inferior capsule',closure:'Estimated computational closure'};let evidenceAt=0;
 let fieldKey = '', fieldInside = -1;
 function sampleField() {
  if (fieldKey === rayKey) return;
  fieldKey = rayKey;
  const inside = fieldInside;
   const visible=inside>=0?[lining[inside].mesh]:[...records.map(r=>r.mesh),closure];
   fieldSamples=[['Upper',0,.55],['Left',-.55,0],['Centre',0,0],['Right',.55,0],['Lower',0,-.55]].map(([region,x,y])=>{
    if(region==='Centre')return {region,name:hit?.object.name??null,distance:hit?.distance??null,point:hit?.point.toArray()??null};
    ray.setFromCamera(new T.Vector2(x,y),camera);const h=ray.intersectObjects(visible)[0];
    const name=h?(inside>=0?lining[inside].boundaries[h.faceIndex]:h.object.name):null;
    return{region,name,distance:h?.distance??null,point:h?.point.toArray()??null};
   });
   $('#field-tissues').replaceChildren(...fieldSamples.map(f=>{const row=document.createElement('div');const region=document.createElement('b');region.textContent=f.region;const tissue=document.createElement('span');tissue.textContent=f.name?f.name.split('|').map(n=>labels[n]||n.replaceAll('-',' ')).join(' / ')+' · '+fmt(f.distance,1)+' mm':'No tissue in ray';row.append(region,tissue);return row;}));
 }
 // r59 position readout: joint space, approximate zone, viewing direction and the tissue at
 // the centre of the image. Zones are thirds of the model's superior space: illustrative.
 const hud={space:$('#hud-space'),zone:$('#hud-zone'),look:$('#hud-look'),depth:$('#hud-depth'),see:$('#hud-see'),ap:$('#hud-ap'),ml:$('#hud-ml'),outside:$('#lens-outside')};let hudBox=null,hudRevision=-1;
 const directionWords=d=>{const parts=[[d[0],'lateral','medial'],[d[1],'anterior','posterior'],[d[2],'superior','inferior']].map(([v,p,n])=>[Math.abs(v),v>=0?p:n]).sort((a,b)=>b[0]-a[0]),text=parts.filter((p,i)=>!i||p[0]>.45).slice(0,2).map(p=>p[1]).join(' and ');return text[0].toUpperCase()+text.slice(1);};
 function updateHud(optical,inside,inspection){
  if(hudRevision!==geometryRevision){hudRevision=geometryRevision;hudBox=new T.Box3().setFromBufferAttribute(cavities[0].g.attributes.position);}
  const hidden=proc.scopeHidden,along=pose.depth-DEPTH_OFFSET,size=hudBox.getSize(V([0,0,0])),ap=Math.max(0,Math.min(1,(optical.tip[1]-hudBox.min.y)/(size.y||1))),ml=Math.max(0,Math.min(1,(optical.tip[0]-hudBox.min.x)/(size.x||1)));
  hud.space.textContent=hidden?'Arthroscope not inserted':inside===0?'Superior joint space':inside===1?'Inferior joint space':'Outside the joint';
  hud.zone.textContent=hidden?'Follow the procedure steps':inside===0?(ap<1/3?'Posterior recess':ap<2/3?'Intermediate zone':'Anterior recess')+' · '+(ml<1/3?'medial':ml<2/3?'central':'lateral')+' part':inside===1?'Below the disc':along<0?fmt(-along,1)+' mm short of the capsule entry':'Soft tissue beside the joint space';
  hud.look.textContent=hidden?'—':directionWords(optical.direction);
  hud.depth.textContent=hidden?'':along>=0?fmt(along,1)+' mm past the capsule entry':'Withdrawn '+fmt(-along,1)+' mm';
  hud.see.textContent=hidden?'—':hit?hit.object.name.split('|').map(n=>labels[n]||n.replaceAll('-',' ')).join(' / ')+' · '+fmt(hit.distance,1)+' mm':'No tissue on the centre ray';
  const show=!hidden&&inside===0;hud.ap.hidden=hud.ml.hidden=!show;if(show){hud.ap.style.left=(ap*100).toFixed(1)+'%';hud.ml.style.left=(ml*100).toFixed(1)+'%';}
  hud.outside.hidden=hidden||inside>=0||!!inspection;
 }
 function frame(now){if(!canInteract())return;try{
  const optical=opticalPose(pose),preset=data.presets.find(p=>p.id===$('#optical-mode').value);let inspection=null;

  const view=inspection||optical;camera.position.fromArray(view.tip);camera.up.fromArray(imageBasis(pose,$('#image-orientation').value,Number($('#camera-roll').value)).up);camera.lookAt(camera.position.clone().add(V(view.direction)));camera.updateMatrixWorld();const lightOffset=V(optical.axis).cross(V(optical.up)).normalize().multiplyScalar(.55);lamp.position.copy(camera.position).add(lightOffset);fill.position.copy(camera.position).sub(lightOffset);fill.target.position.copy(camera.position).add(V(view.direction));lamp.target.position.copy(fill.target.position);const compartment=map.classify(optical.tip),inside=compartment==='Superior joint space'?0:compartment==='Inferior joint space'?1:-1;for(const r of records)r.mesh.visible=inside<0;closure.visible=inside<0;lining.forEach((l,i)=>l.mesh.visible=i===inside);
  // Procedure visuals: jaw preview, fluid state, suspended sprites and the outflow needle.
  const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if(jawMotion){const u=Math.max(0,Math.min(1,(performance.now()-jawMotion.start)/jawMotion.duration)),e=smooth(u);jawVisual={};for(const k of jawKeys)jawVisual[k]=jawMotion.from[k]+(jawMotion.to[k]-jawMotion.from[k])*e;if(u>=1){const done=jawMotion.resolve;jawMotion=null;done();}}
  const preview=jawVisual&&!sameJaw(jawVisual,params)?rigidMatrix(jawVisual).multiply(rigidMatrix(params).invert()).toArray():null;
  if(proc.awaitBleed&&inside===0){proc.awaitBleed=false;visual.bleed=1;visual.debris=Math.max(visual.debris,.4);visual.bubbles=Math.max(visual.bubbles,.35);}
  stepFluid(visual,dt,fluid.volume);
  if(visual.suction)tools.outflow.fill=Math.min(.9,tools.outflow.fill+dt*.19);
  const draining=tools.outflow.visible&&tools.outflow.advance>.98&&((visual.inflow&&visual.outflow)||visual.suction);
  tools.outflow.flow=draining;tools.outflow.tint=Math.round(visual.blood*50)/50;if(draining)tools.outflow.phase=Math.round(now/1300%1*60)/60;
  tools.inflow.flow=visual.inflow;if(visual.inflow)tools.inflow.phase=Math.round(now/1000%1*60)/60;
  needle.visible=tools.outflow.visible&&inside>=0;
  if(tools.outflow.visible){const a=V(tools.outflow.axis);needle.position.fromArray(tools.outflow.tip).addScaledVector(a,-(1-tools.outflow.advance)*17);needle.quaternion.setFromUnitVectors(V([0,1,0]),a);}
  const inSuperior=inside===0&&!proc.scopeHidden,puncture=locator?.entry||optical.tip.map((v,i)=>v-optical.axis[i]*1.5);
  sprites=particles.step(dt,{tip:optical.tip,forward:optical.direction,axis:optical.axis,inside:inSuperior,range:hit?.distance,bleed:{point:puncture,rate:visual.bleed},blood:visual.blood,inflow:visual.inflow?1:0,
   sink:draining?{point:tools.outflow.tip,strength:visual.suction?7:3}:visual.suction?{point:optical.tip.map((v,i)=>v-optical.axis[i]*1.2),strength:5}:null,debris:visual.debris,bubbles:visual.bubbles,buoyancy:[.5,0,.15]});
  const ease=(value,target,seconds)=>{const next=value+(target-value)*Math.min(1,dt/seconds);return Math.abs(next-target)<.002?target:next;};
  const outsideTarget=inside<0?1:0,standbyTarget=proc.scopeHidden?1:0,bloodTarget=inSuperior?visual.blood:0,hazeTarget=inSuperior?visual.haze:0,collapseTarget=inSuperior?visual.collapse:0;
  lens.occlusion=ease(lens.occlusion,outsideTarget,.16);lens.standby=ease(lens.standby,standbyTarget,.25);lens.blood=ease(lens.blood,bloodTarget,.2);lens.haze=ease(lens.haze,hazeTarget,.3);lens.collapse=ease(lens.collapse,collapseTarget,.2);
  const fade=Math.max(0,1-(now-dissolveStart)/420);lens.dissolve=fade*fade*(3-2*fade);
  spaceGlow=ease(spaceGlow,Math.max(proc.fill,visual.blood>.02||visual.inflow?1:0),.25);
  const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),upward=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1),tilt=V(optical.direction).sub(V(optical.axis));
  lens.notch=Math.atan2(tilt.dot(upward),tilt.dot(right));updateRim(right,upward);
  const animated=lens.blood>0||lens.haze>0||lens.collapse>0||lens.dissolve>0||lens.occlusion!==outsideTarget||lens.standby!==standbyTarget||lens.blood!==bloodTarget;
  scene.updateMatrixWorld();
  const nextRayKey=JSON.stringify([pose,geometryRevision,inside,$('#image-orientation').value,$('#camera-roll').value]);
  if(nextRayKey!==rayKey){rayKey=nextRayKey;raycasts++;ray.set(camera.position,V(view.direction));hit=ray.intersectObjects(inside>=0?[lining[inside].mesh]:[...records.map(r=>r.mesh),closure])[0]||null;if(hit&&inside>=0)hit={...hit,object:{name:lining[inside].boundaries[hit.faceIndex]}};
  }
  fieldInside=inside;
  if ($('#identify').checked) sampleField();
  else if (fieldKey !== rayKey) fieldSamples=[];
  washout=washoutState(fluid,$('#washout').checked,inside===0);scene.fog=washout.active?new T.FogExp2('#98736b',washout.density):null;
  const poseKey = JSON.stringify(pose);
  if (poseKey !== lastPoseKey) { lastMotionTime=now; lastPoseKey=poseKey; }
  const movingLens = gestures.active > 0 || now-lastMotionTime < 180;
  const meterDelay = movingLens ? 750 : meterIntervalMS;
  const w=Math.max(1,sc.clientWidth);
  const ratio = movingLens ? Math.min(devicePixelRatio, Math.max(0.6, 170/w), 1) : Math.min(devicePixelRatio,2);
  if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
  if(sc.width!==Math.floor(w*ratio))renderer.setSize(w,w,false);
  if(fx.setSize(sc.width,sc.height)||!sceneKey)particles.setProjection(sc.height,camera.fov);
  // The joint is redrawn when the lens, anatomy or suspended sprites change; the display
  // pass alone repeats while blood drifts or a dissolve is running.
  const nextSceneKey=JSON.stringify([nextRayKey,w,ratio,$('#texture').checked,washout.density,needle.visible,tools.outflow.advance]);
  const redraw=nextSceneKey!==sceneKey||sprites.alive>0||spritesWereAlive;spritesWereAlive=sprites.alive>0;
  const nextScopeKey=JSON.stringify([nextSceneKey,exposure,$('#auto-exposure').checked,$('#lens-optics').checked,lens.notch.toFixed(3)]);
  if(redraw||animated||nextScopeKey!==scopeKey||(exposureSettling&&now-lastExposureTime>=meterDelay)){
   // Exposure changes reuse both shadow maps. Only the lamp pose or anatomy invalidates them.
   const shadowKey=JSON.stringify([pose,geometryRevision,inside,needle.visible,tools.outflow.advance]);
   if(redraw){renderer.shadowMap.needsUpdate=shadowKey!==lastShadowKey;lastShadowKey=shadowKey;}
   sceneKey=nextSceneKey;scopeKey=nextScopeKey;
   renderScope(now,meterDelay,redraw);
  }
  {const k=1-Math.exp(-dt/.085);for(const key of Object.keys(goal)){const gap=goal[key]-orbit[key];orbit[key]=Math.abs(gap)<(key==='zoom'?.0005:.01)?goal[key]:orbit[key]+gap*k;}}
  locator=map.draw({optical,pose,orbit,names:$('#map-names').checked,separate:$('#separate').checked,cutaway:$('#cutaway').checked,translucentRoof:$('#translucent-roof').checked,showEnvelope:$('#envelope').checked,teaching:$('#teaching').checked,guides:$('#lens-guides').checked,first:hit,blocked,inspection,tracer:fluid.tracerMass/fluid.volume,preview,tools,scopeVisible:!proc.scopeHidden,spaceHighlight:Math.round(spaceGlow*50)/50,blood:Math.round(visual.blood*50)/50,spaceScale:Math.round(spaceScale.value*500)/500});
  if($('#locator-mode').value==='section')sectionEvidence=section.draw({optical,entry:locator.entry,first:hit,compartment:locator.compartment});
  if(now-evidenceAt>100){evidenceAt=now;updateHud(optical,inside,inspection);const clear=clarity(visual);$('#fx-clarity').value=clear;$('#fx-clarity-out').textContent=clear+'%';$('#fx-status').textContent=describeFluid(visual)+(visual.exchangedML>.001?' · '+fmt(visual.exchangedML,1)+' mL exchanged':'');if(proc.readyAt&&performance.now()>=proc.readyAt){proc.readyAt=0;syncProcedure();}if($('#fx-irrigation').checked!==visual.inflow||$('#fx-suction').getAttribute('aria-pressed')!==String(visual.suction))syncProcedure();$('#location').textContent=proc.scopeHidden?'Arthroscope not inserted':inspection?'Atlas: '+locator.inspection.compartment:locator.compartment;$('#view-note').classList.toggle('atlas',!!inspection);$('#view-note').textContent=inspection?'Reference point inside the reconstructed space. Amber camera marker; the physical telescope stays where you left it. Drag to look around.':'Live telescope image · '+locator.compartment+'. '+($('#hand-grip').value==='handle'?'Move the handle across the fixed entry.':'Direct the viewed ray.')+' Two fingers combine steering, depth and roll.';$('.optical-tag').textContent=inspection?'INTERNAL ATLAS · POINT CAMERA':proc.scopeHidden?'':inside<0?'SOFT TISSUE · OUTSIDE THE JOINT':'NEXUS 501200 · 30°';$('.optical-tag').classList.toggle('atlas',!!inspection);$('#xyz').textContent=optical.tip.map(v=>fmt(v)).join(', ')+' mm';$('#entry').textContent=locator.entry?'Lateral capsule · model entry':'Withdrawn · lateral approach';$('#entry-progress').textContent=locator.entry?((optical.tip[0]-locator.entry[0])*optical.axis[0]+(optical.tip[1]-locator.entry[1])*optical.axis[1]+(optical.tip[2]-locator.entry[2])*optical.axis[2]>=0?'Lens beyond model capsule entry':'Approaching model capsule entry'):'Outside · lateral approach';$('#route').dataset.inside=String(inside>=0);$('#hit').textContent=proc.scopeHidden?'':hit?`Centre: ${labels[hit.object.name]||hit.object.name} · ${fmt(hit.distance)} mm`:'No reconstructed tissue on the centre ray';$('#space-badge').textContent=$('#separate').checked?'Separated teaching view · coordinates unchanged':'Assembled joint · '+($('#cutaway').checked?'roof cutaway':'complete surfaces');$('#view-target').textContent=!$('#lens-guides').checked?'Enable lens guides to see the field of view and its centre target.':hit?'Gold dot: '+hit.object.name.split('|').map(n=>labels[n]||n.replaceAll('-',' ')).join(' / ')+' · '+fmt(hit.distance,1)+' mm from the lens.':'Blue cone: physical 65° field. No tissue on the centre ray.';$('#flow-readout').textContent='Inflow '+fmt((fluid.qin||0)*1000,1)+' · Outflow '+fmt((fluid.qout||0)*1000,1)+' µL/s';$('#anterior-volume').textContent=fmt(regional?.anteriorML*1000,1)+' µL';$('#posterior-volume').textContent=fmt(regional?.posteriorML*1000,1)+' µL';$('#performance').textContent='Lens render '+fmt(scopeRenderMS,1)+' ms · unchanged views cached';$('#p').textContent=fmt(fluid.pressure,3)+' kPa';$('#vol').textContent=fmt(fluid.volume*1000)+' µL';$('#volume-change').textContent=(fluid.volume>=fluid.initialVolume?'+':'')+fmt((fluid.volume-fluid.initialVolume)*1000)+' µL';$('#balance').textContent=Math.abs((fluid.volume-fluid.initialVolume-fluid.netIn)*1000).toExponential(1)+' µL';$('#washout-out').textContent=$('#washout').checked?`${fmt(washout.fraction*100,1)}% tracer · ${washout.active?'visible in superior space':'outside irrigated space'}`:'Optional visual tracer';$('#fluid-status').textContent=`${running?'Running':'Paused'}${fluid.contactLimited?' · contact-limited':''} · ${fmt(fluid.elapsed,1)} s · wall ${fmt(fluid.wall,3)} mm · tracer ${fmt(100*fluid.tracerMass/fluid.volume,1)}%`;document.body.dataset.evidence=JSON.stringify({...capture(),frameNumber:++frameCount,busy,blocked,lastCheck,locator,lens:optical.tip,renderedCamera:camera.position.toArray(),renderedUp:camera.up.toArray(),inspection,dov:T.MathUtils.radToDeg(V(optical.axis).angleTo(V(optical.direction))),fov:65,internalOpaque:records.every(r=>!r.mesh.material.transparent),running,fluidResidual:fluid.volume-fluid.initialVolume-fluid.netIn});}
  if(running&&!busy&&now-lastFluid>=100){lastFluid=now;task(()=>changeGeometry({...params},true));}
  requestAnimationFrame(frame);
 }catch(error){fatal(error,'The view could not continue. Please retry to restore the joint.');}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;sync();}});for(const c of[sc,mc,$('#overview')])c.addEventListener('webglcontextlost',e=>{e.preventDefault();fatal(Error('Graphics context lost'),'Graphics interrupted. Please retry to restore the joint.');});
 const init=await check('init',{parts:sourceParts,dense,solids:sourceOperands.parts,lining:cavities.map(c=>({part:c.part,field:c.field,overlays:c.overlays})),model:{fields:data.fields,axis:data.axis,centre:data.centre},geometry:{...params,wall:0},pose});if(!init.accepted)throw Error('Starting position is not collision-clear: '+JSON.stringify(init.hits));lastCheck=compactResult(init);fluid=M.initialFluid([init.cavities[0].volume,0,0,0]);const insertion=await check('move',{pose:PREPARED});pose=insertion.accepted?insertion.pose:init.pose;lastCheck=insertion;blocked=insertion.accepted?null:insertion.hits?.[0];geometry(init.cavities);sync();status('Prepared joint · full insertion sweep clear · actual Nexus lens');$('#load').textContent='Synchronized lens & shaft · bone / disc boundaries active';$('#integrity').textContent=`Anatomy v21 SHA-256 ${data.sourceHash}. Original cavity v26 SHA-256 ${data.cavityHash}. Original source and dense collision files remain unchanged. Repaired enclosure SHA-256 ${reconstructionRepairHash}. Computational enclosure surfaces are aligned inside their corresponding source solids; subtraction restores the actual source boundary and removes source overlap. A small artificial annular bridge was replaced by separate source-embedded caps. Distant closure caps are forbidden from appearing in the joint. Source bone and disc move rigidly as a prescribed disc-condyle cluster. Pressure deforms the estimated superior lining only. This is a geometric teaching model with reduced hydraulics; it does not supply measured synovium, natural disc kinematics, tissue forces or clinical validation.`;startupMS=performance.now()-bootStarted;document.body.dataset.state='ready';sync();if(!insertion.accepted){rejected(insertion,'Automatic entry stopped');$('#load').textContent='Joint ready at the last clear position · automatic entry stopped';}requestAnimationFrame(frame);
}catch(e){fatal(e);}






