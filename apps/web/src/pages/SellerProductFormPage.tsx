import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Image as ImageIcon, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { Button } from '../components/ui/Button';
import { api, ApiError, type Category, type SellerProduct, type User } from '../lib/api';

const field = 'rounded-xl border border-ink/12 bg-white px-4 py-3 outline-none transition focus:border-nile focus:ring-2 focus:ring-nile/10';

export function SellerProductFormPage() {
  const { id } = useParams(); const editing = Boolean(id); const navigate = useNavigate(); const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), retry: false });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<{ categories: Category[] }>('/categories') });
  const product = useQuery({ queryKey: ['seller-product', id], queryFn: () => api<{ product: SellerProduct }>(`/seller/products/${id}`), enabled: editing, retry: false });
  useEffect(() => { if (product.data?.product.imageUrl) setImageUrl(product.data.product.imageUrl); }, [product.data]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...form, price: Number(form.price), compareAt: form.compareAt ? Number(form.compareAt) : null, inventory: Number(form.inventory) };
    try {
      await api(`/seller/products${editing ? `/${id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['seller-products'] }), queryClient.invalidateQueries({ queryKey: ['seller-overview'] })]);
      navigate('/seller');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this product'); } finally { setBusy(false); }
  };
  if (me.error instanceof ApiError && me.error.status === 401) return <AuthRequired title="Sign in to manage products"/>;
  if (me.isLoading || categories.isLoading || (editing && product.isLoading)) return <main className="container-shell py-20">Preparing product editor…</main>;
  if (me.data?.user.role !== 'SELLER' && me.data?.user.role !== 'ADMIN') return <main className="container-shell grid min-h-[60vh] place-items-center text-center"><div><h1 className="font-display text-4xl font-bold">Activate your seller account first</h1><Button className="mt-6" asChild><Link to="/seller">Go to Seller Center</Link></Button></div></main>;
  if (editing && !product.data) return <main className="container-shell py-20">Product not found.</main>;
  const saved = product.data?.product;
  return <main className="container-shell py-12"><Link to="/seller" className="inline-flex items-center gap-2 text-sm font-semibold text-ink/55 hover:text-nile"><ArrowLeft size={16}/>Seller Center</Link>
    <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_340px]"><section><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Product catalog</p><h1 className="mt-2 font-display text-5xl font-bold">{editing ? 'Edit listing' : 'New product'}</h1>
      <form id="product-form" onSubmit={submit} className="mt-8 grid gap-6 rounded-2xl border border-ink/8 bg-white p-6 sm:p-8">
        <label className="grid gap-2 text-sm font-semibold">Product name<input className={field} name="name" required minLength={3} maxLength={120} defaultValue={saved?.name} placeholder="e.g. Handwoven cotton throw"/></label>
        <label className="grid gap-2 text-sm font-semibold">Description<textarea className={`${field} min-h-36 resize-y`} name="description" required minLength={20} maxLength={3000} defaultValue={saved?.description} placeholder="Tell shoppers what makes this product special…"/></label>
        <div className="grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Price (EGP)<input className={field} name="price" type="number" min="1" step="0.01" required defaultValue={saved?.price}/></label><label className="grid gap-2 text-sm font-semibold">Compare-at price <span className="font-normal text-ink/40">Optional</span><input className={field} name="compareAt" type="number" min="1" step="0.01" defaultValue={saved?.compareAt}/></label></div>
        <div className="grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Category<select className={field} name="categoryId" required defaultValue={saved?.category.id ?? ''}><option value="" disabled>Choose a category</option>{categories.data?.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Inventory<input className={field} name="inventory" type="number" min="0" step="1" required defaultValue={saved?.inventory ?? 0}/></label></div>
        <label className="grid gap-2 text-sm font-semibold">Main image URL<input className={field} name="imageUrl" type="url" required value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…"/></label>
        <label className="grid gap-2 text-sm font-semibold">Listing status<select className={field} name="status" defaultValue={saved?.status ?? 'PENDING'}>{saved?.status === 'ACTIVE' && <option value="ACTIVE">Active — visible in the shop</option>}{saved?.status === 'REJECTED' && <option value="REJECTED">Rejected — edit and resubmit</option>}<option value="PENDING">Submit for admin review</option><option value="DRAFT">Draft — only visible to you</option><option value="ARCHIVED">Archived — no longer for sale</option></select></label>
        {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" asChild><Link to="/seller">Cancel</Link></Button><Button disabled={busy}><Save size={17}/>{busy ? 'Saving…' : editing ? 'Save changes' : 'Submit product'}</Button></div>
      </form></section>
      <aside className="lg:pt-24"><div className="sticky top-28 rounded-2xl bg-sand p-5"><p className="text-xs font-bold uppercase tracking-widest text-nile">Live preview</p><div className="mt-4 aspect-square overflow-hidden rounded-2xl bg-white">{imageUrl ? <img src={imageUrl} alt="Product preview" className="size-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }}/> : <div className="grid size-full place-items-center text-ink/25"><ImageIcon size={38}/></div>}</div><h2 className="mt-5 font-display text-2xl font-bold">{saved?.name ?? 'Your product'}</h2><p className="mt-2 text-sm text-ink/50">Use a square, high-resolution image for the best storefront presentation.</p></div></aside>
    </div>
  </main>;
}
