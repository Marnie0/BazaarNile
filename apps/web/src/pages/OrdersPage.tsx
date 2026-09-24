import { variantLabelText } from '../lib/variants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, ChevronDown, PackageOpen, X, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { EmptyState, PageIntro, PageLoader } from '../components/PageState';
import { toast, toastError } from '../lib/toast';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { confirmAction } from '../lib/confirm';
import { Badge } from '../components/ui/Badge';
import { orderStatus } from '../lib/status';
import { api, ApiError, type Order, type OrderStatus } from '../lib/api';
import { formatDate, money } from '../lib/utils';
import { t } from '../lib/i18n';

const progress: { status: Exclude<OrderStatus, 'CANCELLED'>; label: string }[] = [
  { status: 'PENDING', label: 'Placed' }, { status: 'CONFIRMED', label: 'Confirmed' }, { status: 'PROCESSING', label: 'Processing' },
  { status: 'SHIPPED', label: 'Shipped' }, { status: 'DELIVERED', label: 'Delivered' },
];

function OrderProgress({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') return <div className="mt-5 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"><XCircle className="shrink-0" size={20}/><div><strong>{t('Order cancelled')}</strong><p className="text-xs opacity-75">{t('This order will not be delivered.')}</p></div></div>;
  const current = progress.findIndex((step) => step.status === order.status);
  return <div className="mt-6" aria-label={t('Order status: {status}', { status: orderStatus[order.status].label })}><div className="grid grid-cols-5">{progress.map((step, index) => {
    const complete = index <= current;
    return <div key={step.status} className="relative flex flex-col items-center text-center"><span className={`absolute start-0 top-3 h-0.5 w-1/2 ${index > 0 && index <= current ? 'bg-nile' : index > 0 ? 'bg-ink/10' : 'bg-transparent'}`}/><span className={`absolute end-0 top-3 h-0.5 w-1/2 ${index < current ? 'bg-nile' : index < progress.length - 1 ? 'bg-ink/10' : 'bg-transparent'}`}/><span className={`relative z-10 grid size-6 place-items-center rounded-full border-2 ${complete ? 'border-nile bg-nile text-white' : 'border-ink/15 bg-white text-transparent'}`}>{complete && <Check size={13}/>}</span><span className={`mt-2 text-[10px] font-semibold sm:text-xs ${complete ? 'text-nile' : 'text-ink/35'}`}>{t(step.label)}</span></div>;
  })}</div><p className="mt-4 text-center text-xs text-ink/50">{t('Updated {date}', { date: formatDate(order.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) })}</p></div>;
}

export function OrdersPage() {
  useDocumentTitle(t('Orders'));
  const [params, setParams] = useSearchParams(); const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['orders'], queryFn: () => api<{ orders: Order[] }>('/orders'), retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const cancel = useMutation({
    mutationFn: (number: string) => api<{ order: Order }>(`/orders/${encodeURIComponent(number)}/cancel`, { method: 'PATCH' }),
    onSuccess: async ({ order }) => { toast(t('{number} was cancelled', { number: order.orderNumber })); await Promise.all([queryClient.invalidateQueries({ queryKey: ['orders'] }), queryClient.invalidateQueries({ queryKey: ['notifications'] })]); },
    onError: (cause) => toastError(cause, t('This order could not be cancelled')),
  });
  if (error instanceof ApiError && error.status === 401) return <AuthRequired title={t('See your order history')}/>;
  if (isLoading) return <PageLoader label={t('Loading orders…')}/>;
  const orders = data?.orders ?? []; const placed = params.get('placed');
  return <main className="container-shell py-10 sm:py-14">
    {placed && <div className="mb-8 flex items-start gap-3 rounded-2xl bg-nile-light p-5 text-nile" role="status"><CheckCircle2 className="mt-0.5 shrink-0"/><div className="flex-1"><strong>{t('Thank you — your order is placed')}</strong><p className="text-sm">{t('Order {number} is being prepared. You’ll pay in cash on delivery, and we’ll notify you as it moves.', { number: placed })}</p></div><button type="button" onClick={() => setParams({}, { replace: true })} aria-label={t('Dismiss')} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/50"><X size={16}/></button></div>}
    <PageIntro eyebrow={t('Your purchases')} title={t('Orders')}>{orders.length > 0 && t('{count} orders', { count: orders.length })}</PageIntro>
    {!orders.length ? <EmptyState icon={PackageOpen} title={t('No orders yet')} action={<Button asChild><Link to="/shop">{t('Start shopping')}</Link></Button>}>{t('When you place an order, you can track it here.')}</EmptyState> : <div className="mt-8 grid gap-5">{orders.map((order) => <article key={order.id} className="surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-ink/50">{t('Order · {date}', { date: formatDate(order.createdAt, { dateStyle: 'long' }) })}</p><h2 className="font-semibold tracking-wide">{order.orderNumber}</h2></div><Badge tone={orderStatus[order.status].tone}>{orderStatus[order.status].label}</Badge></div>
      <OrderProgress order={order}/>
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto border-t border-ink/8 pt-5">{order.items.map((item) => <Link to={`/products/${item.productSlug}`} key={item.id} title={`${item.productName}${item.variantLabel ? ` (${variantLabelText(item.variantLabel)})` : ''} × ${item.quantity}`} className="relative shrink-0"><img src={item.imageUrl} alt={item.productName} className="size-16 rounded-xl object-cover"/>{item.quantity > 1 && <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{item.quantity}</span>}</Link>)}</div>
      <details className="group mt-4 rounded-xl bg-sand/50 px-4 py-3 text-sm"><summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">{t('Order details')}<ChevronDown size={16} className="transition group-open:rotate-180"/></summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div><p className="text-xs font-bold uppercase tracking-wider text-ink/45">{t('Delivering to')}</p><p className="mt-2 leading-6 text-ink/70">{order.shippingName}<br/>{order.shippingAddress}<br/>{order.shippingCity}, {order.shippingRegion}<br/>{order.shippingPhone}</p>{order.notes && <p className="mt-2 text-xs italic text-ink/55">“{order.notes}”</p>}</div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-ink/45">{t('Items')}</p><ul className="mt-2 grid gap-1.5">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-3"><span className="min-w-0 truncate text-ink/70">{item.quantity} × {item.productName}{item.variantLabel && <span className="text-ink/50"> · {variantLabelText(item.variantLabel)}</span>}</span><span className="shrink-0">{money(item.lineTotal)}</span></li>)}</ul>
            <dl className="mt-3 grid gap-1.5 border-t border-ink/10 pt-3"><div className="flex justify-between"><dt className="text-ink/60">{t('Subtotal')}</dt><dd>{money(order.subtotal)}</dd></div><div className="flex justify-between"><dt className="text-ink/60">{t('Shipping')}</dt><dd>{Number(order.shippingFee) ? money(order.shippingFee) : t('Free')}</dd></div>{Number(order.discount) > 0 && <div className="flex justify-between text-nile"><dt>{order.couponCode ? t('Discount ({code})', { code: order.couponCode }) : t('Discount')}</dt><dd>−{money(order.discount)}</dd></div>}<div className="flex justify-between font-bold"><dt>{t('Total')}</dt><dd>{money(order.total)}</dd></div></dl></div>
        </div>
      </details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-ink/60">{t('{items} · Cash on delivery', { items: t('{count} items', { count: order.items.reduce((sum, item) => sum + item.quantity, 0) }) })}</p><div className="flex items-center gap-4">{(order.status === 'PENDING' || order.status === 'CONFIRMED') && <button type="button" onClick={async () => { if (await confirmAction({ title: t('Cancel this order?'), message: t('Order {number} will be cancelled and won’t be delivered. This can’t be undone.', { number: order.orderNumber }), confirmLabel: t('Cancel order'), cancelLabel: t('Keep order'), tone: 'danger' })) cancel.mutate(order.orderNumber); }} disabled={cancel.isPending} className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50">{cancel.isPending && cancel.variables === order.orderNumber ? t('Cancelling…') : t('Cancel order')}</button>}<p className="text-lg font-bold">{money(order.total)}</p></div></div>
    </article>)}</div>}
  </main>;
}
