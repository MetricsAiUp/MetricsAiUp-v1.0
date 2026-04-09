import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    root: './src',
    testTimeout: 10000,
    include: ['__tests__/**/*.test.js'],
    globals: true,
  },
});
