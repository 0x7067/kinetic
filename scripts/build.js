import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const out=resolve(root,'dist');mkdirSync(out,{recursive:true});
cpSync(resolve(root,'src'),resolve(out,'src'),{recursive:true});
const files={
  'three.module.js':'node_modules/three/build/three.module.js',
  'three.core.js':'node_modules/three/build/three.core.js',
  'rapier.mjs':'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs',
  'addons/controls/OrbitControls.js':'node_modules/three/examples/jsm/controls/OrbitControls.js',
  'addons/geometries/RoundedBoxGeometry.js':'node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js',
};
for(const [dest,src] of Object.entries(files)){mkdirSync(dirname(resolve(out,'vendor',dest)),{recursive:true});cpSync(resolve(root,src),resolve(out,'vendor',dest));}
writeFileSync(resolve(out,'index.html'),read('index.html'));
const imports={};
function module(name,code){imports[name]=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;}
module('three/core',read(files['three.core.js']));
module('three',read(files['three.module.js']).replaceAll('./three.core.js','three/core'));
module('@dimforge/rapier3d-compat',read(files['rapier.mjs']));
for(const addon of ['controls/OrbitControls.js','geometries/RoundedBoxGeometry.js'])module(`three/addons/${addon}`,read(files[`addons/${addon}`]));
for(const name of ['errors','scene-model','scene-geometry','scene-view','scene-physics','scene-ui','model','physics','solver','view','replay','replay-player','app'])module(`@kinetic/${name}`,read(`src/${name}.js`).replaceAll(/'\.\/([\w-]+)\.js'/g,"'@kinetic/$1'"));
let html=read('index.html').replace('<link rel="stylesheet" href="./src/style.css" />',`<style>${read('src/style.css')}</style>`);
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,`<script type="importmap">${JSON.stringify({imports})}</script>`);
html=html.replace('<script type="module" src="./src/app.js"></script>',"<script type=\"module\">import '@kinetic/app';</script>");
writeFileSync(resolve(out,'kinetic-standalone.html'),html);
writeFileSync(resolve(out,'THIRD_PARTY_NOTICES.txt'),`Three.js: MIT\n${read('node_modules/three/LICENSE')}\n\nRapier: Apache-2.0\n${read('node_modules/@dimforge/rapier3d-compat/LICENSE')}`);
console.log(`Built static site + self-contained offline HTML (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MB).`);
