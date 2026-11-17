// Nexus 501200 manufacturer: 30° direction of view, 65° field of view.
// Axial-roll kinematics about a fixed lens point; no portal or insertion model.
export function opticsFrame(THREE,referenceDirection,rollDegrees){
 const d=referenceDirection.clone().normalize();
 const helper=Math.abs(d.z)<.98?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
 const normal=d.clone().cross(helper).normalize();
 const shaftAxis=d.clone().applyAxisAngle(normal,-Math.PI/6).normalize();
 const direction=d.clone().applyAxisAngle(shaftAxis,THREE.MathUtils.degToRad(rollDegrees)).normalize();
 const up=helper.clone().addScaledVector(d,-helper.dot(d)).normalize().applyAxisAngle(shaftAxis,THREE.MathUtils.degToRad(rollDegrees));
 return {shaftAxis,direction,up};
}
