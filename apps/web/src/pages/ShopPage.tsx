import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, SearchX, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, PageIntro } from '../components/PageState';
import { ProductSkeleton } from '../components/Skeleton';
import { Button } from '../components/ui/Button';
import { api, type Category, type Product } from '../lib/api';

type ProductPage = { products: Product[]; pagination: { page: number; limit: number; total: number; pages: number } };
const sorts = [['newest', 'Newest first'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low']] as const;

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
  const title = search ? <>Results for “{search}”</> : activeCategory?.name ?? (onSale ? 'Deals of the week' : featured ? 'Featured finds' : 'The Bazaar');
  const filters = [
    ...(search ? [{ key: 'search', label: `“${search}”` }] : []),
    ...(activeCategory ? [{ key: 'category', label: activeCategory.name }] : []),
    ...(featured ? [{ key: 'featured', label: 'Featured' }] : []),
    ...(onSale ? [{ key: 'onSale', label: 'On sale' }] : []),
    ...(inStock ? [{ key: 'inStock', label: 'In stock' }] : []),
  ];
  const pagination = data?.pagination;
  const firstShown = pagination && pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const lastShown = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  return <main className="container-shell py-10 sm:py-14">
    <PageIntro eyebrow="Explore the collection" title={title}>
      {activeCategory?.description ?? 'Independent sellers, thoughtfully reviewed listings, and cash on delivery across Egypt.'}
    </PageIntro>

    <div className="z-30 -mx-4 mt-8 border-y border-ink/8 bg-[#fbf8f1]/95 px-4 py-3 backdrop-blur-md md:sticky md:top-[4.5rem]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form onSubmit={submitSearch} className="hidden flex-1 items-center md:flex gap-2 rounded-full border border-ink/10 bg-white pl-4 pr-1.5 focus-within:border-nile/50 focus-within:ring-4 focus-within:ring-nile/8" role="search">
          <Search size={17} className="shrink-0 text-ink/40" aria-hidden="true"/>
          <input type="search" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={100} placeholder="What are you looking for?" aria-label="Search products" className="min-w-0 flex-1 bg-transparent py-2.5 outline-none [&::-webkit-search-cancel-button]:hidden"/>
          {draft && <button type="button" onClick={() => { setDraft(''); if (search) update({ search: '' }); }} aria-label="Clear search" className="grid size-8 place-items-center rounded-full text-ink/40 hover:bg-sand hover:text-ink"><X size={15}/></button>}
          <Button type="submit" className="px-4 py-2">Search</Button>
        </form>
        <label className="flex items-center gap-2 text-sm font-medium text-ink/60"><span className="shrink-0">Sort by</span>
          <select value={sort} onChange={(event) => update({ sort: event.target.value === 'newest' ? '' : event.target.value })} className="field select-field rounded-full py-2.5 pr-8 text-ink">{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5" role="group" aria-label="Filter by category">
        <button type="button" onClick={() => update({ category: '' })} aria-pressed={!category} className={`chip ${!category ? 'is-active' : ''}`}>All</button>
        <button type="button" onClick={() => update({ onSale: onSale ? '' : 'true' })} aria-pressed={onSale} className={`chip ${onSale ? 'is-active' : ''}`}>On sale</button>
        <button type="button" onClick={() => update({ inStock: inStock ? '' : 'true' })} aria-pressed={inStock} className={`chip ${inStock ? 'is-active' : ''}`}>In stock</button>
        <button type="button" onClick={() => update({ featured: featured ? '' : 'true' })} aria-pressed={featured} className={`chip ${featured ? 'is-active' : ''}`}>Featured</button>
        <span className="mx-1 w-px shrink-0 self-stretch bg-ink/12" aria-hidden="true"/>
        {cats?.categories.map((item) => <button type="button" key={item.id} onClick={() => update({ category: item.slug === category ? '' : item.slug })} aria-pressed={item.slug === category} className={`chip ${item.slug === category ? 'is-active' : ''}`}>{item.name}{item._count && <span className="opacity-55">{item._count.products}</span>}</button>)}
      </div>
    </div>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-ink/60" aria-live="polite">
      <p>{isLoading ? 'Finding products…' : pagination?.total ? `Showing ${firstShown}–${lastShown} of ${pagination.total} products` : ''}</p>
      {filters.length > 0 && <div className="flex flex-wrap items-center gap-2">{filters.map((filter) => <button key={filter.key} type="button" onClick={() => update({ [filter.key]: '' })} className="inline-flex items-center gap-1.5 rounded-full bg-nile-light/70 px-3 py-1.5 text-xs font-semibold text-nile hover:bg-nile-light" aria-label={`Remove filter ${filter.label}`}>{filter.label}<X size={13}/></button>)}<button type="button" onClick={() => setParams(new URLSearchParams(sort !== 'newest' ? { sort } : {}))} className="text-xs font-semibold text-ink/55 underline underline-offset-4 hover:text-ink">Clear all</button></div>}
    </div>

    {isError ? <EmptyState icon={SearchX} title="We couldn’t load products" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>}>Check your connection, then try again.</EmptyState>
      : !isLoading && !data?.products.length ? <EmptyState icon={SearchX} title="No products found" action={filters.length ? <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>Clear filters</Button> : undefined}>Try a broader search, another category, or check the spelling.</EmptyState>
      : <div className={`product-grid mt-6 transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>{isLoading ? Array.from({ length: 8 }, (_, i) => <ProductSkeleton key={i}/>) : data?.products.map((p) => <ProductCard product={p} key={p.id}/>)}</div>}

    {pagination && pagination.pages > 1 && <nav className="mt-14 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <Button variant="outline" size="icon" disabled={pagination.page <= 1} onClick={() => update({ page: String(pagination.page - 1) })} aria-label="Previous page"><ChevronLeft size={18}/></Button>
      {pageWindow(pagination.page, pagination.pages).map((number, index, all) => <span key={number} className="flex items-center gap-1.5">
        {index > 0 && number - all[index - 1] > 1 && <span className="px-1 text-ink/40">…</span>}
        <button type="button" onClick={() => update({ page: number === 1 ? '' : String(number) })} aria-current={number === pagination.page ? 'page' : undefined} className={`grid size-10 place-items-center rounded-full text-sm font-semibold transition ${number === pagination.page ? 'bg-ink text-white' : 'hover:bg-nile-light/60'}`}>{number}</button>
      </span>)}
      <Button variant="outline" size="icon" disabled={pagination.page >= pagination.pages} onClick={() => update({ page: String(pagination.page + 1) })} aria-label="Next page"><ChevronRight size={18}/></Button>
    </nav>}
  </main>;
}
