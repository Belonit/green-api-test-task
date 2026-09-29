import type { Chat, ChatAction, ChatState } from './types/chat'

export const initialChatState: ChatState = { chats: [], selectedChatId: null }

function updateChat(
  state: ChatState,
  chatId: string,
  update: (chat: Chat) => Chat,
): ChatState {
  return {
    ...state,
    chats: state.chats.map((chat) =>
      chat.id === chatId ? update(chat) : chat,
    ),
  }
}

type ActionStrategies = {
  [Type in ChatAction['type']]: (
    state: ChatState,
    action: Extract<ChatAction, { type: Type }>,
  ) => ChatState
}

const actionStrategies: ActionStrategies = {
  reset: () => initialChatState,

  'open-chat': (state, action) => {
    const existingChat = state.chats.find((chat) => chat.id === action.chat.id)

    return {
      chats: existingChat
        ? state.chats.map((chat) =>
            chat.id === action.chat.id ? { ...chat, unread: 0 } : chat,
          )
        : [
            { ...action.chat, messages: [], draft: '', unread: 0 },
            ...state.chats,
          ],
      selectedChatId: action.chat.id,
    }
  },

  'select-chat': (state, action) => ({
    chats: state.chats.map((chat) =>
      chat.id === action.chatId ? { ...chat, unread: 0 } : chat,
    ),
    selectedChatId: action.chatId,
  }),

  'set-draft': (state, action) =>
    updateChat(state, action.chatId, (chat) => ({
      ...chat,
      draft: action.draft,
    })),

  'add-outgoing': (state, action) =>
    updateChat(state, action.chatId, (chat) => ({
      ...chat,
      draft: '',
      messages: [...chat.messages, action.message],
    })),

  'mark-outgoing': (state, action) =>
    updateChat(state, action.chatId, (chat) => ({
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === action.localId
          ? {
              ...message,
              status: action.status,
              remoteId: action.remoteId,
              error: action.error,
            }
          : message,
      ),
    })),

  'add-incoming': (state, action) => {
    const existing = state.chats.find((chat) => chat.id === action.chatId)

    if (
      existing?.messages.some(
        (message) => message.remoteId === action.message.remoteId,
      )
    ) {
      return state
    }

    if (existing) {
      return updateChat(state, action.chatId, (chat) => ({
        ...chat,
        messages: [...chat.messages, action.message],
        unread:
          state.selectedChatId === action.chatId //
            ? 0
            : chat.unread + 1,
      }))
    }

    return {
      ...state,
      chats: [
        {
          id: action.chatId,
          phoneNumber: action.phoneNumber,
          messages: [action.message],
          draft: '',
          unread: 1,
        },
        ...state.chats,
      ],
    }
  },
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  return actionStrategies[action.type](state, action as never)
}
