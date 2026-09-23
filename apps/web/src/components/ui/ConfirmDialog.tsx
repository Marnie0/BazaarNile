import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useEffect, useId, useRef, useSyncExternalStore, type KeyboardEvent } from 'react';
import { getConfirm, settleConfirm, subscribeToConfirm } from '../../lib/confirm';
import { Button } from './Button';

export function ConfirmDialogHost() {
  const request = useSyncExternalStore(subscribeToConfirm, getConfirm, getConfirm);
  const titleId = useId(); const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!request) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    // Destructive actions start focused on Cancel so a stray Enter never deletes anything.
    const timer = window.setTimeout(() => (request.tone === 'danger' ? cancelRef.current : panelRef.current?.querySelector<HTMLButtonElement>('[data-confirm]'))?.focus(), 30);
    // Escape works even if focus has not reached the dialog yet.
    const onEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') settleConfirm(false); };
    document.addEventListener('keydown', onEscape);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', onEscape); document.body.style.overflow = overflow; restoreFocus.current?.focus?.(); };
  }, [request]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button');
    if (!focusable?.length) return;
    const first = focusable[0]!; const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <AnimatePresence>{request && <motion.div key={request.id} className="fixed inset-0 z-[70] grid place-items-end bg-ink/45 p-3 backdrop-blur-[2px] sm:place-items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }} onMouseDown={(event) => { if (event.target === event.currentTarget) settleConfirm(false); }}>
    <motion.div ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={request.message ? messageId : undefined} onKeyDown={onKeyDown}
      initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }} transition={{ duration: .18, ease: 'easeOut' }}
      className="w-full max-w-md rounded-[1.5rem] bg-[#fffdf9] p-6 shadow-[0_30px_80px_rgba(19,33,27,.3)] sm:p-7">
      <span className={`grid size-11 place-items-center rounded-full ${request.tone === 'danger' ? 'bg-red-100 text-red-700' : 'bg-nile-light text-nile'}`}>{request.tone === 'danger' ? <AlertTriangle size={20}/> : <HelpCircle size={20}/>}</span>
      <h2 id={titleId} className="mt-4 font-display text-2xl font-semibold leading-tight">{request.title}</h2>
      {request.message && <p id={messageId} className="mt-2 text-sm leading-6 text-ink/65">{request.message}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button ref={cancelRef} variant="outline" onClick={() => settleConfirm(false)}>{request.cancelLabel ?? 'Cancel'}</Button>
        <Button data-confirm="" variant={request.tone === 'danger' ? 'destructive' : 'primary'} onClick={() => settleConfirm(true)}>{request.confirmLabel ?? 'Confirm'}</Button>
      </div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}
