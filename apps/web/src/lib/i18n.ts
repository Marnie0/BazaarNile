import { createElement, Fragment, type ReactNode } from 'react';

// English source strings are the translation keys, so untranslated text falls back to readable English.
// Arabic lives in its own chunk and is only downloaded by shoppers who choose it.
export type Lang = 'en' | 'ar';
export type PluralEntry = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Dictionary = Record<string, string | PluralEntry>;

const STORAGE_KEY = 'bn_lang';
const storage = {
  get: () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } },
  set: (value: string) => { try { localStorage.setItem(STORAGE_KEY, value); } catch { /* storage unavailable */ } },
};

// English needs plural forms only for strings with a {count}.
const english: Dictionary = {
  '{count} reviews': { one: '{count} review', other: '{count} reviews' },
  '{count} items': { one: '{count} item', other: '{count} items' },
  '{count} products': { one: '{count} product', other: '{count} products' },
  '{count} orders': { one: '{count} order', other: '{count} orders' },
  '{count} units': { one: '{count} unit', other: '{count} units' },
  '{count} listings': { one: '{count} listing', other: '{count} listings' },
  '{count} options': { one: '{count} option', other: '{count} options' },
  '{count} results': { one: '{count} result', other: '{count} results' },
  '{count} sales': { one: '{count} sale', other: '{count} sales' },
  '{count} total products': { one: '{count} total product', other: '{count} total products' },
  '{count} live listings are out of stock': { one: '{count} live listing is out of stock', other: '{count} live listings are out of stock' },
  'Across {count} listings': { one: 'Across {count} listing', other: 'Across {count} listings' },
  '{count} {names} options': { one: '{count} {names} option', other: '{count} {names} options' },
  'Cart, {count} items': { one: 'Cart, {count} item', other: 'Cart, {count} items' },
  '{count} stars: {label}': { one: '{count} star: {label}', other: '{count} stars: {label}' },
  '{count} items from the bazaar': { one: '{count} item from the bazaar', other: '{count} items from the bazaar' },
  '{count} saved items. Tap the heart to remove one.': { one: '{count} saved item. Tap the heart to remove one.', other: '{count} saved items. Tap the heart to remove one.' },
  'Showing {count} {rating}-star reviews': { one: 'Showing {count} {rating}-star review', other: 'Showing {count} {rating}-star reviews' },
};

const detect = (): Lang => {
  const saved = storage.get();
  if (saved === 'en' || saved === 'ar') return saved;
  return typeof navigator !== 'undefined' && navigator.languages?.some((value) => value.toLowerCase().startsWith('ar')) ? 'ar' : 'en';
};

let current: Lang = detect();
let arabic: Dictionary | null = null;
let patterns: [RegExp, string][] = [];
let plurals = new Intl.PluralRules(current);
const listeners = new Set<() => void>();

const applyDocument = () => {
  document.documentElement.lang = current;
  document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
  // Pages without their own title fall back to this one.
  document.title = t('BazaarNile — Shop smarter');
};

async function loadDictionary(lang: Lang) {
  if (lang === 'ar' && !arabic) { const module = await import('./locales/ar'); arabic = module.default; patterns = module.patterns; }
}

/** Call once before the first render so Arabic shoppers never see an English flash. */
export async function initLanguage() {
  await loadDictionary(current).catch(() => { current = 'en'; });
  plurals = new Intl.PluralRules(current);
  applyDocument();
}

export async function setLanguage(lang: Lang) {
  if (lang === current) return;
  await loadDictionary(lang);
  current = lang; plurals = new Intl.PluralRules(lang);
  storage.set(lang); applyDocument();
  listeners.forEach((listener) => listener());
}

export const getLanguage = () => current;
export const isRtl = () => current === 'ar';
export const subscribeToLanguage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Numbers use Latin digits in Arabic too, as Egyptian shops do, so prices and phone numbers read the same everywhere. */
export const locale = () => current === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG';

function lookup(key: string, count?: number) {
  const entry = (current === 'ar' ? arabic?.[key] : undefined) ?? english[key] ?? key;
  if (typeof entry === 'string') return entry;
  return (count === undefined ? undefined : entry[plurals.select(count)]) ?? entry.other;
}

/** Translate a string. `{name}` placeholders are filled from vars; a numeric `count` picks the plural form. */
export function t(key: string, vars?: Record<string, string | number>) {
  const text = lookup(key, typeof vars?.count === 'number' ? vars.count : undefined);
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => name in vars ? (typeof vars[name] === 'number' ? (vars[name] as number).toLocaleString(locale()) : String(vars[name])) : match);
}

/** Like t(), but placeholders may be elements, e.g. tx('Add {amount} more', { amount: <strong>…</strong> }). */
export function tx(key: string, vars: Record<string, ReactNode>) {
  const count = typeof vars.count === 'number' ? vars.count : undefined;
  const parts = lookup(key, count).split(/(\{\w+\})/);
  return createElement(Fragment, null, ...parts.map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    const value = name && name in vars ? vars[name] : part;
    return createElement(Fragment, { key: index }, typeof value === 'number' ? value.toLocaleString(locale()) : value);
  }));
}

/** Server messages are English; translate exact matches, then known shapes such as "Not enough inventory for X". */
export function translateMessage(message: string) {
  if (current === 'en') return message;
  if (arabic?.[message]) return t(message);
  for (const [pattern, replacement] of patterns) if (pattern.test(message)) return message.replace(pattern, replacement);
  return message;
}
