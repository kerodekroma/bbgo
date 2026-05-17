import { computed, Injectable, signal } from '@angular/core';
import type { Locale } from './translations';
import { TRANSLATIONS } from './translations';

const STORAGE_KEY = 'bbgo-locale';

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    // localStorage may be unavailable
  }
  return navigator.language.startsWith('es') ? 'es' : 'en';
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly locale = signal<Locale>(detectLocale());

  readonly t = computed(() => {
    const currentLocale = this.locale();
    const dict = TRANSLATIONS[currentLocale];
    return (key: string, params?: Record<string, string | number>): string => {
      const raw = dict[key];
      if (raw === undefined) return `[${key}]`;
      if (!params) return raw;
      return raw.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));
    };
  });

  switchLanguage(locale: Locale): void {
    this.locale.set(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // localStorage may be unavailable
    }
  }
}
