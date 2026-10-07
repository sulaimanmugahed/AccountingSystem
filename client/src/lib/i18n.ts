/**
 * i18next setup for the client.
 *
 * - English + Arabic, with automatic right-to-left flipping for Arabic.
 * - The chosen language is persisted in localStorage and restored on reload.
 * - `applyDirection()` keeps `<html lang dir>` in sync so Tailwind's logical
 *   utilities (margin/padding inline-start & inline-end, text-start/text-end)
 *   mirror the layout instead of hardcoding left/right.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '@/locales/en.json'
import ar from '@/locales/ar.json'

export const LANGUAGE_STORAGE_KEY = 'ledgerly.language'

export interface LanguageOption {
  code: string
  /** Endonym — shown in the switcher so speakers recognise their language. */
  label: string
  dir: 'ltr' | 'rtl'
  /** Intl locale used for money/date formatting (Latin digits, Gregorian calendar). */
  locale: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', dir: 'ltr', locale: 'en-US' },
  { code: 'ar', label: 'العربية', dir: 'rtl', locale: 'ar-u-ca-gregory-nu-latn' },
]

export function isRtlLanguage(code: string | undefined) {
  return LANGUAGE_OPTIONS_BY_CODE[baseCode(code)]?.dir === 'rtl'
}

function baseCode(code: string | undefined) {
  return (code ?? 'en').split('-')[0].toLowerCase()
}

const LANGUAGE_OPTIONS_BY_CODE = Object.fromEntries(LANGUAGES.map((language) => [language.code, language]))

export function currentLanguage(): LanguageOption {
  const detected = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  return LANGUAGE_OPTIONS_BY_CODE[baseCode(detected)] ?? LANGUAGES[0]
}

/** Locale string for Intl formatters (always Latin digits + Gregorian dates for Arabic). */
export function currentLocale() {
  return currentLanguage().locale
}

export function applyDirection(code?: string) {
  if (typeof document === 'undefined') return
  const language = LANGUAGE_OPTIONS_BY_CODE[baseCode(code ?? i18n.language)] ?? LANGUAGES[0]
  document.documentElement.lang = language.code
  document.documentElement.dir = language.dir
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    supportedLngs: ['en', 'ar'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  })

applyDirection()
i18n.on('languageChanged', (language) => applyDirection(language))

export default i18n
