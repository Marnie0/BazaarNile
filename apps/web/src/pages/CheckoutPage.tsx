import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Check, LockKeyhole, MapPin, Plus, ShoppingBag, TicketPercent, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AddressFields } from '../components/AddressFields';
import { checkoutNames } from '../lib/address';
import { toast } from '../lib/toast';
import { cn } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { EmptyState, PageIntro, PageLoader } from '../components/PageState';
import { Field, Input } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, ApiError, type Address, type Cart, type CouponValidation, type Order } from '../lib/api';
import { money, shippingFor } from '../lib/utils';

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState(''); const [couponCode, setCouponCode] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['cart'], queryFn: () => api<{ cart: Cart }>('/cart'), retry: false });
  const saved = useQuery({ queryKey: ['addresses'], queryFn: () => api<{ addresses: Address[] }>('/account/addresses'), enabled: !error, retry: false });
  // undefined = not chosen yet (falls back to the default address); 'new' = typing a new one.
  const [choice, setChoice] = useState<string | undefined>();
  const [saveAddress, setSaveAddress] = useState(true);
  const checkout = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ order: Order }>('/checkout', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async ({ order }, body) => {
      if (body.saveAs) {
        const { saveAs, shippingName, shippingPhone, shippingAddress, shippingCity, shippingRegion, notes } = body as Record<string, string>;
        // A failed save must not spoil a successful order, so it only reports quietly.
        await api('/account/addresses', { method: 'POST', body: JSON.stringify({ label: saveAs, fullName: shippingName, phone: shippingPhone, street: shippingAddress, city: shippingCity, region: shippingRegion, notes: notes || null }) })
          .then(() => queryClient.invalidateQueries({ queryKey: ['addresses'] })).catch(() => toast('Your order is placed, but the address could not be saved', { tone: 'error' }));
      }
      queryClient.setQueryData(['cart'], (current: { cart: Cart } | undefined) => current && { cart: { ...current.cart, items: [] } });
      await Promise.all(['cart', 'notifications', 'orders', 'products'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      navigate(`/orders?placed=${encodeURIComponent(order.orderNumber)}`, { replace: true });
    },
    onError: (err) => { setErrorMessage(err instanceof Error ? err.message : 'Checkout failed'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  });
  const coupon = useMutation({ mutationFn: (code: string) => api<CouponValidation>('/coupons/validate', { method: 'POST', body: JSON.stringify({ code }) }) });
  if (error instanceof ApiError && error.status === 401) return <AuthRequired title="Sign in to check out"/>;
  if (isLoading) return <PageLoader label="Preparing checkout…"/>;
  const items = data?.cart.items ?? [];
  if (!items.length) return <main className="container-shell"><EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Button asChild><Link to="/shop">Continue shopping</Link></Button>}>Add something you love, then come back to check out.</EmptyState></main>;
  const unavailable = items.filter((item) => item.product.status !== 'ACTIVE' || (item.variant ? item.variant.inventory : item.product.inventory) < item.quantity || (item.product.optionNames.length > 0 && !item.variant));
  const subtotal = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const shipping = shippingFor(subtotal);
  const discount = Number(coupon.data?.discount ?? 0);
  const total = subtotal + shipping - discount;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setErrorMessage('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    // Only a coupon the shopper actually applied is sent, so the total they saw is the total they pay.
    const { saveAs, ...shipping } = fields;
    checkout.mutate({ ...shipping, notes: String(fields.notes ?? '').trim() || undefined, couponCode: coupon.data?.coupon.code,
      saveAs: canSave && saveAddress ? String(saveAs ?? '').trim() || (addresses.length ? 'Other' : 'Home') : undefined });
  };
  const removeCoupon = () => { coupon.reset(); setCouponCode(''); };
  const addresses = saved.data?.addresses ?? [];
  const selectedId = choice ?? addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? 'new';
  const selected = addresses.find((address) => address.id === selectedId);
  const canSave = selectedId === 'new' && addresses.length < 10;

  return <main className="container-shell py-10 sm:py-14">
    <PageIntro eyebrow={<span className="inline-flex items-center gap-2"><LockKeyhole size={14}/>Secure checkout</span>} title="Delivery details">Pay in cash when your order arrives. We’ll notify you as it moves.</PageIntro>
    {unavailable.length > 0 && <div className="mt-6 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800" role="alert"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><p>Some items in your cart are unavailable or low on stock. <Link to="/cart" className="font-semibold underline">Review your cart</Link> before placing the order.</p></div>}
    {errorMessage && <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">{errorMessage}</p>}
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
      <form id="checkout-form" onSubmit={submit} className="surface grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
        <h2 className="font-display text-2xl font-semibold sm:col-span-2">Where should we deliver?</h2>
        {addresses.length > 0 && <div className="grid gap-2.5 sm:col-span-2 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
          {addresses.map((address) => { const active = address.id === selectedId; return <button key={address.id} type="button" role="radio" aria-checked={active} onClick={() => setChoice(address.id)}
            className={cn('relative rounded-2xl border p-4 text-left text-sm transition', active ? 'border-nile bg-nile-light/40 ring-2 ring-nile/20' : 'border-ink/10 bg-white hover:border-ink/30')}>
            <span className="flex items-center gap-2 font-semibold"><MapPin size={15} className="text-nile"/>{address.label}{address.isDefault && <span className="text-xs font-normal text-ink/50">· Default</span>}</span>
            <span className="mt-1.5 block truncate text-ink/65">{address.fullName} · {address.phone}</span><span className="block truncate text-ink/65">{address.street}, {address.city}</span>
            {active && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-nile text-white"><Check size={13}/></span>}
          </button>; })}
          <button type="button" role="radio" aria-checked={selectedId === 'new'} onClick={() => setChoice('new')} className={cn('flex items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm font-semibold transition', selectedId === 'new' ? 'border-nile bg-nile-light/40 text-nile' : 'border-ink/20 text-ink/65 hover:border-ink/40')}><Plus size={16}/>Deliver somewhere else</button>
        </div>}
        {/* Keyed by the chosen address so the fields refill; they stay editable for one-off tweaks. */}
        <div key={selectedId} className={cn('grid gap-5 sm:col-span-2 sm:grid-cols-2', selected && 'rounded-2xl bg-sand/40 p-4')}>
          {selected && <p className="text-xs font-semibold uppercase tracking-wider text-ink/50 sm:col-span-2">Delivering to {selected.label} — edit anything for this order only</p>}
          <AddressFields names={checkoutNames} initial={selected} idPrefix="checkout"/>
        </div>
        {canSave && <div className="grid gap-3 rounded-xl border border-ink/10 p-4 sm:col-span-2 sm:grid-cols-[auto_1fr] sm:items-center">
          <label className="flex items-center gap-2.5 text-sm font-medium"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} className="size-4 accent-[#244e5a]"/>Save this address for next time</label>
          {saveAddress && <Field label={<span className="sr-only">Address name</span>} className="sm:justify-self-end"><Input name="saveAs" maxLength={30} placeholder={addresses.length ? 'Name it, e.g. Work' : 'Name it, e.g. Home'} className="py-2 sm:w-56"/></Field>}
        </div>}
        <div className="flex items-center gap-3 rounded-xl bg-sand p-4 text-sm sm:col-span-2"><Banknote size={20} className="shrink-0 text-nile"/><div><strong className="block">Cash on delivery</strong><span className="text-ink/60">Pay the courier when your order arrives.</span></div></div>
      </form>

      <aside className="rounded-[1.5rem] bg-sand p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-semibold">Your order</h2>
        <ul className="mt-5 grid max-h-72 gap-4 overflow-y-auto pr-1">{items.map((item) => <li key={item.id} className="flex items-center gap-3"><span className="relative shrink-0"><img src={item.product.imageUrl} alt="" className="size-14 rounded-xl object-cover"/><span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{item.quantity}</span></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.product.name}</p>{item.variant && <p className="truncate text-xs text-ink/55">{item.variant.options.join(' / ')}</p>}</div><span className="text-sm font-semibold">{money(Number(item.product.price) * item.quantity)}</span></li>)}</ul>
        <div className="mt-5 border-t border-ink/10 pt-5">
          {coupon.data ? <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm"><span className="flex items-center gap-2 font-semibold text-nile"><TicketPercent size={17}/>{coupon.data.coupon.code} applied</span><button type="button" onClick={removeCoupon} className="grid size-7 place-items-center rounded-full text-ink/50 hover:bg-sand hover:text-ink" aria-label="Remove coupon"><X size={15}/></button></div>
            : <form onSubmit={(event) => { event.preventDefault(); if (couponCode.trim()) coupon.mutate(couponCode.trim()); }}><label htmlFor="couponCode" className="text-sm font-semibold">Coupon code</label><div className="mt-1.5 flex gap-2"><input id="couponCode" className="field min-w-0 flex-1 uppercase" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); if (coupon.error) coupon.reset(); }} maxLength={40} placeholder="Enter code" autoComplete="off"/><Button type="submit" variant="outline" disabled={!couponCode.trim() || coupon.isPending}>{coupon.isPending ? 'Checking…' : 'Apply'}</Button></div>{coupon.error && <p className="mt-2 text-sm text-red-700" role="alert">{coupon.error instanceof Error ? coupon.error.message : 'Coupon could not be applied'}</p>}</form>}
        </div>
        <dl className="mt-5 grid gap-3 border-t border-ink/10 pt-5 text-sm"><div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd>{money(subtotal)}</dd></div><div className="flex justify-between"><dt className="text-ink/60">Shipping</dt><dd>{shipping ? money(shipping) : 'Free'}</dd></div>{discount > 0 && <div className="flex justify-between font-semibold text-nile"><dt>Coupon discount</dt><dd>−{money(discount)}</dd></div>}<div className="flex justify-between border-t border-ink/10 pt-3 text-lg font-bold"><dt>Total</dt><dd>{money(total)}</dd></div></dl>
        <Button form="checkout-form" className="mt-6 w-full" size="lg" disabled={checkout.isPending || unavailable.length > 0}>{checkout.isPending ? 'Placing order…' : `Place order · ${money(total)}`}</Button>
        <p className="mt-3 text-center text-xs text-ink/50">By placing your order you agree to pay {money(total)} on delivery.</p>
      </aside>
    </div>
  </main>;
}
