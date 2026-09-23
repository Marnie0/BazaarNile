import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, LockKeyhole, ShoppingBag, TicketPercent, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { EmptyState, PageIntro, PageLoader } from '../components/PageState';
import { Field, Input, Textarea } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, ApiError, type Cart, type CouponValidation, type Order } from '../lib/api';
import { money, shippingFor } from '../lib/utils';

const governorates = ['Alexandria', 'Aswan', 'Asyut', 'Beheira', 'Beni Suef', 'Cairo', 'Dakahlia', 'Damietta', 'Faiyum', 'Gharbia', 'Giza', 'Ismailia', 'Kafr El Sheikh', 'Luxor', 'Matrouh', 'Minya', 'Monufia', 'New Valley', 'North Sinai', 'Port Said', 'Qalyubia', 'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez'];

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState(''); const [couponCode, setCouponCode] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['cart'], queryFn: () => api<{ cart: Cart }>('/cart'), retry: false });
  const checkout = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ order: Order }>('/checkout', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async ({ order }) => {
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
  const unavailable = items.filter((item) => item.product.status !== 'ACTIVE' || item.product.inventory < item.quantity);
  const subtotal = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const shipping = shippingFor(subtotal);
  const discount = Number(coupon.data?.discount ?? 0);
  const total = subtotal + shipping - discount;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setErrorMessage('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    // Only a coupon the shopper actually applied is sent, so the total they saw is the total they pay.
    checkout.mutate({ ...fields, notes: String(fields.notes ?? '').trim() || undefined, couponCode: coupon.data?.coupon.code });
  };
  const removeCoupon = () => { coupon.reset(); setCouponCode(''); };

  return <main className="container-shell py-10 sm:py-14">
    <PageIntro eyebrow={<span className="inline-flex items-center gap-2"><LockKeyhole size={14}/>Secure checkout</span>} title="Delivery details">Pay in cash when your order arrives. We’ll notify you as it moves.</PageIntro>
    {unavailable.length > 0 && <div className="mt-6 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800" role="alert"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><p>Some items in your cart are unavailable or low on stock. <Link to="/cart" className="font-semibold underline">Review your cart</Link> before placing the order.</p></div>}
    {errorMessage && <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">{errorMessage}</p>}
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
      <form id="checkout-form" onSubmit={submit} className="surface grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
        <h2 className="font-display text-2xl font-semibold sm:col-span-2">Where should we deliver?</h2>
        <Field label="Full name"><Input name="shippingName" autoComplete="name" required minLength={2} maxLength={80}/></Field>
        <Field label="Phone number" hint="The courier will call this number on delivery."><Input name="shippingPhone" type="tel" inputMode="tel" autoComplete="tel" required minLength={8} maxLength={20} pattern="[\d\s+\-\(\)]{8,20}" title="8–20 digits; spaces, +, - and brackets are allowed" placeholder="01X XXXX XXXX"/></Field>
        <Field label="Street address" className="sm:col-span-2"><Input name="shippingAddress" autoComplete="street-address" required minLength={3} maxLength={200} placeholder="Building, street, floor, apartment"/></Field>
        <Field label="City / district"><Input name="shippingCity" autoComplete="address-level2" required minLength={2} maxLength={80}/></Field>
        <label className="field-label">Governorate<input className="field" name="shippingRegion" list="governorates" autoComplete="address-level1" required minLength={2} maxLength={80}/><datalist id="governorates">{governorates.map((name) => <option key={name} value={name}/>)}</datalist></label>
        <Field label="Delivery notes" hint="Optional — landmarks, best time to call" className="sm:col-span-2"><Textarea className="min-h-24 resize-y" name="notes" maxLength={500}/></Field>
        <div className="flex items-center gap-3 rounded-xl bg-sand p-4 text-sm sm:col-span-2"><Banknote size={20} className="shrink-0 text-nile"/><div><strong className="block">Cash on delivery</strong><span className="text-ink/60">Pay the courier when your order arrives.</span></div></div>
      </form>

      <aside className="rounded-[1.5rem] bg-sand p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-semibold">Your order</h2>
        <ul className="mt-5 grid max-h-72 gap-4 overflow-y-auto pr-1">{items.map((item) => <li key={item.id} className="flex items-center gap-3"><span className="relative shrink-0"><img src={item.product.imageUrl} alt="" className="size-14 rounded-xl object-cover"/><span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{item.quantity}</span></span><p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.product.name}</p><span className="text-sm font-semibold">{money(Number(item.product.price) * item.quantity)}</span></li>)}</ul>
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
