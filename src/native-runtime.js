import * as THREE from 'three';

const vector=v=>({x:v.x,y:v.y,z:v.z});
export async function start(config) {
  const identity=new URLSearchParams(location.hash.slice(1)),channel=identity.get('channel'),revision=Number(identity.get('revision'));
  const send=data=>parent.postMessage({channel,revision,...data},'*');
  const error=reason=>{const message=String(reason?.message||reason).slice(0,500);document.querySelector('#error').hidden=false;document.querySelector('#error').textContent=message;send({kind:'error',error:message});};
  let project,time=0,frame=0,paused=false,previous=null,animation;
  const render=camera=>project.render?project.render(camera):project.renderer.render(project.scene,camera);
  function indexed(){
    const all=[],registered=[];let total=0;
    project.scene.traverse(object=>{
      if(object===project.scene||(!object.isMesh&&!object.isLine&&!object.isPoints&&!object.userData.kinetic))return;
      total++;const tag=object.userData.kinetic;
      if(tag)registered.push({object,tag});
      else if(all.length<64)all.push({object,tag:{id:`object-${total}`,name:object.name||object.type}});
    });
    const source=registered.length?registered:all,ids=new Set();
    for(const {tag} of source){if(!tag||typeof tag.id!=='string'||!/^([a-zA-Z][a-zA-Z0-9_-]{0,39})$/.test(tag.id)||ids.has(tag.id))throw Error('Reviewable objects need unique userData.kinetic.id values (letters, numbers, underscore or hyphen; up to 40 characters).');ids.add(tag.id);}
    return {entries:source.slice(0,64),total,truncated:source.length>64||(!registered.length&&total>64)};
  }
  function inspect(){
    project.scene.updateMatrixWorld(true);project.camera.updateMatrixWorld(true);
    const {entries,total,truncated}=indexed();
    const parts=entries.map(({object,tag})=>{
      const box=new THREE.Box3().setFromObject(object),position=object.getWorldPosition(new THREE.Vector3());
      const axes=['x','y','z'].map((axis,index)=>vector(new THREE.Vector3().setComponent(index,1).transformDirection(object.matrixWorld)));
      return {id:tag.id,name:String(tag.name||object.name||tag.id).slice(0,80),kind:'native',type:object.type,source:tag.source||config.entry,position:vector(position),worldMatrix:object.matrixWorld.toArray(),axes:{x:axes[0],y:axes[1],z:axes[2]},bounds:box.isEmpty()?null:{min:vector(box.min),max:vector(box.max),size:vector(box.getSize(new THREE.Vector3()))}};
    });
    const camera=project.camera;
    return {revision,time,frame,paused,totalObjects:total,truncated,parts,camera:{type:camera.type,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom},capabilities:{inspect:true,capture:true,pause:true,seek:false,physics:false},renderer:{type:'WebGLRenderer',three:THREE.REVISION,calls:project.renderer.info.render.calls,triangles:project.renderer.info.render.triangles},gaps:[],goal:null};
  }
  function capture(options){
    const renderer=project.renderer,camera=project.camera.clone(),size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
    if(options.mode||options.focus){
      const {entries}=indexed(),selected=options.focus?entries.find(x=>x.tag.id===options.focus):null;
      if(options.focus&&!selected)throw Error('Capture focus is not present in this preview.');
      let bounds=new THREE.Box3();
      for(const {object} of selected?[selected]:entries)bounds.union(new THREE.Box3().setFromObject(object));
      if(bounds.isEmpty())bounds=new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
      const sphere=bounds.getBoundingSphere(new THREE.Sphere()),radius=Math.max(.1,sphere.radius),mode=options.mode||'iso';
      const direction=new THREE.Vector3(...(mode==='top'?[0,1,.0001]:mode==='side'?[0,0,1]:[1,.8,1])).normalize();
      const aspect=size.x/size.y;
      if(camera.isPerspectiveCamera){const fov=THREE.MathUtils.degToRad(camera.fov)/2;camera.position.copy(sphere.center).addScaledVector(direction,radius*1.12/Math.sin(Math.min(fov,Math.atan(Math.tan(fov)*aspect))));}
      else{const h=radius*1.12*Math.max(1,1/aspect);camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.zoom=1;camera.position.copy(sphere.center).addScaledVector(direction,Math.max(3,radius*3));}
      camera.near=.01;camera.far=Math.max(1000,radius*20);camera.lookAt(sphere.center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    }
    const scale=Math.min(1,960/size.x,720/size.y),width=Math.max(1,Math.round(size.x*scale)),height=Math.max(1,Math.round(size.y*scale));
    try{renderer.setPixelRatio(1);renderer.setSize(width,height,false);render(camera);return {image:renderer.domElement.toDataURL('image/png'),capture:{width,height,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom},time,frame,revision}};}
    finally{renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);render(project.camera);}
  }
  addEventListener('message',event=>{
    if(event.source!==parent||event.data?.channel!==channel||event.data?.kind!=='request'||!project)return;
    const {id,action,options={}}=event.data;
    try{
      if(!['inspect','capture','pause','resume'].includes(action))throw Error('Unsupported preview action.');
      if(action==='pause')paused=true;if(action==='resume')paused=false;
      const result=action==='capture'?capture(options):{};
      send({kind:'result',id,inspection:inspect(),...result});
    }catch(reason){send({kind:'result',id,error:String(reason.message||reason).slice(0,500)});}
  });
  addEventListener('error',event=>error(event.error||event.message));
  addEventListener('unhandledrejection',event=>error(event.reason));
  try{
    const module=await import(new URL(config.entry,location.href));
    if(typeof module.createProject!=='function')throw Error('Export createProject({ canvas, THREE }) from the project entry.');
    project=await module.createProject({canvas:document.querySelector('#scene'),THREE});
    if(!project?.scene?.isScene||!project.camera?.isCamera||!project.renderer?.isWebGLRenderer||project.renderer.domElement!==document.querySelector('#scene'))throw Error('createProject must return a Three.js scene, camera and WebGLRenderer using the supplied canvas.');
    const resize=()=>{const width=Math.max(1,innerWidth),height=Math.max(1,innerHeight);project.renderer.setSize(width,height,false);if(project.camera.isPerspectiveCamera){project.camera.aspect=width/height;project.camera.updateProjectionMatrix();}project.resize?.(width,height);};
    addEventListener('resize',resize);resize();
    const tick=now=>{
      try{const delta=previous===null?0:Math.min(.1,(now-previous)/1000);previous=now;if(!paused){time+=delta;project.update?.(time,delta);}render(project.camera);frame++;animation=requestAnimationFrame(tick);}catch(reason){error(reason);}
    };
    project.update?.(0,0);render(project.camera);send({kind:'ready',inspection:inspect()});animation=requestAnimationFrame(tick);
    addEventListener('pagehide',()=>{cancelAnimationFrame(animation);project.dispose?.();},{once:true});
    document.querySelector('#scene').addEventListener('click',event=>{
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2),project.camera);
      const {entries}=indexed(),hits=ray.intersectObjects(entries.map(x=>x.object),true);let picked=hits[0]?.object;
      while(picked&&!entries.some(x=>x.object===picked))picked=picked.parent;
      const selection=entries.find(x=>x.object===picked);send({kind:'selection',targetId:selection?.tag.id||null});
    });
  }catch(reason){error(reason);}
}
