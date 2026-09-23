import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageIntro({ eyebrow, title, children, actions }: { eyebrow: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-5">
    <div className="min-w-0"><p className="eyebrow">{eyebrow}</p><h1 className="mt-2 text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>{children && <div className="mt-3 max-w-2xl text-ink/60">{children}</div>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}

export function PageLoader({ label }: { label: string }) {
  return <main className="container-shell grid min-h-[55vh] place-items-center py-20" aria-busy="true">
    <div className="flex flex-col items-center gap-4 text-sm font-medium text-ink/55"><span className="spinner" aria-hidden="true"/>{label}</div>
  </main>;
}

export function EmptyState({ icon: Icon, title, children, action, compact = false }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return <div className={`grid place-items-center text-center ${compact ? 'py-14' : 'min-h-[45vh] py-16'}`}>
    <div className="max-w-md"><span className="mx-auto grid size-16 place-items-center rounded-full bg-nile-light text-nile"><Icon size={28}/></span>
      <h2 className="mt-5 font-display text-3xl font-semibold">{title}</h2>
      {children && <p className="mt-2 leading-7 text-ink/55">{children}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  </div>;
}
