// r59 locator: perspective view, a see-through temporal bone drawn as one clean layer,
// structure names, a filled view cone and a calm palette. Built on the r58 locator: checked instrument plus teaching overlays for the procedure — jaw motion
// preview, insufflation syringe, outflow needle, irrigation lines and an anatomical compass.
// Overlays are drawn here only; they never enter collision or volume geometry.
import {addNexusBody} from './nexus-r34.mjs';
import {PIVOT,TOOL,DEPTH_OFFSET} from './navigation-r49.mjs';
// Natural tones are the default. The optional colour coding uses the amber / teal / violet
// of the interface palette.
export const ANATOMY_COLOURS=Object.freeze({temporal:'#d9b765',condyle:'#7fb8d0',disc:'#9b82e0'});
const NATURAL=Object.freeze({temporal:'#e9e4d8',condyle:'#d8cdb8',disc:'#c79aa6'}),FOV=26;
export function createMap(T,{canvas,overviewCanvas,records,heads,cavities,labelLayer=null}){
 const V=a=>new T.Vector3(...a),scene=new T.Scene();scene.background=new T.Color('#12161b');
 const renderer=new T.WebGLRenderer({canvas,antialias:true}),mini=new T.WebGLRenderer({canvas:overviewCanvas,antialias:true});
 for(const r of[renderer,mini]){r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.localClippingEnabled=true;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=.9;}
 scene.add(new T.HemisphereLight('#f3f7ff','#354354',1.15));for(const[p,n]of[[[35,-40,60],1.65],[[-40,50,10],.65]]){const l=new T.DirectionalLight('#ffffff',n);l.position.copy(V(p));scene.add(l);}
 const camera=new T.PerspectiveCamera(FOV,1,1,2000);camera.up.set(0,0,1);
 const miniCamera=new T.OrthographicCamera(-30,30,30,-30,.1,1500);miniCamera.up.set(0,0,1);miniCamera.position.set(120,-190,100);miniCamera.lookAt(-13,17,-22);miniCamera.updateMatrixWorld();
 const primary=records.filter(r=>['temporal','condyle','disc'].includes(r.part.name)).map(r=>{const material=new T.MeshStandardMaterial({color:NATURAL[r.part.name],roughness:.9,side:T.DoubleSide});const mesh=new T.Mesh(r.g,material);scene.add(mesh);return{...r,copy:mesh};});
 // See-through roof: a depth-only pass keeps the nearest layer of the temporal bone, then one
 // glass-like layer is blended over the joint. Surfaces seen edge-on stay visible, so the bone
 // keeps its outline without hiding the disc, the condyle or the telescope.
 const roofRecord=primary.find(r=>r.part.name==='temporal'),solidRoof=roofRecord.copy.material;
 const ghostRoof=new T.MeshStandardMaterial({color:NATURAL.temporal,roughness:.95,side:T.DoubleSide,transparent:true,opacity:.9,depthWrite:false});
 ghostRoof.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n diffuseColor.a*=mix(.16,.9,pow(1.-abs(dot(normal,normalize(vViewPosition))),1.6));');};
 const roofDepth=new T.Mesh(roofRecord.g,new T.MeshBasicMaterial({colorWrite:false,side:T.DoubleSide,transparent:true}));roofDepth.renderOrder=2;roofRecord.copy.add(roofDepth);
 const probe=Object.fromEntries(primary.map(r=>[r.part.name,new T.Mesh(r.g,new T.MeshBasicMaterial({side:T.DoubleSide}))]));
 const headCopies=heads.map(h=>{const mesh=new T.Mesh(h.g,new T.MeshStandardMaterial({color:h.part.layer==='disc'?'#b38e9a':'#b6ab97',roughness:.85,side:T.DoubleSide}));scene.add(mesh);return{...h,copy:mesh};});
 const fluid=cavities.map((c,i)=>{const mesh=new T.Mesh(c.g,new T.MeshBasicMaterial({color:i===0?'#7fb8d0':'#e0b341',transparent:true,opacity:.19,side:T.DoubleSide,depthWrite:false}));mesh.renderOrder=1;scene.add(mesh);return mesh;});
 const scope=new T.Group(),shaft=new T.Mesh(new T.CylinderGeometry(TOOL.radius,TOOL.radius,TOOL.length,36),new T.MeshStandardMaterial({color:'#b7c8ce',metalness:.82,roughness:.24}));shaft.geometry.translate(0,-TOOL.length/2,0);scope.add(shaft);addNexusBody(T,scope);scene.add(scope);
 const steel=new T.MeshStandardMaterial({color:'#eef3f5',metalness:.25,roughness:.35}),rubber=new T.MeshStandardMaterial({color:'#20262a',roughness:.6});
 // Needle with a syringe. Local +Y runs from the hand toward the tip; the tip is the origin.
 function syringe({length,radius,hub}){
  const group=new T.Group(),barrelLength=42,bore=4.2,front=-length-6;
  const needle=new T.Mesh(new T.CylinderGeometry(radius,radius,length,16),steel);needle.position.y=-length/2;group.add(needle);
  const bevel=new T.Mesh(new T.ConeGeometry(radius,1.6,16),steel);bevel.position.y=.8;group.add(bevel);
  const collar=new T.Mesh(new T.CylinderGeometry(1.15,1.75,6,20),new T.MeshStandardMaterial({color:hub,roughness:.5}));collar.position.y=-length-3;group.add(collar);
  const body=new T.Group();body.position.y=front;group.add(body);
  const barrel=new T.Mesh(new T.CylinderGeometry(bore+.5,bore+.5,barrelLength,28,1,true),new T.MeshStandardMaterial({color:'#e8f5fa',transparent:true,opacity:.26,roughness:.2,side:T.DoubleSide,depthWrite:false}));barrel.position.y=-barrelLength/2;body.add(barrel);
  const flange=new T.Mesh(new T.CylinderGeometry(bore+3,bore+3,.9,28),new T.MeshStandardMaterial({color:'#dfeef3',transparent:true,opacity:.6,roughness:.3}));flange.position.y=-barrelLength;body.add(flange);
  const liquidGeometry=new T.CylinderGeometry(bore,bore,1,24);liquidGeometry.translate(0,-.5,0);
  const liquid=new T.Mesh(liquidGeometry,new T.MeshStandardMaterial({color:'#9fd8f0',transparent:true,opacity:.62,roughness:.15}));body.add(liquid);
  const plunger=new T.Group();body.add(plunger);
  const stopper=new T.Mesh(new T.CylinderGeometry(bore,bore,2.4,24),rubber);stopper.position.y=-1.2;plunger.add(stopper);
  const rod=new T.Mesh(new T.CylinderGeometry(1,1,barrelLength,12),new T.MeshStandardMaterial({color:'#f1f6f8',roughness:.4}));rod.position.y=-2.4-barrelLength/2;plunger.add(rod);
  const thumb=new T.Mesh(new T.CylinderGeometry(bore+1.6,bore+1.6,1,24),rod.material);thumb.position.y=-2.4-barrelLength;plunger.add(thumb);
  const travel=barrelLength-6;
  // fill 0 = plunger home (empty), 1 = drawn back (full).
  group.userData={body,liquid,setFill(fill,colour){fill=Math.max(0,Math.min(1,fill));liquid.scale.y=Math.max(.001,travel*fill);liquid.visible=fill>.004;plunger.position.y=-travel*fill;if(colour)liquid.material.color.copy(colour);}};
  group.visible=false;scene.add(group);return group;
 }
 const injector=syringe({length:24,radius:.41,hub:'#4f9a5b'}),drain=syringe({length:24,radius:.64,hub:'#d98aa6'});
 // Flexible lines with travelling beads show which way fluid moves.
 function line(colour){
  const curve=new T.CatmullRomCurve3([V([0,0,0]),V([4,-9,-5]),V([13,-15,-16]),V([25,-17,-30])]);
  const tube=new T.Mesh(new T.TubeGeometry(curve,28,.85,10),new T.MeshStandardMaterial({color:'#dfeef5',transparent:true,opacity:.42,roughness:.25,depthWrite:false}));
  const beads=Array.from({length:5},()=>{const b=new T.Mesh(new T.SphereGeometry(.62,10,8),new T.MeshBasicMaterial({color:colour}));tube.add(b);return b;});
  tube.userData={curve,beads};tube.visible=false;return tube;
 }
 const drainLine=line('#d0424a');drain.add(drainLine);drainLine.position.y=-27;
 const inflowLine=line('#7fd0ff');scope.add(inflowLine);inflowLine.position.y=-(TOOL.length+11);
 function flowBeads(tube,phase,toward,colour){tube.userData.beads.forEach((b,i)=>{const u=((phase+i/5)%1+1)%1;b.position.copy(tube.userData.curve.getPoint(toward?1-u:u));if(colour)b.material.color.copy(colour);});}
 const clearFluid=new T.Color('#9fd8f0'),bloodFluid=new T.Color('#b3202b'),mixed=new T.Color(),spaceClear=new T.Color('#7fb8d0');
 // Anatomical compass: the six directions turn with the orbit of the main view.
 const compass=new T.Scene(),compassCamera=new T.OrthographicCamera(-1.75,1.75,1.75,-1.75,.1,20);compassCamera.up.set(0,0,1);
 function label(text,colour){const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.font='600 34px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=7;g.strokeStyle='#12161b';g.strokeText(text,48,50);g.fillStyle=colour;g.fillText(text,48,50);const sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),depthTest:false,transparent:true}));sprite.scale.setScalar(.82);return sprite;}
 // Model frame of this right joint: +X lateral, +Y anterior, +Z superior.
 for(const[direction,positive,negative,colour]of[[[1,0,0],'LAT','MED','#f0b8f2'],[[0,1,0],'ANT','POST','#9fe3a8'],[[0,0,1],'SUP','INF','#8fd3ff']]){
  const d=V(direction),g=new T.BufferGeometry().setFromPoints([d.clone().multiplyScalar(-.95),d.clone().multiplyScalar(.95)]);
  compass.add(new T.Line(g,new T.LineBasicMaterial({color:colour,transparent:true,opacity:.85,depthTest:false})));
  const head=new T.Mesh(new T.ConeGeometry(.11,.3,12),new T.MeshBasicMaterial({color:colour,depthTest:false}));head.position.copy(d).multiplyScalar(.95);head.quaternion.setFromUnitVectors(V([0,1,0]),d);compass.add(head);
  const a=label(positive,colour),b=label(negative,colour);a.position.copy(d).multiplyScalar(1.38);b.position.copy(d).multiplyScalar(-1.3);b.material.opacity=.62;compass.add(a,b);(compass.userData.axes||(compass.userData.axes=[])).push({d:d.clone(),a,b});
 }
 const previewMatrix=new T.Matrix4(),lift=new T.Matrix4(),identity=new T.Matrix4();
 const annotation=color=>new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true});
 const lens=new T.Mesh(new T.SphereGeometry(.3,20,14),annotation('#f4f7f9'));lens.renderOrder=24;scene.add(lens);
 const halo=new T.Mesh(new T.SphereGeometry(.74,20,14),annotation('#5fa6c4'));halo.material.opacity=.36;halo.renderOrder=20;lens.add(halo);
 const atlasLens=new T.Mesh(new T.SphereGeometry(.28,16,12),annotation('#e0b341'));atlasLens.renderOrder=22;scene.add(atlasLens);
 const contact=new T.Mesh(new T.SphereGeometry(.4,16,12),annotation('#e0655b'));contact.renderOrder=22;scene.add(contact);
 const ring=new T.Mesh(new T.TorusGeometry(1.35,.07,10,48),annotation('#9b82e0'));ring.renderOrder=21;scene.add(ring);
 const target=new T.Mesh(new T.SphereGeometry(.26,12,10),annotation('#e0b341'));target.renderOrder=23;scene.add(target);
 const sightGeometry=new T.BufferGeometry();sightGeometry.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,0,0],3));const sight=new T.Line(sightGeometry,new T.LineDashedMaterial({color:'#e0b341',dashSize:.45,gapSize:.25,transparent:true,opacity:.8,depthTest:false}));sight.renderOrder=18;scene.add(sight);
 // Field of view: a soft filled cone from the lens to the tissue at the centre of the image.
 const spread=Math.tan(32.5*Math.PI/180),coneGeometry=new T.ConeGeometry(spread,1,48,1,true);coneGeometry.rotateX(-Math.PI/2);coneGeometry.translate(0,0,.5);
 const cone=new T.Group(),coneFill=new T.Mesh(coneGeometry,new T.MeshBasicMaterial({color:'#5fa6c4',transparent:true,opacity:.17,side:T.DoubleSide,depthTest:false,depthWrite:false}));coneFill.renderOrder=17;
 const coneRim=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:65},(_,i)=>V([spread*Math.cos(i*Math.PI/32),spread*Math.sin(i*Math.PI/32),1]))),new T.LineBasicMaterial({color:'#7fb8d0',transparent:true,opacity:.85,depthTest:false}));coneRim.renderOrder=19;cone.add(coneFill,coneRim);scene.add(cone);
 // Structure names. Anchors are found on the model surfaces themselves. They name a region
 // for orientation and are illustrative, not validated landmarks.
 const NAMES=[['fossa','Glenoid fossa','top'],['eminence','Articular eminence','top'],['disc','Articular disc','right'],['condyle','Mandibular condyle','bottom'],['lens','Lens','left']];
 const labelNodes=labelLayer?Object.fromEntries(NAMES.map(([k,text,side])=>{const e=document.createElement('div');e.className='map-label';e.dataset.k=k;e.dataset.side=side;e.append(document.createElement('i'));const b=document.createElement('b');b.textContent=text;e.append(b);e.hidden=true;labelLayer.append(e);return[k,e];})):{};
 let anchorKey='',anchors={},hiddenKey='',hiddenAt=0,hiddenNames={};
 // A structure name is not shown while the disc or the condyle stands between the viewer and
 // its anchor: from behind, the eminence name would otherwise appear to point at the disc.
 function findHidden(){
  const out={},eye=camera.position;
  for(const k of ['fossa','eminence','disc','condyle']){const p=anchors[k];if(!p)continue;const dir=p.clone().sub(eye),far=dir.length();ray.set(eye,dir.normalize());ray.near=0;ray.far=far-.6;
   out[k]=[probe.disc,probe.condyle].some(m=>m&&m!==probe[k]&&ray.intersectObject(m,false).length>0);}
  return out;
 }
 function findAnchors(){
  const cast=(mesh,from,direction)=>{ray.set(V(from),V(direction));ray.near=0;ray.far=Infinity;return ray.intersectObject(mesh,false)[0]?.point.clone()||null;};
  const box=new T.Box3().setFromBufferAttribute(probe.disc.geometry.attributes.position),c=box.getCenter(V([0,0,0])),out={};
  const top=cast(probe.disc,[c.x,c.y,60],[0,0,-1]);
  out.disc=cast(probe.disc,[60,c.y,c.z],[-1,0,0]);
  out.fossa=top&&cast(probe.temporal,[top.x,top.y,top.z+.05],[0,0,1]);
  let low=null;for(let y=c.y+4;y<=c.y+16;y+=1.5){const p=cast(probe.temporal,[c.x,y,c.z-6],[0,0,1]);if(p&&(!low||p.z<low.z))low=p;}out.eminence=low;
  out.condyle=cast(probe.condyle,[60,c.y,c.z-9],[-1,0,0]);
  return out;
 }
 const ray=new T.Raycaster();let miniKey='';let count=0,lastEntry=null,entryKey='',drawKey='',lastDraw=null;
 const cavityMeshes=cavities.map(c=>new T.Mesh(c.g,new T.MeshBasicMaterial({side:T.DoubleSide})));let locationKey='',location='',anchorVersion=-1,spaceAnchors=[V([0,0,1]),V([0,0,-3])];
 function classify(p){const k=p.join(',')+'/'+cavities[0].g.attributes.position.version;if(k===locationKey)return location;locationKey=k;location='Outside joint spaces';for(let i=0;i<cavityMeshes.length;i++){ray.set(V(p),V([.337,.571,.749]).normalize());const h=ray.intersectObject(cavityMeshes[i]);if(h.filter((v,j)=>!j||v.distance-h[j-1].distance>1e-5).length%2){location=i===0?'Superior joint space':'Inferior joint space';break;}}return location;}
 function size(r,c){const w=Math.max(1,Math.round(c.clientWidth)),h=Math.max(1,Math.round(c.clientHeight));if(c.width!==Math.floor(w*r.getPixelRatio())||c.height!==Math.floor(h*r.getPixelRatio()))r.setSize(w,h,false);return{w,h};}
 let previousMotionKey='', lastMapMotion=-Infinity;
 function draw({optical,pose,orbit,separate,cutaway,translucentRoof,showEnvelope,teaching,guides,names=true,first,blocked,tracer,inspection=null,preview=null,tools=null,scopeVisible=true,spaceHighlight=0,blood=0,spaceScale=1,showCompass=true}){
  const now=performance.now(), motionKey=JSON.stringify([pose,orbit]);
  if (previousMotionKey !== motionKey) { previousMotionKey=motionKey; lastMapMotion=now; }
  const mapRatio=Math.min(devicePixelRatio,now-lastMapMotion<180 ? 1 : 1.5);
  if (renderer.getPixelRatio() !== mapRatio) renderer.setPixelRatio(mapRatio);
  const nextKey=JSON.stringify([names,preview,tools,scopeVisible,spaceHighlight,blood,spaceScale,showCompass,optical,pose,orbit,separate,cutaway,translucentRoof,showEnvelope,teaching,guides,first?.point?.toArray(),first?.object?.name,blocked,showEnvelope?tracer:0,inspection,cavities[0].g.attributes.position.version,canvas.clientWidth,canvas.clientHeight,overviewCanvas.clientWidth,overviewCanvas.clientHeight,devicePixelRatio,mapRatio]);
  if(nextKey===drawKey)return lastDraw;
  drawKey=nextKey;
  const {w,h}=size(renderer,canvas),aspect=w/h,centre=V([1,1,separate?-1:-5]),span=(separate?66:46)*orbit.zoom,az=orbit.az*Math.PI/180,el=orbit.el*Math.PI/180;
  const right=V([-Math.sin(az),Math.cos(az),0]),up=V([-Math.cos(az)*Math.sin(el),-Math.sin(az)*Math.sin(el),Math.cos(el)]);centre.addScaledVector(right,orbit.panX||0).addScaledVector(up,orbit.panY||0);
  const distance=span/(2*Math.tan(FOV*Math.PI/360));camera.position.copy(centre).addScaledVector(V([Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)]),distance);camera.lookAt(centre);camera.aspect=aspect;camera.near=Math.max(1,distance-150);camera.far=distance+600;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  roofRecord.copy.material=translucentRoof?ghostRoof:solidRoof;roofRecord.copy.renderOrder=translucentRoof?3:0;roofDepth.visible=translucentRoof;
  for(const r of primary){r.copy.visible=true;r.copy.position.z=separate?(r.part.name==='temporal'?14:r.part.name==='condyle'?-10:0):0;r.copy.material.clippingPlanes=r.part.name==='temporal'&&cutaway?[new T.Plane(V([0,0,1]),2-r.copy.position.z),...(separate?[]:[new T.Plane(V([-1,0,0]),0)])]:[];r.copy.material.color.set((teaching?ANATOMY_COLOURS:NATURAL)[r.part.name]);
   // While a jaw movement is being checked, the condyle and disc are shown at the
   // requested position with one rigid transform. Vertex buffers stay at the last checked state.
   r.copy.matrixAutoUpdate=false;r.copy.matrix.copy(lift.makeTranslation(0,0,r.copy.position.z));if(preview&&r.part.name!=='temporal')r.copy.matrix.multiply(previewMatrix.fromArray(preview));r.copy.matrixWorldNeedsUpdate=true;}
  roofDepth.material.clippingPlanes=roofRecord.copy.material.clippingPlanes;
  for(const h of headCopies){h.copy.visible=false;h.copy.material.color.set(teaching?ANATOMY_COLOURS[h.part.layer]:h.part.layer==='disc'?'#b38e9a':'#b6ab97');h.copy.matrixAutoUpdate=false;h.copy.matrix.copy(preview&&h.part.name!=='skull'?previewMatrix.fromArray(preview):identity);h.copy.matrixWorldNeedsUpdate=true;}
  // The superior space lights up while fluid is injected and turns red with suspended blood.
  const highlight=separate?0:Math.max(0,Math.min(1,spaceHighlight));
  fluid.forEach((m,i)=>{const base=separate?0:i===0?(showEnvelope?.17:.1):showEnvelope?.12:0,opacity=i===0?Math.max(base,highlight*(.3+.26*blood)):base;m.visible=opacity>.002;m.material.opacity=opacity;
   if(i===0){m.material.color.copy(spaceClear).lerp(bloodFluid,Math.min(1,blood*1.25));m.matrixAutoUpdate=false;const c=m.geometry.boundingSphere?.center||V([0,0,0]),k=spaceScale;m.matrix.makeTranslation(c.x*(1-k),c.y*(1-k),c.z*(1-k)).scale(V([k,k,k]));m.matrixWorldNeedsUpdate=true;}
   else{m.matrixAutoUpdate=false;m.matrix.copy(preview?previewMatrix.fromArray(preview):identity);m.matrixWorldNeedsUpdate=true;}});
  // Instruments for the procedure steps.
  const inject=tools?.inject,outflow=tools?.outflow;
  injector.visible=!!inject?.visible;
  if(injector.visible){const a=V(inject.axis);injector.position.fromArray(inject.tip).addScaledVector(a,-(1-inject.advance)*17);injector.quaternion.setFromUnitVectors(V([0,1,0]),a);injector.userData.setFill(1-inject.plunger,clearFluid);}
  drain.visible=!!outflow?.visible;
  if(drain.visible){const a=V(outflow.axis);drain.position.fromArray(outflow.tip).addScaledVector(a,-(1-outflow.advance)*17);drain.quaternion.setFromUnitVectors(V([0,1,0]),a);
   mixed.copy(clearFluid).lerp(bloodFluid,Math.min(1,(outflow.tint||0)*1.6));
   drain.userData.body.visible=!!outflow.syringe;drain.userData.setFill(outflow.fill||0,mixed);
   drainLine.visible=!outflow.syringe&&outflow.advance>.98;drainLine.material.opacity=outflow.flow?.5:.26;flowBeads(drainLine,outflow.phase||0,false,mixed);for(const b of drainLine.userData.beads)b.visible=!!outflow.flow;}
  inflowLine.visible=scopeVisible&&!!tools?.inflow?.visible;if(inflowLine.visible){flowBeads(inflowLine,tools.inflow.phase||0,true);for(const b of inflowLine.userData.beads)b.visible=!!tools.inflow.flow;inflowLine.material.opacity=tools.inflow.flow?.5:.26;}
  scope.visible=scopeVisible;
  scope.position.fromArray(optical.tip);scope.quaternion.setFromUnitVectors(V([0,1,0]),V(optical.axis));scope.rotateY(pose.roll*Math.PI/180);lens.position.fromArray(optical.tip);cone.position.fromArray(inspection?.tip||optical.tip);cone.quaternion.setFromUnitVectors(V([0,0,1]),V(inspection?.direction||optical.direction));coneFill.material.color.set(inspection?'#e0b341':'#5fa6c4');cone.scale.setScalar(first?Math.max(1.5,Math.min(9,first.distance)):5);atlasLens.visible=!!inspection;if(inspection)atlasLens.position.fromArray(inspection.tip);
  target.visible=!!first;sight.visible=!!first;if(first){sightGeometry.attributes.position.array.set([...optical.tip,...first.point.toArray()]);sightGeometry.attributes.position.needsUpdate=true;sightGeometry.computeBoundingSphere();sight.computeLineDistances();}if(first){target.position.copy(first.point);const m=primary.find(r=>r.part.name===first.object.name);target.position.z+=m?.copy.position.z||0;}
  contact.visible=!!blocked?.point;if(contact.visible)contact.position.fromArray(blocked.point);
  const key=optical.axis.join(',')+'/'+cavities[0].g.attributes.position.version;if(key!==entryKey){entryKey=key;ray.set(V(PIVOT).addScaledVector(V(optical.axis),-DEPTH_OFFSET),V(optical.axis));ray.near=.001;ray.far=30;const hit=ray.intersectObject(cavityMeshes[0])[0];lastEntry=hit?.point.clone()||null;ray.far=Infinity;ray.near=0;}
  if(anchorVersion!==cavities[0].g.attributes.position.version){anchorVersion=cavities[0].g.attributes.position.version;spaceAnchors=cavityMeshes.map(m=>{let point=null,longest=0;for(const x of[-4,0,4])for(const y of[-3,0,3]){ray.set(V([x,y,-50]),V([0,0,1]));const h=ray.intersectObject(m).filter((v,i,a)=>!i||v.distance-a[i-1].distance>1e-5);for(let i=0;i+1<h.length;i+=2){const length=h[i+1].distance-h[i].distance;if(length>longest){longest=length;point=h[i].point.clone().lerp(h[i+1].point,.5);}}}return point;});}
  ring.position.copy(lastEntry||V(PIVOT));ring.quaternion.setFromUnitVectors(V([0,0,1]),V(optical.axis));guides=guides&&scopeVisible;lens.visible = guides;
  ring.visible = guides;
  cone.visible = guides;
  sight.visible = guides && !!first;
  target.visible = guides && !!first;
  contact.visible = guides && !!blocked?.point;
  renderer.render(scene,camera);
  if(labelLayer){
   const versions=[cavities[0].g.attributes.position.version,...primary.map(r=>r.g.attributes.position.version)].join();if(versions!==anchorKey){anchorKey=versions;anchors=findAnchors();hiddenKey='';}
   const view=anchorKey+'|'+camera.position.toArray().map(v=>v.toFixed(1)).join(),now=performance.now();if(view!==hiddenKey&&now-hiddenAt>120){hiddenKey=view;hiddenAt=now;hiddenNames=findHidden();}
   const lifted=separate?{fossa:14,eminence:14,condyle:-10}:{},places={...anchors,lens:scopeVisible?V(optical.tip):null};
   for(const[k,e]of Object.entries(labelNodes)){let show=names&&!!places[k]&&!hiddenNames[k];if(show){const v=places[k].clone();v.z+=lifted[k]||0;v.project(camera);const x=(v.x+1)/2*w,y=(1-v.y)/2*h;show=v.z<1&&x>10&&x<w-10&&y>10&&y<h-10;if(show)e.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;}if(e.hidden===show)e.hidden=!show;}
  }
  if(showCompass){
   const side=Math.round(Math.max(64,Math.min(112,h*.2)));
   compassCamera.position.copy(camera.position).sub(centre).normalize().multiplyScalar(6);compassCamera.lookAt(0,0,0);compassCamera.updateMatrixWorld();
   // An axis seen end-on keeps only the letter that points at the viewer, so the two do not overlap.
   const eye=compassCamera.position.clone().normalize();for(const x of compass.userData.axes||[]){const t=x.d.dot(eye);x.a.visible=t>-.9;x.b.visible=t<.9;}
   renderer.autoClear=false;renderer.clearDepth();renderer.setViewport(6,6,side,side);renderer.render(compass,compassCamera);renderer.setViewport(0,0,w,h);renderer.autoClear=true;
  }
  // A separate fixed head view keeps the full-size telescope in context.
  const miniWidth = overviewCanvas.clientWidth, miniHeight = overviewCanvas.clientHeight;
  const nextMiniKey = JSON.stringify([pose, teaching, guides, cavities[0].g.attributes.position.version, miniWidth, miniHeight]);
  if (miniWidth && miniHeight && nextMiniKey !== miniKey) {
    miniKey = nextMiniKey;
    for (const r of primary) {
      r.copy.visible = r.part.name === 'disc';
      r.copy.position.z = 0;
    }
    for (const h of headCopies) h.copy.visible = true;
    for (const mesh of fluid) mesh.visible = false;
    injector.visible = drain.visible = false;
    cone.visible = target.visible = contact.visible = sight.visible = false;
    lens.scale.setScalar(3);
    ring.scale.setScalar(2);
    const sizeMini = size(mini, overviewCanvas);
    miniCamera.left = -125 * sizeMini.w / sizeMini.h;
    miniCamera.right = -miniCamera.left;
    miniCamera.top = 125;
    miniCamera.bottom = -125;
    miniCamera.updateProjectionMatrix();
    mini.render(scene, miniCamera);
    lens.scale.setScalar(1);
    ring.scale.setScalar(1);
  } else if (!miniWidth || !miniHeight) {
    miniKey = '';
  }
  lastDraw={projection:'perspective',fieldOfView:FOV,names:!!names&&!!labelLayer,namedStructures:Object.keys(anchors).filter(k=>anchors[k]),namesValidated:false,guides,scopeVisible,previewActive:!!preview,compass:showCompass?{lateral:'+X',anterior:'+Y',superior:'+Z'}:null,tools:{injector:!!inject?.visible,outflowNeedle:!!outflow?.visible,collision:false},spaceHighlight:highlight,translucentRoof,anatomyPalette:teaching?ANATOMY_COLOURS:null,anatomyColourMode:teaching?'distinct teaching colours':'natural reference',overlayOpacity:showEnvelope?[.08,.12]:[0,0],frameNumber:++count,frameCentre:centre.toArray(),span,frameFollowsScope:false,position:optical.tip,direction:optical.direction,shaftAxis:optical.axis,workingLength:63.1,overallLength:115,fullScopeVisible:!!miniWidth,completeInstrumentContext:miniWidth?'fixed whole-head inset':'joint close-up',centreRayShared:!!first,sourceBuffersShared:primary.every(r=>r.g===r.copy.geometry),separated:separate,cutaway,entry:lastEntry?.toArray()||null,pivot:PIVOT,clinicalPortal:false,compartment:classify(optical.tip),inspection:inspection?{position:inspection.tip,compartment:classify(inspection.tip)}:null,spaceAnchors:spaceAnchors.map(p=>p?.toArray()||null)};return lastDraw;
 }
 return{draw,classify,renderers:[renderer,mini]};
}
