/** Read-only evidence shared by the browser, CLI and MCP. Never reruns physics. */
import { Quaternion, Vector3 } from 'three';
import { WorkshopError } from './model.js';

export function replayTime(run, time = run.duration) {
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > run.duration) {
    throw new WorkshopError('INVALID_TIME', `Time must be between 0 and ${run.duration} simulated seconds.`);
  }
  return time;
}

/** Interpolate between recorded physics samples, not a curve fitted through them. */
export function sampleRun(run, time = run.duration) {
  replayTime(run, time);
  const frames = run.frames;
  if (!frames?.length) throw new WorkshopError('EMPTY_REPLAY', 'This run has no recorded frames.');
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid].t <= time) lo = mid; else hi = mid - 1;
  }
  const a = frames[lo], b = frames[Math.min(lo + 1, frames.length - 1)];
  const alpha = b.t > a.t ? Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t))) : 0;
  const position = new Vector3(a.x, a.y, a.z).lerp(new Vector3(b.x, b.y, b.z), alpha);
  const q = new Quaternion().fromArray(a.q).slerp(new Quaternion().fromArray(b.q), alpha).normalize();
  const velocity = new Vector3(a.vx ?? 0, a.vy ?? 0, a.vz ?? 0).lerp(new Vector3(b.vx ?? 0, b.vy ?? 0, b.vz ?? 0), alpha);
  return {
    t: time, x: position.x, y: position.y, z: position.z, q: q.toArray(),
    vx: velocity.x, vy: velocity.y, vz: velocity.z,
    speed: a.speed + (b.speed - a.speed) * alpha,
    index: lo, sampleMethod: alpha > 0 && alpha < 1 ? 'interpolated' : 'recorded',
  };
}

export function runSummary(run) {
  return { id: run.id, revision: run.revision, status: run.status, success: run.success,
    duration: run.duration, closest: run.closest, end: run.end, contacts: run.contacts,
    frameCount: run.frames.length };
}

export function compareRuns(baseline, candidate) {
  const changes = [], before = new Map(baseline.project.parts.map(p => [p.id, p]));
  const after = new Map(candidate.project.parts.map(p => [p.id, p]));
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(id), b = after.get(id);
    if (!a || !b) { changes.push({ id, type: a ? 'removed' : 'added' }); continue; }
    const fields = {};
    for (const key of Object.keys(b)) if (a[key] !== b[key]) fields[key] = { before: a[key], after: b[key] };
    if (Object.keys(fields).length) changes.push({ id, type: 'updated', fields });
  }
  return {
    baseline: runSummary(baseline), candidate: runSummary(candidate), changes,
    closestDelta: candidate.closest == null || baseline.closest == null ? null : +(candidate.closest - baseline.closest).toFixed(4),
    durationDelta: +(candidate.duration - baseline.duration).toFixed(4),
    interpretation: 'Deltas are candidate minus baseline. A smaller miss distance alone is not success; read success/status. Traces align by simulated time, not normalized progress.',
  };
}
