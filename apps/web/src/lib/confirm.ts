// Promise-based confirmation, rendered by <ConfirmDialogHost/>. Replaces window.confirm.
export type ConfirmRequest = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; tone?: 'danger' | 'default' };
type Pending = ConfirmRequest & { id: number; resolve: (value: boolean) => void };

let current: Pending | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const getConfirm = () => current;
export const subscribeToConfirm = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const settleConfirm = (value: boolean) => { const pending = current; current = null; emit(); pending?.resolve(value); };

export function confirmAction(request: ConfirmRequest) {
  if (current) settleConfirm(false);
  return new Promise<boolean>((resolve) => { current = { ...request, id: nextId++, resolve }; emit(); });
}
