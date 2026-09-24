import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, ChevronDown, CircleDollarSign, Minus, PackageCheck, PackageX, Plus, RotateCcw, Search, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Badge } from '../ui/Badge';
import { productStatus } from '../../lib/status';
import { api, type AdminProduct, type InventorySummary } from '../../lib/api';
import { toast, toastError } from '../../lib/toast';
import { formatNumber, money, stockLevel, type StockLevel } from '../../lib/utils';
import { t } from '../../lib/i18n';
import { Button } from '../ui/Button';

type StockFilter = '' | 'low' | 'out' | 'in';
type Sort = 'stock-asc' | 'stock-desc' | 'name' | 'updated';
type Pagination = { page: number; limit: number; total: number; pages: number };

const MAX_STOCK = 1_000_000;
const levelStyle: Record<StockLevel, { bar: string; text: string; label: (units: number) => string }> = {
  out: { bar: 'bg-red-600', text: 'text-red-700', label: () => t('Out of stock') },
  urgent: { bar: 'bg-red-500', text: 'text-red-700', label: (units) => t('Only {count} left', { count: units }) },
  low: { bar: 'bg-amber-500', text: 'text-amber-700', label: () => t('Running low') },
  ok: { bar: 'bg-emerald-600', text: 'text-emerald-700', label: () => t('In stock') },
};
const filters: { id: StockFilter; label: string }[] = [
  { id: '', label: 'All' }, { id: 'low', label: 'Running low' }, { id: 'out', label: 'Out of stock' }, { id: 'in', label: 'Healthy' },
];

export function StockMeter({ units }: { units: number }) {
  const level = stockLevel(units);
  const style = levelStyle[level];
  // The bar fills at 30 units; beyond that stock is comfortably healthy.
  const width = units <= 0 ? 0 : Math.max(6, Math.min(100, (units / 30) * 100));
  return <div className="min-w-0">
    <div className="flex items-baseline justify-between gap-2"><span className={`text-sm font-semibold ${style.text}`}>{style.label(units)}</span><span className="text-xs tabular-nums text-ink/55">{t('{count} units', { count: units })}</span></div>
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/8" aria-hidden="true"><div className={`h-full rounded-full transition-all duration-500 ${style.bar}`} style={{ width: `${width}%` }}/></div>
  </div>;
}

/** Minus / number / plus control that saves on Enter or the Save button; Esc undoes. */
function StockStepper({ units, label, saving, onSave, compact = false }: { units: number; label: string; saving: boolean; onSave: (units: number) => void; compact?: boolean }) {
  const [draft, setDraft] = useState(String(units));
  const value = Number(draft);
  const valid = draft.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= MAX_STOCK;
  const dirty = valid && value !== units;
  const adjust = (delta: number) => setDraft(String(Math.min(MAX_STOCK, Math.max(0, (valid ? value : units) + delta))));
  const commit = () => { if (dirty && !saving) onSave(value); };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') setDraft(String(units));
  };
  return <div className="flex flex-wrap items-center gap-2 sm:justify-end">
    <div className={`flex items-center rounded-full border bg-white focus-within:ring-2 focus-within:ring-nile/30 ${valid ? 'border-ink/12' : 'border-red-400'}`}>
      <button type="button" onClick={() => adjust(-1)} disabled={saving || (valid ? value : units) <= 0} aria-label={t('Decrease stock for {label}', { label })} className="grid size-9 place-items-center rounded-full disabled:opacity-30"><Minus size={14}/></button>
      <input value={draft} onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, '').slice(0, 7))} onKeyDown={onKey} onFocus={(event) => event.currentTarget.select()} inputMode="numeric" aria-label={t('Stock for {label}', { label })} aria-invalid={!valid} disabled={saving} className="w-14 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"/>
      <button type="button" onClick={() => adjust(1)} disabled={saving} aria-label={t('Increase stock for {label}', { label })} className="grid size-9 place-items-center rounded-full disabled:opacity-30"><Plus size={14}/></button>
    </div>
    {dirty || saving ? <>
      <Button className="px-4 py-2" disabled={!dirty || saving} onClick={commit}>{saving ? t('Saving…') : t('Save')}</Button>
      <button type="button" onClick={() => setDraft(String(units))} disabled={saving} aria-label={t('Undo change')} title={t('Undo')} className="grid size-9 place-items-center rounded-full text-ink/50 hover:bg-sand hover:text-ink"><RotateCcw size={15}/></button>
    </> : <div className="flex gap-1.5">{(compact ? [5] : [10, 25]).map((amount) => <button key={amount} type="button" onClick={() => adjust(amount)} className="rounded-full border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/70 transition hover:border-nile/40 hover:text-nile">+{amount}</button>)}</div>}
  </div>;
}

const refreshKeys = ['admin-inventory', 'admin-inventory-summary', 'admin-overview', 'admin-products', 'products', 'product', 'featured', 'latest'];

function InventoryRow({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const variants = product.variants ?? [];
  const hasOptions = product.optionNames.length > 0 && variants.length > 0;
  const refresh = () => Promise.all(refreshKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  const save = useMutation({
    mutationFn: (inventory: number) => api<{ product: AdminProduct }>(`/admin/products/${product.id}/inventory`, { method: 'PATCH', body: JSON.stringify({ inventory }) }),
    onSuccess: async ({ product: saved }) => { toast(t('{name}: stock set to {count}', { name: saved.name, count: saved.inventory })); await refresh(); },
    onError: (error) => toastError(error, t('Could not update stock')),
  });
  const saveVariant = useMutation({
    mutationFn: ({ variantId, inventory }: { variantId: string; inventory: number }) => api<{ product: AdminProduct }>(`/admin/products/${product.id}/variants/${variantId}/inventory`, { method: 'PATCH', body: JSON.stringify({ inventory }) }),
    onSuccess: async (_, { variantId, inventory }) => {
      const variant = variants.find((item) => item.id === variantId);
      toast(t('{name} ({options}): stock set to {count}', { name: product.name, options: variant?.options.join(' / ') ?? '', count: inventory })); await refresh();
    },
    onError: (error) => toastError(error, t('Could not update stock')),
  });
  const soldOutOptions = variants.filter((variant) => variant.inventory <= 0).length;

  return <li className="p-4 sm:p-5">
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.3fr)_17rem] lg:items-center lg:gap-6">
      <div className="flex min-w-0 items-center gap-3.5 sm:col-span-2 lg:col-span-1">
        <img src={product.imageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover sm:size-16"/>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {product.status === 'ACTIVE' ? <Link to={`/products/${product.slug}`} className="truncate font-semibold hover:text-clay">{product.name}</Link> : <p className="truncate font-semibold">{product.name}</p>}
            {product.status !== 'ACTIVE' && <Badge tone={productStatus[product.status].tone} title={productStatus[product.status].help}>{productStatus[product.status].label}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink/55">{t(product.category.name)} · {money(product.price)} · {product.seller.displayName}</p>
        </div>
      </div>
      <StockMeter units={product.inventory}/>
      {hasOptions ? <div className="flex sm:justify-end">
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={`options-${product.id}`} className="flex items-center gap-2 rounded-full border border-ink/12 bg-white px-4 py-2 text-sm font-semibold transition hover:border-nile/40 hover:text-nile">
          {t('{count} {names} options', { count: variants.length, names: product.optionNames.map((name) => t(name)).join(' / ').toLowerCase() })}{soldOutOptions > 0 && <span className="rounded-full bg-red-100 px-1.5 text-[11px] text-red-700">{t('{count} out', { count: soldOutOptions })}</span>}<ChevronDown size={15} className={`transition ${expanded ? 'rotate-180' : ''}`}/>
        </button>
      </div> : <StockStepper key={product.inventory} units={product.inventory} label={product.name} saving={save.isPending} onSave={(units) => save.mutate(units)}/>}
    </div>
    {hasOptions && expanded && <ul id={`options-${product.id}`} className="mt-4 grid gap-2 rounded-2xl bg-sand/50 p-3 sm:p-4 lg:ms-[4.9rem]">
      {variants.map((variant) => { const level = levelStyle[stockLevel(variant.inventory)]; return <li key={`${variant.id}-${variant.inventory}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
        <span className="min-w-0 text-sm"><strong className="font-semibold">{variant.options.join(' / ')}</strong> <span className={`ms-1 text-xs font-semibold ${level.text}`}>{level.label(variant.inventory)}</span></span>
        <StockStepper compact units={variant.inventory} label={`${product.name} ${variant.options.join(' / ')}`} saving={saveVariant.isPending && saveVariant.variables?.variantId === variant.id} onSave={(inventory) => saveVariant.mutate({ variantId: variant.id, inventory })}/>
      </li>; })}
    </ul>}
  </li>;
}

export function InventoryPanel() {
  const [filter, setFilter] = useState<StockFilter>('');
  const [sort, setSort] = useState<Sort>('stock-asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const summary = useQuery({ queryKey: ['admin-inventory-summary'], queryFn: () => api<{ summary: InventorySummary }>('/admin/inventory/summary') });
  const params = new URLSearchParams({ sort, page: String(page), limit: '20', ...(filter && { stock: filter }), ...(debouncedSearch && { search: debouncedSearch }) });
  const products = useQuery({
    queryKey: ['admin-inventory', params.toString()], placeholderData: keepPreviousData,
    queryFn: () => api<{ products: AdminProduct[]; pagination: Pagination }>(`/admin/products?${params}`),
  });
  const choose = (next: StockFilter) => { setFilter(next); setPage(1); };
  const data = summary.data?.summary;
  const tiles = [
    { label: t('Units in stock'), value: data ? formatNumber(data.unitsInStock) : '—', detail: data ? t('Across {count} listings', { count: data.products }) : '', icon: Boxes, tone: 'bg-nile-light text-nile' },
    { label: t('Retail value in stock'), value: data ? money(data.stockValue) : '—', detail: t('At current prices'), icon: CircleDollarSign, tone: 'bg-nile-light text-nile' },
    { label: t('Running low'), value: data?.lowStock ?? '—', detail: data ? t('1–{count} units left', { count: data.lowStockThreshold }) : '', icon: AlertTriangle, tone: 'bg-amber-100 text-amber-800', filter: 'low' as const },
    { label: t('Out of stock'), value: data?.outOfStock ?? '—', detail: t('Hidden from checkout'), icon: PackageX, tone: 'bg-red-100 text-red-700', filter: 'out' as const },
  ];
  const list = products.data?.products ?? [];
  const pagination = products.data?.pagination;

  return <section className="pt-8">
    <div><h2 className="font-display text-3xl font-semibold">{t('Inventory')}</h2><p className="text-sm text-ink/55">{t('See what’s left, restock quickly, and catch items before they sell out.')}</p></div>

    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{tiles.map(({ label, value, detail, icon: Icon, tone, filter: target }) => {
      const active = Boolean(target) && filter === target;
      const content = <><div className="flex items-start justify-between gap-2"><p className="text-sm text-ink/60">{label}</p><span className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}><Icon size={16}/></span></div><p className="mt-3 text-xl font-bold tabular-nums sm:text-2xl">{value}</p><p className="mt-0.5 text-xs text-ink/50">{detail}</p></>;
      return target ? <button key={label} type="button" onClick={() => choose(active ? '' : target)} aria-pressed={active} className={`rounded-2xl border bg-white p-4 text-start transition hover:border-ink/25 sm:p-5 ${active ? 'border-ink ring-2 ring-ink/10' : 'border-ink/8'}`}>{content}</button>
        : <article key={label} className="rounded-2xl border border-ink/8 bg-white p-4 sm:p-5">{content}</article>;
    })}</div>

    <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="group" aria-label={t('Filter by stock level')}>{filters.map(({ id, label }) => <button key={label} type="button" onClick={() => choose(id)} aria-pressed={filter === id} className={`chip ${filter === id ? 'is-active' : ''}`}>{t(label)}{id === 'low' && data?.lowStock ? <span className="opacity-60">{data.lowStock}</span> : id === 'out' && data?.outOfStock ? <span className="opacity-60">{data.outOfStock}</span> : null}</button>)}</div>
      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-ink/12 bg-white ps-4 pe-1.5 focus-within:border-nile/50 lg:w-64 lg:flex-none"><Search size={16} className="shrink-0 text-ink/40"/><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('Search products…')} aria-label={t('Search inventory')} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"/>{search && <button type="button" onClick={() => setSearch('')} aria-label={t('Clear search')} className="grid size-7 place-items-center rounded-full text-ink/40 hover:bg-sand"><X size={14}/></button>}</label>
        <select value={sort} onChange={(event) => { setSort(event.target.value as Sort); setPage(1); }} aria-label={t('Sort inventory')} className="field select-field w-auto rounded-full py-2.5 text-sm"><option value="stock-asc">{t('Lowest stock first')}</option><option value="stock-desc">{t('Highest stock first')}</option><option value="name">{t('Name A–Z')}</option><option value="updated">{t('Recently updated')}</option></select>
      </div>
    </div>

    <div className={`surface mt-5 overflow-hidden transition-opacity ${products.isFetching && !products.isLoading ? 'opacity-70' : ''}`}>
      <div className="hidden grid-cols-[minmax(0,2.3fr)_minmax(0,1.3fr)_17rem] gap-6 border-b border-ink/8 bg-sand/50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink/50 lg:grid"><span>{t('Product')}</span><span>{t('Stock left')}</span><span className="text-end">{t('Adjust')}</span></div>
      {products.isLoading ? <ul className="divide-y divide-ink/8">{Array.from({ length: 5 }, (_, index) => <li key={index} className="flex animate-pulse items-center gap-4 p-5"><div className="size-14 rounded-xl bg-ink/8"/><div className="flex-1"><div className="h-4 w-1/2 rounded bg-ink/8"/><div className="mt-2 h-3 w-1/3 rounded bg-ink/8"/></div></li>)}</ul>
        : list.length ? <ul className="divide-y divide-ink/8">{list.map((product) => <InventoryRow key={product.id} product={product}/>)}</ul>
        : <div className="grid place-items-center px-6 py-16 text-center"><PackageCheck className="text-nile" size={32}/><h3 className="mt-3 font-display text-2xl font-semibold">{filter === 'out' ? t('Nothing is out of stock') : filter === 'low' ? t('Nothing is running low') : t('No matching products')}</h3><p className="mt-1 text-sm text-ink/55">{filter ? t('Every listing in this view is well stocked.') : t('Try a different search.')}</p></div>}
    </div>

    {pagination && pagination.pages > 1 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-ink/60"><span>{t('{from}–{to} of {total}', { from: (pagination.page - 1) * pagination.limit + 1, to: Math.min(pagination.page * pagination.limit, pagination.total), total: pagination.total })}</span><div className="flex items-center gap-2"><Button variant="outline" className="px-4 py-2" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>{t('Previous')}</Button><Button variant="outline" className="px-4 py-2" disabled={pagination.page >= pagination.pages} onClick={() => setPage(pagination.page + 1)}>{t('Next')}</Button></div></div>}
    <p className="mt-4 text-xs text-ink/50">{t('Tip: type a number and press Enter to save, or Esc to undo. Listings with sizes or colours are restocked per option. Shoppers see “Only N left” in red when 3 or fewer remain.')}</p>
  </section>;
}
