import type { InstanceSettings } from '@/api/greenApi.schemas'

import { ConnectionLayout } from './ConnectionLayout'
import * as greenApi from '@/api/greenApi'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const autoCheckInterval = 2_000
const autoCheckDuration = 5 * 60_000

type Props = {
  idInstance: string
  settings: InstanceSettings
  onEnableIncoming: () => Promise<void>
  onCheck: () => Promise<void>
  onChangeCredentials: () => void
}

export function InstanceSettingsScreen({
  idInstance,
  settings,
  onEnableIncoming,
  onCheck,
  onChangeCredentials,
}: Props) {
  const { t } = useTranslation()

  const [pending, setPending] = useState<'enable' | 'check' | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoChecking, setAutoChecking] = useState(false)
  const autoCheckDeadline = useRef(0)
  const onCheckRef = useRef(onCheck)

  const needsIncoming = settings.incomingWebhook !== 'yes'

  useEffect(() => {
    onCheckRef.current = onCheck
  }, [onCheck])

  useEffect(() => {
    if (!autoChecking) {
      return
    }

    let active = true
    let timeout: ReturnType<typeof setTimeout> | undefined

    async function checkSettings() {
      if (!active) {
        return
      }

      setPending('check')
      setError(null)

      try {
        await onCheckRef.current()
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof greenApi.ApiError
              ? cause.message
              : t('setup.failed'), // Не удалось проверить настройки. Повторите попытку.
          )
        }
      } finally {
        if (active) {
          setPending(null)

          if (Date.now() >= autoCheckDeadline.current) {
            setAutoChecking(false)
          } else {
            timeout = setTimeout(() => void checkSettings(), autoCheckInterval)
          }
        }
      }
    }

    void checkSettings()

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [autoChecking, t])

  async function run(action: 'enable' | 'check') {
    if (pending) {
      return
    }

    setPending(action)
    setError(null)

    try {
      if (action === 'enable') {
        await onEnableIncoming()

        setSaved(true)
        autoCheckDeadline.current = Date.now() + autoCheckDuration
        setAutoChecking(true)
      } else {
        await onCheck()
      }
    } catch (cause) {
      setError(
        cause instanceof greenApi.ApiError //
          ? cause.message
          : t('setup.failed'), // Не удалось проверить настройки. Повторите попытку.
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <ConnectionLayout
      titleId="setup-title"
      title={t('setup.title')}
      intro={t('setup.intro')}
      status={
        /* Авторизация прошла успешно */
        <span className="setup-authorized">{t('setup.authorized')}</span>
      }
    >
      {/* Инстанс {{id}} */}
      <p className="setup-instance">
        {t('setup.instance', { id: idInstance })}
      </p>

      {/* У инстанса задан адрес для отправки уведомлений. Очистите webhookUrl в кабинете GREEN-API, если он не используется другой интеграцией. */}
      {settings.webhookUrl && (
        <p className="setup-issue">{t('setup.webhookUrl')}</p>
      )}

      {/* Получение уведомлений о входящих сообщениях выключено. */}
      {needsIncoming && !saved && (
        <p className="setup-issue">{t('setup.incomingDisabled')}</p>
      )}

      {/*
          Настройка сохранена. Проверяем её автоматически в течение 5 минут.
          Настройка сохранена. Можно проверить её вручную.
        */}
      {saved && (
        <output className="setup-saved">
          {t(autoChecking ? 'setup.autoChecking' : 'setup.settingsSaved')}
        </output>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="settings-actions">
        {/* Сохраняем настройки… / Включить входящие уведомления */}
        {needsIncoming && !settings.webhookUrl && !saved && (
          <button
            className="primary-button setup-submit"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void run('enable')}
          >
            {pending === 'enable'
              ? t('setup.savingSettings')
              : t('setup.enableIncoming')}
          </button>
        )}

        {/* Проверяем настройки… / Проверить настройки */}
        {(!saved || !autoChecking) && (
          <button
            className="settings-button"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void run('check')}
          >
            {pending === 'check' ? t('setup.checking') : t('setup.checkAgain')}
          </button>
        )}

        {/* Изменить данные подключения */}
        <button
          className="settings-back"
          type="button"
          disabled={Boolean(pending)}
          onClick={onChangeCredentials}
        >
          {t('setup.changeCredentials')}
        </button>
      </div>
    </ConnectionLayout>
  )
}
