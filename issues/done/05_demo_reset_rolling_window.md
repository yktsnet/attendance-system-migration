## PR記録: fix: デモリセットを冪等なローリングウィンドウ再生成に修正
issue: 05 (05_demo_reset_rolling_window.md)
PR: https://github.com/yktsnet/attendance-system-migration/pull/10
Merged: e6c6fa08d13220cd70c7e4fc04693d13e151a091

## 変更内容
- `AttendanceService.cs`: 固定開始日 `DemoStartDate`(2025-12-01) を廃止し、`DemoWindowDays`(60日) による直近ローリングウィンドウに変更。
  - `ResetForDemoAsync` の DELETE 対象をローリングウィンドウ全体（開始日〜今日）に揃え、`existingDates` によるスキップを撤廃して毎回全件再生成する冪等設計にした。
  - 削除範囲と生成範囲の算出を `CalcDemoResetWindow`（DB非依存の純粋関数）として切り出し、両範囲の整合性を担保・単体テスト可能にした。
  - `GenerateDemoRecords` から不要になった `existingDates` 引数を削除。
- `CsvExportTests.cs`: シグネチャ変更に伴い既存4テストを追従。既存日付スキップを検証していた `GenerateDemoRecords_SkipsExistingDates` はロジック撤廃に伴い削除し、代わりに同一シード・同一範囲での出力一致（`GenerateDemoRecords_SameSeedAndRange_ProducesIdenticalOutput`）と、`CalcDemoResetWindow` の削除範囲が生成範囲を包含すること・60日幅であること・同日実行で決定的であることを検証するテストを追加。
- `ClockPanel.tsx`: 補足テキストと成功メッセージを固定ウィンドウ幅が伝わる文言（「直近60日を再生成・当日は打刻体験用に空欄」「リセット完了。直近60日を再生成しました」）に更新。

## 静的確認結果
- `dotnet build src/Api/AttendanceApi.csproj` 成功（0 Warning / 0 Error）
- `dotnet test src/Api.Tests/AttendanceApi.Tests.csproj` 成功（35 Passed / 0 Failed）
- `cd src/Web && npm ci && npm run build` 成功
- `git diff --name-only --cached`:
  - src/Api.Tests/CsvExportTests.cs
  - src/Api/Services/AttendanceService.cs
  - src/Web/src/components/ClockPanel.tsx
- `ResetForDemoAsync` の caller（`AttendanceEndpoints.cs` の `POST /demo/reset`）はシグネチャ不変のため影響なしを確認。`GenerateDemoRecords`/`CalcDemoResetWindow` の呼び出し元は本サービス内と新規テストのみであることを確認。

## 検証手順
- `docker compose up` でデモ環境を起動し、UI右上の「デモリセット」ボタンを連続2回押下。1回目・2回目で件数・状態（直近60日分の平日データが入り、当日は空）が同じになることを目視確認する。
