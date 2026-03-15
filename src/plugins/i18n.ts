import { createI18n } from 'vue-i18n'
import en, { type MessageSchema } from '@/locales/en'
import pl from '@/locales/pl'

const LOCALE_STORAGE_KEY = 'myaiguide-locale'
export type SupportedLocale = 'en' | 'pl'

function loadLocale(): SupportedLocale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored === 'en' || stored === 'pl') return stored
  const browser = navigator.language.slice(0, 2).toLowerCase()
  return browser === 'pl' ? 'pl' : 'en'
}

export function saveLocale(locale: SupportedLocale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}

// Polish pluralization: 1 → form 0, 2-4 (not teens) → form 1, else → form 2
function polishPluralRule(choice: number): number {
  if (choice === 1) return 0
  const teen = choice % 100
  const last = choice % 10
  if (teen >= 12 && teen <= 14) return 2
  if (last >= 2 && last <= 4) return 1
  return 2
}

export const i18n = createI18n<[MessageSchema], SupportedLocale>({
  legacy: false,
  locale: loadLocale(),
  fallbackLocale: 'en',
  messages: { en, pl },
  pluralizationRules: {
    pl: polishPluralRule
  }
})
