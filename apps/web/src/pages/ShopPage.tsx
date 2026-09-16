import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { ProductSkeleton } from '../components/Skeleton';
import { Button } from '../components/ui/Button';
import { api, type Category, type Product } from '../lib/api';

export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const { data, isLoading } = useQuery({ queryKey: ['products', query], queryFn: () => api<{ products: Product[]; pagination: { page: number; total: number; pages: number } }>(`/products?${query}`) });
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => api<{ categories: Category[] }>('/categories') });
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  return <main className="container-shell py-14"><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Explore the collection</p><h1 className="mt-2 font-display text-5xl font-bold">The Bazaar</h1><p className="mt-3 text-ink/60">{data?.pagination.total ?? 0} exceptional products, one thoughtful marketplace.</p>
    <div className="mt-9 flex flex-col gap-3 border-y border-ink/10 py-4 md:flex-row">
      <label className="flex flex-1 items-center gap-2 rounded-full bg-sand px-4"><Search size={17}/><input defaultValue={params.get('search') ?? ''} onKeyDown={(e) => { if (e.key === 'Enter') update('search', e.currentTarget.value); }} placeholder="What are you looking for?" className="w-full bg-transparent py-3 outline-none"/></label>
      <label className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4"><SlidersHorizontal size={16}/><select value={params.get('category') ?? ''} onChange={(e) => update('category', e.target.value)} className="min-w-40 bg-transparent py-3 outline-none"><option value="">All categories</option>{cats?.categories.map((c) => <option value={c.slug} key={c.id}>{c.name}</option>)}</select></label>
      <select value={params.get('sort') ?? 'newest'} onChange={(e) => update('sort', e.target.value)} className="rounded-full border border-ink/10 bg-white px-5 py-3 outline-none"><option value="newest">Newest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select>
    </div>
    <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{isLoading ? Array.from({ length: 8 }, (_, i) => <ProductSkeleton key={i}/>) : data?.products.map((p) => <ProductCard product={p} key={p.id}/>)}</div>
    {!isLoading && !data?.products.length && <div className="py-24 text-center"><h2 className="font-display text-3xl font-bold">No treasures found</h2><p className="mt-2 text-ink/55">Try a broader search or another category.</p></div>}
    {!isLoading && (data?.pagination.pages ?? 0) > 1 && <div className="mt-12 flex items-center justify-center gap-3"><Button variant="outline" disabled={data!.pagination.page <= 1} onClick={() => update('page', String(data!.pagination.page - 1))}>Previous</Button><span className="text-sm text-ink/50">Page {data!.pagination.page} of {data!.pagination.pages}</span><Button variant="outline" disabled={data!.pagination.page >= data!.pagination.pages} onClick={() => update('page', String(data!.pagination.page + 1))}>Next</Button></div>}
  </main>;
}
