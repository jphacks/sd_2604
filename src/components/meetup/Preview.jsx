import { useState } from 'react';
import { MeetupScreen } from './index.js';
import { mockMembers } from './mock.js';

// http://localhost:5173/preview で見られる確認用ページ(本番の画面ではない)
export default function Preview() {
  const [myReport, setMyReport] = useState(null);

  return (
    <div style={{ padding: 12 }}>
      <MeetupScreen
        title="仙台駅ペデストリアンデッキ集合"
        time="19:00"
        members={mockMembers}
        meId="c"
        myReport={myReport}
        onReport={(v) => {
          console.log('report:', v);
          setMyReport(v);
        }}
      />
    </div>
  );
}
