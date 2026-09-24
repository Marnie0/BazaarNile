import { Link } from 'react-router-dom';
import { t } from '../../lib/i18n';
import { FREE_SHIPPING_THRESHOLD, money } from '../../lib/utils';
import { LanguageSwitch } from '../LanguageSwitch';

const columns = [
  { title: 'Shop', links: [['/shop', 'All products'], ['/shop?featured=true', 'Featured finds'], ['/assistant', 'Nile Guide'], ['/visual-search', 'Search by photo']] },
  { title: 'Your account', links: [['/orders', 'Orders'], ['/wishlist', 'Wishlist'], ['/notifications', 'Notifications'], ['/cart', 'Cart']] },
  { title: 'Sell', links: [['/seller', 'Seller Center'], ['/seller/products/new', 'List a product']] },
] as const;

export function Footer() {
  return <footer className="mt-24 bg-ink py-14 text-white/70">
    <div className="container-shell grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div><Link to="/" className="font-display text-2xl font-semibold text-white">Bazaar<span className="text-[#7bc3aa]">Nile</span></Link><p className="mt-3 max-w-xs text-sm leading-6">{t('Discover extraordinary products from remarkable sellers across Egypt. Cash on delivery, free shipping over {amount}.', { amount: money(FREE_SHIPPING_THRESHOLD) })}</p></div>
      {columns.map((column) => <div key={column.title}><h2 className="mb-3 text-sm font-semibold text-white">{t(column.title)}</h2><ul className="grid gap-2 text-sm">{column.links.map(([to, label]) => <li key={to}><Link to={to} className="transition hover:text-white">{t(label)}</Link></li>)}</ul></div>)}
    </div>
    <div className="container-shell mt-12 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-xs"><span>{t('© {year} BazaarNile. Built to help you shop smarter.', { year: String(new Date().getFullYear()) })}</span><span className="flex flex-wrap items-center gap-3">{t('Prices in Egyptian pounds (EGP)')}<LanguageSwitch className="border border-white/15 text-white/80 hover:bg-white/10 hover:text-white"/></span></div>
  </footer>;
}
