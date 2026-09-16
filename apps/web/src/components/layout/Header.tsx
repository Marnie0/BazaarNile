import { Heart, Package, Search, ShieldCheck, ShoppingBag, Store, UserRound } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { api, hasAccessToken, type Cart, type User } from '../../lib/api';

export function Header() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  useLocation();
  const { data: cartData } = useQuery({ queryKey: ['cart'], queryFn: () => api<{ cart: Cart }>('/cart'), enabled: hasAccessToken(), retry: false });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), enabled: hasAccessToken(), retry: false });
  const count = cartData?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  return <header className="sticky top-0 z-40 border-b border-ink/8 bg-[#fcfbf8]/90 backdrop-blur-xl">
    <div className="container-shell flex h-18 items-center gap-6">
      <Link to="/" className="font-display text-2xl font-bold tracking-tight">Bazaar<span className="text-nile">Nile</span></Link>
      <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
        <NavLink to="/shop" className={({ isActive }) => isActive ? 'text-nile' : 'hover:text-nile'}>Shop</NavLink>
        <NavLink to="/shop?featured=true" className="hover:text-nile">Featured</NavLink>
      </nav>
      <form className="ml-auto hidden max-w-sm flex-1 items-center rounded-full border border-ink/10 bg-white px-4 sm:flex" onSubmit={(e) => { e.preventDefault(); navigate(`/shop?search=${encodeURIComponent(search)}`); }}>
        <Search size={17} className="text-ink/45"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the bazaar" className="w-full bg-transparent px-3 py-2.5 text-sm outline-none"/>
      </form>
      <Button variant="ghost" size="icon" aria-label="Wishlist" asChild><Link to="/wishlist"><Heart size={20}/></Link></Button>
      <Button variant="ghost" size="icon" aria-label="Orders" className="hidden sm:inline-flex" asChild><Link to="/orders"><Package size={20}/></Link></Button>
      <Button variant="ghost" size="icon" aria-label="Seller Center" className="hidden sm:inline-flex" asChild><Link to="/seller"><Store size={20}/></Link></Button>
      {me?.user.role === 'ADMIN' && <Button variant="ghost" size="icon" aria-label="Admin Panel" asChild><Link to="/admin"><ShieldCheck size={20}/></Link></Button>}
      <Button variant="ghost" size="icon" aria-label="Account" asChild><Link to="/login"><UserRound size={20}/></Link></Button>
      <Button variant="ghost" size="icon" aria-label={`Cart with ${count} items`} className="relative" asChild><Link to="/cart"><ShoppingBag size={20}/>{count > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-ink">{count}</span>}</Link></Button>
    </div>
  </header>;
}
