## フロントエンド(React)テスト基盤の導入
id: 04
skill: pr-workflow
branch-slug: frontend-test-setup
github_issue: 3
status: open
type: feat
対象: src/Web/package.json, src/Web/vite.config.ts, src/Web/src/components (テスト対象を精査), src/Web/src/*.test.tsx (新規)
内容: src/Web に React 側のテストが一切ない。Vitest + Testing Library でテスト基盤を導入し、主要コンポーネント・api.ts のロジックに対するテストを追加する。
確認: `cd src/Web && npm ci && npm run build` が通ること。追加した `npm test`（または相当スクリプト）がローカルで実行でき全テスト成功することを目視確認する。

---
## 詳細

### 背景
`src/Web` は React + TypeScript + Vite 構成だが、テストランナー・テストファイルが一切存在しない。

### 対応方針
- `vitest` + `@testing-library/react` を devDependencies に追加し、`package.json` に `test` スクリプトを追加する。
- `src/api.ts` に集約された API 呼び出しロジック（レスポンス整形・エラーハンドリング）に対する単体テストを追加する。
- `src/components` 配下の主要コンポーネントのうち、ロジックを持つもの（フォーム入力、打刻ボタンの状態遷移など）を対象にレンダリング/インタラクションテストを追加する。表示のみの単純なコンポーネントは対象外でよい。
- SignalR (`@microsoft/signalr`) を使う箇所はモック化する。

### 実装順序
1. `package.json` にテスト依存追加、vitest 設定
2. `src/api.ts` の単体テスト
3. 主要コンポーネントのテスト
4. `npm run build` / 新テストスクリプトで最終確認
