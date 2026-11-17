const root = document.getElementById('tmj-geometry-v7');
const q = s => root.querySelector(s);
const qa = s => [...root.querySelectorAll(s)];
const defaults = {view:'joint',section:0,azimuth:35,elevation:28,scale:34,mode:'reconstructed',ghost:false,spaceContext:'boundaries',spaceOpacity:.85,spaceRims:true,space:'both',inferiorVersion:'v26',cutaway:'none',closeup:false,seamEmphasis:false,reflection:true,seamEdges:true,insertionRims:false,contactTrim:true,fasciaNote:true,closureFilter:'all',medialReview:false,anchor:'none',contact:false,layers:{temporal:true,disc:true,condyle:true,capsule:true,retroUpper:true,retroLower:true,retroCore:true}};
let state = structuredClone(defaults);
function normalize(saved) {
  const x = saved?.privateContent?.anatomyV18;
  if (!x) return;
  if(['none','anterior','medial','anteromedial','patch','posteromedial','posterior','extreme-medial','contact-1','contact-2','contact-3','contact-4','contact-5','closure-C04-contact'].includes(x.cutaway)||/^closure-C(0[1-9]|[1-3][0-9]|4[0-8])$/.test(x.cutaway))state.cutaway=x.cutaway;
  if(['original','reconstructed'].includes(x.mode))state.mode=x.mode;
  if(typeof x.ghost==='boolean')state.ghost=x.ghost;
  if(['boundaries','isolated','layers','cutaway'].includes(x.spaceContext))state.spaceContext=x.spaceContext;
  if(Number.isFinite(x.spaceOpacity))state.spaceOpacity=Math.max(.25,Math.min(1,x.spaceOpacity));
  if(typeof x.spaceRims==='boolean')state.spaceRims=x.spaceRims;
  if(typeof x.closeup==='boolean')state.closeup=x.closeup;
  if(typeof x.seamEmphasis==='boolean')state.seamEmphasis=x.seamEmphasis;
  if(typeof x.reflection==='boolean')state.reflection=x.reflection;
  if(typeof x.seamEdges==='boolean')state.seamEdges=x.seamEdges;
  if(typeof x.insertionRims==='boolean')state.insertionRims=x.insertionRims;
  if(['all','sampling-supported','contact-or-interpolation-limited','boundary-unresolved','numerical-regularization'].includes(x.closureFilter))state.closureFilter=x.closureFilter;
  for(const key of ['contactTrim','medialReview','fasciaNote'])if(typeof x[key]==='boolean')state[key]=x[key];
  if(['v26','v25'].includes(x.inferiorVersion))state.inferiorVersion=x.inferiorVersion;
  if (['joint','sagittal','coronal','disc'].includes(x.view)) state.view=x.view;
  if (['none','both','superior','inferior'].includes(x.space)) state.space=x.space;
  if (['none','all','anterior','posterior','lateral','medial'].includes(x.anchor)) state.anchor=x.anchor;
  if (typeof x.contact==='boolean') state.contact=x.contact;
  for (const [key,lo,hi] of [['section',-20,20],['azimuth',-180,180],['elevation',-80,80],['scale',.015,80]]) {
    if (Number.isFinite(x[key])) state[key]=Math.min(hi,Math.max(lo,x[key]));
  }
  for (const layer of Object.keys(state.layers)) if (typeof x.layers?.[layer]==='boolean') state.layers[layer]=x.layers[layer];
}
normalize(window.openai?.widgetState);
function save() {
  if (window.openai?.setWidgetState) window.openai.setWidgetState({modelContent:{view:state.view,section_mm:state.section,anatomy_basis:'Sagl-derived bones and locally corrected disc; reference-informed estimated soft tissues'},privateContent:{anatomyV18:structuredClone(state)}}).catch(()=>{});
}
let loadStage = '3D library';
function loading(stage) {
  loadStage = stage;
  root.dataset.viewerState = 'loading';
  q('.geometry-caption').textContent = `Loading ${stage}…`;
}
async function loadGeometry(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(45000)});
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('json')) {
    throw Error(`${url}: expected JSON. Reload the Site after signing in.`);
  }
  const result = await response.json();
  if (!Array.isArray(result.parts) || !result.parts.length) throw Error(`${url}: no geometry parts`);
  return result;
}
try {
  loading('3D library');
  const THREE = await import('./vendor/three-0.170.0.module.min.js');
  loading('anatomy and joint spaces');
  // HTTP content decoding belongs to the browser; never decompress a response twice.
  const [data, spaceData, cutData] = await Promise.all([
    loadGeometry('./tmj-anatomy-v21.json'), loadGeometry('./joint-spaces-v26.json'), loadGeometry('./cutaway-contours-v26.json')
  ]);
  loading('WebGL renderer');
  const canvases = [q('.joint-canvas'),q('.head-canvas')];
  const renderers = canvases.map(canvas=>new THREE.WebGLRenderer({canvas,alpha:true,antialias:true}));
  renderers.forEach(r=>{r.setPixelRatio(Math.min(devicePixelRatio,2));r.localClippingEnabled=true;});
  const scenes = [new THREE.Scene(),new THREE.Scene()];
  const cameras = [new THREE.OrthographicCamera(),new THREE.OrthographicCamera()];
  cameras.forEach(c=>{c.near=.1;c.far=2000;c.up.set(0,0,1);});
  scenes.forEach(scene=>{
    scene.add(new THREE.AmbientLight(0xffffff,1.7));
    const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(70,40,90);scene.add(light);
    const fill=new THREE.DirectionalLight(0xffffff,.8);fill.position.set(-60,-30,-20);scene.add(fill);
  });
  const clip = new THREE.Plane(new THREE.Vector3(-1,0,0),0);
  const materials={};
  const meshes=[];
  const sections = new THREE.Group(); scenes[0].add(sections);
  const review=JSON.parse(q('#tmj-v9-review-data').textContent),anchorMeshes=[];
  const contactGeometry=new THREE.BufferGeometry();contactGeometry.setAttribute('position',new THREE.Float32BufferAttribute(review.contact.positions,3));
  const contactMesh=new THREE.Mesh(contactGeometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));contactMesh.renderOrder=4;scenes[0].add(contactMesh);
  for(const anchor of review.anchors){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.45,16,12),new THREE.MeshBasicMaterial({depthTest:false}));
    mesh.position.fromArray(anchor.position);mesh.userData=anchor;mesh.renderOrder=15;scenes[0].add(mesh);anchorMeshes.push(mesh);
  }
  loading('joint-space surfaces');
  const closureReview=JSON.parse(q('#closure-review-v24').textContent);
  const closureKeys=['sampling-supported','contact-or-interpolation-limited','boundary-unresolved','numerical-regularization'];
  const closureColors=['#139b81','#bd7b1e','#bb4c93','#4275cd'];
  const closureLabels={'sampling-supported':'Sampling candidate: 15 supported rays and 16 crossing-free subprisms; unfilled','contact-or-interpolation-limited':'Contact/interpolation guard: rejected local samples or crossing subprisms; not proof of a physiological seal','boundary-unresolved':'Unresolved boundary: no supported enclosing hit or unclassified open perimeter; fascia footprint not assigned','numerical-regularization':'Known numerical corner cutback from r23; not a biological gap'};
  const spaceMeshes={},spaceRims={};
  for(const part of spaceData.parts){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.p,3));geometry.setIndex(part.i);geometry.computeVertexNormals();
    // Closing faces are visibly provisional, independently of the coloured boundary surfaces.
    const faceGroup=i=>part.faceRecoveredV26?.[i]?8:part.faceBoundaries[i]==='closure'?(part.faceClosureClass?.[i]?4+closureKeys.indexOf(part.faceClosureClass[i]):1):part.faceContactTrim?.[i]?2:0;
    let begin=0,group=faceGroup(0);
    for(let i=1;i<=part.faceBoundaries.length;i++){
      const next=i<part.faceBoundaries.length?faceGroup(i):-1;
      if(next!==group){geometry.addGroup(begin*3,(i-begin)*3,group);begin=i;group=next;}
    }
    const color=part.name==='superior'?'#008ba4':'#e17814';
    const material=new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0,flatShading:true,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false});
    const closure=new THREE.MeshStandardMaterial({color:'#b49b65',roughness:1,flatShading:true,side:THREE.DoubleSide,transparent:true,opacity:.18,depthWrite:false});
    const recovery=material.clone();recovery.color.set('#24a885');const medial=closure.clone();medial.color.set('#b94097');
    const evidenceMaterials=closureColors.map(color=>{const m=closure.clone();m.color.set(color);return m;});
    const recoveredC04=material.clone();recoveredC04.color.set('#008fbd');
    const mesh=new THREE.Mesh(geometry,[material,closure,recovery,medial,...evidenceMaterials,recoveredC04]);mesh.userData=part;mesh.renderOrder=7;scenes[0].add(mesh);spaceMeshes[part.name]=mesh;
    const rimGeometry=new THREE.BufferGeometry();rimGeometry.setAttribute('position',new THREE.Float32BufferAttribute(part.rim,3));
    const rim=new THREE.LineSegments(rimGeometry,new THREE.LineBasicMaterial({color:'#92723c',transparent:true,opacity:.72,depthWrite:false}));rim.renderOrder=8;scenes[0].add(rim);spaceRims[part.name]=rim;
  }
  const guideMaterials=[];
  // Screen-space annotation width: no anatomical membrane thickness is added.
  function makeGuide(path,color,width=2.5) {
    const starts=[],ends=[],corners=[],distances=[];let distance=0;
    const paths=Array.isArray(path)?path:[path];for(const path of paths){distance=0;
    for(let i=1;i<path.p.length;i++){
      const a=path.p[i-1],b=path.p[i],length=Math.hypot(...b.map((x,k)=>x-a[k]));if(length<1e-8)continue;
      for(const [along,side] of [[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]]){
        starts.push(...a);ends.push(...b);corners.push(along,side);distances.push(distance+along*length);
      }distance+=length;
    }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(starts,3));g.setAttribute('end',new THREE.Float32BufferAttribute(ends,3));g.setAttribute('corner',new THREE.Float32BufferAttribute(corners,2));g.setAttribute('along',new THREE.Float32BufferAttribute(distances,1));
    const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,uniforms:{resolution:{value:new THREE.Vector2(1,1)},width:{value:width},color:{value:new THREE.Color(color)}},vertexShader:`attribute vec3 end;attribute vec2 corner;attribute float along;uniform vec2 resolution;uniform float width;varying float distanceAlong;void main(){vec4 a=projectionMatrix*modelViewMatrix*vec4(position,1.0);vec4 b=projectionMatrix*modelViewMatrix*vec4(end,1.0);vec2 d=(b.xy/b.w-a.xy/a.w)*resolution;float len=max(length(d),0.00001);vec2 normal=vec2(-d.y,d.x)/len;vec4 p=mix(a,b,corner.x);p.xy+=normal*corner.y*width/resolution*p.w;gl_Position=p;distanceAlong=along;}`,fragmentShader:`uniform vec3 color;varying float distanceAlong;void main(){if(mod(distanceAlong,0.24)>0.145)discard;gl_FragColor=vec4(color,1.0);
      #include <colorspace_fragment>
    }`});guideMaterials.push(material);
    const mesh=new THREE.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=14;return mesh;
  }
  const cutGroups={};
  const cutColors={disc:'#bd6555',condyle:'#dad6cc','capsule-inferior':'#16887e','medial-discal-attachment':'#8f54ac','lateral-discal-attachment':'#8f54ac','retrodiscal-condylar-lamina':'#577bba','retrodiscal-loose-tissue':'#c77b99',inferior:'#d76d08'};
  for(const cut of cutData.parts){
    const group=new THREE.Group();scenes[0].add(group);cutGroups[cut.id+":"+cut.spaceVersion]=group;
    for(const [name,part] of Object.entries(cut.caps)){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.p,3));geometry.setIndex(part.i);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:cutColors[name],side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));mesh.userData.cutLayer=name;group.add(mesh);
    }
    for(const [name,paths] of Object.entries(cut.parts)){
      const segments=[];for(const path of paths)for(let i=1;i<path.p.length;i++)segments.push(...path.p[i-1],...path.p[i]);
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));
      const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:cutColors[name],depthTest:false,transparent:true,opacity:1}));line.renderOrder=12;line.userData.cutLayer=name;group.add(line);
    }
    for(const [name,paths] of Object.entries(cut.seamEdges||{}))for(const path of paths){const edge=makeGuide(path,'#168254',3);edge.renderOrder=15;edge.userData.cutLayer=name;edge.userData.seam=true;group.add(edge);}
    for(const [name,paths] of Object.entries(cut.insertionRims||{})){const edge=makeGuide(paths,'#008d9c',2);edge.material.depthTest=true;edge.material.polygonOffset=true;edge.material.polygonOffsetFactor=-1;edge.material.polygonOffsetUnits=-1;edge.renderOrder=15;edge.userData.cutLayer=name;edge.userData.insertion=true;group.add(edge);}
    for(const [kind,color] of [['contactTrim',cut.spaceVersion==='v26'?'#24a885':'#c88a28'],['medialReview','#b94097']]){const guide=makeGuide(cut[kind]||[],color,3);guide.userData.cutLayer='inferior';guide.userData.reviewKind=kind;group.add(guide);}
    for(const [kind,paths] of Object.entries(cut.closureClasses||{})){const guide=makeGuide(paths,closureColors[closureKeys.indexOf(kind)],4);guide.userData.cutLayer='inferior';guide.userData.closureClass=kind;group.add(guide);}
    if(cut.spaceVersion==='v26'){const guide=makeGuide(cut.recovered||[],'#008fbd',3);guide.userData.cutLayer='inferior';guide.userData.reviewKind='contactTrim';group.add(guide);}
    if(cut.patchId){const guide=makeGuide(cut.selectedPatch||[],'#223e49',1.2);guide.userData.cutLayer='inferior';group.add(guide);}
    for(const [name,paths] of Object.entries(cut.reflection||{}))for(const path of paths){
      const line=makeGuide(path,'#166bd3');line.userData.cutLayer=name;line.userData.reflection=true;group.add(line);
    }
  }
  function selectedCut(){return cutData.parts.find(c=>c.id===state.cutaway&&c.spaceVersion===state.inferiorVersion);}
  function reverseCut(){return activeCutaway()&&selectedCut()?.retained==='positive';}
  function activeCutaway(){const cut=cutData.parts.find(c=>c.id===state.cutaway&&c.spaceVersion===state.inferiorVersion);return !!cut&&state.space==='inferior'&&state.mode==='reconstructed'&&['v26','v25'].includes(state.inferiorVersion)&&state.spaceContext==='cutaway'&&state.view===(cut.axis===0?'sagittal':'coronal')&&Math.abs(state.section-cut.position)<1e-6;}
  function exitCutaway(){state.cutaway='none';if(state.closeup)state.scale=28;state.closeup=false;if(state.spaceContext==='cutaway')state.spaceContext='boundaries';}
  function setCutaway(name){let preset={anterior:['sagittal',0,0,8,24],medial:['coronal',1.25,90,8,28],anteromedial:['sagittal',-6,10,8,24],patch:['sagittal',1.25,0,8,24],posteromedial:['sagittal',-9.5,180,4,18],posterior:['coronal',-3.6,-90,4,18],'extreme-medial':['sagittal',-9.7,180,4,18]}[name];const detail=cutData.parts.find(c=>c.id===name&&c.spaceVersion===state.inferiorVersion);if(detail?.patchId)preset=['sagittal',detail.position,180,0,detail.detailScale];if(detail?.contactId)preset=['sagittal',detail.position,180,0,3];if(!preset)return;[state.view,state.section,state.azimuth,state.elevation,state.scale]=preset;Object.assign(state,{cutaway:name,closeup:false,mode:'reconstructed',inferiorVersion:['v26','v25'].includes(state.inferiorVersion)?state.inferiorVersion:'v26',space:'inferior',spaceContext:'cutaway',spaceOpacity:.25,spaceRims:true,anchor:'none',contact:false,ghost:false});Object.assign(state.layers,{temporal:false,disc:true,condyle:true,capsule:true,retroUpper:false,retroLower:true,retroCore:false});}
  const boundaryNames={temporal:'temporal articular surface',condyle:'condylar articular surface',disc:'disc',
    'capsule-superior':'superior capsular sheet','capsule-inferior':'inferior anterior capsular sheet',
    'medial-superior-continuity':'estimated medial continuity','lateral-discal-attachment':'lateral discal attachment','medial-discal-attachment':'medial discal attachment',
    'retrodiscal-temporal-lamina':'temporal retrodiscal lamina','retrodiscal-condylar-lamina':'condylar retrodiscal lamina',closure:'provisional closing wall — not a segmented anatomical boundary'};
  function boundaryDescription(part,face){if(part.faceRecoveredV26?.[face])return 'C04 partially recovered twelfth cell · '+(part.faceBoundaries[face]==='closure'?'new computational side wall; not synovial tissue':part.faceBoundaries[face]+'-bounded surface')+' · anatomy unchanged';if(part.faceClosurePatch?.[face])return `${part.faceClosurePatch[face]} · ${closureLabels[part.faceClosureClass[face]]} · no anatomical acceptance`;return (part.faceContactTrim?.[face]?'Contact-cell surface · ':'')+part.faceBoundaries[face].split('|').map(n=>boundaryNames[n]||n).join(' / ');}
  function spaceVisible(name){const compartment=name==='superior'?'superior':'inferior';return state.mode==='reconstructed'&&state.view!=='disc'&&(state.space==='both'||state.space===compartment)&&(compartment==='superior'||name===(state.inferiorVersion==='v25'?'inferior-v25':'inferior'));}
  const spaceBoundaryParts={superior:['temporal','disc','capsule-superior','medial-superior-continuity','retrodiscal-temporal-lamina'],inferior:['condyle','disc','capsule-inferior','lateral-discal-attachment','medial-discal-attachment','retrodiscal-condylar-lamina']};
  function boundaryRelevant(name){return (state.space==='both'?['superior','inferior']:[state.space]).some(n=>spaceBoundaryParts[n]?.includes(name));}
  const probe=document.createElement('span');probe.style.display='none';root.append(probe);
  function themeColor(variable) {
    probe.style.color=`var(${variable})`;
    return new THREE.Color(getComputedStyle(probe).color);
  }
  for(const layer of Object.keys(state.layers)) materials[layer]=new THREE.MeshStandardMaterial({roughness:.85,metalness:0,side:THREE.DoubleSide});
  for(const part of data.parts){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.p,3));
    geometry.setIndex(part.i);geometry.computeVertexNormals();geometry.computeBoundingBox();
    const material=materials[part.layer].clone();
    if(!part.head) material.clippingPlanes=[clip];
    const mesh=new THREE.Mesh(geometry,material);mesh.userData=part;
    scenes[part.head?1:0].add(mesh);meshes.push(mesh);
    if(part.name==='disc'||part.name==='disc-original') {
      const contextDisc=new THREE.Mesh(geometry,materials.disc.clone());
      contextDisc.userData={...part,name:part.name+'-context',head:true};scenes[1].add(contextDisc);meshes.push(contextDisc);
    }
  }
  const contextBox=new THREE.Box3();
  meshes.filter(m=>m.userData.head).forEach(m=>contextBox.union(m.geometry.boundingBox));
  const headTarget=contextBox.getCenter(new THREE.Vector3());
  const headSize=contextBox.getSize(new THREE.Vector3());
  const headSpan=Math.max(headSize.x,headSize.y,headSize.z)*1.35;
  const marker=new THREE.Mesh(new THREE.SphereGeometry(3,16,12),new THREE.MeshBasicMaterial({depthTest:false,transparent:true,opacity:.85}));
  marker.renderOrder=10;scenes[1].add(marker);
  const target=new THREE.Vector3(0,0,-4);
  const colors={};
  function updateTheme() {
    colors.temporal=themeColor('--muted-foreground');
    colors.disc=themeColor('--viz-series-1');
    colors.condyle=themeColor('--viz-series-2');
    colors.capsule=themeColor('--viz-series-3');colors.retroUpper=themeColor('--viz-series-4');
    colors.retroLower=themeColor('--viz-series-5');colors.retroCore=themeColor('--viz-series-6');
    for(const mesh of meshes) {
      const color=colors[mesh.userData.layer].clone();
      if(mesh.userData.head && mesh.userData.layer!=='disc') color.copy(colors.temporal);
      if(mesh.userData.name.includes('discal-attachment'))color.set('#763a94');
      mesh.material.color.copy(color);
    }
    marker.material.color.copy(colors.disc);
    contactMesh.material.color.copy(themeColor('--viz-series-6'));
    anchorMeshes.forEach(mesh=>mesh.material.color.copy(themeColor('--viz-series-5')));
  }
  function makeSections() {
    while(sections.children.length) {const line=sections.children[0];sections.remove(line);line.geometry.dispose();line.material.dispose();}
    if(activeCutaway()||!['sagittal','coronal'].includes(state.view)) return;
    const axis=state.view==='sagittal'?0:1;
    for(const mesh of meshes.filter(m=>!m.userData.head && m.visible)) {
      const p=mesh.userData.p,indices=mesh.userData.i,segments=[];
      for(let k=0;k<indices.length;k+=3) {
        const hits=[];
        for(let edge=0;edge<3;edge++) {
          const ai=indices[k+edge]*3,bi=indices[k+(edge+1)%3]*3;
          const a=p[ai+axis]-state.section,b=p[bi+axis]-state.section;
          if((a<0 && b>=0)||(b<0 && a>=0)) {
            const t=a/(a-b);const hit=[0,1,2].map(j=>p[ai+j]+t*(p[bi+j]-p[ai+j]));
            if(!hits.some(h=>h.every((v,j)=>Math.abs(v-hit[j])<1e-7)))hits.push(hit);
          }
        }
        if(hits.length===2)segments.push(...hits[0],...hits[1]);
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));
      const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:mesh.material.color,depthTest:false}));
      line.renderOrder=5;sections.add(line);
    }
  }
  function syncUI() {
    qa('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
    qa('[data-layer]').forEach(input=>{input.checked=state.layers[input.dataset.layer];input.disabled=state.view==='disc'||(state.mode==='original'&&!['temporal','disc','condyle'].includes(input.dataset.layer));});
    for(const key of ['section','azimuth','elevation','scale']) q(`#tmj-v7-${key}`).value=state[key];
    q('#tmj-v7-section-value').textContent=`${state.section.toFixed(2)} mm`;
    q('#tmj-v7-azimuth-value').textContent=`${Math.round(state.azimuth)}°`;
    q('#tmj-v7-elevation-value').textContent=`${Math.round(state.elevation)}°`;
    q('#tmj-v7-scale').min=activeCutaway()&&selectedCut()?.contactId?.015:1;q('#tmj-v7-scale').step=activeCutaway()&&selectedCut()?.contactId?.005:1;
    q('#tmj-v7-scale-value').textContent=`${state.scale<1?state.scale.toFixed(3):Math.round(state.scale)} mm`;
    q('#tmj-v24-patch').value=activeCutaway()&&selectedCut()?.patchId?state.cutaway:'';q('#tmj-v24-filter').value=state.closureFilter;
    const patch=closureReview.parts.find(p=>p.id===selectedCut()?.patchId);
    q('#tmj-v24-patch-status').textContent=patch?.id==='C04'?(state.inferiorVersion==='v26'?'C04 after · twelfth cell partially recovered; tiny corner excluded. Four-face contact resolved. 12 guard-limited neighbors remain excluded. Cyan is this step only.':'C04 before · r25 preserves 11 recovered cells and excludes the entire twelfth cell. Same plane and camera as After.') : patch?`${patch.id} · unchanged from r25 · ${patch.faces} baseline closure faces · ${patch.area_mm2.toFixed(4)} mm². `+Object.entries(patch.categories).map(([k,n])=>`${n} ${k}`).join('; ')+(patch.medial_review_sector_faces?' · Fascia footprint remains unsegmented.':''):'Select a baseline patch ID. Only C04 changes in r26.';
    q('#tmj-v23-contact').value=activeCutaway()&&selectedCut()?.contactId?state.cutaway:'';q('#tmj-v23-fascia').checked=state.fasciaNote;q('#tmj-v23-fascia-note').hidden=!(state.fasciaNote&&activeCutaway()&&(['medial','anteromedial','posteromedial','extreme-medial'].includes(state.cutaway)||!!patch?.medial_review_sector_faces));
    q('.section-control').hidden=!['sagittal','coronal'].includes(state.view);
    q('#tmj-v24-section-link').href=`sections.html?${state.view==='sagittal'?'s':'c'}=${state.section}&space=${state.space==='none'?'both':state.space}`;
    q('#tmj-v8-space').value=state.space;
    q('#tmj-v10-mode').value=state.mode;q('#tmj-v10-ghost').checked=state.ghost;
    q('#tmj-v9-contact').disabled=state.mode!=='original';
    q('#tmj-v8-gap-status').textContent=state.mode==='original'?'Space volumes are hidden in Original mode: they belong to the corrected anatomy.':state.space==='none'?'Space volumes hidden.':'CYAN = superior · ORANGE = inferior. The coloured shapes occupy the modeled gaps; anatomy is not separated or enlarged.';
    q('#tmj-v15-version').value=state.inferiorVersion;q('#tmj-v15-version').disabled=false;
    q('#tmj-v18-closeup').disabled=!activeCutaway();q('#tmj-v18-closeup').textContent=state.closeup&&activeCutaway()?'Whole cutaway':'Zoom to recess';q('#tmj-v18-closeup').setAttribute('aria-pressed',String(state.closeup&&activeCutaway()));q('#tmj-v18-emphasis').checked=state.seamEmphasis;q('#tmj-v18-reflection').checked=state.reflection;q('#tmj-v18-reflection').disabled=!activeCutaway();
    qa('[data-cutaway]').forEach(b=>b.setAttribute('aria-pressed',String(activeCutaway()&&b.dataset.cutaway===state.cutaway)));
    q('#tmj-v18-cut-status').textContent=activeCutaway()?`${state.view==='sagittal'?'Sagittal X':'Coronal Y'} = ${state.section.toFixed(2)} mm · ${reverseCut()?(state.view==='sagittal'?'lateral':'anterior'):(state.view==='sagittal'?'medial':'posterior')} side retained. Orange cavity is translucent. Coloured contours mark the cut plane; closure colors describe numerical evidence, not segmented capsule.`:'Choose a cutaway to expose the disc–condyle gap and peripheral attachments.';
    for(const [id,key] of [['#tmj-v22-recovered','contactTrim'],['#tmj-v22-medial','medialReview']])q(id).checked=state[key];
    q('#tmj-v21-insertion').checked=state.insertionRims;q('#tmj-v21-insertion').disabled=!activeCutaway();
    q('#tmj-v20-core').checked=state.layers.retroCore;q('#tmj-v20-core').disabled=!activeCutaway();q('#tmj-v19-seams').checked=state.seamEdges;q('#tmj-v19-seams').disabled=!activeCutaway()||!selectedCut()?.seamEdges;
    q('#tmj-v13-context').value=state.spaceContext;q('#tmj-v13-opacity').value=state.spaceOpacity;q('#tmj-v13-rims').checked=state.spaceRims;
    qa('[data-space-focus]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spaceFocus===state.space)));
    const boundaryText=state.space==='superior'?'Temporal surface above; disc below; superior capsular and temporal laminar boundaries around the edge.':state.space==='inferior'?'Disc above; condyle below and centrally; anterior disc-to-condyle reflection, medial discal attachment and posterior condylar lamina around the periphery. Exact recess dimensions remain estimated.':'The disc separates the two spaces. The capsule and posterior attachments form their peripheral boundaries.';
    q('#tmj-v13-boundary-status').textContent=activeCutaway()?(state.inferiorVersion==='v26'?'After: the twelfth C04 cell is partially recovered with a local numerical corner cutback. Disc and capsule unchanged. Fascia remains unresolved; no fluid distension.':'Before: r25 with the entire twelfth cell excluded. Section, camera, disc, capsule and bone are matched to After.'):state.spaceContext==='isolated'?'Space alone: surrounding tissue is hidden. '+boundaryText:boundaryText;
    qa('[data-layer]').forEach(input=>{if(state.mode==='reconstructed'&&state.spaceContext==='isolated'&&state.space!=='none')input.disabled=true;});

    const captions={joint:'Right joint · lateral crop',sagittal:'Sagittal section · medial side retained',coronal:'Coronal section · posterior side retained',disc:'Right disc · '+state.mode};
    q('.geometry-caption').textContent=(activeCutaway()?(['posteromedial','extreme-medial'].includes(state.cutaway)?'Medial view · exposed tissue transition':state.cutaway==='posterior'?'Posterior view · attachment transition':captions[state.view]):captions[state.view])+' · '+(state.mode==='original'?'original':state.inferiorVersion!=='v26'?'before · r25 excluded cell':activeCutaway()?'after · r26 corner repair':'current peripheral envelope');
    if(activeCutaway()&&selectedCut()?.patchId)q('.geometry-caption').textContent=`${selectedCut().contactRepair?'C04 corner':selectedCut().patchId} · ${state.inferiorVersion==='v26'?'after · r26':'before · r25'} · ${selectedCut().patchId==='C04'?'matched plane · cyan = recovered surface':'unchanged boundary'}`;
    if(activeCutaway()&&selectedCut()?.contactId)q('.geometry-caption').textContent=`Contact ${selectedCut().contactId} · magnified ${state.scale.toFixed(3)} mm field · ${state.inferiorVersion==='v26'?'after':'before'}`;
    q('#tmj-v9-anchor').value=state.anchor;q('#tmj-v9-contact').checked=state.contact;
    const selected=review.anchors.find(a=>a.id===state.anchor);
    const anchorText=selected?`${selected.number} · ${selected.description}`:state.anchor==='all'?'1 anterior mandibular · 2 posterior temporal · 3 lateral mandibular · 4 medial mandibular. Bone-side mechanical anchors; markers visible through surfaces.':'Anchors describe the source mechanical model; they are not reconstructed capsule or retrodiscal surfaces.';
    q('#tmj-v9-review-status').textContent=anchorText+(state.contact&&state.mode==='original'?' Highlight: 230 original intersecting disc faces; not a stress or depth map.':'');
  }
  function applyGeometry() {
    q('#tmj-v13-picked').textContent='Tap a coloured surface to identify the tissue boundary it follows.';
    const sliced=['sagittal','coronal'].includes(state.view);
    clip.normal.set(state.view==='sagittal'?-1:0,state.view==='coronal'?-1:0,0);clip.constant=state.section;if(reverseCut()){clip.normal.negate();clip.constant=-state.section;}
    for(const mesh of meshes) {
      const part=mesh.userData;
      const modeVisible=(!part.mode||part.mode===state.mode)&&(!part.inferred||state.mode==='reconstructed')&&(!part.anatomyVariant||part.anatomyVariant===state.inferiorVersion);
      mesh.visible=modeVisible&&(part.head || (state.view==='disc'?part.layer==='disc':state.layers[part.layer]));
      if(!part.head&&state.space!=='none'&&state.mode==='reconstructed'&&state.view!=='disc'){
        if(state.spaceContext==='isolated')mesh.visible=false;
        else if(state.spaceContext==='boundaries')mesh.visible=mesh.visible&&boundaryRelevant(part.name);
      }
      if(!part.head){mesh.material.clippingPlanes=sliced?[clip]:[];const ghost=(state.ghost||state.anchor!=='none')&&state.view!=='disc'&&['temporal','condyle'].includes(part.layer);const core=part.layer==='retroCore';mesh.material.transparent=ghost||core;mesh.material.opacity=ghost?.18:core?.32:1;mesh.material.depthWrite=!(ghost||core);mesh.material.polygonOffset=core;mesh.material.polygonOffsetFactor=1;mesh.material.polygonOffsetUnits=1;mesh.material.needsUpdate=true;}
    }
    if(state.space!=='none'&&state.mode==='reconstructed'&&state.spaceContext==='boundaries'&&state.view!=='disc')for(const mesh of meshes.filter(m=>!m.userData.head)){
      mesh.material.transparent=true;mesh.material.opacity=mesh.userData.layer==='capsule'?.32:mesh.userData.layer==='disc'?.18:.12;mesh.material.depthWrite=false;
    }
    if(activeCutaway())for(const mesh of meshes.filter(m=>!m.userData.head)){
      mesh.visible=mesh.visible&&(boundaryRelevant(mesh.userData.name)||mesh.userData.layer==='retroCore');const core=mesh.userData.layer==='retroCore';mesh.material.opacity=core?.32:1;mesh.material.transparent=core;mesh.material.depthWrite=!core;
      if(cutColors[mesh.userData.name])mesh.material.color.set(cutColors[mesh.userData.name]);
    }
    for(const [id,group] of Object.entries(cutGroups)){group.visible=activeCutaway()&&id===state.cutaway+':'+state.inferiorVersion;for(const item of group.children){const layer=item.userData.cutLayer;item.visible=(layer==='inferior'||state.layers[layer==='disc'||layer==='condyle'?layer:layer==='retrodiscal-condylar-lamina'?'retroLower':layer==='retrodiscal-loose-tissue'?'retroCore':'capsule'])&&(!item.userData.reflection||state.reflection)&&(!item.userData.seam||state.seamEdges)&&(!item.userData.insertion||state.insertionRims)&&(!item.userData.reviewKind||state[item.userData.reviewKind])&&(!item.userData.closureClass||state.closureFilter==='all'||state.closureFilter===item.userData.closureClass);}}
    for(const [name,mesh] of Object.entries(spaceMeshes)){
      mesh.visible=spaceVisible(name);
      mesh.material.forEach((m,i)=>{const closing=i===1||i===3||(i>=4&&i<=7);m.opacity=closing?(state.spaceRims?(i>=4?(state.closureFilter==='all'||state.closureFilter===closureKeys[i-4]? .82:.035):.45):0):state.spaceOpacity;if(i===1||i===3)m.color.set('#b49b65');if(i===2)m.color.set(state.contactTrim?'#24a885':'#e17814');if(i===8){m.color.set(state.contactTrim?'#008fbd':'#e17814');m.opacity=state.contactTrim ? .85 : state.spaceOpacity;}m.clippingPlanes=sliced?[clip]:[];m.needsUpdate=true;});
      const rim=spaceRims[name];rim.visible=mesh.visible&&state.spaceRims;rim.material.opacity=state.seamEmphasis?1:.72;rim.material.clippingPlanes=sliced?[clip]:[];rim.material.needsUpdate=true;
    }

    contactMesh.visible=state.mode==='original'&&state.contact&&(state.view==='disc'||state.layers.disc);contactMesh.material.clippingPlanes=sliced?[clip]:[];contactMesh.material.needsUpdate=true;
    for(const mesh of anchorMeshes){mesh.visible=state.view!=='disc'&&(state.anchor==='all'||state.anchor===mesh.userData.id);mesh.material.clippingPlanes=sliced?[clip]:[];mesh.material.needsUpdate=true;}
    makeSections();syncUI();draw();
  }
  function draw() {
    target.set(...(activeCutaway()&&selectedCut()?.target?selectedCut().target:state.closeup&&activeCutaway()?({anterior:[0,4,-3],medial:[-7,1.25,-3],anteromedial:[-6,2.5,-3.5],patch:[1.25,3.5,-4.5],posteromedial:[-9.5,-3.56,-3.15],posterior:[-8.8,-3.6,-3.15],'extreme-medial':[-9.7,-2.4,-2.6]}[state.cutaway]):[0,0,-4]));
    const az=state.azimuth*Math.PI/180,el=state.elevation*Math.PI/180;
    const direction=new THREE.Vector3(Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el));
    cameras[0].position.copy(target).addScaledVector(direction,130);cameras[0].lookAt(target);cameras[0].updateMatrixWorld();
    cameras[1].position.copy(headTarget).addScaledVector(direction,500);cameras[1].lookAt(headTarget);
    guideMaterials.forEach(m=>m.uniforms.resolution.value.set(canvases[0].clientWidth,canvases[0].clientHeight));
    renderers.forEach((renderer,index)=>{
      const canvas=canvases[index],width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height)return;
      const camera=cameras[index],span=index?headSpan:state.scale,aspect=width/height;
      const vertical=index?Math.max(span,span/aspect):span;
      camera.top=vertical/2;camera.bottom=-vertical/2;camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;
      camera.updateProjectionMatrix();renderer.setSize(width,height,false);renderer.render(scenes[index],camera);
    });
    for(const mesh of anchorMeshes){
      const label=q(`[data-anchor-label="${mesh.userData.id}"]`),p=mesh.position.clone().project(cameras[0]);
      const cut=['sagittal','coronal'].includes(state.view)&&clip.distanceToPoint(mesh.position)<0;
      label.hidden=!mesh.visible||cut||Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1;
      label.style.left=`${(p.x+1)*canvases[0].clientWidth/2}px`;label.style.top=`${(1-p.y)*canvases[0].clientHeight/2}px`;
    }
    const inverse=cameras[0].quaternion.clone().invert();
    for(const [key,vec] of [['x',new THREE.Vector3(1,0,0)],['y',new THREE.Vector3(0,1,0)],['z',new THREE.Vector3(0,0,1)]]) {
      vec.applyQuaternion(inverse);
      const g=q(`[data-axis="${key}"]`),line=g.querySelector('line'),label=g.querySelector('text');
      line.setAttribute('x2',54+vec.x*32);line.setAttribute('y2',57-vec.y*32);
      label.setAttribute('x',54+vec.x*45);label.setAttribute('y',57-vec.y*45);
      g.style.opacity=String(.55+.45*(vec.z+1)/2);
    }
  }
  qa('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    exitCutaway();state.view=button.dataset.view;state.section=0;
    const preset={joint:[35,25,56],sagittal:[0,0,50],coronal:[90,0,50],disc:[35,48,28]}[state.view];
    [state.azimuth,state.elevation,state.scale]=preset;applyGeometry();save();
  }));
  qa('[data-layer]').forEach(input=>input.addEventListener('change',()=>{state.layers[input.dataset.layer]=input.checked;applyGeometry();save();}));
  q('#tmj-v10-mode').addEventListener('change',e=>{exitCutaway();state.mode=e.target.value;applyGeometry();save();});
  q('#tmj-v10-ghost').addEventListener('change',e=>{state.ghost=e.target.checked;applyGeometry();save();});
  q('#tmj-v10-posterior').addEventListener('click',()=>{Object.assign(state,{view:'joint',mode:'reconstructed',ghost:true,anchor:'none',contact:false,space:'none',azimuth:-35,elevation:18,scale:34});Object.assign(state.layers,{disc:true,temporal:true,condyle:true,capsule:false,retroUpper:true,retroLower:true,retroCore:true});applyGeometry();save();});
  q('#tmj-v8-space').addEventListener('change',event=>{state.space=event.target.value;applyGeometry();save();});
  q('#tmj-v9-anchor').addEventListener('change',event=>{state.anchor=event.target.value;if(state.anchor!=='none'){state.view='joint';state.section=0;state.azimuth=35;state.elevation=20;state.scale=42;state.space='none';}applyGeometry();save();});
  q('#tmj-v9-contact').addEventListener('change',event=>{state.contact=event.target.checked;applyGeometry();save();});
  q('#tmj-v9-underside').addEventListener('click',()=>{state.view='disc';state.mode='original';state.contact=true;state.anchor='none';state.space='none';state.azimuth=0;state.elevation=-65;state.scale=28;applyGeometry();save();});
  for(const key of ['section','azimuth','elevation','scale']) {
    const input=q(`#tmj-v7-${key}`);
    input.addEventListener('input',()=>{state[key]=Number(input.value);if(key==='section'){exitCutaway();applyGeometry();}else{syncUI();draw();}});
    input.addEventListener('change',save);
  }
  function focusSpace(name){exitCutaway();Object.assign(state,{space:name,mode:'reconstructed',view:'joint',anchor:'none',contact:false,section:0,azimuth:35,elevation:28,scale:34});applyGeometry();save();}
  qa('[data-space-focus]').forEach(b=>b.addEventListener('click',()=>focusSpace(b.dataset.spaceFocus)));
  qa('[data-space-pose]').forEach(b=>b.addEventListener('click',()=>{exitCutaway();[state.azimuth,state.elevation]=({above:[35,65],below:[35,-55],lateral:[0,0]})[b.dataset.spacePose];state.view='joint';applyGeometry();save();}));
  q('#tmj-v13-context').addEventListener('change',e=>{if(e.target.value==='cutaway')setCutaway('medial');else{exitCutaway();state.spaceContext=e.target.value;}applyGeometry();save();});
  q('#tmj-v13-opacity').addEventListener('input',e=>{state.spaceOpacity=Number(e.target.value);applyGeometry();});
  q('#tmj-v13-opacity').addEventListener('change',save);
  q('#tmj-v13-rims').addEventListener('change',e=>{state.spaceRims=e.target.checked;applyGeometry();save();});
  function setRecess(name){exitCutaway();const pose={anterior:[90,12],medial:[180,12],posterior:[-90,12]}[name];if(!pose)return;Object.assign(state,{space:'inferior',view:'joint',mode:'reconstructed',anchor:'none',contact:false,section:0,azimuth:pose[0],elevation:pose[1],scale:28});for(const key of Object.keys(state.layers))state.layers[key]=true;}
  qa('[data-recess]').forEach(b=>b.addEventListener('click',()=>{setRecess(b.dataset.recess);applyGeometry();save();}));
  q('#tmj-v15-version').addEventListener('change',e=>{if(!activeCutaway()||!['v26','v25'].includes(e.target.value))exitCutaway();state.inferiorVersion=e.target.value;q('#tmj-v13-picked').textContent='Tap a coloured surface to identify its boundary.';applyGeometry();save();});
  qa('[data-cutaway]').forEach(b=>b.addEventListener('click',()=>{setCutaway(b.dataset.cutaway);applyGeometry();save();}));
  q('#tmj-v18-closeup').addEventListener('click',()=>{if(!activeCutaway())return;state.closeup=!state.closeup;state.scale=state.closeup?(selectedCut()?.detailScale||(['posteromedial','posterior','extreme-medial'].includes(state.cutaway)?7:12)):state.cutaway==='medial'?28:24;applyGeometry();save();});
  q('#tmj-v18-emphasis').addEventListener('change',e=>{state.seamEmphasis=e.target.checked;applyGeometry();save();});
  for(const [id,key] of [['#tmj-v22-recovered','contactTrim'],['#tmj-v22-medial','medialReview']])q(id).addEventListener('change',e=>{state[key]=e.target.checked;applyGeometry();save();});
  q('#tmj-v24-patch').addEventListener('change',e=>{if(!e.target.value)return;setCutaway(e.target.value);state.closeup=true;state.scale=selectedCut().detailScale;applyGeometry();save();});
  q('#tmj-v24-filter').addEventListener('change',e=>{state.closureFilter=e.target.value;applyGeometry();save();});
  q('#tmj-v23-contact').addEventListener('change',e=>{if(!e.target.value)return;setCutaway(e.target.value);state.closeup=true;state.scale=selectedCut().detailScale;applyGeometry();save();});
  q('#tmj-v23-fascia').addEventListener('change',e=>{state.fasciaNote=e.target.checked;syncUI();});
  q('#tmj-v21-insertion').addEventListener('change',e=>{state.insertionRims=e.target.checked;applyGeometry();save();});
  q('#tmj-v20-core').addEventListener('change',e=>{state.layers.retroCore=e.target.checked;applyGeometry();save();});
  q('#tmj-v19-seams').addEventListener('change',e=>{state.seamEdges=e.target.checked;applyGeometry();save();});
  q('#tmj-v18-reflection').addEventListener('change',e=>{state.reflection=e.target.checked;applyGeometry();save();});
  const params=new URLSearchParams(location.search);if(['superior','inferior','both'].includes(params.get('space')))state.space=params.get('space');if(params.get('isolate')==='1')state.spaceContext='isolated';if(['v26','v25'].includes(params.get('inferior')))state.inferiorVersion=params.get('inferior');if(['anterior','medial','posterior'].includes(params.get('recess')))setRecess(params.get('recess'));if(cutData.parts.some(c=>c.id===params.get('cut')))setCutaway(params.get('cut'));if(params.get('zoom')==='1'&&activeCutaway()){state.closeup=true;state.scale=selectedCut()?.detailScale||(['posteromedial','posterior','extreme-medial'].includes(state.cutaway)?7:12);}if(params.get('edges')==='1')state.seamEmphasis=true;if(params.get('core')==='1')state.layers.retroCore=true;if(params.get('rims')==='1')state.insertionRims=true;

  // A section-page link requests the current complete model at an exact plane.
  const requestedPlane=params.get('view'), requestedPosition=Number(params.get('section'));
  if(['sagittal','coronal'].includes(requestedPlane)&&params.has('section')&&Number.isFinite(requestedPosition)&&Math.abs(requestedPosition)<=10){
    exitCutaway();Object.assign(state,{view:requestedPlane,section:requestedPosition,mode:'reconstructed',inferiorVersion:'v26',spaceContext:params.get('isolate')==='1'?'isolated':'boundaries',spaceOpacity:.85,azimuth:requestedPlane==='sagittal'?0:90,elevation:0,scale:30,anchor:'none',contact:false});
    for(const key of Object.keys(state.layers))state.layers[key]=true;
  }

  const picker=new THREE.Raycaster();
  function pickBoundary(event){
    const rect=canvases[0].getBoundingClientRect();picker.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),cameras[0]);
    const hit=picker.intersectObjects(Object.values(spaceMeshes).filter(m=>m.visible)).find(h=>(state.spaceRims||h.object.userData.faceBoundaries[h.faceIndex]!=='closure')&&(!['sagittal','coronal'].includes(state.view)||clip.distanceToPoint(h.point)>=0));
    q('#tmj-v13-picked').textContent=hit?boundaryDescription(hit.object.userData,hit.faceIndex):'No visible space surface at this point. Rotate or isolate a space, then tap its surface.';
  }
  let drag=null;
  const canvas=canvases[0];
  canvas.addEventListener('pointerdown',event=>{if(event.isPrimary){drag={x:event.clientX,y:event.clientY,az:state.azimuth,el:state.elevation};canvas.setPointerCapture(event.pointerId);}});
  canvas.addEventListener('pointermove',event=>{
    if(!drag || !event.isPrimary)return;
    state.azimuth=((drag.az-(event.clientX-drag.x)*.4+540)%360)-180;
    state.elevation=Math.max(-80,Math.min(80,drag.el+(event.clientY-drag.y)*.3));syncUI();draw();
  });
  canvas.addEventListener('pointerup',event=>{if(drag){if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)pickBoundary(event);drag=null;save();}});
  canvas.addEventListener('pointercancel',()=>{if(drag){drag=null;save();}});
  canvas.addEventListener('wheel',event=>{event.preventDefault();state.scale=Math.max(activeCutaway()&&selectedCut()?.contactId?.015:1,Math.min(80,state.scale+event.deltaY*(activeCutaway()&&selectedCut()?.contactId?state.scale*.001:.025)));syncUI();draw();save();},{passive:false});
  window.addEventListener('openai:set_globals',event=>{if(event.detail?.globals?.widgetState){normalize(event.detail.globals.widgetState);applyGeometry();}});
  new ResizeObserver(draw).observe(q('.geometry-stage'));
  new MutationObserver(()=>{updateTheme();makeSections();draw();}).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
  for(const canvas of canvases)canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();q('.geometry-error').hidden=false;q('.geometry-error').textContent='3D graphics context was lost. Reload this view to restore it.';});
  loading('first 3D frame');
  updateTheme();applyGeometry();
  root.dataset.viewerState = 'ready';
} catch(error) {
  root.dataset.viewerState = 'error';
  q('.geometry-caption').textContent='3D view unavailable';
  q('.geometry-error').hidden=false;
  const detail = error?.message || String(error);
  q('.geometry-error').textContent=`Could not load ${loadStage}: ${detail}. Reload to retry. The static review below remains available.`;
  console.error('TMJ geometry viewer:',error);
}
