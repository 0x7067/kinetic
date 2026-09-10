/** Marble-to-cup is a composition fixture, not the engine identity. */
export const MARBLE_TITLE = 'The first leap';
export const MARBLE_PARTS = Object.freeze([
  Object.freeze({ id: 'launch', kind: 'ramp', name: 'Launch ramp', x: -4, y: 3.45, z: 0, angle: -18, yaw: 0, length: 4.4 }),
  Object.freeze({ id: 'bridge', kind: 'ramp', name: 'Landing ramp', x: 0.2, y: 2.5, z: 0, angle: -12, yaw: 0, length: 2.6 }),
  Object.freeze({ id: 'home', kind: 'ramp', name: 'Home stretch', x: 3.6, y: 1.12, z: 0, angle: -12, yaw: 0, length: 2.6 }),
]);
export const MARBLE_WORLD = Object.freeze({
  objects: Object.freeze([
    Object.freeze({ id: 'workbench', kind: 'workbench', name: 'Workbench', x: 0, y: -0.2, z: 0 }),
    Object.freeze({ id: 'cup', kind: 'cup', name: 'Cup', x: 5.45, y: 0.6, z: 0 }),
    Object.freeze({ id: 'marble', kind: 'marble', name: 'Marble', x: -5.5, y: 4.65, z: 0 }),
  ]),
});
export const MARBLE_JUDGE = Object.freeze({ type: 'dwell-sensor', body: 'marble', target: 'cup' });
