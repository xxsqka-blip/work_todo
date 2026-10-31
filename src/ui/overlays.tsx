/** 底部提示条（带"撤销"按钮）和确认弹窗 */
import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 毫秒，默认 3 秒；带按钮的默认 6 秒 */
  duration?: number;
  tone?: 'default' | 'error';
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface OverlayApi {
  toast(options: ToastOptions | string): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
}

const OverlayContext = createContext<OverlayApi | null>(null);

export function useOverlay(): OverlayApi {
  const api = useContext(OverlayContext);
  if (!api) throw new Error('OverlayProvider missing');
  return api;
}

interface ToastState extends ToastOptions {
  id: number;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function OverlayProvider({ children }: { children: ComponentChildren }) {
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const toast = useCallback((options: ToastOptions | string) => {
    const o = typeof options === 'string' ? { message: options } : options;
    seq.current += 1;
    setToastState({ ...o, id: seq.current });
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!toastState) return;
    const ms = toastState.duration ?? (toastState.actionLabel ? 6000 : 3000);
    timer.current = window.setTimeout(() => setToastState(null), ms);
    return () => window.clearTimeout(timer.current);
  }, [toastState]);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })),
    [],
  );

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const closeConfirm = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  return (
    <OverlayContext.Provider value={api}>
      {children}
      {toastState && (
        <div class={`toast ${toastState.tone === 'error' ? 'toast-error' : ''}`} role="status" aria-live="polite" key={toastState.id}>
          <span class="toast-message">{toastState.message}</span>
          {toastState.actionLabel && (
            <button
              type="button"
              class="toast-action"
              onClick={() => {
                const fn = toastState.onAction;
                setToastState(null);
                fn?.();
              }}
            >
              {toastState.actionLabel}
            </button>
          )}
        </div>
      )}
      {confirmState && (
        <div class="dialog-backdrop" onClick={() => closeConfirm(false)}>
          <div
            class="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" class="dialog-title">
              {confirmState.title}
            </h2>
            {confirmState.message && <p class="dialog-message">{confirmState.message}</p>}
            <div class="dialog-actions">
              <button type="button" class="btn btn-secondary" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel ?? '取消'}
              </button>
              <button
                type="button"
                class={`btn ${confirmState.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel ?? '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </OverlayContext.Provider>
  );
}
