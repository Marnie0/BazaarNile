import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { api, setAccessToken, type User } from '../lib/api';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setError(''); setBusy(false); }, [mode]);
  const queryClient = useQueryClient();
  const submit = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setBusy(true); setError(''); const values = Object.fromEntries(new FormData(e.currentTarget)); try { const result = await api<{ user: User; accessToken: string }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(values) }); setAccessToken(result.accessToken); await queryClient.invalidateQueries(); navigate('/'); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to continue'); } finally { setBusy(false); } };
  const register = mode === 'register';
  return <main className="container-shell grid min-h-[70vh] place-items-center py-16"><div className="w-full max-w-md rounded-[2rem] border border-ink/8 bg-white p-8 shadow-[0_24px_80px_rgba(19,33,27,.08)]"><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">{register ? 'Join the marketplace' : 'Welcome back'}</p><h1 className="mt-2 font-display text-4xl font-bold">{register ? 'Create your account' : 'Sign in to BazaarNile'}</h1><form onSubmit={submit} className="mt-8 grid gap-4">
    {register && <><label className="grid gap-1.5 text-sm font-medium">Display name<input name="displayName" required minLength={2} className="rounded-xl border border-ink/12 px-4 py-3 outline-none focus:border-nile"/></label><label className="grid gap-1.5 text-sm font-medium">Username<input name="username" required pattern="[a-z0-9_]+" minLength={3} className="rounded-xl border border-ink/12 px-4 py-3 outline-none focus:border-nile"/></label></>}
    <label className="grid gap-1.5 text-sm font-medium">Email<input name="email" type="email" required className="rounded-xl border border-ink/12 px-4 py-3 outline-none focus:border-nile"/></label><label className="grid gap-1.5 text-sm font-medium">Password<input name="password" type="password" required minLength={8} className="rounded-xl border border-ink/12 px-4 py-3 outline-none focus:border-nile"/></label>{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button className="mt-2 w-full" size="lg" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Button>
  </form><p className="mt-6 text-center text-sm text-ink/55">{register ? 'Already have an account?' : 'New to BazaarNile?'} <Link className="font-semibold text-nile" to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create one'}</Link></p></div></main>;
}
