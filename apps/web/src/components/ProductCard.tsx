import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../lib/api';
import { money } from '../lib/utils';

export function ProductCard({ product }: { product: Product }) {
  return <motion.article whileHover={{ y: -5 }} transition={{ duration: .2 }} className="group">
    <Link to={`/products/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden rounded-[1.4rem] bg-sand">
      <img src={product.imageUrl} alt={product.name} className="size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy"/>
      <button className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/90 opacity-0 shadow-sm transition group-hover:opacity-100" aria-label="Add to wishlist"><Heart size={18}/></button>
      {product.featured && <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Featured</span>}
    </Link>
    <div className="px-1 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-nile">{product.category.name}</p><Link to={`/products/${product.slug}`}><h3 className="mt-1 font-semibold group-hover:text-nile">{product.name}</h3></Link><div className="mt-2 flex items-center justify-between"><span className="font-bold">{money(product.price)}</span><span className="text-xs text-ink/50">by {product.seller.displayName}</span></div></div>
  </motion.article>;
}

