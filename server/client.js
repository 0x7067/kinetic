/** Shared local-service client and output contract for CLI and MCP. */
import { analyzeScene } from '../src/scene-analysis.js';
import { sceneDataSummary } from '../src/scene-model.js';
export class ClientError extends Error {
  constructor(code, message, help = '', usage = false) {
    super(message); this.code = code; this.help = help; this.usage = usage;
  }
}
export function localURL(input = 'http://127.0.0.1:4317') {
  let url;
  try { url = new URL(input); } catch { throw new ClientError('INVALID_URL', 'Expected a loopback HTTP URL.', '', true); }
  if (url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new ClientError('INVALID_URL', 'Use a loopback HTTP origin without a path, credentials, query, or fragment.', 'Example: --url http://127.0.0.1:4317', true);
  }
  return url;
}
export function summarize(value, full = false) {
  const { images = [], ...data } = value;
  if (data.feedback) data.feedback = data.feedback.map(({ screenshot, ...note }) => ({ ...note, screenshotAvailable: !!screenshot }));
  if (data.frames && !full) {
    const frames = data.frames;
    const indices = [...new Set([0, Math.floor(frames.length * .25), Math.floor(frames.length * .65), frames.length - 1])];
    data.frameCount = frames.length;
    data.trajectorySample = indices.filter(i => i >= 0).map(i => {
      if(frames[i].objects)return {t:frames[i].t,objects:frames[i].objects};
      const { t,x,y,z,speed } = frames[i];
      return { t,x,y,z,speed };
    });
    delete data.frames; delete data.project;
  }
  if(!full&&data.project?.version===2)data.project={...data.project,parts:data.project.parts.map(compactPart)};
  if(!full&&data.changes)data.changes=data.changes.map(c=>({...c,fields:c.fields&&Object.fromEntries(Object.entries(c.fields).map(([k,v])=>[k,['data','vertices','indices','points'].includes(k)?{before:payloadSummary(v.before),after:payloadSummary(v.after)}:v]))}));
  return { data, images };
}
function compactPart(p) {
  const {data,vertices,indices,...part}=p;
  if(part.points?.length>16)delete part.points;
  const summary=sceneDataSummary(p);if(summary)part.dataSummary=summary;
  return part;
}
function payloadSummary(value) {return typeof value==='string'?`[embedded data: ${value.length} characters]`:{items:value?.length??0};}
export function createClient(input) {
  const base = localURL(input);
  async function request(path, body) {
    let response;
    try {
      response = await fetch(new URL(path, base), {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'User-Agent':'OpenAI File Downloader, XaiImageApiFetch/1.0', ...(body === undefined ? {} : { 'Content-Type':'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(35_000), redirect: 'error',
      });
    } catch (error) {
      throw new ClientError('UNREACHABLE', `Cannot reach the local workshop at ${base.origin}.`, 'Start `kinetic serve`; keep a browser tab open for images.');
    }
    let data;
    try { data = await response.json(); } catch {
      throw new ClientError('INVALID_RESPONSE', 'The local service did not return JSON.', 'Check that this port is running Kinetic.');
    }
    if (!response.ok) {
      throw new ClientError(data.error?.code || `HTTP_${response.status}`, data.error?.message || 'Request failed.',
        response.status === 409 ? 'Inspect again; do not silently retry using a newer revision.' : 'Run the command with --help for its contract.');
    }
    return data;
  }
  return {
    base, request,
    async inspect(options = {}) { const state = await request('/api/inspect', options); return { ...state, analysis: analyzeScene(state.project) }; },
    async probe(id) {
      const state = await request('/api/state'); const analysis = analyzeScene(state.project);
      const part = analysis.parts.find(p => p.id === id);
      if (!part) throw new ClientError('NOT_FOUND', `Unknown part ${id}.`, `Available IDs: ${state.project.parts.map(p=>p.id).join(', ') || 'none'}.`);
      return { revision: state.project.revision, part, gaps: analysis.gaps.filter(g=>g.from===id||g.to===id), goal:analysis.goal, cameraRecommendations:analysis.cameraRecommendations };
    },
    edit: args => request('/api/edit', args),
    async run(args = {}) { const expectedRevision = args.expectedRevision ?? (await request('/api/state')).project.revision; return request('/api/run', { ...args, expectedRevision }); },
    view: options => request('/api/view', options),
    replay: options => request('/api/replay', options),
    compare: (baseline,candidate) => request('/api/compare', {baseline,candidate}),
    async feedback(resolveIds) {
      if (resolveIds !== undefined) await request('/api/feedback/resolve', { ids:resolveIds });
      const data = await request('/api/feedback');
      return { ...data, images:data.feedback.filter(n=>n.screenshot).slice(0,3).map(n=>n.screenshot) };
    },
  };
}
