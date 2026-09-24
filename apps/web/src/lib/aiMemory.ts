import { useSyncExternalStore } from 'react';

// Keeps Nile Guide conversations and AI summaries across page changes and reloads, per account, until the
// shopper starts over or signs out. Results are written here by the request itself, so an answer that
// arrives after the shopper navigated away is still waiting when they come back.
const PREFIX = 'bn_ai:';
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function read(key: string) {
  if (!cache.has(key)) {
    let value: unknown = null;
    try { const raw = localStorage.getItem(PREFIX + key); value = raw ? JSON.parse(raw) : null; } catch { value = null; }
    cache.set(key, value);
  }
  return cache.get(key);
}

export function remember(key: string, value: unknown) {
  cache.set(key, value ?? null);
  try {
    if (value == null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* storage full or unavailable: the in-memory copy still lasts for this visit */ }
  notify();
}

/** Clears every saved conversation and summary, e.g. on sign-out. */
export function forgetAll() {
  cache.clear();
  try { Object.keys(localStorage).filter((key) => key.startsWith(PREFIX)).forEach((key) => localStorage.removeItem(key)); } catch { /* storage unavailable */ }
  notify();
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Reads a remembered value and re-renders when it changes. A null key (e.g. while the account loads) reads nothing. */
export function useRemembered<T>(key: string | null): T | null {
  return useSyncExternalStore(subscribe, () => (key ? read(key) : null) as T | null, () => null);
}
