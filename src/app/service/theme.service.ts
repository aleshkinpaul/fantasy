import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'fr-fantasy.theme';

export const THEME_STORAGE = new InjectionToken<Storage | null>('Theme preference storage', {
  providedIn: 'root',
  factory: () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  },
});

export const PREFERS_DARK_THEME = new InjectionToken<boolean>('System dark theme preference', {
  providedIn: 'root',
  factory: () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches,
});

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly themeSubject: BehaviorSubject<AppTheme>;
  readonly theme$: Observable<AppTheme>;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(THEME_STORAGE) private readonly storage: Storage | null,
    @Inject(PREFERS_DARK_THEME) prefersDarkTheme: boolean,
  ) {
    const initialTheme = this.readStoredTheme() ?? (prefersDarkTheme ? 'dark' : 'light');
    this.themeSubject = new BehaviorSubject<AppTheme>(initialTheme);
    this.theme$ = this.themeSubject.asObservable();
    this.applyTheme(initialTheme);
  }

  get snapshot(): AppTheme {
    return this.themeSubject.value;
  }

  toggle(): void {
    this.setTheme(this.snapshot === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: AppTheme): void {
    if (theme === this.snapshot) return;

    this.applyTheme(theme);
    this.persistTheme(theme);
    this.themeSubject.next(theme);
  }

  private applyTheme(theme: AppTheme): void {
    this.document.documentElement.dataset['theme'] = theme;
  }

  private readStoredTheme(): AppTheme | null {
    try {
      const theme = this.storage?.getItem(THEME_STORAGE_KEY);
      return theme === 'light' || theme === 'dark' ? theme : null;
    } catch {
      return null;
    }
  }

  private persistTheme(theme: AppTheme): void {
    try {
      this.storage?.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme still works for the current session.
    }
  }
}
