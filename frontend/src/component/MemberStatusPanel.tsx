import type { Destination, MemberStatus } from './mapTypes'
import { formatDistance, getStraightLineDistanceMetres } from './mapMath'
import './MemberStatusPanel.css'

interface MemberStatusPanelProps {
  members: MemberStatus[]
  destination: Destination | null
  meetingTime?: string
}

function getArrivalStatus(member: MemberStatus, meetingTime?: string): 'on-time' | 'late' | 'unknown' {
  if (!meetingTime || member.etaMinutes === null || member.etaMinutes === undefined) return 'unknown'
  const meetingAt = new Date(meetingTime).getTime()
  if (!Number.isFinite(meetingAt)) return 'unknown'

  const estimatedArrival = Date.now() + (member.etaMinutes + Math.max(0, member.delayMinutes)) * 60_000
  return estimatedArrival <= meetingAt ? 'on-time' : 'late'
}

function formatEta(etaMinutes: number | null | undefined): string {
  if (etaMinutes === null || etaMinutes === undefined) return '計測中'
  if (etaMinutes <= 0) return '到着圏内'
  return `約${etaMinutes}分`
}

function formatMeetingTime(meetingTime?: string): string | null {
  if (!meetingTime) return null
  const date = new Date(meetingTime)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function MemberStatusPanel({ members, destination, meetingTime }: MemberStatusPanelProps) {
  const formattedMeetingTime = formatMeetingTime(meetingTime)
  const onTimeCount = members.filter((member) => getArrivalStatus(member, meetingTime) === 'on-time').length

  return (
    <section className="member-status" aria-labelledby="member-status-title">
      <header className="member-status__header">
        <div>
          <p className="member-status__eyebrow">ARRIVAL OVERVIEW</p>
          <h2 id="member-status-title">メンバーの状況</h2>
        </div>
        <span className="member-status__count">{members.length}人</span>
      </header>

      {members.length > 0 ? (
        <ul className="member-status__list">
          {members.map((member) => {
            const position = member.lat !== null && member.lng !== null
              ? { lat: member.lat, lng: member.lng }
              : null
            const arrivalStatus = getArrivalStatus(member, meetingTime)
            const distance = position && destination
              ? getStraightLineDistanceMetres(position, destination)
              : null
            const distanceLabel = distance === null
              ? '位置情報なし'
              : `${member.locationJammed ? '約' : ''}${formatDistance(distance)}`
            const statusLabel = arrivalStatus === 'on-time'
              ? '間に合う見込み'
              : arrivalStatus === 'late'
                ? '遅れる見込み'
                : formattedMeetingTime
                  ? '到着予測を計測中'
                  : '集合時刻未設定'

            return (
              <li className="member-status__row" key={member.id}>
                <span className={`member-status__avatar${member.locationJammed ? ' is-jammed' : ''}`} aria-hidden="true">
                  {member.name.slice(0, 1)}
                </span>
                <div className="member-status__person">
                  <strong>{member.name}</strong>
                  <span>{member.status === 'arrived' ? '到着済み' : '移動中'}</span>
                </div>
                <div className="member-status__distance">
                  <strong>{distanceLabel}</strong>
                  <span>直線距離{member.locationJammed ? 'の目安' : ''}</span>
                </div>
                <div className="member-status__eta">
                  <strong>{formatEta(member.etaMinutes)}</strong>
                  <span>到着予想</span>
                </div>
                <span className={`member-status__verdict is-${arrivalStatus}`}>
                  {statusLabel}
                  {member.delayMinutes > 0 && <small>本人申告 +{member.delayMinutes}分</small>}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="member-status__empty">位置共有を開始したメンバーがここに表示されます。</p>
      )}

      <footer className="member-status__footer">
        <span>{formattedMeetingTime ? `集合 ${formattedMeetingTime}` : '集合時刻は未設定です'}</span>
        {formattedMeetingTime && <span>{onTimeCount}/{members.length}人が間に合う見込み</span>}
      </footer>
    </section>
  )
}