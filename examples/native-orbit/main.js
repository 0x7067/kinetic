import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createProject({ canvas }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8eae3');
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(7, 5, 10);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.8, 0);
  controls.update();
  scene.add(new THREE.HemisphereLight('#ffffff', '#73806c', 2.4));
  const sun = new THREE.DirectionalLight('#fff4df', 4);
  sun.position.set(5, 9, 6);
  sun.castShadow = true;
  scene.add(sun);

  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec3 positionLocal; varying vec3 normalWorld; void main(){positionLocal=position;normalWorld=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float time; varying vec3 positionLocal; varying vec3 normalWorld; void main(){float band=.5+.5*sin(positionLocal.y*2.5+time*.4);vec3 ink=mix(vec3(.17,.37,.32),vec3(.91,.56,.33),band);float light=.5+.5*max(dot(normalize(normalWorld),normalize(vec3(.5,1.,.7))),0.);gl_FragColor=vec4(ink*light,1.);}'
  });
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.15, .3, 160, 24), material);
  knot.position.y = 2.2;
  knot.userData.kinetic = { id:'sculpture', name:'Animated shader sculpture', source:'main.js' };
  scene.add(knot);

  const orbit = new THREE.Group();
  orbit.position.y = 2.2;
  orbit.userData.kinetic = { id:'orbit', name:'Procedural orbit', source:'main.js' };
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.12 + i % 3 * .04, 1), new THREE.MeshStandardMaterial({ color:i % 2 ? '#dbaa67' : '#5b8c79', roughness:.4 }));
    orb.position.set(Math.cos(angle)*2.6, Math.sin(angle*2)*.3, Math.sin(angle)*2.6);
    orb.castShadow = true;
    orbit.add(orb);
  }
  scene.add(orbit);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, .35, 64), new THREE.MeshStandardMaterial({ color:'#d7d9cd', roughness:.9 }));
  plinth.position.y = -.1;
  plinth.receiveShadow = true;
  plinth.userData.kinetic = { id:'plinth', name:'Display plinth', source:'main.js' };
  scene.add(plinth);

  return {
    scene, camera, renderer,
    update(time) { material.uniforms.time.value=time; knot.rotation.y=time*.18; knot.rotation.z=Math.sin(time*.35)*.12; orbit.rotation.y=-time*.12; controls.update(); },
    dispose() { controls.dispose(); scene.traverse(object=>{object.geometry?.dispose();if(object.material)object.material.dispose();}); renderer.dispose(); }
  };
}
