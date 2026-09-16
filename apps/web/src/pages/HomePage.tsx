import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { ProductCard } from '../components/ProductCard';
import { ProductSkeleton } from '../components/Skeleton';
import { Button } from '../components/ui/Button';
import { api, hasAccessToken, subscribeToAccessToken, type Category, type Product, type Recommendations } from '../lib/api';

export function HomePage() {
  const isAuthenticated = useSyncExternalStore(subscribeToAccessToken, hasAccessToken, () => false);
  const { data, isLoading } = useQuery({ queryKey: ['featured'], queryFn: () => api<{ products: Product[] }>('/products?featured=true&limit=4') });
  const { data: categoryData } = useQuery({ queryKey: ['categories'], queryFn: () => api<{ categories: Category[] }>('/categories') });
  const { data: recommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['recommendations'], queryFn: () => api<Recommendations>('/recommendations?limit=4'), enabled: isAuthenticated,
  });
  return <>
    <section className="overflow-hidden bg-sand py-16 lg:py-24"><div className="container-shell grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-nile"><Sparkles size={15}/> Curated for curious shoppers</div>
        <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">Find what feels <span className="italic text-nile">made for you.</span></h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-ink/65">A modern marketplace where exceptional products meet smarter discovery. Compare less. Love what you find more.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Button size="lg" asChild><Link to="/shop">Explore the bazaar <ArrowRight size={18}/></Link></Button><Button size="lg" variant="outline" asChild><Link to="/shop?featured=true">See featured finds</Link></Button></div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .15 }} className="relative mx-auto w-full max-w-xl">
        <div className="aspect-[5/4] overflow-hidden rounded-[2rem]"><img src="https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200" alt="Curated shopping collection" className="size-full object-cover"/></div>
        <div className="absolute -bottom-5 -left-4 rounded-2xl bg-white p-4 shadow-xl"><p className="text-xs text-ink/50">New discoveries</p><p className="mt-1 font-display text-2xl font-bold">Every week</p></div>
      </motion.div>
    </div></section>
    <section className="container-shell py-20"><div className="flex items-end justify-between"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Shop by world</p><h2 className="mt-2 font-display text-4xl font-bold">Browse categories</h2></div><Link to="/shop" className="hidden items-center gap-1 text-sm font-semibold sm:flex">View all <ArrowRight size={16}/></Link></div>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{categoryData?.categories.map((category) => <Link key={category.id} to={`/shop?category=${category.slug}`} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink"><img src={category.imageUrl} alt="" className="size-full object-cover opacity-70 transition duration-500 group-hover:scale-105 group-hover:opacity-55"/><div className="absolute inset-x-0 bottom-0 p-5 text-white"><h3 className="font-display text-2xl font-bold">{category.name}</h3><p className="mt-1 text-xs text-white/70">{category._count?.products ?? 0} products</p></div></Link>)}</div>
    </section>
    <section className="container-shell py-8"><div className="flex items-end justify-between"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Handpicked</p><h2 className="mt-2 font-display text-4xl font-bold">Featured finds</h2></div><Link to="/shop?featured=true" className="text-sm font-semibold">View all →</Link></div><div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{isLoading ? [1,2,3,4].map((x) => <ProductSkeleton key={x}/>) : data?.products.map((product) => <ProductCard key={product.id} product={product}/>)}</div></section>
    {isAuthenticated && <section className="container-shell py-20"><div className="rounded-[2rem] bg-sand px-6 py-10 md:px-10"><div className="flex items-end justify-between"><div><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.18em] text-nile"><Sparkles size={16}/> Smart discovery</p><h2 className="mt-2 font-display text-4xl font-bold">Recommended for you</h2><p className="mt-2 text-sm text-ink/55">{recommendations?.reason ?? 'Learning what catches your eye'}</p></div><Link to="/shop" className="hidden text-sm font-semibold sm:block">Explore more →</Link></div><div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{recommendationsLoading ? [1,2,3,4].map((x) => <ProductSkeleton key={x}/>) : recommendations?.products.map((product) => <ProductCard key={product.id} product={product}/>)}</div></div></section>}
    <section className="container-shell mt-24 grid gap-6 rounded-[2rem] bg-nile p-8 text-white md:grid-cols-3 md:p-12">{[[ShieldCheck,'Shop with confidence','Trusted sellers and thoughtfully selected products.'],[Truck,'Made for Egypt','A marketplace designed around local shoppers.'],[Sparkles,'Smarter discovery','Helpful technology without the noise.']].map(([Icon,title,text]) => { const I = Icon as typeof ShieldCheck; return <div key={title as string} className="flex gap-4"><I className="shrink-0 text-[#a7dfcc]"/><div><h3 className="font-semibold">{title as string}</h3><p className="mt-1 text-sm leading-6 text-white/65">{text as string}</p></div></div>; })}</section>
  </>;
}
