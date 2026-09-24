import { Languages } from 'lucide-react';
import { useState } from 'react';
import { getLanguage, setLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

/** Switches between English and Arabic. Each option is labelled in its own language so anyone can find it. */
export function LanguageSwitch({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const next = getLanguage() === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? 'العربية' : 'English';
  return <button type="button" disabled={busy} lang={next} onClick={() => { setBusy(true); setLanguage(next).finally(() => setBusy(false)); }}
    aria-label={next === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'} title={label}
    className={cn('inline-flex items-center gap-1.5 rounded-full text-sm font-semibold transition hover:bg-nile-light/60 disabled:opacity-60', compact ? 'size-10 justify-center' : 'px-3 py-2', className)}>
    <Languages size={compact ? 19 : 17} aria-hidden="true"/>{!compact && <span>{label}</span>}
  </button>;
}
