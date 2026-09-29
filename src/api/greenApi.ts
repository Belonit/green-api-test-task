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
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function httpError(status: number, reason: string): ApiError {
  let message: string

  if (status === 401 || (status === 403 && !reason.includes('suspend'))) {
    message = i18n.t('api.credentials') // Проверьте ID инстанса и API-токен.
  } else if (status === 466) {
    message = i18n.t('api.chatLimit') // Достигнут лимит трёх чатов тарифа MAX Developer.
  } else if (reason.includes('custom webhook url')) {
    message = i18n.t('api.webhook') // Очистите webhookUrl в настройках инстанса и повторите попытку через минуту.
  } else if (reason.includes('suspend')) {
    message = i18n.t('api.accountRestricted') // Для аккаунта действуют ограничения на отправку.
  } else {
    message = i18n.t('api.http', { status }) // Ошибка API ({{status}}). Проверьте настройки и повторите попытку.
  }

  return new ApiError(message, 'http')
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
  } = {},
): Promise<unknown> {
  let response: Response

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
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }

    throw new ApiError(
      i18n.t('api.network'), // Нет доступа к API. Проверьте ваше подключение
      'network',
    )
  }

  const text = await response.text()
  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      throw new ApiError(
        i18n.t('api.invalidJson'), // API вернул ответ в неизвестном формате.
        'invalid-response',
      )
    }
  }

  if (!response.ok) {
    const reason =
      typeof data === 'object' && data !== null && 'reason' in data
        ? String(data.reason).toLowerCase()
        : ''

    throw httpError(response.status, reason)
  }

  return data
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

  return {
    chatId: value.senderData.chatId,
    phoneNumber: value.senderData.senderPhoneNumber?.toString(),
    idMessage: value.idMessage,
    text: value.messageData.textMessageData.textMessage,
    timestamp: value.timestamp * 1000,
  }
}
