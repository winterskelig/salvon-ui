import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const src = (p: string) => path.resolve(import.meta.dirname, 'src', p)

export default defineConfig({
  root: 'playground',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@salvon-ui\/esixs$/, replacement: src('esixs/index.ts') },
      { find: /^@salvon-ui\/styles\.css$/, replacement: src('styles/styles.css') },
      { find: /^@salvon-ui$/, replacement: src('index.ts') },
    ],
  },
})
