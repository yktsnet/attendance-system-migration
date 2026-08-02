# attendance-system-migration ディレクトリ構造

どこに何があるか。コードの書き方（規約）は `conventions.md` を参照。

## トップレベル

```
attendance-system-migration/
├── src/              # アプリ本体（Api / Web）
├── infrastructure/   # DB 初期化・シード
├── legacy/           # 移行元 WebForms（Before の参照用）
├── docker-compose.yml # ローカル/本番コンテナ構成
├── context/          # Agent 向け共通コンテキスト（本ファイル群）
└── issues/           # ローカル Issue 管理（done/ に完了分と PR 控え）
```

## src/

```
src/
├── Api/                    # .NET 10 Minimal API
│   ├── Program.cs          # エントリポイント・DI・SignalR/エンドポイント登録
│   ├── Endpoints/          # ルート定義（Attendance / Auth / Employee）
│   ├── Services/           # ドメインロジック
│   │   ├── AttendanceCalculator.cs    # 休憩控除・端数処理・残業割増（純粋ロジック）
│   │   ├── AttendanceService.cs       # 打刻・集計
│   │   ├── EmployeeService.cs         # 社員管理
│   │   ├── DailyProfileUpdateService.cs # 平均退勤プロファイル更新
│   │   └── LateStayCheckService.cs    # 未退勤アラート検知
│   └── Hubs/AttendanceHub.cs # SignalR ハブ（リアルタイム出勤ボード）
├── Api.Tests/              # xUnit（計算ロジック・打刻のテスト）
└── Web/                    # React + TypeScript + Vite
    └── src/
        ├── api.ts          # API 呼び出しの集約
        ├── types.ts        # API レスポンス型
        └── components/     # 画面コンポーネント（Dashboard・ClockPanel 等）
```

## データフロー

```
打刻（ClockPanel） → API（AttendanceEndpoints） → AttendanceService → PostgreSQL
                                                        ↓
                                            AttendanceHub（SignalR）
                                                        ↓
                                  リアルタイム出勤ボード（Dashboard）へ push
給与計算・集計 ← AttendanceCalculator（休憩控除/端数/残業割増）← PostgreSQL
```

## レイヤー構成

- **表示層**: `src/Web`（React/Vite）。`api.ts` 経由で API を叩き、SignalR で出勤ボードを購読。
- **API 層**: `src/Api/Endpoints`。Minimal API でルートを定義。
- **ドメイン層**: `src/Api/Services`。計算ロジックを `AttendanceCalculator` に分離してテスト可能に。
- **リアルタイム層**: `src/Api/Hubs`（SignalR）。
- **永続層**: PostgreSQL（Dapper）。初期化/シードは `infrastructure/db/`。

## issues/

- `{NN}_{slug}.md`: 実装対象 Issue。`status: open` のものを Agent が処理。
- `00_template.md`: Issue ひな形。
- `done/`: 完了 Issue と PR 控え（`{id}_{slug}_pr.md`）。
