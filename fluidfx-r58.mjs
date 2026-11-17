// Suspended blood, tissue debris and bubbles in front of the lens.
// Sprites live at real positions in the joint space, so they slide against the
// walls as the telescope moves. They are carried by three simple currents: an
// outward jet at the irrigation inflow, a sink at the outflow needle and slow
// random drift. No flow field is solved and nothing here is a measurement.
const BLOOD=0,DEBRIS=1,BUBBLE=2;
const vertexShader=`
attribute vec4 particle; // size (mm), kind, opacity, seed
uniform float uScale;
varying float vKind,vOpacity,vSeed,vDistance;
void main(){
 vec4 mv=modelViewMatrix*vec4(position,1.0);
 vDistance=length(mv.xyz);vKind=particle.y;vSeed=particle.w;
 gl_Position=projectionMatrix*mv;
 float px=particle.x*uScale/max(.25,-mv.z);
 // A sprite about to touch the lens fades instead of filling the image.
 vOpacity=particle.z*smoothstep(.3,1.0,-mv.z)*(1.0-smoothstep(170.0,260.0,px));
 gl_PointSize=clamp(px,1.0,256.0);
}`;
const fragmentShader=`
uniform float uLamp;
varying float vKind,vOpacity,vSeed,vDistance;
void main(){
 vec2 c=gl_PointCoord*2.0-1.0;float r2=dot(c,c);if(r2>1.0)discard;
 float light=min(1.5,uLamp/(vDistance*vDistance+.6)),r=sqrt(r2),alpha;vec3 col;
 if(vKind<.5){            // blood: an absorbing cloud that scatters a little red
  alpha=vOpacity*exp(-r2*3.2);col=vec3(.30,.012,.010)*light*(.7+.6*alpha);
 }else if(vKind<1.5){     // debris: a pale irregular flake
  // A soft floccule of fibrin or synovium. Close to the lens it is out of focus.
  float a=atan(c.y,c.x),lobes=1.0+.17*sin(a*2.0+vSeed*40.0)+.09*sin(a*3.0+vSeed*90.0)+.05*sin(a*5.0+vSeed*17.0);
  float q=r/(.6*lobes),soft=mix(.95,.3,smoothstep(1.2,5.0,vDistance));
  alpha=vOpacity*(1.0-smoothstep(1.0-soft,1.0+soft*.4,q))*mix(.45,.8,smoothstep(1.2,5.0,vDistance));col=vec3(.80,.73,.66)*light;
 }else{                   // bubble: bright rim and one small highlight
  float rim=smoothstep(.62,.9,r)*(1.0-smoothstep(.9,1.0,r));vec2 h=c-vec2(-.35,.4);float glint=exp(-dot(h,h)*18.0);
  alpha=vOpacity*clamp(rim*.75+glint+.06,0.0,1.0);col=vec3(.9,.92,.95)*light*(.6+2.5*glint);
 }
 if(alpha<.003)discard;
 gl_FragColor=vec4(col,alpha);
}`;
export function createFluidParticles(T,{capacity=560}={}){
 const position=new Float32Array(capacity*3),particle=new Float32Array(capacity*4),velocity=new Float32Array(capacity*3);
 const age=new Float32Array(capacity),life=new Float32Array(capacity),kind=new Uint8Array(capacity),size0=new Float32Array(capacity),size1=new Float32Array(capacity),strength=new Float32Array(capacity);
 const geometry=new T.BufferGeometry();
 const positionAttribute=new T.BufferAttribute(position,3),particleAttribute=new T.BufferAttribute(particle,4);
 positionAttribute.setUsage(T.DynamicDrawUsage);particleAttribute.setUsage(T.DynamicDrawUsage);
 geometry.setAttribute('position',positionAttribute);geometry.setAttribute('particle',particleAttribute);
 // Alpha in the lens buffer stores view distance, so sprites must leave it untouched.
 const material=new T.ShaderMaterial({uniforms:{uScale:{value:600},uLamp:{value:6.4}},vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,
  blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,blendEquationAlpha:T.AddEquation,blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor});
 const points=new T.Points(geometry,material);points.frustumCulled=false;points.renderOrder=10;points.name='suspended-fluid-sprites';points.visible=false;
 let state=90210,emit=0,removed=0;const counts=[0,0,0];
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const signed=()=>random()*2-1;
 function spawn(type,p,v,{seconds,from,to,opacity}){
  let slot=-1;for(let i=0;i<capacity;i++)if(life[i]<=0){slot=i;break;}
  if(slot<0)return false;
  position.set(p,slot*3);velocity.set(v,slot*3);age[slot]=0;life[slot]=seconds;kind[slot]=type;size0[slot]=from;size1[slot]=to;strength[slot]=opacity;
  particle[slot*4+1]=type;particle[slot*4+3]=random();counts[type]++;return true;
 }
 function kill(i,sink=false){if(life[i]<=0)return;life[i]=0;counts[kind[i]]--;particle[i*4]=0;particle[i*4+2]=0;if(sink)removed++;}
 // env: tip, forward (view direction), axis (shaft), inside (lens in the irrigated space),
 // range (distance to the wall ahead), bleed {point, rate 0..1}, blood 0..1 (mixed level),
 // inflow 0..1, sink {point, strength} or null, debris 0..1, bubbles 0..1, buoyancy [x,y,z].
 function step(dt,env){
  points.visible=!!env.inside;
  if(!env.inside){if(counts[0]+counts[1]+counts[2])for(let i=0;i<capacity;i++)kill(i);return summary();}
  dt=Math.min(.05,Math.max(0,dt));
  const {tip,forward,axis}=env,range=Math.max(2.5,Math.min(11,env.range||7));
  // Fresh blood leaves the capsular puncture and is carried forward along the shaft.
  emit+=dt*(env.bleed?.rate||0)*95;
  while(emit>=1){emit--;const b=env.bleed.point;spawn(BLOOD,[b[0]+signed()*.45,b[1]+signed()*.45,b[2]+signed()*.45],[axis[0]*(1.5+random()*2)+signed()*.8,axis[1]*(1.5+random()*2)+signed()*.8,axis[2]*(1.5+random()*2)+signed()*.8],{seconds:3.2+random()*3,from:.45+random()*.5,to:2.3+random()*1.5,opacity:.42+random()*.2});}
  // Blood already mixed into the fluid keeps a few slow wisps so the veil has depth.
  const seeded=(type,target,make)=>{let guard=6;while(counts[type]<target&&guard-->0){const s=1+random()*(range-1),spread=.55*s;if(!make([tip[0]+forward[0]*s+signed()*spread,tip[1]+forward[1]*s+signed()*spread,tip[2]+forward[2]*s+signed()*spread]))break;}};
  seeded(BLOOD,Math.round((env.blood||0)*46+(env.bleed?.rate||0)*40),p=>spawn(BLOOD,p,[signed()*.5,signed()*.5,signed()*.5],{seconds:4+random()*4,from:1.2+random(),to:2.6+random()*1.6,opacity:.16+.3*(env.blood||0)}));
  seeded(DEBRIS,Math.round((env.debris||0)*48),p=>{const size=.05+random()*random()*.2;return spawn(DEBRIS,p,[signed()*.3,signed()*.3,signed()*.3],{seconds:14+random()*22,from:size,to:size,opacity:.5+random()*.4});});
  seeded(BUBBLE,Math.round((env.bubbles||0)*26),p=>spawn(BUBBLE,p,[signed()*.3,signed()*.3,signed()*.3],{seconds:6+random()*10,from:.10+random()*.22,to:.10+random()*.22,opacity:.75}));
  const inflow=env.inflow||0,sink=env.sink,buoyancy=env.buoyancy||[0,0,0];
  for(let i=0;i<capacity;i++){
   if(life[i]<=0)continue;
   age[i]+=dt;if(age[i]>=life[i]){kill(i);continue;}
   const j=i*3,x=position[j],y=position[j+1],z=position[j+2],type=kind[i];
   let rx=x-tip[0],ry=y-tip[1],rz=z-tip[2];const d2=rx*rx+ry*ry+rz*rz,ahead=rx*forward[0]+ry*forward[1]+rz*forward[2];
   if(d2>256||ahead<-3.5){kill(i);continue;}
   // Target velocity: slow wandering, inflow jet away from the lens, pull toward the outflow.
   let vx=signed()*.9,vy=signed()*.9,vz=signed()*.9;
   const jet=inflow*6.5/(d2+1.6);vx+=rx*jet+forward[0]*inflow*1.2;vy+=ry*jet+forward[1]*inflow*1.2;vz+=rz*jet+forward[2]*inflow*1.2;
   if(sink){const sx=sink.point[0]-x,sy=sink.point[1]-y,sz=sink.point[2]-z,s2=sx*sx+sy*sy+sz*sz;if(s2<.3){kill(i,true);continue;}const pull=sink.strength/(s2*.22+.5);vx+=sx*pull;vy+=sy*pull;vz+=sz*pull;}
   if(type===BUBBLE){vx+=buoyancy[0]*1.6;vy+=buoyancy[1]*1.6;vz+=buoyancy[2]*1.6;}
   else if(type===DEBRIS){vx-=buoyancy[0]*.12;vy-=buoyancy[1]*.12;vz-=buoyancy[2]*.12;}
   const follow=Math.min(1,dt*3.5);
   velocity[j]+=(vx-velocity[j])*follow;velocity[j+1]+=(vy-velocity[j+1])*follow;velocity[j+2]+=(vz-velocity[j+2])*follow;
   position[j]=x+velocity[j]*dt;position[j+1]=y+velocity[j+1]*dt;position[j+2]=z+velocity[j+2]*dt;
   const u=age[i]/life[i],fade=Math.min(1,u*6)*Math.min(1,(1-u)*(type===BLOOD?2.2:5));
   particle[i*4]=size0[i]+(size1[i]-size0[i])*u;particle[i*4+2]=strength[i]*fade;
  }
  positionAttribute.needsUpdate=true;particleAttribute.needsUpdate=true;
  return summary();
 }
 function summary(){return{blood:counts[0],debris:counts[1],bubbles:counts[2],alive:counts[0]+counts[1]+counts[2],removedAtOutflow:removed};}
 function clear(){for(let i=0;i<capacity;i++)kill(i);emit=0;positionAttribute.needsUpdate=true;particleAttribute.needsUpdate=true;}
 // Sprite size is in millimetres: convert with the lens buffer height and field of view.
 function setProjection(heightPixels,fovDegrees){material.uniforms.uScale.value=heightPixels/(2*Math.tan(fovDegrees*Math.PI/360));}
 return{points,step,clear,setProjection,summary,capacity,measured:false};
}
