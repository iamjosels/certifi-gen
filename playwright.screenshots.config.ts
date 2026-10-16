import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** `npm run screenshots`: captures the README screenshots from the production build. */
export default defineConfig({
  ...base,
  testDir: 'tests/screenshots',
  reporter: [['list']],
});
