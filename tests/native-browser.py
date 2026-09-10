"""Native source creation, preview isolation, revision adoption and real CLI/MCP evidence."""
import json, os, subprocess, tempfile, time, traceback, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from cli_support import invoke_cli

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence'/'native-browser';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:4401'
report={'checks':[],'pageErrors':[],'success':False}
def check(name,condition=True):
    assert condition,name
    report['checks'].append(name);print('PASS:',name,flush=True)
def cli(*args,ok=True): return invoke_cli(ROOT,BASE,OUT/'captures',args,ok=ok)
def ready(page): page.locator('body[data-ready=true]').wait_for(timeout=45000)
def preview(page): page.locator('#native-status').filter(has_text='scene objects').wait_for(timeout=30000)

with tempfile.TemporaryDirectory(prefix='kinetic-native-browser-') as directory:
    env={**os.environ,'PORT':'4401','KINETIC_DATA':str(Path(directory)/'state.json')}
    log=(OUT/'server.log').open('w')
    service=subprocess.Popen(['node','server/http.js'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
    try:
        for _ in range(100):
            try:
                request=urllib.request.Request(BASE+'/api/state',headers={'User-Agent':'OpenAI File Downloader, XaiImageApiFetch/1.0'})
                urllib.request.urlopen(request,timeout=1).close();break
            except Exception: time.sleep(.1)
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'),args=['--enable-unsafe-swiftshader','--use-angle=swiftshader'])
            context=browser.new_context(viewport={'width':1440,'height':1000},user_agent='OpenAI File Downloader, XaiImageApiFetch/1.0',record_video_dir=str(OUT/'video'))
            page=context.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
            try:
                page.goto(BASE);ready(page)
                page.locator('#new-project').click();page.locator('#project-name').fill('first-world');page.locator('#project-create').click();preview(page)
                state=cli('inspect');source=Path(state['nativeProject']['directory'])
                check('Human creates a native source project from an empty workspace',state['project']['version']==3 and state['analysis']['totalObjects']==0 and (source/'main.js').is_file())
                check('Native preview starts under the real application CSP',not report['pageErrors'])
                check('Doctor recognizes native project invariants',cli('doctor')['partsWithinBudget'])
                frame=page.frame_locator('#native-viewport iframe')
                isolation=frame.locator('body').evaluate('() => { try { return !!parent.document.body; } catch { return false; } }')
                check('Authored code cannot access the host document',not isolation)
                response=context.request.get(BASE+'/api/state',headers={'Origin':'null'})
                check('The service rejects API access from an opaque preview origin',response.status==403)
                check('Default inspection summarizes source instead of dumping it','content' not in state['project']['native']['files'][0])
                check('Repeated creation preserves the existing directory',cli('project','create','first-world','--revision','1',ok=False)['error']['code']=='PROJECT_EXISTS')
                page.screenshot(path=str(OUT/'empty-project.png'),full_page=True)
                authored=(ROOT/'examples/native-orbit/main.js').read_text();(source/'main.js').write_text(authored)
                applied=cli('project','apply','--revision','1');preview(page)
                check('An agent adopts custom geometry, a shader and procedural animation',applied['revision']==2 and {x['id'] for x in applied['project']['parts']}=={'sculpture','orbit','plinth'})
                paused=cli('project','pause');a=cli('inspect');time.sleep(.15);b=cli('inspect')
                check('Pause freezes declared animation time',paused['inspection']['paused'] and a['analysis']['time']==b['analysis']['time'])
                probe=cli('probe','sculpture');check('CLI probes real Three.js bounds and source ownership',probe['part']['source']=='main.js' and probe['part']['bounds']['size']['y']>1 and len(probe['part']['worldMatrix'])==16)
                image=cli('render','side','--focus','sculpture');after=cli('inspect')
                check('CLI capture returns a real PNG and preserves the human camera',Path(image['imagePaths'][0]).stat().st_size>10000 and a['analysis']['camera']==after['analysis']['camera'])
                check('Unsupported native diagnostic overlays fail explicitly',cli('render','side','--overlays',ok=False)['error']['code']=='UNSUPPORTED_VIEW')
                page.screenshot(path=str(OUT/'native-desktop.png'),full_page=True)
                page.locator('#native-selection').select_option('sculpture');page.locator('#native-feedback').fill('Keep the orbit; make this sculpture warmer.');page.locator('#native-send').click()
                page.locator('#native-notes .note').wait_for();note=cli('feedback','list')['feedback'][0]
                check('Human feedback carries the source revision, object and exact captured moment',note['targetId']=='sculpture' and note['revision']==2 and note['camera']['nativeTime']==a['analysis']['time'] and note['screenshotAvailable'])
                old_camera=cli('inspect')['analysis']['camera']
                (source/'main.js').write_text('export function createProject(){throw new Error("broken candidate")}')
                rejected=cli('project','apply','--revision','2',ok=False)
                current=cli('inspect')
                check('A broken candidate leaves the accepted revision and camera available',rejected['error']['code']=='PREVIEW_FAILED' and current['project']['revision']==2 and current['analysis']['camera']==old_camera)
                (OUT/'rejected-candidate.json').write_text(json.dumps(rejected,indent=2))
                delayed=authored.replace('export function createProject({ canvas }) {','export async function createProject({ canvas }) { await new Promise(resolve=>setTimeout(resolve,1000));')
                (source/'main.js').write_text(delayed)
                pending=subprocess.Popen(['node','cli.js','project','apply','--revision','2','--url',BASE,'--json'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                time.sleep(.35);cli('new','scene','--revision','2');out,err=pending.communicate(timeout=35)
                check('A source candidate cannot overwrite a newer human workspace edit',pending.returncode!=0 and json.loads(out)['error']['code']=='STALE_REVISION' and cli('inspect')['project']['version']==2)
                (source/'main.js').write_text(authored)
                cli('project','open',str(source),'--revision','3');preview(page)
                check('Existing source projects use the same native preview',cli('inspect')['project']['revision']==4)
                cli('save',str(OUT/'saved-project.json'),'--force')
                check('Portable export retains ordinary project source',json.loads((OUT/'saved-project.json').read_text())['native']['files'][0]['content']==authored)
                sdk="""
import {Client} from '@modelcontextprotocol/sdk/client/index.js';import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const c=new Client({name:'native-browser',version:'1'});await c.connect(new StdioClientTransport({command:process.execPath,args:['server/mcp.js'],env:{...process.env,KINETIC_URL:process.env.NATIVE_TEST_URL},stderr:'pipe'}));
try{const tools=await c.listTools();const inspected=await c.callTool({name:'kinetic_inspect',arguments:{capture:true}});const probe=await c.callTool({name:'kinetic_probe',arguments:{id:'sculpture'}});const created=await c.callTool({name:'kinetic_project',arguments:{action:'create',name:'mcp-world',expectedRevision:4}});console.log(JSON.stringify({tools:tools.tools.map(x=>x.name),error:[inspected,probe,created].some(x=>x.isError),images:inspected.content.filter(x=>x.type==='image').length,created:JSON.parse(created.content[0].text)}));}finally{await c.close();}
"""
                result=subprocess.run(['node','--input-type=module','-e',sdk],cwd=ROOT,env={**os.environ,'NATIVE_TEST_URL':BASE},capture_output=True,text=True,timeout=60)
                assert result.returncode==0,result.stderr+result.stdout
                mcp=json.loads(result.stdout);(OUT/'mcp.json').write_text(json.dumps(mcp,indent=2))
                check('External stdio MCP inspects, captures, probes and creates native projects',not mcp['error'] and mcp['images']==1 and 'kinetic_project' in mcp['tools'] and mcp['created']['revision']==5)
                cli('undo','--revision','5');preview(page)
                check('Undo restores the original project and source directory',cli('inspect')['nativeProject']['directory']==str(source))
                page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'native-mobile.png'),full_page=True)
                check('Mobile native preview and feedback fit the screen',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                page.set_viewport_size({'width':1440,'height':1000})
                # Source files are a working draft; restart must restore the accepted snapshot.
                (source/'main.js').write_text('invalid working draft')
                service.terminate();service.wait(timeout=10)
                service=subprocess.Popen(['node','server/http.js'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT);time.sleep(.7)
                page.reload();ready(page);preview(page)
                restored=cli('inspect','--full')
                check('Restart restores accepted source and feedback without adopting disk edits',restored['project']['native']['files'][0]['content']==authored and len(restored['feedback'])==1)
                cli('import',str(OUT/'saved-project.json'),'--revision','6');preview(page)
                check('Portable source import is preview-validated and remains inspectable',cli('probe','sculpture')['revision']==7)
                created=cli('project','create','cli-world','--revision','7')
                check('CLI creates a fresh editable source project successfully',created['revision']==8 and Path(created['directory'],'main.js').is_file() and created['project']['parts']==[])
                check('No unexpected browser exceptions',not report['pageErrors'])
                report['success']=True
            except Exception:
                page.screenshot(path=str(OUT/'failure.png'),full_page=True);raise
            finally:
                context.close();browser.close()
    finally:
        service.terminate();service.wait(timeout=10);log.close();(OUT/'results.json').write_text(json.dumps(report,indent=2))
