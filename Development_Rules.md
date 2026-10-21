# Development_Rules
## 全体の設計思想
### Reactコンポーネント
基本的にデータを受け取って表示するかユーザ操作を受け付けるもののみとする。
ロジックは下記のように適宜既存の.tsを使用、もしくは作成し記述する。
### ロジック
複雑な状態管理やAPI通信はカスタムフックを作成、純粋な計算やデータの永続化は`utils/`に独立させる。
## ディレクトリ構造
### `src/component/`
UIコンポーネント置き場。
1ファイルにつき1コンポーネントで！
### `src/hooks/`
カスタムフック置き場。
useStateとかuseEffectが複雑になりそうだったらここに独立させよう。
### `src/utils/`
Reactに依存しない純粋な関数の置き場。
### `src/types/`
アプリ全体で使い回す型定義の置き場。
コンポーネント専用のpropsはそのままコンポーネントファイルに置いてok。
## スタイリングルール
グローバル汚染を防ぐためCSS Modulesを採用。
命名は`コンポーネント名.module.css`とする。
### 命名規則
キャメルケースを採用。
既存のBEMについては数が多いため一旦放置。
今後追加するコンポーネントや改修を入れたものから順次キャメルケースで記述する。

## バックエンド
バックエンドは `backend/` 配下の Cloudflare Workers + Hono で構成する。
実装の中心は `backend/src/index.ts` で、HTTP API の定義・バリデーション・状態更新・KV への永続化をまとめて扱う。

### 基本方針
- ルートは `Hono` で作成し、全体で `cors()` を有効化する。
- 主要な状態は `room` 単位で扱い、`members` の配列/オブジェクトを含む JSON を返す。
- 本番では Cloudflare KV の `meetpoint_rooms` を使い、キーは `room:{roomId}` の形式で保存する。
- ローカル開発時のみ `roomsStore` のようなメモリ上の保管を使ってよいが、本番互換の設計を優先する。

### API設計
現在の実装に合わせて、ルーム管理系のエンドポイントは次の形を基本とする。
- `POST /api/rooms` : ルーム作成
- `GET /api/rooms/:roomId` : ルーム取得
- `POST /api/rooms/:roomId/join` : 参加者追加
- `POST /api/rooms/:roomId/sync` : 位置情報・到着状態の同期
- `POST /api/rooms/:roomId/delay` : 遅延時間の加算
- `PUT /api/rooms/:roomId/destination` : 目的地更新（オーナーのみ）
- `PUT /api/rooms/:roomId/meeting-time` : 集合時間更新（オーナーのみ）
- `GET /api/rooms/:roomId/map-state` : 地図表示用の状態取得

### バリデーション
- 座標は緯度・経度の範囲チェックを必須とする。
- 目的地更新や集合時間更新は `room.ownerId` を基準に権限確認を行う。
- JSON の型が壊れている場合は `400` を返し、存在しない room には `404` を返す。
- 返却値は `success` フラグと `error` / `message` を含め、フロント側で扱いやすいレスポンスにする。

### データ構造
- `Room` には `id`, `ownerId`, `title`, `targetName`, `targetLat`, `targetLng`, `meetingTime`, `members` を持つ。
- `MemberStatus` には `id`, `name`, `delayMinutes`, `lat`, `lng`, `speed`, `etaMinutes`, `isWithin500m`, `status`, `updatedAt` などを持つ。
- 位置情報の近接判定は 500m 閾値で行い、到着判定は 10m 以内を目安とする。

### 実装ルール
- API の追加や変更を行うときは、エンドポイント名・レスポンス形式・バリデーション・保存先をセットで整える。
- `backend/src/index.ts` が肥大化したら、`routes/` や `service/` などに分離してもよいが、現状の最小構成を崩さないこと。
- `c.env` を経由した Cloudflare の環境変数・KV の利用を前提にし、ローカル用のメモリ変数は開発補助としてのみ扱う。
- 共有状態の更新後は必ず `saveRoom()` を通して KV に保存し、再読込時に状態が壊れないようにする。

## Git,GitHub
例によってmainへの直接push厳禁。
必ずブランチを分けて変更をかけるように。
### issue
思いついたら適宜切る感じで。
できればlabels、types、priorityを埋めてくれると手をつけやすくて嬉しい。

自分がやりたいやつは切ったらちゃんとアサイン入れておこう。

### ブランチ
isuueをベースに

`概要/issue番号-名称`

に統一。
面倒かもだけどの形を心がけていきたい。（見やすい）

概要部は
- feature
- fix
- refactor

が主なやつ

マージ時のメッセージに
`Close #isuue番号`
をつけると勝手にisuue閉じてくれる。

`Fixes #isuue番号`, 
`Resolves #isuue番号`
も機能としては同じだけど意味合いが変わる
### 小さく分けてPRして欲しい
1つのPRに機能追加とリファクタリングを混ぜないように！