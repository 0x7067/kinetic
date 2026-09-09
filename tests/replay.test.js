import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleRun, compareRuns } from '../src/replay.js';
import { simulate } from '../src/physics.js';
import { initialProject, Workshop } from '../src/model.js';
import { Quaternion } from 'three';

const project=initialProject();
const makeRun=()=>({id:'recording',project,revision:0,duration:2,closest:1,status:'fell-short',success:false,end:{x:2,y:1,z:0},contacts:[],frames:[
  {t:0,x:0,y:0,z:0,q:[0,0,0,1],speed:0,vx:0,vy:0,vz:0},
  {t:2,x:2,y:4,z:6,q:[0,1,0,0],speed:4,vx:2,vy:4,vz:6},
]});
test('replay interpolates translation, velocity and unit quaternion at a requested time',()=>{
  const run=makeRun(),before=JSON.stringify(run),f=sampleRun(run,1);
  assert.equal(f.x,1);assert.equal(f.y,2);assert.equal(f.z,3);assert.equal(f.vx,1);assert.equal(f.speed,2);
  assert.ok(Math.abs(new Quaternion().fromArray(f.q).length()-1)<1e-12);
  assert.ok(Math.abs(f.q[1]-Math.SQRT1_2)<1e-12);assert.equal(f.sampleMethod,'interpolated');
  assert.equal(JSON.stringify(run),before);
});
test('time zero and exact end preserve the corresponding recorded positions',()=>{
  assert.equal(sampleRun(makeRun(),0).x,0);assert.equal(sampleRun(makeRun(),2).x,2);
  assert.equal(sampleRun(makeRun(),2).sampleMethod,'recorded');
});
for(const time of [-.01,2.01,NaN,Infinity,'1',null])test(`invalid replay time ${time} fails explicitly`,()=>assert.throws(()=>sampleRun(makeRun(),time),e=>e.code==='INVALID_TIME'));
test('empty replay is an error, not a fabricated position',()=>assert.throws(()=>sampleRun({...makeRun(),frames:[]},0),e=>e.code==='EMPTY_REPLAY'));
test('physics records time zero and exact terminal state, including final collision samples',async()=>{
  const run=await simulate(project);assert.equal(run.frames[0].t,0);assert.equal(run.frames.at(-1).t,run.duration);
  const f=sampleRun(run,run.duration);for(const key of ['x','y','z'])assert.ok(Math.abs(f[key]-run.end[key])<.0001);
  for(const c of run.contacts)assert.ok(run.frames.some(f=>f.t===c.time));
});
test('comparison reports actual changed fields and candidate-minus-baseline deltas',()=>{
  const a=makeRun(),b=structuredClone(a);b.id='candidate';b.project=structuredClone(project);b.project.parts[1].y=2.2;b.closest=.5;b.success=true;b.status='success';
  const delta=compareRuns(a,b);assert.equal(delta.closestDelta,-.5);assert.deepEqual(delta.changes,[{id:'bridge',type:'updated',fields:{y:{before:2.5,after:2.2}}}]);
  assert.equal(delta.baseline.success,false);assert.equal(delta.candidate.success,true);assert.ok(!('frames' in delta.baseline));
});
test('same-run comparison reports no imaginary improvement',()=>{const a=makeRun(),d=compareRuns(a,a);assert.deepEqual(d.changes,[]);assert.equal(d.closestDelta,0);});
test('historical feedback anchors to the viewed snapshot even after target deletion',()=>{
  const w=new Workshop(),run=makeRun();w.edit({expectedRevision:0,operations:[{type:'remove',id:'bridge'}]});
  const note=w.addFeedback({text:'This collision',targetId:'bridge',runId:run.id,time:1,expectedRevision:0},run);
  assert.equal(note.revision,0);assert.equal(note.currentRevision,1);assert.equal(note.time,1);
  assert.equal(w.project.parts.some(p=>p.id==='bridge'),false);
});
test('feedback with fabricated run or impossible time is rejected',()=>{
  const w=new Workshop(),run=makeRun();assert.throws(()=>w.addFeedback({text:'x',runId:'unknown'}),e=>e.code==='RUN_NOT_FOUND');
  for(const time of [-1,10,'1',Infinity])assert.throws(()=>w.addFeedback({text:'x',runId:run.id,time},run),e=>e.code==='INVALID_TIME');
  assert.throws(()=>w.addFeedback({text:'x',time:1}),e=>e.code==='INVALID_TIME');assert.equal(w.feedback.length,0);
});
test('feedback does not silently attach stale live screenshots to the latest revision',()=>{
  const w=new Workshop();w.edit({expectedRevision:0,operations:[{type:'update',id:'bridge',changes:{y:2.2}}]});
  assert.throws(()=>w.addFeedback({text:'x',expectedRevision:0}),e=>e.code==='STALE_REVISION');assert.equal(w.feedback.length,0);
});

test('surface evidence distinguishes a blocked rail from a deck landing on a perturbed layout', async () => {
  const project = initialProject();
  Object.assign(project.parts[1], { y: 2.25, z: 0.45, angle: -8, yaw: 8 });
  Object.assign(project.parts[2], { z: -0.25, yaw: -8 });
  const before = structuredClone(project);
  const blocked = await simulate(project);
  assert.equal(blocked.success, false);
  assert.equal(blocked.contacts.find(c => c.part === 'bridge').surface, 'rail-negative-z');
  assert.deepEqual(project, before, 'inspection/simulation must not modify the layout');
  project.parts[1].z = 0;
  const landed = await simulate(project);
  assert.equal(landed.contacts.find(c => c.part === 'bridge').surface, 'deck');
  assert.equal(landed.success, true);
  assert.ok(landed.contacts.every(c => typeof c.surface === 'string'));
});
