// Browser-side intervals.icu client for "Send to Bolt". The API key lives in
// localStorage on this device only (not in the exported log). intervals.icu
// allows CORS from the app's origin and takes Basic auth with user API_KEY.

import { EXTERNAL_ID_PREFIX } from './intervals.js';

export const KEY_STORAGE = 'glutes.intervals-key';
export const API_BASE = 'https://intervals.icu/api/v1';

function store(storage) {
  if (storage) return storage;
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function getKey(storage) {
  const s = store(storage);
  try { return (s && s.getItem(KEY_STORAGE)) || ''; } catch { return ''; }
}

export function setKey(key, storage) {
  const s = store(storage);
  if (!s) return;
  const k = String(key || '').trim();
  if (k) s.setItem(KEY_STORAGE, k); else s.removeItem(KEY_STORAGE);
}

export function hasKey(storage) {
  return !!getKey(storage);
}

function authHeader(key) {
  return `Basic ${btoa(`API_KEY:${key}`)}`;
}

async function api(method, path, body, key, fetchImpl = fetch) {
  const res = await fetchImpl(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(key), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 || res.status === 403) throw new Error('intervals.icu rejected the API key');
  if (!res.ok) throw new Error(`intervals.icu ${method} ${path}: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Create or update one planned workout (matched on external_id for that date).
 * Returns { action: 'created' | 'updated', id }.
 */
export async function sendEvent(event, { key = getKey(), fetchImpl = fetch } = {}) {
  if (!key) throw new Error('No intervals.icu API key');
  const date = event.start_date_local.slice(0, 10);
  const existing = await api('GET', `/athlete/0/events?oldest=${date}&newest=${date}&category=WORKOUT`, null, key, fetchImpl);
  const match = (existing || []).find((e) => e.external_id === event.external_id);
  if (match) {
    await api('PUT', `/athlete/0/events/${match.id}`, { ...event, id: match.id }, key, fetchImpl);
    return { action: 'updated', id: match.id };
  }
  const created = await api('POST', '/athlete/0/events', event, key, fetchImpl);
  return { action: 'created', id: created && created.id };
}

export function isGlutesEvent(e) {
  return !!(e && e.external_id && e.external_id.startsWith(EXTERNAL_ID_PREFIX));
}
