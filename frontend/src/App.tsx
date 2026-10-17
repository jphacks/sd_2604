import { useState, type FormEvent } from 'react'
import { MapApiClient } from './component/MapApiClient'
import MapFeature from './component/MapFeature'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'https://backend.yonu33.workers.dev').replace(/\/+$/, '')
const defaultRoomTarget = { lat: 38.2606, lng: 140.8824 }
const participantNameStorageKey = 'meetpoint.participant-name'
const deviceIdStorageKey = 'meetpoint.device-id'

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

function getStoredParticipantName(): string {
	if (typeof window === 'undefined') return ''
	const saved = window.localStorage.getItem(participantNameStorageKey)
	return saved?.trim() ?? ''
}

function getOrCreateDeviceId(): string {
	if (typeof window === 'undefined') return 'local-device'
	const saved = window.localStorage.getItem(deviceIdStorageKey)
	if (saved) return saved
	const next = crypto.randomUUID()
	window.localStorage.setItem(deviceIdStorageKey, next)
	return next
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
	const [participantName, setParticipantName] = useState<string>(() => getStoredParticipantName())
	const [deviceId] = useState(() => getOrCreateDeviceId())
	const [isCreatingRoom, setIsCreatingRoom] = useState(false)

	const resolvedParticipant = participant ?? {
		id: deviceId,
		name: participantName.trim() || '自分',
	}

	const handleCreateRoom = async () => {
		const nextName = participantName.trim()
		if (!nextName) return

		window.localStorage.setItem(participantNameStorageKey, nextName)
		setParticipantName(nextName)

		if (roomId) return

		setIsCreatingRoom(true)
		try {
			const created = await apiClient.createRoom({
				title: roomInfo?.title ?? '待ち合わせ',
				targetName: roomInfo?.meetingPlace ?? '目的地',
				targetLat: defaultRoomTarget.lat,
				targetLng: defaultRoomTarget.lng,
				meetingTime: roomInfo?.meetingTime ?? new Date().toISOString(),
				destinationName: roomInfo?.meetingPlace ?? '目的地',
				destinationAddress: null,
			})
			const nextRoomId = created.roomId ?? created.room?.id
			if (!nextRoomId) return
			setRoomId(nextRoomId)
			setRoomIdInUrl(nextRoomId)
		} catch {
			// API失敗時は手動で再試行できるように画面を維持する
		} finally {
			setIsCreatingRoom(false)
		}
	}

	const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const nextName = participantName.trim()
		if (!nextName) return
		window.localStorage.setItem(participantNameStorageKey, nextName)
		setParticipantName(nextName)
		if (!roomId) {
			await handleCreateRoom()
		}
	}

	if (!roomId || !participantName.trim()) {
		return (
			<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f2', padding: 24 }}>
				<form onSubmit={handleJoin} style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 10px 35px rgba(25, 42, 35, 0.08)' }}>
					<p style={{ margin: 0, letterSpacing: '0.08em', color: '#6d7c73', fontSize: 12, fontWeight: 700 }}>MEETPOINT</p>
					<h1 style={{ margin: '12px 0 20px', fontSize: 32, color: '#1d2d28' }}>{roomId ? '入室' : '新しい部屋を作る'}</h1>
					<label style={{ display: 'grid', gap: 8, color: '#52665d', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
						<span>名前</span>
						<input
							type="text"
							value={participantName}
							onChange={(event) => setParticipantName(event.target.value)}
							placeholder="自分"
							maxLength={24}
							style={{ minHeight: 40, borderRadius: 8, border: '1px solid #dfe5dd', padding: '0 12px', fontSize: 16 }}
						/>
					</label>
					<p style={{ margin: '12px 0 20px', fontSize: 13, color: '#5a6d64' }}>
						{roomId ? 'この端末での参加者名を入力してから入室してください。' : '名前を入力して部屋を作成してください。'}
					</p>
					<button type="submit" disabled={!participantName.trim() || isCreatingRoom} style={{ width: '100%', minHeight: 44, border: 'none', borderRadius: 10, background: '#1b5d4c', color: '#fff', fontSize: 15, fontWeight: 700, cursor: participantName.trim() && !isCreatingRoom ? 'pointer' : 'not-allowed', opacity: participantName.trim() && !isCreatingRoom ? 1 : 0.5 }}>
						{isCreatingRoom ? '部屋を作成しています...' : roomId ? 'この部屋に入る' : '新しい部屋を作る'}
					</button>
				</form>
			</div>
		)
	}

	return (
		<MapFeature apiClient={apiClient} roomInfo={roomInfo} participant={resolvedParticipant} roomId={roomId} />
	)
}
