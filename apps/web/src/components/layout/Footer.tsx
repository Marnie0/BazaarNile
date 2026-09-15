import { Link } from 'react-router-dom';

export function Footer() { return <footer className="mt-24 bg-ink py-14 text-white/70">
  <div className="container-shell grid gap-10 md:grid-cols-3">
    <div><Link to="/" className="font-display text-2xl font-bold text-white">Bazaar<span className="text-[#7bc3aa]">Nile</span></Link><p className="mt-3 max-w-xs text-sm leading-6">Discover extraordinary products from remarkable sellers across Egypt and beyond.</p></div>
    <div><h3 className="mb-3 font-semibold text-white">Marketplace</h3><div className="grid gap-2 text-sm"><Link to="/shop">Browse products</Link><Link to="/shop?featured=true">Featured finds</Link></div></div>
    <div><h3 className="mb-3 font-semibold text-white">Coming next</h3><p className="text-sm leading-6">Secure checkout, wishlists, seller tools, and thoughtful AI recommendations.</p></div>
  </div>
  <div className="container-shell mt-12 border-t border-white/10 pt-6 text-xs">© {new Date().getFullYear()} BazaarNile. Built to help you shop smarter.</div>
  </footer>; }

