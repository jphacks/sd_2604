# meetup コンポーネント(UIモックの4ブロック)

モック画面を「ヘッダー / 地図 / ワンタップ報告 / メンバー状況」に分けた部品です。
各部品は **props だけで動き、通信やGPSには依存しません**。担当ごとに中身を作り込めます。

確認方法: `npm run dev` のあと http://localhost:5173/preview を開く(仮データ入り)。

## ファイル構成

| ファイル | 役割 | 状態 |
|---|---|---|
| `MeetupScreen.jsx` | 4部品を並べるだけの組み立て役 | なし |
| `MeetupHeader.jsx` | 集合場所と時刻 | なし |
| `MapPanel.jsx` | 地図の枠と説明バー。地図は children で差し込む | なし |
| `DelayReport.jsx` | +5分 / +15分 / +30分 / 到着! の4ボタン | なし |
| `MemberStatusList.jsx` | メンバーごとの状況と「待つ側への提案」 | なし |
| `*.module.css` | 各部品のスタイル(CSS Modules) | - |
| `mock.js` / `Preview.jsx` | 確認用の仮データと確認ページ | - |

## props 仕様(リーダーの整合性確認用)

### MeetupScreen
| prop | 型 | 必須 | 説明 |
|---|---|---|---|
| `title` | string | ○ | 集合場所 |
| `time` | string | | 集合時刻 `"19:00"` |
| `thresholdM` | number | | ピン表示に切り替わる距離。既定 500 |
| `map` | ReactNode | | 地図(RoomMap など) |
| `members` | Member[] | ○ | 下記 |
| `meId` | string | | 自分のid |
| `myReport` | number \| `'arrived'` \| null | | 自分の現在の報告 |
| `onReport` | `(value) => void` | ○ | 押された報告。分(数値)か `'arrived'` |

### Member
| 項目 | 型 | 説明 |
|---|---|---|
| `id` | string | |
| `name` | string | |
| `status` | `'arrived'` \| `'near'` \| `'late'` \| `'unknown'` | 到着済み / 圏内 / 遅れ / 位置不明 |
| `lateMin` | number | `late` のときの遅れ(分) |
| `distM` | number | 目的地までの距離(m) |
| `transport` | string | 移動手段(電車 など)。Issue #9 の結果を入れる想定 |
| `suggestion` | string | 待つ側への提案。あれば💡付きで表示 |

### DelayReport
`options`(既定 `[5,15,30]`)/ `onReport` / `selected` / `disabled`

### MapPanel
`thresholdM`(既定 500)/ `children`(無ければ「ここに地図が入ります」を表示)

## 他のIssueとのつなぎ込み(担当者向け)

| Issue | つなぐ先 |
|---|---|
| #2 地図周辺機能の抽出 | `MemberStatusList` の `suggestion` |
| #6 距離の概要の計算 | `Member.status` / `distM`、`thresholdM` の判定 |
| #7 近づいたら通知 | `status === 'near'` への変化 |
| #9 何かで移動しているか | `Member.transport` |
| 500m外は「ざっくり範囲」 | `MapPanel` の children に入れる地図側で実装 |

## ルール
- 部品の中で `socket` や `navigator.geolocation` を直接使わない(データは props で受け取る)
- スタイルは各 `*.module.css` に書く。色は `src/styles.css` の `:root` の変数を使う
- props の名前や型を変えるときは、このREADMEも同じPRで更新する
- 既存ファイルの変更は `src/App.jsx` の2か所だけ(`/preview` ルートの追加)。下記を手で足す

```jsx
import Preview from './components/meetup/Preview.jsx';          // import群の末尾に追加
if (path === '/preview') return <Preview />;                    // `const m = path.match(...)` の直前に追加
```
