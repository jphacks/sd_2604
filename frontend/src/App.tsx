import { useEffect, useState, type FormEvent } from 'react'
import './App.css'
import CreateRoomPage from './component/CreateRoomPage'
import { MapApiClient } from './component/MapApiClient'
import MapFeature from './component/MapFeature'
import { geocodePlaceName } from './utils/geocoding'
import { getDeviceId, readRoomOwnerId, readRoomParticipant, writeRoomOwnerId, writeRoomParticipant } from './utils/storage'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'https://backend.yonu33.workers.dev').replace(/\/+$/, '')

function getRoomIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('room')
}

function setRoomIdInUrl(roomId: string) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function normalizePlaceText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[‐‑‒–—−]/g, '-')
    .trim()
}

function createInitialMeetingTime(): string {
  const date = new Date()
  date.setHours(date.getHours() + 1)
  date.setMinutes(0, 0, 0)
  return date.toISOString().slice(0, 16)
}

interface AppProps {
  roomInfo?: {
    title?: string
    meetingPlace?: string
    meetingTime?: string
  }
  participant?: {
    id: string
    name: string
  }
}

export default function App({ roomInfo, participant }: AppProps) {
  const [apiClient] = useState(() => new MapApiClient(apiBaseUrl))
  const [roomId, setRoomId] = useState<string | null>(() => getRoomIdFromUrl())
  const [creatorName, setCreatorName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('meetpoint-creator-name') ?? ''
  })
  const [joinName, setJoinName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return readRoomParticipant(roomId)?.name ?? window.localStorage.getItem('meetpoint.participant-name') ?? ''
  })
  const [placeName, setPlaceName] = useState('仙台駅')
  const [addressText, setAddressText] = useState('')
  const [meetingTime, setMeetingTime] = useState(createInitialMeetingTime)
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [joinedParticipant, setJoinedParticipant] = useState<{ id: string; name: string } | undefined>(() => {
    if (!roomId) return undefined
    return readRoomParticipant(roomId) ?? undefined
  })

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

  const handleRoomCreated = (newRoomId: string, newParticipant: { id: string; name: string }) => {
    setJoinedParticipant(newParticipant)
    setRoomId(newRoomId)
    setRoomIdInUrl(newRoomId)
  }

  const handleJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!roomId) return

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
      setJoinedParticipant(roomParticipant)
      setJoinName(resolvedName)
      setRoomId(roomId)
      setRoomIdInUrl(roomId)
    } catch {
      setErrorMessage('部屋に参加できませんでした。URLを確認してもう一度お試しください。')
    } finally {
      setIsJoining(false)
    }
  }

  const roomParticipant = readRoomParticipant(roomId)
  const hasJoinedRoom = Boolean(roomId && (joinedParticipant || participant || roomParticipant))

  if (roomId && hasJoinedRoom) {
    return <MapFeature apiClient={apiClient} roomInfo={roomInfo} participant={joinedParticipant ?? participant ?? roomParticipant ?? undefined} roomId={roomId} />
  }

  if (roomId) {
    return (
      <div className="entry-page">
        <div className="entry-card">
          <div className="entry-brand">MEETPOINT</div>

          <h1 className="entry-title entry-title--join">部屋に参加する</h1>
          <p className="entry-lead">
            参加するには、表示名を入力してください。<br />部屋ID: <strong>{roomId}</strong>
          </p>

          <form className="entry-form" onSubmit={handleJoinRoom}>
            <label className="entry-field">
              <span className="entry-field__label">あなたの名前</span>
              <input
                className="entry-field__input"
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                placeholder="例: 佐藤さん"
              />
            </label>

            {errorMessage && (
              <p className="entry-error" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              className="entry-submit-btn"
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

  return (
    <CreateRoomPage 
      apiClient={apiClient} 
      onRoomCreated={handleRoomCreated} 
    />
  )
}