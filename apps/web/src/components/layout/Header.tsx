import { Bell, Bot, Camera, Check, Heart, Home, LogOut, Menu, Package, Search, ShieldCheck, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { api, hasAccessToken, setAccessToken, subscribeToAccessToken, type Cart, type Notification, type User } from '../../lib/api';

function IconTip({ label, children, className = '', align = 'center' }: { label: string; children: ReactNode; className?: string; align?: 'center' | 'right' }) {
  return <span className={`group/tip relative ${className}`}>
    {children}
    <span role="tooltip" className={`pointer-events-none absolute top-[calc(100%+.45rem)] z-50 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>{label}</span>
  </span>;
}

export function Header() {
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const authenticated = useSyncExternalStore(subscribeToAccessToken, hasAccessToken, hasAccessToken);
  const { data: cartData } = useQuery({ queryKey: ['cart'], queryFn: () => api<{ cart: Cart }>('/cart'), enabled: authenticated, retry: false });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), enabled: authenticated, retry: false });
  const { data: notificationData } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ notifications: Notification[]; unreadCount: number }>('/notifications?limit=8'), enabled: authenticated, retry: false, refetchInterval: 30_000 });
  const user = authenticated ? me?.user : undefined;
  const count = authenticated ? cartData?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0 : 0;
  useEffect(() => setMobileOpen(false), [location.pathname, location.search]);
  const logout = async () => {
    try { await api<void>('/auth/logout', { method: 'POST' }); } finally {
      setAccessToken(null);
      queryClient.clear();
      navigate('/');
    }
  };

  return <header className="sticky top-0 z-40 border-b border-ink/8 bg-[#fcfbf8]/90 backdrop-blur-xl">
    <div className="container-shell flex h-18 items-center gap-1 sm:gap-2 xl:gap-5">
      <Link to="/" className="font-display text-2xl font-bold tracking-tight">Bazaar<span className="text-nile">Nile</span></Link>
      <nav className="hidden items-center gap-5 text-sm font-medium xl:flex">
        <NavLink to="/shop" className={({ isActive }) => isActive ? 'text-nile' : 'hover:text-nile'}>Shop</NavLink>
        <NavLink to="/shop?featured=true" className="hover:text-nile">Featured</NavLink>
      </nav>
      <form className="ml-auto hidden max-w-sm flex-1 items-center rounded-full border border-ink/10 bg-white px-4 xl:flex" onSubmit={(event) => { event.preventDefault(); navigate(`/shop?search=${encodeURIComponent(search)}`); }}>
        <Search size={17} className="text-ink/45"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the bazaar" aria-label="Search products" className="w-full bg-transparent px-3 py-2.5 text-sm outline-none"/>
      </form>
      <div className="ml-auto hidden items-center xl:flex">
        <IconTip label="Wishlist"><Button variant="ghost" size="icon" aria-label="Wishlist" asChild><Link to="/wishlist"><Heart size={20}/></Link></Button></IconTip>
        <IconTip label="AI Shopping Assistant"><Button variant="ghost" size="icon" aria-label="AI Shopping Assistant" asChild><Link to="/assistant"><Bot size={20}/></Link></Button></IconTip>
        <IconTip label="Visual Search"><Button variant="ghost" size="icon" aria-label="Visual Search" asChild><Link to="/visual-search"><Camera size={20}/></Link></Button></IconTip>
        <IconTip label={notificationData?.unreadCount ? `${notificationData.unreadCount} unread notifications` : 'Notifications'}><Button variant="ghost" size="icon" aria-label="Notifications" className="relative" asChild><Link to="/notifications"><Bell size={20}/>{Boolean(notificationData?.unreadCount) && <span className="absolute right-0 top-0 grid min-w-4 rounded-full bg-gold px-1 text-[9px] font-bold leading-4 text-ink">{Math.min(notificationData!.unreadCount, 99)}</span>}</Link></Button></IconTip>
        <IconTip label="Orders"><Button variant="ghost" size="icon" aria-label="Orders" asChild><Link to="/orders"><Package size={20}/></Link></Button></IconTip>
        <IconTip label="Seller Center"><Button variant="ghost" size="icon" aria-label="Seller Center" asChild><Link to="/seller"><Store size={20}/></Link></Button></IconTip>
        {user?.role === 'ADMIN' && <IconTip label="Admin Panel"><Button variant="ghost" size="icon" aria-label="Admin Panel" asChild><Link to="/admin"><ShieldCheck size={20}/></Link></Button></IconTip>}
      </div>
      <button type="button" onClick={() => setMobileOpen((open) => !open)} className="relative ml-auto grid size-10 place-items-center rounded-full transition hover:bg-nile-light/60 xl:hidden" aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen}>{mobileOpen ? <X size={21}/> : <Menu size={21}/>} {Boolean(notificationData?.unreadCount) && <span className="absolute right-0 top-0 size-2 rounded-full bg-gold"/>}</button>
      {user ? <details className="group/account relative">
        <summary className="group/tip relative grid size-10 cursor-pointer list-none place-items-center rounded-full transition hover:bg-nile-light/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nile [&::-webkit-details-marker]:hidden" aria-label="Account menu">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-8 rounded-full object-cover"/> : <span className="grid size-8 place-items-center rounded-full bg-nile text-xs font-bold uppercase text-white">{user.displayName.charAt(0)}</span>}
          <span role="tooltip" className="pointer-events-none absolute left-1/2 top-[calc(100%+.45rem)] z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 group-open/account:hidden">Account</span>
        </summary>
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_18px_50px_rgba(19,33,27,.16)]">
          <div className="border-b border-ink/8 px-3 py-2"><p className="truncate text-sm font-semibold">{user.displayName}</p><p className="truncate text-xs text-ink/45">@{user.username}</p></div>
          <Link to={`/profiles/${user.username}`} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-nile-light"><UserRound size={17}/>View profile</Link>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"><LogOut size={17}/>Sign out</button>
        </div>
      </details> : <IconTip label="Sign in"><Button variant="ghost" size="icon" aria-label="Sign in" asChild><Link to="/login"><UserRound size={20}/></Link></Button></IconTip>}
      <IconTip label={count ? `Cart · ${count} item${count === 1 ? '' : 's'}` : 'Cart'} align="right"><Button variant="ghost" size="icon" aria-label={`Cart with ${count} items`} className="relative" asChild><Link to="/cart"><ShoppingBag size={20}/>{count > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-ink">{count}</span>}</Link></Button></IconTip>
    </div>
    {mobileOpen && <div className="border-t border-ink/8 bg-[#fcfbf8] xl:hidden"><div className="container-shell py-4">
      <form className="flex items-center rounded-full border border-ink/10 bg-white px-4" onSubmit={(event) => { event.preventDefault(); navigate(`/shop?search=${encodeURIComponent(search)}`); }}><Search size={17} className="text-ink/45"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the bazaar" aria-label="Search products" className="min-w-0 w-full bg-transparent px-3 py-3 text-sm outline-none"/></form>
      <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { to: '/', label: 'Home', icon: Home }, { to: '/shop', label: 'Shop', icon: ShoppingBag }, { to: '/shop?featured=true', label: 'Featured', icon: Check },
          { to: '/wishlist', label: 'Wishlist', icon: Heart }, { to: '/assistant', label: 'AI Assistant', icon: Bot }, { to: '/visual-search', label: 'Visual Search', icon: Camera },
          { to: '/notifications', label: notificationData?.unreadCount ? `Notifications (${notificationData.unreadCount})` : 'Notifications', icon: Bell }, { to: '/orders', label: 'Orders', icon: Package }, { to: '/seller', label: 'Seller Center', icon: Store },
          ...(user?.role === 'ADMIN' ? [{ to: '/admin', label: 'Admin Panel', icon: ShieldCheck }] : []),
          ...(user ? [{ to: `/profiles/${user.username}`, label: 'My profile', icon: UserRound }] : [{ to: '/login', label: 'Sign in', icon: UserRound }]),
        ].map(({ to, label, icon: Icon }) => <Link key={`${to}-${label}`} to={to} className="flex min-h-12 items-center gap-3 rounded-xl border border-ink/8 bg-white px-3 py-2.5 text-sm font-semibold transition hover:border-nile hover:text-nile"><Icon size={17} className="shrink-0"/><span className="truncate">{label}</span></Link>)}
      </nav>
    </div></div>}
  </header>;
}
