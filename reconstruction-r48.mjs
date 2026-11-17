// Replace derived enclosure data only. The source bone and disc arrays are
// supplied independently to the subtraction and collision engines.
export function applyReconstruction(asset,override){
 for(const c of [asset,asset.inferior]){
  const o=override[c.part.name];if(!o)throw Error('Missing enclosure reconstruction');
  for(const k of ['p','i','faceBoundaries','parentFace'])if(o[k])c.part[k]=o[k];
  for(const k of ['w','d','r'])if(o[k])c.field[k]=o[k];
  if(o.attachments)c.attachments=o.attachments;
  const n=c.part.p.length/3;
  if(c.field.w.length!==n||c.field.d.length!==n||c.field.r.length!==c.part.p.length||c.part.faceBoundaries.length!==c.part.i.length/3)throw Error('Inconsistent reconstruction arrays');
 }
 return asset;
}
