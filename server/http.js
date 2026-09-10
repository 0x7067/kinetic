import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workshop, WorkshopError, initialProject, validateProject, projectStuff } from '../src/model.js';
import { simulate, ready } from '../src/physics.js';
import { sampleRun, compareRuns, runSummary } from '../src/replay.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||4317), dataPath=resolve(process.env.KINETIC_DATA||resolve(ROOT,'.kinetic/workshop.json'));
if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('PORT must be 1–65535.');
mkdirSync(dirname(dataPath),{recursive:true});
let workshop;
try { const saved=JSON.parse(readFileSync(dataPath,'utf8'));workshop=new Workshop(saved); workshop.feedback=Array.isArray(saved.feedback)?saved.feedback.slice(0,30):[]; }
catch(error){if(existsSync(dataPath)){console.error('Saved project could not be loaded. Original file preserved:',dataPath);throw error;}workshop=new Workshop();}
const persist=()=>{const temp=`${dataPath}.tmp`;writeFileSync(temp,JSON.stringify({project:workshop.project,feedback:workshop.feedback}),{mode:0o600});renameSync(temp,dataPath);};
const clients=new Set(),runs=new Map(),captures=new Map();let busy=false;
function publish(type,data){const msg=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const res of clients)res.write(msg);}
function changed(){persist();publish('state',workshop.state());}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function safeRead(req){return new Promise((resolve,reject)=>{let text='',size=0;req.on('data',chunk=>{size+=chunk.length;if(size>2_000_000){reject(new WorkshopError('BODY_TOO_LARGE','Request limit is 2 MB.',413));req.destroy();return;}text+=chunk;});req.on('end',()=>{try{resolve(text?JSON.parse(text):{});}catch{reject(new WorkshopError('INVALID_JSON','Body must be valid JSON.'));}});req.on('error',reject);});}
function validateView(view = {}, project = workshop.project) {
  if (!view || typeof view !== 'object' || Array.isArray(view) || Object.keys(view).some(k=>!['mode','focus','overlays'].includes(k))) throw new WorkshopError('INVALID_VIEW','View accepts mode, focus and overlays only.');
  if (view.mode !== undefined && !['iso','side','top'].includes(view.mode)) throw new WorkshopError('INVALID_VIEW','View mode must be iso, side or top.');
  if (view.overlays !== undefined && typeof view.overlays !== 'boolean') throw new WorkshopError('INVALID_VIEW','overlays must be boolean.');
  if (view.focus !== undefined && (typeof view.focus !== 'string' || !projectStuff(project).some(p=>p.id===view.focus))) throw new WorkshopError('NOT_FOUND','Capture focus must name an existing part.',404);
  return view;
}
async function capture(project, run, view = {}, time) {
  validateView(view,project);
  if(!clients.size)return {images:[],captureStatus:'unavailable',imageStatus:'No browser connected. Open the workshop for visual evidence.'};
  if(captures.size>=1)return {images:[],captureStatus:'busy',imageStatus:'Another capture is in progress. Retry after it finishes.'};
  const id=crypto.randomUUID(),expectedCount=run&&time===undefined?3:1;
  return new Promise(resolve=>{
    const timer=setTimeout(()=>{captures.delete(id);resolve({images:[],captureStatus:'timeout',imageStatus:'Browser capture timed out. No visual success is claimed; the structured physics result remains valid.'});},25000);
    captures.set(id,{revision:project.revision,expectedCount,finish:(images,metadata)=>{clearTimeout(timer);captures.delete(id);resolve({images,captureStatus:'captured',captureMetadata:metadata,imageStatus:'Captured from the connected browser.'});}});
    // A snapshot, not the current mutable document. Images always describe this revision.
    publish('capture',{id,revision:project.revision,project:structuredClone(project),run:run||null,view,...(time===undefined?{}:{time})});
  });
}
const staticPaths={
  '/':'index.html','/index.html':'index.html',
  '/vendor/three.module.js':'node_modules/three/build/three.module.js',
  '/vendor/three.core.js':'node_modules/three/build/three.core.js',
  '/vendor/rapier.mjs':'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs',
  '/vendor/addons/controls/OrbitControls.js':'node_modules/three/examples/jsm/controls/OrbitControls.js',
  '/vendor/addons/geometries/RoundedBoxGeometry.js':'node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js',
};
for(const file of ['app.js','model.js','physics.js','solver.js','view.js','style.css','replay.js','replay-player.js','compositions/marble-cup.js'])staticPaths[`/src/${file}`]=`src/${file}`;
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' data:; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{
    const host=req.headers.host;
    if(![`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`].includes(host))throw new WorkshopError('INVALID_HOST','Local connections only.',403);
    if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))throw new WorkshopError('INVALID_ORIGIN','Cross-origin requests are not allowed.',403);
    const path=new URL(req.url,`http://${host}`).pathname;
    if(req.method==='GET'&&path==='/api/state')return json(res,workshop.state());
    if(req.method==='GET'&&path==='/api/config')return json(res,{mcpServers:{kinetic:{command:'node',args:[resolve(ROOT,'server/mcp.js')],env:{KINETIC_URL:`http://127.0.0.1:${port}`}}}});
    if(req.method==='GET'&&path==='/api/events'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);
      const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{clearInterval(timer);clients.delete(res);});return;
    }
    if(req.method==='GET'&&path.startsWith('/api/runs/')){const run=runs.get(path.slice(10));if(!run)throw new WorkshopError('NOT_FOUND','Replay is no longer in memory.',404);return json(res,run);}
    if(req.method==='GET'&&path==='/api/feedback')return json(res,{feedback:workshop.feedback.filter(n=>!n.resolved)});
    if(req.method==='POST'&&path.startsWith('/api/')){
      if(!(req.headers['content-type']||'').startsWith('application/json'))throw new WorkshopError('CONTENT_TYPE','Use application/json.',415);
      const body=await safeRead(req);
      if(!body||typeof body!=='object'||Array.isArray(body))throw new WorkshopError('INVALID_BODY','Body must be a JSON object.');
      if(path.startsWith('/api/capture/')){
        const pending=captures.get(path.slice(13));
        if(!pending)return json(res,{accepted:false});
        if(body.revision!==pending.revision)return json(res,{accepted:false,reason:'stale capture'});
        if(!Array.isArray(body.images)||body.images.length!==pending.expectedCount||body.images.some(s=>typeof s!=='string'||s.length>1_500_000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s)))throw new WorkshopError('INVALID_IMAGES','Expected exactly the requested number of bounded PNG screenshots.');
        if(!Array.isArray(body.metadata)||body.metadata.length!==pending.expectedCount||JSON.stringify(body.metadata).length>12000)throw new WorkshopError('INVALID_METADATA','Include one bounded metadata record per screenshot.');
        pending.finish(body.images,body.metadata);return json(res,{accepted:true});
      }
      const fields={
        '/api/inspect':['capture','view'], '/api/view':['mode','focus','overlays'], '/api/run':['expectedRevision','capture','view'],
        '/api/edit':['operations','expectedRevision','requestId'], '/api/undo':['expectedRevision'], '/api/redo':['expectedRevision'], '/api/reset':['expectedRevision'],
        '/api/import':['project','expectedRevision'], '/api/replay':['runId','time','capture','view'], '/api/compare':['baseline','candidate'],
        '/api/feedback':['text','targetId','camera','screenshot','runId','time','expectedRevision'], '/api/feedback/resolve':['ids'],
      };
      if(fields[path] && Object.keys(body).some(k=>!fields[path].includes(k))) throw new WorkshopError('UNKNOWN_FIELD','Unknown request field; nothing was changed.');
      if(body.capture !== undefined && typeof body.capture !== 'boolean')throw new WorkshopError('INVALID_CAPTURE','capture must be boolean.');
      if(body.view !== undefined && path!=='/api/replay')validateView(body.view);
      const retainedRun = id => {
        if (typeof id !== 'string' || !id || id.length > 100) throw new WorkshopError('INVALID_RUN_ID','Supply a recorded run ID.');
        const run=runs.get(id);if(!run)throw new WorkshopError('RUN_NOT_FOUND','This run is no longer retained. Inspect attempts for an available ID.',404);return run;
      };
      if(path==='/api/replay'){
        const run=retainedRun(body.runId),time=body.time===undefined?run.duration:body.time,frame=sampleRun(run,time);
        validateView(body.view||{},run.project);
        return json(res,{run:runSummary(run),revision:run.revision,currentRevision:workshop.project.revision,frame,
          ...(body.capture?await capture(run.project,run,body.view,time):{})});
      }
      if(path==='/api/compare')return json(res,{...compareRuns(retainedRun(body.baseline),retainedRun(body.candidate)),currentRevision:workshop.project.revision});
      if(path==='/api/inspect'){const state=workshop.state();const images=body.capture?await capture(state.project,null,body.view):{};return json(res,{...state,...images});}
      if(path==='/api/view'){const project=structuredClone(workshop.project);validateView(body,project);return json(res,{revision:project.revision,...await capture(project,null,body)});}
      if(path==='/api/feedback'){const note=workshop.addFeedback(body,body.runId?runs.get(body.runId):null);changed();return json(res,note);}
      if(path==='/api/feedback/resolve'){
        if(!Array.isArray(body.ids)||body.ids.length>30)throw new WorkshopError('INVALID_IDS','Supply up to 30 feedback IDs.');
        if(body.ids.some(id=>typeof id!=='string'||!id||id.length>100))throw new WorkshopError('INVALID_IDS','Feedback IDs must be bounded strings.');
        workshop.feedback=workshop.feedback.filter(note=>!body.ids.includes(note.id));
        changed();return json(res,{remaining:workshop.feedback.filter(n=>!n.resolved).length});
      }
      if(busy)throw new WorkshopError('BUSY','A physics attempt is in progress. Retry after it finishes.',409);
      if(path==='/api/edit'){const result=workshop.edit(body);changed();return json(res,result);}
      if(path==='/api/undo'){const result=workshop.undo(body.expectedRevision);changed();return json(res,result);}
      if(path==='/api/redo'){const result=workshop.redo(body.expectedRevision);changed();return json(res,result);}
      if(path==='/api/reset'){workshop.check(body.expectedRevision);workshop.commit(initialProject());changed();return json(res,workshop.state());}
      if(path==='/api/import'){workshop.check(body.expectedRevision);workshop.commit(validateProject(body.project));changed();return json(res,workshop.state());}
      if(path==='/api/run'){
        workshop.check(body.expectedRevision);busy=true;let run;
        try{run=await simulate(workshop.project);workshop.addRun(run);runs.set(run.id,run);if(runs.size>20)runs.delete(runs.keys().next().value);publish('state',workshop.state());}finally{busy=false;}
        const images=body.capture?await capture(run.project,run,body.view):{};publish('run',run);return json(res,{...run,...images});
      }
      throw new WorkshopError('NOT_FOUND','Unknown endpoint.',404);
    }
    if(req.method==='GET' && staticPaths[path]){
      const file=resolve(ROOT,staticPaths[path]);const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'}[extname(file)];
      res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Content-Length':statSync(file).size,'Cache-Control':path.startsWith('/vendor/')?'public, max-age=86400':'no-cache'});res.end(readFileSync(file));return;
    }
    throw new WorkshopError('NOT_FOUND','Not found.',404);
  }catch(error){if(res.headersSent){res.end();return;}json(res,{error:{code:error.code||'INTERNAL_ERROR',message:error instanceof WorkshopError?error.message:'Unexpected server error.'}},error.status||500);if(!(error instanceof WorkshopError))console.error(error);}
});
server.requestTimeout=15000;server.headersTimeout=10000;
await ready();server.listen(port,'127.0.0.1',()=>console.log(`Kinetic: http://127.0.0.1:${port}\nProject: ${dataPath}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const res of clients)res.end();server.close(()=>process.exit(0));});
