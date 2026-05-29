import { AnimatePresence } from 'framer-motion'
import { useToastStore } from '../stores/toastStore'
import { Toast } from './Toast'

export function ToastContainer(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
