import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn, priceLabel } from '../lib/utils';
import { Button } from './ui/Button';
import { t } from '../lib/i18n';

// Labels come from priceLabel() so they read naturally in either language.
const presets = [
  { min: '', max: '500' },
  { min: '500', max: '1500' },
  { min: '1500', max: '5000' },
  { min: '5000', max: '' },
];

/** Price range popover: quick presets plus custom min/max, applied together. */
export function PriceFilter({ min, max, onApply }: { min: string; max: string; onApply: (range: { minPrice: string; maxPrice: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ min, max });
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setDraft({ min, max }); setError(''); } }, [open, min, max]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const apply = (range: { min: string; max: string }) => { onApply({ minPrice: range.min, maxPrice: range.max }); setOpen(false); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.min && draft.max && Number(draft.min) > Number(draft.max)) { setError(t('The minimum is higher than the maximum')); return; }
    apply(draft);
  };
  const label = priceLabel(min, max);

  return <div ref={ref} className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog"
      className={cn('flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-medium transition', label ? 'border-ink bg-ink text-white' : 'border-ink/10 bg-white text-ink hover:border-ink/30')}>
      {label || t('Price')}<ChevronDown size={15} className={cn('transition', open && 'rotate-180')}/>
    </button>
    {open && <div role="dialog" aria-label={t('Filter by price')} className="absolute start-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-2xl border border-ink/10 bg-white p-4 shadow-[0_18px_50px_rgba(19,33,27,.16)] md:start-auto md:end-0">
      <div className="grid gap-1">{presets.map((preset) => {
        const active = preset.min === min && preset.max === max;
        return <button key={`${preset.min}-${preset.max}`} type="button" onClick={() => apply(preset)} aria-pressed={active}
          className={cn('rounded-xl px-3 py-2 text-start text-sm transition', active ? 'bg-nile-light/70 font-semibold text-nile' : 'hover:bg-sand')}>{priceLabel(preset.min, preset.max)}</button>;
      })}</div>
      <form onSubmit={submit} className="mt-3 border-t border-ink/8 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">{t('Custom range (EGP)')}</p>
        <div className="mt-2 flex items-center gap-2">
          <input aria-label={t('Minimum price')} type="number" inputMode="numeric" min="0" step="1" placeholder={t('Min')} value={draft.min} onChange={(event) => { setDraft({ ...draft, min: event.target.value }); setError(''); }} className="field min-w-0 flex-1 py-2"/>
          <span className="text-ink/40">–</span>
          <input aria-label={t('Maximum price')} type="number" inputMode="numeric" min="0" step="1" placeholder={t('Max')} value={draft.max} onChange={(event) => { setDraft({ ...draft, max: event.target.value }); setError(''); }} className="field min-w-0 flex-1 py-2"/>
        </div>
        {error && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p>}
        <div className="mt-3 flex gap-2">
          <Button type="submit" className="flex-1 py-2">{t('Apply')}</Button>
          {label && <Button type="button" variant="ghost" className="py-2" onClick={() => apply({ min: '', max: '' })}><X size={15}/>{t('Clear')}</Button>}
        </div>
      </form>
    </div>}
  </div>;
}
