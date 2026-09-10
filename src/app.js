import { Workshop, initialProject, clone, validateProject, uid } from './model.js';
import { prepareSceneAssets } from './scene-view.js';
import { initialScene } from './scene-model.js';
import { sceneInspector, sceneAttempt, newScenePart, escapeHTML } from './scene-ui.js';
import { simulate } from './physics.js';
import { propose, score, restoreOperations } from './solver.js';
import { WorkbenchView } from './view.js';
import { ReplayPlayer } from './replay-player.js';
import { sampleRun, compareRuns } from './replay.js';
import { NativeWorkspace } from './native-ui.js';
const $=selector=>document.querySelector(selector);
const escape=escapeHTML;
let state,selected='bridge',busy=false,solving=false,stopSolver=false,remote=false,local,view,lastRun=null,muted=true,audio=null;
let source=null, config=null, savedError=null, player=null, comparisonRun=null, nativeWorkspace=null;
const runCache=new Map();
function cacheRun(run){runCache.set(run.id,run);while(runCache.size>20)runCache.delete(runCache.keys().next().value);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3600);}
function outcome(text,success=false){const e=$('#outcome');e.textContent=text;e.className=`outcome show ${success?'success':''}`;}
function tone(frequency,duration=0.08,volume=0.03){if(muted)return;audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}
function successSound(){[523.25,659.25,783.99].forEach((f,i)=>setTimeout(()=>tone(f,0.35,0.04),i*95));}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,body){
  if(remote){const r=await fetch(`./api/${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error?.message||`Request failed: ${r.status}`);return data;}
  if(path==='state')return local.state();
  let result;
  if(path==='edit')result=local.edit(body);
  else if(path==='undo')result=local.undo(body.expectedRevision);
  else if(path==='redo')result=local.redo(body.expectedRevision);
  else if(path==='reset'){local.check(body.expectedRevision);local.commit(local.project.version===2?initialScene():initialProject());result=local.state();}
  else if(path==='import'){local.check(body.expectedRevision);local.commit(validateProject(body.project));result=local.state();}
  else if(path==='run'){local.check(body.expectedRevision);result=await simulate(local.project);local.addRun(result);cacheRun(result);}
  else if(path==='feedback'){result=body?local.addFeedback(body,body.runId?runCache.get(body.runId):null):{feedback:local.feedback.filter(n=>!n.resolved)};}
  else if(path==='feedback/resolve'){local.feedback=local.feedback.filter(n=>!body.ids.includes(n.id));result={remaining:local.feedback.filter(n=>!n.resolved).length};}
  else if(path.startsWith('runs/')){result=runCache.get(path.slice(5));if(!result)throw new Error('Replay is no longer available. Run this layout again.');}
  else throw new Error('This operation requires the local MCP service.');
  try{localStorage.setItem('kinetic-project-v1',JSON.stringify({project:local.project,feedback:local.feedback}));}catch{toast('Browser storage is full or unavailable. Save a project file to keep this layout.');}
  return result;
}
async function refresh(){state=await api('state');render();}
function partIcon(index){return `<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M3 20L23 9l4 5L7 25z" fill="${['#d78564','#c6bea6','#5a978b'][index%3]}"/><path d="M3 20L7 25v-5L3 16z" fill="#98a589"/><path d="M3 16L23 5l4 4L7 20z" fill="${['#e7a587','#e9e4d0','#8bb6a7'][index%3]}"/></svg>`;}
const marbleHeader=$('.challenge').innerHTML;
function renderWorkspaceHeader(project) {
  const general=project.version===2;document.body.dataset.mode=general?'scene':'marble';
  $('.intro .eyebrow').textContent=general?'THE OPEN WORKSHOP':'THE MARBLE WORKSHOP · VOL. 001';
  $('.intro>p').innerHTML=general?'Give an idea a shape.<br>See it, test it, make it better.':'Build something. Let gravity have a say.<br>Make it a little better.';
  $('.canvas-heading>span').innerHTML='<i class="live-dot"></i> '+escape(project.title);
  $('#run span').textContent=general?'Run scene':'Run marble';$('#feedback-text').placeholder=general?'Describe what should change…':'This landing feels too high…';
  $('#reset-run').setAttribute('aria-label',general?'Reset scene':'Reset marble');$('#reset-run').title=general?'Reset scene':'Reset marble';
  view?.renderer.domElement.setAttribute('aria-label',general?'Interactive 3D scene. Drag to orbit. Select objects in the Build panel.':'Interactive 3D marble workbench. Drag to orbit. Select parts in the Build panel.');
  $('#solver-note').textContent=general?'Visual objects + optional physics. Every edit has history.':solving?$('#solver-note').textContent:'Auto-tune uses local search. No model or API key.';
  $('.challenge').innerHTML=general?`<div class="eyebrow">YOUR WORKSPACE <span>${project.parts.length} / 64</span></div><h2>Room for an idea.</h2><p>Create objects, add explanations, and run experiments. Physics is optional.</p><div class="scene-settings"><label>Title<input data-setting="title" maxlength="80" value="${escape(project.title)}" aria-label="Scene title"/></label><label>Background<input type="color" data-setting="background" value="${project.settings.background}" aria-label="Scene background"/></label><label>Gravity Y<input type="number" data-setting="gravity" min="-100" max="100" step=".1" value="${project.settings.gravity[1]}" aria-label="Scene gravity Y"/></label><label>Seconds<input type="number" data-setting="duration" min=".1" max="10" step=".1" value="${project.settings.duration}" aria-label="Simulation duration"/></label></div>`:marbleHeader;
}
function partRows(displayed,selected) {
  const general=displayed.version===2;return displayed.parts.map((p,i)=>`<button class="part ${p.id===selected?'active':''}" data-part="${escape(p.id)}" aria-pressed="${p.id===selected}"><span class="part-icon">${partIcon(i)}</span><span class="part-name">${escape(p.name)}<small>${escape(p.kind)} · ${general?(p.body==='none'?'visual':p.body+' body'):p.length.toFixed(1)+' m'}</small></span><span>0${i+1}</span></button>`).join('');
}
function inspectorMarkup(p,general) { return general?sceneInspector(p):p?`<div class="inspector">${[
    ['y','Height',0.7,4.2,0.05,'m'],['angle','Pitch',-45,45,1,'°'],['x','Position',-6.4,6.4,0.05,'m'],['length','Length',1,4.8,0.1,'m'],
  ].map(([field,label,min,max,step,unit])=>`<div class="control"><label for="control-${field}">${label}</label><output id="value-${field}">${p[field].toFixed(field==='angle'?0:2)} ${unit}</output><input id="control-${field}" type="range" data-field="${field}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${p[field]}" aria-label="${label} of ${escape(p.name)}" ${busy?'disabled':''}/></div>`).join('')}<div class="inspector-note">One change can make all the difference.</div></div>`:'<p class="muted">No parts in this project. An agent can add one, or start fresh.</p>'; }
function journalMarkup(attempts,general) {
  if(!attempts.length)return '<div class="empty-journal"><span class="empty-orbit">◎</span><div>Your first experiment is waiting.<small>'+ (general?'Create a scene, render a view, or add physics and run it.':'Run the marble, watch what happens, then change one thing.')+'</small></div></div>';
  return attempts.map((r,i)=>r.mode==='scene'?sceneAttempt(r,attempts.length-i):`<button class="attempt-card ${r.success?'success':''}" data-run="${escape(r.id)}" aria-label="Replay run ${attempts.length-i}: ${r.success?'Success':r.status}"><span class="attempt-number">${String(attempts.length-i).padStart(2,'0')}</span><span class="attempt-body"><strong>${r.success?'In the cup.':r.status==='fell-short'?'A little short.':r.status==='timeout'?'Not quite moving.':'Missed the landing.'}</strong><small>${r.duration.toFixed(2)} s · ${r.success?'0.4 s settled':`${r.closest.toFixed(2)} m closest`}</small><em>${r.label?escape(r.label):`Revision ${r.revision} · measured physics`}</em></span><span class="attempt-play">▷</span></button>`).join('');
}
function render(){
  if(!state)return;
  nativeWorkspace?.show(state).catch(error=>toast(error.message));
  if(state.project.version===3){view?.setActive(false);$('#save').disabled=false;$('#new-project').disabled=!remote;return;}
  view?.setActive(true);
  const displayed=player?.run?.project||state.project, general=displayed.version===2;
  renderWorkspaceHeader(displayed);
  $('#scene-toolbar').hidden=!general;
  if(!displayed.parts.some(p=>p.id===selected))selected=displayed.parts[0]?.id||null;
  $('#parts').innerHTML=partRows(displayed,selected);
  $('#build-tab span').textContent=String(displayed.parts.length).padStart(2,'0');
  const p=displayed.parts.find(p=>p.id===selected);
  $('#inspector').innerHTML=inspectorMarkup(p,general);
  $('#undo').disabled=busy||!state.canUndo;$('#redo').disabled=busy||!state.canRedo;
  const notes=state.feedback.filter(n=>!n.resolved);
  $('#note-count').textContent=notes.length;
  $('#feedback-target').textContent=p?`Selected: ${p.name} · revision ${displayed.revision}`:`General note · revision ${displayed.revision}`;
  $('#notes').innerHTML=notes.map(n=>`<article class="note"><small>${escape(n.targetId||'Scene')} · revision ${n.revision}${n.time!=null?' · '+n.time.toFixed(2)+' s':''}</small><p>${escape(n.text)}</p>${n.screenshot?`<img src="${n.screenshot}" alt="Saved view for this feedback"/>`:''}<button data-resolve="${escape(n.id)}">Mark addressed ✓</button></article>`).join('');
  $('#attempt-count').textContent=`${state.attempts.length} ${state.attempts.length===1?'run':'runs'}`;
  $('#attempts').innerHTML=journalMarkup(state.attempts,general);
  if(view&&!busy&&!player?.run){view.setProject(state.project);view.select(selected);}
  updateControls();
  updateReplay();
}
function updateControls(){
  if(state?.project.version===3)return;
  const historical=!!player?.run&&player.run.revision!==state?.project.revision;
  $('#run').disabled=busy||historical;$('#save').disabled=busy||historical;$('#open-project').disabled=busy;$('#reset-layout').disabled=busy;
  $('#solve').disabled=(busy&&!solving)||historical;$('#solve span').textContent=solving?'Stop tuning':'Auto-tune';
  $('#reset-run').disabled=solving;
  $('#solve').hidden=state?.project.version===2;
  for(const id of ['new-scene','demo-scene','marble-example','add-object'])$('#'+id).disabled=busy||historical;
  document.querySelectorAll('[data-setting], #remove-object').forEach(e=>e.disabled=busy||historical);
  document.querySelectorAll('#inspector input, #inspector select, #inspector textarea').forEach(e=>e.disabled=busy||historical);
  $('#undo').disabled=busy||historical||!state?.canUndo;$('#redo').disabled=busy||historical||!state?.canRedo;
  if(player){$('#replay-toggle').disabled=solving;$('#replay-time').disabled=solving;$('#replay-back').disabled=solving;$('#replay-next').disabled=solving;$('#return-edit').disabled=solving;$('#compare-run').disabled=solving;}
}
async function edit(operations,requestId=uid()){
  if(!solving)resetReplay();
  const result=await api('edit',{operations,expectedRevision:state.project.revision,requestId});
  await refresh();return result;
}
function resetReplay(){
  if(state.project.version===3){player?.clear();comparisonRun=null;view.setComparison(null);busy=false;lastRun=null;return;}
  player?.clear();comparisonRun=null;view.setComparison(null);busy=false;view.setProject(state.project);view.reset();view.select(selected);lastRun=null;
  $('#outcome').className='outcome';updateControls();
}
function updateReplay() {
  if(!player)return;
  const run=player.run;$('#replay-lab').hidden=!run;
  if(!run)return;
  $('#replay-revision').textContent=`recorded r${run.revision} · saved r${state.project.revision}${run.revision!==state.project.revision?' · read-only history':''}`;
  $('#replay-time').max=run.duration;$('#replay-time').value=player.time;
  $('#replay-clock').textContent=`${player.time.toFixed(2)} / ${run.duration.toFixed(2)} s`;
  $('#replay-toggle').textContent=player.playing?'Pause':player.time>=run.duration?'Replay':'Resume';
  $('#replay-toggle').setAttribute('aria-label',player.playing?'Pause replay':'Resume replay');
  $('#replay-state').textContent=player.playing?'Playing recorded physics':player.time>=run.duration?`Ended · ${run.status}`:'Paused · recorded physics';

  document.querySelectorAll('[data-contact-time]').forEach(e=>e.classList.toggle('active',Math.abs(Number(e.dataset.contactTime)-player.time)<.017));
}
function loadReplayUI(run) {
  $('#replay-contacts').innerHTML=run.contacts.map(c=>`<button data-contact-time="${c.time}" data-contact-part="${escape(c.part)}" title="First contact: ${escape(c.surface||c.part)}">${escape(run.project.parts.find(p=>p.id===c.part)?.name||c.part)}${c.surface?.startsWith('rail')?' · rail':''} <span>${c.time.toFixed(2)} s</span></button>`).join('');
  $('#compare-run').innerHTML='<option value="">No ghost</option>'+state.attempts.filter(r=>r.id!==run.id&&r.mode===run.mode).map(r=>`<option value="${escape(r.id)}">r${r.revision} · ${escape(r.status)} · ${r.duration.toFixed(2)} s</option>`).join('');
  comparisonRun=null;view.setComparison(null);$('#compare-summary').textContent='Select a previous attempt to overlay its recorded path.';
  document.querySelectorAll('[data-run]').forEach(e=>e.classList.toggle('selected',e.dataset.run===run.id));
}
function showReplayFrame(frame,run) {
  view.setFrame(frame);view.setMotion(frame);view.setTrail(run.frames.slice(0,frame.index+1));
  if(frame.objects){const objects=Object.entries(frame.objects);$('#replay-position').textContent=objects.map(([id,p])=>`${id}: y ${p.y.toFixed(2)} m`).join(' · ');$('#replay-speed').textContent=`${objects.length} dynamic bodies`;}else {
  $('#replay-position').textContent=`x ${frame.x.toFixed(2)} · y ${frame.y.toFixed(2)} · z ${frame.z.toFixed(2)} m`;
  $('#replay-speed').textContent=`${frame.speed.toFixed(2)} m/s`;}
  if(comparisonRun)view.setComparisonFrame(sampleRun(comparisonRun,Math.min(frame.t,comparisonRun.duration)));
}
async function play(run,speedOverride){
  lastRun=run;cacheRun(run);view.setProject(run.project);view.select(selected);loadReplayUI(run);player.load(run);
  outcome(solving?'Testing the next idea…':`Recorded run r${run.revision}. Pause to inspect a moment.`);
  return player.play(speedOverride||Number($('#speed').value));
}
async function runOnce(label){
  const run=await api('run',{expectedRevision:state.project.revision,capture:false});
  if(label)run.label=label;cacheRun(run);
  await refresh();if(label){const summary=state.attempts.find(r=>r.id===run.id);if(summary)summary.label=label;render();}
  return run;
}
async function runHuman(){
  if(state?.project.version===3){document.querySelector('#native-pause')?.click();return;}
  if(busy)return;busy=true;updateControls();
  try{const run=await runOnce();await play(run);}catch(error){toast(error.message);}finally{busy=false;updateControls();}
}
async function solve(){
  if(state.project.version===2){toast('Auto-tune belongs to the marble example. Scene simulations have no success criterion.');return;}
  if(solving){stopSolver=true;$('#solver-note').textContent='Stopping after this attempt…';player.cancel();return;}
  if(busy)return;
  solving=true;busy=true;stopSolver=false;updateControls();let bestProject,bestRun,ownRevision=state.project.revision;
  try{
    bestProject=clone(state.project);bestRun=await runOnce('Baseline · unchanged layout');ownRevision=bestRun.revision;
    await play(bestRun,2.5);
    let move=0;
    for(let attempt=0;attempt<12&&!bestRun.success&&!stopSolver;attempt++){
      if(state.project.revision!==ownRevision)throw new Error('Another editor changed the project. Tuning stopped without overwriting their work.');
      const suggestion=propose(bestProject,bestRun,move++);if(!suggestion)continue;
      const draft=clone(bestProject);for(const op of suggestion.operations)Object.assign(draft.parts.find(p=>p.id===op.id),op.changes);
      const applied=await edit(restoreOperations(state.project,draft));ownRevision=applied.revision;
      $('#solver-note').textContent=`Attempt ${attempt+1}/12 · ${suggestion.label}`;
      const candidate=await runOnce(suggestion.label);await play(candidate,2.5);
      if(score(candidate)>score(bestRun)){bestRun=candidate;bestProject=clone(candidate.project);move=0;}
      await sleep(180);
    }
    if(state.project.revision===ownRevision&&JSON.stringify(state.project.parts)!==JSON.stringify(bestProject.parts)){await edit(restoreOperations(state.project,bestProject));view.setProject(state.project);view.reset();}
    if(stopSolver){toast('Tuning stopped. Best measured layout retained.');outcome('Tuning stopped. Best measured layout retained.');}
    else if(bestRun.success){toast('Solved by local search. The target and gravity never changed.');outcome('✓ Better by one small change. Your marble made it.',true);}
    else toast('Search budget reached. Best measured layout retained; no success claimed.');
  }catch(error){toast(error.message);}
  finally{busy=false;solving=false;$('#solver-note').textContent='Auto-tune uses local search. No model or API key.';render();}
}
function download(name,value){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function showTab(notes){$('#build-panel').hidden=notes;$('#notes-panel').hidden=!notes;$('#build-tab').classList.toggle('active',!notes);$('#notes-tab').classList.toggle('active',notes);$('#build-tab').setAttribute('aria-selected',String(!notes));$('#notes-tab').setAttribute('aria-selected',String(notes));}
async function captureRequest(request){
  await prepareSceneAssets(request.project);
  const oldCamera=view.cameraState(),oldFrame=player?.run?sampleRun(player.run,player.time):null;
  const oldProject=clone(view.currentProject),oldMotion=view.velocityArrow.visible,oldPosition=view.marble.position.clone(),oldQuaternion=view.marble.quaternion.clone(),oldTrail=view.trailFrames||[];
  const images=[],metadata=[];
  try {
    view.setProject(request.project);await view.waitForAssets();
    if(request.run && request.time!==undefined){
      const frame=sampleRun(request.run,request.time);view.setFrame(frame);view.setMotion(frame);view.setTrail(request.view?.overlays?request.run.frames.slice(0,frame.index+1):[]);
      images.push(view.capture(request.view));metadata.push({...view.lastCapture,revision:request.revision,runId:request.run.id,time:frame.t,sampleMethod:frame.sampleMethod});
    } else if(request.run){
      for(const fraction of [.25,.65,1]){
        const index=Math.min(request.run.frames.length-1,Math.floor((request.run.frames.length-1)*fraction));
        const frame=request.run.frames[index];view.setFrame(frame);view.setMotion(frame);view.setTrail(request.view?.overlays?request.run.frames.slice(0,index+1):[]);
        images.push(view.capture(request.view));metadata.push({...view.lastCapture,revision:request.revision,runId:request.run.id,time:frame.t});
      }
    } else {view.reset();images.push(view.capture(request.view));metadata.push({...view.lastCapture,revision:request.revision,runId:null,time:0});}
  } finally {
    // Capturing never moves the human's camera or changes their project/replay.
    view.setProject(oldProject);view.marble.position.copy(oldPosition);view.marble.quaternion.copy(oldQuaternion);view.setTrail(oldTrail);view.select(selected);if(player?.run)view.setMotion(sampleRun(player.run,player.time));view.velocityArrow.visible=oldMotion;if(oldFrame)view.setFrame(oldFrame);view.restoreCamera(oldCamera);
  }
  await api(`capture/${request.id}`,{revision:request.revision,images,metadata});
}
function finishedRun(run) {
  const message=run.mode==='scene'?`${run.status==='rendered'?'Rendered scene':'Simulation complete'} · no challenge criterion`:run.success?'✓ A little momentum. A perfect landing.':`↗ ${run.status}. ${run.closest.toFixed(2)} m closest to the cup.`;
  outcome(message,run.success);if(run.success)successSound();
}
function handleCaptureEvent(event) {
  const request=JSON.parse(event.data);
  captureRequest(request).catch(()=>api(`capture/${request.id}`,{revision:request.revision,error:'The requested scene could not be rendered. Check embedded PNG assets.'}).catch(error=>toast(error.message)));
}
async function reportAssetStatus() {
  try{await view.waitForAssets();}catch(error){toast(error.message);}
}
async function init(){
  try{
    if(location.protocol==='file:')throw new Error('Offline workspace');
    const response=await fetch('./api/state',{signal:AbortSignal.timeout(1500)});if(response.ok){state=await response.json();remote=true;}
  }catch{}
  if(!remote){
    let saved;
    try{const raw=localStorage.getItem('kinetic-project-v1');if(raw)saved=JSON.parse(raw);local=new Workshop(saved||{project:initialScene()});if(saved?.feedback)local.feedback=saved.feedback.slice(0,30);}
    catch{local=new Workshop({project:initialScene()});savedError='The previous browser save was unreadable. It has not been overwritten.';}
    state=local.state();
  }
  $('#connection').innerHTML=`<i></i>${remote?'Local service connected':'Browser-only workspace'}`;
  $('#connection').classList.toggle('off',!remote);
  view=new WorkbenchView($('#viewport'),id=>{selected=id;render();view.select(id);});view.setProject(state.project.version===3?initialScene():state.project);view.select(selected);
  player=new ReplayPlayer({onFrame:showReplayFrame,onChange:updateReplay,onEnd:finishedRun});
  nativeWorkspace=new NativeWorkspace({api,getState:()=>state,refresh,toast});
  $('#new-project').disabled=!remote;
  $('#loading').remove();render();
  if(savedError)toast(savedError);
  if(remote){
    source=new EventSource('./api/events');
    source.addEventListener('state',event=>{const next=JSON.parse(event.data);const changed=next.project.revision!==state.project.revision;state=next;if(changed&&!solving&&player.run){resetReplay();toast('The saved layout changed. Returned to editing; older runs remain in the journal.');}if(!busy||changed)render();});
    source.addEventListener('run',event=>{const run=JSON.parse(event.data);cacheRun(run);if(!busy){busy=true;updateControls();play(run).catch(error=>toast(error.message)).finally(()=>{busy=false;render();});}});
    source.addEventListener('capture',handleCaptureEvent);
    source.addEventListener('native',event=>nativeWorkspace.handle(JSON.parse(event.data)).catch(error=>toast(error.message)));
    source.onerror=()=>{$('#connection').innerHTML='<i></i>Service reconnecting';};
    source.onopen=()=>{$('#connection').innerHTML='<i></i>Local service connected';refresh().catch(()=>{});};
    config=await fetch('./api/config').then(r=>r.json());
  }else config={mcpServers:{kinetic:{command:'node',args:['/absolute/path/to/kinetic/server/mcp.js']}}};
  $('#agent-config').textContent=JSON.stringify(config,null,2);
  window.kinetic={getState:()=>clone(state),run:runHuman,solve,select:id=>{selected=id;render();},view,api,refresh,replay:player};
  await reportAssetStatus();document.body.dataset.ready='true';
}
$('#parts').addEventListener('click',event=>{const button=event.target.closest('[data-part]');if(button){selected=button.dataset.part;render();view.select(selected);}});
$('#new-project').onclick=()=>$('#project-dialog').showModal();
$('#project-cancel').onclick=()=>$('#project-dialog').close();
$('#project-create-form').onsubmit=async event=>{event.preventDefault();const button=$('#project-create');button.disabled=true;try{await api('project/create',{name:$('#project-name').value,expectedRevision:state.project.revision});$('#project-dialog').close();await refresh();}catch(error){toast(error.message);}finally{button.disabled=false;}};
function inspectorValue(input) {
  if(input.dataset.json)return JSON.parse(input.value);
  return input.dataset.string?input.value:Number(input.value);
}
$('#inspector').addEventListener('input',event=>{
  const field=event.target.dataset.field;if(!field||busy||event.target.dataset.json)return;
  try{
    if(player.run)resetReplay();const value=inspectorValue(event.target),output=$(`#value-${field}`);
    if(output)output.textContent=`${value.toFixed(field==='angle'?0:2)} ${event.target.dataset.unit}`;
    const preview=clone(state.project);preview.parts.find(p=>p.id===selected)[field]=value;view.setProject(validateProject(preview));view.select(selected);
  }catch{}
});
$('#inspector').addEventListener('change',async event=>{
  const field=event.target.dataset.field;if(!field||busy)return;
  try{await edit([{type:'update',id:selected,changes:{[field]:inspectorValue(event.target)}}]);view.reset();$('#outcome').className='outcome';}
  catch(error){toast(error.message);await refresh();}
});
$('#inspector').addEventListener('click',async event=>{if(event.target.id==='remove-object'&&!busy){try{await edit([{type:'remove',id:selected}]);}catch(e){toast(e.message);}}});
for(const [id,template] of [['new-scene','scene'],['demo-scene','demo'],['marble-example','marble']])$('#'+id).onclick=async()=>{
  try{await edit([{type:'workspace',template}]);view.setCamera('iso');view.reset();toast('Workspace opened. Undo restores the previous project.');}catch(e){toast(e.message);}
};
async function addSceneObject(data) {
  const kind=$('#object-kind').value,part=newScenePart(kind,kind+'-'+uid().slice(0,8));if(data)part.data=data;
  await edit([{type:'add',part}]);selected=part.id;render();view.setCamera('iso');await view.waitForAssets();
}
$('#add-object').onclick=async()=>{if($('#object-kind').value==='image'){$('#image-file').click();return;}try{await addSceneObject();}catch(e){toast(e.message);}};
$('#image-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>131072)throw new Error('Use a PNG under 128 KiB.');const reader=new FileReader();const data=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});await addSceneObject(data);}catch(e){toast(e.message);}event.target.value='';
};
$('.challenge').addEventListener('change',async event=>{
  const field=event.target.dataset.setting;if(!field||busy)return;
  const value=event.target.value,op={type:'configure'};
  if(field==='title')op.title=value;
  else op.settings=field==='gravity'?{gravity:[state.project.settings.gravity[0],Number(value),state.project.settings.gravity[2]]}:{[field]:field==='duration'?Number(value):value};
  try{await edit([op]);}catch(e){toast(e.message);await refresh();}
});
$('#evidence-mode').onclick=()=>{view.setDiagnostics(!view.diagnosticsEnabled);$('#evidence-mode').setAttribute('aria-pressed',String(view.diagnosticsEnabled));};
$('#run').onclick=runHuman;$('#solve').onclick=solve;$('#reset-run').onclick=resetReplay;
$('#undo').onclick=async()=>{try{await api('undo',{expectedRevision:state.project.revision});await refresh();resetReplay();}catch(e){toast(e.message);}};
$('#redo').onclick=async()=>{try{await api('redo',{expectedRevision:state.project.revision});await refresh();resetReplay();}catch(e){toast(e.message);}};
$('#sound').onclick=()=>{muted=!muted;$('.sound-off').hidden=!muted;$('#sound').setAttribute('aria-label',muted?'Enable sound':'Mute sound');if(!muted)tone(523.25,0.15,0.03);};
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>{view.setCamera(b.dataset.camera);document.querySelectorAll('[data-camera]').forEach(e=>e.classList.toggle('active',e===b));});
$('#save').onclick=()=>{download('kinetic-project.json',state.project);toast('Project downloaded. Layout and object IDs preserved.');};
$('#reset-layout').onclick=async()=>{if(confirm('Start fresh in this workspace? Your current project can still be recovered with Undo.')){await api('reset',{expectedRevision:state.project.revision});await refresh();resetReplay();toast('A fresh start. Your previous layout is in Undo.');}};
$('#open-project').onclick=()=>$('#import').click();
$('#import').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>1000000)throw new Error('Project file is too large.');const project=validateProject(JSON.parse(await file.text()));await api('import',{project,expectedRevision:state.project.revision});await refresh();resetReplay();toast('Project opened.');}catch(error){toast(`Could not open project: ${error.message}`);}event.target.value='';};
$('#build-tab').onclick=()=>showTab(false);$('#notes-tab').onclick=()=>showTab(true);
$('#send-feedback').onclick=async()=>{try{await view.waitForAssets();const text=$('#feedback-text').value;await api('feedback',{text,targetId:selected,camera:view.cameraState(),screenshot:view.capture(),runId:player.run?.id||null,time:player.run?player.time:null,expectedRevision:view.currentProject.revision});$('#feedback-text').value='';await refresh();toast('Feedback saved. Ask your agent to run kinetic feedback list.');}catch(error){toast(error.message);}};
$('#notes').onclick=async event=>{const b=event.target.closest('[data-resolve]');if(b){await api('feedback/resolve',{ids:[b.dataset.resolve]});await refresh();}};
$('#attempts').onclick=async event=>{
  const b=event.target.closest('[data-run]');if(!b||busy)return;busy=true;updateControls();
  try{const run=runCache.get(b.dataset.run)||await api(`runs/${b.dataset.run}`);await play(run);}
  catch(error){toast(error.message);}finally{busy=false;render();}
};
$('#return-edit').onclick=()=>{resetReplay();render();};
$('#replay-toggle').onclick=async()=>{
  if(!player.run||solving)return;
  if(player.playing){seekReplay(player.time);return;}
  if(player.time>=player.run.duration)player.seek(0);
  outcome(`Replaying r${player.run.revision} · recorded outcome: ${player.run.status}`);
  busy=true;updateControls();try{await player.play(Number($('#speed').value));}finally{busy=false;updateControls();}
};
function seekReplay(time) {
  if(!player.run||solving)return;
  player.pause();player.seek(time);
  outcome(`Paused at ${player.time.toFixed(2)} s · recorded outcome: ${player.run.status}`);
}
// Read the requested value before pause() notifies the UI and synchronizes the slider.
$('#replay-time').oninput=event=>seekReplay(Number(event.target.value));
function stepReplay(direction){
  if(!player.run||solving)return;player.pause();
  const frames=player.run.frames,now=player.time;
  const frame=direction>0?frames.find(f=>f.t>now+.00001):frames.findLast(f=>f.t<now-.00001);
  if(frame)seekReplay(frame.t);
}
$('#replay-back').onclick=()=>stepReplay(-1);$('#replay-next').onclick=()=>stepReplay(1);
$('#replay-contacts').onclick=event=>{const b=event.target.closest('[data-contact-time]');if(!b||solving)return;seekReplay(Number(b.dataset.contactTime));if(player.run.project.parts.some(p=>p.id===b.dataset.contactPart)){selected=b.dataset.contactPart;render();view.select(selected);}};
$('#compare-run').onchange=async event=>{
  const id=event.target.value,active=player.run;if(!active)return;
  try{
    const baseline=id?(runCache.get(id)||await api(`runs/${id}`)):null;
    if(player.run!==active)return;comparisonRun=baseline;view.setComparison(baseline);
    if(!baseline){$('#compare-summary').textContent='Select a previous attempt to overlay its recorded path.';return;}
    const delta=compareRuns(baseline,active),fields=delta.changes.flatMap(c=>Object.entries(c.fields||{}).map(([k,v])=>`${c.id}.${k}: ${v.before} → ${v.after}`));
    $('#compare-summary').textContent=`Blue ghost = r${baseline.revision}. ${fields.join('; ')||'Same part layout'}. ${delta.closestDelta===null?'No success criterion':`Closest-distance change ${delta.closestDelta>0?'+':''}${delta.closestDelta.toFixed(2)} m`}. Ghost stops at its recorded end.`;
    showReplayFrame(sampleRun(active,player.time),active);
  }catch(error){toast(error.message);}
};
$('#connect').onclick=()=>$('#agent-dialog').showModal();$('#close-dialog').onclick=()=>$('#agent-dialog').close();
$('#copy-config').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(config,null,2));toast('MCP configuration copied.');}catch{toast('Clipboard unavailable. Select and copy the configuration above.');}};
document.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||$('#agent-dialog').open)return;if(event.code==='Space'){event.preventDefault();runHuman();}if(event.code==='KeyR'&&!busy)resetReplay();if((event.ctrlKey||event.metaKey)&&event.key==='z'&&!busy){event.preventDefault();$('#undo').click();}});
window.addEventListener('beforeunload',()=>{source?.close();player?.cancel();view?.dispose();});
init().catch(error=>{console.error(error);$('#loading').innerHTML=`<div style="padding:24px;max-width:370px;line-height:1.8">The workshop could not start.<br>${escape(error.message)}<br>Use a WebGL2-capable browser and reload.</div>`;});
