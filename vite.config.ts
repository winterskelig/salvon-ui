import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const src = (p: string) => path.resolve(import.meta.dirname, 'src', p)

export default defineConfig({
  root: 'playground',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@my\/package\/esixs$/, replacement: src('esixs/index.ts') },
      { find: /^@my\/package\/styles\.css$/, replacement: src('styles/theme.css') },
      { find: /^@my\/package$/, replacement: src('index.ts') },
    ],
  },
})
