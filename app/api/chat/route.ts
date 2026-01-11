import { NextRequest } from 'next/server';
import { createLLMProvider } from '@/lib/llm/provider';
import { getSystemPrompt, buildExplainPrompt, buildIdeaPrompt, buildSearchPrompt, buildRAGPrompt } from '@/lib/prompts';
import { ChatRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, mode, llmConfig, searchResults, ragContext, history } = body as ChatRequest;

    if (!message || !llmConfig) {
      return new Response(
        JSON.stringify({ error: '必要なパラメータが不足しています' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const provider = createLLMProvider(llmConfig);

    // フリーチャットモード（mode=null）の場合はシステムプロンプトなし
    let systemPrompt: string | undefined;
    let userPrompt: string;

    if (mode === null) {
      // フリーチャット: システムプロンプトなし、メッセージそのまま
      systemPrompt = undefined;
      userPrompt = message;
    } else {
      systemPrompt = getSystemPrompt(mode);
      switch (mode) {
        case 'explain':
          userPrompt = buildExplainPrompt(message);
          break;
        case 'idea':
          userPrompt = buildIdeaPrompt(message);
          break;
        case 'search':
          if (!searchResults || searchResults.length === 0) {
            return new Response(
              JSON.stringify({ error: '検索結果がありません' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          userPrompt = buildSearchPrompt(message, searchResults);
          break;
        case 'rag':
          userPrompt = buildRAGPrompt(message, ragContext || []);
          break;
        default:
          userPrompt = message;
      }
    }

    // ストリーミングレスポンス
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = provider.stream(userPrompt, { systemPrompt, history });

          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `サーバーエラー: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
