import { mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, renameSync, rmSync, realpathSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WorkshopError } from '../src/errors.js';
import { validateNativeProject, nativeFilePath, nativeInspection, NATIVE_RULES } from '../src/native-model.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const nativeHash=project=>createHash('sha256').update(JSON.stringify(project.native)).digest('hex');
export function readNativeDirectory(directory) {
  try{return readNativeSource(directory);}catch(error){
    if(error instanceof WorkshopError)throw error;
    if(error instanceof SyntaxError)throw new WorkshopError('INVALID_MANIFEST','kinetic.project.json must contain valid JSON.');
    throw new WorkshopError('SOURCE_READ_FAILED',`Cannot read this project (${error.code||'read error'}). Check its directory, manifest and listed files.`);
  }
}
function readNativeSource(directory) {
  const root=realpathSync(resolve(directory));
  const manifestPath=resolve(root,'kinetic.project.json');
  if(lstatSync(manifestPath).isSymbolicLink()||lstatSync(manifestPath).size>4000)throw new WorkshopError('INVALID_MANIFEST','Use a local kinetic.project.json file under 4 KB.');
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  if(!manifest||manifest.version!==1||Object.keys(manifest).some(k=>!['version','id','title','entry','files'].includes(k))||!Array.isArray(manifest.files)||manifest.files.length>48)throw new WorkshopError('INVALID_MANIFEST','Manifest requires version, title, entry and up to 48 explicit file paths.');
  let bytes=0;
  const files=manifest.files.map(path=>{
    if(!nativeFilePath(path))throw new WorkshopError('INVALID_PATH','Source paths must stay inside the project.');
    let current=root;
    for(const segment of path.split('/')){current=resolve(current,segment);if(lstatSync(current).isSymbolicLink())throw new WorkshopError('INVALID_PATH','Project files cannot use symbolic links.');}
    const stat=lstatSync(current);
    if(!stat.isFile()||stat.size>NATIVE_RULES.maxSourceBytes)throw new WorkshopError('FILE_TOO_LARGE','Source file is not a regular file under 750 KB.');
    const encoding=/\.(?:js|mjs|json|glsl)$/i.test(path)?'utf8':'base64';
    bytes+=encoding==='utf8'?stat.size:Math.ceil(stat.size/3)*4;
    if(bytes>NATIVE_RULES.maxSourceBytes)throw new WorkshopError('FILE_TOO_LARGE','Project source and encoded assets exceed 750 KB.');
    return {path,encoding,content:readFileSync(current).toString(encoding)};
  });
  return {directory:root,project:validateNativeProject({version:3,revision:0,title:manifest.title,parts:[],native:{id:manifest.id||createHash('sha256').update(root).digest('hex'),entry:manifest.entry,files}})};
}

export function createNativeDirectory(base, name) {
  if(typeof name!=='string'||!/^[a-z][a-z0-9-]{0,49}$/.test(name))throw new WorkshopError('INVALID_PROJECT_NAME','Use a lowercase project name with letters, numbers and hyphens (up to 50 characters).');
  mkdirSync(base,{recursive:true});
  const directory=resolve(base,name),temporary=resolve(base,`.new-${randomUUID()}`);
  try{lstatSync(directory);throw new WorkshopError('PROJECT_EXISTS','That project directory already exists. Open it or choose another name.',409);}catch(error){if(error.code!=='ENOENT')throw error;}
  mkdirSync(temporary);
  try{
    writeFileSync(resolve(temporary,'kinetic.project.json'),JSON.stringify({version:1,id:randomUUID(),title:name,entry:'main.js',files:['main.js']},null,2));
    writeFileSync(resolve(temporary,'main.js'),readFileSync(resolve(ROOT,'templates/native/main.js')));
    writeFileSync(resolve(temporary,'package.json'),JSON.stringify({name,version:'0.1.0',private:true,type:'module',dependencies:{three:'0.186.0'}},null,2));
    writeFileSync(resolve(temporary,'README.md'),'# '+name+'\n\nEdit main.js and add source/assets to kinetic.project.json files. Kinetic supplies the pinned Three.js runtime for its managed preview.\n\nFrom the Kinetic checkout: inspect the revision, then run `node cli.js project apply --revision N`. Save a portable source snapshot with `node cli.js save project.json`.\n\nExport createProject({ canvas, THREE }); return { scene, camera, renderer, update(time, delta), dispose() }. See Kinetic docs/NATIVE-PROJECTS.md for the bridge contract.\n');
    // An exclusive destination reservation prevents replacing a concurrently created project.
    mkdirSync(directory);
    for(const file of readdirSync(temporary))renameSync(resolve(temporary,file),resolve(directory,file));
    return readNativeDirectory(directory);
  }finally{rmSync(temporary,{recursive:true,force:true});}
}

export function createNativeService({workshop,publish,clients,changed,base,directory=null}) {
  const snapshots=new Map(),requests=new Map(),locations=new Map();
  if(workshop.project.version===3)locations.set(workshop.project.native.id,directory);
  function remember(project){
    const hash=nativeHash(project);
    if(!snapshots.has(hash)){
      if(snapshots.size===24)snapshots.delete(snapshots.keys().next().value);
      snapshots.set(hash,structuredClone(project));
    }
    return hash;
  }
  function query(project,action='inspect',options={}){
    if(!clients.size)throw new WorkshopError('PREVIEW_UNAVAILABLE','Open the Kinetic browser to inspect, capture or validate native source.',409);
    if(requests.size)throw new WorkshopError('BUSY','A native preview request is already running.',409);
    const hash=remember(project),id=randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{requests.delete(id);reject(new WorkshopError('PREVIEW_TIMEOUT','Native preview did not respond. The accepted project was preserved.',504));},20000);
      requests.set(id,{revision:project.revision,action,finish:body=>{clearTimeout(timer);requests.delete(id);if(body.error)reject(new WorkshopError('PREVIEW_FAILED',body.error));else resolve(body);}});
      publish('native',{id,hash,revision:project.revision,action,options});
    });
  }
  async function adopt(loaded, expectedRevision){
    workshop.check(expectedRevision);
    loaded.project.revision=expectedRevision+1;
    const receipt=await query(loaded.project,'inspect');
    workshop.check(expectedRevision);
    loaded.project.parts=receipt.inspection.parts.map(p=>({id:p.id,kind:'native',name:p.name,...(p.source?{source:p.source}:{})}));
    workshop.commit(validateNativeProject(loaded.project));locations.set(workshop.project.native.id,loaded.directory);changed();return state();
  }
  function state(){return {revision:workshop.project.revision,directory:locations.get(workshop.project.native?.id)||null,preview:workshop.project.version===3?`/native/preview/${remember(workshop.project)}/index.html`:null,project:workshop.project};}
  return {
    state,query,remember,
    get directory(){return locations.get(workshop.project.native?.id)||null;},
    create(name,revision){workshop.check(revision);const loaded=createNativeDirectory(base,name);workshop.commit(loaded.project);locations.set(workshop.project.native.id,loaded.directory);changed();return state();},
    async apply(expectedRevision){workshop.check(expectedRevision);const directory=locations.get(workshop.project.native?.id);if(workshop.project.version!==3||!directory)throw new WorkshopError('NO_SOURCE_DIRECTORY','Open a source project before applying files.');return adopt(readNativeDirectory(directory),expectedRevision);},
    open(path,revision){workshop.check(revision);if(typeof path!=='string'||!path||path.length>2000)throw new WorkshopError('INVALID_PATH','Supply a local project directory.');return adopt(readNativeDirectory(path),revision);},
    import(project,revision){return adopt({project:validateNativeProject(project),directory:null},revision);},
    reply(id,body){
      const pending=requests.get(id);if(!pending)return {accepted:false};
      if(body.revision!==pending.revision)return {accepted:false};
      if(body.error){if(typeof body.error!=='string'||body.error.length>500)throw new WorkshopError('INVALID_PREVIEW_ERROR','Preview error must be bounded text.');}
      else {
        nativeInspection(body.inspection,pending.revision);
        if(pending.action==='capture'&&(body.image===undefined||!body.capture||body.capture.revision!==pending.revision||body.capture.frame!==body.inspection.frame||body.capture.time!==body.inspection.time))throw new WorkshopError('INVALID_CAPTURE','Capture must include an image and metadata from the inspected frame.');
        if(body.image!==undefined&&(typeof body.image!=='string'||body.image.length>1500000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.image)))throw new WorkshopError('INVALID_IMAGE','Preview capture must be a bounded PNG.');
      }
      pending.finish(body);return {accepted:true};
    },
    asset(path){
      const match=/^\/native\/preview\/([a-f0-9]{64})\/(.+)$/.exec(path);if(!match)return null;
      const project=snapshots.get(match[1]);if(!project)throw new WorkshopError('SNAPSHOT_EXPIRED','Preview source snapshot expired.',404);
      if(match[2]==='index.html')return {type:'text/html',data:nativeHTML(project,match[1])};
      if(match[2]==='runtime.js')return {type:'text/javascript',data:readFileSync(resolve(ROOT,'src/native-runtime.js'))};
      const vendor={'vendor/three.module.js':'build/three.module.js','vendor/three.core.js':'build/three.core.js'};
      const mapped=Object.hasOwn(vendor,match[2])?vendor[match[2]]:(match[2].startsWith('vendor/addons/')&&nativeFilePath(match[2])?`examples/jsm/${match[2].slice(14)}`:null);
      if(mapped)return {type:'text/javascript',data:readFileSync(resolve(ROOT,'node_modules/three',mapped))};
      const file=project.native.files.find(f=>f.path===match[2]);
      if(!file)throw new WorkshopError('NOT_FOUND','File is not in the adopted source snapshot.',404);
      const type={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.gltf':'model/gltf+json'}[extname(file.path)]||'application/octet-stream';
      return {type,data:Buffer.from(file.content,file.encoding)};
    }
  };
}

function nativeHTML(project,hash){
  const base=`/native/preview/${hash}/`;
  const config=JSON.stringify({entry:project.native.entry}).replaceAll('<','\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden;background:#eceee6}canvas{display:block;width:100%;height:100%}#error{position:absolute;inset:20px;white-space:pre-wrap;font:14px system-ui;color:#8e3025}</style><script type="importmap">${JSON.stringify({imports:{three:base+'vendor/three.module.js','three/addons/':base+'vendor/addons/'}})}</script></head><body><canvas id="scene" aria-label="Native Three.js project"></canvas><pre id="error" hidden></pre><script type="module">import {start} from './runtime.js';start(${config});</script></body></html>`;
}
