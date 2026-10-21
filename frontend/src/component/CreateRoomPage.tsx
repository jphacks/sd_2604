import { useEffect, useState, type FormEvent } from 'react'
import { geocodePlaceName } from '../utils/geocoding'
import { getDeviceId, writeRoomOwnerId, writeRoomParticipant } from '../utils/storage'
import type { MapApiClient } from './MapApiClient'

interface CreateRoomPageProps {
  apiClient: MapApiClient
  onRoomCreated: (roomId: string, participant: { id: string; name: string }) => void
}

function createInitialMeetingTime(): string {
  const date = new Date()
  date.setHours(date.getHours() + 1)
  date.setMinutes(0, 0, 0)
  return date.toISOString().slice(0, 16)
}

export default function CreateRoomPage({ apiClient, onRoomCreated }: CreateRoomPageProps) {
  const [creatorName, setCreatorName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('meetpoint-creator-name') ?? ''
  })
  const [placeName, setPlaceName] = useState('仙台駅')
  const [addressText, setAddressText] = useState('')
  const [meetingTime, setMeetingTime] = useState(createInitialMeetingTime)
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('meetpoint-creator-name', creatorName)
    }
  }, [creatorName])

  const handleSearchByPlaceName = async () => {
    setErrorMessage(null)
    if (!placeName.trim()) {
      setErrorMessage('場所名を入力してください。')
      return
    }

    setIsSearching(true)
    try {
      const result = await geocodePlaceName(placeName)
      if (!result) {
        setErrorMessage('目的地を見つけられませんでした。別の表記でお試しください。')
        setAddressText('')
        return
      }
      setAddressText(result.displayName)
    } finally {
      setIsSearching(false)
    }
  }

  const handleCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const trimmedCreatorName = creatorName.trim()
    if (!trimmedCreatorName) {
      setErrorMessage('作成者の名前を入力してください。')
      return
    }

    if (!placeName.trim()) {
      setErrorMessage('場所名を入力してください。')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await geocodePlaceName(placeName)
      if (!result) {
        setErrorMessage('目的地を見つけられませんでした。別の表記でお試しください。')
        return
      }

      const ownerId = getDeviceId()
      const created = await apiClient.createRoom({
        title: '待ち合わせ',
        targetName: placeName.trim(),
        targetLat: result.lat,
        targetLng: result.lng,
        meetingTime: meetingTime || createInitialMeetingTime(),
        destinationName: placeName.trim(),
        destinationAddress: addressText.trim() || result.displayName,
        ownerId,
        ownerName: trimmedCreatorName,
      })
      const nextRoomId = created.roomId ?? created.room?.id
      if (!nextRoomId) {
        setErrorMessage('部屋の作成に失敗しました。もう一度お試しください。')
        return
      }

      const roomParticipant = { id: ownerId, name: trimmedCreatorName }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('meetpoint-creator-name', trimmedCreatorName)
        window.localStorage.setItem('meetpoint.participant-name', trimmedCreatorName)
        window.localStorage.setItem('meetpoint-last-room-id', nextRoomId)
        writeRoomParticipant(nextRoomId, roomParticipant)
        writeRoomOwnerId(nextRoomId, ownerId)
      }
      
      onRoomCreated(nextRoomId, roomParticipant)
    } catch {
      setErrorMessage('部屋の作成に失敗しました。もう一度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="entry-page">
      <div className="entry-card">
        <div className="entry-brand">MEETPOINT</div>
        <h1 className="entry-title entry-title--create">新しい部屋を作る</h1>

        <form className="entry-form" onSubmit={handleCreateRoom}>
          <label className="entry-field">
            <span className="entry-field__label">作成者の名前</span>
            <input
              className="entry-field__input"
              value={creatorName}
              onChange={(event) => setCreatorName(event.target.value)}
              placeholder="例: 田中さん"
            />
          </label>

          <label className="entry-field">
            <span className="entry-field__label">場所名</span>
            <input
              className="entry-field__input"
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              placeholder="会津若松駅"
            />
          </label>

          <button
            className="entry-search-btn"
            type="button"
            onClick={() => void handleSearchByPlaceName()}
            disabled={isSearching || !placeName.trim()}
          >
            {isSearching ? '検索中...' : '住所を自動検索'}
          </button>

          <label className="entry-field">
            <span className="entry-field__label">住所・詳細</span>
            <input
              className="entry-field__input"
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
              placeholder="福島県会津若松市駅前町1-2-3"
            />
          </label>

          <label className="entry-field">
            <span className="entry-field__label">集合日時</span>
            <input
              className="entry-field__input"
              type="datetime-local"
              value={meetingTime}
              onChange={(event) => setMeetingTime(event.target.value)}
            />
          </label>

          <p className="entry-note">
            作成者の名前と集合場所、集合時刻を入力して部屋を作成してください。
          </p>

          {errorMessage && (
            <p className="entry-error" role="alert">{errorMessage}</p>
          )}

          <button
            className="entry-submit-btn entry-submit-btn--create"
            type="submit"
            disabled={isSubmitting || !creatorName.trim() || !placeName.trim()}
          >
            {isSubmitting ? '作成中...' : '新しい部屋を作る'}
          </button>
        </form>
      </div>
    </div>
  )
}