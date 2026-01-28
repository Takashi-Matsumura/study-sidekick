import { LLMConfig, LLMGenerateOptions, LLMResponse } from '../types';

export interface LLMProvider {
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
  stream(prompt: string, options?: LLMGenerateOptions): AsyncGenerator<string, void, unknown>;
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  return new OpenAICompatibleProvider(config);
}

class OpenAICompatibleProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            ...(options?.systemPrompt
              ? [{ role: 'system', content: options.systemPrompt }]
              : []),
            { role: 'user', content: prompt },
          ],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content ?? '',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        error: message,
      };
    }
  }

  async *stream(prompt: string, options?: LLMGenerateOptions): AsyncGenerator<string, void, unknown> {
    try {
      // メッセージを構築
      const messages: Array<{ role: string; content: string }> = [];

      // システムプロンプト
      if (options?.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }

      // 会話履歴
      if (options?.history && options.history.length > 0) {
        for (const msg of options.history) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      // 新しいユーザーメッセージ
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta;
            const content = delta?.content;
            const reasoning = delta?.reasoning;

            // 推論過程があれば出力（折りたたみ表示用のマーカー付き）
            if (reasoning) {
              yield `<think>${reasoning}</think>`;
            }

            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield `\n\n❌ エラーが発生しました: ${message}`;
    }
  }
}
