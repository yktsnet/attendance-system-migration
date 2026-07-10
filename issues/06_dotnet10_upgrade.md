## .NET 8 → .NET 10 (LTS) へのアップグレード
id: 06
skill: pr-workflow
branch-slug: dotnet10-upgrade
github_issue:
status: open
type: cleanup
対象: src/Api/AttendanceApi.csproj, src/Api.Tests/AttendanceApi.Tests.csproj, src/Api/Dockerfile, .github/workflows/ci.yml, .github/workflows/deploy.yml
内容: .NET 8 は2026-11-10にEOL（サポート終了）を迎える。次期LTSである.NET 10へ移行し、TargetFramework・関連パッケージ・Docker/CIのSDKバージョンを揃える。
確認: `dotnet build` / `dotnet test` がエラー・警告なく通ること（特にNullable/Analyzer関連の新規警告に注意）。全ファイルで `net8.0` 表記・`8.0.x` 表記が残っていないことをgrepで確認。
---
## 背景

.NET 8はLTSとして2026-11-10にEOLを迎える（[.NET Blog](https://devblogs.microsoft.com/dotnet/dotnet-8-9-end-of-support/)）。次のLTSは.NET 10（〜2028-11サポート）。.NET 9は非LTS(STS)で.NET 8と同時期にEOLを迎えるため、9を経由せず10へ直接上げる。

依存関係はMinimal API・Dapper・Npgsql・JwtBearer・Swashbuckle・BCrypt.Net-Next・xUnit/Moq・SignalR(組込み)という標準構成で、.NET 8→10間で削除されたAPIは使用していない見込み。ロジック変更は基本的に不要で、TargetFramework・パッケージバージョン・SDKタグの整合が主な作業。

**既知の不整合**: 現状すでに `src/Api/AttendanceApi.csproj` は `Npgsql 8.0.3`、`src/Api.Tests/AttendanceApi.Tests.csproj` は `Npgsql 10.0.3` とバージョンがズレている。このIssueで両方を.NET 10対応の同一バージョンに揃える。

## 変更方針

### `src/Api/AttendanceApi.csproj`
- `<TargetFramework>net8.0</TargetFramework>` → `net10.0`
- 各パッケージを.NET 10対応バージョンへ更新（`Npgsql`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Dapper`, `Swashbuckle.AspNetCore`, `BCrypt.Net-Next`）。JwtBearerはASP.NET Core本体とメジャーバージョンを合わせる（10.0.x系）

### `src/Api.Tests/AttendanceApi.Tests.csproj`
- `<TargetFramework>net8.0</TargetFramework>` → `net10.0`
- `Npgsql` を Api側と同一バージョンに統一
- `Microsoft.NET.Test.Sdk` / `xunit` / `xunit.runner.visualstudio` / `coverlet.collector` も必要なら最新へ

### `src/Api/Dockerfile`
- ビルドステージ: `mcr.microsoft.com/dotnet/sdk:8.0` → `mcr.microsoft.com/dotnet/sdk:10.0`
- ランタイムステージ: `mcr.microsoft.com/dotnet/aspnet:8.0` → `mcr.microsoft.com/dotnet/aspnet:10.0`

### `.github/workflows/ci.yml`
- `dotnet-version: '8.0.x'` → `'10.0.x'`（35行目）

### `.github/workflows/deploy.yml`
- `dotnet-version: '8.0.x'` → `'10.0.x'`（32行目）

## 実装順序
1. `AttendanceApi.csproj` / `AttendanceApi.Tests.csproj` のTargetFramework・パッケージ更新
2. ローカルで `dotnet build` / `dotnet test` が通ることを確認
3. `Dockerfile` のSDK/ASP.NETタグ更新
4. CIワークフロー2本の `dotnet-version` 更新

## 参考
- README.md / README.en.md / context/*.md 等に「.NET 8」という表記が複数箇所あるが、これはドキュメント更新の話であり本Issueのスコープ外（別Issueで扱う）
