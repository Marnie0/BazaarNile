import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Variant } from '../../lib/api';
import { t, tx } from '../../lib/i18n';
import { Field, Input } from '../ui/Field';

export type VariantDraft = { optionNames: string[]; variants: { id?: string; options: string[]; inventory: number }[] };

const splitValues = (text: string) => [...new Set(text.split(',').map((value) => value.trim()).filter(Boolean))];
const combinations = (lists: string[][]) => lists.reduce<string[][]>((rows, list) => rows.flatMap((row) => list.map((value) => [...row, value])), [[]]);
const keyOf = (options: string[]) => options.map((value) => value.toLowerCase()).join('\u0000');

/**
 * Size/colour options for a listing. Stock is entered per combination; the listing total is their sum.
 * Reports null while options are off, or a string describing what is missing.
 */
export function VariantEditor({ initialNames = [], initialVariants = [], onChange }: {
  initialNames?: string[]; initialVariants?: Variant[]; onChange: (draft: VariantDraft | null | string) => void;
}) {
  const [enabled, setEnabled] = useState(initialNames.length > 0);
  const [names, setNames] = useState<string[]>(initialNames.length ? initialNames : ['Size']);
  const [valueText, setValueText] = useState<string[]>(initialNames.length
    ? initialNames.map((_, index) => [...new Set(initialVariants.map((variant) => variant.options[index]!))].join(', '))
    : ['S, M, L, XL']);
  const [stock, setStock] = useState<Record<string, { id?: string; inventory: number }>>(() =>
    Object.fromEntries(initialVariants.map((variant) => [keyOf(variant.options), { id: variant.id, inventory: variant.inventory }])));

  const lists = valueText.map(splitValues);
  const rows = useMemo(() => lists.every((list) => list.length) ? combinations(lists) : [], [lists.map((list) => list.join('|')).join('/')]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = rows.reduce((sum, row) => sum + (stock[keyOf(row)]?.inventory ?? 0), 0);

  useEffect(() => {
    if (!enabled) { onChange(null); return; }
    const missing = names.findIndex((name, index) => !name.trim() || !lists[index]?.length);
    if (missing >= 0) { onChange(t('Give option {number} a name and at least one value', { number: missing + 1 })); return; }
    if (rows.length > 60) { onChange(t('That’s more than 60 combinations — trim a few values')); return; }
    onChange({ optionNames: names.map((name) => name.trim()), variants: rows.map((row) => ({ ...(stock[keyOf(row)]?.id && { id: stock[keyOf(row)]!.id }), options: row, inventory: stock[keyOf(row)]?.inventory ?? 0 })) });
  }, [enabled, names, valueText, stock]); // eslint-disable-line react-hooks/exhaustive-deps

  const setName = (index: number, value: string) => setNames((current) => current.map((name, i) => i === index ? value : name));
  const setValues = (index: number, value: string) => setValueText((current) => current.map((text, i) => i === index ? value : text));
  const addOption = () => { setNames((current) => [...current, 'Color']); setValueText((current) => [...current, 'Black, White']); };
  const removeOption = (index: number) => { setNames((current) => current.filter((_, i) => i !== index)); setValueText((current) => current.filter((_, i) => i !== index)); };

  return <fieldset className="rounded-2xl border border-ink/10 p-5">
    <legend className="px-1 text-sm font-semibold">{t('Options')}</legend>
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-0.5 size-4 accent-[#244e5a]"/>
      <span><strong className="font-semibold">{t('This product comes in sizes or colours')}</strong><span className="block text-ink/55">{t('Shoppers pick one before adding to cart, and stock is tracked per option.')}</span></span>
    </label>
    {enabled && <div className="mt-5 grid gap-4">
      {names.map((name, index) => <div key={index} className="grid gap-3 rounded-xl bg-sand/50 p-4 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <Field label={t('Option {number}', { number: index + 1 })}><Input value={name} onChange={(event) => setName(index, event.target.value)} maxLength={20} placeholder={index ? t('Color') : t('Size')} aria-label={t('Option {number} name', { number: index + 1 })}/></Field>
        <Field label={t('Values')} hint={t('Separate with commas')}><Input value={valueText[index]} onChange={(event) => setValues(index, event.target.value)} placeholder={index ? t('Black, White') : t('S, M, L')} aria-label={t('{name} values', { name: name || t('Option {number}', { number: index + 1 }) })}/></Field>
        {names.length > 1 && <button type="button" onClick={() => removeOption(index)} aria-label={t('Remove {name}', { name: name || t('option {number}', { number: index + 1 }) })} className="grid size-11 place-items-center rounded-full text-ink/45 hover:bg-white hover:text-red-700"><X size={17}/></button>}
      </div>)}
      {names.length < 2 && <button type="button" onClick={addOption} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-nile hover:underline"><Plus size={15}/>{t('Add a second option, like colour')}</button>}
      {rows.length > 0 && <div>
        <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">{t('Stock per option')}</p><p className="text-sm text-ink/55">{tx('Total {total}', { total: <strong className="text-ink">{total}</strong> })}</p></div>
        <ul className="mt-2 grid max-h-80 gap-2 overflow-y-auto pe-1 sm:grid-cols-2">{rows.map((row) => {
          const key = keyOf(row); const units = stock[key]?.inventory ?? 0;
          return <li key={key} className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 bg-white px-3 py-2">
            <span className="min-w-0 truncate text-sm font-medium">{row.join(' / ')}{units === 0 && <span className="ms-2 text-xs font-semibold text-red-700">{t('Sold out')}</span>}</span>
            <input type="number" inputMode="numeric" min="0" step="1" value={units} aria-label={t('Stock for {option}', { option: row.join(' / ') })}
              onChange={(event) => { const value = Math.max(0, Math.floor(event.currentTarget.valueAsNumber || 0)); setStock((current) => ({ ...current, [key]: { ...current[key], inventory: value } })); }}
              className="field w-20 shrink-0 px-2.5 py-1.5 text-end"/>
          </li>;
        })}</ul>
      </div>}
    </div>}
  </fieldset>;
}
