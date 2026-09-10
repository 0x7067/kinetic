/** @typedef {{id:string,kind:'ramp'|'platform'|'barrier'|'mesh',name:string,x:number,y:number,z:number,angle:number,yaw:number,length:number,collider?:boolean}} Part */
/** @typedef {{id:string,kind:'workbench'|'cup'|'marble'|'light'|'camera',name:string,x:number,y:number,z:number,collider?:boolean,intensity?:number}} WorldObject */
/** @typedef {{objects:WorldObject[]}} World */
/** @typedef {{type:'dwell-sensor',body?:string,target?:string,dwell?:number}} Judge */
/** @typedef {{version:1,revision:number,title:string,parts:Part[],world?:World,judge?:Judge}} Project */
import { MARBLE_PARTS, MARBLE_WORLD, MARBLE_JUDGE, MARBLE_TITLE } from './compositions/marble-cup.js';

export const RULES = Object.freeze({
  gravity: -9.81, timestep: 1 / 120, duration: 10, radius: 0.22,
  start: Object.freeze({ x: -5.5, y: 4.65, z: 0 }),
  goal: Object.freeze({ x: 5.45, y: 0.6, z: 0 }),
  goalRadius: 0.65, dwell: 0.4,
});
/** Engine object budget. The marble composition uses three parts by choice, not a World-type limit. */
export const BUDGET = Object.freeze({ maxParts: 12, maxWorldObjects: 16 });
export const LIMITS = Object.freeze({ x: [-6.4, 6.4], y: [0.7, 4.2], z: [-2.5, 2.5], angle: [-45, 45], yaw: [-30, 30], length: [1, 4.8] });
const WORLD_LIMITS = Object.freeze({ x: [-20, 20], y: [-5, 20], z: [-20, 20] });
const PART_KINDS = ['ramp', 'platform', 'barrier', 'mesh'];
const WORLD_KINDS = ['workbench', 'cup', 'marble', 'light', 'camera'];
const AUTHORABLE = new Set(PART_KINDS);

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16); globalThis.crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  return [...b].map((v,i)=>([4,6,8,10].includes(i)?'-':'')+v.toString(16).padStart(2,'0')).join('');
}
export const clone = value => structuredClone(value);
export class WorkshopError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'WorkshopError'; this.code = code; this.status = status; }
}
export function initialProject() {
  return { version: 1, revision: 0, title: MARBLE_TITLE, parts: clone(MARBLE_PARTS), world: clone(MARBLE_WORLD), judge: clone(MARBLE_JUDGE) };
}
export function projectStuff(project) {
  return [...(project.parts || []), ...(project.world?.objects || [])];
}
export function isAuthorable(object) { return AUTHORABLE.has(object?.kind); }
export function partCollides(part) { return part.collider !== false; }
export function worldObjectCollides(object) {
  if (object.kind === 'light' || object.kind === 'camera') return false;
  return object.collider !== false;
}
export function hasDynamicBody(project) {
  return (project.world?.objects || []).some(o => o.kind === 'marble' && worldObjectCollides(o));
}
function finiteIn(value, [min, max], label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new WorkshopError('OUT_OF_BOUNDS', `${label} must be a finite number between ${min} and ${max}.`);
  }
  return value;
}
function validateId(id, label = 'part') {
  if (typeof id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(id)) throw new WorkshopError('INVALID_ID', `Use a stable alphanumeric ${label} ID, up to 40 characters.`);
  return id;
}
function validateName(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 60) throw new WorkshopError('INVALID_NAME', 'Part names must contain 1–60 characters.');
  return name;
}
export function validatePart(part) {
  if (!part || typeof part !== 'object' || Array.isArray(part)) throw new WorkshopError('INVALID_PART', 'A part must be an object.');
  const allowed = new Set(['id', 'kind', 'name', 'collider', ...Object.keys(LIMITS)]);
  for (const key of Object.keys(part)) if (!allowed.has(key)) throw new WorkshopError('UNKNOWN_FIELD', `Unknown part field: ${key}.`);
  validateId(part.id);
  if (!PART_KINDS.includes(part.kind)) throw new WorkshopError('INVALID_KIND', 'Choose ramp, platform, barrier or mesh.');
  validateName(part.name);
  if (part.collider !== undefined && typeof part.collider !== 'boolean') throw new WorkshopError('INVALID_COLLIDER', 'collider must be a boolean.');
  for (const [key, range] of Object.entries(LIMITS)) finiteIn(part[key], range, key);
  const next = clone(part);
  if (next.collider === undefined) delete next.collider;
  return next;
}
function validateWorldObject(object) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new WorkshopError('INVALID_OBJECT', 'A world object must be an object.');
  const extra = { light: ['intensity'], camera: [], workbench: ['collider'], cup: ['collider'], marble: ['collider'] };
  const allowed = new Set(['id', 'kind', 'name', 'x', 'y', 'z', ...(extra[object.kind] || [])]);
  for (const key of Object.keys(object)) if (!allowed.has(key)) throw new WorkshopError('UNKNOWN_FIELD', `Unknown object field: ${key}.`);
  validateId(object.id, 'object');
  if (!WORLD_KINDS.includes(object.kind)) throw new WorkshopError('INVALID_KIND', 'Choose workbench, cup, marble, light or camera.');
  validateName(object.name);
  for (const key of ['x', 'y', 'z']) finiteIn(object[key], WORLD_LIMITS[key], key);
  if (object.collider !== undefined && typeof object.collider !== 'boolean') throw new WorkshopError('INVALID_COLLIDER', 'collider must be a boolean.');
  if (object.kind === 'light' && object.intensity !== undefined) finiteIn(object.intensity, [0, 20], 'intensity');
  // cup.x/cup.z move the collider; cup.y translation is unsupported this slice.
  if (object.kind === 'cup' && object.y !== RULES.goal.y) {
    throw new WorkshopError('UNSUPPORTED', `Cup Y translation is unsupported this slice; cup.y must be ${RULES.goal.y}.`);
  }
  const next = clone(object);
  if (next.collider === undefined) delete next.collider;
  return next;
}
function validateWorld(world) {
  if (!world || typeof world !== 'object' || Array.isArray(world)) throw new WorkshopError('INVALID_WORLD', 'world must be an object.');
  if (Object.keys(world).some(k => k !== 'objects')) throw new WorkshopError('UNKNOWN_FIELD', 'world only accepts objects.');
  if (!Array.isArray(world.objects)) throw new WorkshopError('INVALID_WORLD', 'world.objects must be an array.');
  if (world.objects.length > BUDGET.maxWorldObjects) throw new WorkshopError('OBJECT_BUDGET', `A project allows ${BUDGET.maxWorldObjects} world objects.`);
  const objects = world.objects.map(validateWorldObject);
  if (objects.filter(o => o.kind === 'marble').length > 1) throw new WorkshopError('UNSUPPORTED', 'This slice supports at most one dynamic body.');
  if (new Set(objects.map(o => o.id)).size !== objects.length) throw new WorkshopError('DUPLICATE_ID', 'Every object needs a unique ID.');
  return { objects };
}
function validateJudge(judge) {
  if (!judge || typeof judge !== 'object' || Array.isArray(judge)) throw new WorkshopError('INVALID_JUDGE', 'judge must be an object.');
  const allowed = ['type', 'body', 'target', 'dwell'];
  if (Object.keys(judge).some(k => !allowed.includes(k))) throw new WorkshopError('UNKNOWN_FIELD', 'judge has an unknown field.');
  if (judge.type !== 'dwell-sensor') throw new WorkshopError('INVALID_JUDGE', 'The only supported judge is dwell-sensor.');
  if (judge.body !== undefined && (typeof judge.body !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(judge.body))) throw new WorkshopError('INVALID_JUDGE', 'Judge body must be a valid object ID.');
  if (judge.target !== undefined && (typeof judge.target !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(judge.target))) throw new WorkshopError('INVALID_JUDGE', 'Judge target must be a valid object ID.');
  if (judge.dwell !== undefined) finiteIn(judge.dwell, [0, RULES.duration], 'dwell');
  return { type: 'dwell-sensor', body: judge.body || 'marble', target: judge.target || 'cup', ...(judge.dwell !== undefined ? { dwell: judge.dwell } : {}) };
}
export function validateProject(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.parts)) throw new WorkshopError('INVALID_PROJECT', 'Expected a Kinetic version 1 project.');
  const allowed = ['version','revision','title','parts','world','judge'];
  if (Object.keys(input).some(k => !allowed.includes(k))) throw new WorkshopError('LOCKED_RULES', 'Challenge rules, spawn, target and gravity cannot be imported or edited.');
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new WorkshopError('INVALID_REVISION', 'Revision must be a nonnegative integer.');
  if (typeof input.title !== 'string' || input.title.length > 80) throw new WorkshopError('INVALID_TITLE', 'Title must contain at most 80 characters.');
  if (input.parts.length > BUDGET.maxParts) throw new WorkshopError('PART_BUDGET', `A project allows ${BUDGET.maxParts} parts.`);
  const hasWorld = Object.prototype.hasOwnProperty.call(input, 'world');
  const hasJudge = Object.prototype.hasOwnProperty.call(input, 'judge');
  const parts = input.parts.map(validatePart);
  if (new Set(parts.map(p => p.id)).size !== parts.length) throw new WorkshopError('DUPLICATE_ID', 'Every part needs a unique ID.');
  const world = hasWorld ? (input.world == null ? { objects: [] } : validateWorld(input.world)) : clone(MARBLE_WORLD);
  const judge = hasJudge ? (input.judge == null ? null : validateJudge(input.judge)) : (hasWorld ? null : clone(MARBLE_JUDGE));
  const ids = [...parts.map(p => p.id), ...world.objects.map(o => o.id)];
  if (new Set(ids).size !== ids.length) throw new WorkshopError('DUPLICATE_ID', 'Every part and world object needs a unique ID.');
  if (judge) {
    const body = world.objects.find(o => o.id === judge.body);
    const target = world.objects.find(o => o.id === judge.target);
    if (!body) throw new WorkshopError('INVALID_JUDGE', `Judge body ${judge.body} is not in this project.`);
    if (body.kind !== 'marble') throw new WorkshopError('INVALID_JUDGE', 'Judge body must name a marble.');
    if (!target) throw new WorkshopError('INVALID_JUDGE', `Judge target ${judge.target} is not in this project.`);
    if (target.kind !== 'cup') throw new WorkshopError('INVALID_JUDGE', 'Judge target must name a cup.');
  }
  const project = { version: 1, revision: input.revision, title: input.title, parts, world };
  if (judge) project.judge = judge;
  return project;
}
export function applyOperations(project, operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 20) throw new WorkshopError('INVALID_BATCH', 'Submit 1–20 typed operations.');
  const draft = clone(project);
  for (const op of operations) {
    if (!op || typeof op !== 'object') throw new WorkshopError('INVALID_OPERATION', 'Each operation must be an object.');
    const allowed = op.type === 'add' ? ['type','part'] : op.type === 'update' ? ['type','id','changes'] : ['type','id'];
    if (Object.keys(op).some(k => !allowed.includes(k))) throw new WorkshopError('UNKNOWN_FIELD', 'Operation has an unknown field.');
    const index = draft.parts.findIndex(p => p.id === op.id);
    if (op.type === 'add') {
      const part = validatePart(op.part);
      if (draft.parts.some(p => p.id === part.id) || (draft.world?.objects || []).some(o => o.id === part.id)) throw new WorkshopError('DUPLICATE_ID', `${part.id} already exists.`);
      draft.parts.push(part);
    } else if (op.type === 'update') {
      if (index < 0) throw new WorkshopError('NOT_FOUND', `Part ${op.id} no longer exists.`, 404);
      if (!op.changes || typeof op.changes !== 'object' || Array.isArray(op.changes)) throw new WorkshopError('INVALID_CHANGES', 'Changes must be an object.');
      if ('id' in op.changes || 'kind' in op.changes) throw new WorkshopError('IMMUTABLE_FIELD', 'IDs and part types are immutable; remove and add instead.');
      draft.parts[index] = validatePart({ ...draft.parts[index], ...op.changes });
    } else if (op.type === 'remove') {
      if (index >= 0) draft.parts.splice(index, 1);
    } else throw new WorkshopError('INVALID_OPERATION', 'Use add, update or remove. Arbitrary code is not supported.');
  }
  return validateProject(draft);
}
export class Workshop {
  constructor(saved) {
    this.project = saved ? validateProject(saved.project) : initialProject();
    this.history = []; this.future = []; this.attempts = []; this.feedback = [];
    this.requests = new Map(); this.lastRun = null;
  }
  check(revision) {
    if (revision !== this.project.revision) throw new WorkshopError('STALE_REVISION', `Expected revision ${this.project.revision}, received ${revision}. Inspect again before editing.`, 409);
  }
  edit({ operations, expectedRevision, requestId }) {
    if (requestId !== undefined && (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 100)) throw new WorkshopError('INVALID_REQUEST_ID', 'Request IDs must contain 1–100 characters.');
    const fingerprint = JSON.stringify(operations);
    if (requestId && this.requests.has(requestId)) {
      const prior = this.requests.get(requestId);
      if (prior.fingerprint !== fingerprint) throw new WorkshopError('IDEMPOTENCY_CONFLICT', 'Request ID was reused with different operations.', 409);
      return { ...clone(prior.result), replayed: true };
    }
    this.check(expectedRevision);
    const next = applyOperations(this.project, operations);
    const changed = JSON.stringify(next.parts) !== JSON.stringify(this.project.parts);
    if (changed) this.commit(next);
    const result = { revision: this.project.revision, changed, project: clone(this.project) };
    if (requestId) { this.requests.set(requestId, { fingerprint, result }); if (this.requests.size > 200) this.requests.delete(this.requests.keys().next().value); }
    return result;
  }
  commit(next) {
    this.history.push(clone(this.project)); this.history = this.history.slice(-20); this.future = [];
    this.project = { ...clone(next), revision: this.project.revision + 1 };
  }
  undo(expectedRevision) {
    this.check(expectedRevision);
    if (!this.history.length) return { changed: false, revision: this.project.revision };
    this.future.push(clone(this.project));
    this.project = { ...this.history.pop(), revision: this.project.revision + 1 };
    return { changed: true, revision: this.project.revision };
  }
  redo(expectedRevision) {
    this.check(expectedRevision);
    if (!this.future.length) return { changed: false, revision: this.project.revision };
    this.history.push(clone(this.project));
    this.project = { ...this.future.pop(), revision: this.project.revision + 1 };
    return { changed: true, revision: this.project.revision };
  }
  addFeedback({ text, targetId, camera, screenshot, runId, time = null, expectedRevision }, replay = null) {
    if (runId && (!replay || replay.id !== runId)) throw new WorkshopError('RUN_NOT_FOUND', 'The referenced run is no longer retained. Select an available run or comment on the current layout.', 404);
    const displayed = runId ? replay.project : this.project;
    if (expectedRevision !== undefined && expectedRevision !== displayed.revision) throw new WorkshopError('STALE_REVISION', 'The displayed revision changed before this feedback was saved.', 409);
    if (time !== null && (!runId || typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > replay.duration)) throw new WorkshopError('INVALID_TIME', 'Feedback time must be within the referenced recorded run.');
    if (camera !== undefined && JSON.stringify(camera).length > 4000) throw new WorkshopError('INVALID_CAMERA', 'Camera metadata is too large.');
    if (typeof text !== 'string' || !text.trim() || text.length > 1000) throw new WorkshopError('INVALID_COMMENT', 'Comments must contain 1–1000 characters.');
    if (targetId && !projectStuff(displayed).some(p => p.id === targetId)) throw new WorkshopError('NOT_FOUND', 'The selected part no longer exists.', 404);
    if (this.feedback.length >= 30) throw new WorkshopError('FEEDBACK_LIMIT', 'Resolve some feedback before adding more.');
    if (screenshot && (typeof screenshot !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(screenshot) || screenshot.length > 1500000)) throw new WorkshopError('INVALID_IMAGE', 'Use a PNG screenshot under 1 MB.');
    const note = { id: uid(), text: text.trim(), targetId: targetId || null, revision: displayed.revision, currentRevision: this.project.revision, camera, screenshot, runId: runId || null, time, createdAt: new Date().toISOString(), resolved: false };
    this.feedback.push(note); return clone(note);
  }
  state() {
    return { project: clone(this.project), rules: RULES, budget: BUDGET, attempts: clone(this.attempts), feedback: clone(this.feedback), canUndo: !!this.history.length, canRedo: !!this.future.length };
  }
  addRun(run) {
    this.lastRun = run;
    const { frames, project, ...summary } = run;
    this.attempts.unshift(summary); this.attempts = this.attempts.slice(0, 20);
  }
}
