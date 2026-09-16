import { useEffect, useRef, useState } from 'react'
import { BookOpen, Library, Send, Settings, Trash2, X } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import { AiSettingsPanel } from './AiSettingsPanel'
import type { ChatMessage } from '@shared/types'

const ARTICLE_TEMPLATES = [
  { label: 'Summarize', prompt: 'Summarize this article.' },
  { label: 'Key Takeaways', prompt: 'What are the key takeaways from this article?' },
  {
    label: 'Explain Simply',
    prompt: 'Explain this article in simple terms, like I’m new to the topic.'
  }
]

const LIBRARY_TEMPLATES = [
  { label: 'Recent Saves', prompt: 'What have I saved recently?' },
  { label: 'Unread Summary', prompt: 'Summarize what my unread articles are about.' },
  { label: 'Find a Topic', prompt: 'Help me find an article I saved about a topic I’ll describe.' }
]

interface ArticleContext {
  id: string
  title: string
}

export function ChatPanel({
  articleContext,
  onOpenArticle
}: {
  articleContext: ArticleContext | null
  onOpenArticle?: (articleId: string) => void
}): React.JSX.Element | null {
  const {
    isOpen,
    scope,
    sessionsByKey,
    sending,
    error,
    closeChat,
    setScope,
    sendMessage,
    clearCurrentSession
  } = useChatStore()
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const key = scope.type === 'article' ? `article:${scope.articleId}` : 'all'
  const messages = sessionsByKey[key]?.messages ?? []

  // Keep an article-scoped chat pointed at whichever article is currently open.
  useEffect(() => {
    if (!isOpen || !articleContext) return
    if (scope.type === 'article' && scope.articleId !== articleContext.id) {
      setScope({ type: 'article', articleId: articleContext.id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleContext?.id, isOpen])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  if (!isOpen) return null

  function handleSend(): void {
    if (!input.trim() || sending) return
    void sendMessage(input)
    setInput('')
  }

  function handleTemplate(prompt: string): void {
    if (sending) return
    void sendMessage(prompt)
  }

  const templates = scope.type === 'article' ? ARTICLE_TEMPLATES : LIBRARY_TEMPLATES

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[560px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-base font-bold">Chat</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            title="AI settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={closeChat}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {showSettings ? (
        <AiSettingsPanel onBack={() => setShowSettings(false)} />
      ) : (
        <>
          <div className="flex items-center gap-1.5 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
            {articleContext && (
              <button
                onClick={() => setScope({ type: 'article', articleId: articleContext.id })}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium ${
                  scope.type === 'article'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <BookOpen className="h-3 w-3" />
                This Article
              </button>
            )}
            <button
              onClick={() => setScope({ type: 'all' })}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium ${
                scope.type === 'all'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Library className="h-3 w-3" />
              All Articles
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => void clearCurrentSession()}
                className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                title="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  {scope.type === 'article'
                    ? `Ask about "${articleContext?.title ?? 'this article'}".`
                    : 'Ask about anything in your saved articles.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => handleTemplate(t.prompt)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onOpenArticle={onOpenArticle} />
            ))}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask a question…"
                rows={1}
                className="max-h-32 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MessageBubble({
  message,
  onOpenArticle
}: {
  message: ChatMessage
  onOpenArticle?: (articleId: string) => void
}): React.JSX.Element {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-indigo-500 text-white'
            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
        }`}
      >
        {message.content || (
          <span className="inline-flex gap-1 opacity-50">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0.3s]" />
          </span>
        )}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-black/10 pt-2 dark:border-white/10">
            {message.citations.map((c) => (
              <button
                key={c.articleId}
                onClick={() => onOpenArticle?.(c.articleId)}
                className="rounded-full bg-white/60 px-2.5 py-1 text-xs font-medium text-slate-600 hover:underline dark:bg-black/20 dark:text-slate-300"
              >
                {c.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
