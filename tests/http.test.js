import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let child,dir;const port=4329,base=`http://127.0.0.1:${port}`;
async function start(){child=spawn(process.execPath,['server/http.js'],{env:{...process.env,KINETIC_TEMPLATE:'marble',PORT:String(port),KINETIC_DATA:join(dir,'state.json')},stdio:['ignore','pipe','pipe']});let logs='';child.stderr.on('data',b=>logs+=b);for(let i=0;i<60;i++){try{const r=await fetch(`${base}/api/state`);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`Server failed to start: ${logs}`);}
async function stop(){if(child&&!child.killed){const done=new Promise(r=>child.on('exit',r));child.kill('SIGTERM');await done;}}
async function post(path,body,headers={}){const r=await fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
before(async()=>{dir=await mkdtemp(join(tmpdir(),'kinetic-test-'));await start();});after(stop);
test('local API persists edits; a server restart restores the same IDs and values',async()=>{
  const r=await post('edit',{expectedRevision:0,requestId:'http-1',operations:[{type:'update',id:'bridge',changes:{y:2.25}}]});assert.equal(r.status,200);assert.equal(r.data.revision,1);
  await stop();await start();const state=await fetch(`${base}/api/state`).then(r=>r.json());assert.equal(state.project.parts[1].id,'bridge');assert.equal(state.project.parts[1].y,2.25);assert.equal(state.project.revision,1);
});
test('API returns structured conflicts and does not execute unknown endpoints',async()=>{
  const r=await post('edit',{expectedRevision:0,operations:[{type:'remove',id:'home'}]});assert.equal(r.status,409);assert.equal(r.data.error.code,'STALE_REVISION');
  const bad=await post('execute',{code:'process.exit()'});assert.equal(bad.status,404);
});
test('CSRF and DNS rebinding guards reject unexpected origins and hosts',async()=>{
  const r=await post('reset',{expectedRevision:1},{Origin:'https://attacker.example'});assert.equal(r.status,403);
  const status=await new Promise((resolve,reject)=>{const req=request(`${base}/api/state`,{headers:{host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(status,403);
});
test('static server never serves source secrets or arbitrary paths',async()=>{
  for(const path of ['/server/http.js','/.kinetic/workshop.json','/.env','/vendor/../../server/http.js'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/vendor/three.module.js')).status,200);assert.equal((await fetch(base+'/vendor/rapier.mjs')).status,200);
});
test('real headless run works without a viewer and discloses missing screenshots',async()=>{
  const r=await post('run',{expectedRevision:1,capture:true});assert.equal(r.status,200);assert.equal(r.data.success,true);assert.deepEqual(r.data.images,[]);assert.match(r.data.imageStatus,/No browser connected/);assert.ok(r.data.frames.length>100);
});
test('malformed JSON bodies are rejected with a structured error',async()=>{
  for(const body of [null,42,[],false]){const r=await post('edit',body);assert.equal(r.status,400);assert.equal(r.data.error.code,'INVALID_BODY');}
});
test('unknown view and edit request options cannot silently succeed',async()=>{
  assert.equal((await post('inspect',{capture:false,foo:'bar'})).status,400);
  assert.equal((await post('view',{mode:'rear'})).status,400);
  assert.equal((await post('view',{mode:'side',focus:'missing'})).status,404);
  const r=await post('view',{mode:'side'});assert.equal(r.status,200);assert.equal(r.data.captureStatus,'unavailable');assert.deepEqual(r.data.images,[]);
});
test('resolving feedback frees the pending-note capacity',async()=>{
  const ids=[];for(let i=0;i<30;i++)ids.push((await post('feedback',{text:`note ${i}`})).data.id);
  assert.equal((await post('feedback',{text:'overflow'})).status,400);
  await post('feedback/resolve',{ids});
  assert.equal((await post('feedback',{text:'new note'})).status,200);
});
