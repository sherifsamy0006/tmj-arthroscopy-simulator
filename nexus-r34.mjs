// Manufacturer: 1.9 mm shaft, 63.1 mm working length, 115 mm overall.
// 115 mm is interpreted as the standalone telescope axial extent. Its datum,
// subdivisions and proximal cross-sections are NOT a manufacturer CAD drawing.
export function addNexusBody(THREE,group){
 const metal=new THREE.MeshStandardMaterial({color:'#c5cbcc',metalness:.9,roughness:.23}),black=new THREE.MeshStandardMaterial({color:'#141719',roughness:.55});
 const axial=y=>63.1+(y-63.1)*(115-63.1)/(120.1-63.1);
 function lathe(profile,material,segments=48){const m=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([y,r])=>new THREE.Vector2(r,-axial(y))),segments),material);group.add(m);}
 lathe([[63.1,1.05],[63.7,1.65],[66,2],[67,3.1],[72,4],[72.6,4],[72.6,5],[75,5]],metal);
 lathe([[75,5],[77,7.8],[85,7.8],[87,6.5]],metal,8);
 lathe([[87,6.5],[104,6.3],[109,8.5],[115,15],[119,15],[120,14.8]],black);
 const post=new THREE.Group();post.position.y=-axial(82);post.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.sin(55*Math.PI/180),-Math.cos(55*Math.PI/180),0));group.add(post);
 const tube=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,15,32),metal);tube.position.y=10;post.add(tube);
 for(const y of[14.3,15.5,16.7]){const r=new THREE.Mesh(new THREE.TorusGeometry(2.6,.22,8,32),metal);r.rotation.x=Math.PI/2;r.position.y=y;post.add(r);}
 const eye=new THREE.Mesh(new THREE.CircleGeometry(11,48),new THREE.MeshStandardMaterial({color:'#102125',metalness:.65,roughness:.08,side:THREE.DoubleSide}));eye.rotation.x=Math.PI/2;eye.position.y=-115;group.add(eye);
 return{extent:115,datumInterpretation:true,proximalDimensionsEstimated:true};
}
