import type { ReactNode } from 'react'
import './RoomLayout.css'

function formatMeetingTime(value?: string): string {
  if (!value) return '未設定'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

interface RoomLayoutProps {
  title: string
  roomId?: string | null
  meetingPlace?: string
  meetingTime?: string
  connectionLabel: string
  connectionError?: boolean
  map: ReactNode
  memberStatus?: ReactNode
  headerActions?: ReactNode
  mapControls?: ReactNode
  children?: ReactNode
}

export default function RoomLayout({
  title,
  roomId,
  meetingPlace,
  meetingTime,
  connectionLabel,
  connectionError = false,
  map,
  memberStatus,
  headerActions,
  mapControls,
  children,
}: RoomLayoutProps) {
  return (
    <main className="room-layout">
      <header className="room-header">
        <div className="room-heading">
          <p className="room-eyebrow">MEETPOINT / ROOM</p>
          <h1>{title}</h1>
          {roomId && (
            <div className="room-id-chip" aria-label={`部屋ID: ${roomId}`}>
              ROOM ID: {roomId}
            </div>
          )}
          <div className="room-meeting-meta">
            <p className="room-meeting-place">集合場所 <strong>{meetingPlace ?? '未設定'}</strong></p>
            <p className="room-meeting-time">集合時刻 <strong>{formatMeetingTime(meetingTime)}</strong></p>
          </div>
        </div>
        <div className="room-header__right">
          {headerActions && <div className="room-header__actions">{headerActions}</div>}
          <div className={`connection-status${connectionError ? ' connection-status--error' : ''}`}>
            <span className="connection-status__dot" />
            {connectionLabel}
          </div>
        </div>
      </header>

      <div className="room-workspace">
        <section className="room-map" aria-label="集合場所の地図">
          <div className="room-map__canvas">{map}</div>
          {mapControls && <div className="room-map__controls">{mapControls}</div>}
          <div className="map-legend">
            <span className="map-legend__destination" />
            <span>目的地</span>
            <span className="map-legend__member" />
            <span>参加者（圏外は概算）</span>
          </div>
        </section>
        {memberStatus && <div className="room-member-status">{memberStatus}</div>}
      </div>

      {children && (
        <section className="room-feature-slot" aria-label="ルーム機能">
          {children}
        </section>
      )}
    </main>
  )
}