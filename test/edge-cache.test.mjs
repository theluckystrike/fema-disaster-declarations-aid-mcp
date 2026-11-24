import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTextEdge } from '../dist/worker.js';

async function withUpstream(status, fn) {
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), cf: init?.cf });
    return new Response(status === 200 ? '{"ok":true}' : 'upstream error', { status });
  };
  try { await fn(); } finally { globalThis.fetch = real; }
  return seen;
}

function assertOnly2xxCached(cf, ttl) {
  assert.ok(cf, 'edge fetch passes cf cache options');
  assert.equal(cf.cacheTtl, undefined, 'cf.cacheTtl must not be used because it caches errors');
  assert.deepEqual(cf.cacheTtlByStatus, { '200-299': ttl, '300-599': 0 });
}

test('edge cache: 2xx answer is cached for requested TTL', async () => {
  let body;
  const seen = await withUpstream(200, async () => {
    body = await fetchTextEdge('https://upstream.test/ok', { cacheTtl: 1800 });
  });
  assert.equal(body, '{"ok":true}');
  assert.equal(seen.length, 1);
  assertOnly2xxCached(seen[0].cf, 1800);
});

test('edge cache: upstream 403 or 503 throws and is never cached', async () => {
  for (const status of [403, 503]) {
    const seen = await withUpstream(status, async () => {
      await assert.rejects(fetchTextEdge(`https://upstream.test/${status}`, { cacheTtl: 1800 }), new RegExp(`HTTP ${status}`));
    });
    assert.ok(seen.length >= 1);
    for (const s of seen) assertOnly2xxCached(s.cf, 1800);
  }
});
