import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

/**
 * App-wide themed replacements for the browser's `window.confirm` / `alert`
 * (CC-9 / CC-10):
 *   • useConfirm() → confirm(opts): Promise<boolean> — a Sunrise-styled dialog.
 *   • useToast()   → toast(message, type) — a stacked, auto-dismissing snackbar.
 * Both render on top of everything and are fully theme-aware (light + dark).
 */
const ConfirmContext = createContext(null);
const ToastContext = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a DialogProvider');
  return ctx;
}
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a DialogProvider');
  return ctx;
}

const CONFIRM_DEFAULTS = {
  title: 'Are you sure?',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: false,
};

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const confirmBtnRef = useRef(null);

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        setDialog({ ...CONFIRM_DEFAULTS, ...opts, resolve });
      }),
    [],
  );

  const settle = useCallback(
    (result) => {
      setDialog((d) => {
        d?.resolve(result);
        return null;
      });
    },
    [],
  );

  const toast = useCallback((message, type = 'info') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // Escape cancels the dialog; focus the confirm button when it opens.
  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Enter') settle(true);
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [dialog, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      <ToastContext.Provider value={toast}>
        {children}

        {/* Confirm dialog */}
        {dialog && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => settle(false)}
            />
            <div className="relative w-full max-w-sm card-glass p-6 animate-[fadeIn_150ms_ease]">
              <h2 id="confirm-title" className="text-lg font-bold text-ink mb-1.5">
                {dialog.title}
              </h2>
              {dialog.message ? (
                <p className="text-sm text-ink-soft mb-5">{dialog.message}</p>
              ) : (
                <div className="mb-5" />
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => settle(false)}
                  className="px-4 py-2 rounded-full font-semibold text-ink-soft hover:bg-ink/5 transition-colors"
                >
                  {dialog.cancelLabel}
                </button>
                <button
                  ref={confirmBtnRef}
                  onClick={() => settle(true)}
                  className={
                    dialog.destructive
                      ? 'px-4 py-2 rounded-full font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors'
                      : 'btn-primary'
                  }
                >
                  {dialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toasts */}
        {toasts.length > 0 && (
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-2 w-full max-w-sm px-4"
            aria-live="polite"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className={`w-full flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-soft border text-sm font-medium animate-[fadeIn_150ms_ease] ${
                  t.type === 'error'
                    ? 'bg-red-500 text-white border-red-600'
                    : t.type === 'success'
                      ? 'bg-brand-500 text-white border-brand-600'
                      : 'bg-surface text-ink border-ink/10'
                }`}
              >
                <span className="flex-1">{t.message}</span>
              </div>
            ))}
          </div>
        )}
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  );
}
