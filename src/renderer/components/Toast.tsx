import { motion } from 'framer-motion'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { Toast as ToastType } from '../stores/toastStore'
import { useToastStore } from '../stores/toastStore'
import { toastVariants } from '../animations/variants'

interface ToastProps {
  toast: ToastType
}

const iconMap = {
  success: <CheckCircleIcon className="w-4 h-4" style={{ color: 'var(--ok)' }} />,
  error: <ExclamationCircleIcon className="w-4 h-4" style={{ color: 'var(--bad)' }} />,
  info: <InformationCircleIcon className="w-4 h-4" style={{ color: 'var(--accent)' }} />,
  warning: <ExclamationTriangleIcon className="w-4 h-4" style={{ color: 'var(--warn)' }} />
}

const borderMap = {
  success: 'var(--ok)',
  error: 'var(--bad)',
  info: 'var(--accent)',
  warning: 'var(--warn)'
}

export function Toast({ toast }: ToastProps): JSX.Element {
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <motion.div
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex items-start gap-3 w-80 px-4 py-3 shadow-lg"
      style={{
        background: 'var(--bg-1)',
        border: `1px solid color-mix(in srgb, ${borderMap[toast.type]} 30%, transparent)`,
        borderRadius: 'var(--radius)'
      }}
    >
      <span className="shrink-0 mt-0.5">{iconMap[toast.type]}</span>
      <p className="flex-1 text-sm leading-snug" style={{ color: 'var(--tx)', fontSize: 12.5 }}>
        {toast.message}
      </p>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 p-0.5 transition-colors"
        style={{ color: 'var(--tx-faint)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--tx)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--tx-faint)' }}
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
