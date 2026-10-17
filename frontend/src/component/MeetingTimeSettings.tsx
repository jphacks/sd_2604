import { useState, type FormEvent } from 'react'
import './MeetingTimeSettings.css'

interface MeetingTimeSettingsProps {
  meetingTime: string | null
  isSaving: boolean
  errorMessage: string | null
  onSave: (meetingTime: string | null) => Promise<boolean>
}

function toLocalInputValue(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function formatMeetingTime(value: string | null): string {
  if (!value) return '時刻を設定'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '時刻を設定'
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function MeetingTimeSettings({
  meetingTime,
  isSaving,
  errorMessage,
  onSave,
}: MeetingTimeSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inputValue || isSaving) return

    const selectedTime = new Date(inputValue)
    if (!Number.isFinite(selectedTime.getTime())) return

    const saved = await onSave(selectedTime.toISOString())
    if (saved) setIsOpen(false)
  }

  const clearTime = async () => {
    if (isSaving) return
    const saved = await onSave(null)
    if (saved) setIsOpen(false)
  }

  return (
    <div className="meeting-time-settings">
      <button
        className="meeting-time-settings__trigger"
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) setInputValue(toLocalInputValue(meetingTime))
          setIsOpen((open) => !open)
        }}
      >
        <span aria-hidden="true">◷</span>
        {meetingTime ? formatMeetingTime(meetingTime) : '集合時刻を設定'}
      </button>

      {isOpen && (
        <form className="meeting-time-settings__panel" onSubmit={save}>
          <label htmlFor="meeting-time-input">集合日時</label>
          <input
            id="meeting-time-input"
            type="datetime-local"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            required
          />
          {errorMessage && <p className="meeting-time-settings__error" role="alert">{errorMessage}</p>}
          <div className="meeting-time-settings__actions">
            {meetingTime && (
              <button type="button" className="meeting-time-settings__clear" onClick={() => void clearTime()} disabled={isSaving}>
                解除
              </button>
            )}
            <button type="submit" className="meeting-time-settings__save" disabled={!inputValue || isSaving}>
              {isSaving ? '保存中...' : '時刻を保存'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}