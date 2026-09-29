import type {
  ApiNotification,
  Credentials,
  IncomingText,
  InstanceState,
} from './greenApi.schemas'
import type { ZodType } from 'zod'

import * as schemas from './greenApi.schemas'
import i18n from '@/i18n'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: 'network' | 'http' | 'invalid-response',
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function httpError(status: number, reason: string): ApiError {
  let message: string

  if (status === 401 || (status === 403 && !reason.includes('suspend'))) {
    message = i18n.t('api.credentials') // Проверьте ID инстанса и API-токен.
  } else if (status === 429) {
    message = i18n.t('api.rateLimit') // Слишком много запросов к GREEN-API. Повторяем позже.
  } else if (status === 466) {
    message = i18n.t('api.chatLimit') // Достигнут лимит трёх чатов тарифа MAX Developer.
  } else if (reason.includes('custom webhook url')) {
    message = i18n.t('api.webhook') // Очистите webhookUrl в настройках инстанса и повторите попытку через минуту.
  } else if (reason.includes('suspend')) {
    message = i18n.t('api.accountRestricted') // Для аккаунта действуют ограничения на отправку.
  } else {
    message = i18n.t('api.http', { status }) // Ошибка API ({{status}}). Проверьте настройки и повторите попытку.
  }

  return new ApiError(message, 'http', status)
}

function apiPath(credentials: Credentials, method: string): string {
  const id = encodeURIComponent(credentials.idInstance)
  const token = encodeURIComponent(credentials.apiTokenInstance)

  return `${credentials.apiUrl}/waInstance${id}/${method}/${token}`
}

async function request(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE'
    body?: unknown
    signal?: AbortSignal
    timeoutMs?: number
  } = {},
): Promise<unknown> {
  let response: Response
  let text: string
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000)
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout

  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers:
        options.body === undefined
          ? undefined
          : { 'Content-Type': 'application/json' },
      body:
        options.body === undefined //
          ? undefined
          : JSON.stringify(options.body),
      cache: 'no-store',
      signal,
    })
    text = await response.text()
  } catch {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    throw new ApiError(
      timeout.aborted //
        ? i18n.t('api.timeout') // GREEN-API не ответил вовремя. Проверьте соединение и повторите попытку.
        : i18n.t('api.network'), // Нет доступа к API. Проверьте ваше подключение
      'network',
    )
  }

  if (!response.ok) {
    let reason = ''
    try {
      const data: unknown = JSON.parse(text)
      if (typeof data === 'object' && data !== null && 'reason' in data) {
        reason = String(data.reason).toLowerCase()
      }
    } catch {
      // Статус HTTP важнее формата тела ошибки.
    }

    throw httpError(response.status, reason)
  }

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ApiError(
      i18n.t('api.invalidJson'), // API вернул ответ в неизвестном формате.
      'invalid-response',
    )
  }
}

function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    throw new ApiError(
      i18n.t('api.invalidData'), // API вернул данные в неизвестном формате.
      'invalid-response',
    )
  }

  return result.data
}

export async function getStateInstance(
  credentials: Credentials,
): Promise<InstanceState> {
  const data = await request(apiPath(credentials, 'getStateInstance'))

  return parse(schemas.stateSchema, data).stateInstance
}

export async function getSettings(credentials: Credentials) {
  const data = await request(apiPath(credentials, 'getSettings'))

  return parse(schemas.settingsSchema, data)
}

export async function enableIncomingNotifications(
  credentials: Credentials,
): Promise<void> {
  const data = await request(apiPath(credentials, 'setSettings'), {
    method: 'POST',
    body: { incomingWebhook: 'yes' },
  })

  if (!parse(schemas.savedSettingsSchema, data).saveSettings) {
    throw new ApiError(
      i18n.t('api.settingsNotSaved'), // Не удалось сохранить настройки инстанса. Повторите попытку.
      'http',
    )
  }
}

export async function checkAccount(
  credentials: Credentials,
  phoneNumber: string,
) {
  const data = parse(
    schemas.accountSchema,
    await request(
      apiPath(credentials, 'checkAccount'), //
      {
        method: 'POST',
        body: { phoneNumber: Number(phoneNumber) },
      },
    ),
  )

  if ('status' in data) {
    throw new ApiError(
      /starting|not authorized/i.test(data.reason)
        ? i18n.t('api.accountNotReady') // Инстанс ещё не готов. Проверьте авторизацию в кабинете GREEN-API.
        : i18n.t('api.accountCheck'), // Не удалось проверить номер. Повторите попытку позже.
      'http',
    )
  }

  return data
}

export async function sendMessage(
  credentials: Credentials,
  chatId: string,
  message: string,
): Promise<string> {
  const data = await request(
    apiPath(credentials, 'sendMessage'), //
    {
      method: 'POST',
      body: { chatId, message },
    },
  )

  return parse(schemas.sentSchema, data).idMessage
}

export async function receiveNotification(
  credentials: Credentials,
  signal: AbortSignal,
): Promise<ApiNotification | null> {
  const data = await request(
    `${apiPath(credentials, 'receiveNotification')}?receiveTimeout=5`,
    {
      signal,
      timeoutMs: 12_000,
    },
  )

  return data === null //
    ? null
    : parse(schemas.notificationSchema, data)
}

export async function deleteNotification(
  credentials: Credentials,
  receiptId: number,
  signal: AbortSignal,
): Promise<void> {
  const data = await request(
    `${apiPath(credentials, 'deleteNotification')}/${receiptId}`,
    {
      method: 'DELETE',
      signal,
    },
  )

  if (!parse(schemas.deletedSchema, data).result) {
    throw new ApiError(
      i18n.t('api.notificationAck'), // Не удалось подтвердить уведомление.
      'http',
    )
  }
}

export function readIncomingText(body: unknown): IncomingText | null {
  const result = schemas.incomingTextSchema.safeParse(body)
  if (!result.success) {
    return null
  }

  const value = result.data

  if (
    value.senderData.chatType === 'group' ||
    value.senderData.chatId.startsWith('-')
  ) {
    return null
  }

  return {
    chatId: value.senderData.chatId,
    phoneNumber: value.senderData.senderPhoneNumber?.toString(),
    idMessage: value.idMessage,
    text:
      value.messageData.typeMessage === 'textMessage'
        ? value.messageData.textMessageData.textMessage
        : value.messageData.extendedTextMessageData.text,
    timestamp: value.timestamp * 1_000,
  }
}
