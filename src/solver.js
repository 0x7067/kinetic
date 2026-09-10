import { LIMITS, clone } from './model.js';
// A deliberately small, inspectable search policy. This is not an LLM or a canned replay.
const moves = [['y', -0.25], ['y', 0.25], ['angle', -6], ['angle', 6], ['length', 0.35], ['x', -0.3], ['x', 0.3], ['y', -0.5], ['y', 0.5], ['angle', -12], ['angle', 12], ['length', 0.7]];
export function score(run) {
  if (run.success === true) return 1000 - run.duration;
  if (run.success === false) return 20 - (run.closest ?? 20);
  return Number.NEGATIVE_INFINITY;
}
export function propose(project, run, iteration = 0) {
  const touched = run.contacts.filter(c => project.parts.some(p => p.id === c.part));
  const id = touched.at(-1)?.part || project.parts[0]?.id;
  const fallback = project.parts[Math.floor(iteration / moves.length) % project.parts.length];
  const part = iteration < moves.length ? project.parts.find(p=>p.id===id) : fallback;
  if (!part) return null;
  const [field, delta] = moves[iteration % moves.length];
  const [min,max] = LIMITS[field];
  const value = Math.round(Math.max(min,Math.min(max,part[field]+delta))*100)/100;
  if(value===part[field]) return null;
  return { operations: [{ type:'update',id:part.id,changes:{[field]:value} }], label:`${part.name}: ${field} ${delta>0?'+':''}${(value-part[field]).toFixed(2)}${field==='angle'?'°':' m'}` };
}
export function restoreOperations(current, target) {
  const ops=[];
  for(const p of current.parts)if(!target.parts.some(t=>t.id===p.id))ops.push({type:'remove',id:p.id});
  for(const p of target.parts){const old=current.parts.find(t=>t.id===p.id);if(!old)ops.push({type:'add',part:clone(p)});else{const {id,kind,...changes}=p;ops.push({type:'update',id,changes});}}
  return ops;
}
