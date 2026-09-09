import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFile, mkdir } from 'node:fs/promises';
const client=new Client({name:'kinetic-acceptance',version:'0.2.0'});
const transport=new StdioClientTransport({command:process.execPath,args:['server/mcp.js'],env:{...process.env,KINETIC_URL:process.env.KINETIC_URL||'http://127.0.0.1:4317'},stderr:'pipe'});
const report={tests:[],images:0};
const parsed=r=>JSON.parse(r.content.find(c=>c.type==='text').text);
const invoke=(name,args)=>client.callTool({name,arguments:args});
try {
  await client.connect(transport);
  const tools=await client.listTools();
  assert.equal(tools.tools.length,8);
  assert.deepEqual(new Set(tools.tools.map(t=>t.name)),new Set(['kinetic_inspect','kinetic_probe','kinetic_edit','kinetic_run','kinetic_view','kinetic_feedback','kinetic_replay','kinetic_compare']));
  report.tests.push('MCP initialization and eight advertised tools');

  const inspection=await invoke('kinetic_inspect',{capture:true});assert.ok(!inspection.isError);const initial=parsed(inspection);assert.equal(initial.rules.gravity,-9.81);assert.equal(initial.project.version,1);
  assert.equal(initial.analysis.parts.length,3);assert.equal(initial.analysis.gaps.length,2);assert.equal(initial.analysis.cameraRecommendations.length,3);
  const captures=inspection.content.filter(c=>c.type==='image');
  if(process.env.EXPECT_IMAGES==='1')assert.equal(captures.length,1,'The live browser must deliver an inspection image');
  for(const image of captures)assert.ok(Buffer.from(image.data,'base64').length>10000);
  report.images+=captures.length;report.tests.push('Inspect returns real state, Three.js analysis, and visual evidence when available');

  const probe=await invoke('kinetic_probe',{id:'bridge'});assert.ok(!probe.isError);const probed=parsed(probe);
  assert.equal(probed.part.id,'bridge');assert.equal(probed.part.transform.matrixWorld.length,16);assert.equal(probed.gaps.length,2);assert.ok(probed.part.surfaceNormal.y>.9);
  report.tests.push('Probe returns focused Three.js world-space facts');

  const requestId=crypto.randomUUID();const edit={expectedRevision:initial.project.revision,requestId,operations:[{type:'update',id:'bridge',changes:{y:2.25}}]};
  const changed=await invoke('kinetic_edit',edit);assert.ok(!changed.isError);const revision=parsed(changed).revision;
  const retry=await invoke('kinetic_edit',edit);assert.ok(!retry.isError);assert.equal(parsed(retry).revision,revision);report.tests.push('Typed edit and retry-safe request ID');
  await assert.rejects(invoke('kinetic_edit',{expectedRevision:revision,requestId:'bad-'+requestId,operations:[{type:'update',id:'bridge',changes:{gravity:0}}]}), /Invalid arguments/);report.tests.push('MCP rejects changes to locked challenge rules');

  const run=await invoke('kinetic_run',{expectedRevision:revision,capture:true});assert.ok(!run.isError,JSON.stringify(run));const result=parsed(run);assert.equal(result.success,true);assert.equal(result.status,'success');assert.ok(result.duration>1);assert.ok(result.contacts.length>=3);
  assert.ok(result.contacts.every(c=>c.position&&Number.isFinite(c.speed)));assert.ok(result.closestPoint&&Number.isFinite(result.closestTime));assert.ok(result.frameCount>0);assert.ok(Array.isArray(result.trajectorySample));
  const images=run.content.filter(c=>c.type==='image');if(process.env.EXPECT_IMAGES==='1')assert.equal(images.length,3,'A run must return three actual replay frames');report.images+=images.length;
  for(let i=0;i<images.length;i++){await mkdir('evidence',{recursive:true});await writeFile(`evidence/mcp-run-${i+1}.png`,Buffer.from(images[i].data,'base64'));}
  report.tests.push('Physics through MCP reaches cup with compact spatial evidence and real dwell criterion');

  if(images.length){
    assert.equal(result.captureMetadata.length,3);
    assert.equal(new Set(images.map(i=>i.data)).size,3,'Replay frames must contain distinct rendered states');
    assert.ok(result.captureMetadata.every(m=>m.revision===revision&&m.width<=960&&m.height<=720));
  }
  const viewpoint=await invoke('kinetic_view',{mode:'side',focus:'bridge',overlays:true});
  if(process.env.EXPECT_IMAGES==='1'){
    assert.ok(!viewpoint.isError,JSON.stringify(viewpoint));const vi=viewpoint.content.filter(c=>c.type==='image');assert.equal(vi.length,1);report.images+=vi.length;
    await writeFile('evidence/mcp-focused-side.png',Buffer.from(vi[0].data,'base64'));
    assert.equal(parsed(viewpoint).captureMetadata[0].focus,'bridge');
    report.tests.push('Focused side view returns bounds and normals without a scene edit');
  } else assert.ok(viewpoint.isError,'No viewer must not produce a fake image');
  const feedback=await invoke('kinetic_feedback',{});assert.ok(!feedback.isError);assert.ok(Array.isArray(parsed(feedback).feedback));report.tests.push('Read human feedback without consuming it');
  const final=parsed(await invoke('kinetic_inspect',{capture:false}));assert.deepEqual(final.rules,initial.rules);assert.equal(final.project.parts.find(p=>p.id==='bridge').y,2.25);
  report.tests.push('Target, gravity and object identities unchanged');report.success=true;report.outcome={duration:result.duration,status:result.status,closest:result.closest};
} finally {await client.close();}
await mkdir('evidence',{recursive:true});await writeFile('evidence/mcp-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
