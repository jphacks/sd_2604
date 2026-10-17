import type { ReactNode } from 'react'
import './RoomLayout.css'

interface RoomLayoutProps {
  title: string
  meetingTime?: string
  connectionLabel: string
  connectionError?: boolean
  map: ReactNode
  headerActions?: ReactNode
  mapControls?: ReactNode
  children?: ReactNode
}

export default function RoomLayout({
  title,
  meetingTime,
  connectionLabel,
  connectionError = false,
  map,
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
          {meetingTime && <p className="room-meeting-time">集合 {meetingTime}</p>}
        </div>
        <div className="room-header__right">
          {headerActions && <div className="room-header__actions">{headerActions}</div>}
          <div className={`connection-status${connectionError ? ' connection-status--error' : ''}`}>
            <span className="connection-status__dot" />
            {connectionLabel}
          </div>
        </div>
      </header>

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

      {children && (
        <section className="room-feature-slot" aria-label="ルーム機能">
          {children}
        </section>
      )}
    </main>
  )
}