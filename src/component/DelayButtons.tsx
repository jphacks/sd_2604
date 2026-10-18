
interface DelayButtonsProps {
  onAddDelay: (minutes: number) => void;
  onArrive: () => void;
  timerText?: string | null; 
}
export function DelayButtons({ onAddDelay, onArrive ,timerText }: DelayButtonsProps) {
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '400px',
      background: 'white',
      padding: '16px',
      borderRadius: '16px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
      zIndex: 100,
    }}>
  {timerText ? (
    // ★タイマーの文字があるときはタイマーを表示
    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
      <span style={{ fontSize: '12px', color: '#666' }}>⏳ 到着予定まで残り</span>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4757' }}>{timerText}</div>
    </div>
  ) : (
    // ★タイマーがない時は元のメッセージを表示
    <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#555', textAlign: 'center' }}>
      🚨 遅れそう？（1タップで共有・謝罪文ナシ）
    </p>
  )}

      {/* 遅延追加ボタン */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <button
          onClick={() => onAddDelay(5)}
          style={{ padding: '14px 0', fontSize: '16px', fontWeight: 'bold', background: '#fff3cd', border: '1px solid #ffeba8', borderRadius: '10px', cursor: 'pointer' }}
        >
          +5分
        </button>
        <button
          onClick={() => onAddDelay(15)}
          style={{ padding: '14px 0', fontSize: '16px', fontWeight: 'bold', background: '#ffe8cc', border: '1px solid #ffd8a8', borderRadius: '10px', cursor: 'pointer' }}
        >
          +15分
        </button>
        <button
          onClick={() => onAddDelay(30)}
          style={{ padding: '14px 0', fontSize: '16px', fontWeight: 'bold', background: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: '10px', cursor: 'pointer' }}
        >
          +30分
        </button>
      </div>
    </div>
  );
}