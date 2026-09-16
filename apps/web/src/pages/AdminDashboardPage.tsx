import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Ban, Boxes, Check, CircleDollarSign, Clock3, MapPin, PackageCheck, ShieldCheck, ShoppingBag, Store, Users, X } from 'lucide-react';
import { AuthRequired } from '../components/AuthRequired';
import { Button } from '../components/ui/Button';
import { api, ApiError, type AdminOrder, type AdminOverview, type AdminProduct, type AdminUser, type OrderStatus, type ProductStatus, type User } from '../lib/api';
import { money } from '../lib/utils';

type Tab = 'overview' | 'orders' | 'users' | 'products';
type Pagination = { page: number; limit: number; total: number; pages: number };

const productStatusStyle: Record<ProductStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700', PENDING: 'bg-blue-100 text-blue-700', REJECTED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-amber-100 text-amber-700', ARCHIVED: 'bg-slate-100 text-slate-600',
};
const orderStatusStyle: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800', CONFIRMED: 'bg-blue-100 text-blue-800', PROCESSING: 'bg-violet-100 text-violet-800',
  SHIPPED: 'bg-cyan-100 text-cyan-800', DELIVERED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-red-100 text-red-700',
};
const nextOrderStatuses: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'PROCESSING', 'CANCELLED'], CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED', 'CANCELLED'], DELIVERED: [], CANCELLED: [],
};

function MarketplaceChart({ points }: { points: AdminOverview['chart'] }) {
  const max = Math.max(...points.map((point) => Number(point.revenue)), 1);
  return <div className="mt-7 flex h-56 items-end gap-2" aria-label="Marketplace revenue for the last 14 days">
    {points.map((point, index) => <div key={point.date} className="group flex h-full flex-1 flex-col justify-end gap-2">
      <div className="relative min-h-1 rounded-t-lg bg-nile transition hover:bg-gold" style={{ height: `${Math.max(Number(point.revenue) / max * 100, 2)}%` }}>
        <span className="absolute -top-11 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] text-white group-hover:block">{money(point.revenue)} · {point.orders} orders</span>
      </div>
      <span className="text-center text-[9px] text-ink/40">{index % 2 === 0 ? new Date(`${point.date}T00:00:00`).toLocaleDateString('en-EG', { day: 'numeric', month: 'short' }) : ''}</span>
    </div>)}
  </div>;
}

export function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [userSearch, setUserSearch] = useState(''); const [userPage, setUserPage] = useState(1);
  const [productSearch, setProductSearch] = useState(''); const [productStatus, setProductStatus] = useState<ProductStatus | ''>('PENDING'); const [productPage, setProductPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState(''); const [orderStatus, setOrderStatus] = useState<OrderStatus | ''>(''); const [orderPage, setOrderPage] = useState(1);
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), retry: false });
  const isAdmin = me.data?.user.role === 'ADMIN';
  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: () => api<AdminOverview>('/admin/overview'), enabled: isAdmin, retry: false });
  const users = useQuery({
    queryKey: ['admin-users', userSearch, userPage], enabled: isAdmin,
    queryFn: () => api<{ users: AdminUser[]; pagination: Pagination }>(`/admin/users?search=${encodeURIComponent(userSearch)}&page=${userPage}`),
  });
  const products = useQuery({
    queryKey: ['admin-products', productSearch, productStatus, productPage], enabled: isAdmin,
    queryFn: () => api<{ products: AdminProduct[]; pagination: Pagination }>(`/admin/products?search=${encodeURIComponent(productSearch)}&page=${productPage}${productStatus ? `&status=${productStatus}` : ''}`),
  });
  const orders = useQuery({
    queryKey: ['admin-orders', orderSearch, orderStatus, orderPage], enabled: isAdmin,
    queryFn: () => api<{ orders: AdminOrder[]; pagination: Pagination }>(`/admin/orders?search=${encodeURIComponent(orderSearch)}&page=${orderPage}${orderStatus ? `&status=${orderStatus}` : ''}`),
  });
  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: User['role']; status?: 'ACTIVE' | 'SUSPENDED' } }) => api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-users'] }), queryClient.invalidateQueries({ queryKey: ['admin-overview'] })]),
  });
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'REJECTED' | 'ARCHIVED' }) => api(`/admin/products/${id}/moderate`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-products'] }), queryClient.invalidateQueries({ queryKey: ['admin-overview'] })]),
  });
  const updateOrderStatus = useMutation({
    mutationFn: ({ orderNumber, status }: { orderNumber: string; status: OrderStatus }) => api(`/admin/orders/${encodeURIComponent(orderNumber)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-orders'] }), queryClient.invalidateQueries({ queryKey: ['admin-overview'] })]),
  });

  if (me.error instanceof ApiError && me.error.status === 401) return <AuthRequired title="Sign in to open the Admin Panel"/>;
  if (me.isLoading) return <main className="container-shell py-20">Checking administrator access…</main>;
  if (!isAdmin) return <main className="container-shell grid min-h-[65vh] place-items-center py-16 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-full bg-red-50 text-red-600"><ShieldCheck/></div><h1 className="mt-5 font-display text-4xl font-bold">Administrator access required</h1><p className="mt-3 text-ink/50">This workspace is restricted to BazaarNile administrators.</p></div></main>;

  const tabs: { id: Tab; label: string; icon: typeof Activity; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Activity }, { id: 'orders', label: 'Orders', icon: ShoppingBag, count: overview.data?.metrics.openOrders }, { id: 'users', label: 'Users', icon: Users },
    { id: 'products', label: 'Moderation', icon: Boxes, count: overview.data?.metrics.pendingProducts },
  ];
  return <main className="container-shell py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Admin Panel</p><h1 className="mt-2 font-display text-5xl font-bold">Marketplace control room</h1><p className="mt-2 text-ink/50">Monitor growth, manage members, and protect catalog quality.</p></div><span className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"><ShieldCheck className="mr-2 inline" size={15}/>Administrator</span></div>
    <nav className="mt-9 flex gap-2 overflow-x-auto border-b border-ink/10">{tabs.map(({ id, label, icon: Icon, count }) => <button key={id} onClick={() => setTab(id)} className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold ${tab === id ? 'text-nile' : 'text-ink/45 hover:text-ink'}`}><Icon size={17}/>{label}{Boolean(count) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">{count}</span>}{tab === id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-nile"/>}</button>)}</nav>

    {tab === 'overview' && (overview.isLoading ? <p className="py-16">Loading marketplace metrics…</p> : overview.data && <Overview data={overview.data}/>)}
    {tab === 'orders' && <section className="pt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-3xl font-bold">Order management</h2><p className="text-sm text-ink/45">Review checkout details and manage every delivery.</p></div><div className="flex w-full gap-2 sm:w-auto"><input value={orderSearch} onChange={(event) => { setOrderSearch(event.target.value); setOrderPage(1); }} className="min-w-0 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm outline-none focus:border-nile" placeholder="Order, customer, phone…"/><select value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value as OrderStatus | ''); setOrderPage(1); }} className="rounded-full border border-ink/12 bg-white px-4 text-sm"><option value="">All statuses</option>{Object.keys(orderStatusStyle).map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div>
      {updateOrderStatus.error instanceof ApiError && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{updateOrderStatus.error.message}</p>}
      <div className="mt-6 grid gap-5">{orders.data?.orders.map((order) => <article key={order.id} className="rounded-2xl border border-ink/8 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold">{order.orderNumber}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${orderStatusStyle[order.status]}`}>{order.status}</span></div><p className="mt-1 text-xs text-ink/45">Placed {new Date(order.createdAt).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><div className="text-right"><p className="text-xl font-bold">{money(order.total)}</p><p className="text-xs text-ink/45">Cash on delivery</p></div></div>
        <div className="mt-5 grid gap-5 border-y border-ink/8 py-5 lg:grid-cols-[1fr_1fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-wider text-ink/35">Customer</p><p className="mt-2 font-semibold">{order.user.displayName}</p><p className="text-sm text-ink/50">{order.user.email}</p><p className="text-sm text-ink/50">{order.shippingPhone}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-ink/35">Checkout address</p><p className="mt-2 flex gap-2 text-sm text-ink/65"><MapPin className="mt-0.5 shrink-0 text-nile" size={15}/><span>{order.shippingName}<br/>{order.shippingAddress}<br/>{order.shippingCity}, {order.shippingRegion}</span></p>{order.notes && <p className="mt-2 text-xs italic text-ink/45">Note: {order.notes}</p>}</div><div><p className="text-xs font-bold uppercase tracking-wider text-ink/35">Items</p><div className="mt-2 grid gap-2">{order.items.map((item) => <div key={item.id} className="flex items-center gap-3"><img src={item.imageUrl} alt="" className="size-10 rounded-lg object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.productName}</p><p className="text-xs text-ink/45">Qty {item.quantity} × {money(item.unitPrice)}</p></div><p className="text-sm font-semibold">{money(item.lineTotal)}</p></div>)}</div></div></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink/45">Last updated {new Date(order.updatedAt).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>{nextOrderStatuses[order.status].length ? <label className="flex items-center gap-2 text-sm font-semibold"><span>Change status</span><select defaultValue="" disabled={updateOrderStatus.isPending} onChange={(event) => { const status = event.target.value as OrderStatus; if (status === 'CANCELLED' && !window.confirm(`Cancel ${order.orderNumber}? This will restore its inventory.`)) { event.currentTarget.value = ''; return; } if (status) updateOrderStatus.mutate({ orderNumber: order.orderNumber, status }); event.currentTarget.value = ''; }} className="rounded-xl border border-ink/12 bg-white px-3 py-2"><option value="" disabled>Select…</option>{nextOrderStatuses[order.status].map((status) => <option key={status} value={status}>{status === 'CANCELLED' ? 'Cancel order' : status}</option>)}</select></label> : <span className="flex items-center gap-2 text-sm font-semibold text-ink/45"><PackageCheck size={17}/>{order.status === 'DELIVERED' ? 'Order completed' : 'Order cancelled'}</span>}</div>
      </article>)}{orders.isLoading && <p className="py-16 text-center text-ink/45">Loading orders…</p>}{!orders.isLoading && !orders.data?.orders.length && <div className="rounded-2xl bg-sand py-16 text-center"><ShoppingBag className="mx-auto text-nile"/><h3 className="mt-3 font-display text-2xl font-bold">No matching orders</h3></div>}</div><Pager page={orders.data?.pagination.page ?? 1} pages={orders.data?.pagination.pages ?? 1} onPage={setOrderPage}/>
    </section>}
    {tab === 'users' && <section className="pt-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-3xl font-bold">User management</h2><p className="text-sm text-ink/45">Roles, account access, and activity.</p></div><input value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setUserPage(1); }} className="w-full rounded-full border border-ink/12 bg-white px-5 py-3 text-sm outline-none focus:border-nile sm:w-72" placeholder="Search users…"/></div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink/8 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-sand/60 text-xs uppercase tracking-wider text-ink/45"><tr><th className="p-4">Member</th><th className="p-4">Role</th><th className="p-4">Activity</th><th className="p-4">Joined</th><th className="p-4 text-right">Access</th></tr></thead><tbody>{users.data?.users.map((user) => <tr key={user.id} className="border-t border-ink/8"><td className="p-4"><p className="font-semibold">{user.displayName}</p><p className="text-xs text-ink/45">{user.email} · @{user.username}</p></td><td className="p-4"><select value={user.role} disabled={user.id === me.data?.user.id || updateUser.isPending} onChange={(event) => updateUser.mutate({ id: user.id, data: { role: event.target.value as User['role'] } })} className="rounded-lg border border-ink/10 px-3 py-2"><option value="CUSTOMER">Customer</option><option value="SELLER">Seller</option><option value="ADMIN">Admin</option></select></td><td className="p-4 text-ink/55">{user._count.orders} orders · {user._count.products} products</td><td className="p-4 text-ink/55">{new Date(user.createdAt).toLocaleDateString('en-EG')}</td><td className="p-4 text-right"><Button variant="outline" disabled={user.id === me.data?.user.id || updateUser.isPending} onClick={() => updateUser.mutate({ id: user.id, data: { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } })}>{user.status === 'ACTIVE' ? <><Ban size={15}/>Suspend</> : <><Check size={15}/>Restore</>}</Button></td></tr>)}</tbody></table>{!users.data?.users.length && <p className="p-10 text-center text-ink/45">No users found.</p>}</div><Pager page={users.data?.pagination.page ?? 1} pages={users.data?.pagination.pages ?? 1} onPage={setUserPage}/>
    </section>}

    {tab === 'products' && <section className="pt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-3xl font-bold">Product moderation</h2><p className="text-sm text-ink/45">Review seller submissions before they reach shoppers.</p></div><div className="flex w-full gap-2 sm:w-auto"><input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductPage(1); }} className="min-w-0 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm outline-none focus:border-nile" placeholder="Search products…"/><select value={productStatus} onChange={(event) => { setProductStatus(event.target.value as ProductStatus | ''); setProductPage(1); }} className="rounded-full border border-ink/12 bg-white px-4 text-sm"><option value="">All</option><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="REJECTED">Rejected</option><option value="ARCHIVED">Archived</option><option value="DRAFT">Draft</option></select></div></div>
      <div className="mt-6 grid gap-4">{products.data?.products.map((product) => <article key={product.id} className="grid gap-5 rounded-2xl border border-ink/8 bg-white p-5 md:grid-cols-[96px_1fr_auto] md:items-center"><img src={product.imageUrl} alt="" className="size-24 rounded-2xl object-cover"/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold">{product.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${productStatusStyle[product.status]}`}>{product.status}</span></div><p className="mt-1 text-sm text-ink/50">{product.category.name} · {money(product.price)} · {product.inventory} in stock</p><p className="mt-2 line-clamp-2 text-sm text-ink/60">{product.description}</p><p className="mt-2 text-xs font-semibold text-nile">Seller: {product.seller.displayName} (@{product.seller.username})</p></div><div className="flex flex-wrap gap-2 md:max-w-40 md:justify-end">{product.status !== 'ACTIVE' && <Button disabled={moderate.isPending} onClick={() => moderate.mutate({ id: product.id, status: 'ACTIVE' })}><Check size={16}/>Approve</Button>}{product.status !== 'REJECTED' && <Button variant="outline" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: product.id, status: 'REJECTED' })}><X size={16}/>Reject</Button>}{product.status === 'ACTIVE' && <button disabled={moderate.isPending} onClick={() => moderate.mutate({ id: product.id, status: 'ARCHIVED' })} className="w-full text-xs font-semibold text-red-600">Remove listing</button>}</div></article>)}{!products.data?.products.length && <div className="rounded-2xl bg-sand py-16 text-center"><Clock3 className="mx-auto text-nile"/><h3 className="mt-3 font-display text-2xl font-bold">Review queue is clear</h3></div>}</div><Pager page={products.data?.pagination.page ?? 1} pages={products.data?.pagination.pages ?? 1} onPage={setProductPage}/>
    </section>}
  </main>;
}

function Overview({ data }: { data: AdminOverview }) {
  const cards = [
    { label: 'Marketplace GMV', value: money(data.metrics.grossMerchandiseValue), detail: `${money(data.metrics.averageOrderValue)} average order`, icon: CircleDollarSign },
    { label: 'Orders', value: data.metrics.totalOrders, detail: `${data.metrics.openOrders} currently open`, icon: ShoppingBag },
    { label: 'Members', value: data.metrics.totalUsers, detail: `+${data.metrics.newUsers} in 30 days`, icon: Users },
    { label: 'Products', value: data.metrics.activeProducts, detail: `${data.metrics.pendingProducts} awaiting review`, icon: Boxes },
  ];
  return <section className="pt-8"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon }) => <article key={label} className="rounded-2xl border border-ink/8 bg-white p-5"><div className="flex items-start justify-between"><p className="text-sm text-ink/50">{label}</p><span className="grid size-9 place-items-center rounded-full bg-nile-light text-nile"><Icon size={17}/></span></div><p className="mt-4 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-ink/40">{detail}</p></article>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]"><article className="rounded-2xl border border-ink/8 bg-white p-6"><h2 className="font-display text-2xl font-bold">Marketplace activity</h2><p className="text-sm text-ink/45">Gross merchandise value · last 14 days</p><MarketplaceChart points={data.chart}/></article><article className="rounded-2xl border border-ink/8 bg-white p-6"><h2 className="font-display text-2xl font-bold">Top sellers</h2><div className="mt-5 grid gap-4">{data.topSellers.length ? data.topSellers.map((seller, index) => <div key={seller.id} className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{seller.displayName}</p><p className="text-xs text-ink/40">{seller.orders} orders</p></div><p className="text-sm font-bold">{money(seller.revenue)}</p></div>) : <p className="py-10 text-center text-sm text-ink/40">Seller performance will appear here.</p>}</div></article></div>
    <div className="mt-6 grid gap-4 rounded-2xl bg-ink p-6 text-white sm:grid-cols-3"><div><Store className="text-gold"/><p className="mt-3 text-2xl font-bold">{data.metrics.sellers}</p><p className="text-sm text-white/55">Active seller accounts</p></div><div><Clock3 className="text-gold"/><p className="mt-3 text-2xl font-bold">{data.metrics.pendingProducts}</p><p className="text-sm text-white/55">Products pending review</p></div><div><Ban className="text-gold"/><p className="mt-3 text-2xl font-bold">{data.metrics.suspendedUsers}</p><p className="text-sm text-white/55">Suspended accounts</p></div></div>
  </section>;
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return <div className="mt-5 flex items-center justify-end gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><span className="text-sm text-ink/50">Page {page} of {pages}</span><Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button></div>;
}
