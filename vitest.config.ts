import { defineConfig } from 'vitest/config';

/**
 * Unit-test config for the HealForge frontend.
 *
 * Deliberately separate from vite.config.ts: the production build uses the
 * React plugin and a dev proxy that tests do not need. These tests exercise
 * the typed API client and the DTO -> view mappers as pure modules against a
 * jsdom window (fetch is stubbed per-test).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Static analysis of source maps / unhandled fetch stubs is not relevant here.
    silent: 'passed-only',
  },
});
