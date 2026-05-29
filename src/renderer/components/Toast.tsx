import { motion } from 'framer-motion'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { Toast as ToastType } from '../stores/toastStore'
import { useToastStore } from '../stores/toastStore'
import { toastVariants } from '../animations/variants'

interface ToastProps {
  toast: ToastType
}

const iconMap = {
  success: <CheckCircleIcon className="w-5 h-5 text-emerald-400" />,
  error: <ExclamationCircleIcon className="w-5 h-5 text-red-400" />,
  info: <InformationCircleIcon className="w-5 h-5 text-blue-400" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />
}

const borderMap = {
  success: 'border-emerald-800',
  error: 'border-red-800',
  info: 'border-blue-800',
  warning: 'border-yellow-800'
}

export function Toast({ toast }: ToastProps): JSX.Element {
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <motion.div
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`flex items-start gap-3 w-80 px-4 py-3 bg-surface-900 border ${borderMap[toast.type]} rounded-lg shadow-lg`}
    >
      <span className="shrink-0 mt-0.5">{iconMap[toast.type]}</span>
      <p className="flex-1 text-sm text-surface-100 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 p-0.5 text-surface-500 hover:text-white transition-colors"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
