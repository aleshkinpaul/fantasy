import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let themeDocument: Document;

  beforeEach(() => {
    themeDocument = document.implementation.createHTMLDocument('Theme test');
  });

  it('uses the system preference when no choice is stored', () => {
    const service = new ThemeService(themeDocument, new MemoryStorage(), true);

    expect(service.snapshot).toBe('dark');
    expect(themeDocument.documentElement.dataset['theme']).toBe('dark');
  });

  it('restores a saved preference before the system preference', () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, 'light');

    const service = new ThemeService(themeDocument, storage, true);

    expect(service.snapshot).toBe('light');
    expect(themeDocument.documentElement.dataset['theme']).toBe('light');
  });

  it('toggles and persists the selected theme', () => {
    const storage = new MemoryStorage();
    const service = new ThemeService(themeDocument, storage, false);

    service.toggle();

    expect(service.snapshot).toBe('dark');
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(themeDocument.documentElement.dataset['theme']).toBe('dark');
  });

  it('keeps working when storage is unavailable', () => {
    const service = new ThemeService(themeDocument, new ThrowingStorage(), false);

    expect(() => service.toggle()).not.toThrow();
    expect(service.snapshot).toBe('dark');
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

class ThrowingStorage extends MemoryStorage {
  override getItem(_key: string): string | null { throw new Error('storage unavailable'); }
  override setItem(_key: string, _value: string): void { throw new Error('storage unavailable'); }
}
