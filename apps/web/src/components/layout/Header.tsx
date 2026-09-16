import { Bot, Heart, LogOut, Package, Search, ShieldCheck, ShoppingBag, Store, UserRound } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { api, hasAccessToken, setAccessToken, subscribeToAccessToken, type Cart, type User } from '../../lib/api';

function IconTip({ label, children, className = '', align = 'center' }: { label: string; children: ReactNode; className?: string; align?: 'center' | 'right' }) {
  return <span className={`group/tip relative ${className}`}>
    {children}
    <span role="tooltip" className={`pointer-events-none absolute top-[calc(100%+.45rem)] z-50 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>{label}</span>
  </span>;
}

export function Header() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authenticated = useSyncExternalStore(subscribeToAccessToken, hasAccessToken, hasAccessToken);
  const { data: cartData } = useQuery({ queryKey: ['cart'], queryFn: () => api<{ cart: Cart }>('/cart'), enabled: authenticated, retry: false });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), enabled: authenticated, retry: false });
  const user = authenticated ? me?.user : undefined;
  const count = authenticated ? cartData?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0 : 0;
  const logout = async () => {
    try { await api<void>('/auth/logout', { method: 'POST' }); } finally {
      setAccessToken(null);
      queryClient.clear();
      navigate('/');
    }
  };

  return <header className="sticky top-0 z-40 border-b border-ink/8 bg-[#fcfbf8]/90 backdrop-blur-xl">
    <div className="container-shell flex h-18 items-center gap-6">
      <Link to="/" className="font-display text-2xl font-bold tracking-tight">Bazaar<span className="text-nile">Nile</span></Link>
      <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
        <NavLink to="/shop" className={({ isActive }) => isActive ? 'text-nile' : 'hover:text-nile'}>Shop</NavLink>
        <NavLink to="/shop?featured=true" className="hover:text-nile">Featured</NavLink>
      </nav>
      <form className="ml-auto hidden max-w-sm flex-1 items-center rounded-full border border-ink/10 bg-white px-4 sm:flex" onSubmit={(event) => { event.preventDefault(); navigate(`/shop?search=${encodeURIComponent(search)}`); }}>
        <Search size={17} className="text-ink/45"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the bazaar" aria-label="Search products" className="w-full bg-transparent px-3 py-2.5 text-sm outline-none"/>
      </form>
      <IconTip label="Wishlist"><Button variant="ghost" size="icon" aria-label="Wishlist" asChild><Link to="/wishlist"><Heart size={20}/></Link></Button></IconTip>
      <IconTip label="AI Shopping Assistant"><Button variant="ghost" size="icon" aria-label="AI Shopping Assistant" asChild><Link to="/assistant"><Bot size={20}/></Link></Button></IconTip>
      <IconTip label="Orders" className="hidden sm:inline-flex"><Button variant="ghost" size="icon" aria-label="Orders" asChild><Link to="/orders"><Package size={20}/></Link></Button></IconTip>
      <IconTip label="Seller Center" className="hidden sm:inline-flex"><Button variant="ghost" size="icon" aria-label="Seller Center" asChild><Link to="/seller"><Store size={20}/></Link></Button></IconTip>
      {user?.role === 'ADMIN' && <IconTip label="Admin Panel"><Button variant="ghost" size="icon" aria-label="Admin Panel" asChild><Link to="/admin"><ShieldCheck size={20}/></Link></Button></IconTip>}
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
  </header>;
}
