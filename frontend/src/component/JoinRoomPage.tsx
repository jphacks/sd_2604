import { useState, type FormEvent } from 'react'
import { getDeviceId, getStoredParticipantName, readRoomOwnerId, writeRoomOwnerId, writeRoomParticipant } from '../utils/storage'
import styles from './EntryPage.module.css'
import type { MapApiClient } from './MapApiClient'

interface JoinRoomPageProps {
  roomId: string
  apiClient: MapApiClient
  onJoinSuccess: (participant: { id: string; name: string }) => void
}

export default function JoinRoomPage({ roomId, apiClient, onJoinSuccess }: JoinRoomPageProps) {
  const [joinName, setJoinName] = useState(() => getStoredParticipantName('', roomId))
  const [isJoining, setIsJoining] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const trimmedName = joinName.trim()
    if (!trimmedName) {
      setErrorMessage('名前を入力してください。')
      return
    }

    setIsJoining(true)
    try {
      const participantId = getDeviceId()
      const joined = await apiClient.joinRoom(roomId, { userId: participantId, userName: trimmedName })
      const resolvedId = joined.userId ?? participantId
      const resolvedName = joined.userName ?? trimmedName
      const roomParticipant = { id: resolvedId, name: resolvedName }
      const persistedOwnerId = joined.room?.ownerId ?? readRoomOwnerId(roomId)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('meetpoint.participant-name', resolvedName)
        window.localStorage.setItem('meetpoint-last-room-id', roomId)
        writeRoomParticipant(roomId, roomParticipant)
        if (persistedOwnerId) {
          writeRoomOwnerId(roomId, persistedOwnerId)
        }
      }
      
      onJoinSuccess(roomParticipant)
    } catch {
      setErrorMessage('部屋に参加できませんでした。URLを確認してもう一度お試しください。')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className={styles['entry-page']}>
      <div className={styles['entry-card']}>
        <div className={styles['entry-brand']}>MEETPOINT</div>

        <h1 className={`${styles['entry-title']} ${styles['entry-title--join']}`}>部屋に参加する</h1>
        <p className={styles['entry-lead']}>
          参加するには、表示名を入力してください。<br />部屋ID: <strong>{roomId}</strong>
        </p>

        <form className={styles['entry-form']} onSubmit={handleJoinRoom}>
          <label className={styles['entry-field']}>
            <span className={styles['entry-field__label']}>あなたの名前</span>
            <input
              className={styles['entry-field__input']}
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              placeholder="例: 佐藤さん"
            />
          </label>

          {errorMessage && (
            <p className={styles['entry-error']} role="alert">{errorMessage}</p>
          )}

          <button
            className={styles['entry-submit-btn']}
            type="submit"
            disabled={isJoining || !joinName.trim()}
          >
            {isJoining ? '参加中...' : '部屋に参加'}
          </button>
        </form>
      </div>
    </div>
  )
}