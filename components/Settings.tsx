'use client';

import { useEffect } from 'react';
import { LLMConfig, PROVIDER_PRESETS, LLMProviderType } from '@/lib/types';
import { SettingsIcon, InfoIcon } from './Icons';

interface SettingsProps {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ config, onChange, isOpen, onClose }: SettingsProps) {
  const handleProviderChange = (provider: LLMProviderType) => {
    const preset = PROVIDER_PRESETS.find((p) => p.provider === provider);
    if (preset) {
      onChange({
        provider,
        baseUrl: preset.baseUrl,
        model: preset.defaultModel,
      });
    }
  };

  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 半透明オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* モーダルコンテンツ */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            LLM設定
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Provider選択 */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Provider
            </label>
            <div className="flex gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.provider}
                  onClick={() => handleProviderChange(preset.provider)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    config.provider === preset.provider
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              接続URL
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="http://localhost:1234/v1"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              モデル名
            </label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => onChange({ ...config, model: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="local-model"
            />
          </div>

          {/* 接続テスト用のヒント */}
          <div className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
            <div className="flex items-start gap-2">
              <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">ヒント: LLMが起動していることを確認してください</p>
                <ul className="space-y-0.5">
                  <li>LM Studio: サーバータブで「Start Server」</li>
                  <li>Ollama: <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">ollama serve</code></li>
                  <li>llama.cpp: <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">./server -m model.gguf</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 閉じるボタン */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
}

// 設定アイコンボタン（ヘッダー用）
export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1.5 rounded-md transition-colors"
      title="LLM設定"
    >
      <SettingsIcon className="w-5 h-5" />
    </button>
  );
}
