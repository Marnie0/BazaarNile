import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMe } from '../hooks/useSession';
import { api, setAccessToken, type User } from '../lib/api';

// Only same-site paths are honoured as a post-login destination, never absolute URLs.
const safeDestination = (value: unknown) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !['/login', '/register'].includes(value) ? value : '/';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const register = mode === 'register';
  useDocumentTitle(register ? 'Create account' : 'Sign in');
  const navigate = useNavigate(); const location = useLocation();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [showPassword, setShowPassword] = useState(false);
  useEffect(() => { setError(''); setBusy(false); }, [mode]);
  const queryClient = useQueryClient();
  const { user } = useMe();
  const destination = safeDestination((location.state as { from?: unknown } | null)?.from);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ user: User; accessToken: string }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(values) });
      setAccessToken(result.accessToken);
      queryClient.setQueryData(['me'], { user: result.user });
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
      navigate(destination, { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to continue'); } finally { setBusy(false); }
  };
  if (user && !busy) return <Navigate to={destination} replace/>;
  return <main className="container-shell grid min-h-[70vh] place-items-center py-12 sm:py-16"><div className="w-full max-w-md rounded-[2rem] border border-ink/8 bg-white p-7 shadow-[0_24px_80px_rgba(19,33,27,.08)] sm:p-9">
    <p className="eyebrow">{register ? 'Join the marketplace' : 'Welcome back'}</p>
    <h1 className="mt-2 font-display text-4xl font-semibold">{register ? 'Create your account' : 'Sign in to BazaarNile'}</h1>
    <p className="mt-2 text-sm text-ink/60">{register ? 'Save favourites, track orders, and open your own shop.' : 'Pick up where you left off.'}</p>
    <form onSubmit={submit} className="mt-7 grid gap-4">
      {register && <><label className="field-label">Display name<input name="displayName" required minLength={2} maxLength={60} autoComplete="name" className="field"/></label>
        <label className="field-label">Username<input name="username" required pattern="[a-z0-9_]{3,30}" minLength={3} maxLength={30} autoComplete="username" autoCapitalize="none" spellCheck={false} className="field" onChange={(event) => { event.currentTarget.value = event.currentTarget.value.toLowerCase(); }}/><span className="field-hint">3–30 lowercase letters, numbers, or underscores.</span></label></>}
      <label className="field-label">Email<input name="email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} className="field"/></label>
      <label className="field-label">Password
        <span className="relative"><input name="password" type={showPassword ? 'text' : 'password'} required minLength={register ? 8 : 1} maxLength={72} autoComplete={register ? 'new-password' : 'current-password'} className="field pr-12"/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink/50 hover:bg-sand hover:text-ink">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>
        {register && <span className="field-hint">At least 8 characters.</span>}
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button className="mt-2 w-full" size="lg" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Button>
    </form>
    <p className="mt-6 text-center text-sm text-ink/60">{register ? 'Already have an account?' : 'New to BazaarNile?'} <Link className="font-semibold text-nile hover:underline" to={register ? '/login' : '/register'} state={location.state} replace>{register ? 'Sign in' : 'Create one'}</Link></p>
  </div></main>;
}
