import { describe, it, expect, vi } from 'vitest';
import { getKey, setKey, hasKey, sendEvent, KEY_STORAGE, API_BASE } from '../src/lib/intervals-client.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

const event = { external_id: 'glutes:p:2026-09-10:0', start_date_local: '2026-09-10T00:00:00', name: 'X', category: 'WORKOUT', type: 'Ride', description: '- 10m 200w' };

function fakeFetch(existing) {
  const calls = [];
  const impl = vi.fn(async (url, init) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body ? JSON.parse(init.body) : null });
    if (init.method === 'GET') return { ok: true, status: 200, text: async () => JSON.stringify(existing) };
    if (init.method === 'POST') return { ok: true, status: 200, text: async () => JSON.stringify({ id: 42 }) };
    if (init.method === 'PUT') return { ok: true, status: 200, text: async () => '' };
    return { ok: false, status: 500, text: async () => '' };
  });
  return { impl, calls };
}

describe('key storage', () => {
  it('saves, reads and clears the key without touching the training log', () => {
    const s = memStorage();
    expect(hasKey(s)).toBe(false);
    setKey('  abc  ', s);
    expect(getKey(s)).toBe('abc');
    expect(s.getItem(KEY_STORAGE)).toBe('abc');
    setKey('', s);
    expect(hasKey(s)).toBe(false);
  });
});

describe('sendEvent', () => {
  it('creates when no event with that external_id exists on the date', async () => {
    const { impl, calls } = fakeFetch([{ id: 1, external_id: 'other' }]);
    const r = await sendEvent(event, { key: 'k', fetchImpl: impl });
    expect(r).toEqual({ action: 'created', id: 42 });
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST']);
    expect(calls[0].url).toBe(`${API_BASE}/athlete/0/events?oldest=2026-09-10&newest=2026-09-10&category=WORKOUT`);
    expect(calls[0].auth).toBe(`Basic ${btoa('API_KEY:k')}`);
    expect(calls[1].body).toEqual(event);
  });

  it('updates in place when the tag already exists', async () => {
    const { impl, calls } = fakeFetch([{ id: 7, external_id: event.external_id }]);
    const r = await sendEvent(event, { key: 'k', fetchImpl: impl });
    expect(r).toEqual({ action: 'updated', id: 7 });
    expect(calls[1].method).toBe('PUT');
    expect(calls[1].url).toBe(`${API_BASE}/athlete/0/events/7`);
    expect(calls[1].body.id).toBe(7);
  });

  it('reports a bad key and refuses to run without one', async () => {
    const impl = vi.fn(async () => ({ ok: false, status: 401, text: async () => '' }));
    await expect(sendEvent(event, { key: 'bad', fetchImpl: impl })).rejects.toThrow(/rejected the API key/);
    await expect(sendEvent(event, { key: '', fetchImpl: impl })).rejects.toThrow(/No intervals.icu API key/);
  });
});
