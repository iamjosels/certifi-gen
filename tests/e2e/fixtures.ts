import { test as base, expect } from '@playwright/test';

/**
 * Every E2E test fails if the browser console shows an error or a warning
 * (including pdf.js "Warning:" messages that are logged with console.log).
 */
export const test = base.extend<{ consoleGuard: string[] }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        const type = message.type();
        const text = message.text();
        if (type === 'error' || type === 'warning' || text.startsWith('Warning:')) {
          problems.push(`[${type}] ${text}`);
        }
      });
      page.on('pageerror', (error) => {
        problems.push(`[pageerror] ${error.message}`);
      });
      await use(problems);
      expect(problems, 'browser console must stay clean').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
