import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning';
  title: string;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const iconName =
    toast.type === 'success' ? 'check_circle' : toast.type === 'warning' ? 'warning' : 'info';
  const borderBg =
    toast.type === 'success'
      ? 'border-status-success/30 bg-surface-card'
      : toast.type === 'warning'
      ? 'border-status-high/30 bg-surface-card'
      : 'border-border-subtle bg-surface-card';

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-fade-in">
      <div
        className={`p-4 rounded-xl shadow-lg border ${borderBg} flex items-start gap-3 text-text-primary`}
      >
        <span
          className={`material-symbols-outlined text-[20px] mt-0.5 ${
            toast.type === 'success'
              ? 'text-status-success'
              : toast.type === 'warning'
              ? 'text-status-high'
              : 'text-primary'
          }`}
        >
          {iconName}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h5 className="font-label-ui text-body-md text-text-primary">{toast.title}</h5>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary text-[14px] p-0.5"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
          <p className="text-body-sm text-text-secondary mt-1">{toast.message}</p>
          <div className="mt-2 text-[11px] font-label-code-sm text-text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Simulated Workbench Operation • No production changes executed
          </div>
        </div>
      </div>
    </div>
  );
};
