// r58 appearance: warmer wet tissue, finer capillaries and a view-distance channel for the
// lens fluid pass. Procedural and informed by arthroscopy references, not measured tissue optics.
// No image is projected onto anatomy and no vertex displacement changes the cavity.
import {vascularTexture} from './vascular-r58.mjs';
import {tissueWeights} from './lining-r42.mjs';
export function tissueMaterial(T,layer,name='',{lining=false}={}){
 const base=tissueWeights(['bone','temporal','condyle'].includes(layer)?'temporal':layer==='disc'?'disc':layer.startsWith('retro')?'retro':name);
 const m=new T.MeshPhysicalMaterial({color:'#ffffff',roughness:.5,metalness:0,clearcoat:.5,clearcoatRoughness:.14,ior:1.37,sheen:.45,sheenRoughness:.6,sheenColor:new T.Color('#ff9aa6'),side:T.DoubleSide});
 m.shadowSide=T.BackSide;const enabled={value:1};m.userData.textureUniform=enabled;
 m.userData.appearance={model:'r58',lining,displacement:0,measuredOptics:false};
 m.onBeforeCompile=s=>{
  s.uniforms.vascularMap={value:vascularTexture(T)};s.uniforms.microtexture=enabled;s.uniforms.tissueBase={value:new T.Vector4(...base)};
  s.vertexShader=`varying vec3 vTissue; varying vec3 vRestNormal; varying vec4 vTissueMix; uniform vec4 tissueBase;
  ${lining?'attribute vec3 tissueRest; attribute vec3 tissueRestNormal; attribute vec4 tissueMix;':''}
  `+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  vRestNormal=${lining?'tissueRestNormal':'normal'};vTissue=${lining?'tissueRest':'position'};vTissueMix=${lining?'tissueMix':'tissueBase'};`);
  s.fragmentShader=`varying vec3 vTissue; varying vec3 vRestNormal; varying vec4 vTissueMix; uniform float microtexture; uniform sampler2D vascularMap;
  float tissueHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float tissueNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.0-15.0)+10.0);return mix(mix(mix(tissueHash(i),tissueHash(i+vec3(1,0,0)),f.x),mix(tissueHash(i+vec3(0,1,0)),tissueHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(tissueHash(i+vec3(0,0,1)),tissueHash(i+vec3(1,0,1)),f.x),mix(tissueHash(i+vec3(0,1,1)),tissueHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float tissueFbm(vec3 p){return tissueNoise(p)*.64+tissueNoise(p*2.07+11.0)*.25+tissueNoise(p*4.13+23.0)*.11;}
  vec3 tissueBump(vec3 p,vec3 n,float h){
   vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,n),r2=cross(n,dx);
   float determinant=dot(dx,r1);
   if(abs(determinant)<1.e-10)return n;
   return normalize(abs(determinant)*n-sign(determinant)*(dFdx(h)*r1+dFdy(h)*r2));
  }
  vec3 tissueHemisphere(vec3 n,vec3 geometric){
   return normalize(n+geometric*max(0.0,.08-dot(n,geometric)));
  }
  `+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec4 region=vTissueMix/max(dot(vTissueMix,vec4(1.0)),.001);
  float articular=region.x,disc=region.y,vascular=region.z,lining=region.w;
  // Linear RGB values: ivory articular covering, pearl disc, warm synovial lining.
  vec3 albedo=articular*vec3(.90,.80,.77)+disc*vec3(.93,.86,.83)+vascular*vec3(.82,.36,.36)+lining*vec3(.88,.56,.55);
  float broad=tissueFbm(vTissue*.48);
  float collagen=tissueFbm(vTissue*vec3(2.1,9.0,3.5)+tissueNoise(vTissue*.8)*1.2);
  // Fade relief frequencies that the current pixel cannot resolve.
  float footprint=max(length(dFdx(vTissue)),length(dFdy(vTissue)));
  float fibreVisible=1.0-smoothstep(.07,.19,footprint);
  float grainVisible=1.0-smoothstep(.012,.045,footprint);
  // Restrained curved collagen bundles in rest coordinates, with pixel filtering.
  float fibrePhase=vTissue.y*58.0+tissueFbm(vTissue*vec3(1.1,.6,.9))*18.0+sin(vTissue.x*1.7)*3.2;
  float bundleEnvelope=smoothstep(.30,.70,tissueFbm(vTissue*vec3(1.8,.35,1.5)+19.0));
  float fibreAA=1.0-smoothstep(.45,2.5,fwidth(fibrePhase));
  float bundles=pow(1.0-abs(tissueFbm(vTissue*vec3(2.8,18.0,4.1)+tissueFbm(vTissue*.7)*2.0)*2.0-1.0),14.0)*fibreAA*bundleEnvelope;
  float grain=mix(.5,tissueNoise(vTissue*22.0),grainVisible);
  float mottling=tissueFbm(vTissue*.85+vec3(7.3,12.1,3.7));
  float wetFilm=tissueNoise(vTissue*1.7+vec3(17.0,3.0,4.0));
  // Branching pigment remains attached to the undeformed tissue coordinates.
  // Triplanar weights avoid stretched UVs around a recess; no vessel geometry
  // is added to the cavity and central disc/articular surfaces stay avascular.
  vec3 tri=pow(abs(normalize(vRestNormal)),vec3(6.0));tri/=max(dot(tri,vec3(1.0)),.001);
  vec3 coord=vTissue/12.0;
  float vessels=texture2D(vascularMap,coord.yz).r*tri.x
   +texture2D(vascularMap,coord.xz+vec2(.31,.57)).r*tri.y
   +texture2D(vascularMap,coord.xy+vec2(.63,.19)).r*tri.z;
  float vascularity=vascular*1.0+lining*.85;
  float halo=texture2D(vascularMap,coord.yz).g*tri.x
   +texture2D(vascularMap,coord.xz+vec2(.31,.57)).g*tri.y
   +texture2D(vascularMap,coord.xy+vec2(.63,.19)).g*tri.z;
  // A second, finer capillary scale; faded where a pixel cannot resolve it.
  vec3 fine=vTissue/4.6+vec3(.37,.11,.73);
  float capillaries=(texture2D(vascularMap,fine.yz).r*tri.x+texture2D(vascularMap,fine.xz+vec2(.17,.43)).r*tri.y+texture2D(vascularMap,fine.xy+vec2(.71,.29)).r*tri.z)*(1.0-smoothstep(.035,.11,footprint));
  // Vessels gather in patches, leaving pale avascular areas between them.
  float vesselPatch=smoothstep(.34,.66,tissueFbm(vTissue*.33+vec3(4.1,8.7,1.9)));
  // Spatial colour variation is strongest in soft lining, restrained on disc.
  float soft=vascular+lining;
  albedo*=1.0+microtexture*((broad-.5)*.15+(collagen-.5)*.055*fibreVisible+(grain-.5)*.012);
  albedo+=microtexture*soft*(mottling-.5)*vec3(.12,-.10,-.09);
  albedo=mix(albedo,albedo*vec3(1.04,.80,.76),microtexture*soft*vesselPatch*.45);
  albedo=mix(albedo,albedo*vec3(1.0,.70,.66),clamp(halo*vascularity*microtexture*.42*(.45+vesselPatch),0.0,.34));
  albedo=mix(albedo,vec3(.50,.045,.04),clamp(vessels*vascularity*microtexture*1.25*(.35+vesselPatch),0.0,.82));
  albedo=mix(albedo,vec3(.56,.07,.06),clamp(capillaries*vascularity*microtexture*.9*vesselPatch,0.0,.6));
  albedo*=1.0-microtexture*(articular+disc)*bundles*.022;
  diffuseColor.rgb*=albedo;
  // Broad irregular relief is shading only; it cannot change a boundary or silhouette.
  // Smooth noise derivatives avoid artificial grid creases on the mucosa.
  float mesoVisible=1.0-smoothstep(.12,.35,footprint);
  vec3 warped=vTissue+vec3(tissueNoise(vTissue*.9),tissueNoise(vTissue*.9+13.0),tissueNoise(vTissue*.9+29.0))*.24;
  float meso=tissueFbm(warped*vec3(2.2,3.8,2.7));
  float folds=tissueNoise(warped*vec3(1.8,5.0,2.1));
  float relief=soft*((meso-.5)*.025+(folds-.5)*.018)*mesoVisible;
  // Irregular fine connective strands; discontinuous and branched rather than
  // evenly spaced stripes. All coordinates remain attached to the rest tissue.
  vec3 strandP=vTissue*vec3(4.5,1.0,3.0)+tissueFbm(vTissue*1.1)*1.7;
  float strands=pow(1.0-abs(tissueFbm(strandP)*2.0-1.0),12.0);
  float network=pow(1.0-abs(tissueFbm(vTissue*vec3(1.5,7.0,2.5)+9.0)*2.0-1.0),16.0);
  diffuseColor.rgb*=1.0+microtexture*((strands-.38)*.11+(network-.28)*.055)*fibreVisible;
  float tissueHeight=microtexture*(relief+(strands-.38)*(.001+soft*.0025)*fibreVisible+bundles*.0004*(articular+disc)+(collagen-.5)*(.002+soft*.004)*fibreVisible+(grain-.5)*.0004);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  // Illustrative unresolved tissue scattering / saline fill, not calibrated optics.
  totalEmissiveRadiance+=diffuseColor.rgb*vec3(.020,.008,.010)*(0.55+0.45*soft);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>' ,`#include <roughnessmap_fragment>
  roughnessFactor=clamp(.52+lining*.03+vascular*.03+microtexture*((broad-.5)*.12+(wetFilm-.5)*.16),.36,.68);`);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
  // Broken wet-film highlights, rather than a uniform plastic coat.
  material.clearcoat=clamp(.30+microtexture*smoothstep(.30,.70,wetFilm)*.62,.30,.92);
  // Keep Three's normal-variation filter when overriding the authored wet film.
  material.clearcoatRoughness=min(max(.085+microtexture*(.5-wetFilm)*.09,.0525)+geometryRoughness,1.0);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  // Derivative normal has the same view-facing convention as Three's flat normal.
  // Repair only invalid/grazing shading directions; do not blend opposing walls.
  vec3 tissueFace=cross(dFdx(vViewPosition),dFdy(vViewPosition));
  float tissueFaceLength=length(tissueFace);
  if(tissueFaceLength>1.e-10){
   tissueFace/=tissueFaceLength;
   normal=tissueHemisphere(normal,tissueFace);
   nonPerturbedNormal=tissueHemisphere(nonPerturbedNormal,tissueFace);
   normal=tissueHemisphere(tissueBump(-vViewPosition,normal,tissueHeight),tissueFace);
  }`);
 writeDistance(m,s);
 };
 m.customProgramCacheKey=()=>`r58b-${layer}-${name}-${lining}`;
 return m;
}


// The lens pass reads view distance from alpha: fluid absorbs along the actual path to each surface.
export const VIEW_FAR=64;
function writeDistance(material,shader){
 shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
  gl_FragColor.a=clamp(length(vViewPosition)/${VIEW_FAR}.0,0.0,1.0);`);
}
// Instruments inside the joint use the same distance channel as tissue.
export function withViewDistance(material){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{previous?.call(material,shader,renderer);writeDistance(material,shader);};
 const key=material.customProgramCacheKey?.call(material)||'';material.customProgramCacheKey=()=>key+'-view-distance';
 return material;
}
