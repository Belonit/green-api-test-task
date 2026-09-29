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
    let pendingReceiptId: number | null = null
    let acknowledgementFailures = 0

    async function poll() {
      while (!signal.aborted) {
        try {
          let receivedNotification = false

          if (pendingReceiptId === null) {
            const notification = await greenApi.receiveNotification(
              currentConnection,
              signal,
            )
            if (signal.aborted) {
              return
            }

            if (notification) {
              receivedNotification = true
              const incoming = greenApi.readIncomingText(notification.body)
              if (incoming) {
                onIncoming(incoming, currentConnection.sessionId)
              }
              pendingReceiptId = notification.receiptId
            }
          }

          if (pendingReceiptId !== null) {
            await greenApi.deleteNotification(
              currentConnection,
              pendingReceiptId,
              signal,
            )
            pendingReceiptId = null
            acknowledgementFailures = 0
          }

          failures = 0
          onStatus('connected', currentConnection.sessionId)
          await pause(receivedNotification ? 150 : 500, signal)
        } catch (error) {
          if (
            signal.aborted ||
            (error instanceof Error && error.name === 'AbortError')
          ) {
            return
          }

          failures += 1
          if (pendingReceiptId !== null) {
            acknowledgementFailures += 1
            if (acknowledgementFailures >= 3) {
              // Сверяемся с очередью: DELETE мог выполниться, а ответ потеряться.
              pendingReceiptId = null
              acknowledgementFailures = 0
            }
          }
          onStatus(
            'retrying',
            currentConnection.sessionId,
            error instanceof greenApi.ApiError
              ? error.message
              : i18n.t('app.pollFailed'), // Не удалось проверить настройки. Повторите попытку.
          )

          await pause(
            Math.min(1_000 * 2 ** Math.min(failures - 1, 5), 30_000),
            signal,
          )
        }
      }
    }

    void poll()

    return () => controller.abort()
  }, [connection, onIncoming, onStatus])
}
