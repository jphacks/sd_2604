import styles from './MemberStatusList.module.css';

// 他のファイルに依存しないよう、この部品の中に持つ(1000m未満は m、以上は km)
function formatDist(m) {
  if (m == null) return '--';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** status の種類: arrived 到着済み / near 圏内 / late 遅れ / unknown 位置不明 */
function statusText(m, thresholdM) {
  switch (m.status) {
    case 'arrived':
      return '到着済み 🎉';
    case 'near':
      return `${thresholdM}m圏内（もうすぐ到着！）`;
    case 'late': {
      const where = [m.distM != null ? `現在地: ${formatDist(m.distM)}手前` : null, m.transport]
        .filter(Boolean)
        .join(' / ');
      return `+${m.lateMin ?? '?'}分遅れ${where ? `（${where}）` : ''}`;
    }
    default:
      return '位置待ち…';
  }
}

/**
 * メンバーの状況一覧。遅れている人には「待つ側への提案」を添えて出せる。
 *
 * @param {Array<{
 *   id: string, name: string,
 *   status: 'arrived'|'near'|'late'|'unknown',
 *   lateMin?: number, distM?: number, transport?: string, suggestion?: string
 * }>} members
 * @param {number} [thresholdM=500] near のときの文言に使う距離(m)
 * @param {string} [meId] 自分のid。一致する人に「(あなた)」を付ける
 */
export default function MemberStatusList({ members, thresholdM = 500, meId, className = '' }) {
  return (
    <section className={`${styles.list} ${className}`} aria-label="メンバーの状況">
      <h2 className={styles.heading}>メンバーの状況</h2>
      {members.length === 0 ? (
        <p className={styles.empty}>まだ誰も参加していません</p>
      ) : (
        <ul className={styles.items}>
          {members.map((m) => (
            <li key={m.id} className={`${styles.item} ${styles[m.status] ?? ''}`}>
              <span className={styles.name}>
                {m.name}
                {m.id === meId && '(あなた)'}:
              </span>{' '}
              <span>{statusText(m, thresholdM)}</span>
              {m.suggestion && (
                <p className={styles.suggestion}>
                  <span aria-hidden="true">💡</span> 待つ側への提案:「{m.suggestion}」
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
