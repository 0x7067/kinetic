"""General-workshop acceptance: real UI, WebGL, physics, CLI and external stdio MCP."""
import base64, json, os, struct, subprocess, sys, tempfile, time, traceback, urllib.request, zlib
from pathlib import Path
from playwright.sync_api import sync_playwright
from cli_support import invoke_cli
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence'/'general-browser';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:4396'
report={'checks':[],'pageErrors':[],'success':False}
def check(name,condition=True):
    assert condition,name
    report['checks'].append(name);print('PASS:',name,flush=True)
def cli(*args,ok=True):
    return invoke_cli(ROOT,BASE,OUT/'captures',args,ok=ok)

def idle(page):
    page.wait_for_function("!document.querySelector('#run').disabled",timeout=30000)
def ready(page):
    page.locator('body[data-ready=true]').wait_for(timeout=45000)
def batch(ops):
    path=OUT/'operations.json';path.write_text(json.dumps(ops))
    return cli('batch',str(path),'--revision',str(cli('inspect')['project']['revision']))
def png():
    def chunk(name,data): return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data))
    rows=b''.join(b'\0'+b''.join(bytes((60,125,106,255)) if (x//4+y//4)%2 else bytes((230,177,98,255)) for x in range(32)) for y in range(32))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',32,32,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
image_bytes=png();(OUT/'checker.png').write_bytes(image_bytes)
image_data='data:image/png;base64,'+base64.b64encode(image_bytes).decode()
with tempfile.TemporaryDirectory(prefix='kinetic-scene-browser-') as directory:
    log=(OUT/'server.log').open('w')
    service=subprocess.Popen(['node','server/http.js'],cwd=ROOT,env={**os.environ,'PORT':'4396','KINETIC_TEMPLATE':'scene','KINETIC_DATA':str(Path(directory)/'state.json')},stdout=log,stderr=subprocess.STDOUT)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(BASE+'/api/state',timeout=1).close();break
            except Exception: time.sleep(.1)
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'),args=['--enable-unsafe-swiftshader','--use-angle=swiftshader'])
            context=browser.new_context(viewport={'width':1440,'height':1120},bypass_csp=True,record_video_dir=str(OUT/'video'),record_video_size={'width':1440,'height':1120})
            context.tracing.start(screenshots=True,snapshots=True,sources=True)
            page=context.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
            try:
                page.goto(BASE);ready(page)
                check('Fresh service opens a general scene',cli('inspect')['project']['version']==2 and page.locator('.part').count()==0)
                check('General scenes hide the marble table and tuning control',not page.locator('#solve').is_visible() and not page.evaluate('window.kinetic.view.staticGroup.visible'))
                page.screenshot(path=str(OUT/'empty-scene.png'),full_page=True)
                page.locator('#demo-scene').click();page.wait_for_function('window.kinetic.getState().project.parts.length===7')
                page.evaluate('window.kinetic.view.waitForAssets()')
                check('Scene example mixes physical objects, text, an arrow and a plot',page.locator('.part').count()==7)
                rest=page.evaluate("() => { window.kinetic.view.reset(); window.kinetic.view.setCamera('iso'); window.kinetic.view.capture({mode:'iso'}); return window.kinetic.view.lastCapture.camera; }")
                escaped=page.evaluate("""() => {
                  const ball=window.kinetic.view.meshes.find(g=>g.userData.partId==='ball');
                  const y=ball.position.y;
                  ball.position.y=-80;ball.updateMatrixWorld(true);
                  window.kinetic.view.capture({mode:'iso'});
                  const unfocused={...window.kinetic.view.lastCapture.camera,position:window.kinetic.view.lastCapture.camera.position.slice()};
                  window.kinetic.view.capture({mode:'iso',focus:'ball'});
                  const focused={...window.kinetic.view.lastCapture.camera,position:window.kinetic.view.lastCapture.camera.position.slice()};
                  ball.position.y=y;ball.updateMatrixWorld(true);
                  const human=window.kinetic.view.cameraState();
                  return {unfocused,focused,human};
                }""")
                check('Unfocused iso capture keeps authored rest framing after the ball leaves',abs(escaped['unfocused']['zoom']-rest['zoom'])<.02 and abs(escaped['unfocused']['position'][1]-rest['position'][1])<.2)
                check('Focus still tight-crops an escaped ball',escaped['focused']['zoom']>escaped['unfocused']['zoom']*2)
                check('Direct view.capture does not move the human camera',escaped['human']==page.evaluate('window.kinetic.view.cameraState()'))
                page.screenshot(path=str(OUT/'demo-iso-authored.png'),full_page=True)
                batch([{'type':'configure','settings':{'duration':2}}])
                page.locator('#object-kind').select_option('box');page.locator('#add-object').click()
                page.wait_for_function('window.kinetic.getState().project.parts.length===8')
                field=page.get_by_label('Object name',exact=True);field.fill('Human-created box');field.press('Tab')
                page.wait_for_function("window.kinetic.getState().project.parts.some(p=>p.name==='Human-created box')")
                check('Human object creation and property edits persist through Workshop',any(x['name']=='Human-created box' for x in cli('inspect')['project']['parts']))
                batch([
                    {'type':'add','part':{'id':'mesh','kind':'mesh','name':'Custom pyramid','x':-6,'y':1,'vertices':[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[0,2,0]],'indices':[0,1,4,1,2,4,2,3,4,3,0,4],'color':'#b28bb5'}},
                    {'type':'add','part':{'id':'line','kind':'line','name':'A drawn path','x':-5,'y':-1,'points':[[0,0,0],[2,1,0],[4,0,0]]}},
                    {'type':'add','part':{'id':'badge','kind':'image','name':'Embedded image','x':6,'y':5,'width':1.2,'height':1.2,'data':image_data}},
                ])
                page.wait_for_function('window.kinetic.getState().project.parts.length===11');page.evaluate('window.kinetic.view.waitForAssets()')
                page.locator('[data-camera=side]').click()
                check('PNG assets decode as real textures',page.evaluate("window.kinetic.view.meshes.find(g=>g.userData.partId==='badge').children[0].material.map.image.width") ==32)
                camera=page.evaluate('window.kinetic.view.cameraState()')
                render=cli('render','side')
                check('CLI render returns a real PNG with scene metadata',len(render['imagePaths'])==1 and Path(render['imagePaths'][0]).stat().st_size>10000)
                check('Agent scene render preserves the human camera',camera==page.evaluate('window.kinetic.view.cameraState()'))
                page.screenshot(path=str(OUT/'scene-desktop.png'),full_page=True)
                sdk="""
import {Client} from '@modelcontextprotocol/sdk/client/index.js';import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const c=new Client({name:'scene-browser',version:'1'});await c.connect(new StdioClientTransport({command:process.execPath,args:['server/mcp.js'],env:{...process.env,KINETIC_URL:process.env.SCENE_TEST_URL},stderr:'pipe'}));
try{const inspected=await c.callTool({name:'kinetic_inspect',arguments:{capture:true}});const s=JSON.parse(inspected.content[0].text);const run=await c.callTool({name:'kinetic_run',arguments:{expectedRevision:s.project.revision,capture:true}});const view=await c.callTool({name:'kinetic_view',arguments:{mode:'side',focus:'badge'}});const all=[inspected,run,view];console.log(JSON.stringify({errors:all.some(x=>x.isError),images:all.flatMap(x=>x.content).filter(x=>x.type==='image').length,run:JSON.parse(run.content[0].text)}));}finally{await c.close();}
"""
                result=subprocess.run(['node','--input-type=module','-e',sdk],cwd=ROOT,env={**os.environ,'SCENE_TEST_URL':BASE},capture_output=True,text=True,timeout=60)
                assert result.returncode==0,result.stdout+result.stderr
                mcp=json.loads(result.stdout);(OUT/'mcp.json').write_text(json.dumps(mcp,indent=2))
                check('External stdio MCP captures five actual scene PNGs',not mcp['errors'] and mcp['images']==5)
                first=mcp['run'];idle(page)
                check('Scene physics completes without claiming challenge success',first['status']=='completed' and first['success'] is None and len(first['contacts'])>0)
                slider=page.locator('#replay-time');slider.scroll_into_view_if_needed();box=slider.bounding_box();page.mouse.click(box['x']+box['width']*.4,box['y']+box['height']/2)
                before=page.evaluate('window.kinetic.replay.time');camera=page.evaluate('window.kinetic.view.cameraState()')
                captured=cli('replay',first['id'],'--at','1','--capture','--view','side')
                check('Scene replay capture reads a historical instant without moving the scrubber',captured['frame']['t']==1 and page.evaluate('window.kinetic.replay.time')==before and len(cli('runs')['runs'])==1)
                check('Scene replay capture restores the rendered bodies',abs(page.evaluate("window.kinetic.view.meshes.find(g=>g.userData.partId==='ball').position.y")-cli('replay',first['id'],'--at',str(before))['frame']['objects']['ball']['y'])<.0001)
                page.locator('#return-edit').click();batch([{'type':'update','id':'ball','changes':{'y':6}}]);page.locator('#run').click();idle(page)
                second=cli('runs')['runs'][0];page.locator('#compare-run').select_option(first['id'])
                slider=page.locator('#replay-time');box=slider.bounding_box();page.mouse.click(box['x']+box['width']*.5,box['y']+box['height']/2)
                check('General scene comparison shows a time-aligned ghost',page.evaluate('window.kinetic.view.comparison.visible') and cli('compare',first['id'],second['id'])['closestDelta'] is None)
                page.screenshot(path=str(OUT/'scene-comparison.png'),full_page=True)
                page.locator('[data-run="'+first['id']+'"]').click();page.wait_for_function('!window.kinetic.replay.playing',timeout=10000)
                page.locator('#notes-tab').click();page.locator('#feedback-text').fill('Review this earlier scene and its image plane.');page.locator('#send-feedback').click()
                page.wait_for_function('window.kinetic.getState().feedback.length===1')
                note=page.evaluate('window.kinetic.getState().feedback[0]')
                check('Historical scene feedback preserves run and displayed revision',note['runId']==first['id'] and note['revision']==first['revision'])
                page.locator('#return-edit').click();export=OUT/'saved-scene.json';cli('save',str(export),'--force')
                check('Scene export preserves embedded image data',next(x for x in json.loads(export.read_text())['parts'] if x['id']=='badge')['data']==image_data)
                cli('new','scene','--revision',str(cli('inspect')['project']['revision']));page.wait_for_function('window.kinetic.getState().project.parts.length===0')
                page.locator('#build-tab').click();page.locator('#undo').click();page.wait_for_function('window.kinetic.getState().project.parts.length===11')
                check('One undo restores the whole scene after a workspace switch',len(cli('inspect')['project']['parts'])==11)
                page.reload();ready(page);check('Reload preserves the scene and feedback',page.locator('.part').count()==11 and len(cli('feedback')['feedback'])==1)
                page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'scene-mobile.png'),full_page=True)
                check('Mobile scene controls have no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                page.locator('#build-tab').click();page.locator('#object-kind').select_option('text');page.locator('#add-object').click();page.wait_for_function('window.kinetic.getState().project.parts.length===12')
                check('Mobile user can add a scene annotation',page.get_by_label('Object text',exact=True).is_visible())
                bad='data:image/png;base64,'+base64.b64encode(image_bytes[:33]+b'broken').decode()
                batch([{'type':'update','id':'badge','changes':{'data':bad}}])
                failed=cli('render',ok=False);check('An undecodable asset fails a capture explicitly',failed.get('captureStatus')=='failed' and not failed.get('imagePaths'))
                batch([{'type':'update','id':'badge','changes':{'data':image_data}}]);cli('render')
                offline=browser.new_context(viewport={'width':1100,'height':850},bypass_csp=True,record_video_dir=str(OUT/'offline-video'))
                op=offline.new_page();op.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
                op.goto((ROOT/'dist/kinetic-standalone.html').as_uri());ready(op);op.locator('#demo-scene').click();op.wait_for_function('window.kinetic.getState().project.parts.length===7');op.locator('#run').click();idle(op)
                check('Standalone file supports general scenes and real physics',op.evaluate("window.kinetic.getState().attempts[0].status==='completed'"))
                op.screenshot(path=str(OUT/'scene-offline.png'),full_page=True);offline.close()
                check('No browser JavaScript exceptions',not report['pageErrors']);report['success']=True
            except Exception:
                page.screenshot(path=str(OUT/'failure.png'),full_page=True);raise
            finally:
                context.tracing.stop(path=str(OUT/'trace.zip'));context.close();browser.close()
    except Exception as e:
        report['error']=str(e);report['traceback']=traceback.format_exc();print(report['traceback'],flush=True)
    finally:
        service.terminate();service.wait(timeout=10);log.close();(OUT/'results.json').write_text(json.dumps(report,indent=2))
if not report['success']:raise SystemExit(1)
# Keep both scene formats covered by the shared CI acceptance entry point.
subprocess.run([sys.executable,str(ROOT/'tests/native-browser.py')],cwd=ROOT,check=True)
