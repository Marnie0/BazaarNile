import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, SearchX, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, PageIntro } from '../components/PageState';
import { ProductSkeleton } from '../components/Skeleton';
import { Button } from '../components/ui/Button';
import { ScrollRow } from '../components/ui/ScrollRow';
import { PriceFilter } from '../components/PriceFilter';
import { SearchInput } from '../components/SearchInput';
import { api, type Category, type Product } from '../lib/api';
import { priceLabel } from '../lib/utils';
import { t } from '../lib/i18n';

type ProductPage = { products: Product[]; pagination: { page: number; limit: number; total: number; pages: number } };
const sorts = [['newest', 'Newest first'], ['rating', 'Top rated'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low']] as const;

function pageWindow(page: number, pages: number) {
  const numbers = new Set([1, pages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pages));
  return [...numbers].sort((a, b) => a - b);
}

export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const featured = params.get('featured') === 'true';
  const onSale = params.get('onSale') === 'true';
  const inStock = params.get('inStock') === 'true';
  const sort = params.get('sort') ?? 'newest';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const topRated = params.get('minRating') === '4';
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);
  const query = params.toString();
  const { data, isLoading, isFetching, isError, refetch } = useQuery({ queryKey: ['products', query], queryFn: () => api<ProductPage>(`/products?${query}`), placeholderData: keepPreviousData });
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => api<{ categories: Category[] }>('/categories'), staleTime: 5 * 60_000 });
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); update({ search: draft.trim() }); };
  const activeCategory = cats?.categories.find((item) => item.slug === category);
  const title = search ? t('Results for “{search}”', { search }) : activeCategory ? t(activeCategory.name) : onSale ? t('Deals of the week') : featured ? t('Featured finds') : t('The Bazaar');
  const filters = [
    ...(search ? [{ key: 'search', label: `“${search}”` }] : []),
    ...(activeCategory ? [{ key: 'category', label: t(activeCategory.name) }] : []),
    ...(featured ? [{ key: 'featured', label: t('Featured') }] : []),
    ...(onSale ? [{ key: 'onSale', label: t('On sale') }] : []),
    ...(inStock ? [{ key: 'inStock', label: t('In stock') }] : []),
    ...(topRated ? [{ key: 'minRating', label: t('4★ & up') }] : []),
    ...(minPrice || maxPrice ? [{ key: 'price', label: priceLabel(minPrice, maxPrice) }] : []),
  ];
  const pagination = data?.pagination;
  const firstShown = pagination && pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const lastShown = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  return <main className="container-shell py-10 sm:py-14">
    <PageIntro eyebrow={t('Explore the collection')} title={title}>
      {activeCategory?.description ?? t('Independent sellers, thoughtfully reviewed listings, and cash on delivery across Egypt.')}
    </PageIntro>

    <div className="z-30 -mx-4 mt-8 border-y border-ink/8 bg-[#fbf8f1]/95 px-4 py-3 backdrop-blur-md md:sticky md:top-[4.5rem]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form onSubmit={submitSearch} className="relative hidden flex-1 items-center md:flex gap-2 rounded-full border border-ink/10 bg-white ps-4 pe-1.5 focus-within:border-nile/50 focus-within:ring-4 focus-within:ring-nile/8" role="search">
          <Search size={17} className="shrink-0 text-ink/40" aria-hidden="true"/>
          <SearchInput value={draft} onValueChange={setDraft} maxLength={100} placeholder={t('What are you looking for?')} aria-label={t('Search products')} className="min-w-0 flex-1 bg-transparent py-2.5 outline-none [&::-webkit-search-cancel-button]:hidden"/>
          {draft && <button type="button" onClick={() => { setDraft(''); if (search) update({ search: '' }); }} aria-label={t('Clear search')} className="grid size-8 place-items-center rounded-full text-ink/40 hover:bg-sand hover:text-ink"><X size={15}/></button>}
          <Button type="submit" className="px-4 py-2">{t('Search')}</Button>
        </form>
        <div className="flex items-center gap-2">
        <PriceFilter min={minPrice} max={maxPrice} onApply={update}/>
        <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink/60"><span className="hidden shrink-0 sm:inline">{t('Sort by')}</span>
          <select value={sort} onChange={(event) => update({ sort: event.target.value === 'newest' ? '' : event.target.value })} className="field select-field rounded-full py-2.5 pe-8 text-ink">{sorts.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
        </label>
        </div>
      </div>
      <ScrollRow frameClassName="-mx-4 mt-3" className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-0.5" role="group" aria-label={t('Filter by category')}>
        <button type="button" onClick={() => update({ category: '' })} aria-pressed={!category} className={`chip ${!category ? 'is-active' : ''}`}>{t('All')}</button>
        <button type="button" onClick={() => update({ onSale: onSale ? '' : 'true' })} aria-pressed={onSale} className={`chip ${onSale ? 'is-active' : ''}`}>{t('On sale')}</button>
        <button type="button" onClick={() => update({ inStock: inStock ? '' : 'true' })} aria-pressed={inStock} className={`chip ${inStock ? 'is-active' : ''}`}>{t('In stock')}</button>
        <button type="button" onClick={() => update({ minRating: topRated ? '' : '4' })} aria-pressed={topRated} className={`chip ${topRated ? 'is-active' : ''}`}>{t('4★ & up')}</button>
        <button type="button" onClick={() => update({ featured: featured ? '' : 'true' })} aria-pressed={featured} className={`chip ${featured ? 'is-active' : ''}`}>{t('Featured')}</button>
        <span className="mx-1 w-px shrink-0 self-stretch bg-ink/12" aria-hidden="true"/>
        {cats?.categories.map((item) => <button type="button" key={item.id} onClick={() => update({ category: item.slug === category ? '' : item.slug })} aria-pressed={item.slug === category} className={`chip ${item.slug === category ? 'is-active' : ''}`}>{t(item.name)}{item._count && <span className="opacity-55">{item._count.products}</span>}</button>)}
      </ScrollRow>
    </div>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-ink/60" aria-live="polite">
      <p>{isLoading ? t('Finding products…') : pagination?.total ? t('Showing {first}–{last} of {total} products', { first: firstShown, last: lastShown, total: pagination.total }) : ''}</p>
      {filters.length > 0 && <div className="flex flex-wrap items-center gap-2">{filters.map((filter) => <button key={filter.key} type="button" onClick={() => update(filter.key === 'price' ? { minPrice: '', maxPrice: '' } : { [filter.key]: '' })} className="inline-flex items-center gap-1.5 rounded-full bg-nile-light/70 px-3 py-1.5 text-xs font-semibold text-nile hover:bg-nile-light" aria-label={t('Remove filter {label}', { label: filter.label })}>{filter.label}<X size={13}/></button>)}<button type="button" onClick={() => setParams(new URLSearchParams(sort !== 'newest' ? { sort } : {}))} className="text-xs font-semibold text-ink/55 underline underline-offset-4 hover:text-ink">{t('Clear all')}</button></div>}
    </div>

    {isError ? <EmptyState icon={SearchX} title={t('We couldn’t load products')} action={<Button variant="outline" onClick={() => refetch()}>{t('Try again')}</Button>}>{t('Check your connection, then try again.')}</EmptyState>
      : !isLoading && !data?.products.length ? <EmptyState icon={SearchX} title={t('No products found')} action={filters.length ? <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>{t('Clear filters')}</Button> : undefined}>{t('Try a broader search, another category, or check the spelling.')}</EmptyState>
      : <div className={`product-grid mt-6 transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>{isLoading ? Array.from({ length: 8 }, (_, i) => <ProductSkeleton key={i}/>) : data?.products.map((p) => <ProductCard product={p} key={p.id}/>)}</div>}

    {pagination && pagination.pages > 1 && <nav className="mt-14 flex items-center justify-center gap-1.5" aria-label={t('Pagination')}>
      <Button variant="outline" size="icon" disabled={pagination.page <= 1} onClick={() => update({ page: String(pagination.page - 1) })} aria-label={t('Previous page')}><ChevronLeft size={18}/></Button>
      {pageWindow(pagination.page, pagination.pages).map((number, index, all) => <span key={number} className="flex items-center gap-1.5">
        {index > 0 && number - all[index - 1] > 1 && <span className="px-1 text-ink/40">…</span>}
        <button type="button" onClick={() => update({ page: number === 1 ? '' : String(number) })} aria-current={number === pagination.page ? 'page' : undefined} className={`grid size-10 place-items-center rounded-full text-sm font-semibold transition ${number === pagination.page ? 'bg-ink text-white' : 'hover:bg-nile-light/60'}`}>{number}</button>
      </span>)}
      <Button variant="outline" size="icon" disabled={pagination.page >= pagination.pages} onClick={() => update({ page: String(pagination.page + 1) })} aria-label={t('Next page')}><ChevronRight size={18}/></Button>
    </nav>}
  </main>;
}
