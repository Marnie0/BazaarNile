import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, ShieldCheck, TicketPercent, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { EmptyState, PageIntro, PageLoader } from '../components/PageState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Field';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { confirmAction } from '../lib/confirm';
import { toast, toastError } from '../lib/toast';
import { api, ApiError, type Coupon, type User } from '../lib/api';
import { formatDate, formatNumber, money } from '../lib/utils';
import { t, tx } from '../lib/i18n';

export function AdminCouponsPage() {
  useDocumentTitle(t('Coupons'));
  const queryClient = useQueryClient(); const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<Coupon['type']>('PERCENTAGE');
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), retry: false });
  const coupons = useQuery({ queryKey: ['admin-coupons'], queryFn: () => api<{ coupons: Coupon[] }>('/admin/coupons'), enabled: me.data?.user.role === 'ADMIN' });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api<{ coupon: Coupon }>('/admin/coupons', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async ({ coupon }) => { toast(t('{code} is live', { code: coupon.code })); formRef.current?.reset(); setType('PERCENTAGE'); await refresh(); },
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api<{ coupon: Coupon }>(`/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    onSuccess: async ({ coupon }) => { toast(coupon.active ? t('{code} activated', { code: coupon.code }) : t('{code} paused', { code: coupon.code })); await refresh(); },
    onError: (error) => toastError(error, t('Could not update the coupon')),
  });
  const remove = useMutation({
    mutationFn: (coupon: Coupon) => api<void>(`/admin/coupons/${coupon.id}`, { method: 'DELETE' }),
    onSuccess: async (_, coupon) => { toast(t('{code} deleted', { code: coupon.code })); await refresh(); },
    onError: (error) => toastError(error, t('Could not delete the coupon')),
  });
  if (me.error instanceof ApiError && me.error.status === 401) return <AuthRequired title={t('Sign in to manage coupons')}/>;
  if (me.isLoading) return <PageLoader label={t('Checking administrator access…')}/>;
  if (me.data?.user.role !== 'ADMIN') return <main className="container-shell"><EmptyState icon={ShieldCheck} title={t('Administrator access required')}>{t('This workspace is restricted to BazaarNile administrators.')}</EmptyState></main>;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const expires = String(form.get('expiresAt') ?? ''); const maxDiscount = String(form.get('maxDiscount') ?? ''); const usageLimit = String(form.get('usageLimit') ?? '');
    create.mutate({ code: form.get('code'), type, value: Number(form.get('value')), minOrderAmount: Number(form.get('minOrderAmount') || 0), maxDiscount: maxDiscount ? Number(maxDiscount) : null, usageLimit: usageLimit ? Number(usageLimit) : null, expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null, active: true });
  };
  const list = coupons.data?.coupons ?? [];

  return <main className="container-shell py-10 sm:py-12">
    <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-ink/60 hover:text-nile"><ArrowLeft size={16}/>{t('Admin Panel')}</Link>
    <div className="mt-6"><PageIntro eyebrow={t('Promotions')} title={t('Coupons')}>{t('Create discounts with minimum spends, caps, usage limits, and expiry dates.')}</PageIntro></div>
    <div className="mt-8 grid items-start gap-7 lg:grid-cols-[380px_1fr]">
      <form ref={formRef} onSubmit={submit} className="surface grid gap-4 p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-semibold">{t('New coupon')}</h2>
        <Field label={t('Code')} hint={t('Letters, numbers, dashes, or underscores.')}><Input name="code" className="font-semibold uppercase tracking-wide" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_\-]+" placeholder="NILE20" autoComplete="off"/></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Type')}><Select value={type} onChange={(event) => setType(event.target.value as Coupon['type'])}><option value="PERCENTAGE">{t('Percent off')}</option><option value="FIXED">{t('Amount off')}</option></Select></Field>
          <Field label={type === 'PERCENTAGE' ? t('Percent') : t('Amount (EGP)')}><Input name="value" type="number" inputMode="decimal" min="1" max={type === 'PERCENTAGE' ? 100 : undefined} step="0.01" required placeholder={type === 'PERCENTAGE' ? '10' : '100'}/></Field>
        </div>
        <Field label={t('Minimum order (EGP)')}><Input name="minOrderAmount" type="number" inputMode="decimal" min="0" step="0.01" defaultValue="0"/></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Max discount')} optional><Input name="maxDiscount" type="number" inputMode="decimal" min="1" step="0.01" placeholder={t('No cap')}/></Field>
          <Field label={t('Usage limit')} optional><Input name="usageLimit" type="number" inputMode="numeric" min="1" step="1" placeholder={t('Unlimited')}/></Field>
        </div>
        <Field label={t('Expires on')} optional hint={t('Leave empty to keep it running.')}><Input name="expiresAt" type="date" min={new Date().toISOString().slice(0, 10)}/></Field>
        {create.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{create.error instanceof Error ? create.error.message : t('Could not create coupon')}</p>}
        <Button disabled={create.isPending}><TicketPercent size={17}/>{create.isPending ? t('Creating…') : t('Create coupon')}</Button>
      </form>

      <section aria-labelledby="coupon-list-title">
        <div className="flex items-end justify-between gap-3"><h2 id="coupon-list-title" className="font-display text-2xl font-semibold">{t('Marketplace coupons')}</h2>{list.length > 0 && <span className="text-sm text-ink/55">{t('{active} active of {total}', { active: list.filter((coupon) => coupon.active).length, total: list.length })}</span>}</div>
        <div className="mt-4 grid gap-3">
          {coupons.isLoading && Array.from({ length: 3 }, (_, index) => <div key={index} className="surface h-32 animate-pulse"/>)}
          {list.map((coupon) => {
            const expired = Boolean(coupon.expiresAt && new Date(coupon.expiresAt) <= new Date());
            const used = coupon.usageLimit ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100) : 0;
            return <article key={coupon.id} className={`surface p-5 ${coupon.active && !expired ? '' : 'opacity-75'}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="rounded-lg border border-dashed border-ink/25 bg-sand/50 px-2.5 py-1 font-mono text-lg font-bold tracking-wider">{coupon.code}</h3><Badge tone={expired ? 'neutral' : coupon.active ? 'success' : 'warning'}>{expired ? t('Expired') : coupon.active ? t('Active') : t('Paused')}</Badge></div>
                  <p className="mt-2.5 font-semibold">{coupon.type === 'PERCENTAGE' ? t('{percent}% off', { percent: Number(coupon.value) }) : t('{amount} off', { amount: money(coupon.value) })}{Number(coupon.minOrderAmount) > 0 && <span className="font-normal text-ink/60"> {t('orders over {amount}', { amount: money(coupon.minOrderAmount) })}</span>}{coupon.maxDiscount && <span className="font-normal text-ink/60"> · {t('up to {amount}', { amount: money(coupon.maxDiscount) })}</span>}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/55"><CalendarClock size={13}/>{coupon.expiresAt ? (expired ? t('Expired {date}', { date: formatDate(coupon.expiresAt) }) : t('Expires {date}', { date: formatDate(coupon.expiresAt) })) : t('No expiry')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`flex cursor-pointer items-center gap-2 text-sm font-semibold ${expired ? 'pointer-events-none opacity-40' : ''}`}>
                    <span className="sr-only sm:not-sr-only">{coupon.active ? t('On') : t('Off')}</span>
                    <button type="button" role="switch" aria-checked={coupon.active} aria-label={coupon.active ? t('Pause {code}', { code: coupon.code }) : t('Activate {code}', { code: coupon.code })} disabled={toggle.isPending || expired} onClick={() => toggle.mutate({ id: coupon.id, active: !coupon.active })} className={`relative h-6 w-11 rounded-full transition ${coupon.active ? 'bg-nile' : 'bg-ink/20'}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${coupon.active ? 'start-[1.375rem]' : 'start-0.5'}`}/></button>
                  </label>
                  <button type="button" disabled={remove.isPending} onClick={async () => { if (await confirmAction({ title: t('Delete {code}?', { code: coupon.code }), message: t('Shoppers will no longer be able to use it. Orders that already used it keep their recorded discount.'), confirmLabel: t('Delete coupon'), tone: 'danger' })) remove.mutate(coupon); }} className="grid size-9 place-items-center rounded-full text-ink/45 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40" aria-label={t('Delete {code}', { code: coupon.code })}><Trash2 size={17}/></button>
                </div>
              </div>
              <div className="mt-4 border-t border-ink/8 pt-3 text-xs text-ink/60">
                <div className="flex justify-between"><span>{tx('{count} used', { count: <strong className="text-ink">{formatNumber(coupon.usedCount)}</strong> })}</span><span>{coupon.usageLimit ? t('{left} of {limit} left', { left: Math.max(coupon.usageLimit - coupon.usedCount, 0), limit: coupon.usageLimit }) : t('Unlimited uses')}</span></div>
                {coupon.usageLimit && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/8"><div className={`h-full rounded-full ${used >= 90 ? 'bg-red-500' : 'bg-nile'}`} style={{ width: `${used}%` }}/></div>}
              </div>
            </article>;
          })}
          {!coupons.isLoading && !list.length && <div className="surface"><EmptyState compact icon={TicketPercent} title={t('No coupons yet')}>{t('Create your first coupon to run a promotion.')}</EmptyState></div>}
        </div>
      </section>
    </div>
  </main>;
}
