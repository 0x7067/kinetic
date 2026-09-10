import {runCLI} from './cli-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const url='http://127.0.0.1:4394';
const cli=(...args)=>runCLI(url,args);


test('agents can discover, create, render, simulate, replay, save and reopen a scene through live CLI/MCP',async t=>{
  const folder=mkdtempSync(join(tmpdir(),'kinetic-scene-api-'));
  const service=spawn(process.execPath,['server/http.js'],{env:{...process.env,KINETIC_TEMPLATE:'scene',PORT:'4394',KINETIC_DATA:join(folder,'state.json')},stdio:'ignore'});
  t.after(async()=>{const exited=new Promise(resolve=>service.once('exit',resolve));service.kill();await exited;rmSync(folder,{recursive:true,force:true});});
  for(let i=0;i<100;i++){try{if((await fetch(url+'/api/state')).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  assert.equal(cli('inspect').project.version,2);
  const client=new Client({name:'kinetic-scene-test',version:'1'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:['server/mcp.js'],env:{...process.env,KINETIC_URL:url},stderr:'pipe'}));
  t.after(()=>client.close());
  const call=async(name,args)=>{const r=await client.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r));return JSON.parse(r.content[0].text);};
  const discovery=await client.listTools();assert.match(discovery.tools.find(x=>x.name==='kinetic_edit').description,/workspace/);
  const opened=cli('new','demo','--revision','0');assert.equal(opened.project.parts.length,7);
  const state=await call('kinetic_inspect',{});assert.equal(state.project.revision,1);assert.equal(state.analysis.mode,'scene');
  for(const id of ['ramp','ball','plot'])assert.deepEqual(cli('probe',id),await call('kinetic_probe',{id}));
  assert.ok(cli('probe','ramp').part.topSurface.downhill.x>0);assert.equal(cli('probe','ball').part.surfaceNormal,null);
  const edited=await call('kinetic_edit',{expectedRevision:1,requestId:'scene-change',operations:[{type:'update',id:'ball',changes:{y:5}},{type:'configure',settings:{duration:2}}]});
  assert.equal(edited.revision,2);
  const run=await call('kinetic_run',{expectedRevision:2,capture:false});assert.equal(run.mode,'scene');assert.equal(run.success,null);assert.equal(run.status,'completed');assert.ok(run.frameCount>10);assert.equal('frames' in run,false);
  const frame=cli('replay',run.id,'--at','1.1');assert.deepEqual(frame,await call('kinetic_replay',{runId:run.id,time:1.1}));
  assert.ok(frame.frame.objects.ball.y<5);
  const file=join(folder,'exports','scene.json');cli('save',file);assert.equal(JSON.parse(readFileSync(file)).version,2);
  cli('new','marble','--revision','2');assert.equal(cli('inspect').project.version,1);
  cli('import',file,'--revision','3');assert.equal(cli('inspect').project.version,2);assert.equal(cli('inspect').project.parts.find(p=>p.id==='ball').y,5);
  assert.equal(JSON.parse(readFileSync(join(folder,'state.json'))).project.version,2);
  const noImage=await call('kinetic_inspect',{capture:true});assert.equal(noImage.captureStatus,'unavailable');
  const stale=await client.callTool({name:'kinetic_edit',arguments:{expectedRevision:2,requestId:'stale',operations:[{type:'update',id:'ball',changes:{y:0}}]}});assert.ok(stale.isError);
});
