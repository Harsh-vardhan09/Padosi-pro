import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.ts'],
      // Entrypoint and seed script: process wiring, exercised by `docker compose up`, not by tests.
      exclude: ['src/index.ts', 'src/db/seed.ts'],
    },
  },
});
