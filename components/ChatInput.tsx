'use client';

import { useState, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ChatMode, CHAT_MODES, SearchConfig } from '@/lib/types';
import { ModeIcon } from './Icons';

interface ChatInputProps {
  onSubmit: (message: string, mode: ChatMode | null) => void;
  isLoading: boolean;
  onCancel?: () => void;
  ragEnabled?: boolean;
  searchConfig?: SearchConfig;
}

export interface ChatInputRef {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput(
  { onSubmit, isLoading, onCancel, ragEnabled = false, searchConfig },
  ref
) {
  // Braveが有効かどうかを判定
  const isBraveEnabled = searchConfig?.provider === 'brave' && !!searchConfig?.braveApiKey;
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<ChatMode>('explain');
  const [modeEnabled, setModeEnabled] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // RAGが有効な場合のみ'rag'モードを表示
  const availableModes = useMemo(() => {
    return CHAT_MODES.filter((m) => m.id !== 'rag' || ragEnabled);
  }, [ragEnabled]);

  // RAGが無効になった場合、ragモードから別のモードに切り替え
  // 派生状態として計算し、UIでこの値を使用する
  const effectiveMode = useMemo(() => {
    if (!ragEnabled && mode === 'rag') {
      return 'explain' as ChatMode;
    }
    return mode;
  }, [ragEnabled, mode]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    onSubmit(message.trim(), modeEnabled ? effectiveMode : null);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      if (!message.trim() || isLoading) return;
      onSubmit(message.trim(), modeEnabled ? effectiveMode : null);
      setMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* モード選択（縮小可能・スクロール対応） */}
      <div className="flex-shrink min-h-0 mb-4 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            モードを選択
          </label>
          <button
            type="button"
            onClick={() => setModeEnabled(!modeEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              modeEnabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                modeEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {modeEnabled ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* 通常表示: 縦並び / コンパクト表示: 2列グリッド */}
            <div className="mode-selector-grid">
              {availableModes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.description}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border transition-all ${
                    effectiveMode === m.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`flex-shrink-0 ${
                      m.id === 'search' && isBraveEnabled
                        ? 'text-orange-500 dark:text-orange-400'
                        : effectiveMode === m.id
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                    }`}>
                      <ModeIcon icon={m.icon} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium text-xs leading-tight truncate ${effectiveMode === m.id ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {m.name}
                      </div>
                      <div className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 truncate">
                        {m.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-500 dark:text-zinc-400">
            フリーチャットモード（モードなし）
          </div>
        )}
      </div>

      {/* 入力フォーム（残りスペースを使用） */}
      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex-shrink-0">
          {!modeEnabled && 'メッセージを入力'}
          {modeEnabled && mode === 'explain' && '何について知りたい？'}
          {modeEnabled && mode === 'idea' && '企画のテーマ・条件は？'}
          {modeEnabled && mode === 'search' && '何を調べる？'}
          {modeEnabled && mode === 'rag' && 'ナレッジベースに質問'}
        </label>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !modeEnabled
              ? '何でも聞いてください...'
              : mode === 'explain'
              ? '例: プログラミングの「変数」って何？'
              : mode === 'idea'
              ? '例: 高校生向けの学習アプリを作りたい'
              : mode === 'search'
              ? '例: 2024年のAI技術トレンド'
              : '例: このアプリについて教えて'
          }
          className="flex-1 min-h-[80px] p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 w-full py-2.5 px-4 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            中断する
          </button>
        ) : (
          <button
            type="submit"
            disabled={!message.trim()}
            className="mt-3 w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex-shrink-0"
          >
            質問する
          </button>
        )}
      </form>

      {/* 注意書き */}
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 text-center flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0">
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        学習支援ツールです。最終判断は人が行ってください
      </p>
    </div>
  );
});
