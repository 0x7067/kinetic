import RAPIER from '@dimforge/rapier3d-compat';
import { RULES, validateProject, uid, partCollides, worldObjectCollides, hasDynamicBody } from './model.js';
let initialized;
export async function ready() { initialized ??= RAPIER.init(); await initialized; }
export function rotation(part) {
  const a = part.angle * Math.PI / 360, b = part.yaw * Math.PI / 360;
  return { x: Math.sin(b) * Math.sin(a), y: Math.sin(b) * Math.cos(a), z: Math.cos(b) * Math.sin(a), w: Math.cos(b) * Math.cos(a) };
}
function round(n) { return Math.round(n * 10000) / 10000; }
function point(p) { return { x: round(p.x), y: round(p.y), z: round(p.z) }; }
function poseFrame(object, t = 0) {
  const p = object ? point(object) : { x: 0, y: 0, z: 0 };
  return { t, ...p, q: [0, 0, 0, 1], vx: 0, vy: 0, vz: 0, speed: 0 };
}
function restPose(project) {
  const marble = (project.world?.objects || []).find(o => o.kind === 'marble');
  const frame = poseFrame(marble);
  return { end: { x: frame.x, y: frame.y, z: frame.z }, frames: [frame] };
}
function completedRun(project, extra = {}) {
  const elapsed = extra.duration ?? 0;
  const rest = restPose(project);
  return {
    id: uid(), revision: project.revision, status: extra.status ?? 'completed', success: extra.success ?? null,
    duration: round(elapsed), closest: extra.closest ?? null, closestPoint: extra.closestPoint ?? null, closestTime: extra.closestTime ?? null,
    maxSpeed: extra.maxSpeed ?? 0, end: extra.end ?? rest.end, endDistanceToGoal: extra.endDistanceToGoal ?? null,
    missVector: extra.missVector ?? null, targetError: extra.targetError ?? null, contacts: extra.contacts ?? [],
    message: extra.message ?? 'Simulation completed. No judge is attached.',
    frames: extra.frames ?? rest.frames, project, createdAt: extra.createdAt ?? new Date().toISOString(),
  };
}
function findObject(project, id) {
  return (project.world?.objects || []).find(o => o.id === id);
}
/** Build Rapier colliders only from document objects. Never invent a marble. */
export function buildColliders(world, project, names, surfaces) {
  const add = (desc, body, name, surface = name) => { const c = world.createCollider(desc, body); names.set(c.handle, name); surfaces.set(c.handle, surface); return c; };
  const objects = project.world?.objects || [];
  const workbench = objects.find(o => o.kind === 'workbench' && worldObjectCollides(o));
  const cup = objects.find(o => o.kind === 'cup' && worldObjectCollides(o) && (!project.judge || o.id === project.judge.target));
  const marble = objects.find(o => o.kind === 'marble' && worldObjectCollides(o) && (!project.judge || o.id === project.judge.body));
  let base = null;
  const ensureBase = () => { base ??= world.createRigidBody(RAPIER.RigidBodyDesc.fixed()); return base; };
  if (workbench) add(RAPIER.ColliderDesc.cuboid(8, 0.2, 4.4).setTranslation(workbench.x, workbench.y, workbench.z).setFriction(0.6), ensureBase(), 'workbench');
  for (const part of project.parts) {
    if (!partCollides(part)) continue;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(part.x, part.y, part.z).setRotation(rotation(part)));
    if (part.kind === 'mesh') {
      add(RAPIER.ColliderDesc.cuboid(part.length / 2, 0.5, 0.5).setFriction(0.22).setRestitution(0.04), body, part.id, 'mesh');
      continue;
    }
    const h = part.kind === 'barrier' ? 0.35 : 0.09;
    add(RAPIER.ColliderDesc.cuboid(part.length / 2, h, 0.57).setFriction(0.22).setRestitution(0.04), body, part.id, part.kind === 'barrier' ? 'barrier' : 'deck');
    if (part.kind !== 'barrier') for (const z of [-0.63, 0.63]) {
      add(RAPIER.ColliderDesc.cuboid(part.length / 2, 0.22, 0.06).setTranslation(0, 0.15, z).setFriction(0.15).setRestitution(0.02), body, part.id, z < 0 ? 'rail-negative-z' : 'rail-positive-z');
    }
  }
  let sensor = null;
  const goal = cup ? { x: cup.x, y: cup.y, z: cup.z } : null;
  if (cup && goal) {
    // cup.x/cup.z are honored. cup.y is unsupported this slice: floor, walls, sensor Y, and the dwell gate stay hardcoded.
    add(RAPIER.ColliderDesc.cylinder(0.16, 0.75).setTranslation(goal.x, 0.2, goal.z).setFriction(0.8).setRestitution(0), ensureBase(), 'cup', 'cup-floor');
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI * 2 / 24;
      const q = { x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) };
      add(RAPIER.ColliderDesc.cuboid(0.055, 0.33, 0.108).setTranslation(goal.x + Math.cos(a) * 0.73, 0.61, goal.z + Math.sin(a) * 0.73).setRotation(q).setFriction(0.7).setRestitution(0.01), ensureBase(), 'cup', 'cup-wall');
    }
    if (project.judge?.type === 'dwell-sensor') {
      sensor = add(RAPIER.ColliderDesc.cylinder(0.30, 0.51).setTranslation(goal.x, 0.64, goal.z).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), ensureBase(), 'target');
    }
  }
  let ball = null, ballCollider = null;
  if (marble) {
    ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(marble.x, marble.y, marble.z).setCcdEnabled(true).setCanSleep(false).setLinearDamping(0.015).setAngularDamping(0.015));
    ballCollider = add(RAPIER.ColliderDesc.ball(RULES.radius).setDensity(2.5).setFriction(0.25).setRestitution(0.05).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), ball, 'marble');
  }
  return { ball, ballCollider, sensor, goal, workbench: !!workbench };
}
function evaluateJudge(project, { status, inside, speed, position, hitBench, dwell, elapsed }) {
  const judge = project.judge;
  if (!judge) return { status: 'completed', success: null, dwell, done: elapsed >= RULES.duration };
  if (judge.type !== 'dwell-sensor') return { status: 'completed', success: null, dwell, done: true };
  const goal = findObject(project, judge.target);
  const required = judge.dwell ?? RULES.dwell;
  let nextDwell = inside && speed < 1.2 && position.y < 0.88 ? dwell + RULES.timestep : 0;
  if (nextDwell >= required) return { status: 'success', success: true, dwell: nextDwell, done: true };
  if (hitBench && goal) return { status: position.x < goal.x - 0.8 ? 'fell-short' : 'overshot', success: false, dwell: nextDwell, done: true };
  if (position.y < -1 || Math.abs(position.x) > 10 || Math.abs(position.z) > 5) return { status: 'out-of-bounds', success: false, dwell: nextDwell, done: true };
  if (elapsed >= RULES.duration) return { status: 'timeout', success: false, dwell: nextDwell, done: true };
  return { status, success: false, dwell: nextDwell, done: false };
}
/** A fresh, fixed-timestep world per attempt. Rapier runs only when a dynamic body is present. */
export async function simulate(input) {
  const project = validateProject(input);
  if (!hasDynamicBody(project)) {
    return completedRun(project, { message: 'No dynamic body; simulation completed without stepping Rapier.' });
  }
  await ready();
  const world = new RAPIER.World({ x: 0, y: RULES.gravity, z: 0 });
  const queue = new RAPIER.EventQueue(true);
  world.timestep = RULES.timestep;
  const names = new Map(), surfaces = new Map();
  const { ball, ballCollider, sensor, goal, workbench } = buildColliders(world, project, names, surfaces);
  if (!ball || !ballCollider) {
    queue.free(); world.free();
    return completedRun(project, { message: 'No dynamic body; simulation completed without stepping Rapier.' });
  }
  let inside = false, dwell = 0, elapsed = 0, status = project.judge ? 'timeout' : 'completed', closest = Infinity, maxSpeed = 0, lastTouched = null;
  let closestPoint = null, closestTime = 0;
  const start = ball.translation();
  const frames = [{ t: 0, ...point(start), q: [0, 0, 0, 1], vx: 0, vy: 0, vz: 0, speed: 0 }], contacts = [], seen = new Set();
  try {
    for (let tick = 0; tick < RULES.duration / RULES.timestep; tick++) {
      world.step(queue); elapsed = (tick + 1) * RULES.timestep;
      let hitBench = false;
      const newContacts = [];
      queue.drainCollisionEvents((a, b, started) => {
        if (a !== ballCollider.handle && b !== ballCollider.handle) return;
        const other = a === ballCollider.handle ? b : a;
        if (sensor && other === sensor.handle) { inside = started; return; }
        if (!started) return;
        const name = names.get(other);
        lastTouched = name;
        if (!seen.has(name)) { newContacts.push({name, surface: surfaces.get(other)}); seen.add(name); }
        if (name === 'workbench') hitBench = true;
      });
      const p = ball.translation(), v = ball.linvel(), q = ball.rotation();
      const speed = Math.hypot(v.x, v.y, v.z);
      maxSpeed = Math.max(maxSpeed, speed);
      for (const {name, surface} of newContacts) contacts.push({ part: name, surface, time: round(elapsed), position: point(p), velocity: point(v), speed: round(speed) });
      if (goal) {
        const distance = Math.hypot(p.x - goal.x, p.y - goal.y, p.z - goal.z);
        if (distance < closest) { closest = distance; closestPoint = point(p); closestTime = round(elapsed); }
      }
      if (tick % 2 === 0 || newContacts.length) frames.push({ t: round(elapsed), x: p.x, y: p.y, z: p.z, q: [q.x, q.y, q.z, q.w], vx: v.x, vy: v.y, vz: v.z, speed });
      const judged = evaluateJudge(project, { status, inside, speed, position: p, hitBench: hitBench && workbench, dwell, elapsed });
      dwell = judged.dwell; status = judged.status;
      if (judged.done) break;
    }
    const end = ball.translation();
    if (frames.at(-1).t < round(elapsed)) {
      const q = ball.rotation(), v = ball.linvel();
      frames.push({t: round(elapsed), x:end.x, y:end.y, z:end.z, q:[q.x,q.y,q.z,q.w], vx:v.x, vy:v.y, vz:v.z, speed:Math.hypot(v.x,v.y,v.z)});
    }
    const last = point(end);
    const missVector = goal ? { x: round(goal.x - end.x), y: round(goal.y - end.y), z: round(goal.z - end.z) } : null;
    const endDistanceToGoal = missVector ? round(Math.hypot(missVector.x, missVector.y, missVector.z)) : null;
    const targetError = missVector ? missVector.x : null;
    const success = project.judge ? status === 'success' : null;
    const finalStatus = project.judge ? status : 'completed';
    const message = !project.judge ? 'Simulation completed. No judge is attached.'
      : finalStatus === 'success' ? `Marble settled in the cup for ${(project.judge.dwell ?? RULES.dwell).toFixed(1)} s.`
      : finalStatus === 'timeout' ? 'Marble stopped or did not reach the cup within 10 s.'
      : `Marble ${finalStatus === 'fell-short' ? 'touched the workbench before the cup' : finalStatus === 'overshot' ? 'missed the cup' : 'left the workbench'}. Last contact: ${lastTouched || 'none'}.`;
    return {
      id: uid(), revision: project.revision, status: finalStatus, success, duration: round(elapsed),
      closest: Number.isFinite(closest) ? round(closest) : null, closestPoint, closestTime,
      maxSpeed: round(maxSpeed), end: last, endDistanceToGoal, missVector, targetError, contacts, message, frames, project,
      createdAt: new Date().toISOString(),
    };
  } finally { queue.free(); world.free(); }
}
