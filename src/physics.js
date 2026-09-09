import RAPIER from '@dimforge/rapier3d-compat';
import { RULES, validateProject, uid } from './model.js';
let initialized;
export async function ready() { initialized ??= RAPIER.init(); await initialized; }
export function rotation(part) {
  const a = part.angle * Math.PI / 360, b = part.yaw * Math.PI / 360;
  return { x: Math.sin(b) * Math.sin(a), y: Math.sin(b) * Math.cos(a), z: Math.cos(b) * Math.sin(a), w: Math.cos(b) * Math.cos(a) };
}
/** A fresh, fixed-timestep world per attempt. The model never changes gravity, spawn, or the target. */
export async function simulate(input) {
  await ready();
  const project = validateProject(input);
  const world = new RAPIER.World({ x: 0, y: RULES.gravity, z: 0 });
  const queue = new RAPIER.EventQueue(true);
  world.timestep = RULES.timestep;
  const names = new Map(), surfaces = new Map();
  const add = (desc, body, name, surface = name) => { const c = world.createCollider(desc, body); names.set(c.handle, name); surfaces.set(c.handle, surface); return c; };
  const base = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  add(RAPIER.ColliderDesc.cuboid(8, 0.2, 4.4).setTranslation(0, -0.2, 0).setFriction(0.6), base, 'workbench');
  for (const part of project.parts) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(part.x, part.y, part.z).setRotation(rotation(part)));
    const h = part.kind === 'barrier' ? 0.35 : 0.09;
    add(RAPIER.ColliderDesc.cuboid(part.length / 2, h, 0.57).setFriction(0.22).setRestitution(0.04), body, part.id, part.kind === 'barrier' ? 'barrier' : 'deck');
    if (part.kind !== 'barrier') for (const z of [-0.63, 0.63]) {
      add(RAPIER.ColliderDesc.cuboid(part.length / 2, 0.22, 0.06).setTranslation(0, 0.15, z).setFriction(0.15).setRestitution(0.02), body, part.id, z < 0 ? 'rail-negative-z' : 'rail-positive-z');
    }
  }
  // The cup is a real solid floor and polygonal wall, not a visual success shortcut.
  const goal = RULES.goal;
  add(RAPIER.ColliderDesc.cylinder(0.16, 0.75).setTranslation(goal.x, 0.2, goal.z).setFriction(0.8).setRestitution(0), base, 'cup', 'cup-floor');
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI * 2 / 24;
    const q = { x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) };
    add(RAPIER.ColliderDesc.cuboid(0.055, 0.33, 0.108).setTranslation(goal.x + Math.cos(a) * 0.73, 0.61, Math.sin(a) * 0.73).setRotation(q).setFriction(0.7).setRestitution(0.01), base, 'cup', 'cup-wall');
  }
  const sensor = add(RAPIER.ColliderDesc.cylinder(0.30, 0.51).setTranslation(goal.x, 0.64, 0).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), base, 'target');
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(RULES.start.x, RULES.start.y, RULES.start.z).setCcdEnabled(true).setCanSleep(false).setLinearDamping(0.015).setAngularDamping(0.015));
  const ballCollider = add(RAPIER.ColliderDesc.ball(RULES.radius).setDensity(2.5).setFriction(0.25).setRestitution(0.05).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), ball, 'marble');
  let inside = false, dwell = 0, elapsed = 0, status = 'timeout', closest = Infinity, maxSpeed = 0, lastTouched = null;
  let closestPoint = null, closestTime = 0;
  const frames = [{ t: 0, ...RULES.start, q: [0, 0, 0, 1], vx: 0, vy: 0, vz: 0, speed: 0 }], contacts = [], seen = new Set();
  const round = n => Math.round(n * 10000) / 10000;
  const point = p => ({ x: round(p.x), y: round(p.y), z: round(p.z) });
  try {
    for (let tick = 0; tick < RULES.duration / RULES.timestep; tick++) {
      world.step(queue); elapsed = (tick + 1) * RULES.timestep;
      let hitBench = false;
      const newContacts = [];
      queue.drainCollisionEvents((a, b, started) => {
        if (a !== ballCollider.handle && b !== ballCollider.handle) return;
        const other = a === ballCollider.handle ? b : a;
        if (other === sensor.handle) { inside = started; return; }
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
      const distance = Math.hypot(p.x - goal.x, p.y - goal.y, p.z - goal.z);
      if (distance < closest) { closest = distance; closestPoint = point(p); closestTime = round(elapsed); }
      if (tick % 2 === 0 || newContacts.length) frames.push({ t: round(elapsed), x: p.x, y: p.y, z: p.z, q: [q.x, q.y, q.z, q.w], vx: v.x, vy: v.y, vz: v.z, speed });
      if (inside && speed < 1.2 && p.y < 0.88) dwell += RULES.timestep; else dwell = 0;
      if (dwell >= RULES.dwell) { status = 'success'; break; }
      if (hitBench) { status = p.x < goal.x - 0.8 ? 'fell-short' : 'overshot'; break; }
      if (p.y < -1 || Math.abs(p.x) > 10 || Math.abs(p.z) > 5) { status = 'out-of-bounds'; break; }
    }
    const end = ball.translation();
    if (frames.at(-1).t < round(elapsed)) {
      const q = ball.rotation(), v = ball.linvel();
      frames.push({t: round(elapsed), x:end.x, y:end.y, z:end.z, q:[q.x,q.y,q.z,q.w], vx:v.x, vy:v.y, vz:v.z, speed:Math.hypot(v.x,v.y,v.z)});
    }
    const last = point(end);
    const missVector = { x: round(goal.x - end.x), y: round(goal.y - end.y), z: round(goal.z - end.z) };
    const endDistanceToGoal = round(Math.hypot(missVector.x, missVector.y, missVector.z));
    const targetError = missVector.x;
    const message = status === 'success' ? `Marble settled in the cup for ${RULES.dwell.toFixed(1)} s.`
      : status === 'timeout' ? 'Marble stopped or did not reach the cup within 10 s.'
      : `Marble ${status === 'fell-short' ? 'touched the workbench before the cup' : status === 'overshot' ? 'missed the cup' : 'left the workbench'}. Last contact: ${lastTouched || 'none'}.`;
    return { id: uid(), revision: project.revision, status, success: status === 'success', duration: round(elapsed), closest: round(closest), closestPoint, closestTime, maxSpeed: round(maxSpeed), end: last, endDistanceToGoal, missVector, targetError, contacts, message, frames, project, createdAt: new Date().toISOString() };
  } finally { queue.free(); world.free(); }
}
