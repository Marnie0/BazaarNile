import { useState } from 'react';
import { InventoryPanel, StockMeter } from '../components/admin/InventoryPanel';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowRight, Ban, Boxes, Check, CircleDollarSign, Clock3, MapPin, PackageCheck, ShieldCheck, ShoppingBag, Store, TicketPercent, Users, Warehouse, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { PageIntro, PageLoader } from '../components/PageState';
import { toast, toastError } from '../lib/toast';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Button } from '../components/ui/Button';
import { confirmAction } from '../lib/confirm';
import { Badge } from '../components/ui/Badge';
import { orderStatus as orderStatusMeta, productStatus as productStatusMeta } from '../lib/status';
import { api, ApiError, type AdminOrder, type AdminOverview, type AdminProduct, type AdminUser, type OrderStatus, type ProductStatus, type User } from '../lib/api';
import { formatDate, money } from '../lib/utils';

type Tab = 'overview' | 'orders' | 'users' | 'products' | 'inventory';
const tabIds: Tab[] = ['overview', 'orders', 'inventory', 'products', 'users'];
type Pagination = { page: number; limit: number; total: number; pages: number };

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
  useDocumentTitle('Admin Panel');
  const [params, setParams] = useSearchParams();
  // The tab lives in the URL so reloads, back/forward, and shared links keep the admin's place.
  const tab: Tab = tabIds.find((id) => id === params.get('tab')) ?? 'overview';
  const setTab = (next: Tab) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true });
  const [userSearch, setUserSearch] = useState(''); const [userPage, setUserPage] = useState(1);
  const [productSearch, setProductSearch] = useState(''); const [productStatus, setProductStatus] = useState<ProductStatus | ''>('PENDING'); const [productPage, setProductPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState(''); const [orderStatus, setOrderStatus] = useState<OrderStatus | ''>(''); const [orderPage, setOrderPage] = useState(1);
  const debouncedUserSearch = useDebouncedValue(userSearch.trim()); const debouncedProductSearch = useDebouncedValue(productSearch.trim()); const debouncedOrderSearch = useDebouncedValue(orderSearch.trim());
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), retry: false });
  const isAdmin = me.data?.user.role === 'ADMIN';
  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: () => api<AdminOverview>('/admin/overview'), enabled: isAdmin, retry: false });
  const users = useQuery({
    queryKey: ['admin-users', debouncedUserSearch, userPage], enabled: isAdmin && tab === 'users', placeholderData: keepPreviousData,
    queryFn: () => api<{ users: AdminUser[]; pagination: Pagination }>(`/admin/users?search=${encodeURIComponent(debouncedUserSearch)}&page=${userPage}`),
  });
  const products = useQuery({
    queryKey: ['admin-products', debouncedProductSearch, productStatus, productPage], enabled: isAdmin && tab === 'products', placeholderData: keepPreviousData,
    queryFn: () => api<{ products: AdminProduct[]; pagination: Pagination }>(`/admin/products?search=${encodeURIComponent(debouncedProductSearch)}&page=${productPage}${productStatus ? `&status=${productStatus}` : ''}`),
  });
  const orders = useQuery({
    queryKey: ['admin-orders', debouncedOrderSearch, orderStatus, orderPage], enabled: isAdmin && tab === 'orders', placeholderData: keepPreviousData,
    queryFn: () => api<{ orders: AdminOrder[]; pagination: Pagination }>(`/admin/orders?search=${encodeURIComponent(debouncedOrderSearch)}&page=${orderPage}${orderStatus ? `&status=${orderStatus}` : ''}`),
  });
  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: User['role']; status?: 'ACTIVE' | 'SUSPENDED' } }) => api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: async () => { toast('Member updated'); await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-users'] }), queryClient.invalidateQueries({ queryKey: ['admin-overview'] })]); },
    onError: (cause) => toastError(cause, 'Could not update this member'),
  });
  const changeUser = async (user: AdminUser, data: { role?: User['role']; status?: 'ACTIVE' | 'SUSPENDED' }) => {
    const request = data.status === 'SUSPENDED'
      ? { title: `Suspend ${user.displayName}?`, message: 'They will be signed out on every device and cannot sign in until restored.', confirmLabel: 'Suspend account', tone: 'danger' as const }
      : data.status === 'ACTIVE' ? { title: `Restore ${user.displayName}?`, message: 'They will be able to sign in and shop again.', confirmLabel: 'Restore access' }
      : { title: `Make ${user.displayName} ${data.role === 'ADMIN' ? 'an admin' : `a ${data.role?.toLowerCase()}`}?`, message: data.role === 'ADMIN' ? 'Admins have full control of the marketplace, including users, orders, and coupons.' : 'Their access changes immediately.', confirmLabel: 'Change role', tone: data.role === 'ADMIN' ? 'danger' as const : 'default' as const };
    if (await confirmAction(request)) updateUser.mutate({ id: user.id, data });
  };
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'REJECTED' | 'ARCHIVED' }) => api(`/admin/products/${id}/moderate`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: async (_, { status }) => {
      toast(status === 'ACTIVE' ? 'Listing approved and live' : status === 'REJECTED' ? 'Listing rejected' : 'Listing removed from the shop');
      await Promise.all(['admin-products', 'admin-overview', 'admin-inventory', 'admin-inventory-summary', 'products'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
    onError: (cause) => toastError(cause, 'Could not update the listing'),
  });
  const updateOrderStatus = useMutation({
    mutationFn: ({ orderNumber, status }: { orderNumber: string; status: OrderStatus }) => api(`/admin/orders/${encodeURIComponent(orderNumber)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-orders'] }), queryClient.invalidateQueries({ queryKey: ['admin-overview'] })]),
  });

  if (me.error instanceof ApiError && me.error.status === 401) return <AuthRequired title="Sign in to open the Admin Panel"/>;
  if (me.isLoading) return <PageLoader label="Checking administrator access…"/>;
  if (!isAdmin) return <main className="container-shell grid min-h-[65vh] place-items-center py-16 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-full bg-red-50 text-red-600"><ShieldCheck/></div><h1 className="mt-5 font-display text-4xl font-bold">Administrator access required</h1><p className="mt-3 text-ink/50">This workspace is restricted to BazaarNile administrators.</p></div></main>;

  const tabs: { id: Tab; label: string; icon: typeof Activity; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Activity }, { id: 'orders', label: 'Orders', icon: ShoppingBag, count: overview.data?.metrics.openOrders },
    { id: 'inventory', label: 'Inventory', icon: Warehouse, count: (overview.data?.metrics.lowStockProducts ?? 0) + (overview.data?.metrics.outOfStockProducts ?? 0) },
    { id: 'products', label: 'Moderation', icon: Boxes, count: overview.data?.metrics.pendingProducts }, { id: 'users', label: 'Users', icon: Users },
  ];
  return <main className="container-shell py-10 sm:py-12"><PageIntro eyebrow="Admin Panel" title="Marketplace control room" actions={<><Button variant="outline" asChild><Link to="/admin/coupons"><TicketPercent size={16}/>Coupons</Link></Button><span className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"><ShieldCheck className="mr-2 inline" size={15}/>Administrator</span></>}>Monitor growth, manage members, and protect catalog quality.</PageIntro>
    <nav className="no-scrollbar mt-9 flex gap-2 overflow-x-auto border-b border-ink/10" role="tablist">{tabs.map(({ id, label, icon: Icon, count }) => <button type="button" role="tab" aria-selected={tab === id} key={id} onClick={() => setTab(id)} className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold ${tab === id ? 'text-nile' : 'text-ink/45 hover:text-ink'}`}><Icon size={17}/>{label}{Boolean(count) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">{count}</span>}{tab === id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-nile"/>}</button>)}</nav>

    {tab === 'overview' && (overview.isLoading ? <p className="py-16">Loading marketplace metrics…</p> : overview.data && <Overview data={overview.data} onOpenInventory={() => setTab('inventory')}/>)}
    {tab === 'inventory' && <InventoryPanel/>}
    {tab === 'orders' && <section className="pt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-3xl font-bold">Order management</h2><p className="text-sm text-ink/45">Review checkout details and manage every delivery.</p></div><div className="flex w-full gap-2 sm:w-auto"><input value={orderSearch} onChange={(event) => { setOrderSearch(event.target.value); setOrderPage(1); }} className="field min-w-0 flex-1 rounded-full py-2.5 text-sm sm:w-64" placeholder="Order, customer, phone…" type="search" aria-label="Search orders"/><select value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value as OrderStatus | ''); setOrderPage(1); }} aria-label="Filter orders by status" className="field select-field w-auto rounded-full py-2.5 text-sm"><option value="">All statuses</option>{(Object.keys(orderStatusMeta) as OrderStatus[]).map((status) => <option key={status} value={status}>{orderStatusMeta[status].label}</option>)}</select></div></div>
      {updateOrderStatus.error instanceof ApiError && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{updateOrderStatus.error.message}</p>}
      <div className="mt-6 grid gap-5">{orders.data?.orders.map((order) => <article key={order.id} className="rounded-2xl border border-ink/8 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold">{order.orderNumber}</h3><Badge tone={orderStatusMeta[order.status].tone}>{orderStatusMeta[order.status].label}</Badge></div><p className="mt-1 text-xs text-ink/45">Placed {new Date(order.createdAt).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><div className="text-right"><p className="text-xl font-bold">{money(order.total)}</p><p className="text-xs text-ink/45">Cash on delivery</p></div></div>
        <div className="mt-5 grid gap-5 border-y border-ink/8 py-5 lg:grid-cols-[1fr_1fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-wider text-ink/35">Customer</p><p className="mt-2 font-semibold">{order.user.displayName}</p><p className="text-sm text-ink/50">{order.user.email}</p><p className="text-sm text-ink/50">{order.shippingPhone}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-ink/35">Checkout address</p><p className="mt-2 flex gap-2 text-sm text-ink/65"><MapPin className="mt-0.5 shrink-0 text-nile" size={15}/><span>{order.shippingName}<br/>{order.shippingAddress}<br/>{order.shippingCity}, {order.shippingRegion}</span></p>{order.notes && <p className="mt-2 text-xs italic text-ink/45">Note: {order.notes}</p>}</div><div><p className="text-xs font-bold uppercase tracking-wider text-ink/35">Items</p><div className="mt-2 grid gap-2">{order.items.map((item) => <div key={item.id} className="flex items-center gap-3"><img src={item.imageUrl} alt="" className="size-10 rounded-lg object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.productName}</p><p className="text-xs text-ink/45">{item.variantLabel && <>{item.variantLabel} · </>}Qty {item.quantity} × {money(item.unitPrice)}</p></div><p className="text-sm font-semibold">{money(item.lineTotal)}</p></div>)}</div></div></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink/45">Last updated {new Date(order.updatedAt).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>{nextOrderStatuses[order.status].length ? <label className="flex items-center gap-2 text-sm font-semibold"><span>Change status</span><select defaultValue="" disabled={updateOrderStatus.isPending} onChange={async (event) => { const select = event.currentTarget; const status = select.value as OrderStatus; select.value = ''; if (!status) return; if (status === 'CANCELLED' && !(await confirmAction({ title: `Cancel ${order.orderNumber}?`, message: 'The customer will be notified, the items go back into stock, and any coupon use is released.', confirmLabel: 'Cancel order', cancelLabel: 'Keep order', tone: 'danger' }))) return; updateOrderStatus.mutate({ orderNumber: order.orderNumber, status }); }} className="field select-field w-auto py-2 text-sm"><option value="" disabled>Select…</option>{nextOrderStatuses[order.status].map((status) => <option key={status} value={status}>{status === 'CANCELLED' ? 'Cancel order' : `Mark as ${orderStatusMeta[status].label.toLowerCase()}`}</option>)}</select></label> : <span className="flex items-center gap-2 text-sm font-semibold text-ink/45"><PackageCheck size={17}/>{order.status === 'DELIVERED' ? 'Order completed' : 'Order cancelled'}</span>}</div>
      </article>)}{orders.isLoading && <p className="py-16 text-center text-ink/45">Loading orders…</p>}{!orders.isLoading && !orders.data?.orders.length && <div className="rounded-2xl bg-sand py-16 text-center"><ShoppingBag className="mx-auto text-nile"/><h3 className="mt-3 font-display text-2xl font-bold">No matching orders</h3></div>}</div><Pager page={orders.data?.pagination.page ?? 1} pages={orders.data?.pagination.pages ?? 1} onPage={setOrderPage}/>
    </section>}
    {tab === 'users' && <section className="pt-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-3xl font-bold">User management</h2><p className="text-sm text-ink/45">Roles, account access, and activity.</p></div><input value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setUserPage(1); }} className="field rounded-full py-2.5 text-sm sm:w-72" placeholder="Search users…" type="search" aria-label="Search users"/></div>
      <ul className="mt-6 grid gap-3 md:hidden">{users.data?.users.map((user) => <li key={user.id} className="surface p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{user.displayName}</p><p className="truncate text-xs text-ink/55">{user.email}</p><p className="text-xs text-ink/55">@{user.username} · joined {formatDate(user.createdAt)}</p></div>{user.status === 'SUSPENDED' && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">SUSPENDED</span>}</div>
        <p className="mt-2 text-xs text-ink/60">{user._count.orders} orders · {user._count.products} products</p>
        <div className="mt-3 flex gap-2"><select value={user.role} disabled={user.id === me.data?.user.id || updateUser.isPending} onChange={(event) => changeUser(user, { role: event.target.value as User['role'] })} aria-label={`Role for ${user.displayName}`} className="field select-field flex-1 py-2 text-sm"><option value="CUSTOMER">Customer</option><option value="SELLER">Seller</option><option value="ADMIN">Admin</option></select><Button variant={user.status === 'ACTIVE' ? 'danger' : 'outline'} className="px-4 py-2" disabled={user.id === me.data?.user.id || updateUser.isPending} onClick={() => changeUser(user, { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}>{user.status === 'ACTIVE' ? <><Ban size={15}/>Suspend</> : <><Check size={15}/>Restore</>}</Button></div>
      </li>)}</ul>
      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-ink/8 bg-white md:block"><table className="w-full text-left text-sm"><thead className="bg-sand/60 text-xs uppercase tracking-wider text-ink/50"><tr><th className="p-4">Member</th><th className="p-4">Role</th><th className="p-4">Activity</th><th className="p-4">Joined</th><th className="p-4 text-right">Access</th></tr></thead><tbody>{users.data?.users.map((user) => <tr key={user.id} className="border-t border-ink/8"><td className="p-4"><p className="font-semibold">{user.displayName}{user.status === 'SUSPENDED' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">SUSPENDED</span>}</p><p className="text-xs text-ink/55">{user.email} · @{user.username}</p></td><td className="p-4"><select value={user.role} disabled={user.id === me.data?.user.id || updateUser.isPending} onChange={(event) => changeUser(user, { role: event.target.value as User['role'] })} aria-label={`Role for ${user.displayName}`} className="field select-field w-auto py-2 text-sm"><option value="CUSTOMER">Customer</option><option value="SELLER">Seller</option><option value="ADMIN">Admin</option></select></td><td className="p-4 text-ink/60">{user._count.orders} orders · {user._count.products} products</td><td className="p-4 text-ink/60">{formatDate(user.createdAt)}</td><td className="p-4 text-right"><Button variant={user.status === 'ACTIVE' ? 'danger' : 'outline'} className="px-4 py-2" disabled={user.id === me.data?.user.id || updateUser.isPending} onClick={() => changeUser(user, { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}>{user.status === 'ACTIVE' ? <><Ban size={15}/>Suspend</> : <><Check size={15}/>Restore</>}</Button></td></tr>)}</tbody></table></div>
      {!users.isLoading && !users.data?.users.length && <p className="surface mt-3 p-10 text-center text-ink/55">No users found.</p>}<Pager page={users.data?.pagination.page ?? 1} pages={users.data?.pagination.pages ?? 1} onPage={setUserPage}/>
    </section>}

    {tab === 'products' && <section className="pt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-3xl font-semibold">Listing moderation</h2><p className="text-sm text-ink/55">Review seller submissions before they reach the shop.</p></div><div className="flex w-full gap-2 sm:w-auto"><input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductPage(1); }} className="field min-w-0 flex-1 rounded-full py-2.5 text-sm sm:w-64" placeholder="Search products…" type="search" aria-label="Search products"/><select value={productStatus} onChange={(event) => { setProductStatus(event.target.value as ProductStatus | ''); setProductPage(1); }} aria-label="Filter by status" className="field select-field w-auto rounded-full py-2.5 text-sm"><option value="">All</option><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="REJECTED">Rejected</option><option value="ARCHIVED">Archived</option><option value="DRAFT">Draft</option></select></div></div>
      <div className="mt-6 grid gap-4">{products.data?.products.map((product) => <article key={product.id} className="surface grid grid-cols-[72px_1fr] gap-x-4 gap-y-4 p-4 sm:grid-cols-[88px_1fr] sm:p-5 lg:grid-cols-[96px_1fr_14rem_auto] lg:items-center lg:gap-6">
        <img src={product.imageUrl} alt="" className="size-[72px] rounded-xl object-cover sm:size-[88px] sm:rounded-2xl lg:size-24"/>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold leading-snug sm:text-lg">{product.name}</h3><Badge tone={productStatusMeta[product.status].tone} title={productStatusMeta[product.status].help}>{productStatusMeta[product.status].label}</Badge></div><p className="mt-1 text-sm text-ink/60">{product.category.name} · {money(product.price)}{product.compareAt ? <s className="ml-1.5 text-ink/40">{money(product.compareAt)}</s> : null}</p><p className="mt-2 line-clamp-2 text-sm text-ink/60">{product.description}</p><p className="mt-2 text-xs font-semibold text-nile">{product.seller.displayName} · @{product.seller.username}</p></div>
        <div className="col-span-2 sm:col-span-1 sm:col-start-2 lg:col-start-auto"><StockMeter units={product.inventory}/><button type="button" onClick={() => setTab('inventory')} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-nile hover:underline">Manage stock <ArrowRight size={12}/></button></div>
        <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:col-start-2 lg:col-start-auto lg:w-36 lg:flex-col">{product.status !== 'ACTIVE' && <Button className="px-4 py-2" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: product.id, status: 'ACTIVE' })}><Check size={16}/>Approve</Button>}{product.status !== 'REJECTED' && product.status !== 'ARCHIVED' && <Button variant="outline" className="px-4 py-2" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: product.id, status: 'REJECTED' })}><X size={16}/>Reject</Button>}{product.status === 'ACTIVE' && <Button variant="danger" className="px-4 py-2" disabled={moderate.isPending} onClick={async () => { if (await confirmAction({ title: `Remove ${product.name}?`, message: 'The listing is archived and disappears from the shop. Past orders are not affected.', confirmLabel: 'Remove listing', tone: 'danger' })) moderate.mutate({ id: product.id, status: 'ARCHIVED' }); }}>Remove</Button>}</div>
      </article>)}{!products.isLoading && !products.data?.products.length && <div className="rounded-2xl bg-sand py-16 text-center"><Clock3 className="mx-auto text-nile"/><h3 className="mt-3 font-display text-2xl font-semibold">{productStatus === 'PENDING' ? 'No listings waiting for review' : 'No matching products'}</h3><p className="mt-1 text-sm text-ink/55">{productStatus === 'PENDING' ? 'New seller submissions will appear here.' : 'Try another search or status.'}</p></div>}</div><Pager page={products.data?.pagination.page ?? 1} pages={products.data?.pagination.pages ?? 1} onPage={setProductPage}/>
    </section>}
  </main>;
}

function Overview({ data, onOpenInventory }: { data: AdminOverview; onOpenInventory: () => void }) {
  const cards = [
    { label: 'Marketplace GMV', value: money(data.metrics.grossMerchandiseValue), detail: `${money(data.metrics.totalDiscounts)} discounts granted`, icon: CircleDollarSign },
    { label: 'Orders', value: data.metrics.totalOrders, detail: `${data.metrics.openOrders} currently open`, icon: ShoppingBag },
    { label: 'Members', value: data.metrics.totalUsers, detail: `+${data.metrics.newUsers} in 30 days`, icon: Users },
    { label: 'Products', value: data.metrics.activeProducts, detail: `${data.metrics.pendingProducts} awaiting review`, icon: Boxes },
  ];
  const { lowStockProducts: low, outOfStockProducts: out } = data.metrics;
  const stockAlert = out || low ? <button type="button" onClick={onOpenInventory} className="mb-5 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-900 transition hover:border-red-300">
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-700"><AlertTriangle size={17}/></span>
    <span className="min-w-0 flex-1"><strong className="block">Stock needs attention</strong>{[out && `${out} live listing${out === 1 ? ' is' : 's are'} out of stock`, low && `${low} running low`].filter(Boolean).join(' · ')}</span>
    <span className="inline-flex items-center gap-1 font-semibold">Review inventory <ArrowRight size={15}/></span>
  </button> : null;
  return <section className="pt-8">{stockAlert}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon }) => <article key={label} className="rounded-2xl border border-ink/8 bg-white p-5"><div className="flex items-start justify-between"><p className="text-sm text-ink/50">{label}</p><span className="grid size-9 place-items-center rounded-full bg-nile-light text-nile"><Icon size={17}/></span></div><p className="mt-4 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-ink/40">{detail}</p></article>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]"><article className="rounded-2xl border border-ink/8 bg-white p-6"><h2 className="font-display text-2xl font-bold">Marketplace activity</h2><p className="text-sm text-ink/45">Gross merchandise value · last 14 days</p><MarketplaceChart points={data.chart}/></article><article className="rounded-2xl border border-ink/8 bg-white p-6"><h2 className="font-display text-2xl font-bold">Top sellers</h2><div className="mt-5 grid gap-4">{data.topSellers.length ? data.topSellers.map((seller, index) => <div key={seller.id} className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{seller.displayName}</p><p className="text-xs text-ink/40">{seller.orders} orders</p></div><p className="text-sm font-bold">{money(seller.revenue)}</p></div>) : <p className="py-10 text-center text-sm text-ink/40">Seller performance will appear here.</p>}</div></article></div>
    <div className="mt-6 grid gap-4 rounded-2xl bg-ink p-6 text-white sm:grid-cols-4"><div><Store className="text-gold"/><p className="mt-3 text-2xl font-bold">{data.metrics.sellers}</p><p className="text-sm text-white/55">Seller accounts</p></div><div><Clock3 className="text-gold"/><p className="mt-3 text-2xl font-bold">{data.metrics.pendingProducts}</p><p className="text-sm text-white/55">Products pending</p></div><div><TicketPercent className="text-gold"/><p className="mt-3 text-2xl font-bold">{data.metrics.couponOrders}</p><p className="text-sm text-white/55">Discounted orders</p></div><div><Activity className="text-gold"/><p className="mt-3 text-2xl font-bold">{data.metrics.repeatCustomerRate}%</p><p className="text-sm text-white/55">Repeat customers</p></div></div>
    <article className="mt-6 rounded-2xl border border-ink/8 bg-white p-6"><h2 className="font-display text-2xl font-bold">Category performance</h2><p className="text-sm text-ink/45">Units and gross sales across fulfilled and open orders</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{data.categorySales.map((category, index) => <div key={category.name} className="rounded-xl bg-sand p-4"><p className="text-xs font-bold uppercase tracking-wider text-nile">#{index + 1}</p><h3 className="mt-2 font-semibold">{category.name}</h3><p className="mt-2 text-lg font-bold">{money(category.revenue)}</p><p className="text-xs text-ink/45">{category.units} units</p></div>)}</div></article>
  </section>;
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return <div className="mt-5 flex items-center justify-end gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><span className="text-sm text-ink/50">Page {page} of {pages}</span><Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button></div>;
}
