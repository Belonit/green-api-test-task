import ru from './locales/ru-RU/index.json' with { type: 'json' }
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const defaultNS = 'translation'
export const resources = { 'ru-RU': { translation: ru } } as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'ru-RU',
  fallbackLng: 'ru-RU',
  supportedLngs: ['ru-RU'],
  defaultNS,
  initAsync: false,
  interpolation: { escapeValue: false },
})

export default i18n
