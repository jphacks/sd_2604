import type { Destination, MemberStatus } from './mapTypes'
import './MemberStatusPanel.css'

interface MemberStatusPanelProps {
  members: MemberStatus[]
  destination: Destination | null
  meetingTime?: string
}

function getEstimatedArrivalDate(member: MemberStatus): Date | null {
  if (member.status === 'arrived' || member.etaMinutes === 0) {
    return new Date()
  }
  if (member.etaMinutes === null || member.etaMinutes === undefined) {
    return null
  }
  const totalMinutes = member.etaMinutes + Math.max(0, member.delayMinutes)
  return new Date(Date.now() + totalMinutes * 60_000)
}

function formatArrivalTime(member: MemberStatus): string {
  if (member.status === 'arrived') return '到着済'
  const arrivalDate = getEstimatedArrivalDate(member)
  if (!arrivalDate) return '--:--'
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(arrivalDate)
}

function getArrivalStatus(member: MemberStatus, meetingTime?: string): 'on-time' | 'late' | 'unknown' {
  if (member.status === 'arrived') return 'on-time'
  if (!meetingTime) return 'unknown'
  const meetingAt = new Date(meetingTime).getTime()
  if (!Number.isFinite(meetingAt)) return 'unknown'

  const arrivalDate = getEstimatedArrivalDate(member)
  if (!arrivalDate) return 'unknown'

  return arrivalDate.getTime() <= meetingAt ? 'on-time' : 'late'
}

export default function MemberStatusPanel({ members, meetingTime }: MemberStatusPanelProps) {
  const onTimeCount = members.filter((member) => getArrivalStatus(member, meetingTime) === 'on-time').length

  return (
    <section className="member-status" aria-labelledby="member-status-title">
      <header className="member-status__header">
        <h2 id="member-status-title">state</h2>
        <span className="member-status__count" aria-label="間に合う見込みの人数">
          {onTimeCount}/{members.length} 間に合う
        </span>
      </header>

      {members.length > 0 ? (
        <ul className="member-status__list">
          {members.map((member) => {
            const hasLocation = member.lat !== null && member.lng !== null
            const arrivalStatus = getArrivalStatus(member, meetingTime)
            const statusLabel =
              arrivalStatus === 'on-time'
                ? '間に合う見込み'
                : arrivalStatus === 'late'
                  ? '遅れる見込み'
                  : '計測中'

            return (
              <li className="member-status__row" key={member.id}>
                <span
                  className={`member-status__bool${hasLocation ? (member.locationJammed ? ' is-jammed' : ' is-active') : ''}`}
                  title={hasLocation ? (member.locationJammed ? '位置共有中（概算）' : '位置共有中') : '位置情報なし'}
                  aria-label={hasLocation ? '位置情報あり' : '位置情報なし'}
                />
                <span
                  className={`member-status__avatar${member.locationJammed ? ' is-jammed' : ''}`}
                  aria-hidden="true"
                >
                  {member.name.slice(0, 1)}
                </span>
                <strong className="member-status__name">{member.name}</strong>
                <time className="member-status__eta-time" aria-label="到着予想時刻">
                  {formatArrivalTime(member)}
                </time>
                <span className={`member-status__verdict is-${arrivalStatus}`}>
                  {statusLabel}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="member-status__empty">位置共有を開始したメンバーがここに表示されます。</p>
      )}
    </section>
  )
}