// Lens display pass: the look of a small wide-angle telescope and of the fluid in
// front of it. The joint is first rendered in linear light with view distance in
// alpha; this pass adds barrel distortion, near-field defocus, highlight bloom,
// blood absorption along each line of sight, the field stop and tone mapping.
// Illustrative: no lens element, sensor response or blood concentration is measured.
import {VIEW_FAR} from './materials-r58.mjs';

const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const fragmentShader=`
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene,tPrev;
uniform vec2 uTexel,uFlow;
uniform float uLook;
uniform float uDissolve,uTime,uExposure,uBlood,uHaze,uOcclusion,uStandby,uCollapse,uNotch,uNotchOn,uFar,uDefocus,uGlow,uOptics;
const float STOP=.972;      // field stop radius in the square image
const float BARREL=.19;     // wide-angle distortion: centre magnified, periphery compressed
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.0;for(int i=0;i<4;i++){s+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
// Explicit level 0: the buffers have no mip chain and the taps sit inside a loop.
vec4 scene(vec2 uv){vec4 c=texture2DLodEXT(tScene,uv,0.0);return uDissolve>0.0?mix(c,texture2DLodEXT(tPrev,uv,0.0),uDissolve):c;}
vec3 RRTAndODTFit(vec3 v){vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return a/b;}
vec3 aces(vec3 color){
 const mat3 inputMat=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));
 const mat3 outputMat=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
 return clamp(outputMat*RRTAndODTFit(inputMat*(color/.6)),0.0,1.0);
}
vec3 encode(vec3 c){return mix(pow(c,vec3(.41666))*1.055-.055,c*12.92,vec3(lessThanEqual(c,vec3(.0031308))));}
void main(){
 vec2 p=vUv*2.0-1.0;float r=length(p);
 float angle=atan(p.y,p.x),away=abs(atan(sin(angle-uNotch),cos(angle-uNotch)));
 // Index mark on the field stop: it sits on the side the angled lens looks toward.
 // A small triangular tab, widest at the rim.
 float inset=STOP-r,notch=uNotchOn*smoothstep(.004,-.004,away-.05*(1.0-inset/.052));
 float field=(1.0-smoothstep(STOP-.014,STOP,r))*(1.0-notch);
 if(field<=0.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
 vec2 q=p/STOP;float rn=length(q);
 float barrel=BARREL*uOptics;
 vec2 src=q*(1.0+barrel*rn*rn)/(1.0+barrel),uv=src*.5+.5;
 vec4 centre=scene(uv);float dist=centre.a*uFar;
 // Tissue almost touching the lens is out of focus; the periphery is slightly softer.
 float scale=1.0/(600.0*uTexel.x);
 float blur=(1.0+6.5*smoothstep(2.6,.3,dist)+2.0*rn*rn+12.0*uDefocus+30.0*uOcclusion)*scale*uOptics+.35;
 vec3 col=centre.rgb,glare=max(centre.rgb-1.15,0.0);
 for(int i=0;i<8;i++){
  float a=float(i)*2.39996323,rad=sqrt((float(i)+.5)/8.0);vec2 o=vec2(cos(a),sin(a))*rad;
  vec3 s=scene(uv+o*blur*uTexel).rgb;col+=s;
  glare+=max(scene(uv+o*(blur+13.0*scale)*uTexel).rgb-1.15,0.0);
 }
 col/=9.0;glare/=9.0;
 // Lateral colour toward the edge of the field.
 float ca=.0042*rn*rn*uOptics;
 col.r=mix(col.r,scene(src*(1.0+ca)*.5+.5).r,.6);col.b=mix(col.b,scene(src*(1.0-ca)*.5+.5).b,.6);
 col+=glare*.34*uOptics;
 // Blood suspended in the irrigation fluid: haemoglobin removes green and blue along the
 // path to each surface and scatters the lamp back as a red veil. Drifting noise keeps
 // the cloud uneven, like blood that has not finished mixing.
 float path=min(dist,30.0)+1.5;
 vec2 w=src*1.5+uFlow*uTime*.045;
 float swirl=fbm(w+1.7*vec2(fbm(w*1.8+uTime*.031),fbm(w*1.6-uTime*.026)));
 float strand=pow(1.0-abs(fbm(w*2.7+vec2(3.7,1.2)+uTime*.017)*2.0-1.0),5.0);
 float conc=uBlood*(.5+1.05*swirl)+uBlood*(1.0-.6*uBlood)*strand*.7;
 vec3 through=exp(-vec3(.016,.20,.17)*conc*path*3.0);
 float veil=1.0-exp(-conc*path*.30);
 col=col*through+vec3(.42,.017,.015)*veil*uGlow;
 // Faint turbidity: fine bubbles and tissue debris too small to resolve.
 col=mix(col,vec3(.60,.58,.55)*uGlow,uHaze*(1.0-exp(-path*.09)));
 // Lens buried in soft tissue outside the joint: a featureless red-brown blur.
 vec3 tissue=vec3(.36,.075,.05)*(.45+.9*fbm(src*2.2+uTime*.012))*(1.15-.75*rn);
 col=mix(col,tissue,uOcclusion);
 // Suction without inflow: the walls close on the lens and the field darkens from the rim.
 col*=mix(1.0,smoothstep(1.05,.2,rn)*.82+.05,uCollapse);
 col*=(1.0-uStandby)*uExposure*(1.0-.30*pow(rn,2.4)*uOptics);
 // r60 camera looks (illustrative, not calibrated). 1 = clinical camera: the lamp at the tip
 // falls off with distance, so near tissue glows and the far joint sinks into shadow; deeper
 // vignette. 2 = the same plus floating synovial fibrils and a faint irrigation shimmer.
 float lookOn=min(uLook,1.0);
 col*=mix(1.0,1.30/(1.0+pow(max(dist-1.5,0.0)/5.0,2.0)),lookOn);
 col*=mix(1.0,1.0-.30*pow(rn,2.2),lookOn*uOptics);
 if(uLook>1.5){
  vec2 fw=src*3.2+vec2(uTime*.021,-uTime*.013);
  float fib=pow(1.0-abs(fbm(fw+fbm(fw*1.3)*1.8)*2.0-1.0),60.0)*smoothstep(.45,.8,fbm(src*1.4+7.0))*smoothstep(.25,.8,rn);
  col=mix(col,col*1.25+vec3(.10,.08,.07),fib*.45*smoothstep(1.0,.2,rn));
  col*=1.0+.05*(fbm(src*9.0+uTime*.08)-.5);
 }
 // Tissue scatters light into its own shadows: a soft toe keeps them open.
 col=pow(encode(aces(col)),vec3(mix(.88,1.0,lookOn)));
 // The tone curve greys bright tissue; a camera head renders it rosier.
 col=clamp(mix(vec3(dot(col,vec3(.2126,.7152,.0722))),col,mix(1.16,1.0,lookOn)),0.0,1.0);
 // Clinical camera: slightly warm white balance and a gentle S-curve for contrast.
 col=mix(col,clamp(col*vec3(1.0,1.01,.96),0.0,1.0),lookOn);
 col=mix(col,col*col*(3.0-2.0*col),lookOn*.35);
 col+=(hash(gl_FragCoord.xy+fract(uTime)*91.7)-.5)*.022*uOptics;
 gl_FragColor=vec4(col*field,1.0);
}`;

export function createLensFX(T,renderer){
 const hdr=renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float');
 const target=()=>new T.WebGLRenderTarget(4,4,{type:hdr?T.HalfFloatType:T.UnsignedByteType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false,samples:4,generateMipmaps:false});
 let current=target(),previous=target(),width=4,height=4,previousValid=false;
 const uniforms={tScene:{value:current.texture},tPrev:{value:previous.texture},uTexel:{value:new T.Vector2(1/4,1/4)},uFlow:{value:new T.Vector2(.6,-.35)},
  uLook:{value:0},uDissolve:{value:0},uTime:{value:0},uExposure:{value:1.05},uBlood:{value:0},uHaze:{value:0},uOcclusion:{value:0},uStandby:{value:0},uCollapse:{value:0},
  uNotch:{value:0},uNotchOn:{value:1},uFar:{value:VIEW_FAR},uDefocus:{value:0},uGlow:{value:.6},uOptics:{value:1}};
 const material=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),material);quad.frustumCulled=false;
 const stage=new T.Scene();stage.add(quad);const eye=new T.OrthographicCamera(-1,1,1,-1,0,1);
 return{
  hdr,
  setSize(w,h){w=Math.max(1,Math.floor(w));h=Math.max(1,Math.floor(h));if(w===width&&h===height)return false;width=w;height=h;current.setSize(w,h);previous.setSize(w,h);previousValid=false;uniforms.uTexel.value.set(1/w,1/h);return true;},
  // Draw the joint into the linear buffer. The canvas is untouched until present().
  renderScene(scene,camera){renderer.setRenderTarget(current);renderer.render(scene,camera);renderer.setRenderTarget(null);},
  // Keep the image on screen as the starting point of a cross-dissolve. The caller
  // must draw the changed joint again before the next present().
  keepPrevious(){[current,previous]=[previous,current];uniforms.tScene.value=current.texture;uniforms.tPrev.value=previous.texture;previousValid=true;return previousValid;},
  present(state){
   uniforms.uLook.value=state.look||0;
   uniforms.uDissolve.value=previousValid?Math.max(0,Math.min(1,state.dissolve||0)):0;
   uniforms.uTime.value=state.time||0;uniforms.uExposure.value=state.exposure;
   uniforms.uBlood.value=state.blood||0;uniforms.uHaze.value=state.haze||0;uniforms.uOcclusion.value=state.occlusion||0;
   uniforms.uStandby.value=state.standby||0;uniforms.uCollapse.value=state.collapse||0;uniforms.uDefocus.value=state.defocus||0;
   uniforms.uNotch.value=state.notch||0;uniforms.uNotchOn.value=state.notchVisible===false?0:1;uniforms.uOptics.value=state.optics===false?0:1;
   if(state.flow)uniforms.uFlow.value.set(state.flow[0],state.flow[1]);
   renderer.setRenderTarget(null);renderer.render(stage,eye);
  },
  get size(){return[width,height];}
 };
}
