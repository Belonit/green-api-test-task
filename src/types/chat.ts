export type Message = {
  id: string
  remoteId?: string
  text: string
  direction: 'incoming' | 'outgoing'
  timestamp: number
  status?: 'sending' | 'queued' | 'failed' | 'unknown'
  error?: string
}

export type Chat = {
  id: string
  phoneNumber: string
  messages: Message[]
  draft: string
  unread: number
}

export type ChatState = {
  chats: Chat[]
  selectedChatId: string | null
}

export type ChatAction =
  | { type: 'reset' }
  | { type: 'open-chat'; chat: Pick<Chat, 'id' | 'phoneNumber'> }
  | { type: 'select-chat'; chatId: string | null }
  | { type: 'set-draft'; chatId: string; draft: string }
  | { type: 'add-outgoing'; chatId: string; message: Message }
  | {
      type: 'mark-outgoing'
      chatId: string
      localId: string
      status: Message['status']
      remoteId?: string
      error?: string
    }
  | {
      type: 'add-incoming'
      chatId: string
      phoneNumber: string
      message: Message
    }
