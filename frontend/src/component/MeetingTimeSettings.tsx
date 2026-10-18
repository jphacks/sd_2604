import { useEffect, useState, type FormEvent } from 'react'
import './MeetingTimeSettings.css'

interface MeetingTimeSettingsProps {
  meetingTime: string | null
  isSaving: boolean
  errorMessage: string | null
  isLocked?: boolean
  onSave: (meetingTime: string | null) => Promise<boolean>
}

function toLocalInputValue(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function formatTimeOnly(value: string | null): string {
  if (!value) return '--:--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getTimeUrgency(value: string | null, nowMs: number): 'normal' | 'soon' | 'overdue' {
  if (!value) return 'normal'
  const targetMs = new Date(value).getTime()
  if (!Number.isFinite(targetMs)) return 'normal'

  const diffMinutes = (targetMs - nowMs) / 60_000
  if (diffMinutes < 0) return 'overdue'
  if (diffMinutes <= 30) return 'soon'
  return 'normal'
}

export default function MeetingTimeSettings({
  meetingTime,
  isSaving,
  errorMessage,
  isLocked = false,
  onSave,
}: MeetingTimeSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const urgency = getTimeUrgency(meetingTime, nowMs)

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLocked || !inputValue || isSaving) return

    const selectedTime = new Date(inputValue)
    if (!Number.isFinite(selectedTime.getTime())) return

    const saved = await onSave(selectedTime.toISOString())
    if (saved) setIsOpen(false)
  }

  const clearTime = async () => {
    if (isLocked || isSaving) return
    const saved = await onSave(null)
    if (saved) setIsOpen(false)
  }

  return (
    <div className="meeting-time-settings">
      <button
        className={`meeting-time-settings__trigger is-${urgency}`}
        type="button"
        aria-expanded={isOpen}
        title={isLocked ? 'オーナーのみ集合時刻を変更できます' : 'タップして集合時刻を再設定'}
        disabled={isLocked || isSaving}
        onClick={() => {
          if (isLocked) return
          if (!isOpen) setInputValue(toLocalInputValue(meetingTime))
          setIsOpen((open) => !open)
        }}
      >
        <span className="meeting-time-settings__label">集合時刻</span>
        <strong className="meeting-time-settings__time">{formatTimeOnly(meetingTime)}</strong>
      </button>

      {isOpen && (
        <form className="meeting-time-settings__panel" onSubmit={save}>
          <label htmlFor="meeting-time-input">集合日時を再設定</label>
          <input
            id="meeting-time-input"
            type="datetime-local"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            required
          />
          {errorMessage && <p className="meeting-time-settings__error" role="alert">{errorMessage}</p>}
          <div className="meeting-time-settings__actions">
            <button type="button" onClick={() => setIsOpen(false)}>
              キャンセル
            </button>
            {meetingTime && !isLocked && (
              <button
                type="button"
                className="meeting-time-settings__clear"
                onClick={() => void clearTime()}
                disabled={isSaving}
              >
                解除
              </button>
            )}
            <button type="submit" className="meeting-time-settings__save" disabled={isLocked || !inputValue || isSaving}>
              {isSaving ? '保存中...' : isLocked ? 'オーナーのみ変更可能' : '保存'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}