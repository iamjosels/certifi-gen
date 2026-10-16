import { describe, expect, it } from 'vitest';
import { CONFIG_STORAGE_KEY, createLocalConfigStorage } from './local-config-storage';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('createLocalConfigStorage', () => {
  it('saves and loads the configuration under its key', () => {
    const storage = memoryStorage();
    const config = createLocalConfigStorage(() => storage);
    expect(config.load()).toBeNull();
    expect(config.save('{"a":1}')).toBe(true);
    expect(storage.getItem(CONFIG_STORAGE_KEY)).toBe('{"a":1}');
    expect(config.load()).toBe('{"a":1}');
  });

  it('never throws when storage is unavailable or full', () => {
    const blocked = createLocalConfigStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(blocked.load()).toBeNull();
    expect(blocked.save('{}')).toBe(false);
    const quota = memoryStorage();
    quota.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    const full = createLocalConfigStorage(() => quota);
    expect(full.save('{}')).toBe(false);
  });
});
