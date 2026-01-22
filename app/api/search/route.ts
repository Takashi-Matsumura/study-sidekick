import { NextRequest, NextResponse } from 'next/server';
import { createSearchProvider, fetchPageContent } from '@/lib/search/provider';
import { SearchConfig, DEFAULT_SEARCH_CONFIG } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, numResults = 5, fetchContent = false, searchConfig } = body;

    if (!query) {
      return NextResponse.json(
        { error: '検索クエリが必要です' },
        { status: 400 }
      );
    }

    // searchConfigをマージ（未指定の場合はデフォルト値を使用）
    const config: SearchConfig = {
      ...DEFAULT_SEARCH_CONFIG,
      ...searchConfig,
    };

    const searchProvider = createSearchProvider(config);
    const response = await searchProvider.search(query, numResults);

    if (response.error) {
      return NextResponse.json(
        { error: response.error, results: [] },
        { status: 500 }
      );
    }

    // オプション: 各URLの本文を取得
    if (fetchContent && response.results.length > 0) {
      const resultsWithContent = await Promise.all(
        response.results.map(async (result) => {
          const content = await fetchPageContent(result.url);
          return {
            ...result,
            snippet: content || result.snippet,
          };
        })
      );
      return NextResponse.json({ results: resultsWithContent });
    }

    return NextResponse.json({ results: response.results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `検索エラー: ${message}`, results: [] },
      { status: 500 }
    );
  }
}
