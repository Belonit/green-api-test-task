import type { Chat, Message } from '@/types/chat'
import type { KeyboardEvent, SubmitEvent } from 'react'

import { messageSchema } from '@/api/greenApi.schemas'
import ArrowDownIcon from '@/assets/icons/arrow-down.svg?react'
import BackIcon from '@/assets/icons/back.svg?react'
import MessageIcon from '@/assets/icons/message.svg?react'
import SendIcon from '@/assets/icons/send.svg?react'
import { formatTime } from '@/utils/time'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type ConversationProps = {
  chat: Chat | null
  connectionStatus: 'connected' | 'retrying'
  onSelectChat: (chatId: string | null) => void
  onDraftChange: (chatId: string, draft: string) => void
  onSend: (chatId: string) => void
}

function MessageBubble({ message }: { message: Message }) {
  const { t } = useTranslation()
  const outgoing = message.direction === 'outgoing'
  const status = message.status
    ? t(`chat.messageStatus.${message.status}`)
    : null

  return (
    <div className={`message-row ${outgoing ? 'outgoing' : 'incoming'}`}>
      <article
        className={`message-bubble${message.status === 'failed' || message.status === 'unknown' ? ' message-problem' : ''}`}
      >
        <p>{message.text}</p>

        <div className="message-meta">
          <time>{formatTime(message.timestamp)}</time>
          {/* Отправляется… / Отправлено / Не отправлено / Результат неизвестен */}
          {status && <span>{status}</span>}
        </div>

        {message.error && (
          <small className="message-error">{message.error}</small>
        )}
      </article>
    </div>
  )
}

function MessageList({ chat }: { chat: Chat }) {
  const { t } = useTranslation()

  const scroller = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const [showNewButton, setShowNewButton] = useState(false)
  const lastMessageId = chat.messages.at(-1)?.id

  useLayoutEffect(() => {
    const node = scroller.current
    if (!node) {
      return
    }

    let showButton = false

    if (nearBottom.current) {
      node.scrollTop = node.scrollHeight
    } else if (lastMessageId) {
      showButton = true
    }

    const frame = requestAnimationFrame(() => setShowNewButton(showButton))

    return () => cancelAnimationFrame(frame)
  }, [lastMessageId])

  function handleScroll() {
    const node = scroller.current
    if (!node) {
      return
    }

    nearBottom.current =
      node.scrollHeight - node.scrollTop - node.clientHeight < 80
    if (nearBottom.current) {
      setShowNewButton(false)
    }
  }

  function scrollToBottom() {
    const node = scroller.current
    if (!node) {
      return
    }

    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    nearBottom.current = true
    setShowNewButton(false)
  }

  return (
    <div className="message-area">
      <div className="message-scroll" ref={scroller} onScroll={handleScroll}>
        {chat.messages.length === 0 ? (
          <div className="conversation-empty">
            <span>
              <MessageIcon />
            </span>

            {/* Начните разговор */}
            <strong>{t('chat.startConversation')}</strong>

            {/* Напишите первое сообщение в этот чат */}
            <p>{t('chat.firstMessage')}</p>
          </div>
        ) : (
          <div className="message-stack">
            {/* Сообщения этого сеанса */}
            <p className="history-note">{t('chat.sessionHistory')}</p>

            {chat.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {/* Новые сообщения */}
      {showNewButton && (
        <button
          className="new-messages-button"
          type="button"
          onClick={scrollToBottom}
        >
          <ArrowDownIcon />
          {t('chat.newMessages')}
        </button>
      )}
    </div>
  )
}

function MessageComposer({
  chat,
  onDraftChange,
  onSend,
}: {
  chat: Chat
  onDraftChange: ConversationProps['onDraftChange']
  onSend: ConversationProps['onSend']
}) {
  const { t } = useTranslation()
  const sending = chat.messages.some((message) => message.status === 'sending')
  const validation = messageSchema.safeParse(chat.draft)
  const tooLong = chat.draft.length > 4000

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending || !validation.success) {
      return
    }

    onSend(chat.id)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-input-wrap">
        {/* Сообщение */}
        <label className="sr-only" htmlFor="message-input">
          {t('chat.messageLabel')}
        </label>

        {/* Напишите сообщение… */}
        <textarea
          id="message-input"
          rows={1}
          placeholder={t('chat.messagePlaceholder')}
          value={chat.draft}
          aria-invalid={tooLong}
          aria-describedby={tooLong ? 'message-length-error' : undefined}
          onChange={(event) => onDraftChange(chat.id, event.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Отправить сообщение */}
        <button
          className="send-button"
          type="submit"
          aria-label={t('chat.sendMessage')}
          disabled={sending || !validation.success}
        >
          <SendIcon />
        </button>
      </div>

      <div className="composer-footer">
        {/* Не более 4000 символов / Enter — отправить · Shift+Enter — новая строка */}
        {tooLong ? (
          <span id="message-length-error" className="field-error">
            {t('validation.messageTooLong')}
          </span>
        ) : (
          <span>{t('chat.composerHint')}</span>
        )}

        {chat.draft.length > 3500 && <span>{chat.draft.length}/4000</span>}
      </div>
    </form>
  )
}

export function Conversation({
  chat,
  connectionStatus,
  onSelectChat,
  onDraftChange,
  onSend,
}: ConversationProps) {
  const { t } = useTranslation()

  if (!chat) {
    return (
      <section className="conversation conversation-placeholder">
        <div>
          <span className="placeholder-icon">
            <MessageIcon />
          </span>

          {/* Ваши диалоги здесь */}
          <h2>{t('chat.placeholderTitle')}</h2>

          {/* Выберите чат слева или начните новый разговор */}
          <p>{t('chat.placeholderHint')}</p>
        </div>
      </section>
    )
  }

  return (
    // Переписка: {{name}}
    <section
      className="conversation"
      aria-label={t('chat.conversationLabel', { name: `+${chat.phoneNumber}` })}
    >
      <header className="conversation-header">
        {/* К списку чатов */}
        <button
          className="icon-button mobile-back"
          type="button"
          aria-label={t('chat.backToChats')}
          onClick={() => onSelectChat(null)}
        >
          <BackIcon />
        </button>

        <div className="conversation-person">
          <strong>+{chat.phoneNumber}</strong>
        </div>

        {/* Восстанавливаем связь / Подключено */}
        <output
          className={`header-status${connectionStatus === 'retrying' ? ' reconnecting' : ''}`}
          aria-label={
            connectionStatus === 'retrying'
              ? t('chat.reconnectingShort')
              : t('chat.connected')
          }
        >
          <span aria-hidden="true" />
        </output>
      </header>

      <MessageList key={chat.id} chat={chat} />

      <MessageComposer
        chat={chat}
        onDraftChange={onDraftChange}
        onSend={onSend}
      />
    </section>
  )
}
