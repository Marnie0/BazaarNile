import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { Button } from '../components/ui/Button';
import { api, ApiError, type Cart, type WishlistItem } from '../lib/api';
import { money } from '../lib/utils';

export function WishlistPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['wishlist'], queryFn: () => api<{ items: WishlistItem[] }>('/wishlist'), retry: false });
  const remove = useMutation({ mutationFn: (id: string) => api<void>(`/wishlist/${id}`, { method: 'DELETE' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }) });
  const addCart = useMutation({ mutationFn: (productId: string) => api<{ cart: Cart }>('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }) }), onSuccess: (cart) => queryClient.setQueryData(['cart'], cart) });
  if (error instanceof ApiError && error.status === 401) return <AuthRequired title="Save your favorite finds"/>;
  if (isLoading) return <main className="container-shell py-20">Loading your wishlist…</main>;
  const items = data?.items ?? [];
  return <main className="container-shell py-14"><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Saved for later</p><h1 className="mt-2 font-display text-5xl font-bold">Your wishlist</h1>
    {!items.length ? <div className="grid min-h-[45vh] place-items-center text-center"><div><Heart className="mx-auto text-nile" size={42}/><h2 className="mt-5 font-display text-3xl font-bold">Nothing saved yet</h2><p className="mt-2 text-ink/55">Tap the heart when something catches your eye.</p><Button className="mt-6" asChild><Link to="/shop">Explore the bazaar</Link></Button></div></div> : <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(({ product }) => <article key={product.id} className="flex gap-4 rounded-2xl border border-ink/10 bg-white p-4"><Link to={`/products/${product.slug}`} className="size-28 shrink-0 overflow-hidden rounded-xl"><img src={product.imageUrl} alt={product.name} className="size-full object-cover"/></Link><div className="min-w-0 flex-1"><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-sm font-bold text-nile">{money(product.price)}</p><div className="mt-4 flex gap-2"><button onClick={() => addCart.mutate(product.id)} className="grid size-9 place-items-center rounded-full bg-nile text-white" aria-label={`Add ${product.name} to cart`}><ShoppingBag size={16}/></button><button onClick={() => remove.mutate(product.id)} className="grid size-9 place-items-center rounded-full border border-ink/10 text-ink/45 hover:text-red-600" aria-label={`Remove ${product.name}`}><Trash2 size={16}/></button></div></div></article>)}</div>}
  </main>;
}

