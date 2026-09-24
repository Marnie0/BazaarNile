import { useMutation, useQuery } from '@tanstack/react-query';
import { Banknote, ChevronRight, Heart, Minus, PackageX, Plus, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { EmptyState } from '../components/PageState';
import { OptionPicker } from '../components/product/OptionPicker';
import { initialSelection, matchVariant, type Selection } from '../lib/variants';
import { Reviews } from '../components/product/Reviews';
import { Stars } from '../components/ui/Stars';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/Button';
import { useAddToCart } from '../hooks/useAddToCart';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useWishlist } from '../hooks/useWishlist';
import { api, hasAccessToken, type AiSummary, type Product } from '../lib/api';
import { discountPercent, FREE_SHIPPING_THRESHOLD, money, stockLevel } from '../lib/utils';
import { t, getLanguage } from '../lib/i18n';

export function ProductPage() {
  const { slug } = useParams();
  // Keying by slug resets quantity, gallery, and AI summary state when moving between products.
  return <ProductDetails key={slug} slug={slug ?? ''}/>;
}

function ProductSkeleton() {
  return <main className="container-shell py-10" aria-busy="true"><div className="h-4 w-48 animate-pulse rounded bg-ink/8"/><div className="mt-7 grid gap-10 lg:grid-cols-2 lg:gap-16"><div className="aspect-square animate-pulse rounded-[1.75rem] bg-ink/8"/><div className="grid content-center gap-4"><div className="h-4 w-24 animate-pulse rounded bg-ink/8"/><div className="h-12 w-4/5 animate-pulse rounded bg-ink/8"/><div className="h-8 w-32 animate-pulse rounded bg-ink/8"/><div className="h-28 animate-pulse rounded bg-ink/8"/><div className="h-14 animate-pulse rounded-full bg-ink/8"/></div></div></main>;
}

function ProductDetails({ slug }: { slug: string }) {
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [missingOption, setMissingOption] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading, isError } = useQuery({ queryKey: ['product', slug], queryFn: () => api<{ product: Product }>(`/products/${encodeURIComponent(slug)}`) });
  const p = data?.product;
  useDocumentTitle(p?.name);
  const wishlist = useWishlist(p);
  const addToCart = useAddToCart();
  const related = useQuery({
    queryKey: ['related', p?.category.slug], enabled: Boolean(p),
    queryFn: () => api<{ products: Product[] }>(`/products?category=${encodeURIComponent(p!.category.slug)}&limit=5`),
  });
  const productId = p?.id;
  useEffect(() => {
    if (!productId || !hasAccessToken()) return;
    api<void>(`/products/${productId}/views`, { method: 'POST' }).catch(() => undefined);
  }, [productId]);
  const summarize = useMutation({ mutationFn: () => api<AiSummary>(`/ai/products/${productId}/summary`, { method: 'POST', body: JSON.stringify({ language: getLanguage() }) }) });

  if (isLoading) return <ProductSkeleton/>;
  if (isError || !p) return <main className="container-shell"><EmptyState icon={PackageX} title={t('Product not found')} action={<Button asChild><Link to="/shop">{t('Return to the bazaar')}</Link></Button>}>{t('This listing may have been removed or is no longer available.')}</EmptyState></main>;

  const requireAccount = (action: () => void) => hasAccessToken() ? action() : navigate('/login', { state: { from: location.pathname } });
  const images = [...new Set([p.imageUrl, ...(p.images ?? [])])].filter(Boolean);
  const variants = p.variants ?? [];
  const hasOptions = p.optionNames.length > 0 && variants.length > 0;
  const chosen = selection ?? initialSelection(p.optionNames, variants);
  const variant = hasOptions ? matchVariant(variants, chosen) : undefined;
  // Until an option is chosen, stock messages describe the listing as a whole.
  const available = variant ? variant.inventory : p.inventory;
  const maxQuantity = Math.max(1, Math.min(available, 20));
  const listingSoldOut = p.inventory <= 0;
  const soldOut = available <= 0;
  const discount = discountPercent(p.price, p.compareAt);
  const choose = (next: Selection) => { setSelection(next); setMissingOption(false); const match = matchVariant(variants, next); if (match) setQuantity((value) => Math.max(1, Math.min(value, match.inventory, 20))); };
  const ready = () => {
    if (hasOptions && !variant) { setMissingOption(true); document.getElementById('product-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    return true;
  };
  const add = () => { if (ready()) requireAccount(() => addToCart.mutate({ product: p, quantity, variant })); };
  const buyNow = () => { if (ready()) requireAccount(() => addToCart.mutate({ product: p, quantity, variant }, { onSuccess: () => navigate('/checkout') })); };
  const rating = Number(p.ratingAverage);
  const relatedProducts = related.data?.products.filter((item) => item.id !== p.id).slice(0, 4) ?? [];
  const urgent = stockLevel(available) === 'urgent';
  const option = variant ? variant.options.join(' / ') : '';
  const stock = soldOut ? { label: variant ? t('{option} is sold out — try another option', { option }) : t('Sold out'), tone: 'text-red-700' }
    : urgent ? { label: variant ? t('Only {count} left in {option} — order soon', { count: available, option }) : t('Only {count} left in stock — order soon', { count: available }), tone: 'text-red-600' }
    : { label: variant ? t('In stock in {option}, ready to ship', { option }) : t('In stock, ready to ship'), tone: 'text-emerald-700' };

  return <main className="container-shell py-8 pb-28 sm:py-10 lg:pb-10">
    <nav aria-label={t('Breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-sm text-ink/50"><Link to="/shop" className="hover:text-ink">{t('Shop')}</Link><ChevronRight size={14} className="shrink-0"/><Link to={`/shop?category=${p.category.slug}`} className="hover:text-ink">{t(p.category.name)}</Link><ChevronRight size={14} className="shrink-0"/><span className="truncate text-ink/75" aria-current="page">{p.name}</span></nav>
    <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative aspect-square overflow-hidden rounded-[1.75rem] bg-sand">
          <img src={images[activeImage] ?? p.imageUrl} alt={p.name} className="size-full object-cover" fetchPriority="high"/>
          {discount > 0 && <span className="absolute start-4 top-4 rounded-full bg-clay px-3 py-1.5 text-xs font-bold text-white">{t('Save {discount}%', { discount })}</span>}
        </div>
        {images.length > 1 && <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto" role="group" aria-label={t('Product images')}>{images.map((image, index) => <button type="button" key={image} onClick={() => setActiveImage(index)} aria-label={t('Show image {index} of {total}', { index: index + 1, total: images.length })} aria-pressed={index === activeImage} className={`size-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${index === activeImage ? 'border-nile' : 'border-transparent opacity-70 hover:opacity-100'}`}><img src={image} alt="" className="size-full object-cover" loading="lazy"/></button>)}</div>}
      </div>
      <div className="flex flex-col">
        <p className="eyebrow">{t(p.category.name)}</p>
        <h1 className="user-text mt-3 text-balance font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{p.name}</h1>
        <a href="#reviews" className="mt-3 flex w-fit items-center gap-2 text-sm text-ink/60 hover:text-ink">{p.reviewCount > 0 ? <><Stars value={rating} size={16}/><strong className="font-semibold text-ink">{rating.toFixed(1)}</strong><span className="underline decoration-ink/20 underline-offset-4">{t('{count} reviews', { count: p.reviewCount })}</span></> : <span className="underline decoration-ink/20 underline-offset-4">{t('No reviews yet — be the first')}</span>}</a>
        <div className="mt-5 flex flex-wrap items-baseline gap-3"><p className="text-3xl font-bold">{money(p.price)}</p>{discount > 0 && <><s className="text-lg text-ink/40">{money(p.compareAt!)}</s><span className="rounded-full bg-clay/10 px-2.5 py-1 text-xs font-bold text-clay">{t('You save {amount}', { amount: money(Number(p.compareAt) - Number(p.price)) })}</span></>}</div>
        <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${stock.tone} ${urgent ? 'w-fit rounded-full bg-red-50 px-3 py-1.5' : ''}`} role={urgent ? 'status' : undefined}><span className="size-2 rounded-full bg-current"/>{stock.label}</p>
        <p className="user-text mt-6 whitespace-pre-line text-[1.05rem] leading-8 text-ink/70">{p.description}</p>

        {hasOptions && !listingSoldOut && <div className="mt-8"><OptionPicker optionNames={p.optionNames} variants={variants} selection={chosen} onChange={choose} missing={missingOption}/></div>}

        <div className="mt-8 flex gap-2 sm:gap-3">
          {!soldOut && <div className="flex shrink-0 items-center rounded-full border border-ink/12 bg-white focus-within:ring-2 focus-within:ring-nile/30">
            <button type="button" aria-label={t('Decrease quantity')} disabled={quantity <= 1} className="grid size-11 place-items-center rounded-full disabled:opacity-30 sm:size-12" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={16}/></button>
            <input aria-label={t('Quantity')} type="number" inputMode="numeric" min="1" max={maxQuantity} step="1" value={quantity} onChange={(event) => { const next = event.currentTarget.valueAsNumber; if (Number.isInteger(next) && next >= 1) setQuantity(Math.min(next, maxQuantity)); }} onFocus={(event) => event.currentTarget.select()} className="w-8 bg-transparent text-center font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"/>
            <button type="button" aria-label={t('Increase quantity')} disabled={quantity >= maxQuantity} className="grid size-11 place-items-center rounded-full disabled:opacity-30 sm:size-12" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}><Plus size={16}/></button>
          </div>}
          <Button className="min-w-0 flex-1 px-4" size="lg" disabled={soldOut || addToCart.isPending} onClick={add}>{soldOut ? (variant ? t('Option sold out') : t('Sold out')) : addToCart.isPending ? t('Adding…') : t('Add to cart')}</Button>
          <Button variant="outline" size="icon" className={`size-14 shrink-0 ${wishlist.saved ? 'border-red-200 bg-red-50 text-red-600' : ''}`} disabled={wishlist.isPending} onClick={() => requireAccount(() => wishlist.toggle())} aria-label={wishlist.saved ? t('Remove from wishlist') : t('Save to wishlist')} aria-pressed={wishlist.saved}><Heart size={19} fill={wishlist.saved ? 'currentColor' : 'none'}/></Button>
        </div>
        {!soldOut && <Button variant="secondary" size="lg" className="mt-3 w-full" disabled={addToCart.isPending} onClick={buyNow}>{t('Buy now')}</Button>}

        <ul className="mt-7 grid gap-3 rounded-2xl border border-ink/8 bg-white p-4 text-sm sm:grid-cols-3">
          <li className="flex items-start gap-2.5"><Truck size={18} className="mt-0.5 shrink-0 text-nile"/><span><strong className="block font-semibold">{t('Free shipping')}</strong><span className="text-ink/55">{t('On orders over {amount}', { amount: money(FREE_SHIPPING_THRESHOLD) })}</span></span></li>
          <li className="flex items-start gap-2.5"><Banknote size={18} className="mt-0.5 shrink-0 text-nile"/><span><strong className="block font-semibold">{t('Cash on delivery')}</strong><span className="text-ink/55">{t('Pay when it arrives')}</span></span></li>
          <li className="flex items-start gap-2.5"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-nile"/><span><strong className="block font-semibold">{t('Reviewed listing')}</strong><span className="text-ink/55">{t('Approved by our team')}</span></span></li>
        </ul>

        <div className="mt-5 rounded-2xl border border-nile/15 bg-nile-light/35 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold"><Sparkles size={17} className="text-nile"/>{t('Quick AI summary')}</p><p className="mt-1 text-xs text-ink/55">{t('A short, plain-language take on this product.')}</p></div><Button variant="outline" className="px-4 py-2" disabled={summarize.isPending} onClick={() => requireAccount(() => summarize.mutate())}>{summarize.isPending ? t('Summarizing…') : summarize.data ? t('Summarize again') : t('Summarize')}</Button></div>{summarize.data && <p className="mt-4 text-sm leading-6 text-ink/75" aria-live="polite">{summarize.data.summary}</p>}{summarize.error && <p className="mt-3 text-sm text-red-700" role="alert">{summarize.error instanceof Error ? summarize.error.message : t('Could not create the summary')}</p>}</div>

        <Link to={`/profiles/${p.seller.username}`} className="group mt-5 flex items-center gap-3 rounded-2xl bg-sand p-4 transition hover:bg-[#eee2cf]">{p.seller.avatarUrl ? <img src={p.seller.avatarUrl} alt="" className="size-11 rounded-full object-cover"/> : <span className="grid size-11 place-items-center rounded-full bg-nile text-lg font-bold text-white">{p.seller.displayName[0]}</span>}<div className="min-w-0 flex-1"><p className="text-xs text-ink/50">{t('Sold by')}</p><p className="truncate font-semibold">{p.seller.displayName}</p></div><span className="text-sm font-semibold text-nile group-hover:underline">{t('Visit shop')}</span></Link>
      </div>
    </div>

    <Reviews product={p}/>

    {relatedProducts.length > 0 && <section className="mt-20 border-t border-ink/10 pt-12" aria-labelledby="related-title">
      <div className="flex items-end justify-between gap-4"><h2 id="related-title" className="font-display text-3xl font-semibold">{t('More in {category}', { category: t(p.category.name) })}</h2><Link to={`/shop?category=${p.category.slug}`} className="quiet-link">{t('View all')}</Link></div>
      <div className="product-grid mt-7">{relatedProducts.map((item) => <ProductCard key={item.id} product={item}/>)}</div>
    </section>}

    {!listingSoldOut && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-[#fcfbf8]/95 px-4 py-3 backdrop-blur-lg lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3"><div className="min-w-0 flex-1">{urgent && !soldOut ? <p className="truncate text-xs font-bold text-red-600">{t('Only {count} left', { count: available })}</p> : <p className="truncate text-xs text-ink/55">{variant ? variant.options.join(' / ') : p.name}</p>}<p className="font-bold">{money(Number(p.price) * quantity)}</p></div><Button disabled={soldOut || addToCart.isPending} onClick={add}>{soldOut ? t('Sold out') : addToCart.isPending ? t('Adding…') : hasOptions && !variant ? t('Choose {option}', { option: t(p.optionNames[0]!).toLowerCase() }) : t('Add to cart')}</Button></div>
    </div>}
  </main>;
}
