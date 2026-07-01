## バックエンドドメインロジックのテスト強化（DB非依存化・LateStayCheck・CSV/デモデータ）
id: 01
skill: pr-workflow
branch-slug: backend-test-strengthening
github_issue: 1
status: open
type: fix
対象: src/Api.Tests/ClockInTests.cs, src/Api.Tests/AttendanceApi.Tests.csproj, src/Api/Services/LateStayCheckService.cs, src/Api.Tests/LateStayCheckServiceTests.cs (新規), src/Api/Services/AttendanceService.cs, src/Api/Endpoints/AttendanceEndpoints.cs, src/Api.Tests/CsvExportTests.cs (新規)
内容: バックエンドの単体テストが薄い3領域をまとめて強化する。(1) ClockInTests.cs が実PostgreSQL接続前提でローカルにPostgres未起動だと必ず失敗する問題を解消し軽量単体テストを追加、(2) 深夜労働自動警告 LateStayCheckService に判定ロジックのテストを追加、(3) CSVエクスポート・デモデータ投入の整形ロジックにテストを追加。いずれも検証手段は `dotnet test` で共通。
確認: `dotnet test src/Api.Tests/AttendanceApi.Tests.csproj` がPostgres未起動でも新規追加分すべて成功すること。既存のDB依存結合テスト(ClockInTests)は維持または明示的に区別されていることを目視確認する。

---
## 詳細

### (1) ClockIn/AttendanceService の単体テスト化
- `ClockInTests.cs` は `NpgsqlConnection` を直接生成し実DBに接続する構成のため軽量に回せない。
- `AttendanceService` のDB非依存ロジック（打刻時刻の丸め、重複打刻判定、SignalR Push呼び出しなど）を洗い出し、モック化した軽量単体テストを追加する（新規ファイル可、例: `AttendanceServiceUnitTests.cs`）。
- 既存 `ClockInTests.cs` は結合テストとして維持しつつ、DB未起動時にも新規テストとは独立して扱えるようにする（大規模リファクタは不要、既存構造は極力変えない）。

### (2) LateStayCheckService のテスト追加
- `CheckLateStaysAsync` は SQL発行〜Push送信が一つのメソッドに直書きされている。判定条件「当日clock_inあり・clock_outなし・現在時刻 > avg_clockout_time + 1h」の判定部分を、テスト可能な最小限の単位に抽出する。
- 境界値（ちょうど1時間・1時間未満・1時間超過）を含むテストケースを追加。SignalR Push (`IHubContext<AttendanceHub>`) はモックで検証する。

### (3) CSVエクスポート・デモデータ投入ロジックのテスト追加
- CSV生成部分（行整形・エスケープ・カラム順・日時フォーマット）をDB非依存で検証する単体テストを追加する。
- デモデータ投入ロジックについては、投入レコードの整合性（必須項目充足・重複なし）を検証するテストを追加する。DB書き込み自体はモックまたはテスト用インメモリ実装で代替する。

### 実装順序
1. (1) ClockIn/AttendanceService 分離・単体テスト追加
2. (2) LateStayCheckService 分離・単体テスト追加
3. (3) CSV/デモデータ ロジック分離・単体テスト追加
4. `dotnet test` で全体確認
