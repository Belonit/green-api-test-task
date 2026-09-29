import { useTranslation } from 'react-i18next'

type Props = {
  value: string
  error?: string | null
  onChange: (value: string) => void
}

export function PhoneInput({ value, error, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className="field">
      {/* Номер получателя */}
      <label htmlFor="phone-number">{t('phone.label')}</label>

      <div className={`phone-control${error ? ' invalid' : ''}`}>
        {/* Введите номер телефона */}
        <input
          id="phone-number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t('phone.placeholder')}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'phone-error' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>

      {error && (
        <span className="field-error" id="phone-error">
          {error}
        </span>
      )}
    </div>
  )
}
