import { uid } from './model.js';
import { sceneQuaternion } from './scene-geometry.js';
import { SCENE_RULES } from './scene-model.js';

export async function simulateScene(project, RAPIER) {
  const dynamic=project.parts.filter(p=>p.body==='dynamic');
  const frames=[],contacts=[],bodies=new Map(),names=new Map(),seen=new Set();
  const world=new RAPIER.World({x:project.settings.gravity[0],y:project.settings.gravity[1],z:project.settings.gravity[2]}),queue=new RAPIER.EventQueue(true);
  world.timestep=SCENE_RULES.timestep;
  const record=t=>({t:+t.toFixed(4),objects:Object.fromEntries([...bodies].map(([id,body])=>{
    const p=body.translation(),q=body.rotation(),v=body.linvel();return [id,{x:p.x,y:p.y,z:p.z,q:[q.x,q.y,q.z,q.w],vx:v.x,vy:v.y,vz:v.z,speed:Math.hypot(v.x,v.y,v.z)}];
  }))});
  try{
    for(const p of project.parts.filter(p=>p.body!=='none')){
      const desc=p.body==='dynamic'?RAPIER.RigidBodyDesc.dynamic():RAPIER.RigidBodyDesc.fixed();
      const body=world.createRigidBody(desc.setTranslation(p.x,p.y,p.z).setRotation(sceneQuaternion(p)).setCcdEnabled(true));
      const shape=p.kind==='sphere'?RAPIER.ColliderDesc.ball(p.radius):p.kind==='cylinder'?RAPIER.ColliderDesc.cylinder(p.height/2,p.radius):RAPIER.ColliderDesc.cuboid(p.width/2,p.height/2,p.depth/2);
      const collider=world.createCollider(shape.setFriction(p.friction).setRestitution(p.restitution).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);names.set(collider.handle,p.id);
      if(p.body==='dynamic')bodies.set(p.id,body);
    }
    frames.push(record(0));
    const ticks=dynamic.length?Math.ceil(project.settings.duration/SCENE_RULES.timestep):0;
    for(let i=1;i<=ticks;i++){
      const previousContacts=contacts.length;world.step(queue);
      queue.drainCollisionEvents((a,b,started)=>{
        const pair=[names.get(a),names.get(b)].sort(),key=pair.join(':');
        if(!started||seen.has(key)||contacts.length>=128)return;seen.add(key);
        contacts.push({part:names.get(a),other:names.get(b),time:+(i*SCENE_RULES.timestep).toFixed(4)});
      });
      if(i%4===0||i===ticks||contacts.length>previousContacts)frames.push(record(i*SCENE_RULES.timestep));
    }
    const duration=frames.at(-1).t;
    return {id:uid(),mode:'scene',revision:project.revision,success:null,status:dynamic.length?'completed':'rendered',duration,contacts,frames,project,createdAt:new Date().toISOString(),message:dynamic.length?`Simulated ${dynamic.length} bodies. No challenge success criterion is defined.`:'Static scene. No physics simulation was needed.'};
  }finally{queue.free();world.free();}
}
