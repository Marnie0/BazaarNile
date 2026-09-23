import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { ProductSkeleton } from '../components/Skeleton';
import { useIsAuthenticated } from '../hooks/useSession';
import { api, type Category, type Product, type Recommendations } from '../lib/api';

const categoryTones = ['market-mosaic-card--clay', 'market-mosaic-card--nile', 'market-mosaic-card--saffron', 'market-mosaic-card--ink'];

export function HomePage() {
  const isAuthenticated = useIsAuthenticated();
  const { data, isLoading } = useQuery({ queryKey: ['featured'], queryFn: () => api<{ products: Product[] }>('/products?featured=true&limit=4') });
  const { data: latest, isLoading: latestLoading } = useQuery({ queryKey: ['latest'], queryFn: () => api<{ products: Product[] }>('/products?sort=newest&limit=8') });
  const { data: categoryData } = useQuery({ queryKey: ['categories'], queryFn: () => api<{ categories: Category[] }>('/categories') });
  const { data: recommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['recommendations'], queryFn: () => api<Recommendations>('/recommendations?limit=4'), enabled: isAuthenticated,
  });

  return <>
    <section className="market-spread" aria-label="A good find leads to another">
      <motion.div className="market-spread__copy-mobile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
        <h1 className="font-display">A good find<br/>leads to another.</h1>
        <p>Everyday pieces. Unexpected discoveries.</p>
      </motion.div>

      <motion.div className="market-spread__stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .7, ease: 'easeOut' }}>
        <img className="market-spread__photo" src="/images/market-spread.webp" alt="Linen and clay pieces arranged with contemporary headphones, a speaker, and saffron textile on a limestone table" fetchPriority="high"/>
        <h1 className="market-spread__title font-display" aria-label="A good find leads to another.">
          <span className="market-spread__line-one">A good find</span>
          <span className="market-spread__line-two">leads to another.</span>
        </h1>
        <img className="market-spread__photo market-spread__overlap" src="/images/market-spread.webp" alt="" aria-hidden="true"/>
        <div className="market-spread__caption">
          <p>Everyday pieces.<br/>Unexpected discoveries.</p>
          <Link to="/shop" className="market-spread__cta">Explore the bazaar</Link>
        </div>
      </motion.div>
      <Link to="/shop" className="market-spread__cta-mobile">Explore the bazaar</Link>
    </section>

    <section className="container-shell home-section" aria-labelledby="collections-title">
      <div className="home-section__heading">
        <div><h2 id="collections-title" className="font-display">Wander by collection</h2><p>Four corners of the market, each with its own character.</p></div>
        <Link to="/shop" className="quiet-link">View all</Link>
      </div>
      <div className="market-mosaic">
        {!categoryData && [0, 1, 2, 3].map((index) => <div key={index} className={`market-mosaic-card animate-pulse ${categoryTones[index]}`} aria-hidden="true"><span className="market-mosaic-card__image"/><span className="market-mosaic-card__content"/></div>)}
        {categoryData?.categories.slice(0, 4).map((category, index) => <Link key={category.id} to={`/shop?category=${category.slug}`} className={`market-mosaic-card ${categoryTones[index]}`}>
          <span className="market-mosaic-card__image">{category.imageUrl && <img src={category.imageUrl} alt="" loading="lazy"/>}</span>
          <span className="market-mosaic-card__content"><strong>{category.name}</strong><small>{category._count?.products ?? 0} products</small></span>
        </Link>)}
      </div>
    </section>

    <section className="container-shell home-section home-section--products" aria-labelledby="featured-title">
      <div className="home-section__heading">
        <div><h2 id="featured-title" className="font-display">Featured finds</h2><p>A short edit of pieces worth a closer look.</p></div>
        <Link to="/shop?featured=true" className="quiet-link">View all</Link>
      </div>
      <div className="product-grid">{isLoading ? [1,2,3,4].map((x) => <ProductSkeleton key={x}/>) : data?.products.map((product) => <ProductCard key={product.id} product={product}/>)}</div>
    </section>

    <section className="container-shell home-section home-section--products" aria-labelledby="latest-title">
      <div className="home-section__heading">
        <div><h2 id="latest-title" className="font-display">Just arrived</h2><p>The newest listings from sellers across the bazaar.</p></div>
        <Link to="/shop?sort=newest" className="quiet-link">Shop new in</Link>
      </div>
      <div className="product-grid">{latestLoading ? Array.from({ length: 8 }, (_, x) => <ProductSkeleton key={x}/>) : latest?.products.map((product) => <ProductCard key={product.id} product={product}/>)}</div>
    </section>

    {isAuthenticated && <section className="container-shell home-section" aria-labelledby="recommended-title">
      <div className="recommendation-panel">
        <div className="home-section__heading"><div><h2 id="recommended-title" className="font-display">Picked for you</h2><p>{recommendations?.reason ?? 'Learning what catches your eye'}</p></div><Sparkles aria-hidden="true"/></div>
        <div className="product-grid">{recommendationsLoading ? [1,2,3,4].map((x) => <ProductSkeleton key={x}/>) : recommendations?.products.map((product) => <ProductCard key={product.id} product={product}/>)}</div>
      </div>
    </section>}

    <section className="container-shell market-promises" aria-label="Marketplace benefits">
      {[[ShieldCheck,'Shop with confidence','Every listing is reviewed, and you pay cash on delivery.'],[Truck,'Free shipping over EGP 1,500','Delivery to every governorate, with order tracking.'],[Sparkles,'Smarter discovery','Ask Nile Guide or search with a photo to find it faster.']].map(([Icon,title,text]) => { const I = Icon as typeof ShieldCheck; return <div key={title as string}><I aria-hidden="true"/><h3>{title as string}</h3><p>{text as string}</p></div>; })}
    </section>
  </>;
}
