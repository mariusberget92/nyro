import type { Variants } from 'framer-motion'

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } }
}

export const queueItemVariants: Variants = {
  hidden: { opacity: 0, x: -20, height: 0 },
  visible: {
    opacity: 1,
    x: 0,
    height: 'auto',
    transition: { duration: 0.25, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    x: 20,
    height: 0,
    transition: { duration: 0.2, ease: 'easeIn' }
  }
}

export const toastVariants: Variants = {
  hidden: { opacity: 0, x: 60, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
  exit: {
    opacity: 0,
    x: 60,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
}

export const progressBarVariants: Variants = {
  initial: { scaleX: 0, originX: 0 },
  animate: {
    scaleX: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
}

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } }
}
