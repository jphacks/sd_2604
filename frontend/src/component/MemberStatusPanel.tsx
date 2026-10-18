import { useEffect, useState, type CSSProperties } from 'react'
import { formatDistance, getStraightLineDistanceMetres } from './mapMath'
import type { Destination, MemberStatus } from './mapTypes'

interface MemberStatusPanelProps {
  members?: MemberStatus[]
  destination?: Destination | null
  meetingTime?: string
  onAddDelay?: (minutes: number, memberId: string) => void | Promise<void>
  errorMessage?: string | null
  onReachDestinationOnTime?: (memberId: string) => void
  onReachDestinationLate?: (memberId: string) => void
  timerText?: string | null
  canAdjustDelay?: boolean
}

function getArrivalStatus(member: MemberStatus, currentDelay: number, meetingTime?: string, nowMs: number = Date.now()): 'on-time' | 'late' | 'unknown' {
  if (!meetingTime || member.etaMinutes === null || member.etaMinutes === undefined) return 'unknown'
  const meetingAt = new Date(meetingTime).getTime()
  if (!Number.isFinite(meetingAt)) return 'unknown'

  const estimatedArrival = nowMs + Math.max(0, member.etaMinutes + currentDelay) * 60_000
  return estimatedArrival <= meetingAt ? 'on-time' : 'late'
}

function formatEtaTime(etaMinutes: number | null | undefined, delayMinutes: number, now: Date, isWithin50m: boolean): string {
  if (isWithin50m) return '到着済み / 50m圏内'
  if (etaMinutes === null || etaMinutes === undefined) return '計測中'

  const totalMins = Math.max(0, (etaMinutes || 0) + delayMinutes)
  if (totalMins === 0) return '到着済み / 圏内'

  const arrivalDate = new Date(now.getTime() + totalMins * 60_000)
  const timeStr = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(arrivalDate)
  return `${timeStr} (あと${totalMins}分)`
}

function formatMeetingTime(meetingTime?: string): string | null {
  if (!meetingTime) return null
  const date = new Date(meetingTime)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date)
    : null
}

function getMemberMeetingStatusText(member: MemberStatus, currentDelay: number, meetingTime?: string, nowMs: number = Date.now()): string {
  if (!meetingTime) return '集合時間未設定'
  const meetingAt = new Date(meetingTime).getTime()
  if (!Number.isFinite(meetingAt)) return '集合時間未設定'

  if (member.etaMinutes === null || member.etaMinutes === undefined) {
    const diffMins = Math.round((meetingAt - nowMs) / 60_000)
    if (diffMins > 0) return `集合まであと${diffMins}分`
    if (diffMins === 0) return 'まもなく集合時間です'
    return `集合時間を${Math.abs(diffMins)}分超過`
  }

  const estimatedArrival = nowMs + Math.max(0, member.etaMinutes + currentDelay) * 60_000
  const diffMins = Math.round((estimatedArrival - meetingAt) / 60_000)

  if (diffMins > 0) {
    return `集合時間を${diffMins}分超過`
  } else if (diffMins === 0) {
    return 'ぴったり集合時間に到着予定'
  } else {
    return `集合の${Math.abs(diffMins)}分前に到着予定`
  }
}

export default function MemberStatusPanel({
  members = [],
  destination,
  meetingTime,
  onAddDelay,
  errorMessage,
  onReachDestinationOnTime,
  onReachDestinationLate,
  timerText,
  canAdjustDelay = false,
}: MemberStatusPanelProps) {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(new Date())
  const [isSmallMobile, setIsSmallMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 390 : false,
  )

  useEffect(() => {
    const handleResize = () => setIsSmallMobile(window.innerWidth <= 390)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedMeetingTime = formatMeetingTime(meetingTime)
  const formattedCurrentTime = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now)

  const onTimeCount = members.filter((member) => {
    const delay = member.delayMinutes || 0
    return getArrivalStatus(member, delay, meetingTime, now.getTime()) === 'on-time'
  }).length

  const handleAddDelayClick = (memberId: string, mins: number) => {
    if (!canAdjustDelay) return
    void onAddDelay?.(mins, memberId)
    setExpandedMemberId(null)
  }

  const handleResetDelay = (member: MemberStatus) => {
    if (!canAdjustDelay) return
    if (member.delayMinutes !== 0) void onAddDelay?.(-member.delayMinutes, member.id)
    setExpandedMemberId(null)
  }

  return (
    <section style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      width: '100%',
      boxSizing: 'border-box',
      padding: isSmallMobile ? '6px' : '12px',
    }}>
      <header style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '11px', margin: '0 0 2px 0', color: '#64748b' }}>
            現在時刻: <strong style={{ color: '#1e293b' }}>{formattedCurrentTime}</strong>
          </p>
          <h2 style={{ fontSize: isSmallMobile ? '14px' : '16px', margin: 0, fontWeight: 700 }}>メンバーの状況</h2>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 'bold', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', color: '#334155' }}>
          {members.length}人
        </span>
      </header>

      {timerText && (
        <div style={{ textAlign: 'center', padding: '6px 10px', background: '#fff5f5', color: '#e74c3c', fontWeight: 'bold', fontSize: '12px', borderRadius: '8px', marginBottom: '8px' }}>
          遅延タイマー: {timerText}
        </div>
      )}

      {errorMessage && (
        <p role="alert" style={{ margin: '0 0 8px', color: '#b91c1c', fontSize: '12px' }}>
          {errorMessage}
        </p>
      )}

      {members.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {members.map((member) => {
            const currentTotalDelay = member.delayMinutes || 0
            const arrivalStatus = getArrivalStatus(member, currentTotalDelay, meetingTime, now.getTime())
            const isExpanded = expandedMemberId === member.id

            const mLat = member.lat
            const mLng = member.lng
            const meters = (mLat != null && mLng != null && destination?.lat != null && destination?.lng != null)
              ? getStraightLineDistanceMetres({ lat: mLat, lng: mLng }, destination)
              : null

            const distanceFormatted = meters !== null ? formatDistance(meters) : '取得中'

            const isWithin50m = meters !== null && meters <= 50
            const isBeforeMeetingTime = meetingTime ? now.getTime() <= new Date(meetingTime).getTime() : true
            const isOnTimeArrival = isWithin50m && isBeforeMeetingTime
            const isLateArrival = isWithin50m && !isBeforeMeetingTime

            if (isOnTimeArrival) {
              onReachDestinationOnTime?.(member.id)
            } else if (isLateArrival) {
              onReachDestinationLate?.(member.id)
            }

            const isLate = !isWithin50m && arrivalStatus === 'late'
            const memberMeetingText = getMemberMeetingStatusText(member, currentTotalDelay, meetingTime, now.getTime())

            let statusLabelText = formattedMeetingTime ? '計測中' : '集合未設定'
            let statusStyle: CSSProperties = {
              borderRadius: '6px',
              padding: isSmallMobile ? '3px 6px' : '4px 8px',
              fontSize: isSmallMobile ? '10px' : '11px',
              fontWeight: 'bold',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: '#f1f2f6',
              color: '#57606f',
              border: '1px solid #dfe4ea',
            }

            if (isOnTimeArrival || member.status === 'arrived') {
              statusLabelText = '時間内到着'
              statusStyle = { ...statusStyle, background: '#059669', color: '#ffffff', border: '1px solid #047857' }
            } else if (isLateArrival) {
              statusLabelText = '遅れて到着'
              statusStyle = { ...statusStyle, background: '#d97706', color: '#ffffff', border: '1px solid #b45309' }
            } else if (arrivalStatus === 'on-time') {
              statusLabelText = '間に合う見込み'
              statusStyle = { ...statusStyle, background: '#e6f9ed', color: '#27ae60', border: '1px solid #a3e9be' }
            } else if (isLate) {
              statusLabelText = '遅れる見込み'
              statusStyle = { ...statusStyle, background: '#ffeaea', color: '#d63031', border: '1px solid #ffb8b8' }
            }

            const cardBg = isOnTimeArrival ? '#ecfdf5' : isLateArrival ? '#fffbe1' : isLate ? '#fef2f2' : '#ffffff'
            const cardBorder = isOnTimeArrival ? '1.5px solid #10b981' : isLateArrival ? '1.5px solid #f59e0b' : isLate ? '1.5px solid #f87171' : '1px solid #e2e8f0'

            return (
              <li key={member.id} style={{ listStyle: 'none' }}>
                <div style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: '10px',
                  padding: isSmallMobile ? '8px 10px' : '10px 12px',
                  marginBottom: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  {formattedMeetingTime && (
                    <div style={{
                      textAlign: 'center',
                      padding: '6px 8px',
                      background: isWithin50m ? '#d1fae5' : isLate ? '#fee2e2' : '#e0f2fe',
                      color: isWithin50m ? '#065f46' : isLate ? '#991b1b' : '#0369a1',
                      fontWeight: 'bold',
                      fontSize: isSmallMobile ? '11.5px' : '12.5px',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      border: isWithin50m ? '1px solid #a7f3d0' : isLate ? '1px solid #fca5a5' : '1px solid #bae6fd',
                    }}>
                      🕒 集合: {memberMeetingText} {formattedMeetingTime ? `(${formattedMeetingTime})` : ''}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      width: '100%',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 1 }}>
                        <span style={{
                          margin: 0,
                          flexShrink: 0,
                          width: '32px',
                          height: '32px',
                          fontSize: '14px',
                          lineHeight: '32px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          borderRadius: '50%',
                          background: '#cbd5e1',
                          color: '#334155',
                        }}>
                          {member.name.slice(0, 1)}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                          <strong style={{ fontSize: isSmallMobile ? '14px' : '15px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.name}
                          </strong>

                          {!isSmallMobile && (
                            <span style={{
                              fontSize: '10.5px',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              background: isWithin50m ? '#d1fae5' : isLate ? '#fee2e2' : '#f1f5f9',
                              color: isWithin50m ? '#065f46' : isLate ? '#991b1b' : '#64748b',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}>
                              {isWithin50m || member.status === 'arrived' ? '到着済み' : '移動中'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ flex: 1, textAlign: 'center', minWidth: '55px' }}>
                        {isOnTimeArrival ? (
                          <span style={{ color: '#047857', fontWeight: 800, fontSize: '12px', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px', border: '1px solid #6ee7b7', display: 'inline-block' }}>
                            ✅ 到着!
                          </span>
                        ) : isLateArrival ? (
                          <span style={{ color: '#b45309', fontWeight: 800, fontSize: '12px', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fde68a', display: 'inline-block' }}>
                            遅延到着
                          </span>
                        ) : isLate ? (
                          <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '12px', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fca5a5', display: 'inline-block' }}>
                            遅刻
                          </span>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '12px' }}>
                            順調
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {canAdjustDelay && (
                          <button
                            type="button"
                            onClick={() => setExpandedMemberId((prev) => (prev === member.id ? null : member.id))}
                            style={{
                              padding: isSmallMobile ? '4px 6px' : '6px 10px',
                              fontSize: isSmallMobile ? '12px' : '11px',
                              lineHeight: 1,
                              background: isExpanded ? '#1e293b' : '#f1f5f9',
                              color: isExpanded ? '#fff' : '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            調整{isExpanded ? '▴' : '▾'}
                          </button>
                        )}

                        <div style={statusStyle}>
                          <span>{statusLabelText}</span>
                          {!isWithin50m && currentTotalDelay !== 0 && (
                            <small style={{ fontSize: '9px', opacity: 0.85 }}>
                              {currentTotalDelay > 0 ? `+${currentTotalDelay}` : currentTotalDelay}分
                            </small>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: isSmallMobile ? 'column' : 'row',
                      alignItems: isSmallMobile ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: isWithin50m ? '#f0fdf4' : isLate ? '#fff5f5' : '#f8fafc',
                      border: isWithin50m ? '1px solid #a7f3d0' : isLate ? '1px solid #fecaca' : '1px solid #e2e8f0',
                      padding: isSmallMobile ? '6px 8px' : '8px 10px',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                      gap: isSmallMobile ? '4px' : '0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: isSmallMobile ? '10.5px' : '11.5px', color: '#64748b' }}>直線距離:</span>
                        <strong style={{ fontSize: isSmallMobile ? '11.5px' : '12.5px', color: isWithin50m ? '#047857' : '#0f172a', fontWeight: 700 }}>
                          {distanceFormatted}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: isSmallMobile ? '10.5px' : '11.5px', color: '#64748b' }}>到着予想:</span>
                        <strong style={{ fontSize: isSmallMobile ? '11.5px' : '12.5px', color: isWithin50m ? '#047857' : isLate ? '#dc2626' : '#0f172a', fontWeight: 700 }}>
                          {formatEtaTime(member.etaMinutes, currentTotalDelay, now, isWithin50m)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {canAdjustDelay && isExpanded && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }}>
                        時間を調整:
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {[-10, -5, 5, 15, 30].map((mins) => {
                          const isMinus = mins < 0
                          return (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => handleAddDelayClick(member.id, mins)}
                              style={{
                                flex: '1 1 auto',
                                minWidth: '42px',
                                padding: '8px 4px',
                                background: isMinus ? '#10b981' : '#f43f5e',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                fontSize: '11.5px',
                                cursor: 'pointer',
                                textAlign: 'center',
                              }}
                            >
                              {isMinus ? `${mins}分` : `+${mins}分`}
                            </button>
                          )
                        })}

                        {currentTotalDelay !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleResetDelay(member)}
                            style={{
                              padding: '8px 10px',
                              background: '#3b82f6',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            リセット
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p style={{ fontSize: '13px', padding: '12px 0', textAlign: 'center', color: '#94a3b8' }}>
          位置共有を開始したメンバーがここに表示されます。
        </p>
      )}

      <footer style={{ marginTop: '8px', fontSize: '11px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
        <span>現在時刻 {formattedCurrentTime}</span>
        {formattedMeetingTime && <span>{onTimeCount}/{members.length}人が間に合う見込み</span>}
      </footer>
    </section>
  )
}