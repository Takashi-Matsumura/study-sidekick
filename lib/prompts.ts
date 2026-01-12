import { ChatMode, SearchResult, RAGContext, SystemPrompts } from './types';

// デフォルトのシステムプロンプト（共通部分）
const DEFAULT_COMMON_PROMPT = `あなたは高校生インターン向けの学習・発想支援AIアシスタントです。

## 回答のルール
- やさしい言葉を使う（専門用語は使う場合は必ず()で補足説明を入れる）
- 箇条書きを活用して読みやすくする
- 長すぎない回答を心がける（画面1〜2スクロール以内）
- 「〜です」「〜ます」の丁寧語を使う

## 回答の構成（必ずこの順番で）
1. **結論**（1〜3行で要点を伝える）
2. **要点**（箇条書きで3〜5個）
3. **くわしく**（短めの説明、専門用語には補足）
4. **次にやること**（具体的なToDoを2〜3個）`;

// デフォルトのモード別追加プロンプト
const DEFAULT_EXPLAIN_PROMPT = `## このモードの特徴
「やさしく説明」モードです。
- 難しい概念を高校生にもわかるようにかみ砕いて説明する
- 身近な例えを使って理解を助ける
- 「なぜそうなるのか」理由も一緒に伝える`;

const DEFAULT_IDEA_PROMPT = `## このモードの特徴
「企画アイデア」モードです。新しいアイデアを提案する際は、以下の項目を含めてください：

1. **目的**：何を解決するのか、何を実現したいのか
2. **ターゲット**：誰のためのものか
3. **価値**：どんなメリットがあるか
4. **実現方法**：具体的にどうやって作るか
5. **必要な技術**：どんなスキルやツールが必要か
6. **リスク**：考えられる問題点や注意点
7. **次のアクション**：今すぐ始められる最初の一歩`;

const DEFAULT_SEARCH_PROMPT = `## このモードの特徴
「検索して要約」モードです。検索結果をもとに回答します。
- 検索で見つかった情報を元に、正確に要約する
- 情報の出典（どのサイトから得たか）を明記する
- 複数の情報源がある場合は、比較・整理する
- 検索結果にない情報は推測であることを明記する`;

const DEFAULT_RAG_PROMPT = `## このモードの特徴
「ナレッジ検索」モードです。社内ナレッジベースの情報をもとに回答します。
- ナレッジベースから取得した情報を元に、正確に回答する
- 情報の出典（どのドキュメントから得たか）を明記する
- ナレッジベースにない情報は「ナレッジベースには該当する情報がありません」と伝える
- 複数のドキュメントに関連情報がある場合は、整理して回答する`;

// デフォルトのシステムプロンプト一式をエクスポート
export const DEFAULT_SYSTEM_PROMPTS: SystemPrompts = {
  common: DEFAULT_COMMON_PROMPT,
  explain: DEFAULT_EXPLAIN_PROMPT,
  idea: DEFAULT_IDEA_PROMPT,
  search: DEFAULT_SEARCH_PROMPT,
  rag: DEFAULT_RAG_PROMPT,
};

// カスタムプロンプトを使用してシステムプロンプトを取得
export function getSystemPrompt(mode: ChatMode, customPrompts?: SystemPrompts): string {
  const prompts = customPrompts || DEFAULT_SYSTEM_PROMPTS;
  const common = prompts.common;

  switch (mode) {
    case 'explain':
      return `${common}\n\n${prompts.explain}`;
    case 'idea':
      return `${common}\n\n${prompts.idea}`;
    case 'search':
      return `${common}\n\n${prompts.search}`;
    case 'rag':
      return `${common}\n\n${prompts.rag}`;
    default:
      return common;
  }
}

export function buildSearchPrompt(query: string, searchResults: SearchResult[]): string {
  const sourcesText = searchResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n内容: ${r.snippet}`)
    .join('\n\n');

  return `## ユーザーの質問
${query}

## 検索結果
以下の検索結果をもとに回答してください。回答には必ず参照元のURLを含めてください。

${sourcesText}

## 回答のフォーマット
上記の検索結果をもとに、「結論」「要点」「くわしく」「次にやること」の順で回答してください。
最後に「📚 参考リンク」として使用した情報源のURLリストを付けてください。`;
}

export function buildExplainPrompt(query: string): string {
  return `以下について、高校生にもわかりやすく説明してください。

## 質問
${query}

## 回答のフォーマット
「結論」「要点」「くわしく」「次にやること」の順で回答してください。`;
}

export function buildIdeaPrompt(query: string): string {
  return `以下のテーマで企画アイデアを提案してください。

## テーマ・条件
${query}

## 回答のフォーマット
「目的」「ターゲット」「価値」「実現方法」「必要な技術」「リスク」「次のアクション」を含めて回答してください。
最初に「結論」として、アイデアの概要を1〜3行でまとめてください。`;
}

export function buildRAGPrompt(query: string, ragContext: RAGContext[]): string {
  if (ragContext.length === 0) {
    return `## ユーザーの質問
${query}

## ナレッジベース検索結果
関連する情報が見つかりませんでした。

## 回答
ナレッジベースに該当する情報がないことを伝え、可能であれば一般的な情報を提供してください。`;
  }

  const contextText = ragContext
    .map((ctx, i) => {
      const score = Math.round(ctx.score * 100);
      return `[${i + 1}] ドキュメント: ${ctx.metadata.filename} (関連度: ${score}%)
内容:
${ctx.content}`;
    })
    .join('\n\n---\n\n');

  return `## ユーザーの質問
${query}

## ナレッジベースから取得した関連情報
以下のナレッジベースの情報をもとに回答してください。

${contextText}

## 回答のフォーマット
上記のナレッジベース情報をもとに、「結論」「要点」「くわしく」「次にやること」の順で回答してください。
回答の最後に「参照ドキュメント」として使用した情報源のドキュメント名を付けてください。`;
}
