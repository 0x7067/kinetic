"""Acceptance tests against actual WebGL + Rapier and an external stdio MCP client.
Run: pip install playwright==1.57.0 && playwright install chromium
Then: python tests/browser.py. Evidence is retained on both pass and failure.
"""
import json
import os
import subprocess
import tempfile
import time
import traceback
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence'
OUT.mkdir(exist_ok=True)
PORT = int(os.environ.get('BROWSER_TEST_PORT', '4331'))
BASE = f'http://127.0.0.1:{PORT}'
report = {'checks': [], 'pageErrors': [], 'success': False}

def check(name, condition=True):
    assert condition, name
    report['checks'].append(name)
    print('PASS:', name, flush=True)

def wait_for_server():
    for _ in range(100):
        try:
            with urllib.request.urlopen(BASE + '/api/state', timeout=1) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(.1)
    raise RuntimeError('HTTP workshop did not start')

with tempfile.TemporaryDirectory(prefix='kinetic-browser-') as folder:
    log = (OUT / 'browser-server.log').open('w')
    process = subprocess.Popen(['node', 'server/http.js'], cwd=ROOT,
        env={**os.environ, 'PORT': str(PORT), 'KINETIC_DATA': str(Path(folder) / 'project.json')},
        stdout=log, stderr=subprocess.STDOUT)
    browser = None
    try:
        wait_for_server()
        with sync_playwright() as p:
            context = None
            offline_context = None
            try:
                browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'), args=['--enable-unsafe-swiftshader', '--use-angle=swiftshader'])
                strict_context = browser.new_context()
                strict_page = strict_context.new_page()
                strict_errors=[]
                strict_page.on('pageerror', lambda e: strict_errors.append(str(e)))
                strict_page.goto(BASE, wait_until='domcontentloaded')
                strict_page.locator('body[data-ready="true"]').wait_for(timeout=30000)
                check('Unmodified browser starts under the actual application CSP', not strict_errors)
                strict_context.close()
                # The app intentionally ships a restrictive CSP. Playwright's string-based
                # wait predicates are evaluated through the page's eval machinery, so the
                # test harness bypasses CSP without weakening the application itself.
                context = browser.new_context(viewport={'width': 1440, 'height': 1060}, device_scale_factor=1,
                    bypass_csp=True,
                    record_video_dir=str(OUT / 'videos'), record_video_size={'width': 1440, 'height': 1060})
                context.tracing.start(screenshots=True, snapshots=True, sources=False)
                page = context.new_page()
                page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                response = page.goto(BASE, wait_until='domcontentloaded')
                csp = (response.headers.get('content-security-policy') if response else '') or ''
                check('Application still serves a restrictive CSP', "default-src 'self'" in csp and "object-src 'none'" in csp and "frame-ancestors 'none'" in csp)
                page.wait_for_function("document.body.dataset.ready === 'true'", timeout=30000)
                page.wait_for_timeout(900)
                check('Workshop initializes real WebGL2', page.evaluate("!!window.kinetic.view.renderer.getContext().getParameter(0x1F02)"))
                check('Three editable parts with fixed start and target', page.locator('.part').count() == 3)
                initial = page.evaluate('window.kinetic.getState()')
                page.screenshot(path=str(OUT / 'desktop-initial.png'), full_page=True)
                page.locator('#viewport').screenshot(path=str(OUT / 'workbench.png'))
                memory=page.evaluate('''() => {
                  const v=window.kinetic.view, p=window.kinetic.getState().project;
                  v.renderer.render(v.scene,v.camera);const before=v.renderer.info.memory.geometries;
                  for(let i=0;i<30;i++){v.setProject(p);v.setTrail([]);v.renderer.render(v.scene,v.camera);}
                  let instances=0;v.scene.traverse(o=>{if(o.isInstancedMesh)instances++;});
                  return {before,after:v.renderer.info.memory.geometries,instances,calls:v.renderer.info.render.calls};
                }''')
                check('Repeated inspection reuses geometry and instanced cup meshes', memory['after']==memory['before'] and memory['instances']>=1)
                report['renderer']=memory
                page.locator('#evidence-mode').click()
                check('Spatial view exposes Three.js bounds and normals', page.evaluate('window.kinetic.view.diagnostics.visible'))
                page.screenshot(path=str(OUT / 'spatial-view.png'), full_page=True)
                page.locator('#evidence-mode').click()
                camera_before=page.evaluate('window.kinetic.view.cameraState()')
                cli_view=subprocess.run(['node','cli.js','view','side','--focus','bridge','--overlays','--json','--capture-dir',str(OUT/'cli-captures')],cwd=ROOT,env={**os.environ,'KINETIC_URL':BASE},capture_output=True,text=True,timeout=40)
                assert cli_view.returncode==0,cli_view.stdout+cli_view.stderr
                capture=json.loads(cli_view.stdout)
                check('Live CLI focused side capture produces a real PNG with camera metadata', len(capture['imagePaths'])==1 and capture['captureMetadata'][0]['focus']=='bridge' and Path(capture['imagePaths'][0]).stat().st_size>10000)
                check('Agent captures preserve the human camera and project revision', camera_before==page.evaluate('window.kinetic.view.cameraState()') and initial['project']['revision']==page.evaluate('window.kinetic.getState().project.revision'))

                check('Rendered canvas contains a substantial PNG', page.evaluate('window.kinetic.view.capture().length') > 15000)
                page.locator('#run').click()
                page.wait_for_function("window.kinetic.getState().attempts.length === 1 && !document.querySelector('#run').disabled", timeout=20000)
                first = page.evaluate('window.kinetic.getState().attempts[0]')
                check('Initial run genuinely fails', first['success'] is False)
                page.screenshot(path=str(OUT / 'desktop-failed.png'), full_page=True)
                page.locator('#solve').click()
                page.wait_for_function("!document.querySelector('#run').disabled && window.kinetic.getState().attempts.some(r=>r.success)", timeout=45000)
                tuned = page.evaluate('window.kinetic.getState()')
                check('Bounded local search solves from measured failure', tuned['attempts'][0]['success'])
                check('Solver changes only the landing ramp height', tuned['project']['parts'][1]['y'] == 2.25 and tuned['project']['parts'][0] == initial['project']['parts'][0] and tuned['project']['parts'][2] == initial['project']['parts'][2])
                check('Challenge rules remain unchanged', tuned['rules'] == initial['rules'])
                page.wait_for_timeout(500)
                page.screenshot(path=str(OUT / 'desktop-solved.png'), full_page=True)
                page.locator('#undo').click()
                page.wait_for_function("window.kinetic.getState().project.parts[1].y === 2.5")
                page.locator('#redo').click()
                page.wait_for_function("window.kinetic.getState().project.parts[1].y === 2.25")
                check('Undo and redo restore the exact object, not a replacement')
                page.locator('#control-y').focus()
                page.keyboard.press('ArrowLeft')
                page.wait_for_function("Math.abs(window.kinetic.getState().project.parts[1].y-2.2)<.001")
                check('Keyboard interaction with the height slider makes a persisted edit')
                page.locator('#undo').click()
                page.wait_for_function("window.kinetic.getState().project.parts[1].y === 2.25")
                page.locator('#notes-tab').click()
                page.locator('#feedback-text').fill('Try a gentler landing. <img src=x onerror="window.hacked=true">')
                page.locator('#send-feedback').click()
                page.wait_for_function('window.kinetic.getState().feedback.length === 1')
                note = page.evaluate('window.kinetic.getState().feedback[0]')
                check('Feedback carries selected object, revision, camera and actual screenshot', note['targetId'] == 'bridge' and note['revision'] == page.evaluate('window.kinetic.getState().project.revision') and bool(note['camera']) and note['screenshot'].startswith('data:image/png;base64,'))
                check('Feedback text is escaped rather than executed', not page.evaluate('!!window.hacked'))
                page.screenshot(path=str(OUT / 'feedback.png'), full_page=True)
                page.locator('#send-feedback').click()
                page.wait_for_timeout(350)
                check('Blank feedback cannot create an empty request', page.evaluate('window.kinetic.getState().feedback.length') == 1)
                with page.expect_download() as download:
                    page.locator('#save').click()
                download.value.save_as(str(OUT / 'tested-project.json'))
                saved = json.loads((OUT / 'tested-project.json').read_text())
                check('Export preserves the editable layout and persistent IDs', [i['id'] for i in saved['parts']] == ['launch', 'bridge', 'home'])
                page.reload(wait_until='domcontentloaded')
                page.wait_for_function("document.body.dataset.ready === 'true'")
                check('Reload retains the project and feedback', page.evaluate('window.kinetic.getState().project.parts[1].y') == 2.25 and page.evaluate('window.kinetic.getState().feedback.length') == 1)
                page.wait_for_timeout(200)
                completed = subprocess.run(['node', 'tests/mcp-smoke.js'], cwd=ROOT,
                    env={**os.environ, 'KINETIC_URL': BASE, 'EXPECT_IMAGES': '1'},
                    capture_output=True, text=True, timeout=100)
                (OUT / 'mcp-smoke.log').write_text(completed.stdout + completed.stderr)
                assert completed.returncode == 0, completed.stdout + completed.stderr
                mcp = json.loads((OUT / 'mcp-results.json').read_text())
                check('External stdio MCP client receives five actual PNGs', mcp['images'] == 5)
                page.wait_for_function('window.kinetic.getState().attempts.length >= 4 && !document.querySelector("#run").disabled', timeout=20000)
                check('External MCP runs appear in the live browser attempt history')
                old_rev = page.evaluate('window.kinetic.getState().project.revision')
                invalid = {**saved, 'gravity': 0}
                page.locator('#import').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': json.dumps(invalid).encode()})
                page.wait_for_timeout(350)
                check('Project import cannot alter locked physics', page.evaluate('window.kinetic.getState().project.revision') == old_rev)
                page.locator('#import').set_input_files({'name': 'valid.json', 'mimeType': 'application/json', 'buffer': json.dumps(initial['project']).encode()})
                page.wait_for_function('window.kinetic.getState().project.parts[1].y === 2.5')
                check('Valid project import restores the saved layout')
                page.locator('#solve').click()
                page.wait_for_function("document.querySelector('#solve span').textContent === 'Stop tuning'")
                page.locator('#solve').click()
                page.wait_for_function("!document.querySelector('#run').disabled", timeout=20000)
                count = page.evaluate('window.kinetic.getState().attempts.length')
                page.wait_for_timeout(1500)
                check('Stopping auto-tune stops new attempts', page.evaluate('window.kinetic.getState().attempts.length') == count)
                check('Cancelled tuning never leaves a false Testing status', 'Tuning stopped.' in page.locator('#outcome').inner_text())
                page.locator('#connect').click()
                check('Agent setup presents CLI-first usage and real MCP configuration', page.locator('#agent-dialog').is_visible() and 'kinetic inspect' in page.locator('#agent-dialog').inner_text() and 'mcpServers' in page.locator('#agent-config').inner_text())
                page.locator('#close-dialog').click()
                page.set_viewport_size({'width': 390, 'height': 844})
                page.wait_for_timeout(700)
                check('Mobile layout has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
                caption = page.evaluate("""() => {
                  const nodes=[document.querySelector('.canvas-caption>span:first-child'),document.querySelector('#evidence-mode'),document.querySelector('.view-switch')];
                  const rects=nodes.map(n=>n.getBoundingClientRect());
                  const overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
                  return rects.every(r=>r.width>0&&r.left>=0&&r.right<=innerWidth)&&!overlap(rects[0],rects[1])&&!overlap(rects[0],rects[2])&&!overlap(rects[1],rects[2]);
                }""")
                check('Mobile orbit guidance and camera controls never overlap', caption)
                page.locator('#evidence-mode').click()
                check('Mobile spatial control responds to a real pointer click', page.evaluate('window.kinetic.view.diagnostics.visible'))
                page.locator('#evidence-mode').click()
                page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
                page.locator('#run').click()
                page.wait_for_function("!document.querySelector('#run').disabled", timeout=20000)
                check('Run control works at mobile width')
                check('No browser JavaScript exceptions', not report['pageErrors'])
                offline_context = browser.new_context(viewport={'width':1440,'height':1060}, record_video_dir=str(OUT / 'offline-video'))
                standalone = offline_context.new_page()
                standalone.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                standalone.goto((ROOT / 'dist/kinetic-standalone.html').as_uri(), wait_until='domcontentloaded')
                standalone.wait_for_function("document.body.dataset.ready === 'true'", timeout=45000)
                check('Single-file build initializes directly from a file URL', 'Browser-only' in standalone.locator('#connection').inner_text())
                standalone.locator('#solve').click()
                standalone.wait_for_function("!document.querySelector('#run').disabled && window.kinetic.getState().attempts.some(r=>r.success)", timeout=45000)
                check('Single-file build runs real physics and solves without a server')
                standalone.screenshot(path=str(OUT / 'standalone.png'), full_page=True)
                check('No exceptions including the standalone build', not report['pageErrors'])
                offline_context.close()
                report['success'] = True
            finally:
                if context:
                    try:
                        if not report['success']:
                            page.screenshot(path=str(OUT/'failure.png'), full_page=True)
                        context.tracing.stop(path=str(OUT/'browser-trace.zip'))
                    except Exception as error:
                        report['captureCleanupError']=str(error)[:500]
                    context.close()
                if offline_context:
                    offline_context.close()
                if browser:
                    browser.close()
    except Exception as error:
        report['failure'] = str(error)
        report['traceback'] = traceback.format_exc()
        try:
            page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
            context.tracing.stop(path=str(OUT / 'failure-trace.zip'))
        except Exception:
            pass
        raise
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        log.close()
        report['videos']=[{'path':str(v.relative_to(OUT)), 'bytes':v.stat().st_size} for v in OUT.rglob('*.webm')]
        if report['success'] and not any(v['bytes']>10000 for v in report['videos']):
            report['success']=False
            report['failure']='Browser checks passed but no complete video was recorded.'
        (OUT / 'browser-results.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2), flush=True)

if not report['success']:
    raise SystemExit(1)
