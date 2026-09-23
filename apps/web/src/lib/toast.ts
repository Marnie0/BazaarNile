// A tiny global toast queue; <Toaster/> renders it.
export type Toast = { id: number; message: string; tone: 'success' | 'error'; action?: { label: string; to: string } };

let toasts: Toast[] = [];
export const getToasts = () => toasts;
let nextId = 1;
const listeners = new Set<() => void>();
export const subscribeToToasts = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => listeners.forEach((listener) => listener());
export const dismiss = (id: number) => { toasts = toasts.filter((item) => item.id !== id); emit(); };

export function toast(message: string, options: { tone?: Toast['tone']; action?: Toast['action'] } = {}) {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, tone: options.tone ?? 'success', action: options.action }];
  emit();
  window.setTimeout(() => dismiss(id), options.tone === 'error' ? 6_000 : 4_000);
}

export const toastError = (error: unknown, fallback: string) => toast(error instanceof Error ? error.message : fallback, { tone: 'error' });

