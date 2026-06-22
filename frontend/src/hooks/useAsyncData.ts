import { useCallback, useEffect, useState } from 'react'

type AsyncState<T> = {
  data: T | null
  error: string | null
  loading: boolean
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))

    void loader()
      .then((data) => {
        if (!active) return
        setState({ data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          data: null,
          error: error instanceof Error ? error.message : 'Failed to load',
          loading: false,
        })
      })

    return () => {
      active = false
    }
  }, [loader, reloadToken])

  return { ...state, reload }
}
