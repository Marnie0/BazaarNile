import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { hasAccessToken, type Product } from '../lib/api';
import { useWishlist } from '../hooks/useWishlist';
import { money } from '../lib/utils';

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const wishlist = useWishlist(product);
  const toggleWishlist = () => { if (!hasAccessToken()) navigate('/login'); else wishlist.toggle(); };
  return <motion.article whileHover={{ y: -5 }} transition={{ duration: .2 }} className="group">
    <div className="relative"><Link to={`/products/${product.slug}`} className="block aspect-[4/5] overflow-hidden rounded-[1.4rem] bg-sand">
      <img src={product.imageUrl} alt={product.name} className="size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy"/>
      {product.featured && <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Featured</span>}
    </Link><motion.button whileTap={{ scale: .82 }} onClick={toggleWishlist} disabled={wishlist.isPending} className={`absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/95 shadow-sm transition md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 ${wishlist.saved ? 'text-red-600 md:opacity-100' : 'text-ink/65 hover:text-red-600'}`} aria-label={wishlist.saved ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} aria-pressed={wishlist.saved}><Heart size={18} fill={wishlist.saved ? 'currentColor' : 'none'}/></motion.button></div>
    <div className="px-1 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-nile">{product.category.name}</p><Link to={`/products/${product.slug}`}><h3 className="mt-1 font-semibold group-hover:text-nile">{product.name}</h3></Link><div className="mt-2 flex items-center justify-between"><span className="font-bold">{money(product.price)}</span><span className="text-xs text-ink/50">by {product.seller.displayName}</span></div></div>
  </motion.article>;
}
