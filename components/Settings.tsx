'use client';

import { useEffect, useState, useCallback } from 'react';
import { LLMConfig, PROVIDER_PRESETS, LLMProviderType, SystemPrompts, SearchConfig, SearchProviderType, RAGConfig } from '@/lib/types';
import { DEFAULT_SYSTEM_PROMPTS } from '@/lib/prompts';
import { SettingsIcon, InfoIcon, DatabaseIcon } from './Icons';

interface RAGDocument {
  filename: string;
  chunk_count: number;
  category?: string;
}

interface SettingsProps {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
  getProviderConfig: (provider: LLMProviderType) => LLMConfig;
  ragEnabled: boolean;
  onRagEnabledChange: (enabled: boolean) => void;
  ragConfig: RAGConfig;
  onRagConfigChange: (config: RAGConfig) => void;
  systemPrompts: SystemPrompts;
  onSystemPromptsChange: (prompts: SystemPrompts) => void;
  searchConfig: SearchConfig;
  onSearchConfigChange: (config: SearchConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'llm' | 'rag' | 'prompts';
type RAGSubTab = 'settings' | 'documents' | 'upload';
type PromptTab = 'common' | 'explain' | 'idea' | 'search' | 'rag';

export function Settings({
  config,
  onChange,
  getProviderConfig,
  ragEnabled,
  onRagEnabledChange,
  ragConfig,
  onRagConfigChange,
  systemPrompts,
  onSystemPromptsChange,
  searchConfig,
  onSearchConfigChange,
  isOpen,
  onClose,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
  const [ragSubTab, setRagSubTab] = useState<RAGSubTab>('settings');
  const [promptTab, setPromptTab] = useState<PromptTab>('common');
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [docContentLoading, setDocContentLoading] = useState(false);
  const [docEditing, setDocEditing] = useState(false);
  const [docEditContent, setDocEditContent] = useState('');
  const [docSaving, setDocSaving] = useState(false);
  const [docSaveElapsed, setDocSaveElapsed] = useState(0);
  const [docSaveMessage, setDocSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload form state
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadCategory, setUploadCategory] = useState('study');
  const [uploading, setUploading] = useState(false);
  const [uploadElapsed, setUploadElapsed] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // LLM接続テスト state
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // RAG接続テスト state
  const [ragConnectionTesting, setRagConnectionTesting] = useState(false);
  const [ragConnectionError, setRagConnectionError] = useState<string | null>(null);
  const [ragConnectionSuccess, setRagConnectionSuccess] = useState(false);

  // RAG有効化時の接続確認
  const handleRagToggle = async () => {
    // OFFにする場合はそのまま
    if (ragEnabled) {
      onRagEnabledChange(false);
      setRagConnectionError(null);
      return;
    }

    // ONにする場合は接続確認
    setRagConnectionTesting(true);
    setRagConnectionError(null);

    try {
      const response = await fetch(`/api/rag?ragBaseUrl=${encodeURIComponent(ragConfig.baseUrl)}`);
      const data = await response.json();

      if (data.status === 'healthy') {
        onRagEnabledChange(true);
      } else {
        setRagConnectionError('RAGサーバーに接続できません。サーバーが起動しているか確認してください。');
      }
    } catch {
      setRagConnectionError('RAGサーバーへの接続に失敗しました。');
    } finally {
      setRagConnectionTesting(false);
    }
  };

  const handleProviderChange = (provider: LLMProviderType) => {
    // 保存済みの設定を取得（なければプリセットを使用）
    const newConfig = getProviderConfig(provider);
    onChange(newConfig);
    // Provider変更時にテスト結果とモデルリストをクリア
    setConnectionResult(null);
    setAvailableModels([]);
  };

  // LLM接続テスト
  const handleConnectionTest = async () => {
    setConnectionTesting(true);
    setConnectionResult(null);

    try {
      // サーバーサイドAPI経由で接続テスト（CORS回避）
      const response = await fetch('/api/llm/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          provider: config.provider,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // コンテキストサイズが取得できた場合は設定を更新
      if (data.contextSize && data.contextSize !== config.contextSize) {
        onChange({ ...config, contextSize: data.contextSize });
      }

      // Ollamaの場合はモデルリストを保存（全モデルリストを使用）
      if (config.provider === 'ollama' && data.allModelNames && data.allModelNames.length > 0) {
        setAvailableModels(data.allModelNames);
      }

      const modelNames = data.modelNames?.join(', ') || '';
      const contextInfo = data.contextSize ? ` (Context: ${data.contextSize.toLocaleString()})` : '';
      setConnectionResult({
        type: 'success',
        text: `接続成功！${data.modelCount}個のモデルを検出${modelNames ? `: ${modelNames}` : ''}${contextInfo}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー';
      setConnectionResult({
        type: 'error',
        text: `接続失敗: ${message}`,
      });
    } finally {
      setConnectionTesting(false);
    }
  };

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const response = await fetch(`/api/rag/documents?ragBaseUrl=${encodeURIComponent(ragConfig.baseUrl.trim())}`);
      const data = await response.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  }, [ragConfig.baseUrl]);

  // Fetch document content
  const fetchDocContent = useCallback(async (filename: string) => {
    setDocContentLoading(true);
    try {
      const response = await fetch(`/api/rag/documents/${encodeURIComponent(filename)}?ragBaseUrl=${encodeURIComponent(ragConfig.baseUrl.trim())}`);
      const data = await response.json();
      if (data.chunks) {
        const content = data.chunks.map((c: { content: string }) => c.content).join('\n\n---\n\n');
        setDocContent(content);
      }
    } catch (error) {
      console.error('Failed to fetch document content:', error);
      setDocContent('ドキュメントの読み込みに失敗しました');
    } finally {
      setDocContentLoading(false);
    }
  }, [ragConfig.baseUrl]);

  // Handle document upload
  const handleUpload = async () => {
    if (!uploadFilename.trim() || !uploadContent.trim()) {
      setUploadMessage({ type: 'error', text: 'ファイル名と内容を入力してください' });
      return;
    }

    setUploading(true);
    setUploadMessage(null);
    try {
      const response = await fetch('/api/rag/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFilename,
          content: uploadContent,
          category: uploadCategory,
          ragBaseUrl: ragConfig.baseUrl.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setUploadMessage({ type: 'success', text: `登録完了: ${data.chunks_created || 0} チャンク作成` });
        setUploadFilename('');
        setUploadContent('');
        fetchDocuments();
      } else {
        setUploadMessage({ type: 'error', text: data.error || '登録に失敗しました' });
      }
    } catch {
      setUploadMessage({ type: 'error', text: '登録に失敗しました' });
    } finally {
      setUploading(false);
    }
  };

  // Handle document delete
  const handleDelete = async (filename: string) => {
    if (!confirm(`「${filename}」を削除しますか？`)) return;

    try {
      const response = await fetch(`/api/rag/documents/${encodeURIComponent(filename)}?ragBaseUrl=${encodeURIComponent(ragConfig.baseUrl.trim())}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchDocuments();
        if (selectedDoc === filename) {
          setSelectedDoc(null);
          setDocContent('');
        }
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  // ドキュメント上書き保存（削除→再登録）
  const handleDocSave = async () => {
    if (!selectedDoc || !docEditContent.trim()) return;

    setDocSaving(true);
    setDocSaveMessage(null);

    try {
      // 既存ドキュメントのカテゴリを取得
      const doc = documents.find(d => d.filename === selectedDoc);
      const category = doc?.category || ragConfig.category || 'study';

      // 1. 既存ドキュメントを削除
      const deleteResponse = await fetch(
        `/api/rag/documents/${encodeURIComponent(selectedDoc)}?ragBaseUrl=${encodeURIComponent(ragConfig.baseUrl.trim())}`,
        { method: 'DELETE' }
      );
      if (!deleteResponse.ok) {
        throw new Error('既存ドキュメントの削除に失敗しました');
      }

      // 2. 新しい内容で再登録
      const uploadResponse = await fetch('/api/rag/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedDoc,
          content: docEditContent,
          category,
          ragBaseUrl: ragConfig.baseUrl.trim(),
        }),
      });

      const data = await uploadResponse.json();
      if (uploadResponse.ok) {
        setDocSaveMessage({ type: 'success', text: `保存完了: ${data.chunks_created || 0} チャンク作成` });
        setDocEditing(false);
        setDocContent(docEditContent);
        fetchDocuments();
      } else {
        throw new Error(data.error || '再登録に失敗しました');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました';
      setDocSaveMessage({ type: 'error', text: message });
    } finally {
      setDocSaving(false);
    }
  };

  // アップロード経過時間カウント
  useEffect(() => {
    if (!uploading) {
      setUploadElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setUploadElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [uploading]);

  // ドキュメント保存経過時間カウント
  useEffect(() => {
    if (!docSaving) {
      setDocSaveElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setDocSaveElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [docSaving]);

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

  // Fetch documents when RAG tab is opened
  useEffect(() => {
    if (isOpen && activeTab === 'rag' && ragSubTab === 'documents') {
      fetchDocuments();
    }
  }, [isOpen, activeTab, ragSubTab, fetchDocuments]);

  // Fetch content when document is selected
  useEffect(() => {
    if (selectedDoc) {
      fetchDocContent(selectedDoc);
    }
  }, [selectedDoc, fetchDocContent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 半透明オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* モーダルコンテンツ */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            アプリ環境設定
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

        {/* メインタブ */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'llm'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            LLM設定
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'prompts'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            プロンプト設定
          </button>
          <button
            onClick={() => setActiveTab('rag')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'rag'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            RAG設定
          </button>
        </div>

        {/* タブコンテンツ */}
        <div className={`flex-1 p-4 ${
          activeTab === 'rag' && ragSubTab === 'upload'
            ? 'flex flex-col overflow-hidden'
            : 'overflow-y-auto'
        }`}>
          {activeTab === 'llm' && (
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
                {config.provider === 'ollama' && availableModels.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={config.model}
                      onChange={(e) => onChange({ ...config, model: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {!availableModels.includes(config.model) && config.model && (
                        <option value={config.model}>{config.model}</option>
                      )}
                      {availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {availableModels.length}個のモデルが利用可能
                    </p>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={config.model}
                    onChange={(e) => onChange({ ...config, model: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="local-model"
                  />
                )}
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  APIキー（オプション）
                </label>
                <input
                  type="password"
                  value={config.apiKey || ''}
                  onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="認証が必要な場合のみ入力"
                />
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  認証が必要なLLMサーバーの場合にAPIキーを入力してください
                </p>
              </div>

              {/* 接続テスト */}
              <div>
                <button
                  onClick={handleConnectionTest}
                  disabled={connectionTesting || !config.baseUrl}
                  className="w-full py-2 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 text-zinc-700 dark:text-zinc-300 font-medium rounded-md transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {connectionTesting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      テスト中...
                    </>
                  ) : (
                    '接続テスト'
                  )}
                </button>

                {connectionResult && (
                  <div
                    className={`mt-2 p-3 rounded-md text-sm ${
                      connectionResult.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {connectionResult.type === 'success' ? '✓ ' : '✗ '}
                    {connectionResult.text}
                  </div>
                )}
              </div>

              {/* ヒント */}
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

              {/* 検索API設定 */}
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Web検索API（「検索して要約」モード用）
                </h3>

                {/* Provider選択 */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    検索プロバイダー
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSearchConfigChange({ ...searchConfig, provider: 'brave' })}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        searchConfig.provider === 'brave'
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      Brave Search
                    </button>
                    <button
                      onClick={() => onSearchConfigChange({ ...searchConfig, provider: 'duckduckgo' })}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        searchConfig.provider === 'duckduckgo'
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      DuckDuckGo
                    </button>
                  </div>
                </div>

                {/* Brave API Key */}
                {searchConfig.provider === 'brave' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      Brave Search API キー
                    </label>
                    <input
                      type="password"
                      value={searchConfig.braveApiKey || ''}
                      onChange={(e) => onSearchConfigChange({ ...searchConfig, braveApiKey: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="BSA-xxxxxxxxxxxxxxxxxx"
                    />
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      <a
                        href="https://brave.com/search/api/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400"
                      >
                        Brave Search API
                      </a>
                      {' '}で無料取得（月2,000クエリまで無料）
                    </p>
                  </div>
                )}

                {/* DuckDuckGo説明 */}
                {searchConfig.provider === 'duckduckgo' && (
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
                    <div className="flex items-start gap-2">
                      <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">DuckDuckGo（非公式）</p>
                        <p>
                          APIキー不要ですが、レート制限やパース失敗でエラーになることがあります。
                          安定性を求める場合はBrave Search APIをお勧めします。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-4">
              {/* プロンプトサブタブ */}
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg flex-wrap">
                {[
                  { id: 'common', label: '共通' },
                  { id: 'explain', label: 'やさしく説明' },
                  { id: 'idea', label: '企画アイデア' },
                  { id: 'search', label: '検索して要約' },
                  { id: 'rag', label: 'ナレッジ検索' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPromptTab(tab.id as PromptTab)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      promptTab === tab.id
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* プロンプト説明 */}
              <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
                <div className="flex items-start gap-2">
                  <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    {promptTab === 'common' ? (
                      <p>
                        <strong>共通プロンプト</strong>：すべてのモードで使用される基本的な指示です。
                        AIの役割や回答のルール・構成を定義します。
                      </p>
                    ) : (
                      <p>
                        <strong>モード別プロンプト</strong>：共通プロンプトに追加される、
                        各モード固有の指示です。このモード特有の回答方法を定義します。
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* プロンプト編集エリア */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {promptTab === 'common' && '共通システムプロンプト'}
                    {promptTab === 'explain' && '「やさしく説明」モード追加プロンプト'}
                    {promptTab === 'idea' && '「企画アイデア」モード追加プロンプト'}
                    {promptTab === 'search' && '「検索して要約」モード追加プロンプト'}
                    {promptTab === 'rag' && '「ナレッジ検索」モード追加プロンプト'}
                  </label>
                  <button
                    onClick={() => {
                      if (confirm('このプロンプトをデフォルトに戻しますか？')) {
                        onSystemPromptsChange({
                          ...systemPrompts,
                          [promptTab]: DEFAULT_SYSTEM_PROMPTS[promptTab],
                        });
                      }
                    }}
                    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    デフォルトに戻す
                  </button>
                </div>
                <textarea
                  value={systemPrompts[promptTab]}
                  onChange={(e) =>
                    onSystemPromptsChange({
                      ...systemPrompts,
                      [promptTab]: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 h-64 resize-none font-mono"
                  placeholder="システムプロンプトを入力..."
                />
                <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 flex justify-between">
                  <span>{systemPrompts[promptTab].length} 文字</span>
                  <button
                    onClick={() => {
                      if (confirm('すべてのプロンプトをデフォルトに戻しますか？')) {
                        onSystemPromptsChange(DEFAULT_SYSTEM_PROMPTS);
                      }
                    }}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                  >
                    すべてデフォルトに戻す
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="space-y-4">
              {/* RAGサブタブ */}
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                {[
                  { id: 'settings', label: '基本設定' },
                  { id: 'documents', label: 'ドキュメント閲覧' },
                  { id: 'upload', label: 'ナレッジ登録' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setRagSubTab(tab.id as RAGSubTab)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      ragSubTab === tab.id
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 基本設定 */}
              {ragSubTab === 'settings' && (
                <div className="space-y-4">
                  {/* RAG有効/無効トグル */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <DatabaseIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                      <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          ナレッジベース検索
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          RAGサーバーを使用して社内ナレッジを検索
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRagToggle}
                      disabled={ragConnectionTesting}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ragEnabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      {ragConnectionTesting ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-4 h-4 animate-spin text-zinc-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </span>
                      ) : (
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            ragEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      )}
                    </button>
                  </div>

                  {/* RAGサーバーURL設定 */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      RAGサーバーURL
                    </label>
                    <input
                      type="text"
                      value={ragConfig.baseUrl}
                      onChange={(e) => {
                        onRagConfigChange({ ...ragConfig, baseUrl: e.target.value });
                        setRagConnectionError(null);
                      }}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="http://localhost:8000"
                    />
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      RAGサーバーのベースURLを指定します
                    </p>
                  </div>

                  {/* RAG接続テスト */}
                  <div>
                    <button
                      onClick={async () => {
                        setRagConnectionTesting(true);
                        setRagConnectionError(null);
                        try {
                          const url = ragConfig.baseUrl.trim();
                          const response = await fetch(`/api/rag?ragBaseUrl=${encodeURIComponent(url)}`);
                          const data = await response.json();
                          if (data.status === 'healthy') {
                            setRagConnectionError(null);
                            setRagConnectionSuccess(true);
                          } else {
                            setRagConnectionSuccess(false);
                            setRagConnectionError('RAGサーバーに接続できません。サーバーが起動しているか確認してください。');
                          }
                        } catch {
                          setRagConnectionSuccess(false);
                          setRagConnectionError('RAGサーバーへの接続に失敗しました。');
                        } finally {
                          setRagConnectionTesting(false);
                        }
                      }}
                      disabled={ragConnectionTesting || !ragConfig.baseUrl}
                      className="w-full py-2 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 text-zinc-700 dark:text-zinc-300 font-medium rounded-md transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {ragConnectionTesting ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          テスト中...
                        </>
                      ) : (
                        '接続テスト'
                      )}
                    </button>

                    {ragConnectionSuccess && !ragConnectionError && (
                      <div className="mt-2 p-3 rounded-md text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                        ✓ RAGサーバーに接続できました
                      </div>
                    )}

                    {ragConnectionError && (
                      <div className="mt-2 p-3 rounded-md text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                        ✗ {ragConnectionError}
                      </div>
                    )}
                  </div>

                  {/* ナレッジカテゴリ設定 */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      ナレッジカテゴリ
                    </label>
                    <input
                      type="text"
                      value={ragConfig.category}
                      onChange={(e) => onRagConfigChange({ ...ragConfig, category: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例: study, evaluation"
                    />
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      RAG検索で使用するカテゴリを指定します（デフォルト: study）
                    </p>
                  </div>

                  {/* RAGの説明 */}
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
                    <div className="flex items-start gap-2">
                      <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">RAG（検索拡張生成）について</p>
                        <p>
                          RAGを有効にすると、モード選択に「ナレッジ検索」が追加されます。
                          カテゴリを指定すると、特定のドキュメントのみを検索対象にできます。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ドキュメント閲覧 */}
              {ragSubTab === 'documents' && (
                <div className="space-y-4">
                  <div className="flex gap-4 h-[350px]">
                    {/* ドキュメント一覧 */}
                    <div className="w-1/3 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden flex flex-col">
                      <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                        ドキュメント一覧
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {documentsLoading ? (
                          <div className="p-3 text-sm text-zinc-400">読み込み中...</div>
                        ) : documents.length === 0 ? (
                          <div className="p-3 text-sm text-zinc-400">ドキュメントがありません</div>
                        ) : (
                          documents.map((doc) => (
                            <div
                              key={doc.filename}
                              className={`px-3 py-2 text-sm cursor-pointer border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between group ${
                                selectedDoc === doc.filename
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                              }`}
                              onClick={() => {
                                setSelectedDoc(doc.filename);
                                setDocEditing(false);
                                setDocSaveMessage(null);
                              }}
                            >
                              <div className="truncate flex-1">
                                <div className="truncate">{doc.filename}</div>
                                <div className="text-xs text-zinc-400">{doc.chunk_count} chunks</div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(doc.filename);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 p-1"
                                title="削除"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* ドキュメント内容 */}
                    <div className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden flex flex-col">
                      <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                        <span>{selectedDoc || 'ドキュメントを選択'}</span>
                        {selectedDoc && !docContentLoading && (
                          <button
                            onClick={() => {
                              if (docEditing) {
                                setDocEditing(false);
                                setDocSaveMessage(null);
                              } else {
                                // チャンク区切り(---)を除去してオリジナルに近い形にする
                                const cleanContent = docContent.replace(/\n\n---\n\n/g, '\n\n');
                                setDocEditContent(cleanContent);
                                setDocEditing(true);
                                setDocSaveMessage(null);
                              }
                            }}
                            disabled={docSaving}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              docEditing
                                ? 'bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                            }`}
                          >
                            {docEditing ? 'キャンセル' : '編集'}
                          </button>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 flex flex-col">
                        {docContentLoading ? (
                          <div className="text-sm text-zinc-400">読み込み中...</div>
                        ) : selectedDoc ? (
                          docEditing ? (
                            <textarea
                              value={docEditContent}
                              onChange={(e) => setDocEditContent(e.target.value)}
                              disabled={docSaving}
                              className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 font-mono bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            />
                          ) : (
                            <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono">
                              {docContent}
                            </pre>
                          )
                        ) : (
                          <div className="text-sm text-zinc-400">
                            左のリストからドキュメントを選択してください
                          </div>
                        )}
                      </div>
                      {/* 編集モードのフッター */}
                      {docEditing && selectedDoc && (
                        <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                          {docSaving && (
                            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>保存中... （{docSaveElapsed}秒経過）</span>
                            </div>
                          )}
                          {docSaveMessage && (
                            <div className={`text-xs ${
                              docSaveMessage.type === 'success'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {docSaveMessage.type === 'success' ? '✓' : '✗'} {docSaveMessage.text}
                            </div>
                          )}
                          <div className="flex justify-end">
                            <button
                              onClick={handleDocSave}
                              disabled={docSaving || !docEditContent.trim()}
                              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-xs font-medium rounded-md transition-colors disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                              {docSaving ? (
                                <>
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  保存中... ({docSaveElapsed}秒)
                                </>
                              ) : '上書き保存'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ナレッジ登録 */}
              {ragSubTab === 'upload' && (
                <div className="flex flex-col h-full">
                  {/* スクロール可能なフォーム部分 */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        ドキュメント名
                      </label>
                      <input
                        type="text"
                        value={uploadFilename}
                        onChange={(e) => setUploadFilename(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例: 会社規定.md"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        カテゴリ
                      </label>
                      <input
                        type="text"
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例: general, evaluation"
                      />
                    </div>

                    <div className="flex flex-col flex-1 min-h-0">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        内容
                      </label>
                      <textarea
                        value={uploadContent}
                        onChange={(e) => setUploadContent(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-h-[120px] resize-none font-mono"
                        placeholder="ナレッジの内容をここに入力..."
                      />
                    </div>

                    {/* アップロード中のプログレス表示 */}
                    {uploading && (
                      <div className="p-3 rounded-md text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>登録処理中... （{uploadElapsed}秒経過）</span>
                        </div>
                        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-blue-500 dark:bg-blue-400 rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
                        </div>
                        <p className="mt-1.5 text-xs text-blue-500 dark:text-blue-400">
                          テキストの分割とエンベディング生成を行っています
                        </p>
                      </div>
                    )}

                    {/* メッセージ表示 */}
                    {!uploading && uploadMessage && (
                      <div
                        className={`p-3 rounded-md text-sm ${
                          uploadMessage.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {uploadMessage.text}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-3">
          {activeTab === 'rag' && ragSubTab === 'upload' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-md transition-colors"
              >
                閉じる
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFilename.trim() || !uploadContent.trim()}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-sm font-medium rounded-md transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    登録中... ({uploadElapsed}秒)
                  </>
                ) : 'ナレッジを登録'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              完了
            </button>
          )}
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
      title="アプリ環境設定"
    >
      <SettingsIcon className="w-5 h-5" />
    </button>
  );
}
