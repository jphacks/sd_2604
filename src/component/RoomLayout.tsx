import { useState, type ReactNode } from 'react'
import './RoomLayout.css'

function formatMeetingDate(value?: string): string {
  if (!value) return '--/--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--/--'
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

interface RoomLayoutProps {
  roomId?: string | null
  meetingTime?: string
  connectionLabel: string
  connectionError?: boolean
  meetingTimeControl?: ReactNode
  map: ReactNode
  memberStatus?: ReactNode
  mapControls?: ReactNode
  children?: ReactNode
}

export default function RoomLayout({
  roomId,
  meetingTime,
  connectionLabel,
  connectionError = false,
  meetingTimeControl,
  map,
  memberStatus,
  mapControls,
  children,
}: RoomLayoutProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyRoomUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = window.location.href
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <main className="room-layout">
      <header className="room-header">
        <div className="room-header__inner">
          <div className="room-header__top">
            <div className="room-header__top-left">
              <div className="app-logo">
                <img className="app-logo__mark" src="/logo-mark.svg" alt="" />
                <span className="app-logo__text">Motsuku</span>
              </div>
            </div>

            <div className="room-header__top-right">
              <button
                type="button"
                className={`room-id-block${copied ? ' is-copied' : ''}`}
                onClick={() => void handleCopyRoomUrl()}
                title="タップして部屋のURLをコピー"
                aria-label={roomId ? `部屋ID: ${roomId}。タップしてURLをコピー` : 'URLをコピー'}
              >
                <span className="room-id-block__label">
                  {copied ? 'COPIED URL!' : 'ROOM ID'}
                </span>
                <span className="room-id-block__value">{roomId ?? '---'}</span>
              </button>
              {/* ドットを左、日付を右に配置することで、右端を時間（hh:mm）と揃えます */}
              <div
                className={`connection-status-dot${connectionError ? ' is-error' : ''}`}
                title={`API: ${connectionLabel}`}
                aria-label={`API状態: ${connectionLabel}`}
              />
              <div className="room-date" aria-label="集合日">
                {formatMeetingDate(meetingTime)}
              </div>
            </div>
          </div>

          <div className="room-header__bottom">
            {meetingTimeControl}
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
