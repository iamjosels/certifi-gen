import type { ConfigStorage } from '../../application/ports';

export const CONFIG_STORAGE_KEY = 'certifica:last-config';

/**
 * Last configuration in localStorage (only the configuration, never files). Every access is
 * wrapped in try/catch: private windows, blocked storage or a full quota must not break the app.
 */
export function createLocalConfigStorage(
  storage: () => Storage = () => window.localStorage,
  key = CONFIG_STORAGE_KEY,
): ConfigStorage {
  return {
    load() {
      try {
        return storage().getItem(key);
      } catch {
        return null;
      }
    },
    save(json) {
      try {
        storage().setItem(key, json);
        return true;
      } catch {
        return false;
      }
    },
  };
}
