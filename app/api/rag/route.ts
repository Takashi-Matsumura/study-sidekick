import { NextRequest } from 'next/server';
import { queryRAG, checkRAGHealth } from '@/lib/rag/provider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK, threshold, category } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'クエリが指定されていません' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // RAGサーバーのヘルスチェック
    const isHealthy = await checkRAGHealth();
    if (!isHealthy) {
      return new Response(
        JSON.stringify({ error: 'RAGサーバーに接続できません。サーバーが起動しているか確認してください。' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await queryRAG(query, { topK, threshold, category });

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  try {
    const isHealthy = await checkRAGHealth();
    return new Response(
      JSON.stringify({
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'RAGサーバーは正常に動作しています' : 'RAGサーバーに接続できません'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ status: 'error', message: 'ヘルスチェックに失敗しました' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
