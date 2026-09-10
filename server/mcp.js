import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createClient, summarize } from './client.js';
const client=createClient(process.env.KINETIC_URL);
const server=new McpServer({name:'kinetic',version:'0.4.0'});
const view=z.object({mode:z.enum(['iso','side','top']).optional(),focus:z.string().min(1).max(40).optional(),overlays:z.boolean().optional()}).strict();
const wrap=fn=>async args=>{
  try {
    const {data,images}=summarize(await fn(args));
    return {content:[{type:'text',text:JSON.stringify(data)},...images.map(url=>({type:'image',mimeType:'image/png',data:url.split(',')[1]}))]};
  } catch(error) {
    return {isError:true,content:[{type:'text',text:JSON.stringify({error:{code:error.code||'ERROR',message:error.message},help:error.help||'Inspect again before editing. Start kinetic serve and open its browser for images.'})}]};
  }
};
server.tool('kinetic_inspect','Read layout, rules, attempts and Three.js spatial facts. capture returns one real PNG from an open browser. It never fabricates missing visual evidence.',{capture:z.boolean().default(false),view:view.optional()},wrap(args=>client.inspect(args)));
server.tool('kinetic_probe','Read one part: world bounds, deck endpoints, normal and downhill direction. Endpoint gaps are not a collision clearance test.',{id:z.string().min(1).max(40)},wrap(args=>client.probe(args.id)));
const changes=z.object({name:z.string().min(1).max(60).optional(),collider:z.boolean().optional(),x:z.number().min(-6.4).max(6.4).optional(),y:z.number().min(.7).max(4.2).optional(),z:z.number().min(-2.5).max(2.5).optional(),angle:z.number().min(-45).max(45).optional(),yaw:z.number().min(-30).max(30).optional(),length:z.number().min(1).max(4.8).optional()}).strict();
const part=z.object({id:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),kind:z.enum(['ramp','platform','barrier','mesh']),name:z.string().min(1).max(60),x:z.number(),y:z.number(),z:z.number(),angle:z.number(),yaw:z.number(),length:z.number(),collider:z.boolean().optional()}).strict();
const operation=z.discriminatedUnion('type',[z.object({type:z.literal('update'),id:z.string(),changes}).strict(),z.object({type:z.literal('add'),part}).strict(),z.object({type:z.literal('remove'),id:z.string()}).strict()]);
server.tool('kinetic_edit','Atomic persisted edit. Supply the revision you inspected and a retry-safe request ID. Typed add/update/remove only; metres and DEGREES. Optional collider on parts. Gravity stays engine-fixed; marble-to-cup is a composition.',{expectedRevision:z.number().int().nonnegative(),requestId:z.string().min(1).max(100),operations:z.array(operation).min(1).max(20)},wrap(args=>client.edit(args)));
server.tool('kinetic_run','Fresh 120 Hz physics when a dynamic body exists, for at most 10 simulated seconds. Absent judge → success is null and status is completed. capture returns three timestamped real replay PNGs with a connected browser; view can focus a part.',{expectedRevision:z.number().int().nonnegative(),capture:z.boolean().default(true),view:view.optional()},wrap(args=>client.run(args)));
server.tool('kinetic_view','Capture an isometric, side or top view, optionally focused with bounds, surface normals and axes. Does not change the scene revision or human camera. A browser must be connected.',{mode:z.enum(['iso','side','top']).default('iso'),focus:z.string().min(1).max(40).optional(),overlays:z.boolean().default(false)},wrap(async args=>{
  const value=await client.view(args);if(!value.images.length)throw Object.assign(new Error(value.imageStatus),{code:'CAPTURE_UNAVAILABLE'});return value;
}));
server.tool('kinetic_feedback','Read human comments with object, camera, revision, run and images. Resolve only addressed IDs; that is not human approval.',{resolveIds:z.array(z.string()).max(30).optional()},wrap(args=>client.feedback(args.resolveIds)));
server.tool('kinetic_replay',"Inspect a retained run at a simulated time; no new physics attempt or scene edit. Historical captures use that run's layout, never the current one. Requests outside the run duration fail.",{runId:z.string().min(1).max(100),time:z.number().min(0).max(10).optional(),capture:z.boolean().default(false),view:view.optional()},wrap(args=>client.replay(args)));
server.tool('kinetic_compare','Compare two recorded runs: changed part fields, outcomes and measured distance/time deltas. This is evidence, not proof of causal improvement. No simulations or edits.',{baseline:z.string().min(1).max(100),candidate:z.string().min(1).max(100)},wrap(args=>client.compare(args.baseline,args.candidate)));
await server.connect(new StdioServerTransport());
