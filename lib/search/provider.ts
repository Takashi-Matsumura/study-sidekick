import { SearchResult, SearchResponse, SearchConfig } from '../types';

export interface SearchProvider {
  search(query: string, numResults?: number): Promise<SearchResponse>;
}

/**
 * 検索プロバイダーを作成
 * SearchConfigに基づいてプロバイダーを選択
 * Brave選択時にAPIキーがなければDuckDuckGoにフォールバック
 */
export function createSearchProvider(config: SearchConfig): SearchProvider {
  if (config.provider === 'brave' && config.braveApiKey) {
    return new BraveSearchProvider(config.braveApiKey);
  }

  if (config.provider === 'brave' && !config.braveApiKey) {
    console.log('[Search] Brave selected but no API key, falling back to DuckDuckGo');
  }

  return new DuckDuckGoProvider();
}

/**
 * Brave Search API プロバイダー
 * https://brave.com/search/api/
 * 無料プラン: 月2,000クエリまで
 */
class BraveSearchProvider implements SearchProvider {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, numResults: number = 5): Promise<SearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        count: numResults.toString(),
        safesearch: 'moderate',
        search_lang: 'ja',
        ui_lang: 'ja-JP',
      });

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        // レート制限の場合はフォールバック
        if (response.status === 429) {
          console.log('[Brave Search] Rate limited, falling back to DuckDuckGo');
          const fallback = new DuckDuckGoProvider();
          return fallback.search(query, numResults);
        }
        throw new Error(`Brave Search API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const results: SearchResult[] = [];

      if (data.web?.results) {
        for (const item of data.web.results.slice(0, numResults)) {
          results.push({
            title: item.title || '',
            url: item.url || '',
            snippet: item.description || '',
          });
        }
      }

      return { results };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Brave Search] Error:', message);

      // エラー時はDuckDuckGoにフォールバック
      console.log('[Brave Search] Falling back to DuckDuckGo');
      try {
        const fallback = new DuckDuckGoProvider();
        return fallback.search(query, numResults);
      } catch {
        return {
          results: [],
          error: `検索エラー: ${message}`,
        };
      }
    }
  }
}

class DuckDuckGoProvider implements SearchProvider {
  async search(query: string, numResults: number = 5): Promise<SearchResponse> {
    try {
      // DuckDuckGo HTML search (API key不要)
      const encodedQuery = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const html = await response.text();
      const results = this.parseResults(html, numResults);

      return { results };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        results: [],
        error: `検索エラー: ${message}`,
      };
    }
  }

  private parseResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];

    // DuckDuckGo HTML results parsing
    // 結果は <a class="result__a" href="...">タイトル</a> と
    // <a class="result__snippet">スニペット</a> の形式

    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;

    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      let url = match[1];
      const title = this.cleanText(match[2]);
      const snippet = this.cleanText(match[3]);

      // DuckDuckGoのリダイレクトURLから実際のURLを抽出
      if (url.includes('uddg=')) {
        const uddgMatch = url.match(/uddg=([^&]*)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }
      }

      if (url && title && !url.includes('duckduckgo.com')) {
        results.push({ title, url, snippet });
      }
    }

    // フォールバック: 別のパターンでも試す
    if (results.length === 0) {
      const simpleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = simpleRegex.exec(html)) !== null && results.length < limit) {
        let url = match[1];
        const title = this.cleanText(match[2]);

        if (url.includes('uddg=')) {
          const uddgMatch = url.match(/uddg=([^&]*)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }
        }

        if (url && title && !url.includes('duckduckgo.com')) {
          results.push({ title, url, snippet: '' });
        }
      }
    }

    return results;
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// URLの本文を簡易取得（コンテキストサイズ制限のため短めに）
export async function fetchPageContent(url: string, maxLength: number = 500): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return '';
    }

    const html = await response.text();

    // HTMLからテキストを抽出（簡易版）
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    return text;
  } catch {
    return '';
  }
}
