import { createRoot } from 'react-dom/client'
import { Toggle } from '@salvon-ui'
import '@salvon/ui/styles.css'

createRoot(document.getElementById('root')!).render(
  <Toggle onPressedChange={console.log}>Bold</Toggle>,
)
