// Independent teaching scene. Shared geometry buffers; only this scene's copies move.
export function createAnatomyExplorer({THREE,meshes,closure,position}){
 const $=s=>document.querySelector(s),canvas=$('#anatomy-canvas'),svg=$('#anatomy-labels');
 const scene=new THREE.Scene();scene.background=new THREE.Color('#0e1b22');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 const camera=new THREE.OrthographicCamera();camera.up.set(0,0,1);camera.near=.1;camera.far=2000;
 scene.add(new THREE.AmbientLight(0xffffff,1.3));
 for(const [p,i] of [[[45,-40,80],2],[[-40,45,10],.8]]){const l=new THREE.DirectionalLight(0xffffff,i);l.position.set(...p);scene.add(l);}
 const names={temporal:'Temporal roof',disc:'Articular disc',condyle:'Mandibular condyle','capsule-superior':'Superior attachment estimate','capsule-inferior':'Inferior attachment estimate','medial-superior-continuity':'Medial continuity estimate','lateral-discal-attachment':'Lateral discal attachment estimate','medial-discal-attachment':'Medial discal attachment estimate','retrodiscal-temporal-lamina':'Posterior upper lamina estimate','retrodiscal-condylar-lamina':'Posterior lower lamina estimate','retrodiscal-loose-tissue':'Posterior tissue estimate','computational-closure':'Computational boundary — not tissue'};
 const descriptions={temporal:'The temporal bone forms the bony roof above the superior compartment. The camera sees its model surface; the synovial lining is not reconstructed.',disc:'The disc separates the superior and inferior compartments. In the current superior-compartment views, its upper surface lies below the lens. This disc is source-derived with local corrections.',condyle:'The condylar head lies below the disc. It helps orient the joint externally; it is not the floor of the superior compartment because the disc intervenes.'};
 const baseNames=['temporal','disc','condyle'];
 const state={az:62,el:13,mode:'exploded',estimates:false,selected:'disc',first:null,direction:new THREE.Vector3(1,0,0)};
 const copies=meshes.filter(m=>m!==closure).map(m=>{const mat=m.material.clone();mat.flatShading=false;mat.transparent=true;mat.opacity=1;const copy=new THREE.Mesh(m.geometry,mat);copy.name=m.name;scene.add(copy);return copy;});
 const marker=new THREE.Mesh(new THREE.SphereGeometry(.45,20,12),new THREE.MeshBasicMaterial({color:'#4db6ff',depthTest:false,transparent:true}));marker.renderOrder=5;scene.add(marker);
 const hitMarker=new THREE.Mesh(new THREE.SphereGeometry(.38,20,12),new THREE.MeshBasicMaterial({color:'#ffba65',depthTest:false,transparent:true}));hitMarker.renderOrder=6;scene.add(hitMarker);
 const arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),position,6,0x4db6ff,1,.5);scene.add(arrow);
 const leaders=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#5c7f8e',dashSize:.7,gapSize:.5,transparent:true,opacity:.5}));scene.add(leaders);
 function displacement(name){if(state.mode!=='exploded')return new THREE.Vector3();return new THREE.Vector3(0,0,name==='temporal'?40:name==='condyle'?-16:baseNames.includes(name)?0:name.includes('inferior')||name.includes('condylar')?-9:name.includes('superior')||name.includes('temporal')?20:0);}
 function sv(tag,attrs,text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text)el.textContent=text;svg.append(el);}
 function render(){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),aspect=w/h;
  const az=THREE.MathUtils.degToRad(state.az),el=THREE.MathUtils.degToRad(state.el);
  const viewDirection=new THREE.Vector3(Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el));
  const modelBounds=new THREE.Box3();const points=[];
  for(const m of copies){const basic=baseNames.includes(m.name);m.position.copy(displacement(m.name));m.visible=state.mode==='assembled'||state.mode==='exploded'?(basic||state.estimates):state.mode==='attachments'?!basic:m.name===state.mode;
   m.material.opacity=state.mode==='assembled'&&m.name==='temporal'?.24:!basic?.7:.96;m.material.depthWrite=m.material.opacity>.9;m.material.emissive.set(m.name===state.selected?'#15303a':'#000000');
   m.updateMatrixWorld(true);if(m.visible){modelBounds.union(new THREE.Box3().setFromObject(m));if(m.position.length()){m.geometry.computeBoundingBox();const c=m.geometry.boundingBox.getCenter(new THREE.Vector3());points.push(c,c.clone().add(m.position));}}
  }
  const centre=modelBounds.getCenter(new THREE.Vector3());
  camera.position.copy(centre).addScaledVector(viewDirection,500);camera.lookAt(centre);camera.updateMatrixWorld(true);
  const projected=new THREE.Box3(),p=new THREE.Vector3();for(const m of copies.filter(m=>m.visible)){const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++)projected.expandByPoint(p.fromBufferAttribute(a,i).add(m.position).applyMatrix4(camera.matrixWorldInverse));}
  const size=projected.getSize(new THREE.Vector3()),span=Math.max(24,size.y/.68,size.x/aspect/.65);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
  marker.position.copy(position);arrow.position.copy(position);arrow.setDirection(state.direction);arrow.visible=state.mode==='assembled';marker.visible=state.mode==='assembled'||state.mode==='exploded';
  const hitCopy=state.first&&copies.find(m=>m.name===state.first.object.name);hitMarker.visible=!!(hitCopy&&hitCopy.visible);if(hitMarker.visible)hitMarker.position.copy(state.first.point).add(hitCopy.position);
  leaders.geometry.dispose();leaders.geometry=new THREE.BufferGeometry().setFromPoints(points);leaders.computeLineDistances();leaders.visible=state.mode==='exploded';
  if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
  renderer.render(scene,camera);
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const labelled=copies.filter(m=>m.visible&&baseNames.includes(m.name));
  const projectedLabels=labelled.map(m=>{m.geometry.computeBoundingBox();const c=m.geometry.boundingBox.getCenter(new THREE.Vector3()).add(m.position).project(camera);return{m,x:(c.x+1)*w/2,y:(1-c.y)*h/2};}).sort((a,b)=>a.y-b.y);
  let previous=48;
  for(const {m,x,y}of projectedLabels){const ty=Math.min(h-25,Math.max(previous+34,y)),tx=12,label=names[m.name];previous=ty;sv('path',{d:`M ${tx+Math.min(140,w*.36)} ${ty-4} L ${x} ${y}`});sv('text',{x:tx,y:ty},label);}
  // Anatomical directions are projections of the same model axes.
  const origin=new THREE.Vector3().project(camera),cx=w-48,cy=h-48;
  for(const[label,a]of[['S',[0,0,1]],['A',[0,1,0]],['L',[1,0,0]]]){const p=new THREE.Vector3(...a).project(camera),dx=(p.x-origin.x)*w,dy=-(p.y-origin.y)*h,n=Math.hypot(dx,dy);if(n<1e-7)continue;sv('path',{d:`M${cx} ${cy} L${cx+dx/n*22} ${cy+dy/n*22}`});sv('text',{x:cx+dx/n*32,y:cy+dy/n*32+4,'text-anchor':'middle'},label);}
  if(marker.visible){const p=position.clone().project(camera),x=(p.x+1)*w/2,y=(1-p.y)*h/2;sv('circle',{cx:x,cy:y,r:4,fill:'#4db6ff',stroke:'#e1f5ff','stroke-width':1.2});sv('text',{x:Math.min(w-105,x+11),y:y-10},state.mode==='exploded'?'Lens · original':'Lens tip');}
  if(hitMarker.visible){const p=hitMarker.position.clone().project(camera);sv('circle',{cx:(p.x+1)*w/2,cy:(1-p.y)*h/2,r:3.3,fill:'#ffba65',stroke:'#5b3716','stroke-width':1});}
  $('#anatomy-view-status').textContent=state.mode==='exploded'?'Separated for study · displaced copies, not joint opening':state.mode==='assembled'?'Assembled · original tissue coordinates':'Isolated structure · original tissue coordinates';
  $('#anatomy-location').textContent='Right TMJ · superior compartment · blue lens point between the temporal roof and upper disc surface.';
  $('#anatomy-looking').textContent=state.first?`${names[state.first.object.name]||state.first.object.name} · ${state.first.distance.toFixed(3)} mm from the lens`: 'No reconstructed surface on the centre ray.';
  $('#anatomy-picked-title').textContent=names[state.selected]||state.selected;
  $('#anatomy-picked-copy').textContent=state.selected==='computational-closure'?'This striped surface closes a computational envelope. It is not reconstructed tissue or a clinical landmark.':descriptions[state.selected]||'This is an estimated attachment or posterior tissue surface. Its shape and boundaries are not accepted specimen anatomy; synovial lining and medial fascia remain unresolved.';
  document.body.dataset.anatomyEvidence=JSON.stringify({mode:state.mode,selected:state.selected,estimates:state.estimates,lens:position.toArray(),centreSurface:state.first?.object.name||null,centrePoint:state.first?.point.toArray()||null,displayTarget:hitMarker.visible?hitMarker.position.toArray():null,visible:copies.filter(m=>m.visible).map(m=>m.name),transforms:copies.map(m=>({name:m.name,offset:m.position.toArray()})),sharedBuffers:copies.every(m=>m.geometry===meshes.find(n=>n.name===m.name).geometry),sourceTransformsIdentity:meshes.every(m=>m.position.lengthSq()===0),orbit:[state.az,state.el]});
 }
 $('#anatomy-mode').onchange=e=>{state.mode=e.target.value;if(baseNames.includes(state.mode))state.selected=state.mode;else if(state.mode==='attachments'&&baseNames.includes(state.selected))state.selected='capsule-superior';render();};$('#anatomy-estimates').onchange=e=>{state.estimates=e.target.checked;render();};
 function reset(){state.az=62;state.el=13;state.mode='exploded';state.estimates=false;state.selected='disc';$('#anatomy-mode').value=state.mode;$('#anatomy-estimates').checked=false;}
 $('#anatomy-reset').onclick=()=>{reset();render();};
 let drag=null;canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;state.az-=(e.clientX-drag.x)*.5;state.el=Math.max(-80,Math.min(80,state.el+(e.clientY-drag.y)*.5));drag.x=e.clientX;drag.y=e.clientY;render();});
 canvas.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5){const b=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);const hit=ray.intersectObjects(copies.filter(m=>m.visible),false)[0];if(hit){state.selected=hit.object.name;render();}}drag=null;});
 for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>drag=null);
 canvas.addEventListener('keydown',e=>{const actions={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,10],ArrowDown:[0,-10]};if(actions[e.key]){e.preventDefault();state.az+=actions[e.key][0];state.el=Math.max(-80,Math.min(80,state.el+actions[e.key][1]));render();}});
 new ResizeObserver(()=>{if(state.first)render();}).observe(canvas);
 return {draw(direction,first){state.direction.copy(direction);state.first=first;render();},reset,focusCentre(){if(!state.first)return;state.selected=state.first.object.name;if(state.first.object!==closure){state.mode=baseNames.includes(state.selected)?state.selected:'attachments';$('#anatomy-mode').value=state.mode;}render();}};
}
