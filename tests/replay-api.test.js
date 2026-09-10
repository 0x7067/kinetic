import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const port=4359,url=`http://127.0.0.1:${port}`;let process_,folder,first,second;
async function post(path,body){const r=await fetch(url+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,value:await r.json()};}
async function state(){return fetch(url+'/api/state').then(r=>r.json());}
function cli(...args){const r=spawnSync(process.execPath,['cli.js',...args,'--json','--url',url],{encoding:'utf8',timeout:30000});return {status:r.status,value:JSON.parse(r.stdout)};}
before(async()=>{
 folder=await mkdtemp(join(tmpdir(),'kinetic-replay-api-'));
 process_=spawn(process.execPath,['server/http.js'],{env:{...process.env,KINETIC_TEMPLATE:'marble',PORT:String(port),KINETIC_DATA:join(folder,'state.json')},stdio:'ignore'});
 for(let i=0;i<100;i++){try{await state();return;}catch{}await new Promise(r=>setTimeout(r,50));}throw new Error('server did not start');
});
after(async()=>{const exit=new Promise(r=>process_.once('exit',r));process_.kill();await exit;await rm(folder,{recursive:true,force:true});});
test('CLI and live MCP expose identical read-only replay and comparison facts',async()=>{
 first=cli('run').value;assert.equal(first.success,false);
 assert.equal(cli('set','bridge','y=2.2','--revision','0').status,0);
 second=cli('run').value;assert.equal(second.success,true);
 const paused=cli('replay',first.id,'--at','1.2');assert.equal(paused.status,0);assert.equal(paused.value.revision,0);assert.equal(paused.value.currentRevision,1);assert.equal(paused.value.frame.t,1.2);
 const delta=cli('compare',first.id,second.id);assert.equal(delta.value.changes[0].fields.y.after,2.2);
 const client=new Client({name:'kinetic-replay-test',version:'1'});const transport=new StdioClientTransport({command:process.execPath,args:['server/mcp.js'],env:{...process.env,KINETIC_URL:url},stderr:'pipe'});
 try{
  await client.connect(transport);const names=(await client.listTools()).tools.map(t=>t.name);assert.ok(names.includes('kinetic_replay')&&names.includes('kinetic_compare'));
  const fromMcp=await client.callTool({name:'kinetic_replay',arguments:{runId:first.id,time:1.2,capture:false}});assert.ok(!fromMcp.isError);
  const facts=JSON.parse(fromMcp.content[0].text);assert.deepEqual(facts,paused.value);
  assert.deepEqual(facts.run.contacts,first.contacts);
  assert.ok(facts.run.contacts.find(c=>c.part==='bridge').normal.x < -.9);
  const comp=await client.callTool({name:'kinetic_compare',arguments:{baseline:first.id,candidate:second.id}});assert.deepEqual(JSON.parse(comp.content[0].text),delta.value);
 }finally{await client.close();}
 const s=await state();assert.equal(s.attempts.length,2);assert.equal(s.project.revision,1);assert.equal(s.project.parts[1].y,2.2);
});
test('replay routes reject bad input and clearly disclose unavailable captures',async()=>{
 for(const body of [{runId:first.id,time:first.duration+1},{runId:first.id,time:null},{runId:first.id,eval:'x'}])assert.equal((await post('replay',body)).status,400);
 assert.equal((await post('replay',{runId:'not-here'})).status,404);
 const r=await post('replay',{runId:first.id,time:1,capture:true,view:{mode:'side'}});
 assert.equal(r.status,200);assert.equal(r.value.captureStatus,'unavailable');assert.deepEqual(r.value.images,[]);assert.equal((await state()).attempts.length,2);
 assert.equal(cli('replay',first.id,'--at','11').status,2);assert.equal(cli('replay',first.id,'--at','9').status,1);
});
test('historical feedback is snapshot-checked at the HTTP boundary',async()=>{
 const note=(await post('feedback',{text:'Compare this contact.',targetId:'bridge',runId:first.id,time:1.2,expectedRevision:0}));
 assert.equal(note.status,200);assert.equal(note.value.revision,0);assert.equal(note.value.currentRevision,1);assert.equal(note.value.time,1.2);
 assert.equal((await post('feedback',{text:'Wrong frame',runId:first.id,time:9})).status,400);
 assert.equal((await post('feedback',{text:'Old live screenshot',expectedRevision:0})).status,409);
 assert.equal((await post('feedback',{text:'Fabricated run',runId:'missing'})).status,404);
});
