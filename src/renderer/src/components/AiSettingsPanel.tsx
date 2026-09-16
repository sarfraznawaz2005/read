import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, XCircle } from 'lucide-react'
import type { AiProviderType, AiSettings, EmbeddingModelStatusDto } from '@shared/types'

const PROVIDER_LABELS: Record<AiProviderType, string> = {
  opencode: 'OpenCode (free, no key)',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter'
}

export function AiSettingsPanel({ onBack }: { onBack: () => void }): React.JSX.Element {
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [modelsProvider, setModelsProvider] = useState<AiProviderType | null>(null)
  const [modelsFallbackReason, setModelsFallbackReason] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [embedStatus, setEmbedStatus] = useState<EmbeddingModelStatusDto | null>(null)
  const [reindexing, setReindexing] = useState(false)
  const [reindexResult, setReindexResult] = useState<string | null>(null)

  useEffect(() => {
    void window.api.ai.getSettings().then(setSettings)
    void window.api.ai.embeddingModel.getStatus().then(setEmbedStatus)
    return window.api.ai.embeddingModel.onStatus(setEmbedStatus)
  }, [])

  // Resetting the per-provider form fields when the provider changes is a plain
  // derived-state adjustment, not a sync with an external system — done during
  // render (React's documented pattern) rather than in an effect.
  const [formProvider, setFormProvider] = useState<AiProviderType | null>(null)
  if (settings && settings.provider !== formProvider) {
    setFormProvider(settings.provider)
    setApiKeyInput('')
    setTestResult(null)
  }

  // "Loading" is derived (models fetched vs. current provider) rather than a flag
  // set at the top of the effect — every setState here happens inside the .then
  // callback, once the external fetch actually answers.
  const loadingModels = settings !== null && settings.provider !== modelsProvider

  useEffect(() => {
    const provider = settings?.provider
    if (!provider) return
    window.api.ai.listModels(provider).then((result) => {
      setModels(result.models)
      setModelsProvider(provider)
      setModelsFallbackReason(
        result.isFallback ? (result.fallbackReason ?? 'Could not fetch a live model list.') : null
      )
    })
  }, [settings?.provider])

  async function selectProvider(provider: AiProviderType): Promise<void> {
    const updated = await window.api.ai.updateSettings({ provider, model: null })
    setSettings(updated)
  }

  async function saveApiKey(): Promise<void> {
    if (!settings || !apiKeyInput.trim()) return
    const patch =
      settings.provider === 'gemini'
        ? { geminiApiKey: apiKeyInput.trim() }
        : { openRouterApiKey: apiKeyInput.trim() }
    const updated = await window.api.ai.updateSettings(patch)
    setSettings(updated)
    setApiKeyInput('')
  }

  async function selectModel(model: string): Promise<void> {
    if (!settings) return
    const updated = await window.api.ai.updateSettings({ model })
    setSettings(updated)
  }

  async function testConnection(): Promise<void> {
    if (!settings) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.ai.testConnection(
        settings.provider,
        apiKeyInput.trim() || undefined,
        settings.model
      )
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  async function downloadEmbeddingModel(): Promise<void> {
    await window.api.ai.embeddingModel.download()
  }

  async function indexAllArticles(): Promise<void> {
    setReindexing(true)
    setReindexResult(null)
    try {
      const result = await window.api.ai.embeddingModel.reindexAll()
      setEmbedStatus(await window.api.ai.embeddingModel.getStatus())
      setReindexResult(
        result.success ? `Indexed ${result.indexed} article(s).` : 'Indexing failed — try again.'
      )
    } finally {
      setReindexing(false)
    }
  }

  if (!settings) {
    return <div className="p-6 text-xs text-slate-400">Loading settings…</div>
  }

  const hasSavedKey =
    settings.provider === 'gemini' ? settings.hasGeminiApiKey : settings.hasOpenRouterApiKey
  const needsKey = settings.provider !== 'opencode'

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 text-xs">
      <button
        onClick={onBack}
        className="mb-4 self-start text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
      >
        ← Back to chat
      </button>

      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Provider</h3>
        <div className="space-y-1.5">
          {(Object.keys(PROVIDER_LABELS) as AiProviderType[]).map((provider) => (
            <button
              key={provider}
              onClick={() => void selectProvider(provider)}
              className={`w-full rounded-lg border-2 px-3 py-2 text-left ${
                settings.provider === provider
                  ? 'border-indigo-500 bg-white dark:bg-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              {PROVIDER_LABELS[provider]}
            </button>
          ))}
        </div>
      </section>

      {needsKey && (
        <section className="mt-4 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">API key</h3>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={hasSavedKey ? '•••••••• (saved — enter to replace)' : 'Paste your API key'}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          {apiKeyInput.trim() && (
            <button
              onClick={() => void saveApiKey()}
              className="rounded-lg bg-indigo-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-600"
            >
              Save key
            </button>
          )}
        </section>
      )}

      <section className="mt-4 space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Model</h3>
        {loadingModels ? (
          <p className="text-slate-400">Loading models…</p>
        ) : (
          <select
            value={settings.model ?? ''}
            onChange={(e) => void selectModel(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="" disabled>
              Select a model…
            </option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {modelsFallbackReason && (
          <p className="flex items-start gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {modelsFallbackReason}
          </p>
        )}
        <button
          onClick={() => void testConnection()}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:border-slate-300 disabled:opacity-50 dark:border-slate-700"
        >
          {testing && <Loader2 className="h-3 w-3 animate-spin" />}
          Test connection
        </button>
        {testResult && (
          <p
            className={`flex items-center gap-1 ${testResult.success ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {testResult.success ? 'Connected successfully.' : testResult.error}
          </p>
        )}
      </section>

      <section className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Local search model
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          Needed for &ldquo;All Articles&rdquo; chat to search by meaning, not just keywords. Runs
          fully on your computer, about {embedStatus?.sizeMb ?? 90} MB.
        </p>
        {embedStatus?.status === 'ready' && (
          <p className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready — {embedStatus.indexedArticles}/{embedStatus.totalArticles} articles indexed
          </p>
        )}
        {embedStatus?.status === 'downloading' && (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${embedStatus.progress ?? 0}%` }}
              />
            </div>
            <p className="text-slate-500">{embedStatus.message}</p>
          </div>
        )}
        {(embedStatus?.status === 'not_downloaded' || embedStatus?.status === 'error') && (
          <button
            onClick={() => void downloadEmbeddingModel()}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-600"
          >
            <Download className="h-3.5 w-3.5" />
            Download model
          </button>
        )}
        {embedStatus?.status === 'error' && <p className="text-rose-600">{embedStatus.message}</p>}
        {embedStatus?.status === 'ready' && (
          <>
            <button
              onClick={() => void indexAllArticles()}
              disabled={reindexing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:border-slate-300 disabled:opacity-50 dark:border-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reindexing ? 'animate-spin' : ''}`} />
              {reindexing ? 'Indexing…' : 'Index All Articles'}
            </button>
            {reindexResult && <p className="text-slate-500 dark:text-slate-400">{reindexResult}</p>}
          </>
        )}
      </section>
    </div>
  )
}
