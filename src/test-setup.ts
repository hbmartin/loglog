/**
 * Installs a localStorage when Node's own stub has shadowed jsdom's.
 *
 * Node >= 24 defines `globalThis.localStorage` itself, and it evaluates to
 * `undefined` unless the process was started with `--localstorage-file`.
 * Vitest's jsdom environment copies a window property onto the global only
 * when the global does not already have one, so that stub wins and jsdom's
 * real Storage is never installed - every component test that touches storage
 * then throws on `undefined`. Node 22 has no such global, which is why CI
 * stayed green while `pnpm test` failed on any current Node.
 *
 * Reaching jsdom's own Storage is not an option: vitest points both `window`
 * and `document.defaultView` at the global object, so the window that owns it
 * is unreachable from here. This covers the whole interface instead, and only
 * stands in when the real one is missing.
 */
class MemoryStorage implements Storage {
  #entries = new Map<string, string>();

  get length(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
  }

  getItem(key: string): string | null {
    return this.#entries.get(String(key)) ?? null;
  }

  key(index: number): string | null {
    return [...this.#entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#entries.delete(String(key));
  }

  // Storage stringifies both halves of the pair, and code that round-trips a
  // non-string through it must see the same value back here as in a browser.
  setItem(key: string, value: string): void {
    this.#entries.set(String(key), String(value));
  }
}

if (typeof document !== "undefined" && typeof localStorage === "undefined") {
  // defineProperty, not assignment: Node's stub is a getter, so assigning to
  // it throws in a module's strict mode.
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
