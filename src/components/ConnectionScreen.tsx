import type { Credentials } from '@/api/greenApi.schemas'
import type { SubmitEvent } from 'react'

import { ConnectionLayout } from './ConnectionLayout'
import * as greenApi from '@/api/greenApi'
import { credentialsSchema } from '@/api/greenApi.schemas'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  initialCredentials?: Credentials
  onConnect: (credentials: Credentials) => Promise<void>
}

const defaultApiUrl = 'https://3100.api.green-api.com'

export function ConnectionScreen({ initialCredentials, onConnect }: Props) {
  const { t } = useTranslation()

  const [credentials, setCredentials] = useState<Credentials>({
    apiUrl: initialCredentials?.apiUrl ?? defaultApiUrl,
    idInstance: initialCredentials?.idInstance ?? '',
    apiTokenInstance: initialCredentials?.apiTokenInstance ?? '',
  })
  const [showToken, setShowToken] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateCredential(field: keyof Credentials, value: string) {
    setCredentials((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) {
      return
    }

    const result = credentialsSchema.safeParse(credentials)

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? t('connection.failed'))
      return
    }

    setError(null)
    setPending(true)

    try {
      await onConnect(result.data)
    } catch (cause) {
      setError(
        cause instanceof greenApi.ApiError
          ? cause.message
          : t('connection.failed'), // Не удалось подключиться. Повторите попытку.
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <ConnectionLayout
      titleId="connect-title"
      title={t('connection.title')}
      intro={t('connection.intro')}
    >
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="field">
          {/* Адрес API */}
          <label htmlFor="api-url">{t('connection.apiUrlLabel')}</label>

          {/* Введите адрес API */}
          <input
            id="api-url"
            type="url"
            autoComplete="url"
            placeholder={t('connection.apiUrlPlaceholder')}
            value={credentials.apiUrl}
            onChange={(event) => {
              updateCredential('apiUrl', event.target.value)
            }}
          />
        </div>

        <div className="field">
          {/* ID инстанса */}
          <label htmlFor="instance-id">{t('connection.instanceLabel')}</label>

          {/* Введите ID инстанса */}
          <input
            id="instance-id"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('connection.instancePlaceholder')}
            value={credentials.idInstance}
            onChange={(event) => {
              updateCredential('idInstance', event.target.value)
            }}
          />
        </div>

        <div className="field">
          {/* API-токен */}
          <label htmlFor="instance-token">{t('connection.tokenLabel')}</label>

          <div className="token-input">
            {/* Введите API-токен */}
            <input
              id="instance-token"
              type={showToken ? 'text' : 'password'}
              autoComplete="off"
              placeholder={t('connection.tokenPlaceholder')}
              value={credentials.apiTokenInstance}
              onChange={(event) => {
                updateCredential('apiTokenInstance', event.target.value)
              }}
            />

            {/* Скрыть токен / Показать токен */}
            <button
              type="button"
              className="token-toggle"
              onClick={() => setShowToken((value) => !value)}
              aria-label={
                showToken
                  ? t('connection.hideToken')
                  : t('connection.showToken')
              }
            >
              {/* Скрыть / Показать */}
              {showToken //
                ? t('connection.hide')
                : t('connection.show')}
            </button>
          </div>
        </div>

        <p className="form-error" role="alert">
          {error}
        </p>

        {/* Проверяем подключение… / Подключиться */}
        <button
          className="primary-button connect-submit"
          type="submit"
          disabled={pending}
        >
          {pending //
            ? t('connection.checking')
            : t('connection.connect')}
        </button>
      </form>

      {/* Данные и переписка хранятся только до обновления страницы. */}
      <p className="privacy-note">{t('connection.privacy')}</p>
    </ConnectionLayout>
  )
}
