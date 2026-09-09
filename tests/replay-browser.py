"""Real interactions and screenshots for the read-only Replay Lab; no simulated UI."""
import json, os, subprocess, tempfile, time, traceback, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence'/'replay';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:4361'
report={'checks':[],'pageErrors':[],'success':False}
def check(name,value=True):
    assert value,name
    report['checks'].append(name);print('PASS:',name,flush=True)
def cli(*args):
    result=subprocess.run(['node','cli.js',*args,'--url',BASE,'--json','--capture-dir',str(OUT/'captures')],cwd=ROOT,capture_output=True,text=True,timeout=40)
    assert result.returncode==0,result.stdout+result.stderr
    return json.loads(result.stdout)
def wait_server():
    for _ in range(100):
        try:
            urllib.request.urlopen(BASE+'/api/state',timeout=1).close();return
        except Exception: time.sleep(.1)
    raise RuntimeError('service failed to start')
def ready(page):
    page.wait_for_function("document.body.dataset.ready==='true'",timeout=30000)
def idle(page):
    page.wait_for_function("!document.querySelector('#run').disabled",timeout=30000)

with tempfile.TemporaryDirectory(prefix='kinetic-replay-browser-') as directory:
    log=(OUT/'server.log').open('w')
    server=subprocess.Popen(['node','server/http.js'],cwd=ROOT,env={**os.environ,'PORT':'4361','KINETIC_DATA':str(Path(directory)/'state.json')},stdout=log,stderr=subprocess.STDOUT)
    try:
        wait_server()
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'),args=['--enable-unsafe-swiftshader','--use-angle=swiftshader'])
            context=browser.new_context(viewport={'width':1440,'height':1120},bypass_csp=True,record_video_dir=str(OUT/'video'),record_video_size={'width':1440,'height':1120})
            context.tracing.start(screenshots=True,snapshots=True,sources=True)
            page=context.new_page();page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
            try:
                page.goto(BASE,wait_until='domcontentloaded');ready(page)
                page.locator('#run').click();idle(page)
                first=cli('runs')['runs'][0];first_id=first['id']
                check('Initial recorded attempt is a real failure',not first['success'])
                page.locator('[data-contact-part="bridge"]').click()
                at=page.evaluate('window.kinetic.replay.time')
                contact=next(c for c in first['contacts'] if c['part']=='bridge')
                check('A contact chip pauses at its recorded collision time',abs(at-contact['time'])<.0001 and not page.evaluate('window.kinetic.replay.playing'))
                page.wait_for_timeout(400)
                check('Paused playback remains at the selected simulated instant',at==page.evaluate('window.kinetic.replay.time'))
                page.locator('[data-camera="side"]').click()
                before=page.evaluate('window.kinetic.view.cameraState()')
                paused=cli('replay',first_id,'--at',str(at),'--capture','--view','side','--focus','bridge','--overlays')
                check('CLI captures the requested historical instant, not a new simulation',len(paused['imagePaths'])==1 and paused['captureMetadata'][0]['time']==at and paused['captureMetadata'][0]['runId']==first_id)
                check('Remote replay capture preserves human camera and scrubber',page.evaluate('window.kinetic.view.cameraState()')==before and page.evaluate('window.kinetic.replay.time')==at)
                pos=page.evaluate('window.kinetic.view.marble.position.toArray()')
                check('Rendered contact and CLI sample agree in world space',all(abs(pos[i]-paused['frame'][k])<.0001 for i,k in enumerate(['x','y','z'])))
                page.locator('#replay-next').click();next_t=page.evaluate('window.kinetic.replay.time')
                check('Single-frame stepping advances to a recorded sample',next_t>at)
                page.locator('#replay-back').click()
                check('Stepping back returns to the same recorded collision',page.evaluate('window.kinetic.replay.time')==at)
                page.locator('#notes-tab').click();page.locator('#feedback-text').fill('At this impact, the marble reverses. Compare the next attempt.')
                page.locator('#send-feedback').click()
                page.wait_for_function('window.kinetic.getState().feedback.length===1')
                note=page.evaluate('window.kinetic.getState().feedback[0]')
                check('Human feedback carries the exact replay time and revision',note['time']==at and note['revision']==0 and note['runId']==first_id)
                page.screenshot(path=str(OUT/'collision-review.png'),full_page=True)
                page.locator('#return-edit').click();check('Leaving replay restores live editing',not page.locator('#replay-lab').is_visible())
                cli('set','bridge','y=2.2','--revision','0')
                page.wait_for_function('window.kinetic.getState().project.revision===1')
                page.locator('#build-tab').click();page.locator('#run').click();idle(page)
                second=cli('runs')['runs'][0]
                check('A changed landing height gives a genuinely successful second run',second['success'])
                page.locator('#compare-run').select_option(first_id)
                page.wait_for_function('window.kinetic.view.comparison.visible')
                slider=page.locator('#replay-time');slider.scroll_into_view_if_needed()
                box=slider.bounding_box()
                slider.click(position={'x':8+(box['width']-16)*2.5/second['duration'],'y':box['height']/2})
                page.wait_for_timeout(250)
                check('Pointer scrubbing seeks near the requested 2.5 seconds',abs(page.evaluate('window.kinetic.replay.time')-2.5)<.07)
                check('The ghost overlays a recorded baseline, not predicted motion',page.evaluate('window.kinetic.view.comparisonRun.id')==first_id)
                delta=cli('compare',first_id,second['id'])
                check('Comparison reports exact edited fields and different outcomes',delta['changes']==[{'id':'bridge','type':'updated','fields':{'y':{'before':2.5,'after':2.2}}}] and not delta['baseline']['success'] and delta['candidate']['success'])
                page.screenshot(path=str(OUT/'comparison.png'),full_page=True)
                count=len(cli('runs')['runs'])
                check('Read-only investigation creates no additional attempts',count==2)
                geometry_before=page.evaluate('window.kinetic.view.renderer.info.memory.geometries')
                for _ in range(12):
                    page.locator('#compare-run').select_option('');page.locator('#compare-run').select_option(first_id)
                page.wait_for_timeout(200)
                geometry_after=page.evaluate('window.kinetic.view.renderer.info.memory.geometries')
                report['geometry']={'before':geometry_before,'after':geometry_after}
                check('Repeated ghost toggles do not accumulate GPU geometries',geometry_after<=geometry_before+1)
                # Read-only old layout, alongside an explicitly newer saved document.
                page.locator(f'[data-run="{first_id}"]').click()
                page.wait_for_function('window.kinetic.replay.run.revision===0 && !window.kinetic.replay.playing',timeout=30000)
                check('Historical playback labels its revision and disables stale editing',page.locator('#control-y').is_disabled() and 'read-only history' in page.locator('#replay-revision').inner_text())
                page.locator('[data-contact-part="bridge"]').click();page.locator('#notes-tab').click()
                page.locator('#feedback-text').fill('This note belongs to the older layout, not the new one.')
                page.locator('#send-feedback').click();page.wait_for_function('window.kinetic.getState().feedback.length===2')
                historical=page.evaluate('window.kinetic.getState().feedback[1]')
                check('Historical feedback remains on r0 while saved layout is r1',historical['revision']==0 and historical['currentRevision']==1 and historical['runId']==first_id)
                page.locator('#return-edit').click();idle(page)
                check('Historical investigation never overwrites the working layout',cli('inspect')['project']['parts'][1]['y']==2.2)
                # Real pointer pause/resume while replay is in motion.
                page.locator('#run').click();page.wait_for_function('window.kinetic.replay.playing')
                page.locator('#replay-toggle').click();t=page.evaluate('window.kinetic.replay.time');page.wait_for_timeout(250)
                check('Pause works during an active replay',not page.evaluate('window.kinetic.replay.playing') and page.evaluate('window.kinetic.replay.time')==t)
                page.locator('#replay-toggle').click();idle(page)
                page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(400)
                check('Mobile replay stays directly below the canvas and before the inspector',page.evaluate("document.querySelector('#replay-lab').getBoundingClientRect().bottom <= document.querySelector('.sidebar').getBoundingClientRect().top"))
                page.screenshot(path=str(OUT/'mobile-replay.png'),full_page=True)
                check('Mobile replay controls do not cause horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                page.locator('#replay-back').click();check('Frame controls respond at mobile width',not page.evaluate('window.kinetic.replay.playing'))
                check('Replay lab has no JavaScript exceptions',not report['pageErrors'])
                report['success']=True
            except Exception:
                page.screenshot(path=str(OUT/'failure.png'),full_page=True);raise
            finally:
                context.tracing.stop(path=str(OUT/'trace.zip'));context.close();browser.close()
    except Exception as e:
        report['error']=str(e);report['traceback']=traceback.format_exc();raise
    finally:
        server.terminate();server.wait(timeout=8);log.close()
        report['videos']=[{'path':str(v.relative_to(OUT)),'bytes':v.stat().st_size} for v in OUT.rglob('*.webm')]
        (OUT/'results.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True)
