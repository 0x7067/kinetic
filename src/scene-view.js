import * as THREE from 'three';
import { createSceneObject } from './scene-geometry.js';

function textCanvas(p) {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.max(128,Math.min(1024,Math.round(1024*p.height/p.width)));
  const ctx=canvas.getContext('2d');ctx.fillStyle=p.color;ctx.textAlign='center';ctx.textBaseline='middle';
  const lines=p.text.split('\n'),size=Math.min(180,canvas.height*.8/lines.length);
  ctx.font=`${size}px system-ui, sans-serif`;
  lines.forEach((line,i)=>ctx.fillText(line,512,canvas.height/2+(i-(lines.length-1)/2)*size*1.15,980));return canvas;
}
function plotCanvas(p) {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=640;
  const c=canvas.getContext('2d'),xs=p.points.map(v=>v[0]),ys=p.points.map(v=>v[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const x=v=>80+(v-xmin)/Math.max(xmax-xmin,.00001)*890,y=v=>550-(v-ymin)/Math.max(ymax-ymin,.00001)*450;
  c.fillStyle='#fcfbf7';c.fillRect(0,0,1024,640);c.strokeStyle='#809082';c.lineWidth=3;
  c.beginPath();c.moveTo(80,80);c.lineTo(80,550);c.lineTo(970,550);c.stroke();
  c.fillStyle='#283f36';c.font='bold 32px system-ui';c.fillText(p.name,80,45,890);c.font='26px monospace';
  c.fillText(xmin.toFixed(2),80,590);c.fillText(xmax.toFixed(2),870,590);c.fillText(ymin.toFixed(2),8,550);c.fillText(ymax.toFixed(2),8,100);
  c.strokeStyle=p.color;c.lineWidth=7;c.beginPath();p.points.forEach((v,i)=>i?c.lineTo(x(v[0]),y(v[1])):c.moveTo(x(v[0]),y(v[1])));c.stroke();return canvas;
}
export async function decorateSceneObject(group,p) {
  if(!['text','plot','image'].includes(p.kind))return;
  const mesh=group.children[0];let texture;
  if(p.kind==='image')texture=(await imageTexture(p.data)).clone();
  else texture=new THREE.CanvasTexture(p.kind==='text'?textCanvas(p):plotCanvas(p));
  texture.colorSpace=THREE.SRGBColorSpace;
  // An edit may replace this group while a PNG is decoding.
  if(group.userData.disposed){texture.dispose();return;}
  mesh.material.dispose();mesh.material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,transparent:true,opacity:p.opacity,side:THREE.DoubleSide,depthWrite:p.kind!=='text'});
}

const imageTextures=new Map();
function imageTexture(data) {
  if(!imageTextures.has(data)){
    imageTextures.set(data,new THREE.TextureLoader().loadAsync(data));
    if(imageTextures.size>64){const key=imageTextures.keys().next().value;imageTextures.get(key).then(t=>t.dispose(),()=>{});imageTextures.delete(key);}
  }
  return imageTextures.get(data);
}
export async function prepareSceneAssets(project) {
  await Promise.all(project.parts.filter(p=>p.kind==='image').map(p=>imageTexture(p.data)));
}

export function buildSceneObjects(partsGroup,diagnostics,project) {
  const meshes=project.parts.map(p=>{
    const group=createSceneObject(p);partsGroup.add(group);
    diagnostics.add(new THREE.Box3Helper(new THREE.Box3().setFromObject(group),0xedb84d));return group;
  });
  const assetsReady=Promise.allSettled(meshes.map((group,i)=>decorateSceneObject(group,project.parts[i]))).then(results=>results.filter(r=>r.status==='rejected'));
  return {meshes,assetsReady};
}
export function applyObjectFrames(objects,frame) {
  for(const g of objects){const p=frame.objects[g.userData.partId];if(p){g.position.set(p.x,p.y,p.z);g.quaternion.fromArray(p.q);g.updateMatrixWorld(true);}}
}
export function frameCamera(camera,box,mode) {
  const sphere=box.getBoundingSphere(new THREE.Sphere()),target=sphere.center;
  const direction=new THREE.Vector3(...(mode==='top'?[0,1,.001]:mode==='side'?[0,0,1]:[1,.8,1])).normalize();
  camera.position.copy(target).addScaledVector(direction,Math.max(6,sphere.radius*3));camera.up.set(0,1,0);camera.lookAt(target);
  camera.far=Math.max(100,sphere.radius*8+10);
  camera.zoom=Math.min((camera.top-camera.bottom)/2,(camera.right-camera.left)/2)/Math.max(.9,sphere.radius*1.22);
  return target;
}
