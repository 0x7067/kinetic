import { WorkshopError } from './errors.js';

export const NATIVE_RULES = { mode:'native', maxFiles:48, maxSourceBytes:750000, maxInspectionObjects:64, physics:false };
const extensions=/\.(?:js|mjs|json|glsl|png|jpg|jpeg|webp|glb|gltf|bin)$/i;
export function nativeFilePath(path) {
  return typeof path==='string' && path.length<=160 && /^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(path) && path.split('/').every(p=>p&&p!=='.'&&p!=='..') && extensions.test(path);
}
export function validateNativeProject(input) {
  const fail=message=>{throw new WorkshopError('INVALID_NATIVE_PROJECT',message);};
  if(!input||input.version!==3||!Number.isSafeInteger(input.revision)||input.revision<0)fail('Native projects need version 3 and a nonnegative revision.');
  if(Object.keys(input).some(k=>!['version','revision','title','parts','native'].includes(k)))fail('Unknown native project field.');
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>80)fail('Project title needs 1–80 characters.');
  const native=input.native;
  if(!native||Object.keys(native).some(k=>!['id','entry','files'].includes(k))||typeof native.id!=='string'||!/^([a-zA-Z0-9_-]{1,80})$/.test(native.id)||!nativeFilePath(native.entry)||!/\.m?js$/.test(native.entry))fail('Choose a project ID and JavaScript entry inside the project.');
  if(!Array.isArray(native.files)||!native.files.length||native.files.length>NATIVE_RULES.maxFiles)fail('Projects support 1–48 source and asset files.');
  let size=0;
  for(const file of native.files){
    if(!file||Object.keys(file).some(k=>!['path','content','encoding'].includes(k))||!nativeFilePath(file.path)||typeof file.content!=='string'||!['utf8','base64'].includes(file.encoding))fail('Each file needs a safe relative path, content and utf8/base64 encoding.');
    if(file.encoding==='base64'&&!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content))fail('Invalid base64 asset.');
    size+=new TextEncoder().encode(file.content).length;
  }
  if(size>NATIVE_RULES.maxSourceBytes)fail('Project source and encoded assets exceed 750 KB.');
  if(new Set(native.files.map(f=>f.path)).size!==native.files.length||!native.files.some(f=>f.path===native.entry&&f.encoding==='utf8'))fail('File paths must be unique and include the UTF-8 entry.');
  if(!Array.isArray(input.parts)||input.parts.length>NATIVE_RULES.maxInspectionObjects)fail('Invalid inspection index.');
  for(const p of input.parts)if(!p||Object.keys(p).some(k=>!['id','kind','name','source'].includes(k))||typeof p.id!=='string'||!/^([a-zA-Z][a-zA-Z0-9_-]{0,39})$/.test(p.id)||p.kind!=='native'||typeof p.name!=='string'||p.name.length>80||(p.source!==undefined&&!nativeFilePath(p.source)))fail('Invalid native object reference.');
  if(new Set(input.parts.map(p=>p.id)).size!==input.parts.length)fail('Native object IDs must be unique.');
  if(new TextEncoder().encode(JSON.stringify(input,null,2)).length>1000000)fail('The portable project export must fit within 1 MB.');
  return structuredClone(input);
}

export function nativeInspection(value, revision) {
  if(!value||value.revision!==revision||JSON.stringify(value).length>80000||!Array.isArray(value.parts)||value.parts.length>64||!Number.isFinite(value.time)||value.time<0)throw new WorkshopError('INVALID_NATIVE_INSPECTION','Preview returned an invalid inspection receipt.');
  const array=(v,length)=>Array.isArray(v)&&v.length===length&&v.every(Number.isFinite);
  const point=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));
  if(!Number.isSafeInteger(value.frame)||value.frame<0||!Number.isSafeInteger(value.totalObjects)||value.totalObjects<0||typeof value.paused!=='boolean'||!array(value.camera?.position,3)||!array(value.camera?.quaternion,4)||!Number.isFinite(value.camera?.zoom))throw new WorkshopError('INVALID_NATIVE_INSPECTION','Preview camera and frame must be finite.');
  for(const p of value.parts)if(!point(p.position)||!array(p.worldMatrix,16)||!p.axes||!['x','y','z'].every(k=>point(p.axes[k]))||(p.bounds!==null&&(!point(p.bounds?.min)||!point(p.bounds?.max)||!point(p.bounds?.size))))throw new WorkshopError('INVALID_NATIVE_INSPECTION','Preview geometry must contain finite Three.js facts.');
  const parts=value.parts.map(p=>({id:p.id,kind:'native',name:p.name,...(p.source?{source:p.source}:{})}));
  validateNativeProject({version:3,revision,title:'Inspection',parts,native:{id:'inspection',entry:'main.js',files:[{path:'main.js',content:'',encoding:'utf8'}]}});
  return value;
}
