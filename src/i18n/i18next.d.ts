import type { defaultNS, resources } from './index'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    pluralSeparator: '.'
    resources: (typeof resources)['ru-RU']
  }
}
