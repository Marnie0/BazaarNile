import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { LayoutGrid, Search } from 'lucide-react';
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, type SearchSuggestions } from '../lib/api';
import { cn, money } from '../lib/utils';
import { t, tx } from '../lib/i18n';

type Option = { key: string; to: string; label: ReactNode; detail?: ReactNode; image?: string; icon?: typeof Search };

function highlight(text: string, term: string) {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0 || !term) return text;
  return <>{text.slice(0, index)}<mark className="bg-transparent font-bold text-ink">{text.slice(index, index + term.length)}</mark>{text.slice(index + term.length)}</>;
}

/**
 * A search input with type-ahead suggestions (ARIA combobox). Place it inside a `relative` form: Enter
 * with nothing highlighted submits that form as usual, while arrow keys pick a suggestion.
 */
export function SearchInput({ value, onValueChange, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onValueChange: (value: string) => void }) {
  const navigate = useNavigate(); const location = useLocation();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const trimmed = value.trim();
  const term = useDebouncedValue(trimmed, 180);
  const { data } = useQuery({
    queryKey: ['suggest', term.toLowerCase()], queryFn: () => api<SearchSuggestions>(`/search/suggest?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2, staleTime: 60_000, placeholderData: keepPreviousData,
  });
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { setActive(-1); }, [term]);

  const options: Option[] = trimmed.length >= 2 && data ? [
    { key: 'search', to: `/shop?search=${encodeURIComponent(trimmed)}`, label: tx('Search for “{term}”', { term: <strong>{trimmed}</strong> }), icon: Search },
    ...data.categories.map((category) => ({ key: `c-${category.slug}`, to: `/shop?category=${category.slug}`, label: highlight(t(category.name), term), detail: t('Category'), icon: LayoutGrid })),
    ...data.products.map((product) => ({ key: product.id, to: `/products/${product.slug}`, label: highlight(product.name, term), detail: <>{t(product.category.name)} · {money(product.price)}</>, image: product.imageUrl })),
  ] : [];
  const show = open && options.length > 1;
  const go = (option: Option) => { setOpen(false); navigate(option.to); };

  return <>
    <input {...props} type="search" value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={show} aria-controls={listId}
      aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined} className={className}
      onChange={(event) => { onValueChange(event.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && show) { event.preventDefault(); setOpen(false); return; }
        if (!show) { if (event.key === 'ArrowDown' && options.length > 1) { setOpen(true); event.preventDefault(); } return; }
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => (index + 1) % options.length); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => (index <= 0 ? options.length : index) - 1); }
        else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); go(options[active]!); }
      }}/>
    {show && <ul id={listId} role="listbox" aria-label={t('Search suggestions')} className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(26rem,70svh)] overflow-y-auto rounded-2xl border border-ink/10 bg-white p-1.5 text-start shadow-[0_18px_50px_rgba(19,33,27,.16)]">
      {options.map((option, index) => {
        const Icon = option.icon;
        return <li key={option.key} id={`${listId}-${index}`} role="option" aria-selected={index === active}
          // mousedown keeps focus in the input, so blur doesn't close the list before the click lands.
          onMouseDown={(event) => event.preventDefault()} onClick={() => go(option)} onMouseEnter={() => setActive(index)}
          className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-ink/75', index === active && 'bg-nile-light/60 text-ink')}>
          {option.image ? <img src={option.image.replace(/w=\d+/, 'w=120')} alt="" className="size-10 shrink-0 rounded-lg object-cover"/> : Icon && <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sand text-ink/55"><Icon size={17}/></span>}
          <span className="min-w-0 flex-1"><span className="block truncate">{option.label}</span>{option.detail && <span className="block truncate text-xs text-ink/50">{option.detail}</span>}</span>
        </li>;
      })}
    </ul>}
  </>;
}
