import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastStore } from '../../store/useStore';
import { useEffect } from 'react';
import { clsx } from 'clsx';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  
  // Auto-remove toasts after duration
  useEffect(() => {
    toasts.forEach((toast) => {
      if (toast.duration === undefined) {
        toast.duration = 5000;
      }
      
      const timer = setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);
      
      return () => clearTimeout(timer);
    });
  }, [toasts, removeToast]);
  
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-20 lg:bottom-8 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  };
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const icon = {
    success: <CheckCircle className="text-green-500" size={20} />,
    error: <AlertCircle className="text-red-500" size={20} />,
    warning: <AlertTriangle className="text-yellow-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />
  };
  
  const bgColor = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  };
  
  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
        'animate-slide-up',
        bgColor[toast.type]
      )}
    >
      <div className="flex-shrink-0">
        {icon[toast.type]}
      </div>
      <p className="flex-1 text-sm text-gray-900 dark:text-white">
        {toast.message}
      </p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={16} className="text-gray-500" />
      </button>
    </div>
  );
}
