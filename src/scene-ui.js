import { SCENE_LIMITS } from './scene-model.js';
export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sceneInspector(p) {
  if(!p)return '<p class="muted">Start with a shape, a label, or a data plot. Every object is accessible to your agent.</p>';
  const dimensions=p.kind==='sphere'?['radius']:p.kind==='cylinder'?['radius','height']:['line','arrow','mesh'].includes(p.kind)?[]:['width','height',...(p.kind==='box'?['depth']:[])];
  const fields=['x','y','z','angle','yaw','roll',...dimensions,'opacity'];
  const numberInputs=fields.map(field=>`<label>${field}<input type="number" data-field="${field}" min="${SCENE_LIMITS[field][0]}" max="${SCENE_LIMITS[field][1]}" step="${['angle','yaw','roll'].includes(field)?1:.1}" value="${p[field]}" aria-label="${field} of ${escapeHTML(p.name)}"/></label>`).join('');
  const payload=p.kind==='text'?`<label>Text<textarea data-field="text" data-string="true" maxlength="500" aria-label="Object text">${escapeHTML(p.text)}</textarea></label>`:p.points?`<label>Points (local coordinates)<textarea data-field="points" data-json="true" aria-label="Object points">${escapeHTML(JSON.stringify(p.points))}</textarea></label>`:p.kind==='mesh'?`<label>Vertices<textarea data-field="vertices" data-json="true" aria-label="Mesh vertices">${escapeHTML(JSON.stringify(p.vertices))}</textarea></label><label>Triangle indices<textarea data-field="indices" data-json="true" aria-label="Mesh indices">${escapeHTML(JSON.stringify(p.indices))}</textarea></label>`:'';
  const body=['box','sphere','cylinder'].includes(p.kind)?`<label>Physics<select data-field="body" data-string="true" aria-label="Physics body">${['none','fixed','dynamic'].map(v=>`<option ${p.body===v?'selected':''}>${v}</option>`).join('')}</select></label>`:'<p class="muted">Visual-only object</p>';
  return `<div class="scene-inspector"><label>Name<input data-field="name" data-string="true" value="${escapeHTML(p.name)}" maxlength="60" aria-label="Object name"/></label><label>Color<input type="color" data-field="color" data-string="true" value="${p.color}" aria-label="Object color"/></label><div class="scene-numbers">${numberInputs}</div>${payload}${body}<button id="remove-object" class="text-button">Remove object</button><p class="muted">Metres · Y up · rotations in degrees. Edits are saved with Undo.</p></div>`;
}
export function newScenePart(kind,id) {
  const part={kind,id,name:kind[0].toUpperCase()+kind.slice(1),y:1};
  if(kind==='text')Object.assign(part,{text:'Your idea here',width:4,height:1});
  if(kind==='line'||kind==='arrow')part.points=[[0,0,0],[2,1,0]];
  if(kind==='plot')Object.assign(part,{name:'Sample data',width:4,height:2.5,points:[[0,0],[1,1],[2,.5],[3,2]]});
  if(kind==='mesh')Object.assign(part,{vertices:[[0,0,0],[2,0,0],[1,2,0]],indices:[0,1,2]});
  return part;
}
export function sceneAttempt(r,index) {
  return `<button class="attempt-card" data-run="${escapeHTML(r.id)}" aria-label="Replay scene run ${index}"><span class="attempt-number">${index}</span><span class="attempt-body"><strong>${r.status==='rendered'?'Scene rendered':'Simulation recorded'}</strong><small>${r.duration.toFixed(2)} s · ${r.contacts.length} first contacts</small><em>Revision ${r.revision} · no success criterion</em></span><span>▷</span></button>`;
}
