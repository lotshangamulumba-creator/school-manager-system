import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { getHelmetOptions } from './securityHeaders.js';

test('development CSP permits Vite React Refresh inline preamble only in development', () => {
  const development = getHelmetOptions(false);
  const production = getHelmetOptions(true);
  const developmentCsp = development.contentSecurityPolicy;
  const productionCsp = production.contentSecurityPolicy;

  assert.ok(developmentCsp && typeof developmentCsp !== 'boolean');
  assert.ok(productionCsp && typeof productionCsp !== 'boolean');
  assert.deepEqual(developmentCsp.directives?.scriptSrc, ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(productionCsp.directives?.scriptSrc, ["'self'"]);
  assert.equal(development.hsts, false);
  assert.deepEqual(production.hsts, { maxAge: 31_536_000, includeSubDomains: true });
});

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
