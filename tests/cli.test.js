import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 4347;
const URL = `http://127.0.0.1:${PORT}`;

function cli(...args) {
  const result = spawnSync(process.execPath, ['cli.js', ...args, '--url', URL, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 25000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`${URL}/api/state`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('server did not start');
}

test('CLI exposes a complete inspect -> run -> edit -> run -> undo loop', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'kinetic-cli-'));
  const server = spawn(process.execPath, ['server/http.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), KINETIC_DATA: join(folder, 'project.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { server.kill('SIGTERM'); rmSync(folder, { recursive: true, force: true }); });
  await waitForServer();

  const inspect = cli('inspect');
  assert.equal(inspect.project.revision, 0);
  assert.equal(inspect.analysis.parts.length, 3);
  assert.equal(inspect.analysis.gaps.length, 2);
  assert.match(inspect.analysis.coordinateSystem, /Y-up/);
  assert.equal(inspect.analysis.parts[1].id, 'bridge');
  assert.ok(inspect.analysis.parts[1].bounds.size.x > 2);
  assert.equal(typeof inspect.analysis.gaps[1].verticalDelta, 'number');
  assert.ok(inspect.analysis.gaps[1].horizontalDistance > 0);
  assert.equal(inspect.analysis.cameraRecommendations.length, 3);

  const probe = cli('probe', 'bridge');
  assert.equal(probe.part.id, 'bridge');
  assert.equal(probe.part.transform.matrixWorld.length, 16);
  assert.equal(probe.part.surfaceNormal.y > 0.9, true);

  const first = cli('run');
  assert.equal(first.success, false);
  assert.equal(first.status, 'fell-short');
  assert.ok(first.contacts.length > 0);
  assert.ok(first.contacts.every(c => c.position && Number.isFinite(c.speed)));
  assert.ok(first.closestPoint && Number.isFinite(first.closestTime));
  assert.ok(first.trajectorySample.length >= 3);
  assert.equal('frames' in first, false, 'compact JSON must not dump the full trajectory by default');

  const edit = cli('set', 'bridge', 'y=2.25', '--revision', '0');
  assert.equal(edit.changed, true);
  assert.equal(edit.project.parts.find(p => p.id === 'bridge').y, 2.25);

  const second = cli('run');
  assert.equal(second.success, true);
  assert.equal(second.status, 'success');
  assert.ok(second.contacts.some(c => c.part === 'cup'));

  const undo = cli('undo', '--revision', String(edit.revision));
  assert.equal(undo.changed, true);
  const restored = cli('inspect');
  assert.equal(restored.project.parts.find(p => p.id === 'bridge').y, 2.5);

  const doctor = cli('doctor');
  assert.equal(doctor.reachable, true);
  assert.equal(doctor.fixedGravity, true);
  assert.equal(doctor.stableIds, true);
});

test('CLI import/set/save/run a non-marble two-boxes project', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'kinetic-boxes-'));
  const server = spawn(process.execPath, ['server/http.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT + 1), KINETIC_DATA: join(folder, 'project.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { server.kill('SIGTERM'); rmSync(folder, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${PORT + 1}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`${url}/api/state`); if (r.ok) break; } catch {}
    if (i === 99) throw new Error('server did not start');
    await new Promise(r => setTimeout(r, 50));
  }
  const runCli = (...args) => {
    const result = spawnSync(process.execPath, ['cli.js', ...args, '--url', url, '--json'], { cwd: ROOT, encoding: 'utf8', timeout: 25000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const imported = runCli('import', resolve(ROOT, 'examples/two-boxes.json'), '--revision', '0');
  assert.equal(imported.project.parts.length, 2);
  assert.equal(imported.project.judge, undefined);
  const inspect = runCli('inspect');
  assert.equal(inspect.analysis.start, null);
  assert.equal(inspect.analysis.objects.length, 4);
  const probed = runCli('probe', 'box-b');
  assert.equal(probed.part.id, 'box-b');
  const light = runCli('probe', 'key-light');
  assert.equal(light.part.kind, 'light');
  const edited = runCli('set', 'box-a', 'y=1.8', '--revision', String(imported.project.revision));
  assert.equal(edited.project.parts.find(p => p.id === 'box-a').y, 1.8);
  const run = runCli('run');
  assert.equal(run.success, null);
  assert.equal(run.status, 'completed');
  assert.equal(run.contacts.length, 0);
  const saved = join(folder, 'two-boxes-out.json');
  runCli('save', saved, '--force');
  const roundTrip = JSON.parse(readFileSync(saved, 'utf8'));
  assert.equal(roundTrip.parts.find(p => p.id === 'box-a').y, 1.8);
  assert.ok(!roundTrip.judge);
  assert.equal(roundTrip.world.objects.length, 2);
});

test('CLI help is useful without a running server and global flags can precede commands', () => {
  const help = spawnSync(process.execPath, ['cli.js', 'help'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Core loop:/);
  assert.match(help.stdout, /kinetic inspect/);
  assert.match(help.stdout, /field=value/);

  const version = spawnSync(process.execPath, ['cli.js', '--json', 'version'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(version.status, 0);
  assert.match(version.stdout, /0\.4\.0/);
});

for (const argv of [
  ['inspect','--nonsense'], ['run','--help','--nonsense'], ['run','surprise'],
  ['set','bridge','x=','--revision','0'], ['set','bridge','y=2.25'],
  ['set','bridge','x=0','x=1','--revision','0'], ['set','bridge','gravity=0','--revision','0'],
  ['inspect','--url','--json'], ['inspect','--capture-dir'], ['view','rear'],
  ['run','--view','side'], ['run','--revision','-1'], ['probe','bridge','extra'],
  ['inspect','--url','https://example.com'], ['inspect','--url','http://user:pass@localhost:4317'],
]) test(`CLI rejects invalid input before connecting: ${argv.join(' ')}`,()=>{
  const result=spawnSync(process.execPath,['cli.js',...argv,...(argv.includes('--json')?[]:['--json'])],{cwd:ROOT,encoding:'utf8',env:{...process.env,KINETIC_URL:'http://127.0.0.1:1'}});
  assert.equal(result.status,2,result.stdout+result.stderr);
  assert.equal(result.stderr,'','Agent-readable errors go on stdout.');
  const data=JSON.parse(result.stdout);assert.ok(data.error.code);assert.ok(data.help);
});

test('per-command help does not contact the service and does not reveal the solution',()=>{
  const result=spawnSync(process.execPath,['cli.js','set','--help'],{cwd:ROOT,encoding:'utf8'});
  assert.equal(result.status,0);assert.match(result.stdout,/--revision/);assert.doesNotMatch(result.stdout,/2\.25/);
});
