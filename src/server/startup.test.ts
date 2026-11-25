import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('production startup refuses a missing or weak JWT_SECRET before listening', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', "await import('./server.ts')"],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: '',
        PORT: '0',
      },
    }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET.*32 caractères/);
  assert.doesNotMatch(result.stderr, /Vite|listening on|opérationnelle/i);
});
