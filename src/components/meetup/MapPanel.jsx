import styles from './MapPanel.module.css';

/**
 * 地図の枠。上に「500m外はざっくり範囲 / 500m内でピン表示」の説明バーを出す。
 * 地図そのもの(RoomMap など)は children として差し込む。
 * 「500m外はざっくり範囲」の描画ロジックは、地図を担当する人がここの外(children側)で実装する。
 *
 * @param {number} [thresholdM=500] ピン表示に切り替わる距離(m)
 * @param {React.ReactNode} [children] 地図コンポーネント。無ければ仮の表示を出す
 */
export default function MapPanel({ thresholdM = 500, children, className = '' }) {
  return (
    <section className={`${styles.panel} ${className}`} aria-label="地図">
      <p className={styles.notice}>
        <span aria-hidden="true">🗺️</span> {thresholdM}m外はざっくり範囲 / {thresholdM}m内でピン表示
      </p>
      <div className={styles.body}>
        {children ?? <div className={styles.placeholder}>ここに地図が入ります</div>}
      </div>
    </section>
  );
}
