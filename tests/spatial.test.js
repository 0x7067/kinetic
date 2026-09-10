import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { analyzeScene, cameraRecommendations } from '../src/scene-analysis.js';
import { initialProject } from '../src/model.js';
import { rotation } from '../src/physics.js';

test('spatial transforms agree with the physics quaternion for nonzero yaw and pitch',()=>{
  const p=initialProject();p.parts[1].angle=-31;p.parts[1].yaw=19;
  const a=analyzeScene(p).parts[1];
  const expected=rotation(p.parts[1]);const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().fromArray(a.transform.matrixWorld));
  assert.ok(Math.abs(q.dot(new THREE.Quaternion(expected.x,expected.y,expected.z,expected.w)))>.99999);
  assert.ok(a.endpoints[0].y>a.endpoints[1].y);assert.ok(a.downhill.y<0);
});
test('a level part has no downhill direction',()=>{
  const p=initialProject();p.parts[1].angle=0;
  const a=analyzeScene(p).parts[1];assert.equal(a.downhill,null);assert.equal(a.slope,0);
  assert.equal(a.endpoints[0].y,2.59);
});
test('suggested camera containment checks every corner, not mere intersection',()=>{
  for(const [x,y,z] of [[10,1,1],[1,10,1],[1,1,10],[.2,.3,.4]]) {
    const box=new THREE.Box3(new THREE.Vector3(-x,-y,-z),new THREE.Vector3(x,y,z));
    for(const pose of cameraRecommendations(box)){
      const camera=new THREE.PerspectiveCamera(pose.fovDeg,16/9,.05,1000);camera.position.set(pose.position.x,pose.position.y,pose.position.z);camera.lookAt(pose.target.x,pose.target.y,pose.target.z);camera.updateMatrixWorld();
      assert.equal(pose.containsSceneBounds,true);
      for(const a of [-x,x])for(const b of [-y,y])for(const c of [-z,z]){const point=new THREE.Vector3(a,b,c).project(camera);assert.ok(Math.abs(point.x)<=1&&Math.abs(point.y)<=1&&Math.abs(point.z)<=1);}
    }
  }
});
test('empty scene facts are explicit',()=>{
  const p=initialProject();p.parts=[];p.world={objects:[]};delete p.judge;
  const a=analyzeScene(p);assert.equal(a.sceneBounds,null);assert.deepEqual(a.cameraRecommendations,[]);
});
test('partsless marble-cup still has scene bounds from world objects',()=>{
  const p=initialProject();p.parts=[];
  const a=analyzeScene(p);
  const marble=p.world.objects.find(o=>o.kind==='marble');
  const cup=p.world.objects.find(o=>o.kind==='cup');
  assert.ok(a.sceneBounds);
  assert.ok(a.cameraRecommendations.length>=1);
  assert.ok(a.sceneBounds.min.x<=marble.x);
  assert.ok(a.sceneBounds.max.x>=cup.x);
  assert.ok(a.sceneBounds.max.y>=marble.y);
});
test('lights and cameras do not invent scene bounds by themselves',()=>{
  const p=initialProject();p.parts=[];p.world={objects:[
    {id:'key-light',kind:'light',name:'Key',x:-5,y:12,z:5},
    {id:'shot',kind:'camera',name:'Shot',x:9,y:10,z:13},
  ]};
  const a=analyzeScene(p);assert.equal(a.sceneBounds,null);assert.deepEqual(a.cameraRecommendations,[]);
});
