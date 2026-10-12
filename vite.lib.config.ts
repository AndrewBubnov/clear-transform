import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// Отдельный конфиг для сборки библиотеки (npm-публикация).
// Демо для Vercel собирается обычным `vite build` через vite.config.ts.
export default defineConfig({
  plugins: [react(), dts({ include: ['src/lib'] })],
  build: {
    lib: {
      entry: 'src/lib/index.ts',
      name: 'ClearDraggable',
      formats: ['es', 'cjs'],
      fileName: (format) => `clear-draggable.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    outDir: 'dist-lib',
  },
})
