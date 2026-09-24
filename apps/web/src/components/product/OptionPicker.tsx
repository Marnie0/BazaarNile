import type { Variant } from '../../lib/api';
import { type Selection } from '../../lib/variants';
import { t } from '../../lib/i18n';

export function OptionPicker({ optionNames, variants, selection, onChange, missing }: {
  optionNames: string[]; variants: Variant[]; selection: Selection; onChange: (selection: Selection) => void; missing: boolean;
}) {
  return <div className="grid gap-5" id="product-options">
    {optionNames.map((name, index) => {
      const values = [...new Set(variants.map((variant) => variant.options[index]!))];
      // A value is available when some in-stock variant has it alongside the other current choices.
      const available = (value: string) => variants.some((variant) => variant.inventory > 0 && variant.options[index] === value
        && variant.options.every((other, otherIndex) => otherIndex === index || !selection[otherIndex] || selection[otherIndex] === other));
      const choose = (value: string) => {
        const next = [...selection]; next[index] = value;
        // Drop other choices that no longer form a real combination.
        next.forEach((other, otherIndex) => {
          if (otherIndex !== index && other && !variants.some((variant) => variant.options[index] === value && variant.options[otherIndex] === other)) next[otherIndex] = null;
        });
        onChange(next);
      };
      const unchosen = missing && !selection[index];
      return <fieldset key={name}>
        <legend className="flex w-full items-baseline justify-between gap-3 text-sm font-semibold">
          <span>{t(name)}{selection[index] && <span className="font-normal text-ink/60">: {selection[index]}</span>}</span>
          {unchosen && <span className="text-xs font-semibold text-red-700" role="alert">{t('Choose a {option}', { option: t(name).toLowerCase() })}</span>}
        </legend>
        <div className={`mt-2.5 flex flex-wrap gap-2 rounded-2xl ${unchosen ? 'outline-2 outline-offset-4 outline-red-300' : ''}`}>
          {values.map((value) => {
            const inStock = available(value); const active = selection[index] === value;
            return <button key={value} type="button" onClick={() => choose(value)} aria-pressed={active}
              aria-label={inStock ? `${t(name)} ${value}` : t('{option} {value}, sold out', { option: t(name), value })}
              className={`relative min-w-12 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${active ? 'border-ink bg-ink text-white' : inStock ? 'border-ink/15 bg-white hover:border-ink/50' : 'border-dashed border-ink/15 bg-transparent text-ink/35 line-through decoration-ink/30'}`}>
              {value}
            </button>;
          })}
        </div>
      </fieldset>;
    })}
  </div>;
}
