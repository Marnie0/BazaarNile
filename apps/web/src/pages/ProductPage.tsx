import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Minus, Plus, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { api, hasAccessToken, type AiSummary, type Cart, type Product } from '../lib/api';
import { useWishlist } from '../hooks/useWishlist';
import { money } from '../lib/utils';

export function ProductPage() {
  const { slug } = useParams();
  const [quantity, setQuantity] = useState(1); const [message, setMessage] = useState(''); const navigate = useNavigate(); const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['product', slug], queryFn: () => api<{ product: Product }>(`/products/${slug}`) });
  const p = data?.product;
  const wishlist = useWishlist(p);
  useEffect(() => {
    if (!p || !hasAccessToken()) return;
    api<void>(`/products/${p.id}/views`, { method: 'POST' }).catch(() => undefined);
  }, [p]);
  const cart = useMutation({ mutationFn: () => { if (!p) throw new Error('Product not found'); return api<{ cart: Cart }>('/cart/items', { method: 'POST', body: JSON.stringify({ productId: p.id, quantity }) }); }, onSuccess: (result) => { queryClient.setQueryData(['cart'], result); setMessage('Added to your cart'); }, onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not add to cart') });
  const summarize = useMutation({ mutationFn: () => { if (!p) throw new Error('Product not found'); return api<AiSummary>(`/ai/products/${p.id}/summary`, { method: 'POST' }); } });
  if (isLoading) return <div className="container-shell py-20">Loading product…</div>;
  if (isError || !p) return <div className="container-shell py-20"><h1 className="font-display text-4xl font-bold">Product not found</h1><Link to="/shop" className="mt-4 inline-block text-nile">Return to the bazaar</Link></div>;
  const requireAccount = (action: () => void) => hasAccessToken() ? action() : navigate('/login');
  return <main className="container-shell py-12"><div className="mb-7 text-sm text-ink/45"><Link to="/shop">Shop</Link> / <Link to={`/shop?category=${p.category.slug}`}>{p.category.name}</Link> / {p.name}</div><div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
    <div className="aspect-square overflow-hidden rounded-[2rem] bg-sand"><img src={p.imageUrl} alt={p.name} className="size-full object-cover"/></div>
    <div className="flex flex-col justify-center"><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">{p.category.name}</p><h1 className="mt-3 text-balance font-display text-5xl font-bold">{p.name}</h1><p className="mt-5 text-3xl font-bold">{money(p.price)}</p><p className="mt-6 text-lg leading-8 text-ink/65">{p.description}</p>
      <div className="mt-8 flex flex-wrap gap-3"><div className="flex items-center rounded-full border border-ink/12"><button className="p-3" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={16}/></button><input aria-label="Quantity" type="number" inputMode="numeric" min="1" max={Math.min(p.inventory, 20)} step="1" value={quantity} onChange={(event) => { const next = event.currentTarget.valueAsNumber; if (Number.isInteger(next) && next >= 1) setQuantity(Math.min(next, p.inventory, 20)); }} onFocus={(event) => event.currentTarget.select()} className="w-11 bg-transparent text-center outline-none"/><button className="p-3" onClick={() => setQuantity((value) => Math.min(p.inventory, 20, value + 1))}><Plus size={16}/></button></div><Button className="min-w-40 flex-1" size="lg" disabled={!p.inventory || cart.isPending} onClick={() => requireAccount(() => cart.mutate())}>{cart.isPending ? 'Adding…' : 'Add to cart'}</Button><Button variant="outline" size="icon" className={`size-14 ${wishlist.saved ? 'border-red-200 bg-red-50 text-red-600' : ''}`} disabled={wishlist.isPending} onClick={() => requireAccount(() => wishlist.toggle())} aria-label={wishlist.saved ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={wishlist.saved}><Heart size={19} fill={wishlist.saved ? 'currentColor' : 'none'}/></Button></div>{message && <p className="mt-3 text-sm font-semibold text-nile">{message}</p>}{wishlist.error && <p className="mt-3 text-sm text-red-700">{wishlist.error instanceof Error ? wishlist.error.message : 'Could not update your wishlist'}</p>}
      <div className="mt-7 rounded-2xl border border-nile/15 bg-nile-light/35 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold"><Sparkles size={17} className="text-nile"/>Gemini product summary</p><p className="mt-1 text-xs text-ink/50">A quick AI explanation using the product details.</p></div><Button variant="outline" disabled={summarize.isPending} onClick={() => requireAccount(() => summarize.mutate())}>{summarize.isPending ? 'Summarizing…' : summarize.data ? 'Summarize again' : 'Summarize with AI'}</Button></div>{summarize.data && <p className="mt-4 text-sm leading-6 text-ink/75" aria-live="polite">{summarize.data.summary}</p>}{summarize.error && <p className="mt-3 text-sm text-red-700" role="alert">{summarize.error instanceof Error ? summarize.error.message : 'Could not create the summary'}</p>}</div>
      <div className="mt-8 grid gap-3 border-t border-ink/10 pt-6 text-sm text-ink/65 sm:grid-cols-2"><span className="flex gap-2"><ShieldCheck size={18} className="text-nile"/>Secure shopping</span><span className="flex gap-2"><Truck size={18} className="text-nile"/>{p.inventory > 0 ? `${p.inventory} ready to ship` : 'Currently unavailable'}</span></div>
      <Link to={`/profiles/${p.seller.username}`} className="mt-8 flex items-center gap-3 rounded-2xl bg-sand p-4"><div className="grid size-11 place-items-center rounded-full bg-nile text-lg font-bold text-white">{p.seller.displayName[0]}</div><div><p className="text-xs text-ink/45">Sold by</p><p className="font-semibold">{p.seller.displayName}</p></div></Link>
    </div>
  </div></main>;
}
