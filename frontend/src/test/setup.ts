import { beforeEach } from "vitest";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
}

/** jsdom under Node 26 may leave localStorage undefined; keep a memory Storage for tests. */
export function ensureTestLocalStorage(): void {
  const current = globalThis.localStorage;
  if (current && typeof current.getItem === "function") return;
  Object.defineProperty(globalThis, "localStorage", {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

ensureTestLocalStorage();

beforeEach(() => {
  ensureTestLocalStorage();
  globalThis.localStorage.clear();
});
