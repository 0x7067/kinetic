import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { Workshop, initialProject, validateProject } from '../src/model.js';
import { initialScene, validateScenePart } from '../src/scene-model.js';
import { analyzeScene } from '../src/scene-analysis.js';
import { simulate } from '../src/physics.js';
import { sampleRun, compareRuns } from '../src/replay.js';
import { createSceneObject, sceneBounds } from '../src/scene-geometry.js';
import { captureFrameBox, frameCamera } from '../src/scene-view.js';
import { summarize } from '../server/client.js';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const workspace=()=>new Workshop({project:initialScene()});
const workshopFile=fileURLToPath(new URL('../examples/workshop.json',import.meta.url));
function corners(box) {
  const pts=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])pts.push(new THREE.Vector3(x,y,z));
  return pts;
}
function projectCamera(box,mode='iso') {
  const camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,1000);
  frameCamera(camera,box,mode);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  return camera;
}

test('workspace switching and scene configuration share revision checks and undo history',()=>{
  const w=new Workshop(),marble=w.project;
  w.edit({expectedRevision:0,operations:[{type:'workspace',template:'scene'}]});assert.equal(w.project.version,2);
  w.edit({expectedRevision:1,operations:[{type:'configure',title:'A diagram',settings:{gravity:[0,0,0],duration:2}}]});
  assert.equal(w.project.title,'A diagram');assert.equal(w.state().rules.successCriteria,null);
  assert.throws(()=>w.edit({expectedRevision:1,operations:[{type:'workspace',template:'marble'}]}),e=>e.code==='STALE_REVISION');
  w.undo(2);w.undo(3);assert.equal(w.project.version,1);assert.deepEqual(w.project.parts,marble.parts);
});

test('every visual kind survives validation, import, inspection and atomic edits',()=>{
  const w=workspace();const parts=[
    {id:'box',kind:'box'}, {id:'sphere',kind:'sphere'}, {id:'cylinder',kind:'cylinder'}, {id:'plane',kind:'plane'},
    {id:'text',kind:'text',text:'<b>Literal text</b>'}, {id:'image',kind:'image',data:PNG},
    {id:'line',kind:'line',points:[[0,0,0],[2,1,0]]}, {id:'arrow',kind:'arrow',points:[[0,0,0],[0,2,0]]},
    {id:'plot',kind:'plot',points:[[0,0],[1,2]]}, {id:'mesh',kind:'mesh',vertices:[[0,0,0],[1,0,0],[0,1,0]],indices:[0,1,2]},
  ];
  w.edit({expectedRevision:0,operations:parts.map(part=>({type:'add',part}))});
  const copy=validateProject(JSON.parse(JSON.stringify(w.project)));assert.deepEqual(copy,w.project);
  const analysis=analyzeScene(copy);assert.equal(analysis.parts.length,10);assert.ok(analysis.parts.every(p=>p.bounds&&p.transform.matrixWorld.length===16));
  const before=structuredClone(w.project);
  assert.throws(()=>w.edit({expectedRevision:1,operations:[{type:'update',id:'box',changes:{x:5}},{type:'update',id:'image',changes:{data:'https://example.com/a.png'}}]}),e=>e.code==='INVALID_SCENE');
  assert.deepEqual(w.project,before);
});

for(const part of [
  {id:'bad',kind:'constructor'}, {id:'bad',kind:'box',x:Infinity}, {id:'bad',kind:'box',body:'script'},
  {id:'bad',kind:'text',text:'hi',body:'dynamic'}, {id:'bad',kind:'arrow',points:[[0,0,0],[0,0,0]]},
  {id:'bad',kind:'mesh',vertices:[[0,0,0],[1,0,0],[0,1,0]],indices:[0,1,4]},
  {id:'bad',kind:'image',data:'data:image/svg+xml,<svg/>'}, {id:'bad',kind:'box',execute:'alert(1)'},
])test(`scene rejects unsafe or unsupported ${part.kind} input`,()=>assert.throws(()=>validateScenePart(part),e=>e.code==='INVALID_SCENE'));

test('scene bounds use complete rotated geometry and empty scenes remain explicit',()=>{
  const p=initialScene();p.parts=[validateScenePart({id:'wide',kind:'box',width:4,height:2,depth:1,yaw:90,x:10})];
  const a=analyzeScene(p).parts[0];assert.ok(Math.abs(a.bounds.size.z-4)<.001);assert.ok(Math.abs(a.bounds.center.x-10)<.001);
  assert.equal(a.surfaceNormal,null);assert.deepEqual(a.topSurface.normal,{x:0,y:1,z:0});assert.equal(a.topSurface.downhill,null);
  p.parts=[validateScenePart({id:'slope',kind:'box',angle:-30,y:2,height:2})];
  const slope=analyzeScene(p).parts[0];assert.ok(Math.abs(slope.topSurface.normal.x-.5)<.001);assert.ok(slope.topSurface.downhill.x>0&&slope.topSurface.downhill.y<0);
  assert.ok(Math.abs(slope.topSurface.center.y-(2+Math.sqrt(3)/2))<.001);
  assert.equal(analyzeScene(initialScene()).sceneBounds,null);
});

test('real multi-body scene physics records contacts and replays without changing the document',async()=>{
  const w=workspace();w.edit({expectedRevision:0,operations:[
    {type:'add',part:{id:'floor',kind:'box',width:8,height:.2,depth:8,body:'fixed'}},
    {type:'add',part:{id:'ball',kind:'sphere',y:3,body:'dynamic'}},
    {type:'add',part:{id:'cube',kind:'box',x:2,y:4,body:'dynamic'}},
  ]});
  const before=structuredClone(w.project),r=await simulate(w.project);
  assert.equal(r.success,null);assert.equal(r.status,'completed');assert.ok(r.contacts.some(c=>c.part==='floor'||c.other==='floor'));
  assert.equal(r.frames[0].objects.ball.y,3);assert.ok(r.frames.at(-1).objects.ball.y<1);assert.ok(r.frames.at(-1).objects.cube.y<1);
  const f=sampleRun(r,.51);assert.equal(f.sampleMethod,'interpolated');assert.deepEqual(Object.keys(f.objects),['ball','cube']);
  assert.deepEqual(w.project,before);assert.equal(compareRuns(r,r).changes.length,0);
  const other=structuredClone(r);other.project.settings.gravity=[0,0,0];
  assert.deepEqual(compareRuns(r,other).projectChanges.settings.after.gravity,[0,0,0]);
  assert.throws(()=>compareRuns(r,{...r,mode:undefined}),e=>e.code==='INCOMPATIBLE_RUNS');
});

test('visual-only scenes render without inventing a physics run or challenge success',async()=>{
  const p=initialScene();p.parts=[validateScenePart({id:'label',kind:'text',text:'Hello'})];
  const r=await simulate(p);assert.equal(r.status,'rendered');assert.equal(r.duration,0);assert.equal(r.frames.length,1);assert.equal(r.success,null);assert.deepEqual(sampleRun(r,0).objects,{});
});

test('scene object and dynamic budgets are enforced atomically',()=>{
  const p=initialScene();p.parts=Array.from({length:65},(_,i)=>({id:`o${i}`,kind:'box'}));assert.throws(()=>validateProject(p));
  p.parts=p.parts.slice(0,17).map(x=>({...x,body:'dynamic'}));assert.throws(()=>validateProject(p));
  assert.throws(()=>validateProject({...initialScene(),settings:null}));
  assert.throws(()=>workspace().edit({expectedRevision:0,operations:[{type:'constructor'}]}),e=>e.code==='INVALID_SCENE');
});

test('compact output omits embedded image bytes without changing persisted assets',()=>{
  const project=initialScene();project.parts=[validateScenePart({id:'image',kind:'image',data:PNG})];
  const compact=summarize({project}).data;assert.ok(!JSON.stringify(compact).includes('base64'));assert.equal(compact.project.parts[0].dataSummary.width,1);
  assert.equal(project.parts[0].data,PNG);assert.equal(summarize({project},true).data.project.parts[0].data,PNG);
});

test('marble project format still rejects scene-only fields and retains locked rules',()=>{
  assert.throws(()=>validateProject({...initialProject(),settings:{gravity:[0,0,0]}}),e=>e.code==='LOCKED_RULES');
});

test('unfocused scene framing uses authored rest poses, not live or replay world matrices',()=>{
  const project=initialScene('demo');
  const group=new THREE.Group();
  for(const p of project.parts){
    const g=createSceneObject(p);
    if(p.id==='ball')g.position.set(p.x,-80,p.z);
    group.add(g);
  }
  group.updateMatrixWorld(true);
  const live=new THREE.Box3().setFromObject(group);
  const framed=captureFrameBox(project,group);
  const authored=sceneBounds(project).bounds;
  assert.ok(live.min.y<-79);
  assert.ok(Math.abs(framed.min.y-authored.min.y)<1e-4);
  assert.ok(framed.min.y>-5);
  const focused=captureFrameBox(project,group,'ball');
  assert.ok(focused.min.y<-79);
  assert.ok(focused.max.y<-78);
});

test('default iso framing keeps the demo plot, heading and floor inside a tighter ortho view',()=>{
  const project=validateProject(JSON.parse(readFileSync(workshopFile,'utf8')));
  const {bounds,parts}=sceneBounds(project);
  const camera=projectCamera(bounds,'iso');
  const sphere=bounds.getBoundingSphere(new THREE.Sphere());
  assert.ok(camera.position.distanceTo(sphere.center)<Math.max(6,sphere.radius*3)-.5);
  assert.ok(Math.abs(camera.zoom-Math.min(7,10)/Math.max(.9,sphere.radius*1.08))<1e-9);
  for(const id of ['floor','heading','plot']){
    const part=parts.find(p=>p.id===id);
    for(const corner of corners(part.bounds)){
      const ndc=corner.clone().project(camera);
      assert.ok(Math.abs(ndc.x)<=.98&&Math.abs(ndc.y)<=.98&&Math.abs(ndc.z)<=1,id);
    }
  }
});

test('an escaped dynamic body stays out of the default frustum and remains a tight focus target',async()=>{
  const w=workspace();
  w.edit({expectedRevision:0,operations:[
    {type:'add',part:{id:'heading',kind:'text',text:'Stay framed',y:2,width:4,height:1}},
    {type:'add',part:{id:'ball',kind:'sphere',y:2,radius:.4,body:'dynamic'}},
    {type:'configure',settings:{duration:2}},
  ]});
  const run=await simulate(w.project);
  const end=run.frames.at(-1).objects.ball;
  assert.ok(end.y<-5);
  const group=new THREE.Group();
  for(const p of w.project.parts){
    const g=createSceneObject(p);
    if(p.id==='ball'){g.position.set(end.x,end.y,end.z);g.quaternion.fromArray(end.q);}
    group.add(g);
  }
  group.updateMatrixWorld(true);
  const authored=captureFrameBox(w.project,group);
  const defaultCam=projectCamera(authored,'iso');
  const escaped=new THREE.Vector3(end.x,end.y,end.z).project(defaultCam);
  assert.ok(Math.abs(escaped.x)>1||Math.abs(escaped.y)>1);
  for(const corner of corners(sceneBounds(w.project).bounds)){
    const ndc=corner.project(defaultCam);
    assert.ok(Math.abs(ndc.x)<=1&&Math.abs(ndc.y)<=1&&Math.abs(ndc.z)<=1);
  }
  const focusCam=projectCamera(captureFrameBox(w.project,group,'ball'),'iso');
  const close=new THREE.Vector3(end.x,end.y,end.z).project(focusCam);
  assert.ok(Math.abs(close.x)<=.6&&Math.abs(close.y)<=.6);
  assert.ok(focusCam.zoom>defaultCam.zoom*2);
});
