import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
export function runCLI(url,args) {
  const result=spawnSync(process.execPath,['cli.js',...args,'--url',url,'--json'],{cwd,encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr||result.stdout);return JSON.parse(result.stdout);
}
