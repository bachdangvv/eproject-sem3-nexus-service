import { useState, useRef, useEffect, useCallback } from 'react'

export function useToast(defaultDuration = 3000) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback(
    (message, type = 'success', duration = defaultDuration) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      setToast({ message, type, id: Date.now() })
      timerRef.current = setTimeout(() => {
        setToast(null)
      }, duration)
    },
    [defaultDuration]
  )

  const clearToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setToast(null)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { toast, showToast, clearToast }
}

