import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // mongodb-memory-server-in ilk işə düşməsi bir neçə saniyə çəkə bilər
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
