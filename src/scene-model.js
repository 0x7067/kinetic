import { WorkshopError } from './errors.js';

export const SCENE_KINDS = ['box','sphere','cylinder','plane','mesh','text','line','arrow','image','plot'];
export const SCENE_LIMITS = { x:[-100,100], y:[-100,100], z:[-100,100], angle:[-180,180], yaw:[-180,180], roll:[-180,180], width:[.02,100], height:[.02,100], depth:[.02,100], radius:[.02,50], opacity:[0,1], restitution:[0,1], friction:[0,2] };
export const SCENE_RULES = { mode:'scene', maxParts:64, maxDynamic:16, timestep:1/120, maxDuration:10, successCriteria:null };
const defaults = { x:0,y:0,z:0,angle:0,yaw:0,roll:0,width:1,height:1,depth:1,radius:.5,color:'#d27a57',opacity:1,body:'none',restitution:.3,friction:.5 };
const fail = message => { throw new WorkshopError('INVALID_SCENE',message); };
const number = (value,min,max,label) => { if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(`${label} must be between ${min} and ${max}.`); };
const object = (value,keys,label) => { if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail(`${label} has an unknown field or is not an object.`); };
const color = value => { if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))fail('Colors must be #RRGGBB.'); };
function points(value,dimension,min,max) {
  if(!Array.isArray(value)||value.length<min||value.length>max)fail(`Use ${min}–${max} points.`);
  for(const p of value){if(!Array.isArray(p)||p.length!==dimension)fail(`Points need ${dimension} coordinates.`);p.forEach(n=>number(n,-100,100,'Coordinate'));}
}
function imageInfo(data) {
  if(typeof data!=='string'||data.length>180000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))fail('Images must be embedded PNG data URLs under 128 KiB; no external URLs.');
  let bytes;try{bytes=atob(data.slice(22));}catch{fail('Invalid PNG base64.');}
  if(bytes.length<33||bytes.length>131072||[137,80,78,71,13,10,26,10].some((n,i)=>bytes.charCodeAt(i)!==n)||bytes.slice(12,16)!=='IHDR')fail('Invalid PNG header.');
  const uint = offset => Array.from(bytes.slice(offset,offset+4)).reduce((n,c)=>n*256+c.charCodeAt(0),0);
  const width=uint(16),height=uint(20);number(width,1,1024,'PNG width');number(height,1,1024,'PNG height');
  return {width,height,bytes:bytes.length};
}
function validateData(part) {
  if(part.kind==='text'){if(typeof part.text!=='string'||!part.text.trim()||part.text.length>500)fail('Text needs 1–500 characters.');}
  if(part.kind==='image')imageInfo(part.data);
  if(['line','arrow'].includes(part.kind))points(part.points,3,2,part.kind==='arrow'?2:512);
  if(part.kind==='arrow'&&part.points[0].every((v,i)=>v===part.points[1][i]))fail('Arrow endpoints must differ.');
  if(part.kind==='plot')points(part.points,2,2,512);
  if(part.kind==='mesh'){
    points(part.vertices,3,3,3000);
    if(!Array.isArray(part.indices)||!part.indices.length||part.indices.length>9000||part.indices.length%3)fail('Mesh indices must contain complete triangles, at most 9000 indices.');
    for(const index of part.indices)if(!Number.isInteger(index)||index<0||index>=part.vertices.length)fail('Mesh index is outside its vertices.');
  }
}
export function validateScenePart(input) {
  const extras={text:['text'],image:['data'],line:['points'],arrow:['points'],plot:['points'],mesh:['vertices','indices']};
  object(input,['id','kind','name',...Object.keys(defaults),...(Object.hasOwn(extras,input?.kind)?extras[input.kind]:[])],'Scene object');
  if(typeof input.id!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(input.id))fail('Object IDs start with a letter; use at most 40 letters, digits, _ or -.');
  if(!SCENE_KINDS.includes(input.kind))fail(`Object kind must be ${SCENE_KINDS.join(', ')}.`);
  const p={...defaults,...input,name:input.name??input.id};
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>60)fail('Name needs 1–60 characters.');
  for(const [field,[min,max]] of Object.entries(SCENE_LIMITS))number(p[field],min,max,field);
  color(p.color);if(!['none','fixed','dynamic'].includes(p.body))fail('body must be none, fixed or dynamic.');
  if(p.body!=='none'&&!['box','sphere','cylinder'].includes(p.kind))fail('Physics bodies currently support box, sphere and cylinder. Other objects are visual only.');
  validateData(p);return structuredClone(p);
}
export function initialScene(template='scene') {
  const p={version:2,revision:0,title:'Untitled workshop',settings:{background:'#eceee6',gravity:[0,-9.81,0],duration:5},parts:[]};
  if(template!=='demo')return p;
  p.title='Motion & meaning';p.parts=[
    {id:'floor',kind:'box',name:'Catch platform',width:7,height:.25,depth:4,x:-2,body:'fixed',color:'#567969'},
    {id:'ball',kind:'sphere',name:'Falling ball',x:-3,y:4,radius:.5,body:'dynamic',color:'#d77b54',restitution:.75},
    {id:'ramp',kind:'box',name:'Tilted block',x:-2,y:1.2,width:3,height:.2,depth:2,angle:-18,body:'fixed',color:'#d9b879'},
    {id:'heading',kind:'text',name:'Scene heading',x:0,y:6,width:10,height:1.3,text:'Motion & meaning',color:'#283f36'},
    {id:'note',kind:'text',name:'Experiment note',x:-2,y:-1.2,z:2,width:6,height:1.2,text:'A scene you can inspect.\nA system you can change.',color:'#283f36'},
    {id:'gravity',kind:'arrow',name:'Gravity direction',x:-6,y:4,points:[[0,0,0],[0,-2,0]],color:'#d77b54'},
    {id:'plot',kind:'plot',name:'Illustrative data — edit the points',x:5,y:2.5,width:5,height:3.2,color:'#567969',points:[[0,0],[1,.7],[2,.3],[3,1.5],[4,1.1],[5,2.2]]},
  ];return validateScene(p);
}
export function validateScene(input) {
  object(input,['version','revision','title','settings','parts'],'Scene');
  if(input.version!==2||!Number.isSafeInteger(input.revision)||input.revision<0)fail('Expected a version 2 scene with a nonnegative revision.');
  if(typeof input.title!=='string'||input.title.length>80)fail('Title must be at most 80 characters.');
  if(!Array.isArray(input.parts)||input.parts.length>SCENE_RULES.maxParts)fail('Scenes allow at most 64 objects.');
  if(input.settings!==undefined)object(input.settings,['background','gravity','duration'],'Scene settings');
  const settings={...initialScene().settings,...input.settings};
  object(settings,['background','gravity','duration'],'Scene settings');color(settings.background);
  points([settings.gravity],3,1,1);number(settings.duration,.1,10,'duration');
  const parts=input.parts.map(validateScenePart);
  if(new Set(parts.map(p=>p.id)).size!==parts.length)fail('Object IDs must be unique.');
  if(parts.filter(p=>p.body==='dynamic').length>SCENE_RULES.maxDynamic)fail('Scenes allow at most 16 dynamic bodies.');
  if(new TextEncoder().encode(JSON.stringify(input)).length>1000000)fail('Scene documents are limited to 1 MB.');
  return {version:2,revision:input.revision,title:input.title,settings,parts};
}
export function sceneDataSummary(p) {
  if(p.kind==='image')return imageInfo(p.data);
  if(p.kind==='mesh')return {vertices:p.vertices.length,triangles:p.indices.length/3};
  if(p.points)return {points:p.points.length};
  return null;
}
export function applySceneOperations(project, operations) {
  const draft=structuredClone(project);
  for(const op of operations){
    if(!['add','update','remove','configure'].includes(op?.type))fail('Use add, update, remove or configure.');
    object(op,{add:['type','part'],update:['type','id','changes'],remove:['type','id'],configure:['type','title','settings']}[op?.type]||[], 'Operation');
    if(op.type==='configure'){
      if(op.title!==undefined)draft.title=op.title;
      if(op.settings!==undefined){object(op.settings,['background','gravity','duration'],'Settings');Object.assign(draft.settings,op.settings);}
    }else if(op.type==='add'){
      const part=validateScenePart(op.part);if(draft.parts.some(p=>p.id===part.id))fail('Object ID already exists.');draft.parts.push(part);
    }else{
      if(typeof op.id!=='string')fail('Supply an object ID.');
      const index=draft.parts.findIndex(p=>p.id===op.id);
      if(op.type==='remove'){if(index>=0)draft.parts.splice(index,1);}
      else if(op.type==='update'){
        if(index<0)throw new WorkshopError('NOT_FOUND',`Object ${op.id} no longer exists.`,404);
        if(!op.changes||typeof op.changes!=='object'||Array.isArray(op.changes)||'id' in op.changes||'kind' in op.changes)fail('Update changes cannot include id or kind.');
        draft.parts[index]=validateScenePart({...draft.parts[index],...op.changes});
      }else fail('Use add, update, remove or configure.');
    }
  }
  return validateScene(draft);
}
