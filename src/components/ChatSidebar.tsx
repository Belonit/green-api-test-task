import type { Chat } from '@/types/chat'
import type { ConnectionStatus } from '@/types/connection'
import type { SubmitEvent } from 'react'

import { LogoMark } from './LogoMark'
import { PhoneInput } from './PhoneInput'
import * as greenApi from '@/api/greenApi'
import CloseIcon from '@/assets/icons/close.svg?react'
import LogoutIcon from '@/assets/icons/logout.svg?react'
import MessageIcon from '@/assets/icons/message.svg?react'
import PlusIcon from '@/assets/icons/plus.svg?react'
import { normalizePhone } from '@/utils/phone'
import { formatTime } from '@/utils/time'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export type ChatSidebarProps = {
  chats: Chat[]
  selectedChatId: string | null
  connectionStatus: ConnectionStatus
  connectionError: string | null
  onCreateChat: (phoneNumber: string) => Promise<void>
  onSelectChat: (chatId: string | null) => void
  onDisconnect: () => void
}

const statusClass: Record<ConnectionStatus, string> = {
  connected: '',
  retrying: ' reconnecting',
  error: ' error',
}

const statusLabel = {
  connected: 'chat.connectedInstance',
  retrying: 'chat.reconnecting',
  error: 'chat.connectionStopped',
} as const

function NewChatForm({
  onCreateChat,
}: {
  onCreateChat: ChatSidebarProps['onCreateChat']
}) {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) {
      return
    }

    const phone = normalizePhone(phoneInput)

    if (!phone) {
      setError(t('validation.phone')) // Введите полный номер РФ или РБ
      return
    }

    setError(null)
    setPending(true)

    try {
      await onCreateChat(phone)

      setPhoneInput('')
      setOpen(false)
    } catch (cause) {
      setError(
        cause instanceof greenApi.ApiError
          ? cause.message
          : t('chat.createFailed'), // Не удалось создать чат. Повторите попытку.
      )
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      // Новый чат
      <button
        className="new-chat-button"
        type="button"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        {t('chat.newChat')}
      </button>
    )
  }

  return (
    <form
      className="new-chat-form"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <div className="new-chat-head">
        {/* Новый чат */}
        <strong>{t('chat.newChat')}</strong>

        {/* Закрыть форму */}
        <button
          className="icon-button"
          type="button"
          aria-label={t('chat.closeForm')}
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Укажите номер человека в MAX */}
      <p>{t('chat.newChatHint')}</p>

      <PhoneInput
        value={phoneInput}
        error={error}
        onChange={(value) => {
          setPhoneInput(value)
          setError(null)
        }}
      />

      {/* Проверяем номер… / Открыть чат */}
      <button
        className="primary-button new-chat-submit"
        type="submit"
        disabled={pending}
      >
        {pending ? t('chat.checkingPhone') : t('chat.openChat')}
      </button>
    </form>
  )
}

function ChatListItem({
  chat,
  selected,
  onSelect,
}: {
  chat: Chat
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const lastMessage = chat.messages.at(-1)

  return (
    // Переписка: {{name}}
    // {{count}} новое сообщение / {{count}} новых сообщения / {{count}} новых сообщений
    <button
      className={`chat-item${selected ? ' selected' : ''}`}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${t('chat.conversationLabel', { name: `+${chat.phoneNumber}` })}${chat.unread > 0 ? `, ${t('chat.unread', { count: chat.unread })}` : ''}`}
    >
      <span className="chat-item-content">
        <span className="chat-item-top">
          <strong>+{chat.phoneNumber}</strong>
          {lastMessage && <time>{formatTime(lastMessage.timestamp)}</time>}
        </span>

        <span className="chat-item-bottom">
          {/* Начните переписку */}
          <span>{lastMessage?.text || t('chat.startCorrespondence')}</span>
          {chat.unread > 0 && <b>{chat.unread}</b>}
        </span>
      </span>
    </button>
  )
}

export function ChatSidebar({
  chats,
  selectedChatId,
  connectionStatus,
  connectionError,
  onCreateChat,
  onSelectChat,
  onDisconnect,
}: ChatSidebarProps) {
  const { t } = useTranslation()

  return (
    <aside className="chat-sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <LogoMark />
          <span>
            <strong>MAX Chat</strong>
            <small>GREEN-API</small>
          </span>
        </div>

        {/* Отключиться */}
        <button
          className="icon-button"
          type="button"
          title={t('chat.disconnect')}
          aria-label={t('chat.disconnect')}
          onClick={onDisconnect}
        >
          <LogoutIcon />
        </button>
      </div>

      <div className="sidebar-heading">
        <div>
          {/* Чаты */}
          <h1>{t('chat.chats')}</h1>
        </div>
        <span className="chat-count">{chats.length}</span>
      </div>

      <NewChatForm onCreateChat={onCreateChat} />

      {/* Список чатов */}
      <div className="sidebar-list" aria-label={t('chat.chatList')}>
        {chats.length === 0 ? (
          <div className="sidebar-empty">
            <span className="sidebar-empty-icon">
              <MessageIcon />
            </span>

            {/* Пока нет чатов */}
            <strong>{t('chat.noChats')}</strong>

            {/* Начните с номера получателя */}
            <p>{t('chat.noChatsHint')}</p>
          </div>
        ) : (
          chats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              selected={chat.id === selectedChatId}
              onSelect={() => onSelectChat(chat.id)}
            />
          ))
        )}
      </div>

      <output className={`connection-status${statusClass[connectionStatus]}`}>
        <span className="status-dot" />

        {/* Восстанавливаем соединение… / Инстанс подключён / Подключение остановлено */}
        <span>{connectionError ?? t(statusLabel[connectionStatus])}</span>
      </output>
    </aside>
  )
}
