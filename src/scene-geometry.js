import * as THREE from 'three';
import { sceneDataSummary } from './scene-model.js';

export function sceneQuaternion(p) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...[p.roll,p.yaw,p.angle].map(THREE.MathUtils.degToRad),'YXZ'));
}
export function sceneGeometry(p) {
  if(p.kind==='box')return new THREE.BoxGeometry(p.width,p.height,p.depth);
  if(p.kind==='sphere')return new THREE.SphereGeometry(p.radius,32,20);
  if(p.kind==='cylinder')return new THREE.CylinderGeometry(p.radius,p.radius,p.height,32);
  if(p.kind==='mesh'){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.vertices.flat(),3));g.setIndex(p.indices);g.computeVertexNormals();return g;
  }
  if(p.kind==='line')return new THREE.BufferGeometry().setFromPoints(p.points.map(v=>new THREE.Vector3(...v)));
  return new THREE.PlaneGeometry(p.width,p.height);
}
export function createSceneObject(p) {
  const group=new THREE.Group();group.userData.partId=p.id;group.position.set(p.x,p.y,p.z);group.quaternion.copy(sceneQuaternion(p));
  if(p.kind==='arrow'){
    const start=new THREE.Vector3(...p.points[0]),delta=new THREE.Vector3(...p.points[1]).sub(start),length=delta.length();
    group.add(new THREE.ArrowHelper(delta.normalize(),start,length,p.color,Math.min(.4,length*.25),Math.min(.22,length*.15)));
  }else{
    const geometry=sceneGeometry(p);
    const shape=p.kind==='line'?new THREE.Line(geometry,new THREE.LineBasicMaterial({color:p.color})):new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:p.color,roughness:.62,side:THREE.DoubleSide}));
    shape.castShadow=p.body!=='none';shape.receiveShadow=true;group.add(shape);
  }
  group.traverse(o=>{if(o.material){o.material.transparent=p.opacity<1;o.material.opacity=p.opacity;}});
  group.updateMatrixWorld(true);return group;
}
export function disposeSceneObject(object) {
  object.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});
}
export function sceneBounds(project) {
  const bounds=new THREE.Box3();
  const parts=project.parts.map(p=>{
    const shape=createSceneObject(p),box=new THREE.Box3().setFromObject(shape);bounds.union(box);
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    const vector=v=>Object.fromEntries(['x','y','z'].map(k=>[k,+v[k].toFixed(4)]));
    const normal=new THREE.Vector3(0,1,0).applyQuaternion(shape.quaternion);
    const gravity=new THREE.Vector3(...project.settings.gravity),tangent=gravity.clone().addScaledVector(normal,-gravity.dot(normal));
    const record={id:p.id,name:p.name,kind:p.kind,body:p.body,color:p.color,opacity:p.opacity,
      transform:{position:{x:p.x,y:p.y,z:p.z},angleDeg:p.angle,yawDeg:p.yaw,rollDeg:p.roll,matrixWorld:shape.matrixWorld.elements},
      bounds:{min:vector(box.min),max:vector(box.max),size:vector(size),center:vector(center)},
      axes:{x:vector(new THREE.Vector3(1,0,0).applyQuaternion(shape.quaternion)),y:vector(normal),z:vector(new THREE.Vector3(0,0,1).applyQuaternion(shape.quaternion))},
      surfaceNormal:['plane','text','image','plot'].includes(p.kind)?vector(new THREE.Vector3(0,0,1).applyQuaternion(shape.quaternion)):null,
      topSurface:['box','cylinder'].includes(p.kind)?{localFace:'+Y',normal:vector(normal),center:vector(new THREE.Vector3(0,p.height/2,0).applyMatrix4(shape.matrixWorld)),downhill:tangent.lengthSq()>1e-12?vector(tangent.normalize()):null}:null,
      dataSummary:sceneDataSummary(p)};
    disposeSceneObject(shape);return record;
  });
  return {bounds,parts};
}
