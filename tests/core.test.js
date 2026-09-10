import test from 'node:test';
import assert from 'node:assert/strict';
import { Workshop, RULES, BUDGET, initialProject, validateProject, applyOperations, uid } from '../src/model.js';
import { simulate } from '../src/physics.js';
import { propose, score } from '../src/solver.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const lower = [{type:'update',id:'bridge',changes:{y:2.25}}];
test('atomic edits reject an invalid second operation without changing the first',()=>{
  const w=new Workshop(),before=w.state();
  assert.throws(()=>w.edit({expectedRevision:0,operations:[...lower,{type:'update',id:'home',changes:{y:Infinity}}]}),/finite/);
  assert.deepEqual(w.state(),before);
});
test('stale revisions are rejected, not silently merged',()=>{
  const w=new Workshop();w.edit({expectedRevision:0,operations:lower});
  assert.throws(()=>w.edit({expectedRevision:0,operations:lower}),/Expected revision 1/);
});
test('a retried request is applied once; changed payload with same ID is rejected',()=>{
  const w=new Workshop(),request={expectedRevision:0,requestId:'retry-1',operations:lower};
  const a=w.edit(request),b=w.edit(request);assert.equal(a.revision,1);assert.equal(b.replayed,true);assert.equal(w.project.revision,1);
  assert.throws(()=>w.edit({...request,operations:[{type:'remove',id:'home'}]}),/reused/);
});
test('a no-op edit and removal do not create history entries',()=>{
  const w=new Workshop();const r=w.edit({expectedRevision:0,operations:[{type:'remove',id:'missing'}]});assert.equal(r.changed,false);assert.equal(w.project.revision,0);assert.equal(w.history.length,0);
});
test('undo and redo preserve object IDs and monotonically increase revisions',()=>{
  const w=new Workshop();w.edit({expectedRevision:0,operations:lower});w.undo(1);assert.equal(w.project.parts[1].y,2.5);assert.equal(w.project.revision,2);w.redo(2);assert.equal(w.project.parts[1].y,2.25);assert.equal(w.project.parts[1].id,'bridge');assert.equal(w.project.revision,3);
});
test('new edits clear redo and history stays bounded',()=>{
  const w=new Workshop();for(let i=0;i<30;i++)w.edit({expectedRevision:w.project.revision,operations:[{type:'update',id:'bridge',changes:{y:2+i/100}}]});assert.equal(w.history.length,20);w.undo(w.project.revision);w.edit({expectedRevision:w.project.revision,operations:lower});assert.equal(w.future.length,0);
});
test('project import round-trips IDs and rejects challenge-rule changes',()=>{
  const p=initialProject();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
  for(const key of ['gravity','target','start','scripts','__proto__']){const bad=JSON.parse(JSON.stringify(p));Object.defineProperty(bad,key,{value:0,enumerable:true});assert.throws(()=>validateProject(bad),/cannot be imported/);}
});
test('unknown fields, code and invalid identifiers fail loudly',()=>{
  const p=initialProject();assert.throws(()=>applyOperations(p,[{type:'run_js',code:'alert(1)'}]));
  assert.throws(()=>applyOperations(p,[{type:'update',id:'bridge',changes:{colour:'red'}}]),/Unknown/);
  assert.throws(()=>applyOperations(p,[{type:'update',id:'bridge',changes:{id:'target'}}]),/immutable/);
  const bad=initialProject();bad.parts[1].id='<script>';assert.throws(()=>validateProject(bad),/alphanumeric/);
});
test('part budget and uniqueness are enforced',()=>{
  const p=initialProject();
  assert.throws(()=>applyOperations(p,[{type:'add',part:p.parts[0]}]),/already exists/);
  assert.throws(()=>applyOperations(p,[{type:'add',part:{...p.parts[0],id:'marble'}}]),/already exists/);
  const full={...p,parts:Array.from({length:BUDGET.maxParts},(_,i)=>({...p.parts[0],id:`p${i}`}))};
  assert.throws(()=>applyOperations(full,[{type:'add',part:{...p.parts[0],id:'overflow'}}]),/allows 12/);
});
test('feedback carries exact revision, target and run; blank comments fail',()=>{
  const w=new Workshop();assert.throws(()=>w.addFeedback({text:' '}),/1–1000/);
  const n=w.addFeedback({text:'Lower this.',targetId:'bridge',runId:'run1',time:.5,camera:{position:[1,2,3]}},{id:'run1',project:w.project,duration:2});
  assert.equal(n.targetId,'bridge');assert.equal(n.revision,0);assert.equal(n.runId,'run1');assert.equal(n.resolved,false);
  assert.throws(()=>w.addFeedback({text:'Hi',targetId:'missing'}),/no longer exists/);
});
test('run IDs are unique',()=>{assert.notEqual(uid(),uid());});
test('initial layout really fails; changing only the landing height succeeds',async()=>{
  const p=initialProject(),before=JSON.stringify(p),failed=await simulate(p);assert.equal(failed.success,false);assert.equal(failed.status,'fell-short');assert.ok(failed.contacts.some(c=>c.part==='bridge'));assert.ok(failed.closest>6);assert.equal(JSON.stringify(p),before);
  const fixed=applyOperations(p,lower),passed=await simulate(fixed);assert.equal(passed.success,true);assert.ok(passed.contacts.some(c=>c.part==='cup'));assert.ok(passed.duration<10);assert.deepEqual(RULES.start,{x:-5.5,y:4.65,z:0});assert.equal(fixed.parts[0].x,p.parts[0].x);assert.equal(fixed.parts[2].y,p.parts[2].y);
});
test('resetting physics repeats the same trajectory rather than continuing a fallen marble',async()=>{
  const p=applyOperations(initialProject(),lower),a=await simulate(p),b=await simulate(p);assert.deepEqual(a.frames,b.frames);assert.deepEqual(a.contacts,b.contacts);assert.equal(a.duration,b.duration);
});
test('an empty scene cannot claim success just because a simulation completed',async()=>{
  const p=initialProject();p.parts=[];const run=await simulate(p);assert.equal(run.success,false);assert.ok(run.contacts.some(c=>c.part==='workbench'));assert.ok(run.duration<10);
});
test('local search proposes from observations and solves within the explicit budget',async()=>{
  let p=initialProject(),best=await simulate(p),count=1;const log=[{status:best.status,closest:best.closest}];
  for(let i=0;i<12&&!best.success;i++){const move=propose(p,best,i);if(!move)continue;const next=applyOperations(p,move.operations),r=await simulate(next);count++;log.push({label:move.label,status:r.status,closest:r.closest});if(score(r)>score(best)){p=next;best=r;}}
  assert.equal(best.success,true,JSON.stringify(log));assert.ok(count<=13);assert.equal(p.parts.length,3);
  console.log('Measured solver evidence:',JSON.stringify({count,log}));
});
test('world and judge are project data, not LOCKED_RULES',()=>{
  const p=initialProject();
  assert.ok(p.world.objects.some(o=>o.kind==='marble'));
  assert.equal(p.judge.type,'dwell-sensor');
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
  const withWorld=validateProject({version:1,revision:0,title:'Empty world',parts:[],world:{objects:[]}});
  assert.equal(withWorld.judge,undefined);
  assert.equal(withWorld.world.objects.length,0);
  const legacy={version:1,revision:0,title:'The first leap',parts:p.parts.map(({id,kind,name,x,y,z,angle,yaw,length})=>({id,kind,name,x,y,z,angle,yaw,length}))};
  const hydrated=validateProject(legacy);
  assert.ok(hydrated.world.objects.some(o=>o.kind==='cup'));
  assert.equal(hydrated.judge.type,'dwell-sensor');
});
test('two-boxes inspects, edits, and runs without inventing a marble or cup',async()=>{
  const two=validateProject(JSON.parse(readFileSync(resolve(import.meta.dirname,'../examples/two-boxes.json'),'utf8')));
  assert.equal(two.parts.length,2);
  assert.equal(two.parts.filter(p=>p.kind==='mesh').length,2);
  assert.equal(two.parts.filter(p=>p.collider===false).length,1);
  assert.ok(two.world.objects.some(o=>o.kind==='light'));
  assert.ok(two.world.objects.some(o=>o.kind==='camera'));
  assert.ok(!two.world.objects.some(o=>o.kind==='marble'||o.kind==='cup'));
  assert.equal(two.judge,undefined);
  const moved=applyOperations(two,[{type:'update',id:'box-a',changes:{y:1.8}}]);
  assert.equal(moved.parts.find(p=>p.id==='box-a').y,1.8);
  const run=await simulate(two);
  assert.equal(run.success,null);
  assert.equal(run.status,'completed');
  assert.equal(run.contacts.length,0);
  assert.ok(!run.frames.some(f=>f.x===RULES.start.x&&f.y===RULES.start.y));
  assert.ok(!run.contacts.some(c=>c.part==='cup'||c.part==='workbench'||c.part==='marble'));
});
test('collider:false meshes stay in the document and out of Rapier contacts',async()=>{
  const empty={...initialProject(),parts:[]};
  const ghost={id:'ghost',kind:'mesh',name:'Ghost',x:-5.5,y:2,z:0,angle:0,yaw:0,length:1.2,collider:false};
  const withGhost=applyOperations(empty,[{type:'add',part:ghost}]);
  assert.equal(withGhost.parts.find(p=>p.id==='ghost').collider,false);
  const missed=await simulate(withGhost);
  assert.ok(!missed.contacts.some(c=>c.part==='ghost'));
  assert.ok(missed.contacts.some(c=>c.part==='workbench'));
  const block={id:'block',kind:'mesh',name:'Block',x:-5.5,y:2,z:0,angle:0,yaw:0,length:1.2,collider:true};
  const withBlock=applyOperations(empty,[{type:'add',part:block}]);
  assert.equal(withBlock.parts.find(p=>p.id==='block').kind,'mesh');
  const hit=await simulate(withBlock);
  assert.ok(hit.contacts.some(c=>c.part==='block'),JSON.stringify(hit.contacts));
  assert.ok(!withBlock.parts.some(p=>p.kind==='ramp'&&p.id==='block'));
});
test('typed operations still reject arbitrary code',()=>{
  assert.throws(()=>applyOperations(initialProject(),[{type:'run_js',code:'throw new Error("pwn")'}]),/Arbitrary code is not supported|INVALID_OPERATION|unknown field/i);
});
test('judge body and target IDs must exist in the world',()=>{
  const p=initialProject();
  assert.throws(()=>validateProject({...p,judge:{type:'dwell-sensor',body:'missing',target:'cup'}}),/Judge body/);
  assert.throws(()=>validateProject({...p,judge:{type:'dwell-sensor',body:'marble',target:'missing'}}),/Judge target/);
  assert.throws(()=>validateProject({...p,judge:{type:'dwell-sensor',body:'marble',target:'launch'}}),/Judge target/);
});
test('cup.y offsets are rejected; the marble fixture default still validates',()=>{
  const p=initialProject();
  assert.equal(validateProject(p).world.objects.find(o=>o.kind==='cup').y,RULES.goal.y);
  const offset={...p,world:{objects:p.world.objects.map(o=>o.kind==='cup'?{...o,y:1.2}:o)}};
  assert.throws(()=>validateProject(offset),/Cup Y translation is unsupported/);
});
test('a judge requires colliding body and target',()=>{
  const p=initialProject();
  assert.throws(()=>validateProject({...p,world:{objects:p.world.objects.map(o=>o.kind==='marble'?{...o,collider:false}:o)}}),/Judge body must have a collider/);
  assert.throws(()=>validateProject({...p,world:{objects:p.world.objects.map(o=>o.kind==='cup'?{...o,collider:false}:o)}}),/Judge target must have a collider/);
});
test('skipping Rapier keeps a collider:false marble at its document pose',async()=>{
  const p=initialProject();
  const ghost=validateProject({version:1,revision:0,title:'Ghost marble',parts:[],world:{objects:p.world.objects.map(o=>o.kind==='marble'?{...o,collider:false}:o)}});
  assert.equal(ghost.judge,undefined);
  const run=await simulate(ghost);
  assert.equal(run.success,null);
  assert.equal(run.status,'completed');
  assert.equal(run.contacts.length,0);
  assert.equal(run.frames[0].x,RULES.start.x);
  assert.equal(run.frames[0].y,RULES.start.y);
  assert.equal(run.frames[0].z,RULES.start.z);
  assert.equal(run.end.x,RULES.start.x);
  assert.equal(run.end.y,RULES.start.y);
  assert.equal(run.end.z,RULES.start.z);
});
