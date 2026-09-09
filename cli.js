#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient, ClientError, summarize } from './server/client.js';
import { LIMITS } from './src/model.js';

const VERSION = '0.4.0';
const raw = process.argv.slice(2);
const globals = ['json','full','url','capture-dir','help'];
const values = new Set(['url','capture-dir','revision','request-id','view','focus','at']);
const booleans = new Set(['json','full','help','version','capture','overlays','force']);
const spec = {
  inspect: ['capture','view','focus','overlays'], probe: [],
  runs: [], replay: ['at','capture','view','focus','overlays'], compare: [],
  run: ['revision','capture','view','focus','overlays'], view: ['focus','overlays'],
  set: ['revision','request-id'], batch: ['revision','request-id'],
  undo: ['revision'], redo: ['revision'], reset: ['revision'],
  save: ['force'], import: ['revision'], feedback: [], doctor: [], serve: [], version: [], help: [],
};
const usage = {
  inspect: 'kinetic inspect [--capture] [--view iso|side|top] [--focus ID] [--overlays]',
  probe: 'kinetic probe ID',
  runs: 'kinetic runs (list retained run IDs)',
  replay: 'kinetic replay RUN_ID [--at SECONDS] [--capture] [--view iso|side|top] [--focus ID] [--overlays]',
  compare: 'kinetic compare BASELINE_RUN_ID CANDIDATE_RUN_ID',
  run: 'kinetic run [--revision N] [--capture] [--view iso|side|top] [--focus ID] [--overlays]',
  view: 'kinetic view [iso|side|top] [--focus ID] [--overlays]',
  set: 'kinetic set ID field=value [...] --revision N [--request-id ID]',
  batch: 'kinetic batch operations.json --revision N [--request-id ID]',
  undo: 'kinetic undo --revision N', redo: 'kinetic redo --revision N', reset: 'kinetic reset --revision N',
  save: 'kinetic save project.json [--force]', import: 'kinetic import project.json --revision N',
  feedback: 'kinetic feedback list | show ID | resolve ID [...]',
  doctor: 'kinetic doctor', serve: 'kinetic serve (foreground; PORT and KINETIC_DATA configure the service)',
};
const editFields = `Editable fields: name (1–60 characters, not blank), ${Object.entries(LIMITS).map(([field,[min,max]])=>`${field} (${min} to ${max})`).join(', ')}.
Distances are metres, Y is up; angle (pitch) and yaw are degrees. Bounds are inclusive.
Use IDs from inspect. An update cannot change id or kind. Gravity, spawn, cup and rules are locked.`;
const commandDetails = {
  run: 'A completed attempt can fail: read success/status. Contacts are the first impact with each object.\nContact normal points from the struck surface toward the marble (world coordinates); unavailable normals are null.\nContact position is the marble centre and velocity is measured after the physics step.\nUse replay RUN_ID --at SECONDS to inspect a recorded contact without another simulation.',
  save: 'Creates missing parent directories. Refuses to overwrite an existing file unless --force is supplied.\nExports the current editable project, not recordings or feedback.',
  set: `${editFields}
Supply one or more field=value arguments; quote names containing spaces.
Example: kinetic set bridge 'name=Landing deck' --revision N
For several parts in one revision/undo step, use kinetic batch --help.`,
  batch: `${editFields}
The file must contain a JSON array of 1–20 operations (at most 100 kB).
All operations commit together as one revision/undo step, or none do on error.
Operation shapes:
  {"type":"update","id":"PART_ID","changes":{"FIELD":VALUE}}
  {"type":"remove","id":"PART_ID"}
  {"type":"add","part":{"id":"NEW_ID","kind":"ramp","name":"New deck","x":0,"y":1,"z":0,"angle":0,"yaw":0,"length":2}}
For add, all shown part fields are required; kind is ramp, platform or barrier.
IDs start with a letter, then letters/digits/_/-, at most 40 characters; new IDs must be unique.
At most three parts. To replace a part at the budget, remove it before adding its replacement.
Save this naming-only example as operations.json, then use the inspected --revision:
\`\`\`json
[{"type":"update","id":"bridge","changes":{"name":"Landing deck"}},{"type":"update","id":"home","changes":{"name":"Final deck"}}]
\`\`\`
kinetic batch operations.json --revision N --request-id unique-edit-id
Retry an uncertain result with the same request ID and identical payload; use a new ID for a different edit.`,
};
const help = `Kinetic ${VERSION} — a real-physics workshop for people and agents.

Core loop:
  kinetic                         Inspect current state
  kinetic run                     Measure the failure
  kinetic probe <part-id>          Read deck endpoints, slope and bounds
  kinetic set <part-id> y=<metres> --revision <N>
  kinetic run --capture            Measure again and save three actual PNGs

${Object.values(usage).join('\n')}

Replay and compare read recorded evidence without new simulations. Replay time is in simulated seconds.

Metres, Y-up; pitch (angle) and yaw are DEGREES. Three-part budget.
Gravity, spawn, cup and success rules are locked. All mutations are undoable.
--revision uses the revision you inspected, not an automatically refreshed one.
--request-id makes the same batch retry-safe in this running service session.
Images need an open browser tab; physics runs without it. No built-in LLM.

Globals: --json, --full, --url <loopback HTTP origin>, --capture-dir <directory>
Run any command with --help for its concise contract. Errors: exit 1; usage: exit 2.
A completed physics attempt exits 0 even when the marble misses: read success/status.`;

function usageError(message, command = 'help') {
  throw new ClientError('INVALID_ARGUMENT', message, usage[command] || 'kinetic --help', true);
}
function parse() {
  const options = {}, positional = [];
  for (let i = 0; i < raw.length; i++) {
    let token = raw[i];
    if (token === '-h') token = '--help';
    if (!token.startsWith('--')) { positional.push(token); continue; }
    const equals = token.indexOf('='); const key = token.slice(2, equals < 0 ? undefined : equals);
    if (!values.has(key) && !booleans.has(key)) usageError(`Unknown flag --${key}.`);
    if (Object.hasOwn(options,key)) usageError(`Repeated flag --${key}.`);
    if (booleans.has(key)) {
      if (equals >= 0) usageError(`--${key} does not accept a value.`);
      options[key] = true;
    } else {
      const value = equals < 0 ? raw[++i] : token.slice(equals+1);
      if (value === undefined || !value.trim() || value.startsWith('--')) usageError(`--${key} requires a value.`);
      options[key] = value;
    }
  }
  let command = positional.shift() || (options.version ? 'version' : options.help ? 'help' : 'inspect');
  if (command === 'edit') command = 'set';
  if (command === 'capture') { command = 'inspect'; options.capture = true; }
  if (!Object.hasOwn(spec,command)) usageError(`Unknown command ${command}.`);
  for (const key of Object.keys(options)) {
    if (![...globals,...spec[command],...(command==='version'?['version']:[])].includes(key)) usageError(`--${key} is not valid for ${command}.`,command);
  }
  if (options.full && !options.json) usageError('--full requires --json.',command);
  if (['inspect','run','replay'].includes(command) && (options.view || options.focus || options.overlays) && !options.capture) usageError('View options require --capture.', command);
  if (options.view && !['iso','side','top'].includes(options.view)) usageError('View must be iso, side or top.',command);
  if (options.at !== undefined && (!Number.isFinite(Number(options.at)) || Number(options.at)<0 || Number(options.at)>10)) usageError('--at must be between 0 and 10 simulated seconds.',command);
  if (options.focus && !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(options.focus)) usageError('Focus must be a valid part ID.',command);
  if (options.revision !== undefined && !/^\d+$/.test(options.revision)) usageError('--revision must be a nonnegative integer.',command);
  if (options.revision !== undefined && !Number.isSafeInteger(Number(options.revision))) usageError('--revision is too large.',command);
  if (options['request-id'] && options['request-id'].length > 100) usageError('--request-id is limited to 100 characters.',command);
  if (options.help || command === 'help') return {command:'help', topic:command==='help'?positional[0]:command, options};
  const counts = {runs:0,replay:1,compare:2,inspect:0,run:0,doctor:0,serve:0,version:0,undo:0,redo:0,reset:0,probe:1,batch:1,save:1,import:1};
  if (command in counts && positional.length !== counts[command]) usageError(`Expected ${counts[command]} positional arguments for ${command}.`,command);
  if (command === 'set' && positional.length < 2) usageError('Supply a part ID and one or more field=value changes.',command);
  if (command === 'view' && (positional.length>1 || (positional[0]&&!['iso','side','top'].includes(positional[0])))) usageError('View must be iso, side or top.',command);
  if (['set','batch','undo','redo','reset','import'].includes(command) && options.revision === undefined) usageError('Supply the --revision reported by inspect. This prevents overwriting unseen edits.',command);
  if (command === 'feedback') {
    const [action='list',...ids] = positional;
    if (!['list','show','resolve'].includes(action) || action==='list'&&ids.length || action==='show'&&ids.length!==1 || action==='resolve'&&(!ids.length||ids.length>30)) usageError('Use list, show ID, or resolve ID [...].',command);
    if (ids.some(id=>!/^[a-zA-Z0-9_-]{1,100}$/.test(id))) usageError('Invalid feedback ID.',command);
  }
  return {command, options, positional};
}
function changes(tokens) {
  const result = {};
  for (const token of tokens) {
    const at = token.indexOf('='); if(at<1) usageError(`Expected field=value, received ${token}.`,'set');
    const key=token.slice(0,at),value=token.slice(at+1);
    if (Object.hasOwn(result,key)) usageError(`Repeated field ${key}.`,'set');
    if (key==='name') { if(!value.trim()||value.length>60)usageError('Name must contain 1–60 characters.','set'); result[key]=value; }
    else {
      if(!Object.hasOwn(LIMITS,key))usageError(`Editable fields: name, ${Object.keys(LIMITS).join(', ')}.`,'set');
      const [min,max]=LIMITS[key],n=Number(value);
      if(!value.trim()||!Number.isFinite(n)||n<min||n>max)usageError(`${key} must be between ${min} and ${max}.`,'set');
      result[key]=n;
    }
  }
  return result;
}
function readJSON(file) {
  if(statSync(file).size>100_000)usageError('Input JSON is limited to 100 kB.');
  try{return JSON.parse(readFileSync(file,'utf8'));}catch{usageError('Input must be valid JSON.');}
}
const n=(value,d=2)=>Number(value).toFixed(d);
const xyz=p=>`(${n(p.x)}, ${n(p.y)}, ${n(p.z)})`;
const contactText=c=>`${c.part}${c.surface?'/'+c.surface:''}@${n(c.time,4)}s${c.velocity?` vx=${n(c.velocity.x)}m/s`:''} normal=${c.normal?xyz(c.normal):'unavailable'}`;
function inspectText(s) {
  return [
    `revision ${s.project.revision} | ${s.project.parts.length}/${s.rules.maxParts} parts | undo ${s.canUndo?'yes':'no'} | redo ${s.canRedo?'yes':'no'}`,
    `start ${xyz(s.rules.start)} -> cup ${xyz(s.rules.goal)} | metres; angle/yaw in degrees`,
    ...s.project.parts.map(p=>`${p.id} [${p.kind}] ${xyz(p)} pitch=${p.angle}° yaw=${p.yaw}° length=${p.length}m`),
    ...s.analysis.gaps.map(g=>`gap ${g.from}->${g.to}: horizontal=${n(g.horizontalDistance)}m vertical=${n(g.verticalDelta)}m (deck endpoints, not clearance)`),
    s.attempts[0]?`last-run ${s.attempts[0].id}: ${s.attempts[0].status} @ revision ${s.attempts[0].revision}; closest ${n(s.attempts[0].closest)}m to cup centre`:'last-run none',
    `feedback ${s.feedback.filter(x=>!x.resolved).length} pending`,
    'next: kinetic run; kinetic probe <id>; kinetic view side --focus <id>',
  ].join('\n');
}
async function main() {
  const {command,options:o,positional:a=[],topic}=parse();
  if(command==='help'){console.log(topic&&usage[topic]?`${usage[topic]}\n${commandDetails[topic]||''}\n${['set','batch','undo','redo','reset','import'].includes(topic)?'Use the inspected --revision; edits are never implicitly rebased.\n':''}Global options: --json, --full (with --json), --url, --capture-dir.\nUnknown flags are rejected before connecting.`:help);return;}
  if(command==='version'){console.log(o.json?JSON.stringify({version:VERSION}):VERSION);return;}
  // Validate user intent before any network request.
  let operations;
  if(command==='set')operations=[{type:'update',id:a[0],changes:changes(a.slice(1))}];
  if(command==='batch'){operations=readJSON(a[0]);if(!Array.isArray(operations)||!operations.length||operations.length>20)usageError('Batch must contain 1–20 operations.','batch');}
  const client=createClient(o.url||process.env.KINETIC_URL);
  if(command==='serve'){await import('./server/http.js');return;}
  let value,text;
  const view={mode:o.view||'iso',...(o.focus?{focus:o.focus}:{}),overlays:!!o.overlays};
  if(command==='inspect') { value=await client.inspect({capture:!!o.capture,...(o.capture?{view}:{})});text=inspectText(value); }
  else if(command==='probe') {
    value=await client.probe(a[0]);const p=value.part;
    text=`${p.id}: ${p.name} @ revision ${value.revision}\nposition ${xyz(p.transform.position)} pitch=${p.transform.angleDeg}° yaw=${p.transform.yawDeg}°\ndeck endpoints ${p.endpoints.map(xyz).join(' -> ')}\nbounds ${xyz(p.bounds.min)} -> ${xyz(p.bounds.max)}\nnormal ${xyz(p.surfaceNormal)}; downhill ${p.downhill?xyz(p.downhill):'none (level)'}\nnext: kinetic view side --focus ${p.id} --overlays`;
  } else if(command==='runs') {
    const state=await client.request('/api/state');value={runs:state.attempts,revision:state.project.revision};
    text=state.attempts.length?state.attempts.map(r=>`${r.id} | r${r.revision} | ${r.status} | ${n(r.duration)}s`).join('\n'):'No retained runs. Start with: kinetic run';
  } else if(command==='replay') {
    value=await client.replay({runId:a[0],...(o.at===undefined?{}:{time:Number(o.at)}),capture:!!o.capture,...(o.capture?{view}:{})});
    text=`recorded run ${value.run.id} | r${value.revision} (saved r${value.currentRevision})\ntime ${n(value.frame.t,4)}s | position ${xyz(value.frame)} | speed ${n(value.frame.speed)}m/s | ${value.frame.sampleMethod}\nvelocity (${n(value.frame.vx)}, ${n(value.frame.vy)}, ${n(value.frame.vz)}) m/s\nNo physics rerun; no layout change.`;
  } else if(command==='compare') {
    value=await client.compare(a[0],a[1]);
    text=`baseline ${value.baseline.id} r${value.baseline.revision}: ${value.baseline.status}\ncandidate ${value.candidate.id} r${value.candidate.revision}: ${value.candidate.status}\nclosest delta ${n(value.closestDelta,4)}m; duration delta ${n(value.durationDelta,4)}s\n`+value.changes.map(c=>`${c.id}: ${c.type} ${Object.entries(c.fields||{}).map(([k,v])=>`${k} ${v.before} -> ${v.after}`).join(', ')}`).join('\n')+'\n'+value.interpretation;
  } else if(command==='run') {
    value=await client.run({...(o.revision===undefined?{}:{expectedRevision:Number(o.revision)}),capture:!!o.capture,...(o.capture?{view}:{})});
    text=`${value.success?'SUCCESS':'FAIL'} ${value.status} | run ${value.id} | revision ${value.revision} | ${n(value.duration)}s\nclosest ${n(value.closest)}m to cup centre; end ${xyz(value.end)}\ncontacts ${value.contacts.map(contactText).join(', ')}\n${value.message}\nnext: ${value.success?'kinetic save working-project.json':'kinetic probe <last-part>; kinetic view side --focus <last-part>'}`;
  } else if(command==='view') { value=await client.view({...view,mode:a[0]||'iso'});text=`view ${a[0]||'iso'} | focus ${o.focus||'scene'} | overlays ${o.overlays?'on':'off'}`; }
  else if(command==='set'||command==='batch') {
    const requestId=o['request-id']||crypto.randomUUID();
    value=await client.edit({operations,expectedRevision:Number(o.revision),requestId});
    value.requestId=requestId;
    text=`${value.replayed?'replayed':value.changed?'changed':'unchanged'} | revision ${value.revision} | request-id ${requestId}\n${command==='set'?`${a[0]} ${a.slice(1).join(' ')}`:`${operations.length} operations`}\nnext: kinetic run --revision ${value.revision}`;
  } else if(['undo','redo','reset'].includes(command)) {
    value=await client.request(`/api/${command}`,{expectedRevision:Number(o.revision)});
    text=`${command}: ${value.changed===false?'no change':'applied'} | revision ${value.revision??value.project.revision}`;
  } else if(command==='save') {
    const state=await client.request('/api/state'); const path=resolve(a[0]);
    mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,JSON.stringify(state.project,null,2),{flag:o.force?'w':'wx',mode:0o600});
    value={path,revision:state.project.revision};text=`saved revision ${value.revision}: ${path}`;
  } else if(command==='import') {
    value=await client.request('/api/import',{expectedRevision:Number(o.revision),project:readJSON(a[0])});text=`imported | revision ${value.project.revision}`;
  } else if(command==='doctor') {
    const s=await client.request('/api/state');value={reachable:true,fixedGravity:s.rules.gravity===-9.81,stableIds:new Set(s.project.parts.map(p=>p.id)).size===s.project.parts.length,partsWithinBudget:s.project.parts.length<=s.rules.maxParts,revision:s.project.revision};
    text=`ok ${client.base.origin} | revision ${s.project.revision} | ${s.project.parts.length}/${s.rules.maxParts} parts`;
    if(!value.fixedGravity||!value.stableIds||!value.partsWithinBudget)throw new ClientError('INVARIANT_FAILED','The running workshop violates its declared constraints.');
  } else if(command==='feedback') {
    const action=a[0]||'list';value=await client.feedback(action==='resolve'?a.slice(1):undefined);
    if(action==='show') { const note=value.feedback.find(n=>n.id===a[1]);if(!note)throw new ClientError('NOT_FOUND','No pending feedback with that ID.','kinetic feedback list');value={feedback:[note],images:note.screenshot?[note.screenshot]:[]}; }
    else delete value.images;
    text=value.feedback.length?value.feedback.map(n=>`${n.id} | r${n.revision} | ${n.targetId||'scene'} ${n.time!=null?' | '+n.time.toFixed(3)+'s':''} | ${n.text}${n.screenshot?' [image: feedback show '+n.id+']':''}`).join('\n'):'feedback: 0 pending';
  }
  const {data,images}=summarize(value,!!o.full);
  const paths=[];
  if(images.length) {
    const dir=resolve(o['capture-dir']||'.kinetic/captures');mkdirSync(dir,{recursive:true});
    const stem=`${command}-r${value.revision??value.project?.revision??'view'}-${crypto.randomUUID()}`;
    for(let i=0;i<images.length;i++){
      const match=/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(images[i]);
      if(!match)throw new ClientError('INVALID_IMAGE','The service returned an invalid PNG payload.');
      const path=resolve(dir,`${stem}-${i+1}.png`);writeFileSync(path,Buffer.from(match[1],'base64'),{flag:'wx'});paths.push(path);
    }
    text+='\ncaptures '+paths.join(' ');
  } else if(value.imageStatus)text+='\ncapture: '+value.imageStatus;
  if(images.length||value.imageStatus)data.imagePaths=paths;
  console.log(o.json?JSON.stringify(data):text);
  if(command==='view'&&!images.length)process.exitCode=1;
}
main().catch(error=>{
  const known=error instanceof ClientError;
  const data={error:{code:known?error.code:error.code==='EEXIST'?'FILE_EXISTS':'IO_ERROR',message:known?error.message:error.code==='EEXIST'?'Destination exists; choose another file or use --force.':'The operation could not complete.'},help:error.help||'kinetic --help'};
  console.log(raw.includes('--json')?JSON.stringify(data):`error ${data.error.code}: ${data.error.message}\nhelp: ${data.help}`);
  process.exitCode=known&&error.usage?2:1;
});
