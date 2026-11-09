import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['client/tests/setup.js'],
    include: ['client/tests/**/*.test.{js,jsx}'],
    exclude: ['client/tests/e2e/**', 'node_modules/**'],
    // Only the wallet styles are loaded, so tests can check truncation and the reduced-motion rule.
    css: { include: [/wallet\.css$/] },
  },
});
