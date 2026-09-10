import { escapeHTML as escape } from './scene-ui.js';

export class NativeFrame {
  constructor(host, url, revision, onSelection=()=>{}) {
    this.channel=crypto.randomUUID();this.revision=revision;this.pending=new Map();
    this.element=document.createElement('iframe');this.element.title='Native Three.js project';this.element.setAttribute('sandbox','allow-scripts');
    this.element.src=url+`#channel=${this.channel}&revision=${revision}`;this.element.className='native-frame';
    this.ready=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;this.timer=setTimeout(()=>reject(Error('Project preview did not become ready.')),18000);});
    this.listener=event=>{
      const data=event.data;if(event.source!==this.element.contentWindow||data?.channel!==this.channel||data.revision!==revision)return;
      if(data.kind==='ready'){clearTimeout(this.timer);this.resolve(data.inspection);}
      if(data.kind==='error'){this.error=data.error;clearTimeout(this.timer);this.reject(Error(data.error));for(const wait of this.pending.values()){clearTimeout(wait.timer);wait.reject(Error(data.error));}this.pending.clear();}
      if(data.kind==='selection')onSelection(data.targetId);
      if(data.kind==='result'){const wait=this.pending.get(data.id);if(wait){this.pending.delete(data.id);clearTimeout(wait.timer);data.error?wait.reject(Error(data.error)):wait.resolve(data);}}
    };
    addEventListener('message',this.listener);host.append(this.element);
  }
  async request(action,options={}) {
    await this.ready;if(this.error)throw Error(this.error);
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Preview request timed out.'));},12000);this.pending.set(id,{resolve,reject,timer});this.element.contentWindow.postMessage({channel:this.channel,kind:'request',id,action,options},'*');});
  }
  dispose(){clearTimeout(this.timer);this.reject(Error('Preview was replaced.'));for(const wait of this.pending.values()){clearTimeout(wait.timer);wait.reject(Error('Preview was replaced.'));}this.pending.clear();removeEventListener('message',this.listener);this.element.remove();}
}

export class NativeWorkspace {
  constructor({api,getState,refresh,toast}) {
    this.api=api;this.getState=getState;this.refresh=refresh;this.toast=toast;this.frame=null;this.revision=null;this.selected=null;
    this.host=document.createElement('section');this.host.id='native-workspace';this.host.hidden=true;
    this.host.innerHTML='<div class="native-stage"><div id="native-viewport"></div><div class="native-transport"><button id="native-pause" class="outline-button">Pause</button><span id="native-status" role="status">Opening project…</span></div></div><aside class="native-sidebar"><div class="eyebrow">YOUR PROJECT</div><h2 id="native-title"></h2><p id="native-directory" class="muted"></p><button id="native-apply" class="outline-button full">Apply source changes</button><p class="muted">Edit your project files, then apply a revision. A failed preview keeps the last working version.</p><div class="history-actions"><button id="native-undo" class="text-button">↶ Undo</button><button id="native-redo" class="text-button">Redo ↷</button></div><label for="native-selection">Feedback target</label><select id="native-selection"><option value="">Whole scene</option></select><textarea id="native-feedback" aria-label="Feedback on the native project" placeholder="What should change?" maxlength="1000"></textarea><button id="native-send" class="outline-button full">Save feedback</button><div id="native-notes"></div></aside>';
    document.querySelector('.workspace').after(this.host);
    this.host.querySelector('#native-apply').onclick=async()=>{try{await api('project/apply',{expectedRevision:getState().project.revision});await refresh();toast('Source revision applied.');}catch(e){toast(e.message);}};
    this.host.querySelector('#native-pause').onclick=async()=>{try{const result=await this.frame.request(this.paused?'resume':'pause');this.paused=result.inspection.paused;this.host.querySelector('#native-pause').textContent=this.paused?'Resume':'Pause';}catch(e){toast(e.message);}};
    for(const action of ['undo','redo'])this.host.querySelector('#native-'+action).onclick=async()=>{try{await api(action,{expectedRevision:getState().project.revision});await refresh();}catch(e){toast(e.message);}};
    this.host.querySelector('#native-selection').onchange=event=>{this.selected=event.target.value||null;};
    this.host.querySelector('#native-send').onclick=async()=>{
      try{const revision=this.revision,result=await this.frame.request('capture');await api('feedback',{text:this.host.querySelector('#native-feedback').value,targetId:this.selected,camera:{...result.inspection.camera,nativeTime:result.inspection.time,frame:result.inspection.frame},screenshot:result.image,expectedRevision:revision});this.host.querySelector('#native-feedback').value='';await refresh();toast('Feedback saved with this view and source revision.');}catch(e){toast(e.message);}
    };
  }
  async show(state) {
    const enabled=state.project.version===3;this.host.hidden=!enabled;
    document.querySelector('.workspace').hidden=enabled;document.querySelector('.run-journal').hidden=enabled;
    if(!enabled){this.frame?.dispose();this.frame=null;this.revision=null;return;}
    document.querySelector('.intro .eyebrow').textContent='THE OPEN WORKSHOP';
    document.querySelector('.intro>p').textContent='Build with Three.js. Direct the result.';
    this.host.querySelector('#native-title').textContent=state.project.title;
    this.host.querySelector('#native-directory').textContent=state.nativeProject?.directory||'Portable source snapshot';
    this.host.querySelector('#native-apply').disabled=!state.nativeProject?.directory;
    this.host.querySelector('#native-undo').disabled=!state.canUndo;this.host.querySelector('#native-redo').disabled=!state.canRedo;
    this.host.querySelector('#native-notes').innerHTML=state.feedback.filter(n=>!n.resolved).map(n=>`<article class="note"><small>${escape(n.targetId||'Scene')} · revision ${n.revision}</small><p>${escape(n.text)}</p>${n.screenshot?`<img src="${n.screenshot}" alt="Feedback reference"/>`:''}</article>`).join('');
    if(this.revision===state.project.revision)return;
    this.frame?.dispose();this.revision=state.project.revision;this.selected=null;this.paused=false;
    this.host.querySelector('#native-status').textContent='Opening project…';this.host.querySelector('#native-pause').textContent='Pause';
    if(!state.nativeProject?.preview){this.host.querySelector('#native-status').textContent='Open this source snapshot in the local service to preview it.';return;}
    const frame=new NativeFrame(this.host.querySelector('#native-viewport'),state.nativeProject.preview,this.revision,id=>{this.selected=id;this.host.querySelector('#native-selection').value=id||'';});this.frame=frame;
    try{const inspection=await frame.ready;if(this.frame!==frame)return;this.host.querySelector('#native-status').textContent=`Revision ${this.revision} · ${inspection.totalObjects} scene objects`;
      this.host.querySelector('#native-selection').innerHTML='<option value="">Whole scene</option>'+inspection.parts.map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('');
    }catch(e){if(this.frame===frame)this.host.querySelector('#native-status').textContent=e.message;}
  }
  async handle(request) {
    let frame=this.frame,temporary=null;
    const path=`/native/preview/${request.hash}/index.html`;
    if(!frame||frame.revision!==request.revision||!frame.element.src.includes(request.hash)){
      temporary=document.createElement('div');temporary.className='native-validation';document.body.append(temporary);frame=new NativeFrame(temporary,path,request.revision);
    }
    try{const result=await frame.request(request.action,request.options);if(frame===this.frame){this.paused=result.inspection.paused;this.host.querySelector('#native-pause').textContent=this.paused?'Resume':'Pause';}await this.api(`native/reply/${request.id}`,{revision:request.revision,inspection:result.inspection,...(result.image?{image:result.image,capture:result.capture}:{})});}
    catch(e){await this.api(`native/reply/${request.id}`,{revision:request.revision,error:e.message.slice(0,500)});}
    finally{if(temporary){frame.dispose();temporary.remove();}}
  }
}
