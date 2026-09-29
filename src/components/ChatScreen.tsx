import type { ChatSidebarProps } from './ChatSidebar'
import type { ConversationProps } from './Conversation'

import { ChatSidebar } from './ChatSidebar'
import { Conversation } from './Conversation'

type ChatScreenProps = ChatSidebarProps & Omit<ConversationProps, 'chat'>

export function ChatScreen(props: ChatScreenProps) {
  const selectedChat =
    props.chats.find((chat) => chat.id === props.selectedChatId) ?? null

  return (
    <main className={`chat-app${selectedChat ? ' has-selection' : ''}`}>
      <ChatSidebar {...props} />

      <Conversation
        chat={selectedChat}
        connectionStatus={props.connectionStatus}
        onSelectChat={props.onSelectChat}
        onDraftChange={props.onDraftChange}
        onSend={props.onSend}
      />
    </main>
  )
}
