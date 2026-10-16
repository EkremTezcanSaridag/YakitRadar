import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { logError } from '../utils/logger'
import Toast from './Toast'
import { pushToast, registerToastApi, unregisterToastApi } from './toastController'

const ToastContext = createContext(null)

const DEFAULT_DURATION = {
  success: 2500,
  info: 3000,
  warning: 4000,
  error: 5000,
}

function dedupeKey(item) {
  return `${item.type}:${item.message}`
}

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets()
  const [current, setCurrent] = useState(null)
  const [visible, setVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const queueRef = useRef([])
  const timerRef = useRef(null)
  const lastShownRef = useRef({ key: '', at: 0 })
  const screenReaderRef = useRef(false)

  const bottomOffset = Math.max(insets.bottom, Platform.OS === 'web' ? 0 : 8) + 4 + 68 + 12

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch((error) => logError('toast.reduceMotion', error))
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        screenReaderRef.current = enabled
      })
      .catch((error) => logError('toast.reduceMotion', error))

    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    const readerSub = AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
      screenReaderRef.current = enabled
    })

    return () => {
      motionSub?.remove?.()
      readerSub?.remove?.()
    }
  }, [])

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setVisible(false)
    setTimeout(() => {
      setCurrent(null)
      const next = queueRef.current.shift()
      if (next) {
        showItem(next)
      }
    }, 160)
  }, [])

  const showItem = useCallback(
    (item) => {
      setCurrent(item)
      setVisible(true)
      AccessibilityInfo.announceForAccessibility(item.message)

      const baseDuration = item.duration ?? DEFAULT_DURATION[item.type] ?? 3000
      const duration =
        item.persistent || (screenReaderRef.current && item.actionLabel)
          ? 0
          : screenReaderRef.current
            ? Math.max(baseDuration * 2, 6000)
            : item.type === 'error' && item.actionLabel
              ? 6000
              : baseDuration

      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          dismiss()
        }, duration)
      }
    },
    [dismiss],
  )

  const push = useCallback(
    (item) => {
      const key = dedupeKey(item)
      const now = Date.now()
      if (lastShownRef.current.key === key && now - lastShownRef.current.at < 2000) {
        return
      }

      lastShownRef.current = { key, at: now }

      if (item.type === 'error') {
        queueRef.current.unshift(item)
      } else {
        queueRef.current.push(item)
      }

      if (queueRef.current.length > 2) {
        queueRef.current = queueRef.current.slice(0, 2)
      }

      if (visible) {
        dismiss()
        return
      }

      const next = queueRef.current.shift()
      if (next) {
        showItem(next)
      }
    },
    [dismiss, showItem, visible],
  )

  const api = useMemo(
    () => ({
      push,
      success: (message, opts = {}) => push({ type: 'success', message, ...opts }),
      info: (message, opts = {}) => push({ type: 'info', message, ...opts }),
      warning: (message, opts = {}) => push({ type: 'warning', message, ...opts }),
      error: (message, opts = {}) => push({ type: 'error', message, ...opts }),
    }),
    [push],
  )

  useEffect(() => {
    registerToastApi(api)
    return () => unregisterToastApi()
  }, [api])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? (
        <Toast
          actionLabel={current.actionLabel}
          bottomOffset={bottomOffset}
          message={current.message}
          onAction={current.onAction}
          onDismiss={dismiss}
          reduceMotion={reduceMotion}
          type={current.type}
          visible={visible}
        />
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return ctx
}

export { pushToast }
