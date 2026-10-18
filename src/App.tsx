import { useEffect, useState, type FormEvent } from 'react'
import { MapApiClient } from './component/MapApiClient'
import MapFeature from './component/MapFeature'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'https://backend.yonu33.workers.dev').replace(/\/+$/, '')

const exactPlaceOverrides: Record<string, GeocodeResult> = {
  '仙台駅': { lat: 38.2606, lng: 140.8824, displayName: '仙台駅' },
}

type GeocodeResult = {
  lat: number
  lng: number
  displayName: string
}

function getRoomIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('room')
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'unknown-device'

  const existing = window.localStorage.getItem('meetpoint.device-id')
  if (existing && existing.trim()) return existing

  const fingerprint = [
    window.navigator.userAgent,
    window.navigator.language,
    window.screen.width,
    window.screen.height,
    window.screen.colorDepth,
  ].join('|')

  const next = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || `device-${Date.now()}`
  window.localStorage.setItem('meetpoint.device-id', next)
  return next
}

function getRoomParticipantStorageKey(roomId: string): string {
  return `meetpoint.room-participant.${roomId}`
}

function readRoomParticipant(roomId: string | null | undefined): { id: string; name: string } | null {
  if (!roomId || typeof window === 'undefined') return null

  try {
    const stored = window.localStorage.getItem(getRoomParticipantStorageKey(roomId))
    if (!stored) return null
    const parsed = JSON.parse(stored) as { id?: string; name?: string }
    if (typeof parsed.id === 'string' && parsed.id.trim() && typeof parsed.name === 'string' && parsed.name.trim()) {
      return { id: parsed.id, name: parsed.name.trim() }
    }
  } catch {
    // ignore malformed data
  }

  return null
}

function writeRoomParticipant(roomId: string, participant: { id: string; name: string }) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getRoomParticipantStorageKey(roomId), JSON.stringify({ id: participant.id, name: participant.name }))
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

async function geocodePlaceName(placeName: string): Promise<GeocodeResult | null> {
  const cleaned = placeName.trim()
  if (!cleaned) return null

  const normalizedQuery = normalizePlaceText(cleaned)
  const exactOverride = exactPlaceOverrides[normalizedQuery]
  if (exactOverride) return exactOverride

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', cleaned)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '10')
  url.searchParams.set('countrycodes', 'jp')
  url.searchParams.set('accept-language', 'ja')

  const response = await fetch(url.toString(), {
    headers: {
      'Accept-Language': 'ja',
      'User-Agent': 'MeetPointApp/1.0',
    },
  })

  if (!response.ok) return null

  const candidates = (await response.json()) as Array<{
    lat?: string
    lon?: string
    name?: string
    display_name?: string
    address?: { country_code?: string }
  }>

  if (!Array.isArray(candidates) || candidates.length === 0) return null

  const preferred = candidates.find((candidate) => {
    if (!candidate.lat || !candidate.lon) return false
    if (candidate.address?.country_code && candidate.address.country_code !== 'jp') return false

    const directName = normalizePlaceText(candidate.name ?? '')
    const directDisplayName = normalizePlaceText(candidate.display_name ?? '')

    return (
      (directName && (directName === normalizedQuery || directName.startsWith(normalizedQuery))) ||
      (directDisplayName && (directDisplayName === normalizedQuery || directDisplayName.startsWith(normalizedQuery)))
    )
  })

  if (!preferred || !preferred.lat || !preferred.lon) return null

  return {
    lat: Number(preferred.lat),
    lng: Number(preferred.lon),
    displayName: preferred.display_name ?? cleaned,
  }
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

      const created = await apiClient.createRoom({
        title: '待ち合わせ',
        targetName: placeName.trim(),
        targetLat: result.lat,
        targetLng: result.lng,
        meetingTime: meetingTime || createInitialMeetingTime(),
        destinationName: placeName.trim(),
        destinationAddress: addressText.trim() || result.displayName,
        ownerId: `${getDeviceId()}-${Date.now()}`,
        ownerName: trimmedCreatorName,
      })
      const nextRoomId = created.roomId ?? created.room?.id
      if (!nextRoomId) {
        setErrorMessage('部屋の作成に失敗しました。もう一度お試しください。')
        return
      }

      const roomParticipant = { id: `${getDeviceId()}-${nextRoomId}`, name: trimmedCreatorName }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('meetpoint-creator-name', trimmedCreatorName)
        window.localStorage.setItem('meetpoint.participant-name', trimmedCreatorName)
        window.localStorage.setItem('meetpoint-last-room-id', nextRoomId)
        writeRoomParticipant(nextRoomId, roomParticipant)
      }
      setJoinedParticipant(roomParticipant)
      setRoomId(nextRoomId)
      setRoomIdInUrl(nextRoomId)
    } catch {
      setErrorMessage('部屋の作成に失敗しました。もう一度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
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
      const participantId = `${getDeviceId()}-${roomId}`
      const joined = await apiClient.joinRoom(roomId, { userId: participantId, userName: trimmedName })
      const resolvedId = joined.userId ?? participantId
      const resolvedName = joined.userName ?? trimmedName
      const roomParticipant = { id: resolvedId, name: resolvedName }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('meetpoint.participant-name', resolvedName)
        window.localStorage.setItem('meetpoint-last-room-id', roomId)
        writeRoomParticipant(roomId, roomParticipant)
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
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          background: '#edf0e8',
          fontFamily: 'Avenir Next, "Hiragino Kaku Gothic ProN", sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 620,
            padding: '28px 24px 22px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.68)',
            boxShadow: '0 8px 30px rgba(24, 43, 37, 0.08)',
            border: '1px solid rgba(127, 138, 128, 0.25)',
          }}
        >
          <div style={{ marginBottom: 20, fontWeight: 800, letterSpacing: '0.08em', color: '#22352f', fontSize: 24 }}>
            MEETPOINT
          </div>

          <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(2rem, 4vw, 2.8rem)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.06em' }}>
            部屋に参加する
          </h1>
          <p style={{ margin: '0 0 24px', color: '#47615d', fontSize: 18 }}>
            参加するには、表示名を入力してください。<br />部屋ID: <strong>{roomId}</strong>
          </p>

          <form onSubmit={handleJoinRoom} style={{ display: 'grid', gap: 18 }}>
            <label style={{ display: 'grid', gap: 8, fontWeight: 600, color: '#22352f' }}>
              <span style={{ fontSize: 18 }}>あなたの名前</span>
              <input
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                placeholder="例: 佐藤さん"
                style={{
                  padding: '16px 14px',
                  borderRadius: 12,
                  border: '1px solid #c8cfc7',
                  background: 'rgba(255,255,255,0.5)',
                  fontSize: 28,
                  fontWeight: 700,
                  outline: 'none',
                }}
              />
            </label>

            {errorMessage && (
              <p role="alert" style={{ margin: 0, color: '#d9553d', fontSize: 16, fontWeight: 700 }}>
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isJoining || !joinName.trim()}
              style={{
                padding: '18px 18px',
                borderRadius: 12,
                border: 'none',
                background: '#2a6052',
                color: '#fff',
                fontSize: 30,
                fontWeight: 800,
                cursor: isJoining || !joinName.trim() ? 'not-allowed' : 'pointer',
                opacity: isJoining || !joinName.trim() ? 0.6 : 1,
              }}
            >
              {isJoining ? '参加中...' : '部屋に参加'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: '#edf0e8',
        fontFamily: 'Avenir Next, "Hiragino Kaku Gothic ProN", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          padding: '28px 24px 22px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.68)',
          boxShadow: '0 8px 30px rgba(24, 43, 37, 0.08)',
          border: '1px solid rgba(127, 138, 128, 0.25)',
        }}
      >
        <div style={{ marginBottom: 20, fontWeight: 800, letterSpacing: '0.08em', color: '#22352f', fontSize: 24 }}>
          MEETPOINT
        </div>

        <h1 style={{ margin: '0 0 24px', fontSize: 'clamp(2.2rem, 4vw, 3.4rem)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.06em' }}>
          新しい部屋を作る
        </h1>

        <form onSubmit={handleCreateRoom} style={{ display: 'grid', gap: 18 }}>
          <label style={{ display: 'grid', gap: 8, fontWeight: 600, color: '#22352f' }}>
            <span style={{ fontSize: 18 }}>作成者の名前</span>
            <input
              value={creatorName}
              onChange={(event) => setCreatorName(event.target.value)}
              placeholder="例: 田中さん"
              style={{
                padding: '16px 14px',
                borderRadius: 12,
                border: '1px solid #c8cfc7',
                background: 'rgba(255,255,255,0.5)',
                fontSize: 28,
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8, fontWeight: 600, color: '#22352f' }}>
            <span style={{ fontSize: 18 }}>場所名</span>
            <input
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              placeholder="会津若松駅"
              style={{
                padding: '16px 14px',
                borderRadius: 12,
                border: '1px solid #c8cfc7',
                background: 'rgba(255,255,255,0.5)',
                fontSize: 28,
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </label>

          <button
            type="button"
            onClick={handleSearchByPlaceName}
            disabled={isSearching || !placeName.trim()}
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              border: '1px solid #dbe1d7',
              background: '#dfe7e1',
              color: '#22352f',
              fontSize: 18,
              fontWeight: 700,
              cursor: isSearching || !placeName.trim() ? 'not-allowed' : 'pointer',
              opacity: isSearching || !placeName.trim() ? 0.6 : 1,
            }}
          >
            {isSearching ? '検索中...' : '住所を自動検索'}
          </button>

          <label style={{ display: 'grid', gap: 8, fontWeight: 600, color: '#22352f' }}>
            <span style={{ fontSize: 18 }}>住所・詳細</span>
            <input
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
              placeholder="福島県会津若松市駅前町1-2-3"
              style={{
                padding: '16px 14px',
                borderRadius: 12,
                border: '1px solid #c8cfc7',
                background: 'rgba(255,255,255,0.5)',
                fontSize: 28,
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8, fontWeight: 600, color: '#22352f' }}>
            <span style={{ fontSize: 18 }}>集合日時</span>
            <input
              type="datetime-local"
              value={meetingTime}
              onChange={(event) => setMeetingTime(event.target.value)}
              style={{
                padding: '16px 14px',
                borderRadius: 12,
                border: '1px solid #c8cfc7',
                background: 'rgba(255,255,255,0.5)',
                fontSize: 28,
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </label>

          <p style={{ margin: 0, color: '#47615d', fontSize: 18, lineHeight: 1.6 }}>
            作成者の名前と集合場所、集合時刻を入力して部屋を作成してください。
          </p>

          {errorMessage && (
            <p role="alert" style={{ margin: 0, color: '#d9553d', fontSize: 16, fontWeight: 700 }}>
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !creatorName.trim() || !placeName.trim()}
            style={{
              marginTop: 8,
              padding: '18px 18px',
              borderRadius: 12,
              border: 'none',
              background: '#2a6052',
              color: '#fff',
              fontSize: 30,
              fontWeight: 800,
              cursor: isSubmitting || !creatorName.trim() || !placeName.trim() ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !creatorName.trim() || !placeName.trim() ? 0.6 : 1,
            }}
          >
            {isSubmitting ? '作成中...' : '新しい部屋を作る'}
          </button>
        </form>
      </div>
    </div>
  )
}
