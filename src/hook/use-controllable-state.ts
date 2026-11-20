import { useCallback, useState } from 'react'

export function useControllableState<T>(opts: {
  value?: T
  defaultValue: T
  onChange?: (value: T) => void
}) {
  const [inner, setInner] = useState(opts.defaultValue)
  const controlled = opts.value !== undefined
  const value = controlled ? (opts.value as T) : inner

  const setValue = useCallback(
    (next: T) => {
      if (!controlled) setInner(next)
      opts.onChange?.(next)
    },
    [controlled, opts.onChange],
  )
  return [value, setValue] as const
}
