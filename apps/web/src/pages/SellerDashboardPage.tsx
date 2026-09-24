import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, Box, CircleDollarSign, PackagePlus, Pencil, ShoppingCart, Store, Trash2, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { PageIntro, PageLoader } from '../components/PageState';
import { toast, toastError } from '../lib/toast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Button } from '../components/ui/Button';
import { confirmAction } from '../lib/confirm';
import { Badge } from '../components/ui/Badge';
import { productStatus } from '../lib/status';
import { api, ApiError, type SellerOverview, type SellerProduct, type User } from '../lib/api';
import { t } from '../lib/i18n';
import { formatDate, money } from '../lib/utils';


function SalesChart({ points }: { points: SellerOverview['chart'] }) {
  const max = Math.max(...points.map((point) => Number(point.revenue)), 1);
  return <div className="mt-7 flex h-52 items-end gap-2" aria-label={t('Sales during the last 14 days')}>
    {points.map((point, index) => <div key={point.date} className="group flex h-full flex-1 flex-col justify-end gap-2">
      <div className="relative min-h-1 rounded-t-lg bg-nile transition hover:bg-gold" style={{ height: `${Math.max((Number(point.revenue) / max) * 100, 2)}%` }}>
        <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] text-white group-hover:block">{money(point.revenue)}</span>
      </div>
      <span className="text-center text-[9px] text-ink/40">{index % 2 === 0 ? formatDate(`${point.date}T00:00:00`, { day: 'numeric', month: 'short' }) : ''}</span>
    </div>)}
  </div>;
}

export function SellerDashboardPage() {
  useDocumentTitle(t('Seller Center'));
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), retry: false });
  const isSeller = me.data?.user.role === 'SELLER' || me.data?.user.role === 'ADMIN';
  const overview = useQuery({ queryKey: ['seller-overview'], queryFn: () => api<SellerOverview>('/seller/overview'), enabled: isSeller, retry: false });
  const products = useQuery({ queryKey: ['seller-products'], queryFn: () => api<{ products: SellerProduct[] }>('/seller/products'), enabled: isSeller, retry: false });
  const enroll = useMutation({ mutationFn: () => api<{ role: string }>('/seller/enroll', { method: 'POST' }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['me'] }); toast(t('Seller tools activated — welcome to Seller Center')); } });
  const remove = useMutation({ mutationFn: (id: string) => api<{ archived?: boolean } | undefined>(`/seller/products/${id}`, { method: 'DELETE' }), onSuccess: async (result) => {
    toast(result?.archived ? t('Listing archived — it has past sales, so it was kept for your records') : t('Listing deleted'));
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['seller-products'] }), queryClient.invalidateQueries({ queryKey: ['seller-overview'] })]);
  }, onError: (cause) => toastError(cause, t('Could not remove this listing')) });

  if (me.error instanceof ApiError && me.error.status === 401) return <AuthRequired title={t('Sign in to open Seller Center')}/>;
  if (me.isLoading) return <PageLoader label={t('Opening Seller Center…')}/>;
  if (!isSeller) return <main className="container-shell grid min-h-[65vh] place-items-center py-16 text-center"><section className="max-w-xl rounded-[2rem] bg-sand p-9 sm:p-12">
    <div className="mx-auto grid size-16 place-items-center rounded-full bg-nile text-white"><Store/></div><p className="mt-6 text-sm font-bold uppercase tracking-[.18em] text-nile">{t('Seller Center')}</p>
    <h1 className="mt-2 font-display text-4xl font-bold">{t('Turn your ideas into a storefront')}</h1><p className="mt-4 text-ink/60">{t('Activate seller tools to publish products, manage inventory, and follow every sale from one dashboard.')}</p>
    {enroll.error && <p className="mt-4 text-sm text-red-600">{enroll.error.message}</p>}<Button size="lg" className="mt-7" disabled={enroll.isPending} onClick={() => enroll.mutate()}>{enroll.isPending ? t('Activating…') : t('Start selling')}</Button>
  </section></main>;
  if (overview.isLoading || products.isLoading) return <PageLoader label={t('Loading your business…')}/>;
  const data = overview.data; const items = products.data?.products ?? [];
  if (!data) return <main className="container-shell py-20">{t('Unable to load Seller Center.')}</main>;
  const cards = [
    { label: t('Delivered revenue'), value: money(data.metrics.revenue), detail: t('{amount} gross sales', { amount: money(data.metrics.grossSales) }), icon: CircleDollarSign },
    { label: t('Units sold'), value: data.metrics.unitsSold, detail: t('Excluding cancelled orders'), icon: ShoppingCart },
    { label: t('Active listings'), value: data.metrics.activeProducts, detail: t('{count} total products', { count: data.metrics.totalProducts }), icon: Box },
    { label: t('Stock alerts'), value: data.metrics.lowStock + data.metrics.outOfStock, detail: t('{count} out of stock', { count: data.metrics.outOfStock }), icon: AlertTriangle },
  ];
  return <main className="container-shell py-12">
    <PageIntro eyebrow={t('Seller Center')} title={t('Business overview')} actions={<Button asChild><Link to="/seller/products/new"><PackagePlus size={18}/>{t('Add product')}</Link></Button>}>{t('Welcome back, {name}.', { name: me.data?.user.displayName ?? '' })}</PageIntro>
    <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon }) => <article key={label} className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><p className="text-sm text-ink/50">{label}</p><span className="grid size-9 place-items-center rounded-full bg-nile-light text-nile"><Icon size={17}/></span></div><p className="mt-4 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-ink/40">{detail}</p></article>)}</section>
    <section className="mt-6 grid gap-6 lg:grid-cols-[1.65fr_1fr]"><article className="rounded-2xl border border-ink/8 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-2xl font-bold">{t('Sales pulse')}</h2><p className="text-sm text-ink/45">{t('Gross sales · last 14 days')}</p></div><TrendingUp className="text-nile"/></div><SalesChart points={data.chart}/></article>
      <article className="rounded-2xl border border-ink/8 bg-white p-6"><h2 className="font-display text-2xl font-bold">{t('Top products')}</h2><div className="mt-5 grid gap-4">{data.topProducts.length ? data.topProducts.map((product, index) => <div className="flex items-center gap-3" key={product.productName}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.productName}</p><p className="text-xs text-ink/40">{t('{count} units', { count: product.units })}</p></div><p className="text-sm font-bold">{money(product.revenue)}</p></div>) : <p className="py-12 text-center text-sm text-ink/40">{t('Sales will appear here.')}</p>}</div></article></section>
    <section className="mt-12"><div className="flex items-end justify-between"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">{t('Inventory')}</p><h2 className="mt-1 font-display text-3xl font-bold">{t('Your products')}</h2></div><span className="text-sm text-ink/45">{t('{count} listings', { count: items.length })}</span></div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-ink/8 bg-white">{items.length ? items.map((product) => <article key={product.id} className="grid gap-4 border-b border-ink/8 p-4 last:border-0 sm:grid-cols-[64px_1fr_auto_auto] sm:items-center"><img src={product.imageUrl} alt="" className="size-16 rounded-xl object-cover"/><div className="min-w-0">{product.status === 'ACTIVE' ? <Link to={`/products/${product.slug}`} className="font-semibold hover:text-nile">{product.name}</Link> : <p className="font-semibold">{product.name}</p>}<p className="mt-1 text-xs text-ink/40">{t(product.category.name)} · {t('{count} sales', { count: product._count.orderItems })}</p></div><div className="sm:text-end"><Badge tone={productStatus[product.status].tone} title={productStatus[product.status].help}>{productStatus[product.status].label}</Badge><p className={`mt-2 text-sm font-semibold ${product.inventory <= 3 ? 'text-red-600' : product.inventory <= 5 ? 'text-amber-700' : ''}`}>{product.inventory === 0 ? t('Out of stock') : product.inventory <= 3 ? t('Only {count} left', { count: product.inventory }) : t('{count} in stock', { count: product.inventory })}</p></div><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={t('Edit {name}', { name: product.name })} asChild><Link to={`/seller/products/${product.id}/edit`}><Pencil size={17}/></Link></Button><Button variant="ghost" size="icon" aria-label={t('Delete {name}', { name: product.name })} disabled={remove.isPending} onClick={async () => { if (await confirmAction({ title: t('Remove {name}?', { name: product.name }), message: product._count.orderItems ? t('This product has sales, so it will be archived and kept for your records.') : t('The listing will be deleted permanently.'), confirmLabel: product._count.orderItems ? t('Archive listing') : t('Delete listing'), tone: 'danger' })) remove.mutate(product.id); }}><Trash2 size={17}/></Button></div></article>) : <div className="py-14 text-center"><Box className="mx-auto text-nile"/><h3 className="mt-3 font-display text-2xl font-bold">{t('Your shelves are empty')}</h3><Button className="mt-5" asChild><Link to="/seller/products/new">{t('Create your first listing')} <ArrowUpRight size={16}/></Link></Button></div>}</div>
    </section>
  </main>;
}
