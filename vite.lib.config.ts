import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// Separate config for the library build (npm publishing).
// The Vercel demo builds with the plain `vite build` via vite.config.ts.
export default defineConfig({
  plugins: [react(), dts({ include: ['src/lib'] })],
  build: {
    lib: {
      entry: 'src/lib/index.ts',
      name: 'ClearTransform',
      formats: ['es', 'cjs'],
      fileName: (format) => `clear-transform.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    outDir: 'dist-lib',
  },
})
