import * as THREE from 'three';
import { RULES } from './model.js';

const round = n => Math.round(n * 1000) / 1000;
const vec = v => ({ x: round(v.x), y: round(v.y), z: round(v.z) });

function matrixFor(part) {
  const euler = new THREE.Euler(0, THREE.MathUtils.degToRad(part.yaw), THREE.MathUtils.degToRad(part.angle), 'YXZ');
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(part.x, part.y, part.z),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  );
}

function localBounds(part) {
  if (part.kind === 'barrier') {
    return new THREE.Box3(
      new THREE.Vector3(-part.length / 2, -0.35, -0.57),
      new THREE.Vector3(part.length / 2, 0.35, 0.57),
    );
  }
  return new THREE.Box3(
    new THREE.Vector3(-part.length / 2, -0.09, -0.69),
    new THREE.Vector3(part.length / 2, 0.37, 0.69),
  );
}

function boxRecord(box) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const sphere = new THREE.Sphere();
  box.getSize(size); box.getCenter(center); box.getBoundingSphere(sphere);
  return {
    min: vec(box.min), max: vec(box.max), center: vec(center), size: vec(size),
    sphere: { center: vec(sphere.center), radius: round(sphere.radius) },
  };
}

export function cameraRecommendations(sceneBox) {
  if (sceneBox.isEmpty()) return [];
  const sphere = new THREE.Sphere(); sceneBox.getBoundingSphere(sphere);
  const target = sphere.center;
  const radius = Math.max(1, sphere.radius);
  const corners = [];
  for (const x of [sceneBox.min.x,sceneBox.max.x]) for (const y of [sceneBox.min.y,sceneBox.max.y]) for (const z of [sceneBox.min.z,sceneBox.max.z]) corners.push(new THREE.Vector3(x,y,z));
  const directions = {
    isometric: new THREE.Vector3(1, 0.8, 1).normalize(),
    side: new THREE.Vector3(0, 0.22, 1).normalize(),
    top: new THREE.Vector3(0.001, 1, 0.001).normalize(),
  };
  return Object.entries(directions).map(([name, direction]) => {
    const position = target.clone().addScaledVector(direction, radius / Math.sin(THREE.MathUtils.degToRad(19)) * 1.08);
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, radius * 8 + 10);
    camera.position.copy(position); camera.lookAt(target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const projectionView = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(projectionView);
    return { name, position: vec(position), target: vec(target), fovDeg: 38, containsSceneBounds: corners.every(p => frustum.containsPoint(p)), occlusionTested: false };
  });
}

/**
 * Geometry facts intended for agents. This deliberately uses the same transforms
 * as the Three.js workbench instead of asking a model to infer them from screenshots.
 */
export function analyzeScene(project) {
  const goal = new THREE.Vector3(RULES.goal.x, RULES.goal.y, RULES.goal.z);
  const start = new THREE.Vector3(RULES.start.x, RULES.start.y, RULES.start.z);
  const sceneBox = new THREE.Box3();
  const parts = project.parts.map(part => {
    const matrix = matrixFor(part);
    const box = localBounds(part).applyMatrix4(matrix);
    sceneBox.union(box);
    const surfaceY = part.kind === 'barrier' ? 0.35 : 0.09;
    const a = new THREE.Vector3(-part.length / 2, surfaceY, 0).applyMatrix4(matrix);
    const b = new THREE.Vector3(part.length / 2, surfaceY, 0).applyMatrix4(matrix);
    const surfaceNormal = new THREE.Vector3(0, 1, 0).transformDirection(matrix).normalize();
    const localForward = new THREE.Vector3(1, 0, 0).transformDirection(matrix).normalize();
    const downhill = localForward.clone();
    if (downhill.y > 0) downhill.multiplyScalar(-1);
    const startDistance = Math.min(a.distanceTo(start), b.distanceTo(start));
    const goalDistance = Math.min(a.distanceTo(goal), b.distanceTo(goal));
    return {
      id: part.id,
      name: part.name,
      kind: part.kind,
      transform: {
        position: { x: part.x, y: part.y, z: part.z },
        angleDeg: part.angle,
        yawDeg: part.yaw,
        length: part.length,
        matrixWorld: matrix.elements.map(round),
      },
      bounds: boxRecord(box),
      endpoints: [vec(a), vec(b)],
      surfaceNormal: vec(surfaceNormal),
      downhill: Math.abs(downhill.y) < 1e-8 ? null : vec(downhill),
      slope: round(Math.abs(downhill.y)),
      nearestEndpointToStart: round(startDistance),
      nearestEndpointToGoal: round(goalDistance),
    };
  });

  const gaps = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const left = parts[i], right = parts[i + 1];
    const pairs = [];
    for (const a of left.endpoints) for (const b of right.endpoints) {
      const va = new THREE.Vector3(a.x, a.y, a.z), vb = new THREE.Vector3(b.x, b.y, b.z);
      const delta = vb.clone().sub(va);
      pairs.push({
        distance: va.distanceTo(vb),
        horizontalDistance: Math.hypot(delta.x, delta.z),
        verticalDelta: delta.y,
        from: a,
        to: b,
        delta: vec(delta),
      });
    }
    pairs.sort((a, b) => a.distance - b.distance);
    const best = pairs[0];
    gaps.push({
      from: left.id,
      to: right.id,
      distance: round(best.distance),
      horizontalDistance: round(best.horizontalDistance),
      verticalDelta: round(best.verticalDelta),
      delta: best.delta,
      endpoints: [best.from, best.to],
    });
  }

  return {
    coordinateSystem: 'Y-up, metres; angles in degrees at the authoring boundary',
    start: vec(start),
    goal: { ...vec(goal), radius: RULES.goalRadius },
    sceneBounds: sceneBox.isEmpty() ? null : boxRecord(sceneBox),
    cameraRecommendations: cameraRecommendations(sceneBox),
    parts,
    gaps,
    gapMethod: 'Nearest deck-centre endpoints between adjacent project entries; not collision clearance or a reachability prediction.',
  };
}
