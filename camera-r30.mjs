import {createSections} from './camera-sections-r29.mjs';
import * as THREE from './vendor/three-0.170.0.module.min.js';
import {createLocator} from './camera-r30-locator.mjs';
const $=s=>document.querySelector(s),canvas=$('#scope');
const pose={yaw:-85,pitch:20},position=new THREE.Vector3(6.84,-4.28,1.50598);
const labels={temporal:'Temporal surface',condyle:'Condyle',disc:'Disc','capsule-superior':'Estimated superior attachment','medial-superior-continuity':'Estimated medial continuity · fascia unresolved','retrodiscal-temporal-lamina':'Estimated posterior lamina','retrodiscal-condylar-lamina':'Estimated lower posterior lamina','retrodiscal-loose-tissue':'Posterior tissue estimate · lining not reconstructed','computational-closure':'COMPUTATIONAL CLOSURE · NOT TISSUE'};
async function load(name,expected){const r=await fetch(name);if(!r.ok)throw Error(`${name}: HTTP ${r.status}`);const bytes=await r.arrayBuffer();if(expected){const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw Error('Frozen geometry hash mismatch');}return JSON.parse(new TextDecoder().decode(bytes));}
try{
 const audit=await load('camera-r26-audit.json');
 const comparison=await load('camera-r26-positions.json');
 const sectionData=await load('camera-sections-r29.json','b89444392a5260250de798540267d03035b3820a8650e1e9733b5f9308a75b50');
 const {drawSections,resetSections}=createSections({data:sectionData,comparison});
 for(const p of comparison.presets){if(!p.audit.near_safe_all_directions||Math.abs(p.audit.cavity_winding-1)>1e-5)throw Error('Unaudited camera position');}
 let selected=comparison.presets.find(p=>p.id===new URLSearchParams(location.search).get('preset'))||comparison.presets[0];
 position.fromArray(selected.position_mm);pose.yaw=selected.yaw_deg;pose.pitch=selected.pitch_deg;
 for(const p of comparison.presets){const o=document.createElement('option');o.value=p.id;o.textContent=p.label;$('#position-select').append(o);}
 const [anatomy,cavity]=await Promise.all([load('tmj-anatomy-v21.json',audit.source_hashes['tmj-anatomy-v21.json']),load('joint-spaces-v26.json',audit.source_hashes['joint-spaces-v26.json'])]);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#080c10');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.localClippingEnabled=false;
 const camera=new THREE.PerspectiveCamera(65,1,.01,100);camera.position.copy(position);camera.up.set(0,0,1);
 scene.add(new THREE.AmbientLight(0xffffff,1.2));
 const lamp=new THREE.DirectionalLight(0xffffff,2);lamp.position.copy(position);scene.add(lamp);scene.add(lamp.target);
 const meshes=[];const colors={temporal:'#d1c0a4',condyle:'#b4ad9d',disc:'#71b5c6',capsule:'#bca767',retroUpper:'#b88771',retroLower:'#b88771',retroCore:'#b88771'};
 function geometry(part,indices=part.i){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.p,3));g.setIndex(indices);g.computeVertexNormals();return g;}
 for(const part of anatomy.parts){
  if(part.head||part.mode==='original')continue;
  const material=new THREE.MeshStandardMaterial({color:colors[part.layer],roughness:1,metalness:0,side:THREE.DoubleSide,transparent:false,opacity:1,depthTest:true,depthWrite:true,flatShading:true});
  const mesh=new THREE.Mesh(geometry(part),material);mesh.name=part.name;scene.add(mesh);meshes.push(mesh);
 }
 const superior=cavity.parts.find(p=>p.name==='superior'),indices=[];
 superior.faceBoundaries.forEach((n,i)=>{if(n==='closure')indices.push(...superior.i.slice(i*3,i*3+3));});
 const mask=new THREE.ShaderMaterial({side:THREE.DoubleSide,depthTest:true,depthWrite:true,transparent:false,vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'void main(){float stripe=step(.5,fract((gl_FragCoord.x+gl_FragCoord.y)/18.));gl_FragColor=vec4(mix(vec3(.16,.035,.12),vec3(.65,.19,.51),stripe),1.);}' });
 const closure=new THREE.Mesh(geometry(superior,indices),mask);closure.name='computational-closure';scene.add(closure);meshes.push(closure);
 const {locatorCanvas,locatorState,drawLocator}=createLocator({THREE,anatomy,meshes,closure,position,camera});
 const ray=new THREE.Raycaster();let queued=false;
 function draw(){
  queued=false;pose.yaw=((pose.yaw+180)%360+360)%360-180;pose.pitch=Math.max(-80,Math.min(80,pose.pitch));
  const yaw=THREE.MathUtils.degToRad(pose.yaw),pitch=THREE.MathUtils.degToRad(pose.pitch);
  const direction=new THREE.Vector3(Math.cos(pitch)*Math.sin(yaw),Math.cos(pitch)*Math.cos(yaw),Math.sin(pitch));
  camera.position.copy(position);camera.lookAt(position.clone().add(direction));camera.updateMatrixWorld();lamp.position.copy(position);lamp.target.position.copy(position).add(direction);
  const size=Math.max(1,Math.round(canvas.clientWidth));if(canvas.width!==Math.round(size*renderer.getPixelRatio()))renderer.setSize(size,size,false);
  renderer.render(scene,camera);ray.set(position,direction);ray.near=0;ray.far=100;
  const first=ray.intersectObjects(meshes,false)[0];
  drawLocator(direction);
  drawSections(selected,position,direction);
  $('#hit').textContent=first?`Centre: ${labels[first.object.name]||first.object.name} · ${first.distance.toFixed(3)} mm`:'No reconstructed surface on centre ray · unresolved model direction';
  $('#orientation').textContent=`Yaw ${pose.yaw.toFixed(1)}° · Pitch ${pose.pitch.toFixed(1)}°`;
  $('#pose').textContent=`XYZ: ${position.toArray().map(n=>n.toFixed(5)).join(', ')} mm`;
  $('#region').textContent=`SUPERIOR · ${selected.region.toUpperCase()}`;
  $('#clearance').textContent=`${selected.audit.minimum_tissue_clearance_mm.toFixed(3)} mm`;
  const isReference=Math.abs(pose.yaw-selected.yaw_deg)<1e-8&&Math.abs(pose.pitch-selected.pitch_deg)<1e-8;
  $('#field-summary').textContent=isReference?`Reference field · roof ${(100*(selected.field.first_hit_counts.temporal||0)/selected.field.rays).toFixed(1)}% · disc ${(100*(selected.field.first_hit_counts.disc||0)/selected.field.rays).toFixed(1)}% · masks ${(100*selected.field.closure_fraction).toFixed(1)}%`:'View turned · Reset view restores the measured comparison direction.';
  $('#reference-description').textContent=`${selected.label}: ${selected.position_mm.map(n=>n.toFixed(5)).join(', ')} mm. Reference yaw ${selected.yaw_deg}°, pitch ${selected.pitch_deg}°. Median first-hit distance ${selected.field.distance_percentiles_mm[2].toFixed(3)} mm; ${(100*selected.field.closure_fraction).toFixed(1)}% mask rays in this reference field.`;
  $('#sections-link').href=`./sections.html?s=${position.x}&c=${position.y}`;
  $('#share-view').href=`./camera-r30.html?preset=${selected.id}`;
  $('#clip-status').textContent=`Near plane: ${camera.near.toFixed(3)} mm · corner radius ${(camera.near*Math.sqrt(1+2*Math.tan(THREE.MathUtils.degToRad(32.5))**2)).toFixed(4)} mm · envelope clearance ${selected.audit.cavity_clearance_mm.toFixed(3)} mm`;
  document.body.dataset.cameraState='ready';
  // Read-only rendered-state evidence for QA; no command or mutation interface.
  const identity=new THREE.Matrix4();document.body.dataset.cameraEvidence=JSON.stringify({preset:selected.id,isReference,position:camera.position.toArray(),direction:direction.toArray(),lampPosition:lamp.position.toArray(),yaw:pose.yaw,pitch:pose.pitch,near:camera.near,fov:camera.fov,aspect:camera.aspect,centre:first?{surface:first.object.name,distance:first.distance}:null,tissueCount:meshes.length-1,transformsIdentity:meshes.every(m=>m.matrixWorld.equals(identity)),allOpaque:meshes.every(m=>!m.material.transparent&&m.material.opacity===1),clippingPlanes:renderer.clippingPlanes.length,allDoubleSided:meshes.every(m=>m.material.side===THREE.DoubleSide),hashesVerified:true});
 }
 function schedule(){document.body.dataset.cameraState='updating';if(!queued){queued=true;requestAnimationFrame(draw);}}
 function turn(y,p){pose.yaw+=y;pose.pitch+=p;schedule();}
 function reset(){resetSections();position.fromArray(selected.position_mm);pose.yaw=selected.yaw_deg;pose.pitch=selected.pitch_deg;locatorState.az=selected.id==='original'?65:-35;locatorState.el=14;locatorState.mode='joint';camera.near=.01;camera.updateProjectionMatrix();$('#near').value='0.01';schedule();}
 $('#position-select').onchange=e=>{selected=comparison.presets.find(p=>p.id===e.target.value);reset();};
 $('#left').onclick=()=>turn(-5,0);$('#right').onclick=()=>turn(5,0);$('#up').onclick=()=>turn(0,5);$('#down').onclick=()=>turn(0,-5);$('#reset').onclick=reset;
 $('#near').onchange=e=>{camera.near=Number(e.target.value);camera.updateProjectionMatrix();schedule();};
 $('#locator-orbit').oninput=e=>{locatorState.az=Number(e.target.value);schedule();};
 $('#locator-joint').onclick=()=>{locatorState.mode='joint';schedule();};$('#locator-head').onclick=()=>{locatorState.mode='head';schedule();};
 let mapDrag=null;locatorCanvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;locatorCanvas.setPointerCapture(e.pointerId);mapDrag={id:e.pointerId,x:e.clientX,y:e.clientY};});
 locatorCanvas.addEventListener('pointermove',e=>{if(!mapDrag||mapDrag.id!==e.pointerId)return;locatorState.az-=(e.clientX-mapDrag.x)*.5;locatorState.el=Math.max(-75,Math.min(75,locatorState.el+(e.clientY-mapDrag.y)*.5));mapDrag.x=e.clientX;mapDrag.y=e.clientY;schedule();});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])locatorCanvas.addEventListener(name,()=>{mapDrag=null;});
 locatorCanvas.addEventListener('keydown',e=>{const actions={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,10],ArrowDown:[0,-10]};if(actions[e.key]){e.preventDefault();locatorState.az+=actions[e.key][0];locatorState.el=Math.max(-75,Math.min(75,locatorState.el+actions[e.key][1]));schedule();}});
 let drag=null;canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;turn((e.clientX-drag.x)*.18,-(e.clientY-drag.y)*.18);drag.x=e.clientX;drag.y=e.clientY;});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{drag=null;});
 canvas.addEventListener('keydown',e=>{const turns={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,5],ArrowDown:[0,-5]};if(turns[e.key]){e.preventDefault();turn(...turns[e.key]);}else if(e.key.toLowerCase()==='r'){e.preventDefault();reset();}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.body.dataset.cameraState='error';$('#loading').hidden=false;$('#loading').textContent='Graphics context lost. Reload to restore the fixed view.';});
 new ResizeObserver(schedule).observe(canvas);
 new ResizeObserver(schedule).observe(locatorCanvas);
 $('#integrity').textContent='Verified at load: anatomy v21 + cavity v26 SHA-256 match the audited files.';
 $('#clearance').textContent=`${audit.minimum_tissue_clearance_mm.toFixed(3)} mm`;$('#loading').hidden=true;$('#position-select').value=selected.id;reset();
}catch(error){document.body.dataset.cameraState='error';$('#loading').hidden=false;$('#loading').textContent=`Camera could not load: ${error.message}. Reload after signing in.`;console.error(error);}
