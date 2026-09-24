import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, LockKeyhole, Minus, Plus, ShoppingBag, Sparkles, Trash2, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { EmptyState, PageIntro, PageLoader } from '../components/PageState';
import { toast, toastError } from '../lib/toast';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, ApiError, type AiSummary, type Cart, type CartItem } from '../lib/api';
import { FREE_SHIPPING_THRESHOLD, money, shippingFor, stockLevel } from '../lib/utils';

export function FreeShippingMeter({ subtotal }: { subtotal: number }) {
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  return <div className="rounded-xl bg-white/70 p-3.5">
    <p className="flex items-center gap-2 text-sm font-medium"><Truck size={16} className="text-nile"/>{remaining > 0 ? <>Add <strong>{money(remaining)}</strong> more for free shipping</> : <strong className="text-emerald-700">You’ve unlocked free shipping</strong>}</p>
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress toward free shipping"><div className={`h-full rounded-full transition-all duration-500 ${remaining > 0 ? 'bg-gold' : 'bg-emerald-600'}`} style={{ width: `${progress}%` }}/></div>
  </div>;
}

export function CartPage() {
  useDocumentTitle('Cart');
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['cart'], queryFn: () => api<{ cart: Cart }>('/cart'), retry: false });
  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api<{ cart: Cart }>(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
    onSuccess: (result) => queryClient.setQueryData(['cart'], result),
    onError: (cause) => toastError(cause, 'Could not update your cart'),
  });
  const remove = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => api<void>(`/cart/items/${id}`, { method: 'DELETE' }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previous = queryClient.getQueryData<{ cart: Cart }>(['cart']);
      if (previous) queryClient.setQueryData(['cart'], { cart: { ...previous.cart, items: previous.cart.items.filter((item) => item.id !== id) } });
      return { previous };
    },
    onSuccess: (_, { name }) => toast(`${name} removed from your cart`),
    onError: (cause, _, context) => { if (context?.previous) queryClient.setQueryData(['cart'], context.previous); toastError(cause, 'Could not remove this item'); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });
  const summarize = useMutation({ mutationFn: () => api<AiSummary>('/ai/cart/summary', { method: 'POST' }) });
  if (error instanceof ApiError && error.status === 401) return <AuthRequired title="Your cart is waiting"/>;
  if (isLoading) return <PageLoader label="Loading your cart…"/>;
  const items = data?.cart.items ?? [];
  const stockOf = (item: CartItem) => item.variant ? item.variant.inventory : item.product.inventory;
  const unavailable = items.filter((item) => item.product.status !== 'ACTIVE' || stockOf(item) < item.quantity || (item.product.optionNames.length > 0 && !item.variant));
  const subtotal = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = shippingFor(subtotal);

  return <main className="container-shell py-10 sm:py-14">
    <PageIntro eyebrow="Your selection" title="Shopping cart">{items.length > 0 && `${itemCount} item${itemCount === 1 ? '' : 's'} from the bazaar`}</PageIntro>
    {!items.length ? <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Button asChild><Link to="/shop">Discover products</Link></Button>}>The bazaar is full of good possibilities.</EmptyState> :
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
      <ul className="surface divide-y divide-ink/8 px-4 sm:px-6">{items.map((item) => {
        const active = item.product.status === 'ACTIVE';
        const stock = stockOf(item);
        const max = Math.min(stock, 20);
        const busy = update.isPending && update.variables?.id === item.id;
        const commitQuantity = (target: HTMLInputElement) => {
          const quantity = target.valueAsNumber;
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) { target.value = String(item.quantity); return; }
          if (quantity !== item.quantity) update.mutate({ id: item.id, quantity });
        };
        return <li key={item.id} className="grid grid-cols-[88px_1fr] gap-4 py-5 sm:grid-cols-[112px_1fr_auto] sm:gap-5">
          <Link to={`/products/${item.product.slug}`} className="aspect-square overflow-hidden rounded-2xl bg-sand" tabIndex={-1} aria-hidden="true"><img src={item.product.imageUrl} alt="" className={`size-full object-cover ${active ? '' : 'opacity-50 grayscale'}`}/></Link>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-nile">{item.product.category.name}</p>
            {active ? <Link to={`/products/${item.product.slug}`} className="mt-1 block font-semibold leading-snug hover:text-clay sm:text-lg">{item.product.name}</Link> : <p className="mt-1 font-semibold sm:text-lg">{item.product.name}</p>}
            {item.variant && <p className="mt-1.5 flex flex-wrap gap-1.5">{item.product.optionNames.map((name, index) => <span key={name} className="rounded-md bg-sand px-2 py-0.5 text-xs font-medium text-ink/75">{name}: <strong className="font-semibold text-ink">{item.variant!.options[index]}</strong></span>)}</p>}
            <p className="mt-1 text-sm text-ink/55">{money(item.product.price)} each · by {item.product.seller.displayName}</p>
            {!active && <p className="mt-2 text-xs font-semibold text-red-700">No longer available — please remove it</p>}
            {active && item.product.optionNames.length > 0 && !item.variant && <p className="mt-2 text-xs font-semibold text-red-700">Choose a {item.product.optionNames[0]!.toLowerCase()} — <Link to={`/products/${item.product.slug}`} className="underline">pick an option</Link> and remove this line</p>}
            {active && stock < item.quantity && (stock > 0 ? <p className="mt-2 text-xs font-semibold text-red-700">Only {stock} left — lower the quantity to continue</p> : <p className="mt-2 text-xs font-semibold text-red-700">Sold out — please remove it</p>)}{active && stock >= item.quantity && stockLevel(stock) === 'urgent' && <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-600"><span className="size-1.5 rounded-full bg-current"/>Only {stock} left in stock</p>}
            <div className="mt-3 flex items-center gap-4">
              <div className={`inline-flex items-center rounded-full border border-ink/12 bg-white focus-within:ring-2 focus-within:ring-nile/30 ${busy ? 'opacity-60' : ''}`}>
                <button type="button" aria-label={`Decrease quantity of ${item.product.name}`} disabled={!active || item.quantity <= 1 || busy} onClick={() => update.mutate({ id: item.id, quantity: item.quantity - 1 })} className="grid size-9 place-items-center rounded-full disabled:opacity-30"><Minus size={14}/></button>
                <input key={`${item.id}-${item.quantity}`} aria-label={`Quantity of ${item.product.name}`} type="number" inputMode="numeric" min="1" max={max} step="1" defaultValue={item.quantity} disabled={!active || busy} onBlur={(event) => commitQuantity(event.currentTarget)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="w-9 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none"/>
                <button type="button" aria-label={`Increase quantity of ${item.product.name}`} disabled={!active || item.quantity >= max || busy} onClick={() => update.mutate({ id: item.id, quantity: item.quantity + 1 })} className="grid size-9 place-items-center rounded-full disabled:opacity-30"><Plus size={14}/></button>
              </div>
              <button type="button" onClick={() => remove.mutate({ id: item.id, name: item.product.name })} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 hover:text-red-700 sm:hidden"><Trash2 size={15}/>Remove</button>
            </div>
          </div>
          <div className="col-start-2 flex items-center justify-between sm:col-start-auto sm:flex-col sm:items-end"><strong className="text-lg">{money(Number(item.product.price) * item.quantity)}</strong><button type="button" onClick={() => remove.mutate({ id: item.id, name: item.product.name })} className="hidden size-9 place-items-center rounded-full text-ink/40 transition hover:bg-red-50 hover:text-red-700 sm:grid" aria-label={`Remove ${item.product.name}`}><Trash2 size={17}/></button></div>
        </li>;
      })}</ul>
      <aside className="rounded-[1.5rem] bg-sand p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-semibold">Order summary</h2>
        <div className="mt-5"><FreeShippingMeter subtotal={subtotal}/></div>
        <dl className="mt-5 grid gap-3 text-sm"><div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd className="font-medium">{money(subtotal)}</dd></div><div className="flex justify-between"><dt className="text-ink/60">Shipping</dt><dd className="font-medium">{shipping ? money(shipping) : 'Free'}</dd></div><div className="flex justify-between border-t border-ink/10 pt-4 text-lg font-bold"><dt>Total</dt><dd>{money(subtotal + shipping)}</dd></div></dl>
        <p className="mt-1 text-xs text-ink/50">Coupons can be applied at checkout.</p>
        {unavailable.length ? <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">Remove unavailable items or lower their quantity before checkout.</p> : <Button className="mt-5 w-full" size="lg" asChild><Link to="/checkout">Checkout <ArrowRight size={18}/></Link></Button>}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink/50"><LockKeyhole size={13}/>Secure checkout · Cash on delivery</p>
        <div className="mt-5 border-t border-ink/10 pt-5"><Button variant="ghost" className="w-full" disabled={summarize.isPending} onClick={() => summarize.mutate()}><Sparkles size={16}/>{summarize.isPending ? 'Summarizing…' : summarize.data ? 'Summarize again' : 'Summarize my cart with AI'}</Button>{summarize.data && <p className="mt-3 text-sm leading-6 text-ink/70" aria-live="polite">{summarize.data.summary}</p>}{summarize.error && <p className="mt-3 text-xs text-red-700" role="alert">{summarize.error instanceof Error ? summarize.error.message : 'Could not create the summary'}</p>}</div>
      </aside>
    </div>}
  </main>;
}
