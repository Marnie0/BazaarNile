import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { dismiss, getToasts, subscribeToToasts } from '../lib/toast';
import { t } from '../lib/i18n';

export function Toaster() {
  const items = useSyncExternalStore(subscribeToToasts, getToasts, getToasts);
  return <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6" aria-live="polite">
    <AnimatePresence initial={false}>
      {items.map((item) => <motion.div key={item.id} layout initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .97 }} transition={{ duration: .18 }}
        role={item.tone === 'error' ? 'alert' : 'status'}
        className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-[0_18px_50px_rgba(19,33,27,.22)] ${item.tone === 'error' ? 'bg-[#7c2d1f] text-white' : 'bg-ink text-white'}`}>
        {item.tone === 'error' ? <AlertCircle size={18} className="shrink-0 text-[#ffb4a3]"/> : <CheckCircle2 size={18} className="shrink-0 text-[#7bc3aa]"/>}
        <p className="min-w-0 flex-1 font-medium">{item.message}</p>
        {item.action && <Link to={item.action.to} onClick={() => dismiss(item.id)} className="shrink-0 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold hover:bg-white/20">{item.action.label}</Link>}
        <button type="button" onClick={() => dismiss(item.id)} aria-label={t('Dismiss')} className="grid size-7 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"><X size={15}/></button>
      </motion.div>)}
    </AnimatePresence>
  </div>;
}
