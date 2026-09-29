import type { IncomingText } from '@/api/greenApi.schemas'
import type { Connection } from '@/types/connection'

import * as greenApi from '@/api/greenApi'
import i18n from '@/i18n'
import { useEffect } from 'react'

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      return resolve()
    }

    const timer = window.setTimeout(finish, ms)

    function finish() {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }

    signal.addEventListener('abort', finish, { once: true })
  })
}

export function useNotifications(
  connection: Connection | null,
  onIncoming: (message: IncomingText, sessionId: number) => void,
  onStatus: (
    status: 'connected' | 'retrying',
    sessionId: number,
    error?: string,
  ) => void,
): void {
  useEffect(() => {
    if (!connection) {
      return
    }

    const currentConnection = connection
    const controller = new AbortController()
    const { signal } = controller
    let failures = 0

    async function poll() {
      while (!signal.aborted) {
        try {
          const notification = await greenApi.receiveNotification(
            currentConnection,
            signal,
          )
          if (signal.aborted) {
            return
          }

          if (notification) {
            const incoming = greenApi.readIncomingText(notification.body)
            if (incoming) {
              onIncoming(incoming, currentConnection.sessionId)
            }

            await greenApi.deleteNotification(
              currentConnection,
              notification.receiptId,
              signal,
            )
          }

          failures = 0
          onStatus('connected', currentConnection.sessionId)
        } catch (error) {
          if (
            signal.aborted ||
            (error instanceof Error && error.name === 'AbortError')
          ) {
            return
          }

          failures += 1
          onStatus(
            'retrying',
            currentConnection.sessionId,
            error instanceof greenApi.ApiError
              ? error.message
              : i18n.t('app.pollFailed'), // Не удалось проверить настройки. Повторите попытку.
          )

          await pause(Math.min(failures * 2000, 10000), signal)
        }
      }
    }

    void poll()

    return () => controller.abort()
  }, [connection, onIncoming, onStatus])
}
