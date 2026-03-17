/**
 * @file vitest.config.ts
 * @description Vitest configuration for the puzzle-book-generator monorepo.
 *
 * Test discovery covers all packages and apps.
 * Integration tests (requiring a live DB or external services) are tagged
 * with `@integration` in their describe block and excluded from CI runs
 * via the `exclude` pattern below.
 */

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'apps/*/client/src/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.test.ts',
    ],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.integration.test.ts',
        '**/index.ts',
        '**/__fixtures__/**',
        '**/dist/**',
      ],
    },
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@puzzle-book/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
      '@puzzle-book/puzzle-generator': resolve(__dirname, 'packages/puzzle-generator/src/index.ts'),
      '@puzzle-book/book-generator': resolve(__dirname, 'packages/book-generator/src/index.ts'),
      '@puzzle-book/content-db': resolve(__dirname, 'packages/content-db/src/index.ts'),
      // Test fixture alias — avoids fragile relative paths across package boundaries
      '@puzzle-book/test-fixtures': resolve(__dirname, 'packages/shared/src/__fixtures__/fixtures.ts'),
    },
  },
})
