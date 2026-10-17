import styles from './MeetupHeader.module.css';

/**
 * 集合場所と時刻を表示するヘッダー。表示だけで状態は持たない。
 * @param {string} title  集合場所(例: "仙台駅ペデストリアンデッキ集合")
 * @param {string} [time] 集合時刻(例: "19:00")。省略すると場所だけ表示
 */
export default function MeetupHeader({ title, time, className = '' }) {
  return (
    <header className={`${styles.header} ${className}`}>
      <h1 className={styles.title}>{title}</h1>
      {time && <span className={styles.time}>（{time}）</span>}
    </header>
  );
}
