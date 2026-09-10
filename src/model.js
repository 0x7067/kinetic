/** @typedef {{id:string,kind:'ramp'|'platform'|'barrier',name:string,x:number,y:number,z:number,angle:number,yaw:number,length:number}} Part */
/** @typedef {{version:1,revision:number,title:string,parts:Part[]}} Project */
import { WorkshopError } from './errors.js';
import { initialScene, validateScene, applySceneOperations, SCENE_RULES } from './scene-model.js';
import { validateNativeProject, NATIVE_RULES } from './native-model.js';
export { WorkshopError } from './errors.js';
export const RULES = Object.freeze({
  gravity: -9.81, timestep: 1 / 120, duration: 10, radius: 0.22,
  start: Object.freeze({ x: -5.5, y: 4.65, z: 0 }),
  goal: Object.freeze({ x: 5.45, y: 0.6, z: 0 }),
  goalRadius: 0.65, dwell: 0.4, maxParts: 3,
});
export const LIMITS = Object.freeze({ x: [-6.4, 6.4], y: [0.7, 4.2], z: [-2.5, 2.5], angle: [-45, 45], yaw: [-30, 30], length: [1, 4.8] });
export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16); globalThis.crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  return [...b].map((v,i)=>([4,6,8,10].includes(i)?'-':'')+v.toString(16).padStart(2,'0')).join('');
}
export const clone = value => structuredClone(value);
export function initialProject() {
  return { version: 1, revision: 0, title: 'The first leap', parts: [
    { id: 'launch', kind: 'ramp', name: 'Launch ramp', x: -4, y: 3.45, z: 0, angle: -18, yaw: 0, length: 4.4 },
    { id: 'bridge', kind: 'ramp', name: 'Landing ramp', x: 0.2, y: 2.5, z: 0, angle: -12, yaw: 0, length: 2.6 },
    { id: 'home', kind: 'ramp', name: 'Home stretch', x: 3.6, y: 1.12, z: 0, angle: -12, yaw: 0, length: 2.6 },
  ] };
}
export function validatePart(part) {
  if (!part || typeof part !== 'object' || Array.isArray(part)) throw new WorkshopError('INVALID_PART', 'A part must be an object.');
  const allowed = new Set(['id', 'kind', 'name', ...Object.keys(LIMITS)]);
  for (const key of Object.keys(part)) if (!allowed.has(key)) throw new WorkshopError('UNKNOWN_FIELD', `Unknown part field: ${key}.`);
  if (typeof part.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(part.id)) throw new WorkshopError('INVALID_ID', 'Use a stable alphanumeric part ID, up to 40 characters.');
  if (!['ramp', 'platform', 'barrier'].includes(part.kind)) throw new WorkshopError('INVALID_KIND', 'Choose ramp, platform or barrier.');
  if (typeof part.name !== 'string' || !part.name.trim() || part.name.length > 60) throw new WorkshopError('INVALID_NAME', 'Part names must contain 1–60 characters.');
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (typeof part[key] !== 'number' || !Number.isFinite(part[key]) || part[key] < min || part[key] > max) {
      throw new WorkshopError('OUT_OF_BOUNDS', `${key} must be a finite number between ${min} and ${max}.`);
    }
  }
  return clone(part);
}
export function validateProject(input) {
  if (input?.version === 3) return validateNativeProject(input);
  if (input?.version === 2) return validateScene(input);
  if (!input || input.version !== 1 || !Array.isArray(input.parts)) throw new WorkshopError('INVALID_PROJECT', 'Expected a Kinetic version 1 project.');
  const allowed = ['version','revision','title','parts'];
  if (Object.keys(input).some(k => !allowed.includes(k))) throw new WorkshopError('LOCKED_RULES', 'Challenge rules, spawn, target and gravity cannot be imported or edited.');
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new WorkshopError('INVALID_REVISION', 'Revision must be a nonnegative integer.');
  if (typeof input.title !== 'string' || input.title.length > 80) throw new WorkshopError('INVALID_TITLE', 'Title must contain at most 80 characters.');
  if (input.parts.length > RULES.maxParts) throw new WorkshopError('PART_BUDGET', `This challenge allows ${RULES.maxParts} parts.`);
  const parts = input.parts.map(validatePart);
  if (new Set(parts.map(p => p.id)).size !== parts.length) throw new WorkshopError('DUPLICATE_ID', 'Every part needs a unique ID.');
  return { version: 1, revision: input.revision, title: input.title, parts };
}
function switchWorkspace(project,op) {
  if(Object.keys(op).some(k=>!['type','template'].includes(k))||!['scene','demo','marble'].includes(op.template))throw new WorkshopError('INVALID_TEMPLATE','Choose scene, demo or marble.');
  return {...(op.template==='marble'?initialProject():initialScene(op.template)),revision:project.revision};
}
export function applyOperations(project, operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 20) throw new WorkshopError('INVALID_BATCH', 'Submit 1–20 typed operations.');
  if (operations.length === 1 && operations[0]?.type === 'workspace') return switchWorkspace(project,operations[0]);
  if (project.version===3) throw new WorkshopError('NATIVE_SOURCE_EDIT','Edit the project source files, then use project apply with the inspected revision.');
  return project.version===2?applySceneOperations(project,operations):applyMarbleOperations(project,operations);
}
function applyMarbleOperations(project,operations) {
  const draft = clone(project);
  for (const op of operations) {
    if (!op || typeof op !== 'object') throw new WorkshopError('INVALID_OPERATION', 'Each operation must be an object.');
    const allowed = op.type === 'add' ? ['type','part'] : op.type === 'update' ? ['type','id','changes'] : ['type','id'];
    if (Object.keys(op).some(k => !allowed.includes(k))) throw new WorkshopError('UNKNOWN_FIELD', 'Operation has an unknown field.');
    const index = draft.parts.findIndex(p => p.id === op.id);
    if (op.type === 'add') {
      const part = validatePart(op.part);
      if (draft.parts.some(p => p.id === part.id)) throw new WorkshopError('DUPLICATE_ID', `${part.id} already exists.`);
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
    const changed = JSON.stringify(next) !== JSON.stringify(this.project);
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
    if (targetId && !displayed.parts.some(p => p.id === targetId)) throw new WorkshopError('NOT_FOUND', 'The selected part no longer exists.', 404);
    if (this.feedback.length >= 30) throw new WorkshopError('FEEDBACK_LIMIT', 'Resolve some feedback before adding more.');
    if (screenshot && (typeof screenshot !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(screenshot) || screenshot.length > 1500000)) throw new WorkshopError('INVALID_IMAGE', 'Use a PNG screenshot under 1 MB.');
    const note = { id: uid(), text: text.trim(), targetId: targetId || null, revision: displayed.revision, currentRevision: this.project.revision, camera, screenshot, runId: runId || null, time, createdAt: new Date().toISOString(), resolved: false };
    this.feedback.push(note); return clone(note);
  }
  state() {
    return { project: clone(this.project), rules: this.project.version===3?NATIVE_RULES:this.project.version===2?SCENE_RULES:RULES, attempts: clone(this.attempts), feedback: clone(this.feedback), canUndo: !!this.history.length, canRedo: !!this.future.length };
  }
  addRun(run) {
    this.lastRun = run;
    const { frames, project, ...summary } = run;
    this.attempts.unshift(summary); this.attempts = this.attempts.slice(0, 20);
  }
}
