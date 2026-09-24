import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Store, UserX } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, PageLoader } from '../components/PageState';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, type Product, type User } from '../lib/api';
import { formatDate } from '../lib/utils';
import { t } from '../lib/i18n';

const roleLabel = { CUSTOMER: 'Member', SELLER: 'Seller', ADMIN: 'BazaarNile team' } as const;

export function ProfilePage() {
  const { username = '' } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['profile', username], queryFn: () => api<{ user: User & { products: Product[] } }>(`/profiles/${encodeURIComponent(username)}`) });
  useDocumentTitle(data?.user.displayName);
  if (isLoading) return <PageLoader label={t('Loading profile…')}/>;
  if (!data) return <main className="container-shell"><EmptyState icon={UserX} title={t('Profile not found')} action={<Button asChild><Link to="/shop">{t('Browse the bazaar')}</Link></Button>}>{t('This member may have changed their username.')}</EmptyState></main>;
  const user = data.user;
  return <main className="container-shell py-10 sm:py-14">
    <section className="rounded-[2rem] bg-sand p-7 sm:flex sm:items-center sm:gap-7 sm:p-12">
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-24 shrink-0 rounded-full object-cover"/> : <div className="grid size-24 shrink-0 place-items-center rounded-full bg-nile font-display text-4xl font-semibold text-white">{user.displayName[0]}</div>}
      <div className="mt-5 sm:mt-0"><p className="eyebrow">{t(roleLabel[user.role])}</p><h1 className="mt-1 font-display text-4xl font-semibold">{user.displayName}</h1><p className="mt-1 text-ink/55">@{user.username}</p><p className="mt-3 max-w-xl leading-7 text-ink/70">{user.bio ?? t('A member of the BazaarNile community.')}</p><p className="mt-3 flex items-center gap-2 text-sm text-ink/50"><CalendarDays size={15}/>{t('Joined {date}', { date: formatDate(user.createdAt, { month: 'long', year: 'numeric' }) })}</p></div>
    </section>
    {user.products.length > 0 ? <><h2 className="mt-14 font-display text-3xl font-semibold">{t('Shop · {products}', { products: t('{count} products', { count: user.products.length }) })}</h2><div className="product-grid mt-7">{user.products.map((p) => <ProductCard product={{ ...p, seller: user }} key={p.id}/>)}</div></>
      : user.role !== 'CUSTOMER' && <EmptyState compact icon={Store} title={t('No listings yet')}>{t('Check back soon for new products from {name}.', { name: user.displayName })}</EmptyState>}
  </main>;
}
