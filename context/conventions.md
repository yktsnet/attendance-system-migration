# attendance-system-migration 開発規約

コードの書き方・編集の共通ルール（どう書くか）。ディレクトリ構成・データフローは `structure.md` を参照。

## 1. 技術スタック
- **バックエンド**: .NET 8 Minimal API + SignalR。テストは xUnit。
- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS。
- **データベース**: PostgreSQL（Dapper による軽量アクセス、ORM フル機能には依存しない）。
- **インフラ**: Docker Compose、GitHub Actions（CI/CD）、Cloudflare Tunnel（デモ公開）、NixOS（オンプレ）。

## 2. コードスタイル
- C# は `dotnet format` でフォーマットを統一する。Nullable 参照型を有効にした前提で書く。
- ドメインの計算ロジック（休憩控除・端数処理・残業割増）は `Services/AttendanceCalculator.cs` に集約し、エンドポイントから切り離してテスト可能に保つ。
- TypeScript は型を明示し、API レスポンスの型は `src/Web/src/types.ts` に集約する。API 呼び出しは `src/Web/src/api.ts` を経由する（コンポーネントから直接 fetch しない）。

## 3. ファイル編集戦略
- **広範囲の書き換え**: 変更箇所が多い場合（目安: 10箇所以上、またはファイルの20%超）、`str_replace` の繰り返しではなく `bash` でファイル全体を一括書き出す（`cat > path << 'EOF'` 等）。
- **局所的修正**: 数行以内の修正に限定してツールを使用。
- **静的チェック**: C# 変更時はホスト側で以下を実行しコンパイルを通す。
  ```bash
  dotnet build src/Api/AttendanceApi.csproj
  ```
  計算ロジックを変更した場合は `dotnet test src/Api.Tests/AttendanceApi.Tests.csproj` を実行する。
- **Nix 環境前提**: ホストは Nix 管理。`npm install -g` 等のグローバルインストールは禁止（環境を汚す）。標準で入っていないツールが要る場合のみ、使い捨てシェル `nix-shell -p {pkg} --run "..."` で実行する。
