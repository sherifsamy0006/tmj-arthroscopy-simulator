// A sparse reconstruction of the estimated posterior lining, shared by the
// render, compartment, fluid-volume and collision-domain builders.
export function applyAttachment(override,patch){
 if(patch.baseSHA256!=='2156fbf404fcae63e8da8005536861b4f7ebfb0570671a3d40a748f7a15932c2')throw Error('Attachment base mismatch');
 const part=override.superior,seen=new Set();
 for(const change of patch.superior.vertices){
  const {vertex,p,w,d}=change;
  if(!Number.isInteger(vertex)||vertex<0||vertex>=part.w.length||seen.has(vertex)||p.length!==3||!p.every(Number.isFinite)||!Number.isFinite(w)||!Number.isFinite(d)||w<0||w>1||d<0||d>1)throw Error('Invalid attachment reconstruction');
  seen.add(vertex);part.p.splice(vertex*3,3,...p);part.w[vertex]=w;part.d[vertex]=d;
 }
 return override;
}
