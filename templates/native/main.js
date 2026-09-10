import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Build freely with Three.js. Give reviewable objects stable userData.kinetic IDs.
export function createProject({ canvas }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eceee6');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(6, 5, 8);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667755, 2));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(5, 8, 4);
  scene.add(light);

  // Add your objects, materials and behavior here. The initial scene is empty.
  return {
    scene, camera, renderer,
    update(time, delta) { controls.update(); },
    dispose() { controls.dispose(); renderer.dispose(); }
  };
}
