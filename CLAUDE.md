# CLAUDE.md

@context/conventions.md
@context/structure.md

Claude Code は本ファイルを最優先の指示として実行すること。

## 動作フロー
- 起動時に `issues/` 内の対象 Issue（`status: open`）を確認する。
- 実装開始前に `context/conventions.md` と `context/structure.md` を読み、規約と構造を把握する。
- ローカル環境にて `claude/{id}-{branch-slug}` ブランチ上で作業していることを認識する。
- 実装・検証・PR 作成はグローバルの `pr-workflow` スキル（`~/.claude/skills/pr-workflow/SKILL.md`）の手順に従う。

## コマンド
- API ビルド（構文・型チェック）: `dotnet build src/Api/AttendanceApi.csproj`
- API テスト: `dotnet test src/Api.Tests/AttendanceApi.Tests.csproj`（xUnit）
- フロントエンド型チェック/ビルド: `cd src/Web && npm ci && npm run build`

## アーキテクチャの要点
- バックエンドは .NET 8 Minimal API（`src/Api`）。エンドポイントは `Endpoints/`、ドメイン計算は `Services/AttendanceCalculator.cs` に分離しテスト可能にしている。
- リアルタイム出勤ボードは SignalR（`Hubs/AttendanceHub.cs`）で配信する。
- フロントエンドは React + TypeScript + Vite（`src/Web`）。API 呼び出しは `src/api.ts` に集約。
- 永続層は PostgreSQL（Dapper）。スキーマ/シードは `infrastructure/db/` にある。

## 検証手段
- PR 前の Agent 側確認は `dotnet build`（コンパイル＝静的確認）と `dotnet test`、フロントの `npm run build` まで。
- 動作確認（Docker 起動・ブラウザ確認）は user が Mac ローカルで実施。手順は PR の `## 検証手順` に記載する。

> 禁止・強制（docker / ssh / rsync / git push 等の遮断）は `.claude/settings.json` の deny で管理する。本ファイルには書かない。
