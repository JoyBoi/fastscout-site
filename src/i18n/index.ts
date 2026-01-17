import en from './en';
import fr from './fr';
import nl from './nl';

export const locales = ['fr', 'en', 'nl'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

const translations = { en, fr, nl } as const;

export function useTranslations(locale: Locale) {
  return translations[locale];
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, locale] = url.pathname.split('/');
  if (locales.includes(locale as Locale)) return locale as Locale;
  return defaultLocale;
}

export function getLocalizedPath(path: string, locale: Locale): string {
  // Remove any existing locale prefix
  const cleanPath = path.replace(/^\/(fr|en|nl)/, '') || '/';
  return `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
}
