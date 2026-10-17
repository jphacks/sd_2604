import styles from './DelayReport.module.css';

export const ARRIVED = 'arrived';

/**
 * 遅れそうなときのワンタップ報告。文章入力は一切なし(押すだけ)。
 *
 * @param {number[]} [options=[5,15,30]] 遅れの選択肢(分)
 * @param {(value: number | 'arrived') => void} onReport 押されたとき。分(数値) か 'arrived'
 * @param {number | 'arrived' | null} [selected] 現在の自分の報告。押した状態の見た目にする
 * @param {boolean} [disabled]
 */
export default function DelayReport({ options = [5, 15, 30], onReport, selected = null, disabled = false, className = '' }) {
  const items = [
    ...options.map((min) => ({ value: min, label: `+${min}分` })),
    { value: ARRIVED, label: '到着！' },
  ];

  return (
    <details className={`${styles.report} ${className}`} open>
      <summary className={styles.summary}>遅れそうなときのワンタップ報告（謝罪文入力一切ナシ!）</summary>
      <div className={styles.buttons}>
        {items.map((it) => (
          <button
            key={it.value}
            type="button"
            className={`${styles.button} ${it.value === ARRIVED ? styles.arrived : ''}`}
            aria-pressed={selected === it.value}
            disabled={disabled}
            onClick={() => onReport?.(it.value)}
          >
            {it.label}
          </button>
        ))}
      </div>
    </details>
  );
}
