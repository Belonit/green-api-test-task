import type {
  Credentials,
  IncomingText,
  InstanceSettings,
  InstanceState,
} from './api/greenApi.schemas'
import type { Message } from './types/chat'
import type { Connection } from './types/connection'

type Screen =
  | { type: 'connection'; initialCredentials?: Credentials }
  | { type: 'settings'; credentials: Credentials; settings: InstanceSettings }
  | { type: 'chat'; connection: Connection }

import * as greenApi from './api/greenApi'
import { messageSchema } from './api/greenApi.schemas'
import { chatReducer, initialChatState } from './chatReducer'
import { ChatScreen } from './components/ChatScreen'
import { ConnectionScreen } from './components/ConnectionScreen'
import { InstanceSettingsScreen } from './components/InstanceSettingsScreen'
import { useNotifications } from './hooks/useNotifications'
import i18n from './i18n'
import { useCallback, useReducer, useRef, useState } from 'react'

const stateMessageKeys = {
  starting: 'app.state.starting', // Инстанс запускается. Подождите и повторите проверку.
  notAuthorized: 'app.state.notAuthorized', // Инстанс не авторизован. Завершите авторизацию в кабинете GREEN-API.
  pendingPassword: 'app.state.pendingPassword', // Для инстанса требуется пароль двухфакторной авторизации в кабинете GREEN-API.
  blocked: 'app.state.blocked', // Аккаунт MAX заблокирован. Проверьте состояние в кабинете GREEN-API.
  suspended: 'app.state.suspended', // Для аккаунта MAX действуют ограничения. Проверьте состояние в кабинете GREEN-API.
  authorized: null,
} as const

function stateMessage(state: InstanceState): string {
  const key = stateMessageKeys[state]

  return key ? i18n.t(key) : ''
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'connection' })

  const [connectionHealth, setConnectionHealth] = useState<{
    status: 'connected' | 'retrying'
    error: string | null
  }>({ status: 'connected', error: null })

  const [chatState, dispatch] = useReducer(chatReducer, initialChatState)
  const activeSession = useRef(0)
  const pendingSends = useRef(new Map<string, string>())

  const handleIncoming = useCallback(
    (incoming: IncomingText, sessionId: number) => {
      if (activeSession.current !== sessionId) {
        return
      }

      const phoneNumber = incoming.phoneNumber ?? incoming.chatId.split('@')[0]
      const message: Message = {
        id: incoming.idMessage,
        remoteId: incoming.idMessage,
        text: incoming.text,
        direction: 'incoming',
        timestamp: incoming.timestamp,
      }

      dispatch({
        type: 'add-incoming',
        chatId: incoming.chatId,
        phoneNumber,
        message,
      })
    },
    [],
  )

  const handlePollStatus = useCallback(
    (status: 'connected' | 'retrying', sessionId: number, error?: string) => {
      if (activeSession.current !== sessionId) {
        return
      }

      setConnectionHealth({ status, error: error ?? null })
    },
    [],
  )

  const connection = screen.type === 'chat' ? screen.connection : null

  useNotifications(connection, handleIncoming, handlePollStatus)

  async function connect(credentials: Credentials): Promise<void> {
    const state = await greenApi.getStateInstance(credentials)

    if (state !== 'authorized') {
      throw new greenApi.ApiError(
        stateMessage(state), //
        'http',
      )
    }

    const settings = await greenApi.getSettings(credentials)

    if (settings.webhookUrl || settings.incomingWebhook !== 'yes') {
      setScreen({ type: 'settings', credentials, settings })
      return
    }

    const sessionId = ++activeSession.current

    dispatch({ type: 'reset' })
    setConnectionHealth({ status: 'connected', error: null })
    setScreen({ type: 'chat', connection: { ...credentials, sessionId } })
  }

  function disconnect(): void {
    activeSession.current += 1
    pendingSends.current.clear()

    setScreen({ type: 'connection' })
    setConnectionHealth({ status: 'connected', error: null })
    dispatch({ type: 'reset' })
  }

  async function createChat(phoneNumber: string): Promise<void> {
    if (!connection) {
      return
    }

    const sessionId = connection.sessionId
    const existing = chatState.chats.find(
      (chat) => chat.phoneNumber === phoneNumber,
    )

    if (existing) {
      dispatch({ type: 'open-chat', chat: existing })
      return
    }

    const account = await greenApi.checkAccount(connection, phoneNumber)

    if (activeSession.current !== sessionId) {
      return
    }

    if (!account.exist) {
      throw new greenApi.ApiError(
        // На этом номере нет аккаунта MAX.
        i18n.t('app.noAccount'), //
        'http',
      )
    }

    dispatch({
      type: 'open-chat',
      chat: { id: account.chatId, phoneNumber },
    })
  }

  async function send(chatId: string): Promise<void> {
    if (!connection) {
      return
    }

    const chat = chatState.chats.find((item) => item.id === chatId)
    if (!chat || pendingSends.current.has(chatId)) {
      return
    }

    const validation = messageSchema.safeParse(chat.draft)
    if (!validation.success) {
      return
    }

    const text = validation.data
    const localId = crypto.randomUUID()
    const sessionId = connection.sessionId

    pendingSends.current.set(chatId, localId)
    dispatch({
      type: 'add-outgoing',
      chatId,
      message: {
        id: localId,
        text,
        direction: 'outgoing',
        timestamp: Date.now(),
        status: 'sending',
      },
    })

    try {
      const remoteId = await greenApi.sendMessage(connection, chatId, text)

      if (activeSession.current === sessionId) {
        dispatch({
          type: 'mark-outgoing',
          chatId,
          localId,
          status: 'queued',
          remoteId,
        })
      }
    } catch (error) {
      if (activeSession.current !== sessionId) {
        return
      }

      const knownFailure =
        error instanceof greenApi.ApiError && error.kind === 'http'

      dispatch({
        type: 'mark-outgoing',
        chatId,
        localId,
        status: knownFailure //
          ? 'failed'
          : 'unknown',
        error: knownFailure //
          ? error.message
          : i18n.t('app.uncertainSend'), // Ответ API не получен. Сообщение могло быть отправлено; проверьте чат перед повтором.
      })
    } finally {
      if (pendingSends.current.get(chatId) === localId) {
        pendingSends.current.delete(chatId)
      }
    }
  }

  if (screen.type === 'settings') {
    return (
      <InstanceSettingsScreen
        idInstance={screen.credentials.idInstance}
        settings={screen.settings}
        onEnableIncoming={() =>
          greenApi.enableIncomingNotifications(screen.credentials)
        }
        onCheck={() => connect(screen.credentials)}
        onChangeCredentials={() =>
          setScreen({
            type: 'connection',
            initialCredentials: screen.credentials,
          })
        }
      />
    )
  }

  if (screen.type === 'connection') {
    return (
      <ConnectionScreen
        initialCredentials={screen.initialCredentials}
        onConnect={connect}
      />
    )
  }

  return (
    <ChatScreen
      chats={chatState.chats}
      selectedChatId={chatState.selectedChatId}
      connectionStatus={connectionHealth.status}
      connectionError={connectionHealth.error}
      onCreateChat={createChat}
      onSelectChat={(chatId) => dispatch({ type: 'select-chat', chatId })}
      onDraftChange={(chatId, draft) =>
        dispatch({ type: 'set-draft', chatId, draft })
      }
      onSend={send}
      onDisconnect={disconnect}
    />
  )
}
