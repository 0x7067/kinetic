import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RULES } from './model.js';

const palette = { ink: 0x273e39, coral: 0xd87250, teal: 0x408a7f, cream: 0xeee8d8, gold: 0xedb84d, board: 0xdbe3d9 };
export class WorkbenchView {
  constructor(host, onSelect) {
    this.host = host; this.onSelect = onSelect; this.meshes = []; this.selectedId = null; this.trailPoints = [];
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xeceee6);
    this.camera = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 100);
    this.camera.position.set(9, 10, 13); this.camera.lookAt(0, 1.8, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    host.prepend(this.renderer.domElement); this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D marble workbench. Drag to orbit. Select parts in the Build panel.');
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.5, 0); this.controls.enableDamping = true; this.controls.enablePan = false;
    this.controls.minZoom = 0.65; this.controls.maxZoom = 2; this.controls.minPolarAngle = 0.12; this.controls.maxPolarAngle = 1.45;
    const hemi = new THREE.HemisphereLight(0xfffcf3, 0x85978d, 3); this.scene.add(hemi);
    const rim = new THREE.DirectionalLight(0xf3ffff, 1.5); rim.position.set(8, 6, -8); this.scene.add(rim);
    this.staticGroup = new THREE.Group(); this.partsGroup = new THREE.Group(); this.scene.add(this.staticGroup, this.partsGroup);
    this.marble = null;
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(1024 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(1024 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeometry.setDrawRange(0, 0);
    this.trail = new THREE.Line(this.trailGeometry, new THREE.LineBasicMaterial({vertexColors:true, transparent:true, opacity:0.85}));
    this.trail.frustumCulled = false; this.scene.add(this.trail);
    this.diagnostics = new THREE.Group(); this.diagnostics.visible = false; this.scene.add(this.diagnostics);
    this.diagnosticsEnabled = false;
    this.comparison = new THREE.Group(); this.scene.add(this.comparison);
    this.comparison.visible = false; this.comparisonRun = null;
    this.velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 1, palette.gold, .16, .08);
    this.velocityArrow.visible = false; this.scene.add(this.velocityArrow);
    this.selection = new THREE.Box3Helper(new THREE.Box3(), palette.coral); this.selection.visible = false; this.scene.add(this.selection);
    this.raycaster = new THREE.Raycaster(); let down = null;
    host.addEventListener('pointerdown', event => { down = [event.clientX, event.clientY]; });
    host.addEventListener('pointerup', event => {
      if (!down || Math.hypot(event.clientX-down[0], event.clientY-down[1]) > 6 || event.target !== this.renderer.domElement) return;
      const b = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-b.left)/b.width*2-1, -(event.clientY-b.top)/b.height*2+1), this.camera);
      const hit = this.raycaster.intersectObjects(this.meshes, true)[0]; if (hit) { let o=hit.object; while(o && !o.userData.partId) o=o.parent; if(o) this.onSelect(o.userData.partId); }
    });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resize();
    this.reset(); this.running = true; this.loop();
  }
  addKeyLight(parent) {
    const light = new THREE.DirectionalLight(0xfff1da, 4.5); light.position.set(-5, 12, 5); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, far: 40 });
    light.shadow.normalBias = 0.03; light.shadow.bias = -0.0003; light.shadow.radius = 4; parent.add(light); return light;
  }
  material(color, extra={}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...extra }); }
  box(parent, w,h,d, color, x=0,y=0,z=0, radius=0.06) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/4,h/4,d/4)), this.material(color));
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  cylinder(parent, r,h,color,x,y,z) { const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),this.material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m; }
  text(parent, text, x,y,z, width, color='#657b6e') {
    const c=document.createElement('canvas'); c.width=1024;c.height=128;
    const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='500 58px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,64);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.set(x,y,z);parent.add(m);
  }
  buildTable() {
    const g=this.staticGroup;
    this.box(g,16,0.48,8.4,palette.board,0,-0.3,0,0.18);
    this.box(g,15.7,0.22,8.1,0xb9c6b9,0,-0.61,0,0.1);
    for(const x of [-6.9,6.9])for(const z of [-3.2,3.2])this.cylinder(g,0.3,0.25,palette.ink,x,-0.82,z);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200),this.material(0xeceee6));floor.rotation.x=-Math.PI/2;floor.position.y=-0.97;floor.receiveShadow=true;g.add(floor);
    const points=[]; for(let x=-7;x<=7;x+=0.5)for(let z=-3.5;z<=3.5;z+=0.5)points.push(x,-0.045,z);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    g.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0x879e8c,size:0.018,transparent:true,opacity:0.62})));
    for(const x of [-7.3,7.3])for(const z of [-3.5,3.5]){
      this.cylinder(g,0.09,0.015,0x9aa993,x,-0.04,z);
      this.box(g,0.09,0.013,0.016,0x647c6a,x,-0.026,z,0.002);
    }
    this.text(g,'K I N E T I C   /   F I E L D   L A B',-3,-0.025,3.32,4.5);
    this.text(g,'001   •   EARTH GRAVITY',4.6,-0.025,3.32,3);
    for(let i=0;i<15;i++)this.box(g,0.015,0.007,i%5===0?0.18:0.08,0x8fa08f,-7+i,-0.03,-3.5,0.002);
    // A small start marker is a visual guide only; the marble is released from rest.
    const start=this.worldObject('marble') || RULES.start;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.38,0.018,8,40),this.material(palette.coral));ring.rotation.x=Math.PI/2;ring.position.set(start.x,start.y+0.12,start.z);g.add(ring);
  }
  buildCup() {
    // cup.x/cup.z are honored. cup.y is unsupported this slice; visual Y stays at the fixture constants.
    const g=this.staticGroup, cup=this.worldObject('cup'), x=cup?.x ?? RULES.goal.x, z=cup?.z ?? RULES.goal.z;
    this.cylinder(g,0.93,0.25,0xc9bfa6,x,0.08,z);
    this.cylinder(g,0.75,0.32,palette.cream,x,0.2,z);
    this.cylinder(g,0.65,0.012,palette.gold,x,0.369,z);
    // Repeated ribs share geometry/material and one instanced draw call.
    const ribs = new THREE.InstancedMesh(new RoundedBoxGeometry(.10,.66,.10,2,.025), this.material(palette.cream), 48);
    const dummy = new THREE.Object3D();
    for(let i=0;i<48;i++){const a=i*Math.PI*2/48;dummy.position.set(x+Math.cos(a)*.73,.61,z+Math.sin(a)*.73);dummy.rotation.y=-a;dummy.updateMatrix();ribs.setMatrixAt(i,dummy.matrix);}
    ribs.instanceMatrix.needsUpdate=true; ribs.castShadow=true; ribs.receiveShadow=true; g.add(ribs);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.73,0.07,12,64),this.material(palette.teal));ring.rotation.x=Math.PI/2;ring.position.set(x,0.96,z);g.add(ring);
    this.cylinder(g,0.025,1.7,palette.ink,x+0.84,0.9,z-0.6);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.32),new THREE.MeshStandardMaterial({color:palette.gold,side:THREE.DoubleSide}));flag.position.set(x+1.12,1.57,z-0.6);g.add(flag);
    this.text(g,'F I N I S H',x,0.001,z+1.65,1.8,'#456e60');
    this.goalHalo=new THREE.Mesh(new THREE.RingGeometry(0.98,1.03,64),new THREE.MeshBasicMaterial({color:palette.teal,transparent:true,opacity:0.45,side:THREE.DoubleSide}));
    this.goalHalo.rotation.x=-Math.PI/2;this.goalHalo.position.set(x,-0.027,z);g.add(this.goalHalo);
  }
  worldObject(kind) { return this.currentProject?.world?.objects?.find(o=>o.kind===kind); }
  ensureMarble(spec) {
    if (!spec) {
      if (this.marble) {
        this.scene.remove(this.marble);
        this.marble.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});
        this.marble = null;
      }
      return;
    }
    if (!this.marble) {
      this.marble = new THREE.Mesh(new THREE.SphereGeometry(RULES.radius, 40, 24), new THREE.MeshPhysicalMaterial({ color: palette.coral, roughness: 0.2, metalness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12 }));
      this.marble.castShadow = true; this.scene.add(this.marble);
      const band = new THREE.Mesh(new THREE.TorusGeometry(RULES.radius * 0.98, 0.019, 8, 40), new THREE.MeshStandardMaterial({ color: 0xffe5c8, roughness: 0.35 }));
      band.rotation.x = Math.PI / 2; this.marble.add(band);
    }
    this.marble.position.set(spec.x, spec.y, spec.z);
  }
  setProject(project) {
    const signature = JSON.stringify({ parts: project.parts, world: project.world });
    this.currentProject = structuredClone(project);
    if (signature === this.projectSignature) return;
    this.projectSignature = signature;
    this.clearGroup(this.diagnostics);
    this.clearGroup(this.staticGroup);
    if (this.worldObject('workbench')) this.buildTable();
    if (this.worldObject('cup')) this.buildCup();
    const lights = (project.world?.objects || []).filter(o => o.kind === 'light');
    if (lights.length) {
      for (const object of lights) {
        const light = new THREE.DirectionalLight(0xfff1da, object.intensity ?? 2.2);
        light.position.set(object.x, object.y, object.z); this.staticGroup.add(light);
      }
    } else {
      this.addKeyLight(this.staticGroup);
    }
    this.ensureMarble(this.worldObject('marble'));
    for (const child of [...this.partsGroup.children]) { child.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});this.partsGroup.remove(child); }
    this.meshes=[];
    project.parts.forEach((p,i)=>{
      const group=new THREE.Group();group.position.set(p.x,p.y,p.z);group.rotation.order='YXZ';group.rotation.y=p.yaw*Math.PI/180;group.rotation.z=p.angle*Math.PI/180;group.userData.partId=p.id;
      const color=i===0?palette.coral:i===1?palette.cream:palette.teal;
      if (p.kind === 'mesh') {
        this.box(group,p.length,1,1,color);
        this.partsGroup.add(group);this.meshes.push(group);
        return;
      }
      const h=p.kind==='barrier'?0.7:0.18;
      this.box(group,p.length,h,1.14,color);
      if(p.kind!=='barrier')for(const z of [-0.63,0.63])this.box(group,p.length,0.44,0.12,color,0,0.15,z,0.04);
      for(const end of [-1,1]){
        this.box(group,0.045,0.012,1.0,i===1?0xc3bba3:0xffffff,end*(p.length/2-0.22),h/2+0.008,0,0.001);
        for(const z of [-0.48,0.48])this.cylinder(group,0.036,0.012,0x8f8873,end*(p.length/2-0.15),h/2+0.012,z);
      }
      this.partsGroup.add(group);this.meshes.push(group);
      // Decorative supports are intentionally excluded from the physics collision kit.
      for(const end of [-1,1]) {
        const local=new THREE.Vector3(end*p.length*0.31,-h/2,0);group.updateMatrixWorld();local.applyMatrix4(group.matrixWorld);
        const height=Math.max(0.1,local.y-0.06);
        this.cylinder(this.partsGroup,0.18,height,0xbeb29a,local.x,height/2-0.04,local.z);
        this.cylinder(this.partsGroup,0.32,0.12,0xd3c7af,local.x,0.02,local.z);
        this.cylinder(this.partsGroup,0.22,0.09,color,local.x,height*0.52,local.z);
      }
    });
    this.select(this.selectedId);
    for (const group of this.meshes) {
      const box = new THREE.Box3().setFromObject(group);
      this.diagnostics.add(new THREE.Box3Helper(box, palette.gold));
      const centre = box.getCenter(new THREE.Vector3());
      const normal = new THREE.Vector3(0,1,0).transformDirection(group.matrixWorld);
      this.diagnostics.add(new THREE.ArrowHelper(normal, centre, .95, palette.teal, .18, .10));
      const axes = new THREE.AxesHelper(.45); axes.position.copy(centre); this.diagnostics.add(axes);
    }
  }
  clearGroup(group) {
    const geometries = new Set(), materials = new Set();
    group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o.isInstancedMesh)o.dispose();});
    for(const geo of geometries)geo.dispose();
    for(const material of materials){material.map?.dispose();material.dispose();}
    group.clear();
  }
  setDiagnostics(enabled) { this.diagnosticsEnabled=!!enabled; this.diagnostics.visible=!!enabled; }

  select(id) { this.selectedId=id;const g=this.meshes.find(m=>m.userData.partId===id);this.selection.visible=!!g;if(g){g.updateMatrixWorld(true);this.selection.box.setFromObject(g).expandByScalar(0.06);} }
  resize() { const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);const span=Math.max(6.8,9.8*h/w);this.camera.top=span;this.camera.bottom=-span;this.camera.left=-span*w/h;this.camera.right=span*w/h;this.camera.updateProjectionMatrix(); }
  reset() {
    const marble = this.worldObject('marble');
    if (this.marble && marble) { this.marble.position.set(marble.x, marble.y, marble.z); this.marble.quaternion.identity(); }
    this.setTrail([]); this.velocityArrow.visible=false;
  }
  setFrame(frame) { if(!frame||!this.marble)return;this.marble.position.set(frame.x,frame.y,frame.z);this.marble.quaternion.fromArray(frame.q); }
  setTrail(frames) {
    this.trailFrames = frames;
    const count=Math.min(frames.length,1024), positions=this.trailGeometry.getAttribute('position'), colors=this.trailGeometry.getAttribute('color');
    const slow=new THREE.Color(palette.teal), fast=new THREE.Color(palette.coral), color=new THREE.Color();
    for(let i=0;i<count;i++){const f=frames[Math.floor(i*frames.length/Math.max(1,count))];positions.setXYZ(i,f.x,f.y,f.z);color.copy(slow).lerp(fast,Math.min(1,f.speed/8));colors.setXYZ(i,color.r,color.g,color.b);}
    positions.needsUpdate=true; colors.needsUpdate=true; this.trailGeometry.setDrawRange(0,count);
  }
  setMotion(frame) {
    if (!this.marble) { this.velocityArrow.visible = false; return; }
    const velocity = new THREE.Vector3(frame.vx || 0, frame.vy || 0, frame.vz || 0);
    const speed = velocity.length(); this.velocityArrow.visible = speed > .04;
    if (speed > .04) {
      this.velocityArrow.position.set(frame.x, frame.y + .3, frame.z);
      this.velocityArrow.setDirection(velocity.normalize());
      this.velocityArrow.setLength(Math.min(2, speed * .2), .16, .08);
    }
  }
  setComparison(run) {
    if (this.comparisonRun?.id === run?.id) return;
    this.clearGroup(this.comparison); this.comparisonRun = run; this.ghostMarble = null;
    this.comparison.visible = !!run;
    if (!run) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(run.frames.map(f=>new THREE.Vector3(f.x,f.y,f.z)));
    const trail = new THREE.Line(geometry, new THREE.LineDashedMaterial({color:0x5c6faf,transparent:true,opacity:.65,dashSize:.12,gapSize:.09,depthWrite:false}));
    trail.computeLineDistances(); this.comparison.add(trail);
    if ((run.project?.world?.objects || []).some(o => o.kind === 'marble')) {
      this.ghostMarble = new THREE.Mesh(new THREE.SphereGeometry(RULES.radius,24,16),new THREE.MeshBasicMaterial({color:0x6275b5,transparent:true,opacity:.4,depthWrite:false}));
      this.comparison.add(this.ghostMarble);
    }
    for (const p of run.project.parts) {
      const base = new THREE.BoxGeometry(p.length, p.kind==='mesh'?1:p.kind==='barrier'?.7:.18, p.kind==='mesh'?1:1.14);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(base), new THREE.LineBasicMaterial({color:0x6275b5,transparent:true,opacity:.3,depthWrite:false}));
      base.dispose(); edges.position.set(p.x,p.y,p.z);edges.rotation.order='YXZ';edges.rotation.y=p.yaw*Math.PI/180;edges.rotation.z=p.angle*Math.PI/180;
      this.comparison.add(edges);
    }
  }
  setComparisonFrame(frame) {
    if(this.ghostMarble){this.ghostMarble.position.set(frame.x,frame.y,frame.z);this.ghostMarble.quaternion.fromArray(frame.q);}
  }
  setCamera(mode) { this.camera.zoom=1;this.camera.position.set(...(mode==='top'?[0,18,0.01]:mode==='side'?[0,4,19]:[9,10,13]));this.controls.target.set(0,1.5,0);this.camera.lookAt(this.controls.target);this.camera.updateProjectionMatrix();this.controls.update(); }
  cameraState() { return { position:this.camera.position.toArray(),target:this.controls.target.toArray(),zoom:this.camera.zoom }; }
  restoreCamera(value) { if(!value)return;this.camera.position.fromArray(value.position);this.controls.target.fromArray(value.target);this.camera.zoom=value.zoom||1;this.camera.updateProjectionMatrix();this.controls.update(); }
  capture(options = {}) {
    const renderer=this.renderer, originalSize=renderer.getSize(new THREE.Vector2()), pixelRatio=renderer.getPixelRatio();
    const selected=this.selection.visible, diagnostics=this.diagnostics.visible, comparison=this.comparison.visible, motion=this.velocityArrow.visible;
    const camera=this.camera.clone();
    const aspect=originalSize.x/Math.max(1,originalSize.y);
    const scale=Math.min(1,960/originalSize.x,720/originalSize.y);
    const width=Math.max(1,Math.round(originalSize.x*scale)),height=Math.max(1,Math.round(originalSize.y*scale));
    if(options.mode || options.focus) {
      let box;
      if(options.focus){
        const object=this.meshes.find(m=>m.userData.partId===options.focus);
        if(object) box=new THREE.Box3().setFromObject(object);
        else {
          const stuff=(this.currentProject?.world?.objects||[]).find(o=>o.id===options.focus);
          if(!stuff)throw new Error('Unknown capture focus: '+options.focus);
          box=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(stuff.x,stuff.y,stuff.z), new THREE.Vector3(.4,.4,.4));
        }
      }
      else {
        box=new THREE.Box3().setFromObject(this.partsGroup);
        const marble=this.worldObject('marble'), cup=this.worldObject('cup');
        if (marble) box.expandByPoint(new THREE.Vector3(marble.x, marble.y, marble.z));
        if (cup) box.expandByPoint(new THREE.Vector3(cup.x, cup.y, cup.z));
      }
      const sphere=box.getBoundingSphere(new THREE.Sphere()),target=sphere.center;
      const direction=new THREE.Vector3(...(options.mode==='top'?[0,1,.001]:options.mode==='side'?[0,0,1]:[1,.8,1])).normalize();
      camera.position.copy(target).addScaledVector(direction,Math.max(6,sphere.radius*3));camera.up.set(0,1,0);camera.lookAt(target);
      const span=Math.max(.9,sphere.radius*1.22)*Math.max(1,1/aspect);
      camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.zoom=1;
    }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    try {
      this.selection.visible=false;this.diagnostics.visible=!!options.overlays;this.comparison.visible=false;this.velocityArrow.visible=motion&&!!options.overlays;
      // Rasterize at the evidence resolution; do not render a full-DPI frame then shrink it.
      renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.render(this.scene,camera);
      const image=renderer.domElement.toDataURL('image/png');
      this.lastCapture={width,height,mode:options.mode||'current',focus:options.focus||null,overlays:!!options.overlays,camera:{type:'OrthographicCamera',position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom,left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom}};
      return image;
    } finally {
      this.selection.visible=selected;this.diagnostics.visible=diagnostics;this.comparison.visible=comparison;this.velocityArrow.visible=motion;
      renderer.setPixelRatio(pixelRatio);renderer.setSize(originalSize.x,originalSize.y,false);
    }
  }
  loop() { if(!this.running)return;this.controls.update();this.renderer.render(this.scene,this.camera);this.animation=requestAnimationFrame(()=>this.loop()); }
  dispose() { this.running=false;cancelAnimationFrame(this.animation);this.observer.disconnect();this.controls.dispose();this.clearGroup(this.scene);this.renderer.dispose(); }
}
