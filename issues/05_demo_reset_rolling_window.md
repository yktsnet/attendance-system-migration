## デモリセットを冪等なローリングウィンドウ再生成に修正
id: 05
skill: pr-workflow
branch-slug: demo-reset-rolling-window
github_issue:
status: open
type: fix
対象: src/Api/Services/AttendanceService.cs, src/Api.Tests/CsvExportTests.cs, src/Web/src/components/ClockPanel.tsx
内容: デモリセット（`POST /demo/reset`）が「昨日まで補完」と謳いながら、実際には前回押下時にできた1日分のギャップしか埋まらないバグを修正する。固定開始日（2025-12-01）による無限成長ウィンドウをやめ、直近60日のローリングウィンドウを毎回全削除→全再生成する冪等な設計に変更し、UI文言もウィンドウ幅が固定であることが分かるように更新する。
確認: `ResetForDemoAsync` を2回連続実行しても3回目以降と同じ件数・同じ状態になること（冪等性）を目視確認。既存の `GenerateDemoRecords_*` テストがウィンドウ幅変更後も意味を保つか確認し、必要なら期間引数を60日相当に調整。
---
## 背景・原因

`AttendanceService.ResetForDemoAsync`（[src/Api/Services/AttendanceService.cs:233](../src/Api/Services/AttendanceService.cs)）は以下の理由で「リセット」の名に反して差分パッチにしかなっていない。

1. `DELETE FROM attendance_logs WHERE DATE(clock_in) = CURRENT_DATE` — **今日**の分しか削除しない
2. `GenerateDemoRecords` の生成範囲は `DemoStartDate(2025-12-01固定)` 〜 `yesterday`
3. `GenerateDemoRecords` は `existingDates` に含まれる日付をスキップする（[src/Api/Services/AttendanceService.cs:283-284](../src/Api/Services/AttendanceService.cs)）

このため、削除対象（今日）と生成対象（〜昨日）が噛み合わず、押すたびに「前回押下で空いたまま放置された1日分」だけが埋まるように見える。加えて `DemoStartDate` が固定日のため、時間が経つほど対象期間が伸び続け、リセットのたびに削除・生成する件数が増加する。

デモの目的は (a) 月次CSV/給与計算/遅刻チェックなど履歴が要る機能を試せるようにする過去データの提供、(b) 訪問者がその場で出勤/退勤を打刻して体験できるよう当日を空けておくこと、の2点。過去データは直近1〜2ヶ月あれば十分で、8ヶ月超の履歴は不要。

## 変更方針

### `src/Api/Services/AttendanceService.cs`
- `DemoStartDate` の固定日をやめ、「今日から60日前」を都度計算するローリング開始日にする（例: `DateOnly.FromDateTime(DateTime.Today.AddDays(-60))`）
- `ResetForDemoAsync` の DELETE 対象を「ローリングウィンドウ全体（開始日〜今日）」に揃える（今日も含めて一旦削除してよい。生成側で今日は対象外のまま空くので実質的に「今日はクリア」という現行仕様は維持される）
- `GenerateDemoRecords` は「既存日付スキップ」を使わず、呼び出し側で対象ウィンドウを毎回空にしてから全件生成する形にする（`existingDates` 引数は不要になる可能性があるため、シグネチャ変更するか、常に空集合を渡すかは実装時に判断してよい）
- 目的は「同じ日に何度押しても同じ状態に収束する」冪等性

### `src/Api.Tests/CsvExportTests.cs`
- `GenerateDemoRecords_*` の既存4テストがシグネチャ変更の影響を受けないか確認し、影響があれば追従する
- 可能であれば `ResetForDemoAsync` 相当のロジック（DELETE範囲と生成範囲が一致していること）を検証するテストを追加する。DB接続が必要な場合は、範囲計算部分だけを純粋関数として切り出してテスト対象にすることも検討してよい

### `src/Web/src/components/ClockPanel.tsx`
- 補足テキスト「昨日まで補完・今日をクリア」（79-109行目付近）を、固定ウィンドウ幅であることが伝わる文言に更新する（例: 「直近60日を再生成・当日は打刻体験用に空欄」）
- 成功メッセージ「リセット完了。昨日まで補完済み」も同様に更新する
- ボタン名「デモリセット」自体は変更不要（実装が冪等になれば名前と整合する）

## 実装順序
1. `AttendanceService.cs` のロジック修正
2. 既存テストの追従・新規テスト追加
3. `ClockPanel.tsx` の文言更新
