## 変更内容

`src/Web` は React + TypeScript + Vite 構成だが、テストランナー・テストファイルが一切存在しなかったため、Vitest + Testing Library でテスト基盤を導入した。

- `vitest` / `@testing-library/react` / `@testing-library/jest-dom` / `@testing-library/user-event` / `jsdom` を devDependencies に追加し、`package.json` に `test`（`vitest run`）スクリプトを追加。
- `vite.config.ts` に `test.environment: 'jsdom'` と `test.setupFiles` を追加し、`src/setupTests.ts` で `@testing-library/jest-dom/vitest` を読み込んでマッチャーを拡張。
- `src/api.ts` の全メソッド（`getEmployees` / `clockIn` / `clockOut` / `getHistory` / `getMonthlySummary` / `login` / `createEmployee` / `deleteEmployee` / `correctAttendance` / `demoReset`）に対する単体テストを `src/api.test.ts` に追加。`fetch` をモックし、リクエスト内容（URL・メソッド・ヘッダー・body）とレスポンス整形（`login` 失敗時に空オブジェクトを返す等）を検証。
- ロジックを持つ主要コンポーネントとして `ClockPanel`（打刻ボタンの状態遷移・成功/409/通信エラー時のメッセージ表示）と `AttendanceCorrectionModal`（バリデーション: 必須項目・時刻の前後関係・休憩時間のマイナス禁止、保存成功/失敗時の挙動）にレンダリング/インタラクションテストを追加。表示のみの単純なコンポーネント（`MonthlySummary` 等）はテスト対象外とした。
- `Dashboard` は SignalR (`@microsoft/signalr`) 接続を持つが、今回はロジックが薄い `ClockPanel` / `AttendanceCorrectionModal` を優先してテスト対象とし、SignalR を直接使うコンポーネントのテストは対象外とした。
- `AttendanceCorrectionModal.tsx` の3つの入力欄に `label htmlFor` / `input id` を追加（既存の `label` と `input` が紐付いていなかったため、`getByLabelText` でのテスト対象選択とアクセシビリティ改善を兼ねて追加。表示・挙動は変更なし）。

## 静的確認結果

- `cd src/Web && npm ci && npm run build` → 成功（`tsc -b` の型チェック含め通過。ビルド時に出る `@microsoft/signalr` 由来の `PURE` annotation 警告はライブラリの dist 内容によるもので、ビルド自体は成功している）。
- `npm test`（`vitest run`）→ 3 ファイル・23 テスト全て成功。
- `npm run lint` → 既存の10件のエラー（`react-hooks/set-state-in-effect` 3件・`no-irregular-whitespace` 2件、他コンポーネント由来）は本PR適用前から存在することを `git stash` で確認済み。本PRの変更により新たなlintエラーは発生していない。
- `git diff --name-only HEAD~1`:
```
src/Web/package-lock.json
src/Web/package.json
src/Web/src/api.test.ts
src/Web/src/components/AttendanceCorrectionModal.test.tsx
src/Web/src/components/AttendanceCorrectionModal.tsx
src/Web/src/components/ClockPanel.test.tsx
src/Web/src/setupTests.ts
src/Web/vite.config.ts
```
  Issueの対象（`package.json` / `vite.config.ts` / `components` / `*.test.tsx`）に加え、`package-lock.json`（`npm install` による自然な追随変更）と `src/setupTests.ts`（`vite.config.ts` の `setupFiles` が参照するテスト基盤ファイル）を含む。

## 検証手順

- ローカルで `cd src/Web && npm ci && npm test` を実行し、全テストが成功することを目視確認する。
- `npm run dev` で打刻履歴の修正モーダル（`AttendanceCorrectionModal`）を開き、ラベルクリックで対応する入力欄にフォーカスが移ることを確認する（`label htmlFor` 追加によるアクセシビリティ改善の確認）。
