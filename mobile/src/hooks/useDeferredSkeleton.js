import { useEffect, useRef, useState } from 'react'

const SHOW_DELAY_MS = 150
const MIN_VISIBLE_MS = 400

export function useDeferredSkeleton(active) {
  const [visible, setVisible] = useState(false)
  const shownAtRef = useRef(null)

  useEffect(() => {
    if (!active) {
      if (!shownAtRef.current) {
        setVisible(false)
        return undefined
      }

      const elapsed = Date.now() - shownAtRef.current
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
      const timer = setTimeout(() => {
        setVisible(false)
        shownAtRef.current = null
      }, remaining)

      return () => clearTimeout(timer)
    }

    const timer = setTimeout(() => {
      shownAtRef.current = Date.now()
      setVisible(true)
    }, SHOW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [active])

  return visible
}
