import { motion } from 'framer-motion';
import { Heart, Plus, SlidersHorizontal } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { hasAccessToken, type Product } from '../lib/api';
import { useAddToCart } from '../hooks/useAddToCart';
import { useWishlist } from '../hooks/useWishlist';
import { discountPercent, money, stockLevel } from '../lib/utils';
import { Stars } from './ui/Stars';

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const location = useLocation();
  const wishlist = useWishlist(product);
  const addToCart = useAddToCart();
  const requireAccount = (action: () => void) => hasAccessToken() ? action() : navigate('/login', { state: { from: location.pathname + location.search } });
  const discount = discountPercent(product.price, product.compareAt);
  const soldOut = product.inventory <= 0;
  const urgent = stockLevel(product.inventory) === 'urgent';

  return <article className="product-card group">
    <div className="product-card__media">
      <Link to={`/products/${product.slug}`} className="product-card__image-link" tabIndex={-1} aria-hidden="true">
        <img src={product.imageUrl} alt="" loading="lazy" decoding="async"/>
      </Link>
      <div className="product-card__badges">
        {soldOut ? <span className="product-card__badge product-card__badge--muted">Sold out</span> : discount ? <span className="product-card__badge product-card__badge--sale">−{discount}%</span> : product.featured && <span className="product-card__badge">Featured</span>}
      </div>
      <motion.button type="button" whileTap={{ scale: .88 }} onClick={() => requireAccount(() => wishlist.toggle())} disabled={wishlist.isPending} className={`product-card__wish ${wishlist.saved ? 'is-saved' : ''}`} aria-label={wishlist.saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`} aria-pressed={wishlist.saved}>
        <Heart size={18} fill={wishlist.saved ? 'currentColor' : 'none'}/>
      </motion.button>
      {/* Listings with sizes or colours need a choice first, so quick add opens the product instead. */}
      {!soldOut && (product.optionNames?.length ? <Link to={`/products/${product.slug}`} className="product-card__quick-add" aria-label={`Choose ${product.optionNames.join(' and ').toLowerCase()} for ${product.name}`}>
        <SlidersHorizontal size={15}/><span>Choose {product.optionNames[0]!.toLowerCase()}</span>
      </Link> : <button type="button" onClick={() => requireAccount(() => addToCart.mutate({ product, quantity: 1 }))} disabled={addToCart.isPending} className="product-card__quick-add" aria-label={`Add ${product.name} to cart`}>
        <Plus size={16}/><span>{addToCart.isPending ? 'Adding…' : 'Add to cart'}</span>
      </button>)}
    </div>
    <div className="product-card__body">
      <p className="product-card__category">{product.category.name}</p>
      <h3><Link to={`/products/${product.slug}`}>{product.name}</Link></h3>
      <div className="product-card__price"><strong>{money(product.price)}</strong>{discount > 0 && <s>{money(product.compareAt!)}</s>}</div>
      {product.reviewCount > 0 && <p className="product-card__rating"><Stars value={Number(product.ratingAverage)} size={13}/><strong>{Number(product.ratingAverage).toFixed(1)}</strong><span>({product.reviewCount})</span></p>}
      {urgent && <p className="product-card__stock">Only {product.inventory} left</p>}
      <p className="product-card__seller">by {product.seller.displayName}</p>
    </div>
  </article>;
}
