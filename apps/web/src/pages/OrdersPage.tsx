import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, PackageOpen, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { Button } from '../components/ui/Button';
import { api, ApiError, type Order, type OrderStatus } from '../lib/api';
import { money } from '../lib/utils';

const statusStyle: Record<Order['status'], string> = { PENDING: 'bg-amber-100 text-amber-800', CONFIRMED: 'bg-blue-100 text-blue-800', PROCESSING: 'bg-violet-100 text-violet-800', SHIPPED: 'bg-cyan-100 text-cyan-800', DELIVERED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-red-100 text-red-700' };
const progress: { status: Exclude<OrderStatus, 'CANCELLED'>; label: string }[] = [
  { status: 'PENDING', label: 'Placed' }, { status: 'CONFIRMED', label: 'Confirmed' }, { status: 'PROCESSING', label: 'Processing' },
  { status: 'SHIPPED', label: 'Shipped' }, { status: 'DELIVERED', label: 'Delivered' },
];

function OrderProgress({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') return <div className="mt-5 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"><XCircle className="shrink-0" size={20}/><div><strong>Order cancelled</strong><p className="text-xs opacity-75">This order will not be delivered.</p></div></div>;
  const current = progress.findIndex((step) => step.status === order.status);
  return <div className="mt-6" aria-label={`Order status: ${order.status.toLowerCase()}`}><div className="grid grid-cols-5">{progress.map((step, index) => {
    const complete = index <= current;
    return <div key={step.status} className="relative flex flex-col items-center text-center"><span className={`absolute left-0 top-3 h-0.5 w-1/2 ${index > 0 && index <= current ? 'bg-nile' : index > 0 ? 'bg-ink/10' : 'bg-transparent'}`}/><span className={`absolute right-0 top-3 h-0.5 w-1/2 ${index < current ? 'bg-nile' : index < progress.length - 1 ? 'bg-ink/10' : 'bg-transparent'}`}/><span className={`relative z-10 grid size-6 place-items-center rounded-full border-2 ${complete ? 'border-nile bg-nile text-white' : 'border-ink/15 bg-white text-transparent'}`}>{complete && <Check size={13}/>}</span><span className={`mt-2 text-[10px] font-semibold sm:text-xs ${complete ? 'text-nile' : 'text-ink/35'}`}>{step.label}</span></div>;
  })}</div><p className="mt-4 text-center text-xs text-ink/45">Updated {new Date(order.updatedAt).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>;
}

export function OrdersPage() {
  const [params] = useSearchParams(); const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['orders'], queryFn: () => api<{ orders: Order[] }>('/orders'), retry: false, refetchInterval: 30_000, refetchOnWindowFocus: true });
  const cancel = useMutation({ mutationFn: (number: string) => api<{ order: Order }>(`/orders/${number}/cancel`, { method: 'PATCH' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }) });
  if (error instanceof ApiError && error.status === 401) return <AuthRequired title="See your order history"/>;
  if (isLoading) return <main className="container-shell py-20">Loading orders…</main>;
  const orders = data?.orders ?? []; const placed = params.get('placed');
  return <main className="container-shell py-14">{placed && <div className="mb-8 flex items-center gap-3 rounded-2xl bg-nile-light p-5 text-nile"><CheckCircle2/><div><strong>Order placed successfully</strong><p className="text-sm">Order {placed} is now being prepared.</p></div></div>}<p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Your purchases</p><h1 className="mt-2 font-display text-5xl font-bold">Orders</h1>
    {!orders.length ? <div className="grid min-h-[45vh] place-items-center text-center"><div><PackageOpen className="mx-auto text-nile" size={42}/><h2 className="mt-5 font-display text-3xl font-bold">No orders yet</h2><Button className="mt-6" asChild><Link to="/shop">Start shopping</Link></Button></div></div> : <div className="mt-10 grid gap-5">{orders.map((order) => <article key={order.id} className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-ink/45">Order</p><h2 className="font-semibold">{order.orderNumber}</h2><p className="mt-1 text-xs text-ink/45">{new Date(order.createdAt).toLocaleDateString('en-EG', { dateStyle: 'long' })}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[order.status]}`}>{order.status}</span></div><OrderProgress order={order}/><div className="mt-5 flex gap-2 overflow-x-auto border-t border-ink/8 pt-5">{order.items.map((item) => <Link to={`/products/${item.productSlug}`} key={item.id} title={item.productName}><img src={item.imageUrl} alt={item.productName} className="size-16 rounded-xl object-cover"/></Link>)}</div><div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-ink/10 pt-4"><div className="text-sm text-ink/55">{order.items.reduce((sum, item) => sum + item.quantity, 0)} items · Cash on delivery<br/><span>{order.shippingCity}, {order.shippingRegion}</span></div><div className="text-right"><p className="text-lg font-bold">{money(order.total)}</p>{(order.status === 'PENDING' || order.status === 'CONFIRMED') && <button onClick={() => cancel.mutate(order.orderNumber)} disabled={cancel.isPending} className="mt-1 text-xs font-semibold text-red-600">Cancel order</button>}</div></div>{cancel.error instanceof ApiError && cancel.variables === order.orderNumber && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{cancel.error.message}</p>}</article>)}</div>}
  </main>;
}
