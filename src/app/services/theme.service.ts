import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'sketchup_classic' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'melamipro_theme_mode';

  readonly themeMode = signal<ThemeMode>(this.getInitialTheme());

  readonly isClassic = computed(() => this.themeMode() === 'sketchup_classic');
  readonly isDark = computed(() => this.themeMode() === 'dark');

  private getInitialTheme(): ThemeMode {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(this.STORAGE_KEY) as ThemeMode | null;
      if (saved === 'sketchup_classic' || saved === 'dark') {
        return saved;
      }
    }
    // Default: Classic Light Studio (clean pearl-white and neutral gray)
    return 'sketchup_classic';
  }

  setTheme(mode: ThemeMode) {
    this.themeMode.set(mode);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(this.STORAGE_KEY, mode);
    }
  }

  toggleTheme() {
    const next = this.themeMode() === 'sketchup_classic' ? 'dark' : 'sketchup_classic';
    this.setTheme(next);
  }
}
