import { useState, useEffect, useCallback, useRef } from 'react'

export function useAsyncResource(fetcher, deps = []) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const timer = setTimeout(() => {
      Promise.resolve()
        .then(() => fetcherRef.current())
        .then((result) => {
          if (!cancelled) {
            setData(result)
            setError(null)
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err?.message || 'Unable to load records. Please try again.')
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false)
          }
        })
    }, 160)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [...deps, reloadTick])

  return { data, setData, isLoading, error, reload }
}

