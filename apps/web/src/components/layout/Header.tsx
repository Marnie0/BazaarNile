import { Bell, Bot, Camera, ChevronDown, Heart, LogOut, Menu, Package, Search, Settings, ShieldCheck, ShoppingBag, Sparkles, Store, TicketPercent, UserRound, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchInput } from '../SearchInput';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { api, setAccessToken, type Cart, type Notification } from '../../lib/api';
import { useMe } from '../../hooks/useSession';

const primaryLinks = [
  { to: '/shop', label: 'Shop', icon: ShoppingBag },
  { to: '/shop?featured=true', label: 'Featured', icon: Sparkles },
  { to: '/assistant', label: 'Nile Guide', icon: Bot },
  { to: '/visual-search', label: 'Photo search', icon: Camera },
];

function CountBadge({ count, className = '' }: { count: number; className?: string }) {
  if (!count) return null;
  return <span className={`absolute grid h-[1.1rem] min-w-[1.1rem] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-ink ring-2 ring-[#fcfbf8] ${className}`}>{count > 99 ? '99+' : count}</span>;
}

function IconLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return <Link to={to} aria-label={label} title={label} className="relative grid size-10 place-items-center rounded-full transition hover:bg-nile-light/60">{children}</Link>;
}

function SearchForm({ className = '', autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const current = pathname === '/shop' ? params.get('search') ?? '' : '';
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const term = value.trim();
    navigate(term ? `/shop?search=${encodeURIComponent(term)}` : '/shop');
  };
  return <form role="search" className={`relative flex items-center rounded-full border border-ink/10 bg-white pl-4 pr-1.5 transition focus-within:border-nile/50 focus-within:ring-4 focus-within:ring-nile/8 ${className}`} onSubmit={submit}>
    <Search size={17} className="shrink-0 text-ink/40" aria-hidden="true"/>
    <SearchInput value={value} onValueChange={setValue} autoFocus={autoFocus} placeholder="Search products, brands, gifts…" aria-label="Search products" maxLength={100} className="min-w-0 w-full bg-transparent px-3 py-2.5 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"/>
    {value && <button type="button" onClick={() => setValue('')} aria-label="Clear search" className="grid size-7 shrink-0 place-items-center rounded-full text-ink/40 hover:bg-sand hover:text-ink"><X size={14}/></button>}
  </form>;
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { authenticated, user } = useMe();
  const { data: cartData } = useQuery({ queryKey: ['cart'], queryFn: () => api<{ cart: Cart }>('/cart'), enabled: authenticated, retry: false });
  const { data: notificationData } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ notifications: Notification[]; unreadCount: number }>('/notifications?limit=8'), enabled: authenticated, retry: false, refetchInterval: 60_000, refetchIntervalInBackground: false });
  const count = authenticated ? cartData?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0 : 0;
  const unread = authenticated ? notificationData?.unreadCount ?? 0 : 0;

  useEffect(() => { setMobileOpen(false); setAccountOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!accountOpen && !mobileOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setAccountOpen(false); setMobileOpen(false); } };
    const onPointer = (event: PointerEvent) => { if (accountOpen && !accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [accountOpen, mobileOpen]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const logout = async () => {
    try { await api<void>('/auth/logout', { method: 'POST' }); } catch { /* sign out locally regardless */ } finally {
      setAccessToken(null);
      queryClient.clear();
      navigate('/');
    }
  };
  const isActive = (to: string) => {
    const [path, query] = to.split('?');
    if (location.pathname !== path) return false;
    return query ? location.search.includes(query) : !location.search.includes('featured=true');
  };
  const accountLinks = [
    { to: '/orders', label: 'Orders', icon: Package },
    { to: '/wishlist', label: 'Wishlist', icon: Heart },
    { to: '/account', label: 'Account settings', icon: Settings },
    { to: '/seller', label: 'Seller Center', icon: Store },
    ...(user?.role === 'ADMIN' ? [{ to: '/admin', label: 'Admin Panel', icon: ShieldCheck }, { to: '/admin/coupons', label: 'Coupons', icon: TicketPercent }] : []),
    ...(user ? [{ to: `/profiles/${user.username}`, label: 'Public profile', icon: UserRound }] : []),
  ];

  return <header className="sticky top-0 z-40 border-b border-ink/8 bg-[#fcfbf8]/92 backdrop-blur-xl">
    <div className="container-shell flex h-[4.5rem] items-center gap-2 lg:gap-6">
      <Link to="/" className="shrink-0 font-display text-[1.65rem] font-semibold tracking-tight" aria-label="BazaarNile home">Bazaar<span className="text-nile">Nile</span></Link>
      <nav className="hidden items-center gap-1 text-sm font-semibold lg:flex" aria-label="Primary">
        {primaryLinks.map(({ to, label }) => <NavLink key={to} to={to} className={() => `rounded-full px-3 py-2 transition ${isActive(to) ? 'bg-nile-light/70 text-nile' : 'text-ink/70 hover:text-ink'}`}>{label}</NavLink>)}
      </nav>
      <SearchForm className="ml-auto hidden max-w-sm flex-1 md:flex"/>
      <div className="ml-auto flex items-center gap-0.5 md:ml-0">
        {authenticated && <span className="hidden sm:block"><IconLink to="/wishlist" label="Wishlist"><Heart size={20}/></IconLink></span>}
        {authenticated && <IconLink to="/notifications" label={unread ? `Notifications, ${unread} unread` : 'Notifications'}><Bell size={20}/><CountBadge count={unread} className="-right-0.5 -top-0.5"/></IconLink>}
        <IconLink to="/cart" label={count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}><ShoppingBag size={20}/><CountBadge count={count} className="-right-0.5 -top-0.5"/></IconLink>
        {authenticated ? <div ref={accountRef} className="relative hidden lg:block">
          <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-haspopup="menu" aria-expanded={accountOpen} aria-label="Account menu" className="ml-1 flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-nile-light/60">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-8 rounded-full object-cover"/> : <span className="grid size-8 place-items-center rounded-full bg-nile text-xs font-bold uppercase text-white">{user?.displayName.charAt(0) ?? '·'}</span>}
            <ChevronDown size={15} className={`text-ink/50 transition ${accountOpen ? 'rotate-180' : ''}`}/>
          </button>
          <AnimatePresence>{accountOpen && <motion.div role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .14 }} className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_18px_50px_rgba(19,33,27,.16)]">
            {user && <div className="border-b border-ink/8 px-3 pb-3 pt-2"><p className="truncate text-sm font-semibold">{user.displayName}</p><p className="truncate text-xs text-ink/50">{user.email ?? `@${user.username}`}</p></div>}
            <div className="py-1">{accountLinks.map(({ to, label, icon: Icon }) => <Link key={to} role="menuitem" to={to} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-nile-light/60"><Icon size={17} className="text-ink/55"/>{label}</Link>)}</div>
            <button type="button" role="menuitem" onClick={logout} className="flex w-full items-center gap-3 rounded-xl border-t border-ink/8 px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"><LogOut size={17}/>Sign out</button>
          </motion.div>}</AnimatePresence>
        </div> : <Button asChild variant="outline" className="ml-1 hidden px-4 py-2 lg:inline-flex"><Link to="/login" state={{ from: location.pathname + location.search }}>Sign in</Link></Button>}
        <button type="button" onClick={() => setMobileOpen((open) => !open)} className="grid size-10 place-items-center rounded-full transition hover:bg-nile-light/60 lg:hidden" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} aria-controls="mobile-menu">{mobileOpen ? <X size={21}/> : <Menu size={21}/>}</button>
      </div>
    </div>
    {/* The homepage hero has its own prominent search, so skip the duplicate on phones. */}
    {location.pathname !== '/' && <div className="container-shell pb-3 md:hidden"><SearchForm/></div>}
    <AnimatePresence>{mobileOpen && <motion.div id="mobile-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .2 }} className="overflow-hidden border-t border-ink/8 bg-[#fcfbf8] lg:hidden">
      <div className="container-shell max-h-[calc(100svh-8rem)] overflow-y-auto py-4">
        {user && <div className="mb-4 flex items-center gap-3 rounded-2xl bg-sand/70 p-3"><span className="grid size-10 place-items-center rounded-full bg-nile font-bold uppercase text-white">{user.displayName.charAt(0)}</span><div className="min-w-0"><p className="truncate font-semibold">{user.displayName}</p><p className="truncate text-xs text-ink/50">@{user.username}</p></div></div>}
        <p className="eyebrow mb-2">Discover</p>
        <nav className="grid grid-cols-2 gap-2" aria-label="Mobile primary">{primaryLinks.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${isActive(to) ? 'border-nile/30 bg-nile-light/60 text-nile' : 'border-ink/8 bg-white hover:border-nile/40'}`}><Icon size={17} className="shrink-0"/><span className="truncate">{label}</span></Link>)}</nav>
        {authenticated ? <>
          <p className="eyebrow mb-2 mt-5">Your account</p>
          <nav className="grid grid-cols-2 gap-2" aria-label="Account">{[...accountLinks, { to: '/notifications', label: unread ? `Notifications (${unread})` : 'Notifications', icon: Bell }].map(({ to, label, icon: Icon }) => <Link key={to} to={to} className="flex min-h-12 items-center gap-3 rounded-xl border border-ink/8 bg-white px-3 py-2.5 text-sm font-semibold transition hover:border-nile/40"><Icon size={17} className="shrink-0"/><span className="truncate">{label}</span></Link>)}</nav>
          <button type="button" onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-3 text-sm font-semibold text-red-700"><LogOut size={17}/>Sign out</button>
        </> : <div className="mt-5 grid grid-cols-2 gap-2"><Button asChild variant="outline"><Link to="/login" state={{ from: location.pathname + location.search }}>Sign in</Link></Button><Button asChild><Link to="/register">Create account</Link></Button></div>}
      </div>
    </motion.div>}</AnimatePresence>
  </header>;
}
