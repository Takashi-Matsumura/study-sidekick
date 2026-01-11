// LLM Provider Types
export type LLMProviderType = 'lm-studio' | 'ollama' | 'llama-cpp';

export interface LLMConfig {
  provider: LLMProviderType;
  baseUrl: string;
  model: string;
}

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface LLMResponse {
  content: string;
  error?: string;
}

// Chat Mode Types
export type ChatMode = 'explain' | 'idea' | 'search' | 'rag';

export interface ChatModeInfo {
  id: ChatMode;
  name: string;
  description: string;
  icon: string;
}

export const CHAT_MODES: ChatModeInfo[] = [
  {
    id: 'explain',
    name: 'やさしく説明',
    description: '高校生にもわかりやすく説明します',
    icon: 'book',
  },
  {
    id: 'idea',
    name: '企画アイデア',
    description: '新規案・メリデメ・実現手順を提案',
    icon: 'lightbulb',
  },
  {
    id: 'search',
    name: '検索して要約',
    description: 'Webを検索して要点をまとめます',
    icon: 'search',
  },
  {
    id: 'rag',
    name: 'ナレッジ検索',
    description: '社内ナレッジベースから回答します',
    icon: 'database',
  },
];

// Provider Presets
export interface ProviderPreset {
  provider: LLMProviderType;
  name: string;
  baseUrl: string;
  defaultModel: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    provider: 'lm-studio',
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
  },
  {
    provider: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
  },
  {
    provider: 'llama-cpp',
    name: 'llama.cpp',
    baseUrl: 'http://localhost:8080/v1',
    defaultModel: 'default',
  },
];

// Search Types
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
}

// Message Types
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchResult[];
  ragSources?: RAGContext[];
}

// RAG Types
export interface RAGContext {
  content: string;
  metadata: {
    filename: string;
    chunk_index: number;
    total_chunks: number;
    category?: string;
  };
  score: number;
}

export interface RAGQueryResponse {
  context: RAGContext[];
  query: string;
  retrieved_count: number;
}

// API Request Types
export interface ChatRequest {
  message: string;
  mode: ChatMode | null;
  llmConfig: LLMConfig;
  searchResults?: SearchResult[];
  ragContext?: RAGContext[];
  history?: Message[];
}

// Generation Metrics Types
export interface GenerationMetrics {
  // コンテキスト情報
  contextWindowSize: number;      // コンテキストウィンドウサイズ（トークン）
  inputTokens: number;            // 入力トークン数（推定）
  outputTokens: number;           // 出力トークン数（推定）
  contextUsagePercent: number;    // コンテキスト使用率（%）

  // 生成速度
  tokensPerSecond: number;        // 出力トークン/秒
  totalTimeMs: number;            // 総生成時間（ミリ秒）

  // ステータス
  isGenerating: boolean;          // 生成中かどうか
}
