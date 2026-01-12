'use client';

import { useEffect, useState, useCallback } from 'react';
import { LLMConfig, PROVIDER_PRESETS, LLMProviderType, SystemPrompts } from '@/lib/types';
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
  ragEnabled: boolean;
  onRagEnabledChange: (enabled: boolean) => void;
  ragCategory: string;
  onRagCategoryChange: (category: string) => void;
  systemPrompts: SystemPrompts;
  onSystemPromptsChange: (prompts: SystemPrompts) => void;
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'llm' | 'rag' | 'prompts';
type RAGSubTab = 'settings' | 'documents' | 'upload';
type PromptTab = 'common' | 'explain' | 'idea' | 'search' | 'rag';

export function Settings({
  config,
  onChange,
  ragEnabled,
  onRagEnabledChange,
  ragCategory,
  onRagCategoryChange,
  systemPrompts,
  onSystemPromptsChange,
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

  // Upload form state
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadCategory, setUploadCategory] = useState('study');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const response = await fetch('/api/rag/documents');
      const data = await response.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  // Fetch document content
  const fetchDocContent = useCallback(async (filename: string) => {
    setDocContentLoading(true);
    try {
      const response = await fetch(`/api/rag/documents/${encodeURIComponent(filename)}`);
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
  }, []);

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
      const response = await fetch(`/api/rag/documents/${encodeURIComponent(filename)}`, {
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
        <div className="flex-1 overflow-y-auto p-4">
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
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => onChange({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="local-model"
                />
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
                      onClick={() => onRagEnabledChange(!ragEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        ragEnabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          ragEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* ナレッジカテゴリ設定 */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      ナレッジカテゴリ
                    </label>
                    <input
                      type="text"
                      value={ragCategory}
                      onChange={(e) => onRagCategoryChange(e.target.value)}
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
                              onClick={() => setSelectedDoc(doc.filename)}
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
                      <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                        {selectedDoc || 'ドキュメントを選択'}
                      </div>
                      <div className="flex-1 overflow-y-auto p-3">
                        {docContentLoading ? (
                          <div className="text-sm text-zinc-400">読み込み中...</div>
                        ) : selectedDoc ? (
                          <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono">
                            {docContent}
                          </pre>
                        ) : (
                          <div className="text-sm text-zinc-400">
                            左のリストからドキュメントを選択してください
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ナレッジ登録 */}
              {ragSubTab === 'upload' && (
                <div className="space-y-4">
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

                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      内容
                    </label>
                    <textarea
                      value={uploadContent}
                      onChange={(e) => setUploadContent(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 h-48 resize-none font-mono"
                      placeholder="ナレッジの内容をここに入力..."
                    />
                  </div>

                  {uploadMessage && (
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

                  <button
                    onClick={handleUpload}
                    disabled={uploading || !uploadFilename.trim() || !uploadContent.trim()}
                    className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium rounded-md transition-colors disabled:cursor-not-allowed"
                  >
                    {uploading ? '登録中...' : 'ナレッジを登録'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
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
      title="アプリ環境設定"
    >
      <SettingsIcon className="w-5 h-5" />
    </button>
  );
}
