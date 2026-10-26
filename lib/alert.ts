// Okna in kratka sporočila v dizajnu aplikacije (namesto sivih oken brskalnika).
// Prikaže jih <DialogHost />, ki je enkrat vključen v app/_layout.tsx.

export type DialogRequest = {
  id: number;
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;        // brez = samo en gumb (obvestilo)
  destructive?: boolean;      // rdeč gumb (npr. Izbriši)
  resolve: (ok: boolean) => void;
};

type Listener = () => void;
let queue: DialogRequest[] = [];
let toastText: string | null = null;
let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(l => l());

export const dialogStore = {
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  current: () => queue[0] || null,
  toast: () => (toastText ? { text: toastText, seq: toastSeq } : null),
  close(ok: boolean) {
    const d = queue.shift();
    emit();
    d?.resolve(ok);
  },
};

// Obvestilo z enim gumbom (V redu)
export const showAlert = (title: string, message: string): Promise<void> =>
  new Promise(res => {
    queue.push({ id: nextId++, title, message, confirmText: 'V redu', resolve: () => res() });
    emit();
  });

// Vprašanje z dvema gumboma; vrne true, če uporabnik potrdi
export const confirmDialog = (opts: { title: string; message?: string; confirmText: string; cancelText?: string; destructive?: boolean }): Promise<boolean> =>
  new Promise(res => {
    queue.push({ id: nextId++, cancelText: 'Prekliči', ...opts, resolve: res });
    emit();
  });

// Kratko sporočilo na dnu zaslona (izgine samo)
export const showToast = (text: string, ms = 2200) => {
  toastText = text;
  toastSeq++;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastText = null; emit(); }, ms);
  emit();
};
