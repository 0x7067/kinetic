"""Run the public CLI against a test's service, retaining captures as files."""
import json
import os
import subprocess

def invoke_cli(root, url, captures, args, ok=True):
    result = subprocess.run(['node', 'cli.js', *args, '--url', url, '--json', '--capture-dir', str(captures)],
                            cwd=root, env=os.environ, capture_output=True, text=True, timeout=40)
    if ok:
        assert result.returncode == 0, result.stdout + result.stderr
    return json.loads(result.stdout)
