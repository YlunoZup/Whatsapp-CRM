// Simple toaster component placeholder
// Will be enhanced with @radix-ui/react-toast

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToasterContextType {
  toasts: Toast[];
  toast: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToasterContext = createContext<ToasterContextType | null>(null);

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((newToast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...newToast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToasterContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToasterContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToasterContext);
  if (!context) {
    // Return a no-op function if not in provider
    return {
      toast: () => {},
      dismiss: () => {},
      toasts: [],
    };
  }
  return context;
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`p-4 rounded-lg shadow-lg ${
            t.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-card border'
          }`}
          onClick={() => dismiss(t.id)}
        >
          <p className="font-medium">{t.title}</p>
          {t.description && <p className="text-sm opacity-90">{t.description}</p>}
        </div>
      ))}
    </div>
  );
}
