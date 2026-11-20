import type { ComponentPropsWithRef } from 'react'
import { useControllableState } from '../../utils/useControllableState'

export interface ToggleProps extends Omit<ComponentPropsWithRef<'button'>, 'onChange'> {
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
}

export function Toggle({ pressed, defaultPressed = false, onPressedChange, onClick, ...rest }: ToggleProps) {
  const [on, setOn] = useControllableState({
    value: pressed,
    defaultValue: defaultPressed,
    onChange: onPressedChange,
  })

  return (
    <button
      type="button"
      aria-pressed={on}
      data-state={on ? 'on' : 'off'}
      {...rest}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) setOn(!on)
      }}
    />
  )
}
