import { useMutation } from '@tanstack/react-query';
import { Camera, ImagePlus, Search, Sparkles, Upload, X } from 'lucide-react';
import { useRef, useState, useSyncExternalStore, type ChangeEvent, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { Button } from '../components/ui/Button';
import { api, hasAccessToken, subscribeToAccessToken, type VisualSearchResponse } from '../lib/api';
import { money } from '../lib/utils';

type PreparedImage = { imageData: string; mimeType: 'image/jpeg'; preview: string; name: string };
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function prepareImage(file: File): Promise<PreparedImage> {
  if (!allowedTypes.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image');
  if (file.size > 10 * 1024 * 1024) throw new Error('The original image must be smaller than 10 MB');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1_000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('Your browser could not process this image'); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  let blob: Blob | null = null;
  for (const quality of [.82, .7, .58]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= 620_000) break;
  }
  if (!blob || blob.size > 620_000) throw new Error('This image could not be compressed enough. Try a smaller photo');
  const preview = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this image')); reader.readAsDataURL(blob!);
  });
  return { imageData: preview.slice(preview.indexOf(',') + 1), mimeType: 'image/jpeg', preview, name: file.name };
}

export function VisualSearchPage() {
  const authenticated = useSyncExternalStore(subscribeToAccessToken, hasAccessToken, () => false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageError, setImageError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const search = useMutation({ mutationFn: (prepared: PreparedImage) => api<VisualSearchResponse>('/ai/visual-search', { method: 'POST', body: JSON.stringify({ imageData: prepared.imageData, mimeType: prepared.mimeType }) }) });
  if (!authenticated) return <AuthRequired title="Search the bazaar with a photo"/>;
  const choose = async (file?: File) => {
    if (!file) return;
    setProcessing(true); setImageError(''); search.reset();
    try { setImage(await prepareImage(file)); } catch (error) { setImage(null); setImageError(error instanceof Error ? error.message : 'Could not process this image'); }
    finally { setProcessing(false); }
  };
  const fileChanged = (event: ChangeEvent<HTMLInputElement>) => { void choose(event.target.files?.[0]); event.target.value = ''; };
  const dropped = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); void choose(event.dataTransfer.files?.[0]); };
  const clear = () => { setImage(null); setImageError(''); search.reset(); };
  return <main className="container-shell py-12"><div className="mx-auto max-w-6xl"><div className="text-center"><p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[.18em] text-nile"><Sparkles size={16}/>Gemini vision</p><h1 className="mt-3 font-display text-5xl font-bold">Find it with a photo</h1><p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/55">Upload an item you like. BazaarNile analyzes its visual details and finds the closest available products in the marketplace.</p></div>
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[.82fr_1.18fr]"><section className="rounded-[2rem] border border-ink/10 bg-white p-5 shadow-[0_18px_60px_rgba(19,33,27,.08)] sm:p-7"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={fileChanged} className="hidden"/>{image ? <div><div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-sand"><img src={image.preview} alt="Selected visual search" className="size-full object-contain"/><button onClick={clear} aria-label="Remove image" className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white shadow-md hover:text-red-600"><X size={18}/></button></div><p className="mt-3 truncate text-sm text-ink/50">{image.name}</p><Button className="mt-5 w-full" size="lg" disabled={search.isPending} onClick={() => search.mutate(image)}><Search size={18}/>{search.isPending ? 'Analyzing image…' : 'Find similar products'}</Button><Button className="mt-3 w-full" variant="ghost" onClick={() => inputRef.current?.click()}><Upload size={16}/>Choose another photo</Button></div> : <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={dropped} className={`grid aspect-square place-items-center rounded-[1.5rem] border-2 border-dashed p-8 text-center transition ${dragging ? 'border-nile bg-nile-light/50' : 'border-ink/15 bg-sand/45'}`}><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-nile-light text-nile">{processing ? <Camera className="animate-pulse" size={27}/> : <ImagePlus size={27}/>}</span><h2 className="mt-5 font-display text-2xl font-bold">{processing ? 'Preparing your photo…' : 'Drop a product photo here'}</h2><p className="mt-2 text-sm leading-6 text-ink/50">JPEG, PNG, or WebP up to 10 MB</p><Button className="mt-6" disabled={processing} onClick={() => inputRef.current?.click()}>Choose a photo</Button></div></div>}{imageError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{imageError}</p>}<p className="mt-5 text-center text-xs leading-5 text-ink/40">Your image is processed for this search and is not saved by BazaarNile.</p></section>
      <section className="min-h-[520px] rounded-[2rem] bg-sand p-6 sm:p-8">{search.isPending ? <div className="grid min-h-[450px] place-items-center text-center"><div><Camera className="mx-auto animate-pulse text-nile" size={44}/><h2 className="mt-5 font-display text-3xl font-bold">Looking for visual matches</h2><p className="mt-2 text-ink/50">Gemini is comparing your image with the live catalog…</p></div></div> : search.error ? <div className="grid min-h-[450px] place-items-center text-center"><div><h2 className="font-display text-3xl font-bold">Search could not finish</h2><p role="alert" className="mx-auto mt-3 max-w-md text-sm text-red-700">{search.error instanceof Error ? search.error.message : 'Try another image or search again'}</p><Button className="mt-6" variant="outline" onClick={() => image && search.mutate(image)}>Try again</Button></div></div> : search.data ? <div><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">What Gemini sees</p><h2 className="mt-2 font-display text-3xl font-bold">Closest marketplace matches</h2><p className="mt-3 rounded-2xl bg-white p-4 text-sm leading-6 text-ink/65">{search.data.analysis}</p>{search.data.results.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{search.data.results.map(({ product, reason }) => <Link key={product.id} to={`/products/${product.slug}`} className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="aspect-[4/3] overflow-hidden bg-white"><img src={product.imageUrl} alt={product.name} className="size-full object-cover transition duration-500 group-hover:scale-105"/></div><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-nile">{product.category.name}</p><div className="mt-1 flex items-start justify-between gap-3"><h3 className="font-semibold">{product.name}</h3><span className="shrink-0 text-sm font-bold">{money(product.price)}</span></div><p className="mt-2 text-xs leading-5 text-ink/50">{reason}</p></div></Link>)}</div> : <div className="mt-8 rounded-2xl bg-white p-7 text-center"><h3 className="font-display text-2xl font-bold">No close matches yet</h3><p className="mt-2 text-sm text-ink/50">Try a clearer photo with one product centered in the frame.</p><Button className="mt-5" variant="outline" asChild><Link to="/shop">Browse all products</Link></Button></div>}</div> : <div className="grid min-h-[450px] place-items-center text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-white text-nile"><Camera size={28}/></span><h2 className="mt-5 font-display text-3xl font-bold">Your matches will appear here</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/50">For the best result, use a clear image with one product and minimal background clutter.</p></div></div>}</section></div></div></main>;
}
