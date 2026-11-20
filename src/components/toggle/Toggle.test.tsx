import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from './Toggle'

test('toggles aria-pressed on click and keyboard', async () => {
  render(<Toggle>Bold</Toggle>)
  const btn = screen.getByRole('button', { name: 'Bold' })

  await userEvent.click(btn)
  expect(btn.getAttribute('aria-pressed')).toBe('true')

  await userEvent.keyboard('{Enter}')
  expect(btn.getAttribute('aria-pressed')).toBe('false')
})
