import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, ShoppingBag, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { Button } from '../components/ui/Button';
import { api, ApiError, type AiSummary, type Cart } from '../lib/api';
import { money } from '../lib/utils';

export function CartPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['cart'], queryFn: () => api<{ cart: Cart }>('/cart'), retry: false });
  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api<{ cart: Cart }>(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
    onSuccess: (result) => { setActionError(''); queryClient.setQueryData(['cart'], result); },
    onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not update your cart'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/cart/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setActionError(''); queryClient.invalidateQueries({ queryKey: ['cart'] }); },
    onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not remove this item'),
  });
  const summarize = useMutation({ mutationFn: () => api<AiSummary>('/ai/cart/summary', { method: 'POST' }) });
  if (error instanceof ApiError && error.status === 401) return <AuthRequired title="Your cart is waiting"/>;
  if (isLoading) return <main className="container-shell py-20">Loading your cart…</main>;
  const items = data?.cart.items ?? [];
  const unavailable = items.filter((item) => item.product.status !== 'ACTIVE' || item.product.inventory < item.quantity);
  const subtotal = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 75;
  return <main className="container-shell py-14"><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Your selection</p><h1 className="mt-2 font-display text-5xl font-bold">Shopping cart</h1>
    {!items.length ? <div className="grid min-h-[45vh] place-items-center text-center"><div><ShoppingBag className="mx-auto text-nile" size={42}/><h2 className="mt-5 font-display text-3xl font-bold">Your cart is empty</h2><p className="mt-2 text-ink/55">The bazaar is full of good possibilities.</p><Button className="mt-6" asChild><Link to="/shop">Discover products</Link></Button></div></div> :
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]"><div>{actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}<div className="divide-y divide-ink/10">{items.map((item) => { const active = item.product.status === 'ACTIVE'; return <article key={item.id} className="grid grid-cols-[96px_1fr] gap-5 py-6 sm:grid-cols-[120px_1fr_auto]"><div className="aspect-square overflow-hidden rounded-2xl bg-sand"><img src={item.product.imageUrl} alt={item.product.name} className={`size-full object-cover ${active ? '' : 'opacity-50'}`}/></div><div><p className="text-xs font-bold uppercase tracking-wider text-nile">{item.product.category.name}</p>{active ? <Link to={`/products/${item.product.slug}`} className="mt-1 block text-lg font-semibold">{item.product.name}</Link> : <p className="mt-1 text-lg font-semibold">{item.product.name}</p>}<p className="mt-2 font-bold">{money(item.product.price)}</p>{!active && <p className="mt-2 text-xs font-semibold text-red-600">No longer available</p>}{active && item.product.inventory < item.quantity && <p className="mt-2 text-xs font-semibold text-red-600">Only {item.product.inventory} left in stock</p>}<div className="mt-4 inline-flex items-center rounded-full border border-ink/10"><button aria-label="Decrease quantity" disabled={!active || item.quantity === 1 || update.isPending} onClick={() => update.mutate({ id: item.id, quantity: item.quantity - 1 })} className="p-2.5 disabled:opacity-30"><Minus size={15}/></button><span className="w-7 text-center text-sm">{item.quantity}</span><button aria-label="Increase quantity" disabled={!active || item.quantity >= item.product.inventory || update.isPending} onClick={() => update.mutate({ id: item.id, quantity: item.quantity + 1 })} className="p-2.5 disabled:opacity-30"><Plus size={15}/></button></div></div><div className="col-start-2 flex items-center justify-between sm:col-start-auto sm:flex-col sm:items-end"><strong>{money(Number(item.product.price) * item.quantity)}</strong><button onClick={() => remove.mutate(item.id)} className="text-ink/40 hover:text-red-600" aria-label={`Remove ${item.product.name}`}><Trash2 size={18}/></button></div></article>; })}</div></div>
      <aside className="h-fit rounded-[1.5rem] bg-sand p-6"><h2 className="font-display text-2xl font-bold">Order summary</h2><dl className="mt-6 grid gap-4 text-sm"><div className="flex justify-between"><dt className="text-ink/55">Subtotal</dt><dd>{money(subtotal)}</dd></div><div className="flex justify-between"><dt className="text-ink/55">Shipping</dt><dd>{shipping ? money(shipping) : 'Free'}</dd></div><div className="flex justify-between border-t border-ink/10 pt-4 text-lg font-bold"><dt>Total</dt><dd>{money(subtotal + shipping)}</dd></div></dl>{subtotal < 1500 && <p className="mt-4 text-xs leading-5 text-ink/50">Add {money(1500 - subtotal)} more for free shipping.</p>}<div className="mt-5 border-t border-ink/10 pt-5"><Button variant="outline" className="w-full" disabled={summarize.isPending} onClick={() => summarize.mutate()}><Sparkles size={16}/>{summarize.isPending ? 'Summarizing…' : summarize.data ? 'Summarize again' : 'Summarize my cart'}</Button>{summarize.data && <p className="mt-3 text-sm leading-6 text-ink/65" aria-live="polite">{summarize.data.summary}</p>}{summarize.error && <p className="mt-3 text-xs text-red-700" role="alert">{summarize.error instanceof Error ? summarize.error.message : 'Could not create the summary'}</p>}</div>{unavailable.length ? <p className="mt-5 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">Remove unavailable items or adjust their quantity before checkout.</p> : <Button className="mt-6 w-full" size="lg" asChild><Link to="/checkout">Continue to checkout</Link></Button>}</aside>
    </div>}
  </main>;
}
