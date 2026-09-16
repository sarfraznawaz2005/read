import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { ChatMessage, ChatScope } from '@shared/types'

function scopeKey(scope: ChatScope): string {
  return scope.type === 'article' ? `article:${scope.articleId}` : 'all'
}

interface ChatSession {
  sessionId: string
  messages: ChatMessage[]
}

interface ChatState {
  isOpen: boolean
  scope: ChatScope
  sessionsByKey: Record<string, ChatSession>
  streamingMessageId: string | null
  sending: boolean
  error: string | null
  openChat: (scope: ChatScope) => void
  closeChat: () => void
  setScope: (scope: ChatScope) => void
  sendMessage: (content: string) => Promise<void>
  clearCurrentSession: () => Promise<void>
}

function getOrCreateSession(state: ChatState, key: string): ChatSession {
  return state.sessionsByKey[key] ?? { sessionId: nanoid(), messages: [] }
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  scope: { type: 'all' },
  sessionsByKey: {},
  streamingMessageId: null,
  sending: false,
  error: null,

  openChat: (scope) => set({ isOpen: true, scope, error: null }),
  closeChat: () => set({ isOpen: false }),
  setScope: (scope) => set({ scope, error: null }),

  sendMessage: async (content) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const state = get()
    const key = scopeKey(state.scope)
    const session = getOrCreateSession(state, key)
    const userMessage: ChatMessage = { id: nanoid(), role: 'user', content: trimmed }

    set({
      sessionsByKey: {
        ...state.sessionsByKey,
        [key]: { ...session, messages: [...session.messages, userMessage] }
      },
      sending: true,
      error: null
    })

    try {
      const { messageId } = await window.api.ai.chat.send(session.sessionId, trimmed, state.scope)
      const withPlaceholder = get().sessionsByKey[key]
      const placeholder: ChatMessage = { id: messageId, role: 'assistant', content: '' }
      set({
        sessionsByKey: {
          ...get().sessionsByKey,
          [key]: { ...withPlaceholder, messages: [...withPlaceholder.messages, placeholder] }
        },
        streamingMessageId: messageId
      })
    } catch (error) {
      set({
        sending: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      })
    }
  },

  clearCurrentSession: async () => {
    const state = get()
    const key = scopeKey(state.scope)
    const session = state.sessionsByKey[key]
    if (session) await window.api.ai.chat.clear(session.sessionId)
    const rest = { ...state.sessionsByKey }
    delete rest[key]
    set({ sessionsByKey: rest, error: null })
  }
}))

function updateMessage(
  key: string,
  messageId: string,
  updater: (msg: ChatMessage) => ChatMessage
): void {
  const state = useChatStore.getState()
  const session = state.sessionsByKey[key]
  if (!session) return
  useChatStore.setState({
    sessionsByKey: {
      ...state.sessionsByKey,
      [key]: {
        ...session,
        messages: session.messages.map((m) => (m.id === messageId ? updater(m) : m))
      }
    }
  })
}

window.api.ai.chat.onChunk(({ sessionId, messageId, token }) => {
  const state = useChatStore.getState()
  const key = Object.keys(state.sessionsByKey).find(
    (k) => state.sessionsByKey[k].sessionId === sessionId
  )
  if (!key) return
  updateMessage(key, messageId, (msg) => ({ ...msg, content: msg.content + token }))
})

window.api.ai.chat.onComplete(({ sessionId, messageId, content, citations }) => {
  const state = useChatStore.getState()
  const key = Object.keys(state.sessionsByKey).find(
    (k) => state.sessionsByKey[k].sessionId === sessionId
  )
  useChatStore.setState({ sending: false, streamingMessageId: null })
  if (!key) return
  updateMessage(key, messageId, (msg) => ({ ...msg, content, citations }))
})

window.api.ai.chat.onError(({ sessionId, error }) => {
  const state = useChatStore.getState()
  const key = Object.keys(state.sessionsByKey).find(
    (k) => state.sessionsByKey[k].sessionId === sessionId
  )
  useChatStore.setState({ sending: false, streamingMessageId: null, error })
  if (!key) return
  const session = state.sessionsByKey[key]
  if (session) {
    // Drop the empty assistant placeholder — nothing streamed before the error.
    useChatStore.setState({
      sessionsByKey: {
        ...state.sessionsByKey,
        [key]: { ...session, messages: session.messages.filter((m) => m.content !== '') }
      }
    })
  }
})
