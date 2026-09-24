import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Package, Sparkles, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { EmptyState, PageIntro, PageLoader } from '../components/PageState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Button } from '../components/ui/Button';
import { api, ApiError, type Notification } from '../lib/api';
import { formatDate } from '../lib/utils';
import { t, translateMessage } from '../lib/i18n';

const icons = { ORDER: Package, SELLER: Store, PROMOTION: Sparkles, SYSTEM: Bell };

export function NotificationsPage() {
  useDocumentTitle(t('Notifications'));
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ notifications: Notification[]; unreadCount: number }>('/notifications?limit=50'), retry: false, refetchInterval: 60_000 });
  const read = useMutation({ mutationFn: (id: string) => api<void>(`/notifications/${id}/read`, { method: 'PATCH' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: () => api<void>('/notifications/read-all', { method: 'PATCH' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  if (query.error instanceof ApiError && query.error.status === 401) return <AuthRequired title={t('Sign in to see notifications')}/>;
  if (query.isLoading) return <PageLoader label={t('Loading notifications…')}/>;
  const notifications = query.data?.notifications ?? [];
  return <main className="container-shell py-10 sm:py-14"><PageIntro eyebrow={t('Marketplace updates')} title={t('Notifications')} actions={Boolean(query.data?.unreadCount) && <Button variant="outline" disabled={readAll.isPending} onClick={() => readAll.mutate()}><CheckCheck size={17}/>{t('Mark all as read')}</Button>}>{query.data?.unreadCount ? t('{count} unread', { count: query.data.unreadCount }) : undefined}</PageIntro>
    {!notifications.length ? <EmptyState icon={Bell} title={t('You’re all caught up')} action={<Button asChild><Link to="/shop">{t('Continue shopping')}</Link></Button>}>{t('Order and seller updates will appear here.')}</EmptyState> : <div className="mt-8 grid gap-3">{notifications.map((notification) => { const Icon = icons[notification.type]; const content = <><span className={`grid size-11 shrink-0 place-items-center rounded-full ${notification.readAt ? 'bg-sand text-ink/45' : 'bg-nile-light text-nile'}`}><Icon size={19}/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="font-semibold">{translateMessage(notification.title)}</h2>{!notification.readAt && <span className="size-2 rounded-full bg-gold"/>}</div><p className="mt-1 text-sm text-ink/55">{translateMessage(notification.message)}</p><p className="mt-2 text-xs text-ink/35">{formatDate(notification.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</p></div></>; return notification.link ? <Link key={notification.id} to={notification.link} onClick={() => { if (!notification.readAt) read.mutate(notification.id); }} className={`flex gap-4 rounded-2xl border p-4 transition hover:border-nile/30 ${notification.readAt ? 'border-ink/8 bg-white' : 'border-nile/15 bg-white shadow-sm'}`}>{content}</Link> : <button key={notification.id} onClick={() => { if (!notification.readAt) read.mutate(notification.id); }} className={`flex gap-4 rounded-2xl border p-4 text-start ${notification.readAt ? 'border-ink/8 bg-white' : 'border-nile/15 bg-white shadow-sm'}`}>{content}</button>; })}</div>}
  </main>;
}
