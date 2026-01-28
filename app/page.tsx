'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Settings, SettingsButton } from '@/components/Settings';
import { ChatInput, ChatInputRef } from '@/components/ChatInput';
import { ChatOutput } from '@/components/ChatOutput';
import { MetricsDisplay } from '@/components/MetricsDisplay';
import { GraduationCapIcon, DatabaseIcon } from '@/components/Icons';
import { LLMConfig, ChatMode, Message, SearchResult, RAGContext, PROVIDER_PRESETS, GenerationMetrics, SystemPrompts, SearchConfig, DEFAULT_SEARCH_CONFIG, AllProviderSettings, LLMProviderType } from '@/lib/types';
import { DEFAULT_SYSTEM_PROMPTS } from '@/lib/prompts';

const SYSTEM_PROMPTS_STORAGE_KEY = 'study-sidekick-system-prompts';
const LLM_CONFIG_STORAGE_KEY = 'study-sidekick-llm-config';
const SEARCH_CONFIG_STORAGE_KEY = 'study-sidekick-search-config';
const PROVIDER_SETTINGS_STORAGE_KEY = 'study-sidekick-provider-settings';

// トークン数推定（日本語混在テキスト用）
// 日本語: 約1.5文字/トークン、英語: 約4文字/トークン
// 混合の場合は約2文字/トークンとして推定
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // 日本語文字の割合を計算
  const japaneseChars = (text.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g) || []).length;
  const totalChars = text.length;
  const japaneseRatio = japaneseChars / totalChars;

  // 日本語が多い場合は1.5文字/トークン、英語が多い場合は4文字/トークン
  const avgCharsPerToken = japaneseRatio * 1.5 + (1 - japaneseRatio) * 4;
  return Math.ceil(totalChars / avgCharsPerToken);
}

// デフォルトのコンテキストウィンドウサイズ（多くのローカルLLMのデフォルト）
const DEFAULT_CONTEXT_WINDOW = 4096;

export default function Home() {
  // デフォルトはllama.cpp
  const llamaCppPreset = PROVIDER_PRESETS.find((p) => p.provider === 'llama-cpp')!;
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: llamaCppPreset.provider,
    baseUrl: llamaCppPreset.baseUrl,
    model: llamaCppPreset.defaultModel,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragCategory, setRagCategory] = useState('study');
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompts>(DEFAULT_SYSTEM_PROMPTS);
  const [searchConfig, setSearchConfig] = useState<SearchConfig>(DEFAULT_SEARCH_CONFIG);
  const [providerSettings, setProviderSettings] = useState<AllProviderSettings>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // localStorageからプロバイダー設定とLLM設定を読み込み
  useEffect(() => {
    // プロバイダーごとの設定を読み込み
    const savedProviderSettings = localStorage.getItem(PROVIDER_SETTINGS_STORAGE_KEY);
    if (savedProviderSettings) {
      try {
        const parsed = JSON.parse(savedProviderSettings);
        setProviderSettings(parsed);
      } catch {
        // 無効なJSONの場合は空のオブジェクトを使用
      }
    }

    // 現在のLLM設定を読み込み
    const savedLlmConfig = localStorage.getItem(LLM_CONFIG_STORAGE_KEY);
    if (savedLlmConfig) {
      try {
        const parsed = JSON.parse(savedLlmConfig);
        // URLの前後の空白を除去
        setLlmConfig({
          ...parsed,
          baseUrl: parsed.baseUrl?.trim() || parsed.baseUrl,
        });
      } catch {
        // 無効なJSONの場合はデフォルトを使用
      }
    }
  }, []);

  // localStorageからシステムプロンプトを読み込み
  useEffect(() => {
    const saved = localStorage.getItem(SYSTEM_PROMPTS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 保存されたプロンプトとデフォルトをマージ（新しいキーが追加された場合に対応）
        setSystemPrompts({
          ...DEFAULT_SYSTEM_PROMPTS,
          ...parsed,
        });
      } catch {
        // 無効なJSONの場合はデフォルトを使用
      }
    }
  }, []);

  // localStorageから検索設定を読み込み
  useEffect(() => {
    const saved = localStorage.getItem(SEARCH_CONFIG_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSearchConfig({
          ...DEFAULT_SEARCH_CONFIG,
          ...parsed,
        });
      } catch {
        // 無効なJSONの場合はデフォルトを使用
      }
    }
  }, []);

  // LLM設定が変更されたらlocalStorageに保存
  const handleLlmConfigChange = useCallback((config: LLMConfig, previousProvider?: LLMProviderType) => {
    // URLの前後の空白を除去
    const cleanedConfig = {
      ...config,
      baseUrl: config.baseUrl.trim(),
    };
    setLlmConfig(cleanedConfig);
    localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(cleanedConfig));

    // プロバイダーごとの設定を保存
    setProviderSettings(prev => {
      const newSettings = {
        ...prev,
        [cleanedConfig.provider]: {
          baseUrl: cleanedConfig.baseUrl,
          model: cleanedConfig.model,
          apiKey: cleanedConfig.apiKey,
          contextSize: cleanedConfig.contextSize,
        },
      };
      localStorage.setItem(PROVIDER_SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // プロバイダー切り替え時に保存済み設定を取得
  const getProviderConfig = useCallback((provider: LLMProviderType): LLMConfig => {
    const savedSettings = providerSettings[provider];
    const preset = PROVIDER_PRESETS.find(p => p.provider === provider);

    if (savedSettings) {
      // 保存済み設定がある場合はそれを使用
      return {
        provider,
        baseUrl: savedSettings.baseUrl,
        model: savedSettings.model,
        apiKey: savedSettings.apiKey,
        contextSize: savedSettings.contextSize,
      };
    } else if (preset) {
      // プリセットを使用
      return {
        provider,
        baseUrl: preset.baseUrl,
        model: preset.defaultModel,
      };
    }

    // フォールバック
    return {
      provider,
      baseUrl: '',
      model: '',
    };
  }, [providerSettings]);

  // システムプロンプトが変更されたらlocalStorageに保存
  const handleSystemPromptsChange = useCallback((prompts: SystemPrompts) => {
    setSystemPrompts(prompts);
    localStorage.setItem(SYSTEM_PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
  }, []);

  // 検索設定が変更されたらlocalStorageに保存
  const handleSearchConfigChange = useCallback((config: SearchConfig) => {
    setSearchConfig(config);
    localStorage.setItem(SEARCH_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, []);
  const [streamingContent, setStreamingContent] = useState('');
  const [metrics, setMetrics] = useState<GenerationMetrics>({
    contextWindowSize: DEFAULT_CONTEXT_WINDOW,
    inputTokens: 0,
    outputTokens: 0,
    contextUsagePercent: 0,
    tokensPerSecond: 0,
    totalTimeMs: 0,
    isGenerating: false,
  });

  // llmConfig.contextSizeが変更されたらメトリクスを更新
  useEffect(() => {
    const contextSize = llmConfig.contextSize || DEFAULT_CONTEXT_WINDOW;
    setMetrics(prev => ({
      ...prev,
      contextWindowSize: contextSize,
      contextUsagePercent: ((prev.inputTokens + prev.outputTokens) / contextSize) * 100,
    }));
  }, [llmConfig.contextSize]);

  const chatInputRef = useRef<ChatInputRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationStartTimeRef = useRef<number>(0);
  const lastTokenCountRef = useRef<number>(0);
  const lastTokenTimeRef = useRef<number>(0);

  const focusInput = useCallback(() => {
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
  }, []);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // 現在のストリーミング内容をメッセージとして保存（中断された場合）
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: streamingContent + '\n\n[中断されました]' },
      ]);
    }
    setIsLoading(false);
    setStreamingContent('');
    focusInput();
  }, [streamingContent, focusInput]);

  const handleSubmit = useCallback(async (message: string, mode: ChatMode | null) => {
    setIsLoading(true);
    setStreamingContent('');

    // メトリクスを初期化
    const historyTokens = messages.reduce((sum, msg) => sum + estimateTokenCount(msg.content), 0);
    const inputTokens = estimateTokenCount(message) + historyTokens;
    generationStartTimeRef.current = Date.now();
    lastTokenCountRef.current = 0;
    lastTokenTimeRef.current = Date.now();

    setMetrics(prev => ({
      ...prev,
      inputTokens,
      outputTokens: 0,
      contextUsagePercent: (inputTokens / prev.contextWindowSize) * 100,
      tokensPerSecond: 0,
      totalTimeMs: 0,
      isGenerating: true,
    }));

    // AbortControllerを作成
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // ユーザーメッセージを追加
    setMessages((prev) => [...prev, { role: 'user', content: message }]);

    let searchResults: SearchResult[] = [];
    let ragContext: RAGContext[] = [];

    try {
      // 検索モードの場合は先に検索
      if (mode === 'search') {
        setStreamingContent('[検索中...]');
        const searchResponse = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: message,
            numResults: 3,
            fetchContent: true,
            searchConfig,
          }),
          signal,
        });

        const searchData = await searchResponse.json();
        if (searchData.error) {
          throw new Error(searchData.error);
        }
        searchResults = searchData.results;

        if (searchResults.length === 0) {
          throw new Error('検索結果が見つかりませんでした');
        }

        setStreamingContent('[要約を作成中...]');
      }

      // RAGが有効な場合はナレッジベースを検索（モードに関係なく）
      if (ragEnabled) {
        setStreamingContent('[ナレッジベース検索中...]');
        const ragResponse = await fetch('/api/rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: message,
            topK: 5,
            threshold: 0.3,
            category: ragCategory || undefined,
          }),
          signal,
        });

        const ragData = await ragResponse.json();
        if (ragData.error) {
          throw new Error(ragData.error);
        }

        // カテゴリが指定されている場合はフィルタリング
        const allContext = ragData.context || [];
        if (ragCategory) {
          ragContext = allContext.filter(
            (ctx: RAGContext) => ctx.metadata.category === ragCategory
          );
        } else {
          ragContext = allContext;
        }

        setStreamingContent('[回答を生成中...]');
      }

      // LLMに送信（履歴を含める）
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode,
          llmConfig,
          searchResults: mode === 'search' ? searchResults : undefined,
          ragContext: ragEnabled && ragContext.length > 0 ? ragContext : undefined,
          history: messages,
          systemPrompts,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'LLM接続エラー');
      }

      // ストリーミングレスポンスを処理
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('レスポンスの読み取りに失敗しました');
      }

      const decoder = new TextDecoder();
      let content = '';

      while (true) {
        // 中断チェック
        if (signal.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || line === 'data: [DONE]') continue;
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.content) {
              content += data.content;
              setStreamingContent(content);

              // メトリクスを更新
              const currentTime = Date.now();
              const outputTokens = estimateTokenCount(content);
              const elapsedMs = currentTime - generationStartTimeRef.current;

              // 直近のトークン/秒を計算（スムージング）
              const timeSinceLastUpdate = currentTime - lastTokenTimeRef.current;
              const tokensSinceLastUpdate = outputTokens - lastTokenCountRef.current;

              if (timeSinceLastUpdate > 100) { // 100ms以上経過したら更新
                const recentTokensPerSecond = (tokensSinceLastUpdate / timeSinceLastUpdate) * 1000;
                lastTokenCountRef.current = outputTokens;
                lastTokenTimeRef.current = currentTime;

                setMetrics(prev => ({
                  ...prev,
                  outputTokens,
                  contextUsagePercent: ((prev.inputTokens + outputTokens) / prev.contextWindowSize) * 100,
                  tokensPerSecond: recentTokensPerSecond,
                  totalTimeMs: elapsedMs,
                }));
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // 中断されていなければメッセージを追加
      if (!signal.aborted) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content,
            sources: mode === 'search' ? searchResults : undefined,
            ragSources: ragEnabled && ragContext.length > 0 ? ragContext : undefined,
          },
        ]);
      }
    } catch (error) {
      // 中断による例外は無視
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `[エラー] エラーが発生しました\n\n**原因**: ${errorMessage}\n\n**解決方法**:\n- LLMが起動しているか確認してください\n- 接続URLが正しいか確認してください\n- ネットワーク接続を確認してください`,
        },
      ]);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setStreamingContent('');

      // メトリクスの最終更新
      const finalTime = Date.now() - generationStartTimeRef.current;
      setMetrics(prev => ({
        ...prev,
        totalTimeMs: finalTime,
        isGenerating: false,
        // 平均トークン/秒を計算
        tokensPerSecond: finalTime > 0 ? (prev.outputTokens / finalTime) * 1000 : 0,
      }));

      focusInput();
    }
  }, [llmConfig, focusInput, messages, ragCategory, ragEnabled, systemPrompts, searchConfig]);

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* ヘッダー */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <GraduationCapIcon className="w-6 h-6" />
            Study Sidekick
          </h1>
          <div className="flex items-center gap-2">
            {ragEnabled && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium">
                <DatabaseIcon className="w-3.5 h-3.5" />
                RAG
              </div>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setMetrics({
                    contextWindowSize: llmConfig.contextSize || DEFAULT_CONTEXT_WINDOW,
                    inputTokens: 0,
                    outputTokens: 0,
                    contextUsagePercent: 0,
                    tokensPerSecond: 0,
                    totalTimeMs: 0,
                    isGenerating: false,
                  });
                }}
                className="text-xs px-3 py-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                クリア
              </button>
            )}
            <SettingsButton onClick={() => setSettingsOpen(true)} />
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 flex overflow-hidden">
        <div className="max-w-7xl mx-auto w-full flex">
          {/* 左側：入力 */}
          <div className="w-[400px] border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col">
            <ChatInput
              ref={chatInputRef}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              onCancel={handleCancel}
              ragEnabled={ragEnabled}
              searchConfig={searchConfig}
            />
          </div>

          {/* 右側：出力 */}
          <div className="flex-1 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden">
              <ChatOutput
                messages={messages}
                isLoading={isLoading}
                streamingContent={streamingContent}
              />
            </div>
            {/* チャットエリアのフッター：メトリクス表示 */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 flex justify-center">
              <MetricsDisplay metrics={metrics} />
            </div>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-4 py-2">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
          ローカルLLM（LM Studio / Ollama / llama.cpp）を使用 • データは外部に送信されません
        </p>
      </footer>

      {/* 設定モーダル */}
      <Settings
        config={llmConfig}
        onChange={handleLlmConfigChange}
        getProviderConfig={getProviderConfig}
        ragEnabled={ragEnabled}
        onRagEnabledChange={setRagEnabled}
        ragCategory={ragCategory}
        onRagCategoryChange={setRagCategory}
        systemPrompts={systemPrompts}
        onSystemPromptsChange={handleSystemPromptsChange}
        searchConfig={searchConfig}
        onSearchConfigChange={handleSearchConfigChange}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
