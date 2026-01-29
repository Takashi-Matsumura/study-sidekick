import { RAGQueryResponse, DEFAULT_RAG_CONFIG } from '../types';

const getBaseUrl = (customUrl?: string) => {
  const isDefault = !customUrl || customUrl === DEFAULT_RAG_CONFIG.baseUrl;
  if (!isDefault) return customUrl;
  return process.env.RAG_BASE_URL || DEFAULT_RAG_CONFIG.baseUrl;
};

export interface RAGQueryOptions {
  topK?: number;
  threshold?: number;
  category?: string;
  baseUrl?: string;
}

export interface RAGDocument {
  filename: string;
  chunk_count: number;
  category?: string;
}

export interface RAGDocumentContent {
  filename: string;
  chunks: Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>;
}

export async function queryRAG(
  query: string,
  options?: RAGQueryOptions
): Promise<RAGQueryResponse> {
  const baseUrl = getBaseUrl(options?.baseUrl);
  try {
    const response = await fetch(`${baseUrl}/api/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        top_k: options?.topK ?? 5,
        threshold: options?.threshold ?? 0.3,
        category: options?.category,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RAG API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data as RAGQueryResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`RAG検索エラー: ${message}`);
  }
}

export async function checkRAGHealth(baseUrl?: string): Promise<boolean> {
  const url = getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getRAGStats(baseUrl?: string): Promise<{
  total_chunks: number;
  unique_documents: number;
  embedding_model: string;
} | null> {
  const url = getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}/api/rag/stats`, {
      method: 'GET',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function listRAGDocuments(category?: string, baseUrl?: string): Promise<RAGDocument[]> {
  const ragBaseUrl = getBaseUrl(baseUrl);
  try {
    const url = category
      ? `${ragBaseUrl}/api/documents/list?category=${encodeURIComponent(category)}`
      : `${ragBaseUrl}/api/documents/list`;

    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to list documents: ${response.status}`);
    }

    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`ドキュメント一覧取得エラー: ${message}`);
  }
}

export async function getRAGDocumentContent(filename: string, baseUrl?: string): Promise<RAGDocumentContent> {
  const ragBaseUrl = getBaseUrl(baseUrl);
  try {
    const response = await fetch(
      `${ragBaseUrl}/api/documents/content/${encodeURIComponent(filename)}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get document content: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`ドキュメント取得エラー: ${message}`);
  }
}

export async function uploadRAGDocument(
  content: string,
  filename: string,
  category?: string,
  baseUrl?: string
): Promise<{ message: string; chunks_created: number }> {
  const ragBaseUrl = getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${ragBaseUrl}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        metadata: {
          title: filename,
          category: category || 'general',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload document: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`ドキュメント登録エラー: ${message}`);
  }
}

export async function deleteRAGDocument(filename: string, baseUrl?: string): Promise<void> {
  const ragBaseUrl = getBaseUrl(baseUrl);
  try {
    const response = await fetch(
      `${ragBaseUrl}/api/documents/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`ドキュメント削除エラー: ${message}`);
  }
}
