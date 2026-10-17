import { useEffect, useRef, useState } from 'react'
import { MapApiClient } from './component/MapApiClient'
import MapFeature from './component/MapFeature'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'https://backend.yonu33.workers.dev').replace(/\/+$/, '')
const defaultRoomTarget = { lat: 38.2606, lng: 140.8824 }

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
	const creationStartedRef = useRef(false)

	useEffect(() => {
		if (creationStartedRef.current) return
		if (roomId) {
			creationStartedRef.current = true
			return
		}

		creationStartedRef.current = true
		void (async () => {
			try {
				const created = await apiClient.createRoom({
					title: roomInfo?.title ?? '待ち合わせ',
					targetName: roomInfo?.meetingPlace ?? '目的地',
					targetLat: defaultRoomTarget.lat,
					targetLng: defaultRoomTarget.lng,
					meetingTime: roomInfo?.meetingTime ?? new Date().toISOString(),
				})
				const nextRoomId = created.roomId ?? created.room?.id
				if (!nextRoomId) return
				setRoomId(nextRoomId)
				setRoomIdInUrl(nextRoomId)
			} catch {
				// 実際の API 失敗時でも画面表示を継続し、再読み込みでやり直せるようにする
			}
		})()
	}, [apiClient, roomId, roomInfo])

	return (
		<MapFeature apiClient={apiClient} roomInfo={roomInfo} participant={participant} roomId={roomId} />
	)
}
