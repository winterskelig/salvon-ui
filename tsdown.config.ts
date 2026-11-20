import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    esixs: 'src/esixs/index.ts',
  },
  format: ['esm'],
  platform: 'neutral',
  dts: true,
  publint: true,
})
