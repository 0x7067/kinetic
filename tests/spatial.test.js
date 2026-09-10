import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { analyzeScene, cameraRecommendations } from '../src/scene-analysis.js';
import { initialProject, RULES } from '../src/model.js';
import { rotation } from '../src/physics.js';
import { captureFramingBox } from '../src/view.js';

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
test('world object bounds match Rapier collider extents',()=>{
  const p=initialProject();
  const byKind=Object.fromEntries(analyzeScene(p).objects.map(o=>[o.kind,o]));
  assert.deepEqual(byKind.workbench.bounds.size,{x:16,y:0.4,z:8.8});
  assert.deepEqual(byKind.workbench.bounds.center,{x:0,y:-0.2,z:0});
  assert.deepEqual(byKind.marble.bounds.size,{x:0.44,y:0.44,z:0.44});
  assert.deepEqual(byKind.marble.bounds.center,RULES.start);
  assert.equal(byKind.cup.bounds.size.x,1.5);
  assert.equal(byKind.cup.bounds.size.z,1.5);
  assert.equal(byKind.cup.bounds.size.y,0.9);
  assert.equal(byKind.cup.bounds.min.y,0.04);
  assert.equal(byKind.cup.bounds.max.y,0.94);
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
test('empty capture framing falls back to a finite start-goal box',()=>{
  const fallback=captureFramingBox(new THREE.Box3());
  const sphere=fallback.getBoundingSphere(new THREE.Sphere());
  assert.equal(fallback.isEmpty(),false);
  assert.ok(Number.isFinite(sphere.radius));
  assert.ok(Number.isFinite(sphere.center.x));
  assert.ok(fallback.containsPoint(new THREE.Vector3(RULES.start.x,RULES.start.y,RULES.start.z)));
  assert.ok(fallback.containsPoint(new THREE.Vector3(RULES.goal.x,RULES.goal.y,RULES.goal.z)));
  const kept=new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
  assert.equal(captureFramingBox(kept),kept);
});
