import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SCENE_KINDS, SCENE_LIMITS } from '../src/scene-model.js';
import { createClient, summarize } from './client.js';
const client=createClient(process.env.KINETIC_URL);
const server=new McpServer({name:'kinetic',version:'0.5.0'});
const view=z.object({mode:z.enum(['iso','side','top']).optional(),focus:z.string().min(1).max(40).optional(),overlays:z.boolean().optional()}).strict();
const wrap=fn=>async args=>{
  try {
    const {data,images}=summarize(await fn(args));
    return {content:[{type:'text',text:JSON.stringify(data)},...images.map(url=>({type:'image',mimeType:'image/png',data:url.split(',')[1]}))]};
  } catch(error) {
    return {isError:true,content:[{type:'text',text:JSON.stringify({error:{code:error.code||'ERROR',message:error.message},help:error.help||'Inspect again before editing. Start kinetic serve and open its browser for images.'})}]};
  }
};
server.tool('kinetic_project','Create a native Three.js project from scratch, open a source directory, or apply edited source after browser validation. create uses a new lowercase directory name; open requires kinetic.project.json with entry and explicit files. Mutations require the inspected revision; failed previews preserve the accepted project. Pause/resume controls live animation. Three.js source stays in ordinary editable files; inspect/probe/view/feedback/save share the workshop.',{action:z.enum(['create','open','apply','pause','resume']),name:z.string().regex(/^[a-z][a-z0-9-]{0,49}$/).optional(),directory:z.string().min(1).max(2000).optional(),expectedRevision:z.number().int().nonnegative().optional()},wrap(({action,...args})=>client.project(action,args)));
server.tool('kinetic_inspect','Read layout, rules, attempts and Three.js spatial facts. Scene assets and long geometry arrays are summarized; edits persist automatically. capture returns one real PNG from an open browser. It never fabricates missing visual evidence.',{capture:z.boolean().default(false),view:view.optional()},wrap(args=>client.inspect(args)));
server.tool('kinetic_probe','Read one object: world bounds, transform and axes. Scene boxes/cylinders expose the authored +Y topSurface normal, center and gravity-projected downhill direction; planar objects expose their +Z normal. Marble decks also have endpoints and gap deltas. These are geometry facts, not measured contacts or collision-clearance tests.',{id:z.string().min(1).max(40)},wrap(args=>client.probe(args.id)));
const changes=z.object({name:z.string().min(1).max(60).optional(),x:z.number().min(-6.4).max(6.4).optional(),y:z.number().min(.7).max(4.2).optional(),z:z.number().min(-2.5).max(2.5).optional(),angle:z.number().min(-45).max(45).optional(),yaw:z.number().min(-30).max(30).optional(),length:z.number().min(1).max(4.8).optional()}).strict();
const part=z.object({id:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),kind:z.enum(['ramp','platform','barrier']),name:z.string().min(1).max(60),x:z.number(),y:z.number(),z:z.number(),angle:z.number(),yaw:z.number(),length:z.number()}).strict();
const sceneChanges=z.object({
  ...Object.fromEntries(Object.entries(SCENE_LIMITS).map(([key,[min,max]])=>[key,z.number().min(min).max(max).optional()])),
  name:z.string().min(1).max(60).optional(),color:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),body:z.enum(['none','fixed','dynamic']).optional(),
  text:z.string().max(500).optional(),points:z.array(z.array(z.number())).max(512).optional(),vertices:z.array(z.array(z.number())).max(3000).optional(),indices:z.array(z.number().int().nonnegative()).max(9000).optional(),data:z.string().max(180000).optional(),
}).strict();
const scenePart=sceneChanges.extend({id:part.shape.id,kind:z.enum(SCENE_KINDS)});
const operation=z.discriminatedUnion('type',[
  z.object({type:z.literal('update'),id:z.string(),changes:z.union([changes,sceneChanges])}).strict(),
  z.object({type:z.literal('add'),part:z.union([part,scenePart])}).strict(),z.object({type:z.literal('remove'),id:z.string()}).strict(),
  z.object({type:z.literal('workspace'),template:z.enum(['scene','demo','marble'])}).strict(),
  z.object({type:z.literal('configure'),title:z.string().max(80).optional(),settings:z.object({background:z.string().optional(),gravity:z.tuple([z.number(),z.number(),z.number()]).optional(),duration:z.number().min(.1).max(10).optional()}).strict().optional()}).strict(),
]);
server.tool('kinetic_edit','Atomic persisted edit with inspected revision and retry-safe request ID. A sole workspace operation opens scene (blank), demo, or marble; Undo restores the prior workspace. Scenes: 64 objects/16 dynamic bodies, metre units, angle=Z/yaw=Y/roll=X degrees. New objects need id/kind; defaults fill other fields. Only box/sphere/cylinder support body fixed/dynamic; none is visual-only. Text needs text, line/arrow need local XYZ points (arrow: two), plot needs XY points (supplied data), mesh needs vertices/triangle indices, image needs bounded embedded PNG data (128 KiB, 1024px). Text/image/plot use local XY planes. Configure edits scene settings/title. Marble retains three parts and locked rules. Edits persist automatically.',{expectedRevision:z.number().int().nonnegative(),requestId:z.string().min(1).max(100),operations:z.array(operation).min(1).max(20)},wrap(args=>client.edit(args)));
server.tool('kinetic_run','Fresh 120 Hz physics for at most 10 simulated seconds. Scene runs report completed (or rendered when static) and success:null; no challenge criterion. Marble runs report success/status: completion is not success. Scene contacts contain object pair and time. Marble first contacts include the marble centre, post-step velocity and world normal from the struck surface toward the marble (null if unavailable). capture returns three timestamped real replay PNGs with a connected browser; view can focus a part.',{expectedRevision:z.number().int().nonnegative(),capture:z.boolean().default(true),view:view.optional()},wrap(args=>client.run(args)));
server.tool('kinetic_view','Capture an isometric, side or top view, optionally focused with bounds, surface normals and axes. Does not change the scene revision or human camera. A browser must be connected.',{mode:z.enum(['iso','side','top']).default('iso'),focus:z.string().min(1).max(40).optional(),overlays:z.boolean().default(false)},wrap(async args=>{
  const value=await client.view(args);if(!value.images.length)throw Object.assign(new Error(value.imageStatus),{code:'CAPTURE_UNAVAILABLE'});return value;
}));
server.tool('kinetic_feedback','Read human comments with object, camera, revision, run and images. Resolve only addressed IDs; that is not human approval.',{resolveIds:z.array(z.string()).max(30).optional()},wrap(args=>client.feedback(args.resolveIds)));
server.tool('kinetic_replay',"Inspect a retained run at a simulated time; no new physics attempt or scene edit. Historical captures use that run's layout, never the current one. Requests outside the run duration fail.",{runId:z.string().min(1).max(100),time:z.number().min(0).max(10).optional(),capture:z.boolean().default(false),view:view.optional()},wrap(args=>client.replay(args)));
server.tool('kinetic_compare','Compare two recorded runs: changed part fields, outcomes and measured distance/time deltas. This is evidence, not proof of causal improvement. No simulations or edits.',{baseline:z.string().min(1).max(100),candidate:z.string().min(1).max(100)},wrap(args=>client.compare(args.baseline,args.candidate)));
await server.connect(new StdioServerTransport());
