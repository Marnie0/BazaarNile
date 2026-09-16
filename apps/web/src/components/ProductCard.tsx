import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { hasAccessToken, type Product } from '../lib/api';
import { useWishlist } from '../hooks/useWishlist';
import { money } from '../lib/utils';

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const wishlist = useWishlist(product);
  const toggleWishlist = () => { if (!hasAccessToken()) navigate('/login'); else wishlist.toggle(); };

  return <article className="product-card">
    <div className="product-card__media">
      <Link to={`/products/${product.slug}`} className="product-card__image-link">
        <img src={product.imageUrl} alt={product.name} loading="lazy"/>
        {product.featured && <span className="product-card__badge">Featured</span>}
      </Link>
      <motion.button whileTap={{ scale: .88 }} onClick={toggleWishlist} disabled={wishlist.isPending} className={`product-card__wish ${wishlist.saved ? 'is-saved' : ''}`} aria-label={wishlist.saved ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} aria-pressed={wishlist.saved}>
        <Heart size={19} fill={wishlist.saved ? 'currentColor' : 'none'}/>
      </motion.button>
    </div>
    <div className="product-card__body">
      <p className="product-card__category">{product.category.name}</p>
      <Link to={`/products/${product.slug}`}><h3>{product.name}</h3></Link>
      <div className="product-card__meta"><span>{money(product.price)}</span><span>by {product.seller.displayName}</span></div>
    </div>
  </article>;
}
