# Study Sidekick

高校生インターン向け：企画会議で使うローカルAI＋Web検索要約ツール

## 概要

Study Sidekickは、ローカルで動作するLLM（LM Studio / Ollama / llama.cpp）を使って、高校生にもわかりやすい形で情報を提供するWebアプリです。

### 特徴

- **ログイン不要**: すぐに使い始められます
- **プライバシー重視**: データは外部サーバーに送信されません（ローカルLLM使用時）
- **3つのモード**:
  - **やさしく説明**: 難しい概念を高校生向けにかみ砕いて説明
  - **企画アイデア**: 新規企画のアイデアを構造化して提案
  - **検索して要約**: Webを検索して要点を整理
- **生成AIメトリクス表示**: チャット画面下部にリアルタイムで表示
  - コンテキストウィンドウの使用量（プログレスバー付き）
  - 入力/出力トークン数
  - 生成速度（トークン/秒）
  - 生成時間

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ローカルLLMの準備

以下のいずれかを起動してください：

#### LM Studio（推奨）

1. [LM Studio](https://lmstudio.ai/) をダウンロード・インストール
2. 好きなモデルをダウンロード（例: Llama 3.2, Phi-3, Gemma など）
3. 「Local Server」タブで「Start Server」をクリック
4. デフォルトで `http://localhost:1234/v1` で起動

#### Ollama

```bash
# インストール（macOS）
brew install ollama

# モデルをダウンロード
ollama pull llama3.2

# サーバー起動
ollama serve
```
- デフォルトで `http://localhost:11434/v1` で起動

#### llama.cpp

```bash
# サーバー起動（OpenAI互換モード）
./llama-server -m your-model.gguf --port 8080
```
- `http://localhost:8080/v1` で起動

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

## 使い方

1. **LLM設定**（画面上部の「LLM設定」）
   - Provider（LM Studio / Ollama / llama.cpp）を選択
   - 接続URLとモデル名を確認・変更

2. **モードを選択**（画面左側）
   - やさしく説明：概念や用語の説明
   - 企画アイデア：新しいプロジェクトのアイデア出し
   - 検索して要約：最新情報の調査

3. **質問を入力**して「質問する」ボタンをクリック

## 技術スタック

- **フロントエンド**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **バックエンド**: Next.js Route Handlers
- **LLM接続**: OpenAI互換API
- **Web検索**: DuckDuckGo HTML API（APIキー不要）

## プロジェクト構造

```
study-sidekick/
├── app/
│   ├── api/
│   │   ├── chat/route.ts    # LLM呼び出しAPI
│   │   └── search/route.ts  # Web検索API
│   ├── layout.tsx
│   └── page.tsx             # メインページ
├── components/
│   ├── ChatInput.tsx        # 入力フォーム
│   ├── ChatOutput.tsx       # 出力表示
│   ├── MetricsDisplay.tsx   # 生成AIメトリクス表示
│   └── Settings.tsx         # LLM設定UI
├── lib/
│   ├── llm/
│   │   └── provider.ts      # LLM Provider抽象化
│   ├── search/
│   │   └── provider.ts      # 検索Provider抽象化
│   ├── prompts.ts           # プロンプトテンプレート
│   └── types.ts             # 型定義
└── README.md
```

## 注意事項

- **このツールは学習・発想支援です。最終判断は人が行ってください。**
- Web検索機能はDuckDuckGoを使用しています。過度なリクエストは避けてください。
- ローカルLLMの品質はモデルによって異なります。

## トラブルシューティング

### 「LLM接続エラー」が表示される

1. LLMサーバーが起動しているか確認
2. 設定の接続URLが正しいか確認
3. ファイアウォールの設定を確認

### 検索結果が表示されない

- ネットワーク接続を確認
- しばらく待ってから再試行

### 回答が途中で止まる

- LLMのメモリ不足の可能性があります
- より軽量なモデルを試すか、max_tokensを調整

## ライセンス

MIT License

## 改善提案

今後の改善案：

1. **パフォーマンス**
   - 検索結果のキャッシュ
   - LLMレスポンスの最適化

2. **品質向上**
   - プロンプトの継続的な改善
   - 出力フォーマットの統一性向上

3. **UX改善**
   - 会話履歴のローカル保存
   - キーボードショートカット
   - モバイル対応の強化

4. **機能追加**
   - 複数の検索エンジン対応
   - 画像生成対応（ローカルStable Diffusion等）
   - エクスポート機能（Markdown/PDF）
