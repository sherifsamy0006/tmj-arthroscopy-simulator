import {createJointMap} from './joint-locator-r35.mjs';
import {addNexusBody} from './nexus-r34.mjs';
// Orientation aids only. Tissue buffers remain shared and untransformed;
// the illustrative shaft is never added to the internal camera scene.
export function createLocator({THREE,anatomy,meshes,closure,position,camera,cavityGeometry}){
 const $=s=>document.querySelector(s),locatorCanvas=$('#locator');
 const scene=new THREE.Scene(),background=new THREE.Color('#14222a');scene.background=background;
 const renderer=new THREE.WebGLRenderer({canvas:locatorCanvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 const cleanMap=createJointMap({THREE,renderer,canvas:locatorCanvas,svg:$('#locator-labels'),meshes:meshes.filter(m=>m!==closure),cavityGeometry});
 const view=new THREE.OrthographicCamera(),insetView=new THREE.OrthographicCamera();
 for(const c of [view,insetView]){c.up.set(0,0,1);c.near=.1;c.far=2000;}
 scene.add(new THREE.AmbientLight(0xffffff,1.4));
 for(const [p,intensity] of [[[70,-70,90],2],[[-60,40,20],.7]]){const l=new THREE.DirectionalLight(0xffffff,intensity);l.position.set(...p);scene.add(l);}
 const joint=new THREE.Group(),head=new THREE.Group();scene.add(joint,head);const tissues=[];
 for(const mesh of meshes.filter(m=>m!==closure)){
  const material=mesh.material.clone();material.transparent=true;material.opacity=mesh.name==='disc'?.9:mesh.name==='condyle'?.85:mesh.name==='temporal'?.18:.07;material.depthWrite=false;
  const m=new THREE.Mesh(mesh.geometry,material);m.name=mesh.name;joint.add(m);tissues.push(m);
 }
 for(const p of anatomy.parts.filter(p=>p.head)){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.p,3));g.setIndex(p.i);g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:p.layer==='disc'?'#71b5c6':'#c9bfae',side:THREE.DoubleSide,transparent:true,opacity:.33,depthWrite:false,roughness:1}));head.add(m);tissues.push(m);
 }
 const rightDisc=new THREE.Mesh(meshes.find(m=>m.name==='disc').geometry,new THREE.MeshBasicMaterial({color:'#71b5c6',transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}));head.add(rightDisc);tissues.push(rightDisc);
 head.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(head),headCentre=box.getCenter(new THREE.Vector3()),headSize=box.getSize(new THREE.Vector3());
 const locatorState={mode:'joint',az:-35,el:14,separated:true,zoom:1};
 const neutral=new THREE.Vector3(-.9361168066628592,.08189960831908931,.3420201433256687);
 const shaft=new THREE.Group();shaft.position.copy(position);shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),neutral);scene.add(shaft);
 const steel=new THREE.MeshStandardMaterial({color:'#a8c6d1',metalness:.45,roughness:.23,transparent:true,depthTest:false,depthWrite:false});
 // Display-only shaft length; no device dimensions or insertion route are asserted.
 const shaftLength=63.1;
 const tubeGeometry=new THREE.CylinderGeometry(.95,.95,shaftLength,48);tubeGeometry.translate(0,-shaftLength/2,0);
 const tube=new THREE.Mesh(tubeGeometry,steel);tube.renderOrder=9;shaft.add(tube);
 const grip=new THREE.Mesh(new THREE.CylinderGeometry(1,1,9,24),new THREE.MeshStandardMaterial({color:'#293f49',metalness:.3,roughness:.3,transparent:true,depthTest:false,depthWrite:false}));grip.position.y=-shaftLength+4.5;grip.renderOrder=10;shaft.add(grip);
 const ring=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.35,24),new THREE.MeshBasicMaterial({color:'#4db6ff',transparent:true,depthTest:false,depthWrite:false}));ring.position.y=-.9;ring.renderOrder=11;shaft.add(ring);
 grip.visible=false;ring.visible=false;const nexusBody=addNexusBody(THREE,shaft);
 const shaftGuide=new THREE.ArrowHelper(neutral,position,8,0xe3b462,1,.5);scene.add(shaftGuide);
 for(const m of [shaftGuide.line,shaftGuide.cone]){m.material.transparent=true;m.material.depthTest=false;m.material.depthWrite=false;m.renderOrder=13;}
 const targetMarker=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),new THREE.MeshBasicMaterial({color:'#ffba65',transparent:true,depthTest:false,depthWrite:false}));targetMarker.renderOrder=16;scene.add(targetMarker);
 const marker=new THREE.Mesh(new THREE.SphereGeometry(.55,20,12),new THREE.MeshBasicMaterial({color:'#4db6ff',transparent:true,depthTest:false,depthWrite:false}));marker.position.copy(position);marker.renderOrder=14;scene.add(marker);
 const arrow=new THREE.ArrowHelper(neutral,position,6,0x4db6ff,1,.5);for(const m of [arrow.line,arrow.cone]){m.material.transparent=true;m.material.depthTest=false;m.material.depthWrite=false;m.renderOrder=13;}scene.add(arrow);
 const fanGeometry=new THREE.BufferGeometry();fanGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(36*6),3));
 const fan=new THREE.LineSegments(fanGeometry,new THREE.LineBasicMaterial({color:'#4db6ff',transparent:true,opacity:.75,depthTest:false,depthWrite:false}));fan.renderOrder=12;scene.add(fan);
 const fillGeometry=new THREE.ConeGeometry(Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),1,32,1,true);fillGeometry.translate(0,-.5,0);
 const fill=new THREE.Mesh(fillGeometry,new THREE.MeshBasicMaterial({color:'#4db6ff',transparent:true,opacity:.18,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));fill.renderOrder=11;fill.position.copy(position);scene.add(fill);
 function closestVertex(name,target){const a=meshes.find(m=>m.name===name).geometry.attributes.position;let best=new THREE.Vector3(),d=Infinity;const p=new THREE.Vector3();for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i);const n=p.distanceToSquared(target);if(n<d){d=n;best.copy(p);}}return best;}
 const anchors={roof:closestVertex('temporal',new THREE.Vector3(1.4,-3.8,3.5)),disc:closestVertex('disc',new THREE.Vector3(0,0,0)),condyle:closestVertex('condyle',new THREE.Vector3(0,0,-6)),shaft:position.clone().addScaledVector(neutral,-16)};
 const svg=$('#locator-labels'),ns='http://www.w3.org/2000/svg';
 function svgElement(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;}
 function fit(c,target,span,aspect,az,el){const a=THREE.MathUtils.degToRad(az),e=THREE.MathUtils.degToRad(el);c.position.copy(target).addScaledVector(new THREE.Vector3(Math.cos(a)*Math.cos(e),Math.sin(a)*Math.cos(e),Math.sin(e)),500);c.lookAt(target);c.left=-span*aspect/2;c.right=span*aspect/2;c.top=span/2;c.bottom=-span/2;c.updateProjectionMatrix();c.updateMatrixWorld();}
 function labels(w,h,isHead){
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const items=isHead?[['Right TMJ / lens tip',position,.48],['Scope shaft envelope',anchors.shaft,.78]]:[['Fossa / roof',anchors.roof,.18],['Lens tip',position,.38],['Disc',anchors.disc,.73],['Condyle',anchors.condyle,.9]];
  for(const [name,p,t] of items){const q=p.clone().project(view),x=(q.x+1)*w/2,y=(1-q.y)*h/2,ty=h*t,tx=10,lead=tx+name.length*6.2+7;
   svgElement('path',{d:`M ${lead} ${ty-4} L ${Math.max(lead+12,(lead+x)/2)} ${ty-4} L ${x} ${y}`,class:'locator-leader'});
   svgElement('text',{x:tx,y:ty,class:name.includes('lens')||name.includes('Lens')?'locator-accent':''},name);
  }
  const base=new THREE.Vector3(0,0,0).project(view),cx=w-46,cy=h-42;
  for(const [text,v] of [['S',[0,0,1]],['A',[0,1,0]],['L',[1,0,0]]]){const p=new THREE.Vector3(...v).project(view),dx=(p.x-base.x)*w,dy=-(p.y-base.y)*h,n=Math.hypot(dx,dy)||1;svgElement('path',{d:`M${cx} ${cy} L${cx+dx/n*20} ${cy+dy/n*20}`,class:'locator-leader'});svgElement('text',{x:cx+dx/n*30,y:cy+dy/n*30+4,'text-anchor':'middle'},text);}
 }
 function drawLocator(direction,shaftAxis=direction,first,roll=0){
  if(locatorState.mode==='joint'){
   const state=cleanMap.draw({position,direction,shaftAxis,first,orbit:locatorState,separated:locatorState.separated});
   document.body.dataset.locatorEvidence=JSON.stringify(state);
   $('#locator-joint').setAttribute('aria-pressed','true');$('#locator-head').setAttribute('aria-pressed','false');$('#head-inset-label').hidden=true;
   $('#locator-orbit').value=String(locatorState.az);$('#locator-orbit-value').textContent=Math.round(locatorState.az)+'°';
   $('#locator-separate').setAttribute('aria-pressed',String(locatorState.separated));$('#locator-separate').textContent=locatorState.separated?'Separated layers ✓':'Separate layers';
   return;
  }
  // One current camera pose drives every orientation aid, including the inset.
  shaft.position.copy(position);shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),shaftAxis);shaft.rotateY(THREE.MathUtils.degToRad(roll));
  marker.position.copy(position);arrow.position.copy(position);fill.position.copy(position);shaftGuide.position.copy(position);shaftGuide.setDirection(shaftAxis);targetMarker.visible=!!first;if(first)targetMarker.position.copy(first.point);
  anchors.shaft.copy(position).addScaledVector(shaftAxis,-16);
  locatorState.az=((locatorState.az+180)%360+360)%360-180;
  const isHead=locatorState.mode==='head',w=Math.max(1,Math.round(locatorCanvas.clientWidth)),h=Math.max(1,Math.round(locatorCanvas.clientHeight)),aspect=w/h;
  const target=isHead?headCentre.clone():new THREE.Vector3();
  fit(view,target,100,aspect,locatorState.az,locatorState.el);
  // Fit actual projected vertices, not the much larger rotated world AABB.
  // Only the external camera moves. Shared tissue coordinates remain untouched.
  const projected=new THREE.Box3(),p=new THREE.Vector3();
  for(const m of joint.children){const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++)projected.expandByPoint(p.fromBufferAttribute(a,i).applyMatrix4(view.matrixWorldInverse));}
  for(const distance of [-nexusBody.extent,10])projected.expandByPoint(position.clone().addScaledVector(distance<0?shaftAxis:direction,distance).applyMatrix4(view.matrixWorldInverse));
  const size=projected.getSize(new THREE.Vector3()),centre=projected.getCenter(new THREE.Vector3());
  const span=isHead?Math.max(headSize.x/aspect,headSize.y/aspect,headSize.z)*1.2:Math.max(32,size.y/.68,size.x/aspect/.84);
  if(!isHead){
   const right=new THREE.Vector3().setFromMatrixColumn(view.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(view.matrixWorld,1);
   // Space above for the head inset; labels occupy a predictable left rail.
   target.addScaledVector(right,centre.x-span*aspect*.03).addScaledVector(up,centre.y+span*.06);
  }
  fit(view,target,span,aspect,locatorState.az,locatorState.el);
  const length=isHead?22:8,markerScale=Math.max(1,span/h*4/.55);marker.scale.setScalar(isHead?7:markerScale);
  // Minimum screen width makes this annotation legible, without scaling tissue.
  const shaftWidth=1;for(const m of [tube,grip,ring]){m.scale.x=shaftWidth;m.scale.z=shaftWidth;}arrow.setDirection(direction);arrow.setLength(length,length*.2,length*.1);
  fill.scale.setScalar(length);fill.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);
  const right=direction.clone().cross(new THREE.Vector3(0,0,1)).normalize(),up=right.clone().cross(direction).normalize(),end=position.clone().addScaledVector(direction,length),radius=length*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),points=fanGeometry.attributes.position.array;let k=0;
  for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16,p=end.clone().addScaledVector(right,radius*Math.cos(a)).addScaledVector(up,radius*Math.sin(a)),q=end.clone().addScaledVector(right,radius*Math.cos(b)).addScaledVector(up,radius*Math.sin(b));for(const v of (i%8===0?[p,q,position,p]:[p,q])){points[k++]=v.x;points[k++]=v.y;points[k++]=v.z;}}
  fanGeometry.attributes.position.needsUpdate=true;fanGeometry.computeBoundingSphere();
  if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
  scene.background=background;joint.visible=!isHead;head.visible=isHead;fan.visible=arrow.visible=fill.visible=true;
  renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.render(scene,view);labels(w,h,isHead);
  const iw=Math.min(112,w*.24),ih=Math.min(100,h*.3);$('#head-inset-label').hidden=isHead;
  if(!isHead){
   joint.visible=false;head.visible=true;fan.visible=fill.visible=false;arrow.visible=true;arrow.setLength(22,4.4,2.2);marker.scale.setScalar(7);
   fit(insetView,headCentre,Math.max(headSize.x/(iw/ih),headSize.y/(iw/ih),headSize.z)*1.15,iw/ih,-35,16);
   scene.background=new THREE.Color('#101b21');renderer.setScissorTest(true);renderer.setScissor(w-iw,h-ih,iw,ih);renderer.setViewport(w-iw,h-ih,iw,ih);renderer.clear();renderer.render(scene,insetView);renderer.setScissorTest(false);
   joint.visible=true;head.visible=false;fan.visible=arrow.visible=fill.visible=true;arrow.setLength(length,length*.2,length*.1);marker.scale.setScalar(markerScale);scene.background=background;
  }
  $('#locator-joint').setAttribute('aria-pressed',String(!isHead));$('#locator-head').setAttribute('aria-pressed',String(isHead));$('#locator-orbit').value=String(locatorState.az);$('#locator-orbit-value').textContent=`${Math.round(locatorState.az)}°`;
  const arrowDirection=new THREE.Vector3(0,1,0).applyQuaternion(arrow.quaternion);
  document.body.dataset.locatorEvidence=JSON.stringify({mode:locatorState.mode,orbit:[locatorState.az,locatorState.el],marker:marker.position.toArray(),direction:arrowDirection.toArray(),cameraDirection:direction.toArray(),positionMatches:marker.position.equals(camera.position),directionError:arrowDirection.distanceTo(direction),tissueTransformsIdentity:tissues.every(m=>m.matrixWorld.equals(new THREE.Matrix4())),sharedJointTissueBuffers:joint.children.every(m=>m.geometry===meshes.find(n=>n.name===m.name).geometry),fov:camera.fov,annotationLength:length,annotationIsInstrument:false,shaftTip:shaft.position.toArray(),shaftAxis:new THREE.Vector3(0,1,0).applyQuaternion(shaft.quaternion).toArray(),shaftIllustrationOnly:false,nominalTelescopeEnvelope:true,diameter:1.9,fullDeviceCAD:false,dov:30,axisAngleDeg:THREE.MathUtils.radToDeg(shaftAxis.angleTo(direction)),shaftDisplayLength:shaftLength,proximalBodyEstimated:true,physicalRollDeg:roll,shaftMinimumScreenWidth:null,headInset:!isHead,coneOrigin:fill.position.toArray(),coneDirection:new THREE.Vector3(0,-1,0).applyQuaternion(fill.quaternion).toArray(),arrowOrigin:arrow.position.toArray(),projectedTip:marker.position.clone().project(view).toArray(),projectedShaftEnd:shaft.localToWorld(new THREE.Vector3(0,-shaftLength,0)).project(view).toArray(),labelAnchors:Object.fromEntries(Object.entries(anchors).map(([k,p])=>[k,p.toArray()]))});
 }
 return {locatorCanvas,locatorState,drawLocator};
}
