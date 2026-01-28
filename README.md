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
  - **コンテキストサイズ自動取得**: 接続テスト時にLLMから実際のコンテキストウィンドウサイズを取得
- **システムプロンプト設定**: アプリ環境設定からカスタマイズ可能
  - 共通プロンプト（AIの役割・回答ルール）
  - モード別プロンプト（各モード固有の指示）
  - デフォルトにリセット機能
  - localStorageで永続化
- **LLM接続設定の永続化**: 接続URL・プロバイダー・モデル名・APIキーをlocalStorageに保存
  - ブラウザをリロードしても設定が保持されます
  - URLの前後の空白は自動的に除去されます
  - **APIキー認証対応**: 認証が必要なLLMサーバーにも接続可能
  - **プロバイダーごとの設定記憶**: 各プロバイダー（LM Studio / Ollama / llama.cpp）の設定を個別に保存し、切り替え時に自動復元

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

### 4. Dockerでのデプロイ（本番環境）

Docker Composeを使用してデプロイできます。

```bash
# イメージのビルドと起動
docker compose up -d

# ログの確認
docker compose logs -f

# 停止
docker compose down
```

ブラウザで http://localhost:8585 を開きます。

**ポート情報:**
| サービス | ポート |
|----------|--------|
| Study Sidekick | 8585 |
| RAGサーバー | 8000 |
| llama.cpp | 8080 |
| LM Studio | 1234 |
| Ollama | 11434 |

#### LLMサーバーへの接続について

デフォルトでは`host.docker.internal`を使用するため、Dockerコンテナ内からホストマシンで動作しているLLMサーバーに接続できます。

**LLM設定画面でのデフォルトURL:**

| プロバイダ | デフォルトURL（Docker用） | ローカル開発時 |
|------------|---------------------------|----------------|
| llama.cpp | `http://host.docker.internal:8080/v1` | `http://localhost:8080/v1` |
| LM Studio | `http://host.docker.internal:1234/v1` | `http://localhost:1234/v1` |
| Ollama | `http://host.docker.internal:11434/v1` | `http://localhost:11434/v1` |

RAGサーバーも同様に`http://host.docker.internal:8000`で接続できます（docker-compose.ymlで設定済み）。

> **Note**: `host.docker.internal`はDockerがホストマシンを指すための特別なDNS名です。ローカル開発時（`npm run dev`）は`localhost`に変更してください。

## 使い方

1. **LLM設定**（画面上部の歯車アイコン →「LLM設定」タブ）
   - Provider（LM Studio / Ollama / llama.cpp）を選択
   - 接続URLとモデル名を確認・変更
   - APIキー（オプション）：認証が必要なLLMサーバーの場合に入力
   - 設定は自動的にlocalStorageに保存され、次回アクセス時も維持されます

2. **モードを選択**（画面左側）
   - やさしく説明：概念や用語の説明
   - 企画アイデア：新しいプロジェクトのアイデア出し
   - 検索して要約：最新情報の調査

3. **質問を入力**して「質問する」ボタンをクリック

## 技術スタック

- **フロントエンド**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **バックエンド**: Next.js Route Handlers
- **LLM接続**: OpenAI互換API
- **Web検索**: Brave Search API（推奨） / DuckDuckGo HTML（フォールバック）

## Web検索サービスについて

「検索して要約」モードでは、**Brave Search API**（推奨）または**DuckDuckGo**のHTML版を使用してWeb検索を実現しています。

### 検索プロバイダーの設定

アプリ環境設定 → LLM設定 → 「Web検索API」セクションで検索プロバイダーを選択できます。

| プロバイダー | APIキー | 安定性 | 特徴 |
|-------------|---------|--------|------|
| **Brave Search**（推奨） | 必要 | 高 | 公式API、月2,000クエリ無料 |
| **DuckDuckGo** | 不要 | 中 | 非公式、レート制限あり |

Brave Search APIを使用する場合、モード選択の「検索して要約」アイコンがオレンジ色で表示されます。

### Brave Search API の設定

1. [Brave Search API](https://brave.com/search/api/) でアカウント作成（無料）
2. APIキーを発行
3. アプリ環境設定 → LLM設定 → Web検索API で「Brave Search」を選択
4. APIキーを入力

### 仕組み

**Brave Search API使用時:**
```
ユーザー入力 → Brave Search API → JSON検索結果 → LLMで要約
```

**DuckDuckGo使用時（フォールバック）:**
```
ユーザー入力 → DuckDuckGo HTML版へリクエスト → HTMLをパース → 検索結果を抽出 → LLMで要約
```

### 処理フロー

1. ユーザーが検索クエリを入力
2. `/api/search`が設定されたプロバイダーにリクエスト
3. 検索結果（最大3件）を抽出し、各URLの本文も取得
4. 検索結果をプロンプトに埋め込み、LLMに送信
5. LLMが検索結果を要約して回答を生成

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
