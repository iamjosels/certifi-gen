import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../src/ui/store/app-store';

// jsdom does not implement object URLs.
let urlCounter = 0;
Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: vi.fn(() => `blob:test/${String(++urlCounter)}`),
});
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
});
