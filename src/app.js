import { Workshop, initialProject, clone, validateProject, uid, projectStuff, isAuthorable } from './model.js';
import { simulate } from './physics.js';
import { propose, score, restoreOperations } from './solver.js';
import { WorkbenchView } from './view.js';
import { ReplayPlayer } from './replay-player.js';
import { sampleRun, compareRuns } from './replay.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,selected='bridge',busy=false,solving=false,stopSolver=false,remote=false,local,view,lastRun=null,muted=true,audio=null;
let source=null, config=null, savedError=null, player=null, comparisonRun=null;
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
  else if(path==='reset'){local.check(body.expectedRevision);local.commit(initialProject());result=local.state();}
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
function render(){
  if(!state)return;
  const displayed=player?.run?.project||state.project;
  const stuff=projectStuff(displayed);
  if(!stuff.some(p=>p.id===selected))selected=stuff[0]?.id||null;
  $('#parts').innerHTML=stuff.map((p,i)=>`<button class="part ${p.id===selected?'active':''}" data-part="${escape(p.id)}" aria-pressed="${p.id===selected}"><span class="part-icon">${partIcon(i)}</span><span class="part-name">${escape(p.name)}<small>${escape(p.kind)}${p.length!=null?` · ${p.length.toFixed(1)} m`:''}</small></span><span>${String(i+1).padStart(2,'0')}</span></button>`).join('');
  $('#build-tab span').textContent=String(stuff.length).padStart(2,'0');
  const p=stuff.find(p=>p.id===selected);
  $('#inspector').innerHTML=p&&isAuthorable(p)?`<div class="inspector">${[
    ['y','Height',0.7,4.2,0.05,'m'],['angle','Pitch',-45,45,1,'°'],['x','Position',-6.4,6.4,0.05,'m'],['length','Length',1,4.8,0.1,'m'],
  ].map(([field,label,min,max,step,unit])=>`<div class="control"><label for="control-${field}">${label}</label><output id="value-${field}">${p[field].toFixed(field==='angle'?0:2)} ${unit}</output><input id="control-${field}" type="range" data-field="${field}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${p[field]}" aria-label="${label} of ${escape(p.name)}" ${busy?'disabled':''}/></div>`).join('')}<div class="inspector-note">One change can make all the difference.</div></div>`:p?`<p class="muted">${escape(p.name)} · ${escape(p.kind)} · ${escape(p.id)}</p>`:'<p class="muted">No objects in this project. An agent can add one, or start fresh.</p>';
  $('#undo').disabled=busy||!state.canUndo;$('#redo').disabled=busy||!state.canRedo;
  const notes=state.feedback.filter(n=>!n.resolved);
  $('#note-count').textContent=notes.length;
  $('#feedback-target').textContent=p?`Selected: ${p.name} · revision ${displayed.revision}`:`General note · revision ${displayed.revision}`;
  $('#notes').innerHTML=notes.map(n=>`<article class="note"><small>${escape(n.targetId||'Scene')} · revision ${n.revision}${n.time!=null?' · '+n.time.toFixed(2)+' s':''}</small><p>${escape(n.text)}</p>${n.screenshot?`<img src="${n.screenshot}" alt="Saved view for this feedback"/>`:''}<button data-resolve="${escape(n.id)}">Mark addressed ✓</button></article>`).join('');
  $('#attempt-count').textContent=`${state.attempts.length} ${state.attempts.length===1?'run':'runs'}`;
  if(state.attempts.length)$('#attempts').innerHTML=state.attempts.map((r,i)=>`<button class="attempt-card ${r.success?'success':''}" data-run="${escape(r.id)}" aria-label="Replay run ${state.attempts.length-i}: ${r.success===true?'Success':r.status}"><span class="attempt-number">${String(state.attempts.length-i).padStart(2,'0')}</span><span class="attempt-body"><strong>${r.success===true?'In the cup.':r.success===null?'Completed.':r.status==='fell-short'?'A little short.':r.status==='timeout'?'Not quite moving.':'Missed the landing.'}</strong><small>${r.duration.toFixed(2)} s · ${r.success===true?'0.4 s settled':r.closest==null?'unmeasured':`${r.closest.toFixed(2)} m closest`}</small><em>${r.label?escape(r.label):`Revision ${r.revision} · measured physics`}</em></span><span class="attempt-play">▷</span></button>`).join('');
  if(view&&!busy&&!player?.run){view.setProject(state.project);view.select(selected);}
  updateControls();
  updateReplay();
}
function updateControls(){
  const historical=!!player?.run&&player.run.revision!==state?.project.revision;
  $('#run').disabled=busy||historical;$('#save').disabled=busy||historical;$('#open-project').disabled=busy;$('#reset-layout').disabled=busy;
  $('#solve').disabled=(busy&&!solving)||historical;$('#solve span').textContent=solving?'Stop tuning':'Auto-tune';
  $('#reset-run').disabled=solving;
  document.querySelectorAll('#inspector input').forEach(e=>e.disabled=busy||historical);
  $('#undo').disabled=busy||historical||!state?.canUndo;$('#redo').disabled=busy||historical||!state?.canRedo;
  if(player){$('#replay-toggle').disabled=solving;$('#replay-time').disabled=solving;$('#replay-back').disabled=solving;$('#replay-next').disabled=solving;$('#return-edit').disabled=solving;$('#compare-run').disabled=solving;}
}
async function edit(operations,requestId=uid()){
  if(!solving)resetReplay();
  const result=await api('edit',{operations,expectedRevision:state.project.revision,requestId});
  await refresh();return result;
}
function resetReplay(){
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
  $('#compare-run').innerHTML='<option value="">No ghost</option>'+state.attempts.filter(r=>r.id!==run.id).map(r=>`<option value="${escape(r.id)}">r${r.revision} · ${escape(r.status)} · ${r.duration.toFixed(2)} s</option>`).join('');
  comparisonRun=null;view.setComparison(null);$('#compare-summary').textContent='Select a previous attempt to overlay its recorded path.';
  document.querySelectorAll('[data-run]').forEach(e=>e.classList.toggle('selected',e.dataset.run===run.id));
}
function showReplayFrame(frame,run) {
  view.setFrame(frame);view.setMotion(frame);view.setTrail(run.frames.slice(0,frame.index+1));
  $('#replay-position').textContent=`x ${frame.x.toFixed(2)} · y ${frame.y.toFixed(2)} · z ${frame.z.toFixed(2)} m`;
  $('#replay-speed').textContent=`${frame.speed.toFixed(2)} m/s`;
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
  if(busy)return;busy=true;updateControls();
  try{const run=await runOnce();await play(run);}catch(error){toast(error.message);}finally{busy=false;updateControls();}
}
async function solve(){
  if(solving){stopSolver=true;$('#solver-note').textContent='Stopping after this attempt…';player.cancel();return;}
  if(busy)return;
  solving=true;busy=true;stopSolver=false;updateControls();let bestProject,bestRun,ownRevision=state.project.revision;
  try{
    bestProject=clone(state.project);bestRun=await runOnce('Baseline · unchanged layout');ownRevision=bestRun.revision;
    await play(bestRun,2.5);
    if(bestRun.success===null){
      toast('No judge; auto-tune skipped.');outcome('No judge; auto-tune skipped.');
    }else{
      let move=0;
      for(let attempt=0;attempt<12&&bestRun.success===false&&!stopSolver;attempt++){
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
    }
  }catch(error){toast(error.message);}
  finally{busy=false;solving=false;$('#solver-note').textContent='Auto-tune uses local search. No model or API key.';render();}
}
function download(name,value){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function showTab(notes){$('#build-panel').hidden=notes;$('#notes-panel').hidden=!notes;$('#build-tab').classList.toggle('active',!notes);$('#notes-tab').classList.toggle('active',notes);$('#build-tab').setAttribute('aria-selected',String(!notes));$('#notes-tab').setAttribute('aria-selected',String(notes));}
async function captureRequest(request){
  const oldProject=clone(view.currentProject),oldMotion=view.velocityArrow.visible,oldPosition=view.marble?.position.clone(),oldQuaternion=view.marble?.quaternion.clone(),oldTrail=view.trailFrames||[];
  const images=[],metadata=[];
  try {
    view.setProject(request.project);
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
    view.setProject(oldProject);if(view.marble&&oldPosition){view.marble.position.copy(oldPosition);view.marble.quaternion.copy(oldQuaternion);}view.setTrail(oldTrail);view.select(selected);if(player?.run)view.setMotion(sampleRun(player.run,player.time));view.velocityArrow.visible=oldMotion;
  }
  await api(`capture/${request.id}`,{revision:request.revision,images,metadata});
}
async function init(){
  try{
    if(location.protocol==='file:')throw new Error('Offline workspace');
    const response=await fetch('./api/state',{signal:AbortSignal.timeout(1500)});if(response.ok){state=await response.json();remote=true;}
  }catch{}
  if(!remote){
    let saved;
    try{const raw=localStorage.getItem('kinetic-project-v1');if(raw)saved=JSON.parse(raw);local=new Workshop(saved);if(saved?.feedback)local.feedback=saved.feedback.slice(0,30);}
    catch{local=new Workshop();savedError='The previous browser save was unreadable. It has not been overwritten.';}
    state=local.state();
  }
  $('#connection').innerHTML=`<i></i>${remote?'Local service connected':'Browser-only workspace'}`;
  $('#connection').classList.toggle('off',!remote);
  view=new WorkbenchView($('#viewport'),id=>{selected=id;render();view.select(id);});view.setProject(state.project);view.select(selected);
  player=new ReplayPlayer({onFrame:showReplayFrame,onChange:updateReplay,onEnd:run=>{
    outcome(run.success===true?'✓ A little momentum. A perfect landing.':run.success===null?`↗ ${run.status}.`:`↗ ${run.status}. ${run.closest==null?'Distance unmeasured.':`${run.closest.toFixed(2)} m closest to the cup.`}`,run.success===true);
    if(run.success)successSound();
  }});
  $('#loading').remove();render();
  if(savedError)toast(savedError);
  if(remote){
    source=new EventSource('./api/events');
    source.addEventListener('state',event=>{const next=JSON.parse(event.data);const changed=next.project.revision!==state.project.revision;state=next;if(changed&&!solving&&player.run){resetReplay();toast('The saved layout changed. Returned to editing; older runs remain in the journal.');}if(!busy||changed)render();});
    source.addEventListener('run',event=>{const run=JSON.parse(event.data);cacheRun(run);if(!busy){busy=true;updateControls();play(run).catch(error=>toast(error.message)).finally(()=>{busy=false;render();});}});
    source.addEventListener('capture',event=>captureRequest(JSON.parse(event.data)).catch(error=>console.warn('Capture unavailable:',error.message)));
    source.onerror=()=>{$('#connection').innerHTML='<i></i>Service reconnecting';};
    source.onopen=()=>{$('#connection').innerHTML='<i></i>Local service connected';refresh().catch(()=>{});};
    config=await fetch('./api/config').then(r=>r.json());
  }else config={mcpServers:{kinetic:{command:'node',args:['/absolute/path/to/kinetic/server/mcp.js']}}};
  $('#agent-config').textContent=JSON.stringify(config,null,2);
  window.kinetic={getState:()=>clone(state),run:runHuman,solve,select:id=>{selected=id;render();},view,api,refresh,replay:player};
  document.body.dataset.ready='true';
}
$('#parts').addEventListener('click',event=>{const button=event.target.closest('[data-part]');if(button){selected=button.dataset.part;render();view.select(selected);}});
$('#inspector').addEventListener('input',event=>{const field=event.target.dataset.field;if(!field||busy)return;if(player.run)resetReplay();const value=Number(event.target.value);$(`#value-${field}`).textContent=`${value.toFixed(field==='angle'?0:2)} ${event.target.dataset.unit}`;const preview=clone(state.project);const part=preview.parts.find(p=>p.id===selected);if(!part)return;part[field]=value;view.setProject(preview);view.select(selected);});
$('#inspector').addEventListener('change',async event=>{const field=event.target.dataset.field;if(!field||busy)return;try{await edit([{type:'update',id:selected,changes:{[field]:Number(event.target.value)}}]);view.reset();$('#outcome').className='outcome';}catch(error){toast(error.message);await refresh();}});
$('#evidence-mode').onclick=()=>{view.setDiagnostics(!view.diagnosticsEnabled);$('#evidence-mode').setAttribute('aria-pressed',String(view.diagnosticsEnabled));};
$('#run').onclick=runHuman;$('#solve').onclick=solve;$('#reset-run').onclick=resetReplay;
$('#undo').onclick=async()=>{try{await api('undo',{expectedRevision:state.project.revision});await refresh();resetReplay();}catch(e){toast(e.message);}};
$('#redo').onclick=async()=>{try{await api('redo',{expectedRevision:state.project.revision});await refresh();resetReplay();}catch(e){toast(e.message);}};
$('#sound').onclick=()=>{muted=!muted;$('.sound-off').hidden=!muted;$('#sound').setAttribute('aria-label',muted?'Enable sound':'Mute sound');if(!muted)tone(523.25,0.15,0.03);};
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>{view.setCamera(b.dataset.camera);document.querySelectorAll('[data-camera]').forEach(e=>e.classList.toggle('active',e===b));});
$('#save').onclick=()=>{download('kinetic-project.json',state.project);toast('Project downloaded. Layout and object IDs preserved.');};
$('#reset-layout').onclick=async()=>{if(confirm('Start again from the original layout? Your current layout can still be recovered with Undo.')){await api('reset',{expectedRevision:state.project.revision});await refresh();resetReplay();toast('A fresh start. Your previous layout is in Undo.');}};
$('#open-project').onclick=()=>$('#import').click();
$('#import').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>100000)throw new Error('Project file is too large.');const project=validateProject(JSON.parse(await file.text()));await api('import',{project,expectedRevision:state.project.revision});await refresh();resetReplay();toast('Project opened.');}catch(error){toast(`Could not open project: ${error.message}`);}event.target.value='';};
$('#build-tab').onclick=()=>showTab(false);$('#notes-tab').onclick=()=>showTab(true);
$('#send-feedback').onclick=async()=>{try{const text=$('#feedback-text').value;await api('feedback',{text,targetId:selected,camera:view.cameraState(),screenshot:view.capture(),runId:player.run?.id||null,time:player.run?player.time:null,expectedRevision:view.currentProject.revision});$('#feedback-text').value='';await refresh();toast('Feedback saved. Ask your agent to run kinetic feedback list.');}catch(error){toast(error.message);}};
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
$('#replay-contacts').onclick=event=>{const b=event.target.closest('[data-contact-time]');if(!b||solving)return;seekReplay(Number(b.dataset.contactTime));if(projectStuff(player.run.project).some(p=>p.id===b.dataset.contactPart)){selected=b.dataset.contactPart;render();view.select(selected);}};
$('#compare-run').onchange=async event=>{
  const id=event.target.value,active=player.run;if(!active)return;
  try{
    const baseline=id?(runCache.get(id)||await api(`runs/${id}`)):null;
    if(player.run!==active)return;comparisonRun=baseline;view.setComparison(baseline);
    if(!baseline){$('#compare-summary').textContent='Select a previous attempt to overlay its recorded path.';return;}
    const delta=compareRuns(baseline,active),fields=delta.changes.flatMap(c=>Object.entries(c.fields||{}).map(([k,v])=>`${c.id}.${k}: ${v.before} → ${v.after}`));
    $('#compare-summary').textContent=`Blue ghost = r${baseline.revision}. ${fields.join('; ')||'Same part layout'}. Closest-distance change ${delta.closestDelta==null?'n/a':`${delta.closestDelta>0?'+':''}${delta.closestDelta.toFixed(2)} m`}. Ghost stops at its recorded end.`;
    showReplayFrame(sampleRun(active,player.time),active);
  }catch(error){toast(error.message);}
};
$('#connect').onclick=()=>$('#agent-dialog').showModal();$('#close-dialog').onclick=()=>$('#agent-dialog').close();
$('#copy-config').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(config,null,2));toast('MCP configuration copied.');}catch{toast('Clipboard unavailable. Select and copy the configuration above.');}};
document.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||$('#agent-dialog').open)return;if(event.code==='Space'){event.preventDefault();runHuman();}if(event.code==='KeyR'&&!busy)resetReplay();if((event.ctrlKey||event.metaKey)&&event.key==='z'&&!busy){event.preventDefault();$('#undo').click();}});
window.addEventListener('beforeunload',()=>{source?.close();player?.cancel();view?.dispose();});
init().catch(error=>{console.error(error);$('#loading').innerHTML=`<div style="padding:24px;max-width:370px;line-height:1.8">The workshop could not start.<br>${escape(error.message)}<br>Use a WebGL2-capable browser and reload.</div>`;});
