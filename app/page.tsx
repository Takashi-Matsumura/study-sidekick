'use client';

import { useState, useCallback, useRef } from 'react';
import { Settings, SettingsButton } from '@/components/Settings';
import { ChatInput, ChatInputRef } from '@/components/ChatInput';
import { ChatOutput } from '@/components/ChatOutput';
import { GraduationCapIcon } from '@/components/Icons';
import { LLMConfig, ChatMode, Message, SearchResult, PROVIDER_PRESETS } from '@/lib/types';

export default function Home() {
  // デフォルトはllama.cpp
  const llamaCppPreset = PROVIDER_PRESETS.find((p) => p.provider === 'llama-cpp')!;
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: llamaCppPreset.provider,
    baseUrl: llamaCppPreset.baseUrl,
    model: llamaCppPreset.defaultModel,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const chatInputRef = useRef<ChatInputRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    // AbortControllerを作成
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // ユーザーメッセージを追加
    setMessages((prev) => [...prev, { role: 'user', content: message }]);

    let searchResults: SearchResult[] = [];

    try {
      // 検索モードの場合は先に検索
      if (mode === 'search') {
        setStreamingContent('[検索中...]');
        const searchResponse = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: message, numResults: 3, fetchContent: true }),
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

      // LLMに送信（履歴を含める）
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode,
          llmConfig,
          searchResults: mode === 'search' ? searchResults : undefined,
          history: messages,
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
      focusInput();
    }
  }, [llmConfig, focusInput, messages]);

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
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
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
            />
          </div>

          {/* 右側：出力 */}
          <div className="flex-1 bg-white dark:bg-zinc-900 overflow-hidden">
            <ChatOutput
              messages={messages}
              isLoading={isLoading}
              streamingContent={streamingContent}
            />
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
        onChange={setLlmConfig}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
