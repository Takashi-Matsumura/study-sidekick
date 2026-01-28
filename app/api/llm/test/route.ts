import { NextRequest, NextResponse } from 'next/server';

// llama.cppの/propsエンドポイントからコンテキストサイズを取得
async function getLlamaCppContextSize(baseUrl: string, headers: Record<string, string>): Promise<number | null> {
  try {
    // /v1 を除いたベースURLで /props にアクセス
    const propsUrl = baseUrl.replace(/\/v1\/?$/, '') + '/props';
    const response = await fetch(propsUrl, { method: 'GET', headers });
    if (response.ok) {
      const data = await response.json();
      const nCtx = data.default_generation_settings?.n_ctx;
      if (typeof nCtx === 'number' && nCtx > 0) {
        return nCtx;
      }
    }
  } catch {
    // エラーは無視
  }
  return null;
}

// Ollamaの/api/showエンドポイントからコンテキストサイズを取得
async function getOllamaContextSize(baseUrl: string, modelName: string, headers: Record<string, string>): Promise<number | null> {
  try {
    // /v1 を除いたベースURLで /api/show にアクセス
    const showUrl = baseUrl.replace(/\/v1\/?$/, '') + '/api/show';
    const response = await fetch(showUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    if (response.ok) {
      const data = await response.json();
      // model_info内のコンテキストサイズを探す
      const modelInfo = data.model_info || {};
      for (const key of Object.keys(modelInfo)) {
        if (key.includes('context_length') || key.includes('context_window')) {
          const value = modelInfo[key];
          if (typeof value === 'number' && value > 0) {
            return value;
          }
        }
      }
      // parametersからも探す
      const parameters = data.parameters || '';
      const match = parameters.match(/num_ctx\s+(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  } catch {
    // エラーは無視
  }
  return null;
}

// OpenAI互換APIの/modelsエンドポイントからコンテキストサイズを取得（LM Studio等）
async function getOpenAICompatContextSize(modelsData: { data?: Array<{ context_window?: number; context_length?: number }> }): Promise<number | null> {
  try {
    const models = modelsData.data || [];
    for (const model of models) {
      const ctxSize = model.context_window || model.context_length;
      if (typeof ctxSize === 'number' && ctxSize > 0) {
        return ctxSize;
      }
    }
  } catch {
    // エラーは無視
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey, model, provider } = await request.json();

    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const models = data.data || data.models || [];
    const modelCount = models.length;
    const modelNames = models
      .slice(0, 3)
      .map((m: { id?: string; name?: string; model?: string }) =>
        m.id || m.name || m.model || 'unknown'
      );

    // コンテキストサイズを取得（プロバイダごとに異なる方法を試す）
    let contextSize: number | null = null;

    // 1. OpenAI互換APIのレスポンスから取得を試みる
    contextSize = await getOpenAICompatContextSize(data);

    // 2. llama.cppの/propsエンドポイントを試す
    if (!contextSize && (provider === 'llama-cpp' || !provider)) {
      contextSize = await getLlamaCppContextSize(baseUrl, headers);
    }

    // 3. Ollamaの/api/showエンドポイントを試す
    if (!contextSize && (provider === 'ollama' || !provider) && model) {
      contextSize = await getOllamaContextSize(baseUrl, model, headers);
    }

    return NextResponse.json({
      success: true,
      modelCount,
      modelNames,
      contextSize,  // nullの場合はデフォルト値を使用
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
