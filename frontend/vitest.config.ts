import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/api/**/*.ts',
        'src/hooks/**/*.{ts,tsx}',
        'src/utils/**/*.ts',
        'src/state/period.tsx',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/api/fixtures/**',
      ],
      thresholds: {
        lines: 85,
        branches: 70,
        functions: 80,
        statements: 85,
      },
    },
  },
})
