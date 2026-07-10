## PR記録: cleanup: .NET 8 → .NET 10 (LTS) へのアップグレード
issue: 06 (06_dotnet10_upgrade.md)
PR: https://github.com/yktsnet/attendance-system-migration/pull/12
Merged: c706bcb31b26a5a3a9de112dcba5532e499959aa

## 変更内容
.NET 8 は2026-11-10にEOLを迎えるため、次期LTSである.NET 10へ移行した。9を経由せず8→10へ直接アップグレード。

- `src/Api/AttendanceApi.csproj`: TargetFramework を net10.0 に変更。パッケージを更新（BCrypt.Net-Next 4.2.1 / Dapper 2.1.79 / Microsoft.AspNetCore.Authentication.JwtBearer 10.0.9 / Npgsql 10.0.3 / Swashbuckle.AspNetCore 9.0.6）
- `src/Api.Tests/AttendanceApi.Tests.csproj`: TargetFramework を net10.0 に変更。Npgsql を Api側と同一の10.0.3に統一。Microsoft.NET.Test.Sdk 18.7.0 / xunit 2.9.3 / xunit.runner.visualstudio 3.1.5 / coverlet.collector 10.0.1 に更新
- `src/Api/Dockerfile`: ビルド・ランタイムステージのSDK/ASP.NETタグを10.0に更新
- `.github/workflows/ci.yml` / `.github/workflows/deploy.yml`: dotnet-version を '10.0.x' に更新

**Swashbuckle.AspNetCoreのバージョン選定について**: 最新の10.x系はMicrosoft.OpenApi 2.xに依存し、`Microsoft.OpenApi.Models`名前空間が`Microsoft.OpenApi`に変わる破壊的変更を含む（`Program.cs`のusing文修正が必要になる）。本Issueのスコープはcsproj/Dockerfile/CI設定に限定されており、ロジック・コード変更は不要としたい方針のため、net10.0で動作しMicrosoft.OpenApi 1.x（旧名前空間）を維持する最新の9.x系（9.0.6）を採用した。net10.0向けの明示的なdependency groupは無いが、net9.0向けgroupがフォールバックとして解決され、Microsoft.AspNetCore.Appのframework referenceで問題なく動作することをビルドで確認済み。

## 静的確認結果
- `dotnet build src/Api/AttendanceApi.csproj` (dotnet SDK 10.0.202, nix-shell経由): Build succeeded. 0 Warning(s), 0 Error(s)
- `dotnet test src/Api.Tests/AttendanceApi.Tests.csproj`: Passed! 35/35, 0 Failed, 0 Skipped
- `grep -rln "net8\.0\|8\.0\.x" --include="*.csproj" --include="Dockerfile" --include="*.yml"`: 対象ファイルに8.0系の表記は残っていないことを確認
- `git diff --name-only --cached`:
  - .github/workflows/ci.yml
  - .github/workflows/deploy.yml
  - src/Api.Tests/AttendanceApi.Tests.csproj
  - src/Api/AttendanceApi.csproj
  - src/Api/Dockerfile
  （issueの「対象」フィールドと完全一致）

## 検証手順
- `docker compose build` でDockerイメージが .NET 10 SDK/ASP.NETランタイムで正常にビルドできることをuserが確認
- ローカル起動後、Swagger UI（`/api-docs`）・打刻・SignalRリアルタイム出勤ボードが従来通り動作することを目視確認
