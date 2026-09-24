import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Banknote, Bot, Camera, Search, ShieldCheck, Sparkles, Store, Truck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { ProductSkeleton } from '../components/Skeleton';
import { Button } from '../components/ui/Button';
import { useIsAuthenticated } from '../hooks/useSession';
import { api, type Category, type Product, type Recommendations, type Shop } from '../lib/api';
import { discountPercent, FREE_SHIPPING_THRESHOLD, money } from '../lib/utils';
import { ScrollRow } from '../components/ui/ScrollRow';
import { SearchInput } from '../components/SearchInput';

const popularSearches = ['Coffee', 'Sneakers', 'Skincare', 'Lamp', 'Notebook', 'Tent'];
type ProductList = { products: Product[]; pagination: { total: number } };

function SectionHeading({ id, title, description, action }: { id: string; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <div className="mb-6 flex items-end justify-between gap-6 sm:mb-8">
    <div className="min-w-0"><h2 id={id} className="font-display text-3xl font-semibold leading-none tracking-tight sm:text-[2.6rem]">{title}</h2>{description && <p className="mt-2.5 max-w-xl text-ink/60">{description}</p>}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>;
}

function ViewAll({ to, children = 'View all' }: { to: string; children?: ReactNode }) {
  return <Link to={to} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-nile hover:text-clay">{children}<ArrowRight size={15} className="transition group-hover:translate-x-0.5"/></Link>;
}

function Hero({ deals, productCount }: { deals: Product[]; productCount?: number }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); const value = term.trim(); navigate(value ? `/shop?search=${encodeURIComponent(value)}` : '/shop'); };
  const topDeal = deals[0];
  return <section className="container-shell pt-4 sm:pt-6" aria-labelledby="hero-title">
    {/* The photo frames the centre with objects at its edges, so the content sits in the open stone. */}
    {/* Not overflow-hidden: the search suggestions list must be able to extend below the banner. */}
    <div className="relative isolate z-10 rounded-[2rem] bg-[#eadcc3]">
      <img src="/images/market-spread.webp" alt="" aria-hidden="true" fetchPriority="high" className="absolute inset-0 -z-10 size-full rounded-[2rem] object-cover"/>
      <div className="absolute inset-0 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(244,236,221,.55),rgba(244,236,221,0)_70%)]"/>
      <motion.div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-12 text-center sm:px-10 sm:py-16 lg:py-[4.5rem]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
        <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-ink/75 backdrop-blur"><span className="size-1.5 rounded-full bg-emerald-600"/>Egypt’s marketplace for independent sellers</p>
        <h1 id="hero-title" className="mt-5 text-balance font-display text-[2.8rem] font-medium leading-[.95] tracking-[-.03em] sm:text-6xl lg:text-[4.6rem]">A good find leads to another.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-ink/70 sm:text-lg sm:leading-8">{productCount ? `${productCount}+ products` : 'Hundreds of products'} from makers, roasters, and small shops across Egypt. Cash on delivery, free shipping over {money(FREE_SHIPPING_THRESHOLD)}.</p>
        <form onSubmit={submit} role="search" className="relative mt-7 flex w-full max-w-xl items-center gap-2 rounded-full border border-ink/10 bg-white p-1.5 pl-5 shadow-[0_16px_45px_rgba(19,33,27,.12)] focus-within:border-nile/50 focus-within:ring-4 focus-within:ring-nile/10">
          <Search size={19} className="shrink-0 text-ink/40" aria-hidden="true"/>
          <SearchInput value={term} onValueChange={setTerm} maxLength={100} placeholder="What are you looking for today?" aria-label="Search products" className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none [&::-webkit-search-cancel-button]:hidden"/>
          <Button type="submit" className="px-5 sm:px-6">Search</Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm"><span className="rounded-full bg-ink px-3 py-1.5 font-semibold text-white shadow-sm">Popular</span>{popularSearches.map((item) => <Link key={item} to={`/shop?search=${encodeURIComponent(item.toLowerCase())}`} className="rounded-full bg-white/70 px-3 py-1.5 font-medium text-ink/75 backdrop-blur transition hover:bg-white hover:text-ink">{item}</Link>)}</div>
        {topDeal && <Link to="/shop?onSale=true" className="mt-7 inline-flex items-center gap-3 rounded-full bg-ink py-1.5 pl-1.5 pr-4 text-sm text-white shadow-lg transition hover:bg-[#241d19]">
          <img src={topDeal.imageUrl.replace('w=1000', 'w=120')} alt="" className="size-8 rounded-full object-cover"/>
          <span><strong className="font-semibold">Deals of the week</strong><span className="hidden text-white/70 sm:inline"> · up to {discountPercent(topDeal.price, topDeal.compareAt)}% off</span></span><ArrowRight size={15}/>
        </Link>}
      </motion.div>
    </div>
    <ul className="no-scrollbar -mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 text-sm font-medium text-ink/70 sm:mx-0 sm:mt-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0">
      {[[Banknote, 'Cash on delivery', 'Pay when your order arrives'], [Truck, 'Delivery to all 27 governorates', `Free over ${money(FREE_SHIPPING_THRESHOLD)}`], [ShieldCheck, 'Every listing reviewed', 'By the BazaarNile team']].map(([Icon, title, text]) => { const I = Icon as typeof Truck; return <li key={title as string} className="flex w-[17rem] shrink-0 snap-start items-center gap-3 rounded-2xl border border-ink/8 bg-white px-4 py-3 sm:w-auto"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-nile-light text-nile"><I size={17}/></span><span><strong className="block text-ink">{title as string}</strong><span className="text-xs text-ink/55">{text as string}</span></span></li>; })}
    </ul>
  </section>;
}

function CategoryStrip({ categories }: { categories?: Category[] }) {
  return <section className="container-shell pt-10 sm:pt-14" aria-labelledby="categories-title">
    <SectionHeading id="categories-title" title="Shop by category" action={<ViewAll to="/shop">Browse all</ViewAll>}/>
    <ScrollRow frameClassName="-mx-4 lg:mx-0" className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:grid lg:grid-cols-8 lg:overflow-visible lg:px-0">
      {!categories && Array.from({ length: 8 }, (_, index) => <div key={index} className="h-40 w-32 shrink-0 animate-pulse rounded-2xl bg-ink/6 lg:w-auto"/>)}
      {categories?.map((category) => <Link key={category.id} to={`/shop?category=${category.slug}`} className="group w-32 shrink-0 snap-start rounded-2xl border border-ink/8 bg-white p-2.5 text-center transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_12px_30px_rgba(19,33,27,.08)] lg:w-auto">
        <span className="block aspect-square overflow-hidden rounded-xl bg-sand">{category.imageUrl && <img src={category.imageUrl.replace('w=900', 'w=300')} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105"/>}</span>
        <span className="mt-2.5 block truncate text-sm font-semibold leading-tight">{category.name}</span>
        <span className="block text-xs text-ink/50">{category._count?.products ?? 0} items</span>
      </Link>)}
    </ScrollRow>
  </section>;
}

function ProductRow({ products, loading, count = 4 }: { products?: Product[]; loading: boolean; count?: number }) {
  return <div className="product-grid">{loading ? Array.from({ length: count }, (_, index) => <ProductSkeleton key={index}/>) : products?.slice(0, count).map((product) => <ProductCard key={product.id} product={product}/>)}</div>;
}

function DiscoverCards() {
  const cards = [
    { to: '/assistant', icon: Bot, eyebrow: 'Nile Guide', title: 'Tell us what you need. We’ll find it.', text: 'Describe a gift, a budget, or a problem — our AI guide compares the live catalog for you.', cta: 'Ask Nile Guide', tone: 'bg-ink text-white', accent: 'text-[#7bc3aa]', button: 'bg-white text-ink hover:bg-sand' },
    { to: '/visual-search', icon: Camera, eyebrow: 'Photo search', title: 'Seen something you love?', text: 'Upload a photo and we’ll show the closest matches available in the bazaar.', cta: 'Search with a photo', tone: 'bg-nile-light text-ink', accent: 'text-nile', button: 'bg-nile text-white hover:bg-[#1b3d47]' },
    { to: '/seller', icon: Store, eyebrow: 'Sell on BazaarNile', title: 'Open your shop in minutes.', text: 'List products, manage stock, and follow every sale from Seller Center. No monthly fees.', cta: 'Start selling', tone: 'bg-[#f3e2d4] text-ink', accent: 'text-clay', button: 'bg-clay text-white hover:bg-[#873624]' },
  ];
  return <section className="container-shell home-block" aria-label="Discover more">
    <div className="grid gap-4 md:grid-cols-3">{cards.map(({ to, icon: Icon, eyebrow, title, text, cta, tone, accent, button }) => <Link key={to} to={to} className={`group flex flex-col rounded-[1.5rem] p-6 transition hover:-translate-y-0.5 sm:p-7 ${tone}`}>
      <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] ${accent}`}><Icon size={16}/>{eyebrow}</span>
      <h3 className="mt-4 font-display text-[1.7rem] font-semibold leading-tight">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 opacity-75">{text}</p>
      <span className={`mt-6 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${button}`}>{cta}<ArrowRight size={15} className="transition group-hover:translate-x-0.5"/></span>
    </Link>)}</div>
  </section>;
}

function ShopsToKnow({ shops }: { shops?: Shop[] }) {
  if (shops && !shops.length) return null;
  return <section className="container-shell home-block" aria-labelledby="shops-title">
    <SectionHeading id="shops-title" title="Shops to know" description="Independent sellers with a point of view."/>
    <ScrollRow frameClassName="-mx-4 md:mx-0" className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-1 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4">
      {!shops && Array.from({ length: 4 }, (_, index) => <div key={index} className="h-72 w-72 shrink-0 animate-pulse rounded-[1.5rem] bg-ink/6 md:w-auto"/>)}
      {shops?.slice(0, 8).map((shop) => <Link key={shop.username} to={`/profiles/${shop.username}`} className="group w-72 shrink-0 snap-start overflow-hidden rounded-[1.5rem] border border-ink/8 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(19,33,27,.1)] md:w-auto">
        <div className="grid h-36 grid-cols-3 gap-0.5 bg-sand">{[0, 1, 2].map((index) => <span key={index} className="overflow-hidden bg-[#eadcc3]">{shop.previewImages[index] && <img src={shop.previewImages[index]!.replace('w=1000', 'w=300')} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105"/>}</span>)}</div>
        <div className="relative px-5 pb-5">
          <span className="-mt-6 grid size-12 place-items-center rounded-full border-4 border-white bg-nile font-display text-lg font-semibold text-white">{shop.displayName.charAt(0)}</span>
          <h3 className="mt-2 truncate font-semibold">{shop.displayName}</h3>
          <p className="text-xs text-ink/55">{shop.productCount} products</p>
          {shop.bio && <p className="mt-2 line-clamp-2 text-sm leading-5 text-ink/65">{shop.bio}</p>}
        </div>
      </Link>)}
    </ScrollRow>
  </section>;
}

export function HomePage() {
  const isAuthenticated = useIsAuthenticated();
  const deals = useQuery({ queryKey: ['deals'], queryFn: () => api<ProductList>('/products?onSale=true&inStock=true&limit=12') });
  const featured = useQuery({ queryKey: ['featured'], queryFn: () => api<ProductList>('/products?featured=true&limit=4') });
  const latest = useQuery({ queryKey: ['latest'], queryFn: () => api<ProductList>('/products?sort=newest&limit=8') });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<{ categories: Category[] }>('/categories'), staleTime: 5 * 60_000 });
  const shops = useQuery({ queryKey: ['shops'], queryFn: () => api<{ shops: Shop[] }>('/shops?limit=8'), staleTime: 5 * 60_000 });
  const recommendations = useQuery({ queryKey: ['recommendations'], queryFn: () => api<Recommendations>('/recommendations?limit=4'), enabled: isAuthenticated });
  // Sort by size of the saving so the strongest deals lead.
  const dealProducts = [...(deals.data?.products ?? [])].filter((product) => discountPercent(product.price, product.compareAt) > 0)
    .sort((a, b) => discountPercent(b.price, b.compareAt) - discountPercent(a.price, a.compareAt));
  const bestDeal = dealProducts[0] ? discountPercent(dealProducts[0].price, dealProducts[0].compareAt) : 0;
  const productCount = categories.data?.categories.reduce((sum, category) => sum + (category._count?.products ?? 0), 0);

  return <>
    <Hero deals={dealProducts} productCount={productCount ? Math.floor(productCount / 10) * 10 : undefined}/>
    <CategoryStrip categories={categories.data?.categories}/>

    {(deals.isLoading || dealProducts.length > 0) && <section className="container-shell home-block" aria-labelledby="deals-title">
      <div className="rounded-[2rem] bg-[#f3e2d4] p-5 sm:p-8 lg:p-10">
        <SectionHeading id="deals-title" title={<span className="flex flex-wrap items-center gap-3">Deals of the week{bestDeal > 0 && <span className="rounded-full bg-clay px-3 py-1 font-sans text-sm font-bold tracking-normal text-white">Up to {bestDeal}% off</span>}</span>} description="Limited-time prices from sellers across the bazaar." action={<ViewAll to="/shop?onSale=true">All deals</ViewAll>}/>
        <ProductRow products={dealProducts} loading={deals.isLoading}/>
      </div>
    </section>}

    <section className="container-shell home-block" aria-labelledby="featured-title">
      <SectionHeading id="featured-title" title="Featured finds" description="A short edit of pieces worth a closer look." action={<ViewAll to="/shop?featured=true"/>}/>
      <ProductRow products={featured.data?.products} loading={featured.isLoading}/>
    </section>

    <DiscoverCards/>

    <section className="container-shell home-block" aria-labelledby="latest-title">
      <SectionHeading id="latest-title" title="Just arrived" description="The newest listings from sellers across the bazaar." action={<ViewAll to="/shop?sort=newest">Shop new in</ViewAll>}/>
      <ProductRow products={latest.data?.products} loading={latest.isLoading} count={8}/>
    </section>

    <ShopsToKnow shops={shops.data?.shops}/>

    {isAuthenticated && <section className="container-shell home-block" aria-labelledby="recommended-title">
      <div className="rounded-[2rem] border border-ink/8 bg-white p-5 sm:p-8 lg:p-10">
        <SectionHeading id="recommended-title" title={<span className="flex items-center gap-3">Picked for you<Sparkles className="text-clay" aria-hidden="true"/></span>} description={recommendations.data?.reason ?? 'Learning what catches your eye'}/>
        <ProductRow products={recommendations.data?.products} loading={recommendations.isLoading}/>
      </div>
    </section>}

    <section className="container-shell market-promises" aria-label="Marketplace benefits">
      {[[ShieldCheck, 'Shop with confidence', 'Every listing is reviewed, and you pay cash on delivery.'], [Truck, `Free shipping over ${money(FREE_SHIPPING_THRESHOLD)}`, 'Delivery to every governorate, with order tracking.'], [Sparkles, 'Smarter discovery', 'Ask Nile Guide or search with a photo to find it faster.']].map(([Icon, title, text]) => { const I = Icon as typeof ShieldCheck; return <div key={title as string}><I aria-hidden="true"/><h3>{title as string}</h3><p>{text as string}</p></div>; })}
    </section>
  </>;
}
