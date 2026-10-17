import MeetupHeader from './MeetupHeader.jsx';
import MapPanel from './MapPanel.jsx';
import DelayReport from './DelayReport.jsx';
import MemberStatusList from './MemberStatusList.jsx';
import styles from './MeetupScreen.module.css';

/**
 * 画面全体の組み立てだけを担当する。ロジックは持たず、データとコールバックは全部 props で受け取る。
 * 各部品は単独でも使えるので、担当ごとに個別に作り込める。
 *
 * @param {string} title
 * @param {string} [time]
 * @param {number} [thresholdM=500]
 * @param {React.ReactNode} [map]      地図コンポーネント(MapPanel の children になる)
 * @param {Array} members              MemberStatusList の members と同じ形
 * @param {string} [meId]
 * @param {number | 'arrived' | null} [myReport]
 * @param {(value: number | 'arrived') => void} onReport
 */
export default function MeetupScreen({ title, time, thresholdM = 500, map, members, meId, myReport, onReport }) {
  return (
    <div className={styles.screen}>
      <MeetupHeader title={title} time={time} className={styles.section} />
      <MapPanel thresholdM={thresholdM} className={styles.section}>
        {map}
      </MapPanel>
      <DelayReport selected={myReport} onReport={onReport} className={styles.section} />
      <MemberStatusList members={members} thresholdM={thresholdM} meId={meId} className={styles.section} />
    </div>
  );
}
