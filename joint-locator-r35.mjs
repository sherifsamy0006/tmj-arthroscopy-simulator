import {roofIndices} from './assets/joint-r35/roof-patch.mjs';
// Teaching-only display. Source buffers, scope camera and clinical coordinates
// are never changed by separation, cutaways, orbit or fitting this view.
export function createJointMap({THREE,renderer,canvas,svg,meshes,cavityGeometry,anchorMeshes=[]}){
 const V=a=>new THREE.Vector3(...a),ns='http://www.w3.org/2000/svg';
 const scene=new THREE.Scene();scene.background=new THREE.Color('#0c1921');
 const camera=new THREE.OrthographicCamera();camera.up.set(0,0,1);camera.near=.1;camera.far=2000;
 renderer.localClippingEnabled=true;
 scene.add(new THREE.AmbientLight(0xffffff,1.5));
 for(const [p,intensity]of[[[40,-60,80],2],[[-35,25,20],.8]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.copy(V(p));scene.add(light);}
 const colours={temporal:'#d3c7b5',disc:'#b69dc4',condyle:'#c9bea9'};
 const surfaces=['temporal','disc','condyle'].map(name=>{
  const source=meshes.find(m=>m.name===name),material=new THREE.MeshStandardMaterial({color:colours[name],roughness:.72,side:THREE.DoubleSide});
  let geometry=source.geometry;if(name==='temporal'){geometry=new THREE.BufferGeometry();for(const[k,a]of Object.entries(source.geometry.attributes))geometry.setAttribute(k,a);geometry.setIndex(roofIndices);}
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;scene.add(mesh);
  // Crop only the teaching copy to the local articular region. No source edit.
  const planes=[new THREE.Plane(V([1,0,0]),15),new THREE.Plane(V([-1,0,0]),15),new THREE.Plane(V([0,1,0]),11),new THREE.Plane(V([0,-1,0]),11),new THREE.Plane(V([0,0,1]),10),new THREE.Plane(V([0,0,-1]),10)];
  material.clippingPlanes=name==='disc'?[]:planes;
  return{name,source,mesh,planes};
 });
 const anchors=anchorMeshes.map(source=>{const mesh=source.clone();scene.add(mesh);return{source,mesh};});
 const annotation=c=>new THREE.MeshBasicMaterial({color:c,depthTest:false,depthWrite:false,transparent:true});
 const lens=new THREE.Mesh(new THREE.SphereGeometry(.48,18,12),annotation('#59caff'));lens.renderOrder=20;scene.add(lens);
 const target=new THREE.Mesh(new THREE.SphereGeometry(.32,14,10),annotation('#ffc477'));target.renderOrder=21;scene.add(target);
 const crossing=new THREE.Mesh(new THREE.SphereGeometry(.32,14,10),annotation('#df92d5'));crossing.renderOrder=21;scene.add(crossing);
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,12,20),annotation('#9ebcc8'));shaft.geometry.translate(0,-6,0);shaft.renderOrder=16;scene.add(shaft);
 const arrow=new THREE.ArrowHelper(V([1,0,0]),new THREE.Vector3(),5,0x59caff,.9,.4);scene.add(arrow);for(const m of[arrow.line,arrow.cone]){m.material.depthTest=false;m.material.depthWrite=false;m.material.transparent=true;m.renderOrder=22;}
 const conePoints=[],length=5,radius=length*Math.tan(THREE.MathUtils.degToRad(32.5));
 for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16,p=[radius*Math.cos(a),radius*Math.sin(a),length],q=[radius*Math.cos(b),radius*Math.sin(b),length];conePoints.push(...p,...q);if(i%8===0)conePoints.push(0,0,0,...p);}
 const coneGeometry=new THREE.BufferGeometry();coneGeometry.setAttribute('position',new THREE.Float32BufferAttribute(conePoints,3));
 const cone=new THREE.LineSegments(coneGeometry,new THREE.LineBasicMaterial({color:'#59caff',transparent:true,opacity:.65,depthTest:false,depthWrite:false}));cone.renderOrder=18;scene.add(cone);
 const connectionGeometry=new THREE.BufferGeometry();connectionGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));
 const connection=new THREE.Line(connectionGeometry,new THREE.LineDashedMaterial({color:'#ffc477',dashSize:.4,gapSize:.3,transparent:true,opacity:.7,depthTest:false,depthWrite:false}));connection.renderOrder=19;scene.add(connection);
 const cavity=cavityGeometry?new THREE.Mesh(cavityGeometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})):null,ray=new THREE.Raycaster();
 let drawCount=0,fitKey='',fitState,exitKey='',exit=null,containKey='',inside=true;
 function element(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;}
 function point(p,w,h){const q=p.clone().project(camera);return[(1+q.x)*w/2,(1-q.y)*h/2];}
 function fit(orbit,separated,w,h){
  const key=[orbit.az,orbit.el,orbit.zoom||1,separated,w,h].join('/');if(key===fitKey)return;fitKey=key;
  const a=THREE.MathUtils.degToRad(orbit.az),e=THREE.MathUtils.degToRad(orbit.el),centre=V([0,0,separated?1:0]);
  camera.position.copy(centre).addScaledVector(V([Math.cos(a)*Math.cos(e),Math.sin(a)*Math.cos(e),Math.sin(e)]),500);camera.lookAt(centre);camera.updateMatrixWorld();
  // Fixed local-joint box, independent of lens position, optical direction,
  // full instrument dimensions and current tissue displacement.
  const bounds=new THREE.Box3(),p=new THREE.Vector3();for(const x of[-15,15])for(const y of[-11,11])for(const z of[separated?-23:-10,separated?27:10])bounds.expandByPoint(p.set(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  const size=bounds.getSize(new THREE.Vector3()),mid=bounds.getCenter(new THREE.Vector3()),aspect=w/h,span=Math.max(size.y/.82,size.x/aspect/.72,35)*(orbit.zoom||1);
  centre.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),mid.x-span*aspect*.08).addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),mid.y);
  camera.position.copy(centre).addScaledVector(V([Math.cos(a)*Math.cos(e),Math.sin(a)*Math.cos(e),Math.sin(e)]),500);camera.lookAt(centre);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();camera.updateMatrixWorld();fitState={centre:centre.toArray(),position:camera.position.toArray(),span};
 }
 function draw({position,direction,shaftAxis,first,orbit,separated=true,showAnchors=false}){
  const w=Math.max(1,Math.round(canvas.clientWidth)),h=Math.max(1,Math.round(canvas.clientHeight));fit(orbit,separated,w,h);
  for(const r of surfaces){const dz=separated?(r.name==='temporal'?17:r.name==='condyle'?-13:0):0;r.mesh.position.z=dz;r.planes[4].constant=10-dz;r.planes[5].constant=10+dz;
   // Assembled mode removes the near half of the roof to reveal the interval.
   r.planes[2].constant=r.name==='temporal'&&!separated?0:11;
  }
  for(const a of anchors){a.mesh.position.copy(a.source.position);a.mesh.visible=showAnchors&&!separated;}
  lens.position.copy(position);shaft.position.copy(position);shaft.quaternion.setFromUnitVectors(V([0,1,0]),shaftAxis);arrow.position.copy(position);arrow.setDirection(direction);cone.position.copy(position);cone.quaternion.setFromUnitVectors(V([0,0,1]),direction);
  const visibleHit=first&&surfaces.find(r=>r.name===first.object.name);target.visible=connection.visible=!!first;
  if(first){target.position.copy(first.point);target.position.z+=visibleHit?.mesh.position.z||0;connectionGeometry.attributes.position.array.set([...position.toArray(),...target.position.toArray()]);connectionGeometry.attributes.position.needsUpdate=true;connectionGeometry.computeBoundingSphere();connection.computeLineDistances();}
  if(cavity){
   const key=[...position.toArray(),cavityGeometry.attributes.position.version].join('/');
   if(key!==containKey){containKey=key;ray.set(position,V([.337,.571,.749]).normalize());ray.near=.00001;ray.far=Infinity;const hits=ray.intersectObject(cavity),unique=hits.filter((v,i)=>i===0||v.distance-hits[i-1].distance>1e-5);inside=unique.length%2===1;}
   const ek=key+'/'+shaftAxis.toArray().join('/');if(ek!==exitKey){exitKey=ek;ray.set(position,shaftAxis.clone().negate());ray.near=.00001;ray.far=12;exit=inside?ray.intersectObject(cavity)[0]?.point.clone()||null:null;}
  }
  crossing.visible=!!exit;if(exit)crossing.position.copy(exit);
  if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
  renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.render(scene,camera);
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  function label(text,p,y,colour='#d5e4e9'){const[x,py]=point(p,w,h),ty=Math.max(48,Math.min(h-50,y??py));const tx=12;const lead=Math.min(w*.37,tx+text.length*5.7);element('path',{d:`M${lead} ${ty-4} L${x} ${py}`,stroke:colour,'stroke-width':.7,fill:'none',opacity:.55});element('text',{x:tx,y:ty,fill:colour,class:'locator35-label '+(colour==='#7fdcce'?'locator35-superior':colour==='#f0bd78'?'locator35-inferior':colour==='#d0b4df'?'locator35-disc':'')},text);}
  element('text',{x:12,y:23,fill:inside?'#71d2fa':'#ffc477',class:'locator35-status locator35-lens'},inside?'LENS · SUPERIOR SPACE':'LENS · OUTSIDE UPPER ENVELOPE');
  if(separated){
   label('Temporal roof',V([0,0,21]),h*.17);
   label('Superior space',V([0,0,10]),h*.34,'#7fdcce');
   label('Disc',V([0,0,0]),h*.51,'#d0b4df');
   label('Inferior space',V([0,0,-11]),h*.69,'#f0bd78');
   label('Condyle',V([0,0,-20]),h*.86);
  }else{label('Temporal roof',V([0,2,5]),h*.22);label('Disc',V([0,0,0]),h*.54,'#d0b4df');label('Condyle',V([0,0,-6]),h*.78);}
  // A direct callout identifies the small lens without moving it into an
  // artificially enlarged gap. A single dashed line links its actual target.
  const [lx,ly]=point(position,w,h),lx2=Math.min(w-42,Math.max(w*.52,lx+20)),ly2=Math.max(42,Math.min(h-40,ly-22));element('circle',{cx:lx,cy:ly,r:6,fill:'none',stroke:'#59caff','stroke-width':1.5});element('path',{d:`M${lx} ${ly} L${lx2} ${ly2+3}`,stroke:'#59caff','stroke-width':1,fill:'none'});element('text',{x:lx2,y:ly2,fill:'#59caff',class:'locator35-label locator35-lens'},'Lens');
  const base=new THREE.Vector3().project(camera),cx=w-39,cy=h-37;
  for(const [text,v]of[['S',[0,0,1]],['A',[0,1,0]],['L',[1,0,0]]]){const p=V(v).project(camera),dx=(p.x-base.x)*w,dy=-(p.y-base.y)*h,n=Math.hypot(dx,dy)||1;element('path',{d:`M${cx} ${cy} L${cx+dx/n*15} ${cy+dy/n*15}`,stroke:'#a4b5bf','stroke-width':1,fill:'none'});element('text',{x:cx+dx/n*25,y:cy+dy/n*25+3,'text-anchor':'middle',fill:'#a4b5bf',class:'locator35-axis'},text);}
  element('text',{x:12,y:h-12,fill:'#9ab3be',class:'locator35-axis'},separated?'Display gaps enlarged · lens coordinates unchanged':'Local cutaway · assembled coordinates');
  return{frameNumber:++drawCount,revision:'r35',mode:separated?'separated':'assembled',orbit:[orbit.az,orbit.el],frame:fitState,frameFollowsScope:false,marker:position.toArray(),direction:direction.toArray(),cameraDirection:direction.toArray(),positionMatches:lens.position.equals(position),directionError:new THREE.Vector3(0,1,0).applyQuaternion(arrow.quaternion).distanceTo(direction),sharedJointTissueBuffers:surfaces.every(r=>r.mesh.geometry.attributes.position===r.source.geometry.attributes.position),sourceTransformsIdentity:meshes.every(m=>m.position.lengthSq()===0),visibleTissues:surfaces.map(r=>r.name),visibleAnchors:anchors.filter(a=>a.mesh.visible).length,roofSourceTriangleSubset:roofIndices.length/3,tissueOffsets:Object.fromEntries(surfaces.map(r=>[r.name,r.mesh.position.z])),displayOnlyCutaway:true,displayOnlySeparation:separated,compartment:inside?'superior':'outside-superior-envelope',inferiorLensPreset:false,shaftTip:position.toArray(),shaftAxis:shaftAxis.toArray(),shaftDisplayLength:12,shaftIsOrientationSymbol:true,annotationLength:length,fov:65,dov:30,axisAngleDeg:THREE.MathUtils.radToDeg(shaftAxis.angleTo(direction)),coneOrigin:position.toArray(),coneDirection:direction.toArray(),boundaryCrossing:exit?.toArray()||null,boundaryIsClinicalPortal:false,headInset:false,visibleTarget:first?.object.name||null};
 }
 return{draw};
}
